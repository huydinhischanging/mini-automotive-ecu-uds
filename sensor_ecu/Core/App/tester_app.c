/**
 * @file    tester_app.c
 * @brief   Minimal UDS tester on the Sensor ECU, see tester_app.h.
 */
#include "tester_app.h"

#include <stdio.h>
#include <string.h>

#include "can_matrix.h"
#include "isotp.h"
#include "sensor_app.h"
#include "time_drv.h"
#include "uart_drv.h"

#define RING_LEN                (32U)       /* CAN frames buffered from the ISR */
#define TESTER_BUFFER_SIZE      (128U)
#define RESPONSE_TIMEOUT_MS     (1000U)     /* >= P2* of the server */
#define NO_RESPONSE_WAIT_MS     (300U)
#define FUNCTIONAL_ID           (0x7DFU)

typedef struct
{
    const char    *name;
    const uint8_t *req;
    uint8_t        reqLen;
    const uint8_t *expect;          /* expected response prefix, NULL = none expected */
    uint8_t        expectLen;
    uint16_t       delayMs;         /* wait before sending */
    bool           functional;      /* send as single frame on 0x7DF */
} Step_t;

#define STEP(n, r, e)        { (n), (r), (uint8_t)sizeof(r), (e), (uint8_t)sizeof(e), 0U, false }
#define STEP_D(n, r, e, d)   { (n), (r), (uint8_t)sizeof(r), (e), (uint8_t)sizeof(e), (d), false }
#define STEP_F(n, r, e)      { (n), (r), (uint8_t)sizeof(r), (e), (uint8_t)sizeof(e), 0U, true }
#define STEP_F_SILENT(n, r)  { (n), (r), (uint8_t)sizeof(r), NULL, 0U, 0U, true }

/* ---------------------------------------------------------------------------
 * Requests and expected response prefixes
 * ------------------------------------------------------------------------- */
static const uint8_t rq_tp[]    = { 0x3E, 0x00 };             static const uint8_t rs_tp[]   = { 0x7E, 0x00 };
static const uint8_t rq_ver[]   = { 0x22, 0xF1, 0x95 };       static const uint8_t rs_ver[]  = { 0x62, 0xF1, 0x95 };
static const uint8_t rq_spd[]   = { 0x22, 0x01, 0x00 };       static const uint8_t rs_spd[]  = { 0x62, 0x01, 0x00 };
static const uint8_t rq_multi[] = { 0x22, 0xF1, 0x95, 0x01, 0x00, 0x01, 0x01 };
static const uint8_t rq_bad[]   = { 0x85, 0x01 };             static const uint8_t rs_bad[]  = { 0x7F, 0x85, 0x11 };
static const uint8_t rq_did[]   = { 0x22, 0x12, 0x34 };       static const uint8_t rs_did[]  = { 0x7F, 0x22, 0x31 };
static const uint8_t rq_rst[]   = { 0x11, 0x01 };             static const uint8_t rs_rstn[] = { 0x7F, 0x11, 0x7E };
static const uint8_t rs_rst[]   = { 0x51, 0x01 };
static const uint8_t rq_dtc[]   = { 0x19, 0x02, 0xFF };       static const uint8_t rs_dtc[]  = { 0x59, 0x02, 0x7F };
static const uint8_t rq_ext[]   = { 0x10, 0x03 };             static const uint8_t rs_ext[]  = { 0x50, 0x03, 0x00, 0x32, 0x01, 0xF4 };
static const uint8_t rq_clr[]   = { 0x14, 0xFF, 0xFF, 0xFF }; static const uint8_t rs_clr[]  = { 0x54 };
static const uint8_t rq_cnt[]   = { 0x19, 0x01, 0x08 };       static const uint8_t rs_cnt0[] = { 0x59, 0x01, 0x7F, 0x01, 0x00, 0x00 };
static const uint8_t rq_def[]   = { 0x10, 0x01 };             static const uint8_t rs_def[]  = { 0x50, 0x01 };

static const Step_t k_seqTest[] =
{
    STEP("TesterPresent",                    rq_tp,    rs_tp),
    STEP("ReadDID F195 version",             rq_ver,   rs_ver),
    STEP("ReadDID 0100 speed",               rq_spd,   rs_spd),
    STEP("ReadDID x3 (tester sends FF+CF)",  rq_multi, rs_ver),
    STEP("Unknown service -> NRC 11",        rq_bad,   rs_bad),
    STEP("Unknown DID -> NRC 31",            rq_did,   rs_did),
    STEP("Reset in default -> NRC 7E",       rq_rst,   rs_rstn),
    STEP("Read all DTCs",                    rq_dtc,   rs_dtc),
    STEP("Session extended",                 rq_ext,   rs_ext),
    STEP("Clear all DTCs",                   rq_clr,   rs_clr),
    STEP("Confirmed DTCs = 0",               rq_cnt,   rs_cnt0),
    STEP("Session default",                  rq_def,   rs_def),
};
static const Step_t k_seqDtc[]   = { STEP("Read all DTCs", rq_dtc, rs_dtc) };
static const Step_t k_seqClear[] = { STEP("Clear all DTCs", rq_clr, rs_clr) };
static const Step_t k_seqVer[]   =
{
    STEP("ReadDID F195 version", rq_ver, rs_ver),
    STEP("ReadDID 0100 speed",   rq_spd, rs_spd),
};
static const Step_t k_seqFunc[]  =
{
    STEP_F("Functional TesterPresent",               rq_tp, rs_tp),
    STEP_F_SILENT("Functional unknown service: silent", rq_bad),
};
static const Step_t k_seqReset[] =
{
    STEP("Session extended",                 rq_ext, rs_ext),
    STEP("ECUReset hard",                    rq_rst, rs_rst),
    STEP_D("ECU back: TesterPresent (after 3 s)", rq_tp, rs_tp, 3000U),
    STEP("ECU back: ReadDID F195",           rq_ver, rs_ver),
};

#define LEN(a)  ((uint8_t)(sizeof(a) / sizeof((a)[0])))

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */
typedef enum { ST_IDLE = 0, ST_DELAY, ST_SEND, ST_WAIT } State_t;

static CanDrv_Frame_t    s_ring[RING_LEN];
static volatile uint8_t  s_head = 0U;          /* written by the ISR */
static volatile uint8_t  s_tail = 0U;          /* written by the main loop */
static volatile uint32_t s_ringOverflow = 0U;

static IsoTp_Link_t  s_link;
static uint8_t       s_rxBuf[TESTER_BUFFER_SIZE];
static uint8_t       s_txBuf[TESTER_BUFFER_SIZE];
static uint8_t       s_resp[TESTER_BUFFER_SIZE];
static uint16_t      s_respLen = 0U;
static bool          s_gotResp = false;

static const Step_t *s_seq = NULL;
static uint8_t       s_seqLen = 0U;
static uint8_t       s_step = 0U;
static uint8_t       s_passed = 0U;
static State_t       s_state = ST_IDLE;
static uint32_t      s_timer = 0U;

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
static bool SendFrame(void *ctx, uint16_t canId, const uint8_t *data, uint8_t dlc)
{
    CanDrv_Frame_t frame;
    (void)ctx;

    frame.id  = canId;
    frame.dlc = dlc;
    (void)memcpy(frame.data, data, dlc);
    return (CanDrv_Write(&frame) == CANDRV_OK);
}

static void OnResponse(void *ctx, const uint8_t *data, uint16_t length, IsoTp_Result_t result)
{
    (void)ctx;
    if ((result == ISOTP_OK) && (length <= sizeof(s_resp)))
    {
        (void)memcpy(s_resp, data, length);
        s_respLen = length;
        s_gotResp = true;
    }
    else
    {
        (void)printf("[TESTER] ISO-TP receive error %u\r\n", (unsigned)result);
    }
}

static const char *NrcName(uint8_t nrc)
{
    switch (nrc)
    {
        case 0x11U: return "serviceNotSupported";
        case 0x12U: return "subFunctionNotSupported";
        case 0x13U: return "incorrectMessageLength";
        case 0x14U: return "responseTooLong";
        case 0x31U: return "requestOutOfRange";
        case 0x7EU: return "subFunctionNotSupportedInActiveSession";
        case 0x7FU: return "serviceNotSupportedInActiveSession";
        default:    return "?";
    }
}

#define PRINTHEX_MAX_BYTES  (20U)

static void PrintHex(const uint8_t *data, uint16_t len)
{
    const bool truncated = (len > PRINTHEX_MAX_BYTES);
    uint16_t   n = truncated ? (uint16_t)PRINTHEX_MAX_BYTES : len;

    (void)printf("        ");
    for (uint16_t i = 0U; i < n; i++)
    {
        (void)printf("%02X ", data[i]);
    }
    (void)printf("%s\r\n", truncated ? "..." : "");
}

/* SAE J2012 display form: 0xC10087 -> U0100-87 */
static void PrintDtc(const uint8_t *rec)
{
    static const char letter[4] = { 'P', 'C', 'B', 'U' };
    uint8_t status = rec[3];

    (void)printf("        %c%u%X%02X-%02X  status 0x%02X%s%s%s\r\n",
                 letter[(rec[0] >> 6U) & 0x03U], (unsigned)((rec[0] >> 4U) & 0x03U),
                 (unsigned)(rec[0] & 0x0FU), (unsigned)rec[1], (unsigned)rec[2], (unsigned)status,
                 ((status & 0x01U) != 0U) ? " testFailed" : "",
                 ((status & 0x04U) != 0U) ? " pending" : "",
                 ((status & 0x08U) != 0U) ? " confirmed" : "");
}

static void Decode(void)
{
    if ((s_respLen >= 3U) && (s_resp[0] == 0x7FU))
    {
        (void)printf("        NRC 0x%02X %s\r\n", (unsigned)s_resp[2], NrcName(s_resp[2]));
    }
    else if ((s_respLen >= 3U) && (s_resp[0] == 0x59U) && (s_resp[1] == 0x02U))
    {
        uint16_t count = (uint16_t)((s_respLen - 3U) / 4U);
        (void)printf("        %u DTC(s)\r\n", (unsigned)count);
        for (uint16_t i = 0U; i < count; i++)
        {
            PrintDtc(&s_resp[3U + (4U * i)]);
        }
    }
    else if ((s_respLen >= 5U) && (s_resp[0] == 0x62U) && (s_resp[1] == 0x01U) && (s_resp[2] == 0x00U))
    {
        uint16_t ecu = (uint16_t)(((uint16_t)s_resp[3] << 8U) | s_resp[4]);
        uint16_t own = SensorApp_GetSpeedX10();
        (void)printf("        Control ECU speed %u.%u km/h, Sensor ECU sends %u.%u km/h\r\n",
                     (unsigned)ecu / 10U, (unsigned)ecu % 10U, (unsigned)own / 10U, (unsigned)own % 10U);
    }
    else if ((s_respLen > 3U) && (s_resp[0] == 0x62U) && (s_resp[1] == 0xF1U) && (s_resp[2] == 0x95U))
    {
        char     text[24];
        uint16_t n = (uint16_t)(s_respLen - 3U);

        n = (n > 10U) ? 10U : n;
        (void)memcpy(text, &s_resp[3], n);
        text[n] = '\0';
        (void)printf("        version \"%s\"\r\n", text);
    }
    else
    {
        /* nothing to decode */
    }
}

static void Finish(bool pass)
{
    const Step_t *st = &s_seq[s_step];

    (void)printf("[TESTER] %2u/%u %-38s %s\r\n", (unsigned)s_step + 1U, (unsigned)s_seqLen,
                 st->name, pass ? "PASS" : "FAIL");
    if (s_gotResp)
    {
        PrintHex(s_resp, s_respLen);
        Decode();
    }
    else if (st->expect != NULL)
    {
        (void)printf("        no response\r\n");
    }
    else
    {
        /* silence expected */
    }

    if (pass)
    {
        s_passed++;
    }
    s_step++;
    if (s_step < s_seqLen)
    {
        s_state = ST_DELAY;
        s_timer = TimeDrv_GetMs();
    }
    else
    {
        (void)printf("[TESTER] done: %u/%u passed\r\n", (unsigned)s_passed, (unsigned)s_seqLen);
        s_state = ST_IDLE;
    }
}

static void Start(const Step_t *seq, uint8_t len)
{
    if (s_state != ST_IDLE)
    {
        (void)printf("[TESTER] busy\r\n");
        return;
    }
    s_seq    = seq;
    s_seqLen = len;
    s_step   = 0U;
    s_passed = 0U;
    s_state  = ST_DELAY;
    s_timer  = TimeDrv_GetMs();
}

static void SendStep(void)
{
    const Step_t *st = &s_seq[s_step];

    s_gotResp = false;
    s_respLen = 0U;

    if (st->functional)
    {
        uint8_t sf[ISOTP_CAN_DL];
        (void)memset(sf, (int)ISOTP_PADDING_BYTE, sizeof(sf));
        sf[0] = st->reqLen;                       /* single frame PCI */
        (void)memcpy(&sf[1], st->req, st->reqLen);
        (void)SendFrame(NULL, FUNCTIONAL_ID, sf, ISOTP_CAN_DL);
    }
    else
    {
        (void)IsoTp_Transmit(&s_link, st->req, st->reqLen);
    }
    s_timer = TimeDrv_GetMs();
    s_state = ST_WAIT;
}

static void RunSequence(void)
{
    uint32_t now = TimeDrv_GetMs();

    switch (s_state)
    {
        case ST_DELAY:
            if ((now - s_timer) >= s_seq[s_step].delayMs)
            {
                s_state = ST_SEND;
            }
            break;

        case ST_SEND:
            if (!IsoTp_IsTxBusy(&s_link))
            {
                SendStep();
            }
            break;

        case ST_WAIT:
        {
            const Step_t *st = &s_seq[s_step];

            if (st->expect == NULL)
            {
                /* Pass if the ECU stays silent (functional NRC suppression). */
                if (s_gotResp)
                {
                    Finish(false);
                }
                else if ((now - s_timer) >= NO_RESPONSE_WAIT_MS)
                {
                    Finish(true);
                }
                else
                {
                    /* waiting */
                }
            }
            else if (s_gotResp)
            {
                Finish((s_respLen >= st->expectLen) &&
                       (memcmp(s_resp, st->expect, st->expectLen) == 0));
            }
            else if ((now - s_timer) >= RESPONSE_TIMEOUT_MS)
            {
                Finish(false);
            }
            else
            {
                /* waiting */
            }
            break;
        }

        case ST_IDLE:
        default:
            break;
    }
}

static void PrintHelp(void)
{
    (void)printf("[TESTER] UDS tester -> Control ECU (0x7E0/0x7E8). Keys:\r\n"
                 "         t test  d DTCs  c clear  v version+speed  f functional  r hard reset  ? help\r\n");
}

static void HandleKey(uint8_t key)
{
    switch (key)
    {
        case (uint8_t)'t': Start(k_seqTest,  LEN(k_seqTest));  break;
        case (uint8_t)'d': Start(k_seqDtc,   LEN(k_seqDtc));   break;
        case (uint8_t)'c': Start(k_seqClear, LEN(k_seqClear)); break;
        case (uint8_t)'v': Start(k_seqVer,   LEN(k_seqVer));   break;
        case (uint8_t)'f': Start(k_seqFunc,  LEN(k_seqFunc));  break;
        case (uint8_t)'r': Start(k_seqReset, LEN(k_seqReset)); break;
        case (uint8_t)'?': PrintHelp();                        break;
        default:                                               break;
    }
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
void TesterApp_Init(void)
{
    IsoTp_Config_t cfg;

    (void)memset(&cfg, 0, sizeof(cfg));
    cfg.txId           = CANID_UDS_REQ_CONTROL;
    cfg.rxId           = CANID_UDS_RESP_CONTROL;
    cfg.rxBuffer       = s_rxBuf;
    cfg.rxBufferSize   = sizeof(s_rxBuf);
    cfg.txBuffer       = s_txBuf;
    cfg.txBufferSize   = sizeof(s_txBuf);
    cfg.blockSize      = 0U;
    cfg.stMin          = 0U;
    cfg.sendFrame      = SendFrame;
    cfg.getTimeMs      = TimeDrv_GetMs;
    cfg.rxIndication   = OnResponse;
    cfg.txConfirmation = NULL;
    IsoTp_Init(&s_link, &cfg);
    PrintHelp();
}

void TesterApp_OnCanFrameIsr(const CanDrv_Frame_t *frame)
{
    uint8_t next;

    if (frame->id != CANID_UDS_RESP_CONTROL)
    {
        return;
    }
    next = (uint8_t)((s_head + 1U) % RING_LEN);
    if (next == s_tail)
    {
        s_ringOverflow++;
        return;
    }
    s_ring[s_head] = *frame;
    s_head = next;
}

void TesterApp_Task(void)
{
    uint8_t key;

    /* Drain the ISR ring: all ISO-TP processing happens in this context. */
    while (s_tail != s_head)
    {
        IsoTp_RxFrame(&s_link, s_ring[s_tail].data, s_ring[s_tail].dlc);
        s_tail = (uint8_t)((s_tail + 1U) % RING_LEN);
    }

    if (UartDrv_ReadChar(&key))
    {
        HandleKey(key);
    }

    IsoTp_MainFunction(&s_link);
    RunSequence();
}
