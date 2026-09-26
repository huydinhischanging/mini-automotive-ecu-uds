/**
 * @file    control_app.c
 * @brief   Control ECU application, see control_app.h.
 *
 * Fault monitoring (each fault is reported to the DTC manager every cycle):
 *   SPEED_TIMEOUT  no valid 0x100 for SENSOR_SPEED_TIMEOUT_MS
 *   SPEED_RANGE    received speed above SENSOR_SPEED_MAX_X10
 *   SPEED_E2E      CRC / sequence error on 0x100, healed after 10 good frames
 *   SENSOR_ADC     Sensor ECU reports an ADC read error in its status byte
 *   OUTPUT_LOCAL   USER1 button toggles a simulated actuator fault
 * While a speed fault is active the output goes to its safe state (PWM 0 %).
 */
#include "control_app.h"

#include <stdarg.h>
#include <stdio.h>

#include "cmsis_os.h"
#include "FreeRTOS.h"

#include "can_drv.h"
#include "can_matrix.h"
#include "diag_app.h"
#include "dtc_manager.h"
#include "e2e.h"
#include "io_drv.h"

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */
/* 1: FDCAN internal loopback + a fake Sensor frame every 10 ms, so the whole
 *    receive path can be tested on the DK1 alone. 0: real bus. */
#define CONTROL_APP_CAN_LOOPBACK    (0U)

#define RX_QUEUE_LEN                (32U)
#define MONITOR_PERIOD_MS           (10U)
#define LOG_PERIOD_TICKS            (1000U / MONITOR_PERIOD_MS)
#define STARTUP_GRACE_MS            (500U)
#define E2E_HEAL_FRAMES             (10U)
#define BUTTON_DEBOUNCE_TICKS       (3U)

typedef enum
{
    FAULT_SPEED_TIMEOUT = 0,
    FAULT_SPEED_RANGE,
    FAULT_SPEED_E2E,
    FAULT_SENSOR_ADC,
    FAULT_OUTPUT_LOCAL,
    FAULT_COUNT
} Fault_t;

static const char *const k_faultNames[FAULT_COUNT] =
{
    "SPEED_TIMEOUT", "SPEED_RANGE", "SPEED_E2E", "SENSOR_ADC", "OUTPUT_LOCAL"
};

typedef struct
{
    uint32_t ok;
    uint32_t lost;
    uint32_t crc;
    uint32_t repeated;
    uint32_t wrongSeq;
} E2eStats_t;

/* Latest view of the Sensor ECU, written by ComRx, read by Monitor. */
typedef struct
{
    uint16_t   speedX10;
    uint16_t   adcRaw;
    uint8_t    sensorStatus;
    uint32_t   lastValidTick;
    bool       received;
    bool       e2eError;
    uint8_t    goodStreak;
    E2eStats_t e2e;
    uint32_t   aliveFrames;
    uint32_t   udsRequests;
} SensorView_t;

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */
static osMessageQueueId_t s_rxQueue;
static osMutexId_t        s_viewMutex;
static SensorView_t       s_view;
static E2e_RxState_t      s_e2eSpeed;
static E2e_RxState_t      s_e2eAlive;
static volatile uint32_t  s_rxQueueOverflow = 0U;
static osMutexId_t        s_txMutex;     /* CanDrv_Write from Monitor and ComRx */
static osMutexId_t        s_logMutex;    /* keeps log lines of both tasks intact */
static volatile bool      s_localInject = false;

static bool     s_faults[FAULT_COUNT];
static uint32_t s_startTick;

static const osThreadAttr_t k_comRxAttr =
{
    .name = "ComRx", .stack_size = 512U * 4U, .priority = osPriorityAboveNormal
};
static const osThreadAttr_t k_monitorAttr =
{
    .name = "Monitor", .stack_size = 512U * 4U, .priority = osPriorityNormal
};

/* 0x100-0x101 sensor data; 0x7DF (functional) .. 0x7E0 (physical) diagnostic
 * requests. The range reaches 0x7E8 so that the loopback self-test tester can
 * receive the ECU responses; other IDs in between are ignored in software. */
static const CanDrv_Filter_t k_filters[] =
{
    { CANID_SENSOR_SPEED, CANID_SENSOR_ALIVE },
    { 0x7DFU,             CANID_UDS_RESP_CONTROL }
};

/* ---------------------------------------------------------------------------
 * CAN receive path
 * ------------------------------------------------------------------------- */
/* ISR context: only copy the frame into the queue, all work is done in ComRx. */
static void OnCanRx(const CanDrv_Frame_t *frame)
{
    if (osMessageQueuePut(s_rxQueue, frame, 0U, 0U) != osOK)
    {
        s_rxQueueOverflow++;
    }
}

static void CountE2e(E2eStats_t *stats, E2e_Status_t status)
{
    switch (status)
    {
        case E2E_OK:
        case E2E_INITIAL:       stats->ok++;       break;
        case E2E_OK_SOME_LOST:  stats->lost++;     break;
        case E2E_ERR_CRC:
        case E2E_ERR_LENGTH:    stats->crc++;      break;
        case E2E_ERR_REPEATED:  stats->repeated++; break;
        case E2E_ERR_WRONG_SEQ: stats->wrongSeq++; break;
        default:                                   break;
    }
}

static void HandleSpeedFrame(const CanDrv_Frame_t *frame)
{
    E2e_Status_t status = E2e_Check(&s_e2eSpeed, frame->data, frame->dlc);

    osMutexAcquire(s_viewMutex, osWaitForever);
    CountE2e(&s_view.e2e, status);

    if (E2e_IsValid(status))
    {
        s_view.speedX10      = (uint16_t)(((uint16_t)frame->data[0] << 8U) | frame->data[1]);
        s_view.adcRaw        = (uint16_t)(((uint16_t)frame->data[2] << 8U) | frame->data[3]);
        s_view.sensorStatus  = frame->data[4];
        s_view.lastValidTick = osKernelGetTickCount();
        s_view.received      = true;
        if (s_view.goodStreak < E2E_HEAL_FRAMES)
        {
            s_view.goodStreak++;
        }
        else
        {
            s_view.e2eError = false;
        }
    }
    else
    {
        s_view.e2eError   = true;   /* data discarded, output keeps last good value */
        s_view.goodStreak = 0U;
    }
    osMutexRelease(s_viewMutex);
}

static void ComRxTask(void *argument)
{
    CanDrv_Frame_t frame;
    (void)argument;

    for (;;)
    {
        /* 2 ms timeout: ISO-TP and UDS timers must run even without traffic. */
        if (osMessageQueueGet(s_rxQueue, &frame, NULL, 2U) != osOK)
        {
            DiagApp_MainFunction();
            continue;
        }

        switch (frame.id)
        {
            case CANID_SENSOR_SPEED:
                HandleSpeedFrame(&frame);
                break;

            case CANID_SENSOR_ALIVE:
                (void)E2e_Check(&s_e2eAlive, frame.data, frame.dlc);
                osMutexAcquire(s_viewMutex, osWaitForever);
                s_view.aliveFrames++;
                osMutexRelease(s_viewMutex);
                break;

            case CANID_UDS_REQ_CONTROL:
            case 0x7DFU:
            case CANID_UDS_RESP_CONTROL:
                DiagApp_OnFrame(&frame);
                osMutexAcquire(s_viewMutex, osWaitForever);
                s_view.udsRequests++;
                osMutexRelease(s_viewMutex);
                break;

            default:
                break;
        }
        DiagApp_MainFunction();
    }
}

/* ---------------------------------------------------------------------------
 * Monitoring and output
 * ------------------------------------------------------------------------- */
static void SetFault(Fault_t fault, bool active)
{
    if (s_faults[fault] != active)
    {
        s_faults[fault] = active;
        ControlApp_Log("[CTRL] fault %-13s %s\r\n", k_faultNames[fault], active ? "SET" : "cleared");
    }
}

static void HandleButton(void)
{
    static uint8_t stableTicks = 0U;
    static bool    latched = false;

    if (IoDrv_IsUserButtonPressed())
    {
        if (stableTicks < BUTTON_DEBOUNCE_TICKS)
        {
            stableTicks++;
        }
        else if (!latched)
        {
            latched = true;
            s_localInject = !s_localInject;
        }
        else
        {
            /* held */
        }
    }
    else
    {
        stableTicks = 0U;
        latched     = false;
    }
}

static void LogStatus(const SensorView_t *v, uint32_t ageMs, uint16_t duty)
{
    CanDrv_Stats_t bus;
    uint32_t mask = 0U;

    CanDrv_GetStats(&bus);
    for (uint32_t i = 0U; i < (uint32_t)FAULT_COUNT; i++)
    {
        mask |= (s_faults[i] ? 1UL : 0UL) << i;
    }

    ControlApp_Log("[CTRL] speed=%u.%u km/h age=%lums pwm=%u.%u%% | e2e ok=%lu lost=%lu crc=%lu rep=%lu seq=%lu"
           " | faults=0x%02lx dtc=%u | rx=%lu tx=%lu busoff=%lu qovf=%lu uds=%lu heap=%u\r\n",
           (unsigned)(v->speedX10 / 10U), (unsigned)(v->speedX10 % 10U),
           (unsigned long)ageMs, (unsigned)(duty / 10U), (unsigned)(duty % 10U),
           (unsigned long)v->e2e.ok, (unsigned long)v->e2e.lost, (unsigned long)v->e2e.crc,
           (unsigned long)v->e2e.repeated, (unsigned long)v->e2e.wrongSeq,
           (unsigned long)mask, (unsigned)DiagApp_ConfirmedDtcCount(), (unsigned long)bus.rxCount, (unsigned long)bus.txQueued,
           (unsigned long)bus.busOffCount, (unsigned long)s_rxQueueOverflow,
           (unsigned long)v->udsRequests, (unsigned)xPortGetFreeHeapSize());
}

#if (CONTROL_APP_CAN_LOOPBACK != 0U)
/* Loopback self-test: play the Sensor ECU (ramp 0..250 km/h). */
static void SendFakeSensorFrame(void)
{
    static uint8_t  counter = 0U;
    static uint16_t speed = 0U;
    CanDrv_Frame_t frame = {0};

    speed = (uint16_t)((speed + 5U) % (SENSOR_SPEED_MAX_X10 + 1U));
    frame.id  = CANID_SENSOR_SPEED;
    frame.dlc = SENSOR_SPEED_DLC;
    frame.data[0] = (uint8_t)(speed >> 8U);
    frame.data[1] = (uint8_t)(speed & 0xFFU);
    E2e_Protect(frame.data, &counter);
    (void)ControlApp_CanSend(frame.id, frame.data, frame.dlc);
}
#endif

/* Cyclic status of this ECU: lets the other nodes (and a bus trace) see the
 * Control ECU alive, and gives bidirectional traffic on the bus. */
static void SendStatusFrame(uint16_t duty)
{
    static uint8_t counter = 0U;
    uint8_t data[CONTROL_STATUS_DLC] = {0};

    data[0] = ControlApp_GetFaultMask();
    data[1] = DiagApp_ConfirmedDtcCount();
    data[2] = (uint8_t)(duty >> 8U);
    data[3] = (uint8_t)(duty & 0xFFU);
    E2e_Protect(data, &counter);
    (void)ControlApp_CanSend(CANID_CONTROL_STATUS, data, CONTROL_STATUS_DLC);
}

static void MonitorTask(void *argument)
{
    uint32_t     next = osKernelGetTickCount();
    uint32_t     tick = 0U;
    SensorView_t view;
    (void)argument;

    for (;;)
    {
        uint32_t now;
        uint32_t ageMs;
        bool     speedFault;
        uint16_t duty;

        next += MONITOR_PERIOD_MS;
        (void)osDelayUntil(next);
        tick++;

#if (CONTROL_APP_CAN_LOOPBACK != 0U)
        SendFakeSensorFrame();
#endif

        osMutexAcquire(s_viewMutex, osWaitForever);
        view = s_view;
        osMutexRelease(s_viewMutex);

        now   = osKernelGetTickCount();
        ageMs = view.received ? (now - view.lastValidTick) : (now - s_startTick);

        /* Before the first frame, give the Sensor ECU time to boot. */
        SetFault(FAULT_SPEED_TIMEOUT,
                 (ageMs > SENSOR_SPEED_TIMEOUT_MS) &&
                 (view.received || ((now - s_startTick) > STARTUP_GRACE_MS)));
        SetFault(FAULT_SPEED_RANGE, view.received && (view.speedX10 > SENSOR_SPEED_MAX_X10));
        SetFault(FAULT_SPEED_E2E, view.e2eError);
        SetFault(FAULT_SENSOR_ADC, (view.sensorStatus & SENSOR_STATUS_ADC_ERROR) != 0U);
        HandleButton();
        SetFault(FAULT_OUTPUT_LOCAL, s_localInject);

        /* Every monitor ran this cycle: report all results to the DTC manager. */
        for (uint8_t i = 0U; i < (uint8_t)FAULT_COUNT; i++)
        {
            DiagApp_ReportFault(i, s_faults[i]);
        }

        /* Safe state: never drive the output from stale or implausible data. */
        speedFault = s_faults[FAULT_SPEED_TIMEOUT] || s_faults[FAULT_SPEED_RANGE] ||
                     s_faults[FAULT_SPEED_E2E] || s_faults[FAULT_OUTPUT_LOCAL];
        duty = speedFault ? 0U
                          : (uint16_t)(((uint32_t)view.speedX10 * IODRV_PWM_MAX) / SENSOR_SPEED_MAX_X10);
        IoDrv_SetPwm(duty);

        CanDrv_MainFunction();

        if ((tick % (CONTROL_STATUS_CYCLE_MS / MONITOR_PERIOD_MS)) == 0U)
        {
            SendStatusFrame(duty);
        }

        if ((tick % LOG_PERIOD_TICKS) == 0U)
        {
            LogStatus(&view, ageMs, duty);
        }
    }
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
bool ControlApp_Init(void)
{
    CanDrv_Mode_t mode = (CONTROL_APP_CAN_LOOPBACK != 0U) ? CANDRV_MODE_INTERNAL_LOOPBACK
                                                          : CANDRV_MODE_NORMAL;
    CanDrv_Stats_t bus;

    E2e_InitRx(&s_e2eSpeed);
    E2e_InitRx(&s_e2eAlive);
    s_startTick = osKernelGetTickCount();

    s_rxQueue   = osMessageQueueNew(RX_QUEUE_LEN, sizeof(CanDrv_Frame_t), NULL);
    s_viewMutex = osMutexNew(NULL);
    s_txMutex   = osMutexNew(NULL);
    s_logMutex  = osMutexNew(NULL);
    if ((s_rxQueue == NULL) || (s_viewMutex == NULL) || (s_txMutex == NULL) || (s_logMutex == NULL))
    {
        printf("[CTRL] RTOS object creation failed (heap too small?)\r\n");
        return false;
    }

    if (!IoDrv_Init())
    {
        printf("[CTRL] PWM init failed\r\n");
        return false;
    }

    if (CanDrv_Init(mode, OnCanRx, k_filters,
                    (uint8_t)(sizeof(k_filters) / sizeof(k_filters[0]))) != CANDRV_OK)
    {
        printf("[CTRL] CAN init failed\r\n");
        return false;
    }

    if (!DiagApp_Init(CONTROL_APP_CAN_LOOPBACK != 0U))
    {
        printf("[CTRL] diagnostics init failed\r\n");
        return false;
    }

    if ((osThreadNew(ComRxTask, NULL, &k_comRxAttr) == NULL) ||
        (osThreadNew(MonitorTask, NULL, &k_monitorAttr) == NULL))
    {
        printf("[CTRL] task creation failed (heap too small?)\r\n");
        return false;
    }

    CanDrv_GetStats(&bus);
    printf("[CTRL] start, CAN %s, FDCAN clock %lu Hz, heap free %u\r\n",
           (CONTROL_APP_CAN_LOOPBACK != 0U) ? "INTERNAL LOOPBACK" : "NORMAL",
           (unsigned long)bus.kernelClockHz, (unsigned)xPortGetFreeHeapSize());
    return true;
}

bool ControlApp_CanSend(uint16_t id, const uint8_t *data, uint8_t dlc)
{
    CanDrv_Frame_t frame;
    bool           ok;

    if ((data == NULL) || (dlc > CANDRV_MAX_DLC))
    {
        return false;
    }
    frame.id  = id;
    frame.dlc = dlc;
    for (uint8_t i = 0U; i < dlc; i++)
    {
        frame.data[i] = data[i];
    }

    /* HAL_FDCAN_AddMessageToTxFifoQ is not re-entrant: serialise both tasks. */
    (void)osMutexAcquire(s_txMutex, osWaitForever);
    ok = (CanDrv_Write(&frame) == CANDRV_OK);
    (void)osMutexRelease(s_txMutex);
    return ok;
}

uint16_t ControlApp_GetSpeedX10(void)
{
    uint16_t speed;

    (void)osMutexAcquire(s_viewMutex, osWaitForever);
    speed = s_view.speedX10;
    (void)osMutexRelease(s_viewMutex);
    return speed;
}

uint8_t ControlApp_GetFaultMask(void)
{
    uint8_t mask = 0U;

    for (uint8_t i = 0U; i < (uint8_t)FAULT_COUNT; i++)
    {
        if (s_faults[i])
        {
            mask |= (uint8_t)(1U << i);
        }
    }
    return mask;
}

void ControlApp_SetLocalFaultInjection(bool active)
{
    s_localInject = active;
}

/* UDS 0x11 03: restart the application without resetting the core. */
void ControlApp_SoftReset(void)
{
    E2e_InitRx(&s_e2eSpeed);
    E2e_InitRx(&s_e2eAlive);
    DtcMgr_StartOperationCycle();
    ControlApp_Log("[CTRL] soft reset: new operation cycle\r\n");
}

void ControlApp_Log(const char *fmt, ...)
{
    va_list args;

    (void)osMutexAcquire(s_logMutex, osWaitForever);
    va_start(args, fmt);
    (void)vprintf(fmt, args);
    va_end(args);
    (void)osMutexRelease(s_logMutex);
}
