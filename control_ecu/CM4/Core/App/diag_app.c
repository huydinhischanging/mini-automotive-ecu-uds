/**
 * @file    diag_app.c
 * @brief   Control ECU diagnostics, see diag_app.h.
 */
#include "diag_app.h"

#include <string.h>

#include "cmsis_os.h"

#include "can_matrix.h"
#include "control_app.h"
#include "dtc_manager.h"
#include "isotp.h"
#include "sys_drv.h"
#include "uds_server.h"

#define DIAG_BUFFER_SIZE        (256U)
#define FW_VERSION              "CTRL-0.3.0"
#define FW_VERSION_LEN          (10U)

#define SELFTEST_START_DELAY_MS (3000U)
#define SELFTEST_STEP_GAP_MS    (100U)
#define SELFTEST_TIMEOUT_MS     (500U)

/* ---------------------------------------------------------------------------
 * DTC table - same order as Fault_t in control_app.c. Codes follow the SAE
 * J2012 layout (2-byte code + failure type byte); the mapping is project
 * specific.
 * ------------------------------------------------------------------------- */
static const DtcMgr_Config_t k_dtcTable[] =
{
    { 0xC10087UL, 1U },   /* U0100-87 lost communication with Sensor ECU (missing message) */
    { 0x050100UL, 3U },   /* P0501-00 vehicle speed sensor range/performance */
    { 0xC40081UL, 3U },   /* U0400-81 invalid data received from Sensor ECU */
    { 0x050096UL, 3U },   /* P0500-96 vehicle speed sensor component internal failure */
    { 0x9A0011UL, 3U },   /* B1A00-11 output driver circuit short to ground (simulated) */
};

/* ---------------------------------------------------------------------------
 * Data identifiers
 * ------------------------------------------------------------------------- */
static void ReadVersion(uint8_t *out)
{
    (void)memcpy(out, FW_VERSION, FW_VERSION_LEN);
}

static void ReadSpeed(uint8_t *out)
{
    uint16_t speed = ControlApp_GetSpeedX10();
    out[0] = (uint8_t)(speed >> 8U);
    out[1] = (uint8_t)(speed & 0xFFU);
}

static void ReadFaults(uint8_t *out)
{
    out[0] = ControlApp_GetFaultMask();
}

static const Uds_Did_t k_dids[] =
{
    { 0xF195U, FW_VERSION_LEN, ReadVersion },   /* system supplier software version */
    { 0x0100U, 2U,             ReadSpeed },     /* received vehicle speed, 0.1 km/h */
    { 0x0101U, 1U,             ReadFaults },    /* active fault bit mask */
};

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */
static osMutexId_t  s_dtcMutex;
static IsoTp_Link_t s_ecuLink;
static uint8_t      s_ecuRxBuf[DIAG_BUFFER_SIZE];
static uint8_t      s_ecuTxBuf[DIAG_BUFFER_SIZE];
static uint8_t      s_respBuf[DIAG_BUFFER_SIZE];

static uint32_t GetTimeMs(void)
{
    return osKernelGetTickCount();
}

static void DtcLock(void)   { (void)osMutexAcquire(s_dtcMutex, osWaitForever); }
static void DtcUnlock(void) { (void)osMutexRelease(s_dtcMutex); }

static bool SendFrame(void *ctx, uint16_t canId, const uint8_t *data, uint8_t dlc)
{
    (void)ctx;
    return ControlApp_CanSend(canId, data, dlc);
}

static void EcuReset(uint8_t resetType)
{
    if (resetType == 0x03U)
    {
        ControlApp_SoftReset();      /* new operation cycle, receivers resynchronised */
    }
    else
    {
        ControlApp_Log("[DIAG] hard reset\r\n");
        SysDrv_Restart();   /* see sys_drv.h: the core must not really reset */
    }
}

static void RespondTo(const uint8_t *req, uint16_t len, bool functional)
{
    uint16_t respLen = Uds_ProcessRequest(req, len, functional, s_respBuf, sizeof(s_respBuf));

    if (respLen > 0U)
    {
        (void)IsoTp_Transmit(&s_ecuLink, s_respBuf, respLen);
    }
}

static void OnEcuRequest(void *ctx, const uint8_t *data, uint16_t length, IsoTp_Result_t result)
{
    (void)ctx;
    if (result == ISOTP_OK)
    {
        RespondTo(data, length, false);
    }
}

static void OnEcuResponseSent(void *ctx, IsoTp_Result_t result)
{
    (void)ctx;
    if (result == ISOTP_OK)
    {
        Uds_ExecutePendingReset();   /* a reset only after its response is on the bus */
    }
}

/* ---------------------------------------------------------------------------
 * Loopback self-test: a second ISO-TP link plays the tester (TX 0x7E0,
 * RX 0x7E8) and checks the ECU responses against expected prefixes.
 * ------------------------------------------------------------------------- */
typedef struct
{
    const char    *name;
    const uint8_t *req;
    uint8_t        reqLen;
    const uint8_t *expect;          /* expected response prefix */
    uint8_t        expectLen;
    int8_t         injectLocal;     /* -1 unchanged, 0/1 set local fault before the step */
} TestStep_t;

#define STEP(n, r, e, inj) { (n), (r), (uint8_t)sizeof(r), (e), (uint8_t)sizeof(e), (inj) }

static const uint8_t rq_tp[]   = { 0x3E, 0x00 };             static const uint8_t rs_tp[]   = { 0x7E, 0x00 };
static const uint8_t rq_ver[]  = { 0x22, 0xF1, 0x95 };       static const uint8_t rs_ver[]  = { 0x62, 0xF1, 0x95, 'C', 'T', 'R', 'L', '-', '0', '.', '3', '.', '0' };
static const uint8_t rq_multi[]= { 0x22, 0xF1, 0x95, 0x01, 0x00, 0x01, 0x01, 0xF1, 0x95 };
static const uint8_t rs_multi[]= { 0x62, 0xF1, 0x95, 'C', 'T', 'R', 'L', '-', '0', '.', '3', '.', '0', 0x01, 0x00 };
static const uint8_t rq_bad[]  = { 0x85, 0x01 };             static const uint8_t rs_bad[]  = { 0x7F, 0x85, 0x11 };
static const uint8_t rq_did[]  = { 0x22, 0x12, 0x34 };       static const uint8_t rs_did[]  = { 0x7F, 0x22, 0x31 };
static const uint8_t rq_rst[]  = { 0x11, 0x01 };             static const uint8_t rs_rst[]  = { 0x7F, 0x11, 0x7E };
static const uint8_t rq_ext[]  = { 0x10, 0x03 };             static const uint8_t rs_ext[]  = { 0x50, 0x03, 0x00, 0x32, 0x01, 0xF4 };
static const uint8_t rq_cnt[]  = { 0x19, 0x01, 0x08 };       static const uint8_t rs_cnt0[] = { 0x59, 0x01, 0x7F, 0x01, 0x00, 0x00 };
static const uint8_t rs_cnt1[] = { 0x59, 0x01, 0x7F, 0x01, 0x00, 0x01 };
static const uint8_t rq_lst[]  = { 0x19, 0x02, 0x08 };       static const uint8_t rs_lst[]  = { 0x59, 0x02, 0x7F, 0x9A, 0x00, 0x11, 0x2F };
static const uint8_t rq_clr[]  = { 0x14, 0xFF, 0xFF, 0xFF }; static const uint8_t rs_clr[]  = { 0x54 };
static const uint8_t rq_soft[] = { 0x11, 0x03 };             static const uint8_t rs_soft[] = { 0x51, 0x03 };
static const uint8_t rq_def[]  = { 0x10, 0x01 };             static const uint8_t rs_def[]  = { 0x50, 0x01 };

static const TestStep_t k_steps[] =
{
    STEP("TesterPresent",               rq_tp,    rs_tp,    -1),
    STEP("ReadDID F195 (ECU sends FF+CF)", rq_ver, rs_ver, -1),
    STEP("ReadDID x4 (ECU receives FF+CF)", rq_multi, rs_multi, -1),
    STEP("Unknown service -> NRC 11",   rq_bad,   rs_bad,   -1),
    STEP("Unknown DID -> NRC 31",       rq_did,   rs_did,   -1),
    STEP("Reset in default -> NRC 7E",  rq_rst,   rs_rst,   -1),
    STEP("Session extended",            rq_ext,   rs_ext,   -1),
    STEP("Confirmed DTCs = 0",          rq_cnt,   rs_cnt0,   1),   /* inject after this step */
    STEP("Confirmed DTCs = 1",          rq_cnt,   rs_cnt1,  -1),
    STEP("DTC list B1A00-11 0x2F",      rq_lst,   rs_lst,    0),   /* heal after this step */
    STEP("Clear all DTCs",              rq_clr,   rs_clr,   -1),
    STEP("Confirmed DTCs = 0 again",    rq_cnt,   rs_cnt0,  -1),
    STEP("Soft reset",                  rq_soft,  rs_soft,  -1),
    STEP("Session default",             rq_def,   rs_def,   -1),
};
#define STEP_COUNT  ((uint8_t)(sizeof(k_steps) / sizeof(k_steps[0])))

typedef enum { ST_OFF = 0, ST_WAIT_START, ST_SEND, ST_WAIT_RESP, ST_DONE } StState_t;

static bool         s_selfTest = false;
static StState_t    s_stState = ST_OFF;
static uint8_t      s_stStep = 0U;
static uint8_t      s_stPassed = 0U;
static uint32_t     s_stTimer = 0U;
static IsoTp_Link_t s_testerLink;
static uint8_t      s_testerRxBuf[DIAG_BUFFER_SIZE];
static uint8_t      s_testerTxBuf[DIAG_BUFFER_SIZE];
static uint8_t      s_testerResp[DIAG_BUFFER_SIZE];
static uint16_t     s_testerRespLen = 0U;
static bool         s_testerGotResp = false;

static void OnTesterResponse(void *ctx, const uint8_t *data, uint16_t length, IsoTp_Result_t result)
{
    (void)ctx;
    if ((result == ISOTP_OK) && (length <= sizeof(s_testerResp)))
    {
        (void)memcpy(s_testerResp, data, length);
        s_testerRespLen = length;
        s_testerGotResp = true;
    }
}

#define LOGHEX_MAX_BYTES    (24U)

static void LogHex(const char *label, const uint8_t *data, uint16_t len)
{
    static const char hex[] = "0123456789ABCDEF";
    char       line[(3U * LOGHEX_MAX_BYTES) + 1U];
    const bool truncated = (len > LOGHEX_MAX_BYTES);
    uint16_t   n = truncated ? (uint16_t)LOGHEX_MAX_BYTES : len;

    for (uint16_t i = 0U; i < n; i++)
    {
        line[3U * i]        = hex[data[i] >> 4U];
        line[(3U * i) + 1U] = hex[data[i] & 0x0FU];
        line[(3U * i) + 2U] = ' ';
    }
    line[3U * n] = '\0';
    ControlApp_Log("         %s %s%s\r\n", label, line, truncated ? "..." : "");
}

static void FinishStep(bool pass)
{
    const TestStep_t *st = &k_steps[s_stStep];

    ControlApp_Log("[TEST] %2u/%u %-32s %s\r\n", (unsigned)s_stStep + 1U, (unsigned)STEP_COUNT,
                   st->name, pass ? "PASS" : "FAIL");
    if (!pass)
    {
        LogHex("req :", st->req, st->reqLen);
        LogHex("exp :", st->expect, st->expectLen);
        LogHex("got :", s_testerResp, s_testerGotResp ? s_testerRespLen : 0U);
    }
    if (pass)
    {
        s_stPassed++;
    }
    if (st->injectLocal >= 0)
    {
        ControlApp_SetLocalFaultInjection(st->injectLocal != 0);
    }

    s_stStep++;
    s_stTimer = GetTimeMs();
    s_stState = (s_stStep < STEP_COUNT) ? ST_SEND : ST_DONE;
    if (s_stState == ST_DONE)
    {
        ControlApp_Log("[TEST] UDS self-test finished: %u/%u passed\r\n",
                       (unsigned)s_stPassed, (unsigned)STEP_COUNT);
    }
}

static void SelfTestRun(void)
{
    uint32_t now = GetTimeMs();

    switch (s_stState)
    {
        case ST_WAIT_START:
            if ((now - s_stTimer) >= SELFTEST_START_DELAY_MS)
            {
                ControlApp_Log("[TEST] UDS self-test over CAN loopback (tester 0x7E0 -> ECU 0x7E8)\r\n");
                s_stState = ST_SEND;
            }
            break;

        case ST_SEND:
            if (((now - s_stTimer) >= SELFTEST_STEP_GAP_MS) && !IsoTp_IsTxBusy(&s_testerLink))
            {
                s_testerGotResp = false;
                s_testerRespLen = 0U;
                (void)IsoTp_Transmit(&s_testerLink, k_steps[s_stStep].req, k_steps[s_stStep].reqLen);
                s_stTimer = now;
                s_stState = ST_WAIT_RESP;
            }
            break;

        case ST_WAIT_RESP:
            if (s_testerGotResp)
            {
                const TestStep_t *st = &k_steps[s_stStep];
                bool pass = (s_testerRespLen >= st->expectLen) &&
                            (memcmp(s_testerResp, st->expect, st->expectLen) == 0);
                FinishStep(pass);
            }
            else if ((now - s_stTimer) >= SELFTEST_TIMEOUT_MS)
            {
                FinishStep(false);
            }
            else
            {
                /* waiting */
            }
            break;

        case ST_OFF:
        case ST_DONE:
        default:
            break;
    }
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
bool DiagApp_Init(bool loopbackSelfTest)
{
    IsoTp_Config_t tp;
    Uds_Config_t   uds;

    s_dtcMutex = osMutexNew(NULL);
    if ((s_dtcMutex == NULL) ||
        !DtcMgr_Init(k_dtcTable, (uint8_t)(sizeof(k_dtcTable) / sizeof(k_dtcTable[0])),
                     DtcLock, DtcUnlock))
    {
        return false;
    }

    uds.dids      = k_dids;
    uds.didCount  = (uint8_t)(sizeof(k_dids) / sizeof(k_dids[0]));
    uds.getTimeMs = GetTimeMs;
    uds.ecuReset  = EcuReset;
    Uds_Init(&uds);

    (void)memset(&tp, 0, sizeof(tp));
    tp.txId           = CANID_UDS_RESP_CONTROL;
    tp.rxId           = CANID_UDS_REQ_CONTROL;
    tp.rxBuffer       = s_ecuRxBuf;
    tp.rxBufferSize   = sizeof(s_ecuRxBuf);
    tp.txBuffer       = s_ecuTxBuf;
    tp.txBufferSize   = sizeof(s_ecuTxBuf);
    tp.blockSize      = 0U;      /* tester may send all CFs at once */
    tp.stMin          = 0U;
    tp.sendFrame      = SendFrame;
    tp.getTimeMs      = GetTimeMs;
    tp.rxIndication   = OnEcuRequest;
    tp.txConfirmation = OnEcuResponseSent;
    IsoTp_Init(&s_ecuLink, &tp);

    s_selfTest = loopbackSelfTest;
    if (s_selfTest)
    {
        tp.txId           = CANID_UDS_REQ_CONTROL;
        tp.rxId           = CANID_UDS_RESP_CONTROL;
        tp.rxBuffer       = s_testerRxBuf;
        tp.rxBufferSize   = sizeof(s_testerRxBuf);
        tp.txBuffer       = s_testerTxBuf;
        tp.txBufferSize   = sizeof(s_testerTxBuf);
        tp.blockSize      = 2U;  /* exercise flow control on the ECU side */
        tp.stMin          = 1U;
        tp.rxIndication   = OnTesterResponse;
        tp.txConfirmation = NULL;
        IsoTp_Init(&s_testerLink, &tp);
        s_stState = ST_WAIT_START;
        s_stTimer = GetTimeMs();
    }
    return true;
}

void DiagApp_OnFrame(const CanDrv_Frame_t *frame)
{
    if (frame->id == CANID_UDS_REQ_CONTROL)
    {
        IsoTp_RxFrame(&s_ecuLink, frame->data, frame->dlc);
    }
    else if (frame->id == 0x7DFU)
    {
        /* Functional requests are single frames only (ISO 15765-2). */
        uint8_t len = (uint8_t)(frame->data[0] & 0x0FU);
        if (((frame->data[0] >> 4U) == 0U) && (len > 0U) && (len < frame->dlc))
        {
            RespondTo(&frame->data[1], len, true);
        }
    }
    else if ((frame->id == CANID_UDS_RESP_CONTROL) && s_selfTest)
    {
        IsoTp_RxFrame(&s_testerLink, frame->data, frame->dlc);
    }
    else
    {
        /* not for us */
    }
}

void DiagApp_MainFunction(void)
{
    IsoTp_MainFunction(&s_ecuLink);
    Uds_MainFunction();
    if (s_selfTest)
    {
        IsoTp_MainFunction(&s_testerLink);
        SelfTestRun();
    }
}

void DiagApp_ReportFault(uint8_t index, bool failed)
{
    DtcMgr_ReportResult(index, failed);
}

uint8_t DiagApp_ConfirmedDtcCount(void)
{
    return DtcMgr_CountByStatusMask(DTC_STATUS_CDTC);
}
