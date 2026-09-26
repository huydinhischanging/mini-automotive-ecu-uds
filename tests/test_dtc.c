/**
 * @file    test_dtc.c
 * @brief   Host unit tests for common/dtc (ISO 14229-1 status bits).
 */
#include <stdbool.h>
#include <stdint.h>

#include "dtc_manager.h"
#include "test_framework.h"

int g_testFailures = 0;
int g_testChecks = 0;

static const DtcMgr_Config_t k_table[] =
{
    { 0xC10087UL, 1U },     /* confirmed on first failure */
    { 0x050100UL, 3U },     /* confirmed after 3 consecutive failures */
};

static int g_locks;
static int g_unlocks;
static void CountLock(void)   { g_locks++; }
static void CountUnlock(void) { g_unlocks++; }

static void Setup(void)
{
    DtcMgr_Init(k_table, 2U, NULL, NULL);
}

static void test_init_rejects_bad_table(void)
{
    CHECK(!DtcMgr_Init(NULL, 1U, NULL, NULL));
    CHECK(!DtcMgr_Init(k_table, 0U, NULL, NULL));
    CHECK(!DtcMgr_Init(k_table, (uint8_t)(DTC_MAX_ENTRIES + 1U), NULL, NULL));
    CHECK(DtcMgr_Init(k_table, 2U, NULL, NULL));
}

static void test_initial_status_is_not_completed(void)
{
    Setup();
    CHECK_EQ(DTC_STATUS_TNCSLC | DTC_STATUS_TNCTOC, DtcMgr_GetStatus(0U));
    CHECK_EQ(0, DtcMgr_CountByStatusMask(DTC_STATUS_CDTC));
}

static void test_passed_result_clears_not_completed(void)
{
    Setup();
    DtcMgr_ReportResult(0U, false);
    CHECK_EQ(0x00, DtcMgr_GetStatus(0U));
}

static void test_failure_sets_status_bits(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);
    /* TF | TFTOC | PDTC | CDTC | TFSLC = 0x2F */
    CHECK_EQ(0x2F, DtcMgr_GetStatus(0U));
}

static void test_confirmation_needs_consecutive_failures(void)
{
    Setup();
    DtcMgr_ReportResult(1U, true);
    DtcMgr_ReportResult(1U, true);
    CHECK_EQ(0, DtcMgr_GetStatus(1U) & DTC_STATUS_CDTC);
    DtcMgr_ReportResult(1U, false);                    /* debounce reset */
    DtcMgr_ReportResult(1U, true);
    DtcMgr_ReportResult(1U, true);
    CHECK_EQ(0, DtcMgr_GetStatus(1U) & DTC_STATUS_CDTC);
    DtcMgr_ReportResult(1U, true);
    CHECK(DtcMgr_GetStatus(1U) & DTC_STATUS_CDTC);
    CHECK(DtcMgr_GetStatus(1U) & DTC_STATUS_PDTC);     /* pending from the first failure */
}

static void test_healing_keeps_history_bits(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);
    DtcMgr_ReportResult(0U, false);
    /* TF cleared, but the fault stays confirmed/pending and "failed since clear" */
    CHECK_EQ(DTC_STATUS_TFTOC | DTC_STATUS_PDTC | DTC_STATUS_CDTC | DTC_STATUS_TFSLC,
             DtcMgr_GetStatus(0U));
}

static void test_operation_cycle_rules(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);
    DtcMgr_ReportResult(0U, false);

    DtcMgr_StartOperationCycle();            /* failed in the previous cycle */
    CHECK(DtcMgr_GetStatus(0U) & DTC_STATUS_PDTC);
    CHECK_EQ(0, DtcMgr_GetStatus(0U) & DTC_STATUS_TFTOC);
    CHECK(DtcMgr_GetStatus(0U) & DTC_STATUS_TNCTOC);

    DtcMgr_ReportResult(0U, false);
    DtcMgr_StartOperationCycle();            /* a clean cycle ends pending */
    CHECK_EQ(0, DtcMgr_GetStatus(0U) & DTC_STATUS_PDTC);
    CHECK(DtcMgr_GetStatus(0U) & DTC_STATUS_CDTC);   /* confirmed stays (no aging) */
}

static void test_clear_all(void)
{
    Setup();
    DtcMgr_ReportResult(0U, true);
    DtcMgr_ReportResult(1U, true);
    DtcMgr_ClearAll();
    CHECK_EQ(DTC_STATUS_TNCSLC | DTC_STATUS_TNCTOC, DtcMgr_GetStatus(0U));
    CHECK_EQ(DTC_STATUS_TNCSLC | DTC_STATUS_TNCTOC, DtcMgr_GetStatus(1U));
    DtcMgr_ReportResult(1U, true);           /* debounce counter was reset too */
    CHECK_EQ(0, DtcMgr_GetStatus(1U) & DTC_STATUS_CDTC);
}

static void test_read_by_mask_records(void)
{
    uint8_t out[8];
    uint8_t n;

    Setup();
    DtcMgr_ReportResult(0U, true);
    DtcMgr_ReportResult(1U, false);

    CHECK_EQ(1, DtcMgr_CountByStatusMask(DTC_STATUS_CDTC));
    n = DtcMgr_GetByStatusMask(DTC_STATUS_CDTC, out, 2U);
    CHECK_EQ(1, n);
    CHECK_EQ(0xC1, out[0]);
    CHECK_EQ(0x00, out[1]);
    CHECK_EQ(0x87, out[2]);
    CHECK_EQ(0x2F, out[3]);

    /* ISO 14229: a DTC matches only if (status & mask) != 0. DTC 1 passed its
     * test, so its status is 0x00 and it is not reported even for mask 0xFF. */
    CHECK_EQ(1, DtcMgr_CountByStatusMask(0xFFU));
    DtcMgr_ReportResult(1U, true);
    CHECK_EQ(2, DtcMgr_CountByStatusMask(0xFFU));
    CHECK_EQ(1, DtcMgr_GetByStatusMask(0xFFU, out, 1U));   /* limited by maxRecords */
    CHECK_EQ(0, DtcMgr_GetByStatusMask(0xFFU, NULL, 2U));
}

static void test_out_of_range_index_ignored(void)
{
    Setup();
    DtcMgr_ReportResult(7U, true);
    CHECK_EQ(0, DtcMgr_GetStatus(7U));
    CHECK_EQ(0, DtcMgr_CountByStatusMask(DTC_STATUS_TF));
}

static void test_lock_callbacks_balanced(void)
{
    uint8_t out[8];

    g_locks = 0;
    g_unlocks = 0;
    DtcMgr_Init(k_table, 2U, CountLock, CountUnlock);
    DtcMgr_ReportResult(0U, true);
    (void)DtcMgr_GetStatus(0U);
    (void)DtcMgr_GetByStatusMask(0xFFU, out, 2U);
    DtcMgr_ClearAll();
    DtcMgr_StartOperationCycle();
    CHECK(g_locks > 0);
    CHECK_EQ(g_locks, g_unlocks);
}

int main(void)
{
    printf("DTC manager unit tests\n");

    RUN_TEST(test_init_rejects_bad_table);
    RUN_TEST(test_initial_status_is_not_completed);
    RUN_TEST(test_passed_result_clears_not_completed);
    RUN_TEST(test_failure_sets_status_bits);
    RUN_TEST(test_confirmation_needs_consecutive_failures);
    RUN_TEST(test_healing_keeps_history_bits);
    RUN_TEST(test_operation_cycle_rules);
    RUN_TEST(test_clear_all);
    RUN_TEST(test_read_by_mask_records);
    RUN_TEST(test_out_of_range_index_ignored);
    RUN_TEST(test_lock_callbacks_balanced);

    printf("\n%d checks, %d failures\n", g_testChecks, g_testFailures);
    return (g_testFailures == 0) ? 0 : 1;
}
