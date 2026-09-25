/**
 * @file    e2e.c
 * @brief   End-to-end protection, see e2e.h.
 */
#include "e2e.h"

#include <stddef.h>

#include "crc8.h"

void E2e_Protect(uint8_t frame[E2E_FRAME_LEN], uint8_t *counter)
{
    if ((frame == NULL) || (counter == NULL))
    {
        return;
    }

    frame[E2E_COUNTER_BYTE] = (uint8_t)(*counter & E2E_COUNTER_MASK);
    frame[E2E_CRC_BYTE]     = Crc8_SaeJ1850(frame, E2E_CRC_BYTE);
    *counter = (uint8_t)((*counter + 1U) & E2E_COUNTER_MASK);
}

void E2e_InitRx(E2e_RxState_t *state)
{
    if (state != NULL)
    {
        state->lastCounter = 0U;
        state->synced      = false;
    }
}

E2e_Status_t E2e_Check(E2e_RxState_t *state, const uint8_t *frame, uint8_t dlc)
{
    uint8_t counter;
    uint8_t delta;

    if ((state == NULL) || (frame == NULL) || (dlc < E2E_FRAME_LEN))
    {
        return E2E_ERR_LENGTH;
    }

    /* CRC first: a corrupted frame must never touch the counter state. */
    if (Crc8_SaeJ1850(frame, E2E_CRC_BYTE) != frame[E2E_CRC_BYTE])
    {
        return E2E_ERR_CRC;
    }

    counter = (uint8_t)(frame[E2E_COUNTER_BYTE] & E2E_COUNTER_MASK);

    if (!state->synced)
    {
        state->synced      = true;
        state->lastCounter = counter;
        return E2E_INITIAL;
    }

    /* Modulo-16 distance, so 15 -> 0 counts as +1. */
    delta = (uint8_t)((counter - state->lastCounter) & E2E_COUNTER_MASK);

    if (delta == 0U)
    {
        return E2E_ERR_REPEATED;   /* keep lastCounter */
    }

    state->lastCounter = counter;

    if (delta == 1U)
    {
        return E2E_OK;
    }
    if (delta <= E2E_MAX_DELTA_COUNTER)
    {
        return E2E_OK_SOME_LOST;
    }

    /* Too many lost: reject this frame, the next one is judged against it. */
    return E2E_ERR_WRONG_SEQ;
}
