/**
 * @file    e2e.h
 * @brief   End-to-end protection for cyclic CAN frames (alive counter + CRC-8).
 *
 * Simplified version of AUTOSAR E2E Profile 1, fixed to this project's layout:
 *   byte 6 : alive counter 0..15 (low nibble), +1 per frame
 *   byte 7 : CRC-8 SAE-J1850 over bytes 0..6
 *
 * The sender calls E2e_Protect() before transmitting. The receiver calls
 * E2e_Check() on every frame and gets one of the statuses below, so it can
 * tell apart a corrupted frame, a stuck sender (repeated counter) and lost frames.
 *
 * Hardware independent.
 */
#ifndef E2E_H
#define E2E_H

#include <stdbool.h>
#include <stdint.h>

#define E2E_FRAME_LEN           (8U)
#define E2E_COUNTER_BYTE        (6U)
#define E2E_CRC_BYTE            (7U)
#define E2E_COUNTER_MASK        (0x0FU)
#define E2E_MAX_DELTA_COUNTER   (3U)    /* up to 2 lost frames still accepted */

typedef enum
{
    E2E_OK = 0,             /* counter +1, CRC good */
    E2E_OK_SOME_LOST,       /* counter jumped by 2..E2E_MAX_DELTA_COUNTER */
    E2E_INITIAL,            /* first frame after init/resync, accepted */
    E2E_ERR_CRC,            /* data corrupted - discard */
    E2E_ERR_REPEATED,       /* same counter again - sender stuck or duplicate */
    E2E_ERR_WRONG_SEQ,      /* too many frames lost - discard and resync */
    E2E_ERR_LENGTH          /* frame shorter than the protected layout */
} E2e_Status_t;

typedef struct
{
    uint8_t lastCounter;
    bool    synced;
} E2e_RxState_t;

/** Write the alive counter and CRC into @p frame, then advance @p counter. */
void E2e_Protect(uint8_t frame[E2E_FRAME_LEN], uint8_t *counter);

void E2e_InitRx(E2e_RxState_t *state);

/** Check one received frame and update @p state. */
E2e_Status_t E2e_Check(E2e_RxState_t *state, const uint8_t *frame, uint8_t dlc);

/** @return true if the data of a frame with this status may be used. */
static inline bool E2e_IsValid(E2e_Status_t status)
{
    return (status == E2E_OK) || (status == E2E_OK_SOME_LOST) || (status == E2E_INITIAL);
}

#endif /* E2E_H */
