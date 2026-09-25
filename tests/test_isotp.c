/**
 * @file    test_isotp.c
 * @brief   Host unit tests for common/isotp.
 *
 * The CAN driver and the millisecond clock are faked, so every frame the
 * link sends is captured and time only moves when a test says so.
 */
#include <stdbool.h>
#include <stdint.h>

#include "isotp.h"
#include "test_framework.h"

int g_testFailures = 0;
int g_testChecks = 0;

#define ECU_TX_ID       (0x7E8U)
#define ECU_RX_ID       (0x7E0U)
#define MAX_FRAMES      (1024)

typedef struct
{
    uint16_t id;
    uint8_t  data[ISOTP_CAN_DL];
} Frame_t;

/* ---------------------------------------------------------------------------
 * Fakes
 * ------------------------------------------------------------------------- */
static Frame_t  g_sent[MAX_FRAMES];
static int      g_sentCount;
static bool     g_driverBusy;
static uint32_t g_now;

static uint8_t        g_rxData[ISOTP_MAX_MESSAGE_LEN];
static uint16_t       g_rxLen;
static IsoTp_Result_t g_rxResult;
static int            g_rxCalls;
static IsoTp_Result_t g_txResult;
static int            g_txCalls;

static uint8_t      g_rxBuf[ISOTP_MAX_MESSAGE_LEN];
static uint8_t      g_txBuf[ISOTP_MAX_MESSAGE_LEN];
static IsoTp_Link_t g_link;

static bool FakeSend(void *ctx, uint16_t canId, const uint8_t *data, uint8_t dlc)
{
    (void)ctx;
    if (g_driverBusy || (g_sentCount >= MAX_FRAMES) || (dlc != ISOTP_CAN_DL))
    {
        return false;
    }
    g_sent[g_sentCount].id = canId;
    memcpy(g_sent[g_sentCount].data, data, ISOTP_CAN_DL);
    g_sentCount++;
    return true;
}

static uint32_t FakeTime(void)
{
    return g_now;
}

static void OnRx(void *ctx, const uint8_t *data, uint16_t length, IsoTp_Result_t result)
{
    (void)ctx;
    memcpy(g_rxData, data, length);
    g_rxLen    = length;
    g_rxResult = result;
    g_rxCalls++;
}

static void OnTx(void *ctx, IsoTp_Result_t result)
{
    (void)ctx;
    g_txResult = result;
    g_txCalls++;
}

static void Setup(uint8_t blockSize, uint8_t stMin, uint16_t rxBufferSize)
{
    IsoTp_Config_t cfg;

    memset(&cfg, 0, sizeof(cfg));
    cfg.txId           = ECU_TX_ID;
    cfg.rxId           = ECU_RX_ID;
    cfg.rxBuffer       = g_rxBuf;
    cfg.rxBufferSize   = rxBufferSize;
    cfg.txBuffer       = g_txBuf;
    cfg.txBufferSize   = sizeof(g_txBuf);
    cfg.blockSize      = blockSize;
    cfg.stMin          = stMin;
    cfg.sendFrame      = FakeSend;
    cfg.getTimeMs      = FakeTime;
    cfg.rxIndication   = OnRx;
    cfg.txConfirmation = OnTx;

    g_sentCount  = 0;
    g_driverBusy = false;
    g_now        = 1000U;
    g_rxCalls    = 0;
    g_txCalls    = 0;
    g_rxLen      = 0U;
    memset(g_rxData, 0, sizeof(g_rxData));

    IsoTp_Init(&g_link, &cfg);
}

static void Feed(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3,
                 uint8_t b4, uint8_t b5, uint8_t b6, uint8_t b7)
{
    const uint8_t f[ISOTP_CAN_DL] = {b0, b1, b2, b3, b4, b5, b6, b7};
    IsoTp_RxFrame(&g_link, f, ISOTP_CAN_DL);
}

static void FillPattern(uint8_t *buf, uint16_t len)
{
    for (uint16_t i = 0U; i < len; i++)
    {
        buf[i] = (uint8_t)(i * 7U + 3U);
    }
}

/* Feed an FF + CFs carrying msg[0..len-1], as a tester would send it. */
static void FeedMultiFrame(const uint8_t *msg, uint16_t len, uint16_t cfCount)
{
    uint8_t  f[ISOTP_CAN_DL];
    uint16_t off = 6U;
    uint8_t  seq = 1U;

    f[0] = (uint8_t)(0x10U | (len >> 8U));
    f[1] = (uint8_t)(len & 0xFFU);
    memcpy(&f[2], msg, 6U);
    IsoTp_RxFrame(&g_link, f, ISOTP_CAN_DL);

    for (uint16_t i = 0U; (i < cfCount) && (off < len); i++)
    {
        uint16_t left = (uint16_t)(len - off);
        uint16_t n = (left > 7U) ? 7U : left;
        memset(f, 0xCC, sizeof(f));
        f[0] = (uint8_t)(0x20U | seq);
        memcpy(&f[1], &msg[off], n);
        IsoTp_RxFrame(&g_link, f, ISOTP_CAN_DL);
        off = (uint16_t)(off + n);
        seq = (uint8_t)((seq + 1U) & 0x0FU);
    }
}

/* ---------------------------------------------------------------------------
 * Sender tests
 * ------------------------------------------------------------------------- */
static void test_tx_single_frame(void)
{
    const uint8_t msg[] = {0x22, 0xF1, 0x90};
    const uint8_t expected[8] = {0x03, 0x22, 0xF1, 0x90, 0xCC, 0xCC, 0xCC, 0xCC};

    Setup(0U, 0U, sizeof(g_rxBuf));
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_link, msg, sizeof(msg)));
    CHECK_EQ(1, g_sentCount);
    CHECK_EQ(ECU_TX_ID, g_sent[0].id);
    CHECK_MEM(expected, g_sent[0].data, 8);
    CHECK_EQ(1, g_txCalls);
    CHECK_EQ(ISOTP_OK, g_txResult);
    CHECK(!IsoTp_IsTxBusy(&g_link));
}

static void test_tx_single_frame_max_7_bytes(void)
{
    const uint8_t msg[7] = {1, 2, 3, 4, 5, 6, 7};

    Setup(0U, 0U, sizeof(g_rxBuf));
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_link, msg, 7U));
    CHECK_EQ(1, g_sentCount);
    CHECK_EQ(0x07, g_sent[0].data[0]);
    CHECK_MEM(msg, &g_sent[0].data[1], 7);
}

static void test_tx_invalid_params(void)
{
    uint8_t msg[1] = {0};

    Setup(0U, 0U, sizeof(g_rxBuf));
    CHECK_EQ(ISOTP_ERR_PARAM, IsoTp_Transmit(&g_link, msg, 0U));
    CHECK_EQ(ISOTP_ERR_PARAM, IsoTp_Transmit(&g_link, NULL, 3U));
    CHECK_EQ(ISOTP_ERR_PARAM, IsoTp_Transmit(&g_link, g_txBuf, 4096U));
    CHECK_EQ(0, g_sentCount);
}

static void test_tx_multi_frame_bs0(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_link, msg, sizeof(msg)));

    /* FF: 1L LL + 6 bytes */
    CHECK_EQ(1, g_sentCount);
    CHECK_EQ(0x10, g_sent[0].data[0]);
    CHECK_EQ(20, g_sent[0].data[1]);
    CHECK_MEM(msg, &g_sent[0].data[2], 6);
    CHECK(IsoTp_IsTxBusy(&g_link));
    CHECK_EQ(0, g_txCalls);

    /* FC: CTS, BS=0, STmin=0 -> all CFs at once */
    Feed(0x30, 0x00, 0x00, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC);
    CHECK_EQ(3, g_sentCount);
    CHECK_EQ(0x21, g_sent[1].data[0]);
    CHECK_MEM(&msg[6], &g_sent[1].data[1], 7);
    CHECK_EQ(0x22, g_sent[2].data[0]);
    CHECK_MEM(&msg[13], &g_sent[2].data[1], 7);
    CHECK_EQ(1, g_txCalls);
    CHECK_EQ(ISOTP_OK, g_txResult);
}

static void test_tx_last_cf_is_padded(void)
{
    uint8_t msg[15];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));   /* FF 6 + CF 7 + CF 2 */
    Feed(0x30, 0x00, 0x00, 0, 0, 0, 0, 0);

    CHECK_EQ(3, g_sentCount);
    CHECK_EQ(0x22, g_sent[2].data[0]);
    CHECK_MEM(&msg[13], &g_sent[2].data[1], 2);
    CHECK_EQ(0xCC, g_sent[2].data[3]);
    CHECK_EQ(0xCC, g_sent[2].data[7]);
}

static void test_tx_block_size(void)
{
    uint8_t msg[34];   /* FF 6 + 4 CF x 7 */

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    Feed(0x30, 0x02, 0x00, 0, 0, 0, 0, 0);   /* BS = 2 */
    CHECK_EQ(3, g_sentCount);                 /* FF + 2 CF, then wait */
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(3, g_sentCount);
    CHECK_EQ(0, g_txCalls);

    Feed(0x30, 0x02, 0x00, 0, 0, 0, 0, 0);   /* next block */
    CHECK_EQ(5, g_sentCount);
    CHECK_EQ(0x23, g_sent[3].data[0]);
    CHECK_EQ(0x24, g_sent[4].data[0]);
    CHECK_EQ(ISOTP_OK, g_txResult);
}

static void test_tx_stmin_spacing(void)
{
    uint8_t msg[27];   /* FF 6 + 3 CF */

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    Feed(0x30, 0x00, 0x05, 0, 0, 0, 0, 0);   /* STmin = 5 ms */
    CHECK_EQ(2, g_sentCount);                 /* first CF immediately */

    g_now += 5U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(2, g_sentCount);                 /* 5 ticks may be < 5 ms real time */

    g_now += 1U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(3, g_sentCount);

    g_now += 6U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(4, g_sentCount);
    CHECK_EQ(ISOTP_OK, g_txResult);
}

static void test_tx_stmin_microseconds_rounds_to_1ms(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    Feed(0x30, 0x00, 0xF5, 0, 0, 0, 0, 0);   /* 500 us */
    CHECK_EQ(2, g_sentCount);
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(2, g_sentCount);
    g_now += 2U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(3, g_sentCount);
}

static void test_tx_timeout_n_bs(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    g_now += 999U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(0, g_txCalls);

    g_now += 1U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(1, g_txCalls);
    CHECK_EQ(ISOTP_ERR_TIMEOUT_BS, g_txResult);
    CHECK(!IsoTp_IsTxBusy(&g_link));
}

static void test_tx_fc_wait_restarts_timer(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    g_now += 900U;
    Feed(0x31, 0x00, 0x00, 0, 0, 0, 0, 0);   /* WAIT */
    g_now += 900U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(0, g_txCalls);                   /* timer was restarted */

    Feed(0x30, 0x00, 0x00, 0, 0, 0, 0, 0);
    CHECK_EQ(ISOTP_OK, g_txResult);
    CHECK_EQ(3, g_sentCount);
}

static void test_tx_too_many_fc_wait(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    for (int i = 0; i <= (int)ISOTP_MAX_WFT; i++)
    {
        Feed(0x31, 0x00, 0x00, 0, 0, 0, 0, 0);
    }
    CHECK_EQ(1, g_txCalls);
    CHECK_EQ(ISOTP_ERR_WFT_OVRN, g_txResult);
}

static void test_tx_fc_overflow_aborts(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    IsoTp_Transmit(&g_link, msg, sizeof(msg));

    Feed(0x32, 0x00, 0x00, 0, 0, 0, 0, 0);
    CHECK_EQ(ISOTP_ERR_OVERFLOW, g_txResult);
    CHECK_EQ(1, g_sentCount);
}

static void test_tx_busy_rejects_second_message(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_link, msg, sizeof(msg)));
    CHECK_EQ(ISOTP_ERR_BUSY, IsoTp_Transmit(&g_link, msg, 3U));
}

static void test_tx_unexpected_fc_ignored(void)
{
    Setup(0U, 0U, sizeof(g_rxBuf));
    Feed(0x30, 0x00, 0x00, 0, 0, 0, 0, 0);
    CHECK_EQ(0, g_sentCount);
    CHECK_EQ(0, g_txCalls);
}

static void test_tx_driver_busy_is_retried(void)
{
    const uint8_t msg[] = {0x3E, 0x00};

    Setup(0U, 0U, sizeof(g_rxBuf));
    g_driverBusy = true;
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_link, msg, sizeof(msg)));
    CHECK_EQ(0, g_sentCount);
    CHECK_EQ(0, g_txCalls);

    g_driverBusy = false;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(1, g_sentCount);
    CHECK_EQ(ISOTP_OK, g_txResult);
}

/* ---------------------------------------------------------------------------
 * Receiver tests
 * ------------------------------------------------------------------------- */
static void test_rx_single_frame(void)
{
    const uint8_t expected[] = {0x10, 0x03};

    Setup(0U, 0U, sizeof(g_rxBuf));
    Feed(0x02, 0x10, 0x03, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC);
    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_OK, g_rxResult);
    CHECK_EQ(2, g_rxLen);
    CHECK_MEM(expected, g_rxData, 2);
    CHECK_EQ(0, g_sentCount);   /* SF needs no flow control */
}

static void test_rx_single_frame_short_dlc(void)
{
    const uint8_t f[3] = {0x02, 0x3E, 0x00};

    Setup(0U, 0U, sizeof(g_rxBuf));
    IsoTp_RxFrame(&g_link, f, 3U);   /* unpadded frame, still valid */
    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(2, g_rxLen);
}

static void test_rx_single_frame_invalid_length_ignored(void)
{
    const uint8_t f[3] = {0x05, 0x01, 0x02};   /* claims 5 bytes, has 2 */

    Setup(0U, 0U, sizeof(g_rxBuf));
    Feed(0x00, 0, 0, 0, 0, 0, 0, 0);          /* length 0 */
    Feed(0x08, 1, 2, 3, 4, 5, 6, 7);          /* length 8 is not an SF */
    IsoTp_RxFrame(&g_link, f, 3U);
    CHECK_EQ(0, g_rxCalls);
}

static void test_rx_multi_frame(void)
{
    uint8_t msg[20];
    const uint8_t fc[8] = {0x30, 0x00, 0x00, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC};

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 0U);     /* FF only */

    CHECK_EQ(1, g_sentCount);                  /* our FC */
    CHECK_EQ(ECU_TX_ID, g_sent[0].id);
    CHECK_MEM(fc, g_sent[0].data, 8);
    CHECK_EQ(0, g_rxCalls);

    Setup(0U, 0U, sizeof(g_rxBuf));
    FeedMultiFrame(msg, sizeof(msg), 99U);
    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_OK, g_rxResult);
    CHECK_EQ(20, g_rxLen);
    CHECK_MEM(msg, g_rxData, 20);
}

static void test_rx_block_size_sends_fc_per_block(void)
{
    uint8_t msg[34];   /* FF + 4 CF */

    Setup(2U, 0x0AU, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 99U);

    CHECK_EQ(2, g_sentCount);                  /* after FF, after CF #2 */
    CHECK_EQ(0x30, g_sent[0].data[0]);
    CHECK_EQ(0x02, g_sent[0].data[1]);
    CHECK_EQ(0x0A, g_sent[0].data[2]);
    CHECK_EQ(0x30, g_sent[1].data[0]);
    CHECK_EQ(1, g_rxCalls);
    CHECK_MEM(msg, g_rxData, sizeof(msg));
}

static void test_rx_wrong_sequence_number(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 0U);
    Feed(0x22, 1, 2, 3, 4, 5, 6, 7);          /* expected 0x21 */

    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_ERR_WRONG_SN, g_rxResult);

    Feed(0x21, 1, 2, 3, 4, 5, 6, 7);          /* late CF is now ignored */
    CHECK_EQ(1, g_rxCalls);
}

static void test_rx_timeout_n_cr(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 1U);     /* FF + first CF, then silence */

    g_now += 999U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(0, g_rxCalls);

    g_now += 1U;
    IsoTp_MainFunction(&g_link);
    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_ERR_TIMEOUT_CR, g_rxResult);
}

static void test_rx_message_too_long_sends_overflow(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, 16U);                        /* buffer smaller than message */
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 99U);

    CHECK_EQ(1, g_sentCount);
    CHECK_EQ(0x32, g_sent[0].data[0]);         /* FC.OVFLW */
    CHECK_EQ(0, g_rxCalls);
}

static void test_rx_new_sf_interrupts_multi_frame(void)
{
    uint8_t msg[20];

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 1U);
    Feed(0x02, 0x3E, 0x00, 0, 0, 0, 0, 0);

    CHECK_EQ(2, g_rxCalls);                    /* abort old, deliver new */
    CHECK_EQ(ISOTP_OK, g_rxResult);
    CHECK_EQ(2, g_rxLen);
}

static void test_rx_sequence_number_wraps(void)
{
    uint8_t msg[200];   /* FF 6 + 28 CF -> SN 1..15, 0..12 */

    Setup(0U, 0U, sizeof(g_rxBuf));
    FillPattern(msg, sizeof(msg));
    FeedMultiFrame(msg, sizeof(msg), 99U);

    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_OK, g_rxResult);
    CHECK_EQ(200, g_rxLen);
    CHECK_MEM(msg, g_rxData, sizeof(msg));
}

/* ---------------------------------------------------------------------------
 * End-to-end: two links on a simulated bus
 * ------------------------------------------------------------------------- */
static Frame_t       g_bus[MAX_FRAMES];
static int           g_busHead;
static int           g_busTail;
static IsoTp_Link_t  g_tester;
static uint8_t       g_testerTx[ISOTP_MAX_MESSAGE_LEN];
static uint8_t       g_testerRx[16];

static bool BusSend(void *ctx, uint16_t canId, const uint8_t *data, uint8_t dlc)
{
    (void)ctx;
    (void)dlc;
    if (g_busTail >= MAX_FRAMES)
    {
        return false;
    }
    g_bus[g_busTail].id = canId;
    memcpy(g_bus[g_busTail].data, data, ISOTP_CAN_DL);
    g_busTail++;
    return true;
}

static void test_end_to_end_4095_bytes(void)
{
    static uint8_t msg[ISOTP_MAX_MESSAGE_LEN];
    IsoTp_Config_t cfg;
    int frames = 0;

    /* ECU side: receives on 0x7E0, BS = 8 */
    Setup(8U, 0U, sizeof(g_rxBuf));
    g_link.cfg.sendFrame = BusSend;

    /* Tester side: sends on 0x7E0, listens on 0x7E8 */
    memset(&cfg, 0, sizeof(cfg));
    cfg.txId           = ECU_RX_ID;
    cfg.rxId           = ECU_TX_ID;
    cfg.rxBuffer       = g_testerRx;
    cfg.rxBufferSize   = sizeof(g_testerRx);
    cfg.txBuffer       = g_testerTx;
    cfg.txBufferSize   = sizeof(g_testerTx);
    cfg.sendFrame      = BusSend;
    cfg.getTimeMs      = FakeTime;
    cfg.txConfirmation = OnTx;
    IsoTp_Init(&g_tester, &cfg);

    g_busHead = 0;
    g_busTail = 0;
    FillPattern(msg, sizeof(msg));
    CHECK_EQ(ISOTP_OK, IsoTp_Transmit(&g_tester, msg, sizeof(msg)));

    /* Deliver frames in order until the bus is quiet. */
    while (g_busHead < g_busTail)
    {
        const Frame_t *f = &g_bus[g_busHead++];
        frames++;
        if (f->id == ECU_RX_ID)
        {
            IsoTp_RxFrame(&g_link, f->data, ISOTP_CAN_DL);
        }
        else
        {
            IsoTp_RxFrame(&g_tester, f->data, ISOTP_CAN_DL);
        }
    }

    CHECK_EQ(ISOTP_OK, g_txResult);
    CHECK_EQ(1, g_rxCalls);
    CHECK_EQ(ISOTP_OK, g_rxResult);
    CHECK_EQ(4095, g_rxLen);
    CHECK_MEM(msg, g_rxData, sizeof(msg));
    /* 4095 = 6 (FF) + 585 CF (584 x 7 + 1).
     * FC: 1 after the FF + 1 after every 8th CF except the last -> 1 + 73 */
    CHECK_EQ(1 + 585 + 74, frames);
}

int main(void)
{
    printf("ISO-TP unit tests\n");

    RUN_TEST(test_tx_single_frame);
    RUN_TEST(test_tx_single_frame_max_7_bytes);
    RUN_TEST(test_tx_invalid_params);
    RUN_TEST(test_tx_multi_frame_bs0);
    RUN_TEST(test_tx_last_cf_is_padded);
    RUN_TEST(test_tx_block_size);
    RUN_TEST(test_tx_stmin_spacing);
    RUN_TEST(test_tx_stmin_microseconds_rounds_to_1ms);
    RUN_TEST(test_tx_timeout_n_bs);
    RUN_TEST(test_tx_fc_wait_restarts_timer);
    RUN_TEST(test_tx_too_many_fc_wait);
    RUN_TEST(test_tx_fc_overflow_aborts);
    RUN_TEST(test_tx_busy_rejects_second_message);
    RUN_TEST(test_tx_unexpected_fc_ignored);
    RUN_TEST(test_tx_driver_busy_is_retried);

    RUN_TEST(test_rx_single_frame);
    RUN_TEST(test_rx_single_frame_short_dlc);
    RUN_TEST(test_rx_single_frame_invalid_length_ignored);
    RUN_TEST(test_rx_multi_frame);
    RUN_TEST(test_rx_block_size_sends_fc_per_block);
    RUN_TEST(test_rx_wrong_sequence_number);
    RUN_TEST(test_rx_timeout_n_cr);
    RUN_TEST(test_rx_message_too_long_sends_overflow);
    RUN_TEST(test_rx_new_sf_interrupts_multi_frame);
    RUN_TEST(test_rx_sequence_number_wraps);

    RUN_TEST(test_end_to_end_4095_bytes);

    printf("\n%d checks, %d failures\n", g_testChecks, g_testFailures);
    return (g_testFailures == 0) ? 0 : 1;
}
