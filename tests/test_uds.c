/**
 * @file    test_uds.c
 * @brief   Host unit tests for common/uds (with the real DTC manager).
 */
#include <stdbool.h>
#include <stdint.h>

#include "dtc_manager.h"
#include "test_framework.h"
#include "uds_server.h"

int g_testFailures = 0;
int g_testChecks = 0;

static uint32_t g_now;
static int      g_resetCalls;
static uint8_t  g_resetType;
static uint8_t  g_resp[64];
static uint16_t g_respLen;

static uint32_t FakeTime(void) { return g_now; }
static void FakeReset(uint8_t type) { g_resetCalls++; g_resetType = type; }

static void ReadVersion(uint8_t *out) { memcpy(out, "CTRL-1.0", 8); }
static void ReadSpeed(uint8_t *out)   { out[0] = 0x04; out[1] = 0xD2; }   /* 123.4 km/h */

static const Uds_Did_t k_dids[] =
{
    { 0xF195U, 8U, ReadVersion },
    { 0x0100U, 2U, ReadSpeed },
};

static const DtcMgr_Config_t k_dtcs[] =
{
    { 0xC10087UL, 1U },
    { 0x050100UL, 1U },
};

static void Setup(void)
{
    Uds_Config_t cfg = { k_dids, 2U, FakeTime, FakeReset };
    g_now = 1000U;
    g_resetCalls = 0;
    g_resetType = 0U;
    DtcMgr_Init(k_dtcs, 2U, NULL, NULL);
    Uds_Init(&cfg);
}

/* Send a request given as bytes; stores the response in g_resp/g_respLen. */
#define REQ(functional, ...)                                                     \
    do {                                                                         \
        const uint8_t r_[] = { __VA_ARGS__ };                                    \
        g_respLen = Uds_ProcessRequest(r_, (uint16_t)sizeof(r_), (functional),   \
                                       g_resp, (uint16_t)sizeof(g_resp));        \
    } while (0)

#define EXPECT(...)                                                              \
    do {                                                                         \
        const uint8_t x_[] = { __VA_ARGS__ };                                    \
        CHECK_EQ(sizeof(x_), g_respLen);                                         \
        CHECK_MEM(x_, g_resp, sizeof(x_));                                       \
    } while (0)

static void test_unknown_service(void)
{
    Setup();
    REQ(false, 0x85, 0x01);
    EXPECT(0x7F, 0x85, 0x11);
    REQ(true, 0x85, 0x01);                       /* functional: NRC 0x11 suppressed */
    CHECK_EQ(0, g_respLen);
}

static void test_session_control(void)
{
    Setup();
    REQ(false, 0x10, 0x03);
    EXPECT(0x50, 0x03, 0x00, 0x32, 0x01, 0xF4);  /* P2 = 50 ms, P2* = 5000 ms */
    CHECK_EQ(UDS_SESSION_EXTENDED, Uds_GetSession());
    REQ(false, 0x10, 0x02);                      /* programming not supported */
    EXPECT(0x7F, 0x10, 0x12);
    REQ(false, 0x10);
    EXPECT(0x7F, 0x10, 0x13);
    REQ(false, 0x10, 0x81);                      /* default, positive suppressed */
    CHECK_EQ(0, g_respLen);
    CHECK_EQ(UDS_SESSION_DEFAULT, Uds_GetSession());
}

static void test_s3_timeout_returns_to_default(void)
{
    Setup();
    REQ(false, 0x10, 0x03);
    g_now += 4000U;
    REQ(false, 0x3E, 0x80);                      /* tester present keeps it alive */
    CHECK_EQ(0, g_respLen);
    g_now += 4999U;
    Uds_MainFunction();
    CHECK_EQ(UDS_SESSION_EXTENDED, Uds_GetSession());
    g_now += 1U;
    Uds_MainFunction();
    CHECK_EQ(UDS_SESSION_DEFAULT, Uds_GetSession());
}

static void test_tester_present(void)
{
    Setup();
    REQ(false, 0x3E, 0x00);
    EXPECT(0x7E, 0x00);
    REQ(false, 0x3E, 0x01);
    EXPECT(0x7F, 0x3E, 0x12);
    REQ(false, 0x3E, 0x00, 0x00);
    EXPECT(0x7F, 0x3E, 0x13);
}

static void test_read_did(void)
{
    Setup();
    REQ(false, 0x22, 0xF1, 0x95);
    EXPECT(0x62, 0xF1, 0x95, 'C', 'T', 'R', 'L', '-', '1', '.', '0');
    REQ(false, 0x22, 0x01, 0x00, 0xF1, 0x95);    /* two DIDs in one request */
    EXPECT(0x62, 0x01, 0x00, 0x04, 0xD2, 0xF1, 0x95, 'C', 'T', 'R', 'L', '-', '1', '.', '0');
    REQ(false, 0x22, 0x12, 0x34);                /* unknown DID */
    EXPECT(0x7F, 0x22, 0x31);
    REQ(false, 0x22, 0x12, 0x34, 0x01, 0x00);    /* unknown one is skipped */
    EXPECT(0x62, 0x01, 0x00, 0x04, 0xD2);
    REQ(false, 0x22, 0xF1);                      /* odd length */
    EXPECT(0x7F, 0x22, 0x13);
}

static void test_read_did_response_too_long(void)
{
    uint8_t  small[6];
    const uint8_t r[] = { 0x22, 0xF1, 0x95 };
    uint16_t n;

    Setup();
    n = Uds_ProcessRequest(r, 3U, false, small, sizeof(small));
    CHECK_EQ(3, n);
    CHECK_EQ(0x14, small[2]);
}

static void test_read_dtc_count_and_list(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);               /* 0xC10087 confirmed */
    DtcMgr_ReportResult(1U, false);

    REQ(false, 0x19, 0x01, 0x08);                /* number of confirmed DTCs */
    EXPECT(0x59, 0x01, 0x7F, 0x01, 0x00, 0x01);

    REQ(false, 0x19, 0x02, 0x08);
    EXPECT(0x59, 0x02, 0x7F, 0xC1, 0x00, 0x87, 0x2F);

    REQ(false, 0x19, 0x02, 0x00);                /* empty mask: no records */
    EXPECT(0x59, 0x02, 0x7F);

    REQ(false, 0x19, 0x04, 0x08);
    EXPECT(0x7F, 0x19, 0x12);
    REQ(false, 0x19, 0x02);
    EXPECT(0x7F, 0x19, 0x13);
}

static void test_clear_dtc(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);
    REQ(false, 0x14, 0x12, 0x34, 0x56);          /* single group not supported */
    EXPECT(0x7F, 0x14, 0x31);
    REQ(false, 0x14, 0xFF, 0xFF);
    EXPECT(0x7F, 0x14, 0x13);
    REQ(false, 0x14, 0xFF, 0xFF, 0xFF);
    EXPECT(0x54);
    CHECK_EQ(0, DtcMgr_CountByStatusMask(DTC_STATUS_CDTC));
}

static void test_ecu_reset_requires_extended_session(void)
{
    Setup();
    REQ(false, 0x11, 0x01);
    EXPECT(0x7F, 0x11, 0x7E);
    Uds_ExecutePendingReset();
    CHECK_EQ(0, g_resetCalls);

    REQ(false, 0x10, 0x03);
    REQ(false, 0x11, 0x01);
    EXPECT(0x51, 0x01);
    CHECK_EQ(0, g_resetCalls);                   /* not before the response is sent */
    Uds_ExecutePendingReset();
    CHECK_EQ(1, g_resetCalls);
    CHECK_EQ(0x01, g_resetType);
    CHECK_EQ(UDS_SESSION_DEFAULT, Uds_GetSession());
    Uds_ExecutePendingReset();                   /* only once */
    CHECK_EQ(1, g_resetCalls);

    REQ(false, 0x10, 0x03);
    REQ(false, 0x11, 0x02);                      /* keyOffOn not supported */
    EXPECT(0x7F, 0x11, 0x12);
}

static void test_functional_suppression_keeps_other_nrcs(void)
{
    Setup();
    REQ(true, 0x22, 0x12, 0x34);                 /* 0x31 suppressed */
    CHECK_EQ(0, g_respLen);
    REQ(true, 0x22, 0xF1);                       /* 0x13 is NOT suppressed */
    EXPECT(0x7F, 0x22, 0x13);
    REQ(true, 0x3E, 0x00);                       /* positive responses still sent */
    EXPECT(0x7E, 0x00);
}

static void test_empty_request(void)
{
    const uint8_t r[1] = { 0x10 };
    Setup();
    CHECK_EQ(0, Uds_ProcessRequest(r, 0U, false, g_resp, sizeof(g_resp)));
    CHECK_EQ(0, Uds_ProcessRequest(NULL, 1U, false, g_resp, sizeof(g_resp)));
}

int main(void)
{
    printf("UDS server unit tests\n");

    RUN_TEST(test_unknown_service);
    RUN_TEST(test_session_control);
    RUN_TEST(test_s3_timeout_returns_to_default);
    RUN_TEST(test_tester_present);
    RUN_TEST(test_read_did);
    RUN_TEST(test_read_did_response_too_long);
    RUN_TEST(test_read_dtc_count_and_list);
    RUN_TEST(test_clear_dtc);
    RUN_TEST(test_ecu_reset_requires_extended_session);
    RUN_TEST(test_functional_suppression_keeps_other_nrcs);
    RUN_TEST(test_empty_request);

    printf("\n%d checks, %d failures\n", g_testChecks, g_testFailures);
    return (g_testFailures == 0) ? 0 : 1;
}
