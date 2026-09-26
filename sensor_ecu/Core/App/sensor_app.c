/**
 * @file    sensor_app.c
 * @brief   Sensor ECU application.
 *
 * Button B1 cycles through fault injection modes so the Control ECU's
 * diagnostics can be exercised without touching wires:
 *   NONE         -> normal operation, LED blinks slowly (1 Hz)
 *   SILENT       -> 0x100 is no longer sent       -> Control ECU timeout DTC
 *   OUT_OF_RANGE -> speed = 300.0 km/h (invalid)  -> Control ECU range DTC
 * In both fault modes the LED blinks fast (5 Hz).
 */
#include "sensor_app.h"

#include <stdio.h>

#include "adc_drv.h"
#include "can_drv.h"
#include "can_matrix.h"
#include "e2e.h"
#include "gpio_drv.h"
#include "tester_app.h"

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */
/* 1: FDCAN internal loopback, runs on the bare Nucleo (week 2 test).
 * 0: normal mode, needs the SN65HVD230 and at least one other node to ACK. */
#define SENSOR_APP_CAN_LOOPBACK     (0U)

#define TASK_PERIOD_MS              (10U)
#define ALIVE_PERIOD_TICKS          (SENSOR_ALIVE_CYCLE_MS / TASK_PERIOD_MS)
#define LOG_PERIOD_TICKS            (1000U / TASK_PERIOD_MS)
#define TICKS_PER_SECOND            (1000U / TASK_PERIOD_MS)
#define LED_SLOW_TOGGLE_TICKS       (50U)   /* 500 ms -> 1 Hz blink */
#define LED_FAST_TOGGLE_TICKS       (10U)   /* 100 ms -> 5 Hz blink */

#define BUTTON_DEBOUNCE_TICKS       (3U)    /* 30 ms stable before accepting */

#define FILTER_SIZE                 (8U)    /* moving average window, power of 2 */
#define FILTER_SHIFT                (3U)    /* log2(FILTER_SIZE) */

#define FAULT_SPEED_OUT_OF_RANGE    (3000U) /* 300.0 km/h, above SENSOR_SPEED_MAX_X10 */

typedef enum
{
    FAULT_NONE = 0,
    FAULT_SILENT,
    FAULT_OUT_OF_RANGE,
    FAULT_MODE_COUNT
} FaultMode_t;

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */
static uint16_t    s_filterBuf[FILTER_SIZE];
static uint32_t    s_filterSum = 0U;
static uint8_t     s_filterIdx = 0U;

static uint16_t    s_adcFiltered = 0U;
static bool        s_adcError = false;

static FaultMode_t s_faultMode = FAULT_NONE;
static uint8_t     s_btnStableTicks = 0U;
static bool        s_btnLatched = false;

static uint8_t     s_speedAlive = 0U;
static uint8_t     s_aliveAlive = 0U;
static uint32_t    s_tick = 0U;

static volatile uint32_t s_rxSpeedFrames = 0U;   /* written in ISR */

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
static void PutU16Be(uint8_t *dst, uint16_t value)
{
    dst[0] = (uint8_t)(value >> 8U);
    dst[1] = (uint8_t)(value & 0xFFU);
}

static void PutU32Be(uint8_t *dst, uint32_t value)
{
    dst[0] = (uint8_t)(value >> 24U);
    dst[1] = (uint8_t)((value >> 16U) & 0xFFU);
    dst[2] = (uint8_t)((value >> 8U) & 0xFFU);
    dst[3] = (uint8_t)(value & 0xFFU);
}

static void FilterReset(uint16_t sample)
{
    for (uint8_t i = 0U; i < FILTER_SIZE; i++)
    {
        s_filterBuf[i] = sample;
    }
    s_filterSum = (uint32_t)sample * FILTER_SIZE;
    s_filterIdx = 0U;
}

/* Moving average over the last 8 samples (80 ms): removes ADC noise and
 * breadboard jitter while adding only ~40 ms of delay. */
static uint16_t FilterUpdate(uint16_t sample)
{
    s_filterSum -= s_filterBuf[s_filterIdx];
    s_filterSum += sample;
    s_filterBuf[s_filterIdx] = sample;
    s_filterIdx = (uint8_t)((s_filterIdx + 1U) & (FILTER_SIZE - 1U));
    return (uint16_t)(s_filterSum >> FILTER_SHIFT);
}

static uint16_t AdcToSpeedX10(uint16_t adc)
{
    /* 0..4095 -> 0..2500 (0.0..250.0 km/h), rounded */
    return (uint16_t)((((uint32_t)adc * SENSOR_SPEED_MAX_X10) + (ADCDRV_MAX_VALUE / 2U))
                      / ADCDRV_MAX_VALUE);
}

static void SampleInput(void)
{
    uint16_t raw = 0U;

    if (AdcDrv_Read(&raw) == ADCDRV_OK)
    {
        s_adcError    = false;
        s_adcFiltered = FilterUpdate(raw);
    }
    else
    {
        s_adcError = true;   /* keep last good value, flag it in the frame */
    }
}

static void HandleButton(void)
{
    if (GpioDrv_IsButtonPressed())
    {
        if (s_btnStableTicks < BUTTON_DEBOUNCE_TICKS)
        {
            s_btnStableTicks++;
        }
        else if (!s_btnLatched)
        {
            s_btnLatched = true;   /* one action per press */
            switch (s_faultMode)
            {
                case FAULT_NONE:   s_faultMode = FAULT_SILENT;       break;
                case FAULT_SILENT: s_faultMode = FAULT_OUT_OF_RANGE; break;
                default:           s_faultMode = FAULT_NONE;         break;
            }
            (void)printf("[SENSOR] fault mode -> %u\r\n", (unsigned)s_faultMode);
        }
        else
        {
            /* still held, nothing to do */
        }
    }
    else
    {
        s_btnStableTicks = 0U;
        s_btnLatched     = false;
    }
}

static void SendSpeedFrame(void)
{
    CanDrv_Frame_t frame = {0};
    uint16_t speed = AdcToSpeedX10(s_adcFiltered);
    uint8_t status = 0U;

    if (s_faultMode == FAULT_SILENT)
    {
        return;
    }
    if (s_faultMode == FAULT_OUT_OF_RANGE)
    {
        speed = FAULT_SPEED_OUT_OF_RANGE;
    }
    if (s_faultMode != FAULT_NONE)
    {
        status |= SENSOR_STATUS_FAULT_INJ;
    }
    if (s_adcError)
    {
        status |= SENSOR_STATUS_ADC_ERROR;
    }

    frame.id  = CANID_SENSOR_SPEED;
    frame.dlc = SENSOR_SPEED_DLC;
    PutU16Be(&frame.data[0], speed);
    PutU16Be(&frame.data[2], s_adcFiltered);
    frame.data[4] = status;
    /* Alive counter + CRC let the Control ECU detect lost, repeated or
     * corrupted frames end-to-end (AUTOSAR E2E idea). */
    E2e_Protect(frame.data, &s_speedAlive);

    (void)CanDrv_Write(&frame);   /* drops are counted in the driver stats */
}

static void SendAliveFrame(void)
{
    CanDrv_Frame_t frame = {0};
    CanDrv_Stats_t stats;

    CanDrv_GetStats(&stats);

    frame.id  = CANID_SENSOR_ALIVE;
    frame.dlc = SENSOR_ALIVE_DLC;
    frame.data[0] = (s_faultMode == FAULT_NONE) ? 0U : 1U;
    PutU32Be(&frame.data[1], s_tick / TICKS_PER_SECOND);
    frame.data[5] = (stats.busOffCount > 255U) ? 255U : (uint8_t)stats.busOffCount;
    E2e_Protect(frame.data, &s_aliveAlive);

    (void)CanDrv_Write(&frame);
}

static void UpdateLed(void)
{
    uint32_t period = (s_faultMode == FAULT_NONE) ? LED_SLOW_TOGGLE_TICKS : LED_FAST_TOGGLE_TICKS;

    if ((s_tick % period) == 0U)
    {
        GpioDrv_ToggleLed();
    }
}

static void LogStatus(void)
{
    CanDrv_Stats_t stats;
    uint16_t speed = AdcToSpeedX10(s_adcFiltered);

    CanDrv_GetStats(&stats);
    (void)printf("[SENSOR] speed=%u.%u km/h adc=%u mode=%u | tx=%lu drop=%lu rx=%lu rx100=%lu busoff=%lu\r\n",
           (unsigned)speed / 10U, (unsigned)speed % 10U, (unsigned)s_adcFiltered,
           (unsigned)s_faultMode,
           (unsigned long)stats.txQueued, (unsigned long)stats.txDropped,
           (unsigned long)stats.rxCount, (unsigned long)s_rxSpeedFrames,
           (unsigned long)stats.busOffCount);
}

/* Interrupt context. In loopback mode every frame we send comes back here,
 * which proves the TX path, the filter and the RX path all work. */
static void OnCanRx(const CanDrv_Frame_t *frame)
{
    if (frame->id == CANID_SENSOR_SPEED)
    {
        s_rxSpeedFrames++;
    }
    TesterApp_OnCanFrameIsr(frame);   /* UDS responses for the tester */
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
bool SensorApp_Init(void)
{
    uint16_t first = 0U;
    CanDrv_Mode_t mode = (SENSOR_APP_CAN_LOOPBACK != 0U) ? CANDRV_MODE_INTERNAL_LOOPBACK
                                                         : CANDRV_MODE_NORMAL;

    GpioDrv_SetLed(false);

    if (AdcDrv_Init() != ADCDRV_OK)
    {
        return false;
    }
    /* Prime the filter with a real sample so the first frames are not 0. */
    (void)AdcDrv_Read(&first);
    FilterReset(first);
    s_adcFiltered = first;

    if (CanDrv_Init(mode, OnCanRx) != CANDRV_OK)
    {
        return false;
    }

    (void)printf("\r\n[SENSOR] start, CAN %s, 500 kbit/s\r\n",
           (SENSOR_APP_CAN_LOOPBACK != 0U) ? "INTERNAL LOOPBACK" : "NORMAL");
    return true;
}

void SensorApp_Task10ms(void)
{
    s_tick++;

    HandleButton();
    SampleInput();
    SendSpeedFrame();

    if ((s_tick % ALIVE_PERIOD_TICKS) == 0U)
    {
        SendAliveFrame();
    }

    CanDrv_MainFunction();
    UpdateLed();

    if ((s_tick % LOG_PERIOD_TICKS) == 0U)
    {
        LogStatus();
    }
}

uint16_t SensorApp_GetSpeedX10(void)
{
    return AdcToSpeedX10(s_adcFiltered);
}
