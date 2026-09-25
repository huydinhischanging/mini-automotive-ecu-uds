/**
 * @file    test_e2e.c
 * @brief   Host unit tests for common/e2e (CRC-8 and alive counter check).
 */
#include <stdbool.h>
#include <stdint.h>

#include "crc8.h"
#include "e2e.h"
#include "test_framework.h"

int g_testFailures = 0;
int g_testChecks = 0;

static void MakeFrame(uint8_t *frame, uint8_t *counter, uint16_t speed)
{
    memset(frame, 0, E2E_FRAME_LEN);
    frame[0] = (uint8_t)(speed >> 8);
    frame[1] = (uint8_t)(speed & 0xFFU);
    E2e_Protect(frame, counter);
}

static void test_crc8_check_value(void)
{
    const uint8_t data[] = "123456789";
    CHECK_EQ(0x4B, Crc8_SaeJ1850(data, 9U));   /* SAE-J1850 catalogue value */
    CHECK_EQ(0x00, Crc8_SaeJ1850(NULL, 3U));
}

static void test_protect_writes_counter_and_crc(void)
{
    uint8_t frame[8];
    uint8_t counter = 5U;

    MakeFrame(frame, &counter, 1234U);
    CHECK_EQ(5, frame[E2E_COUNTER_BYTE]);
    CHECK_EQ(Crc8_SaeJ1850(frame, 7U), frame[E2E_CRC_BYTE]);
    CHECK_EQ(6, counter);
}

static void test_counter_wraps_15_to_0(void)
{
    uint8_t frame[8];
    uint8_t counter = 15U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 0U);
    CHECK_EQ(E2E_INITIAL, E2e_Check(&rx, frame, 8U));
    CHECK_EQ(0, counter);
    MakeFrame(frame, &counter, 0U);
    CHECK_EQ(E2E_OK, E2e_Check(&rx, frame, 8U));
}

static void test_sequence_of_good_frames(void)
{
    uint8_t frame[8];
    uint8_t counter = 0U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 10U);
    CHECK_EQ(E2E_INITIAL, E2e_Check(&rx, frame, 8U));
    for (int i = 0; i < 40; i++)
    {
        MakeFrame(frame, &counter, 10U);
        CHECK_EQ(E2E_OK, E2e_Check(&rx, frame, 8U));
    }
}

static void test_corrupted_byte_is_detected(void)
{
    uint8_t frame[8];
    uint8_t counter = 0U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 500U);
    E2e_Check(&rx, frame, 8U);

    MakeFrame(frame, &counter, 500U);
    frame[1] ^= 0x01U;                            /* single bit flip */
    CHECK_EQ(E2E_ERR_CRC, E2e_Check(&rx, frame, 8U));
    CHECK(!E2e_IsValid(E2E_ERR_CRC));

    /* The corrupted frame must not have advanced the state: the next good
     * frame is 2 counts ahead of the last accepted one. */
    MakeFrame(frame, &counter, 500U);
    CHECK_EQ(E2E_OK_SOME_LOST, E2e_Check(&rx, frame, 8U));
}

static void test_repeated_counter(void)
{
    uint8_t frame[8];
    uint8_t counter = 3U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 1U);
    E2e_Check(&rx, frame, 8U);
    CHECK_EQ(E2E_ERR_REPEATED, E2e_Check(&rx, frame, 8U));   /* same frame twice */
}

static void test_lost_frames(void)
{
    uint8_t frame[8];
    uint8_t counter = 0U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 1U);
    E2e_Check(&rx, frame, 8U);                    /* counter 0 */

    counter = 3U;                                 /* 1 and 2 lost */
    MakeFrame(frame, &counter, 1U);
    CHECK_EQ(E2E_OK_SOME_LOST, E2e_Check(&rx, frame, 8U));

    counter = 8U;                                 /* 4..7 lost: too many */
    MakeFrame(frame, &counter, 1U);
    CHECK_EQ(E2E_ERR_WRONG_SEQ, E2e_Check(&rx, frame, 8U));

    MakeFrame(frame, &counter, 1U);               /* resynced on 8 -> 9 is fine */
    CHECK_EQ(E2E_OK, E2e_Check(&rx, frame, 8U));
}

static void test_short_frame_rejected(void)
{
    uint8_t frame[8];
    uint8_t counter = 0U;
    E2e_RxState_t rx;

    E2e_InitRx(&rx);
    MakeFrame(frame, &counter, 1U);
    CHECK_EQ(E2E_ERR_LENGTH, E2e_Check(&rx, frame, 7U));
    CHECK_EQ(E2E_ERR_LENGTH, E2e_Check(NULL, frame, 8U));
}

int main(void)
{
    printf("E2E unit tests\n");

    RUN_TEST(test_crc8_check_value);
    RUN_TEST(test_protect_writes_counter_and_crc);
    RUN_TEST(test_counter_wraps_15_to_0);
    RUN_TEST(test_sequence_of_good_frames);
    RUN_TEST(test_corrupted_byte_is_detected);
    RUN_TEST(test_repeated_counter);
    RUN_TEST(test_lost_frames);
    RUN_TEST(test_short_frame_rejected);

    printf("\n%d checks, %d failures\n", g_testChecks, g_testFailures);
    return (g_testFailures == 0) ? 0 : 1;
}
