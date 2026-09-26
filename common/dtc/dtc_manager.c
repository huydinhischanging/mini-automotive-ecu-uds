/**
 * @file    dtc_manager.c
 * @brief   DTC manager, see dtc_manager.h.
 */
#include "dtc_manager.h"

#include <stddef.h>

typedef struct
{
    uint8_t status;
    uint8_t failCount;
} DtcEntry_t;

static const DtcMgr_Config_t *s_table = NULL;
static uint8_t       s_count = 0U;
static DtcEntry_t    s_entries[DTC_MAX_ENTRIES];
static DtcMgr_LockFn s_lock = NULL;
static DtcMgr_LockFn s_unlock = NULL;

/* After a clear or at power-up, nothing has been tested yet. */
#define STATUS_INITIAL  ((uint8_t)(DTC_STATUS_TNCSLC | DTC_STATUS_TNCTOC))

static void Lock(void)
{
    if (s_lock != NULL)
    {
        s_lock();
    }
}

static void Unlock(void)
{
    if (s_unlock != NULL)
    {
        s_unlock();
    }
}

static void ResetAll(void)
{
    for (uint8_t i = 0U; i < s_count; i++)
    {
        s_entries[i].status    = STATUS_INITIAL;
        s_entries[i].failCount = 0U;
    }
}

bool DtcMgr_Init(const DtcMgr_Config_t *table, uint8_t count,
                 DtcMgr_LockFn lock, DtcMgr_LockFn unlock)
{
    if ((table == NULL) || (count == 0U) || (count > DTC_MAX_ENTRIES))
    {
        return false;
    }

    s_table  = table;
    s_count  = count;
    s_lock   = lock;
    s_unlock = unlock;
    ResetAll();
    return true;
}

void DtcMgr_ReportResult(uint8_t index, bool failed)
{
    DtcEntry_t *e;
    uint8_t     threshold;

    if (index >= s_count)
    {
        return;
    }

    Lock();
    e = &s_entries[index];
    threshold = (s_table[index].confirmThreshold == 0U) ? 1U : s_table[index].confirmThreshold;

    /* The test has now been completed in this cycle and since the last clear. */
    e->status &= (uint8_t)~(DTC_STATUS_TNCTOC | DTC_STATUS_TNCSLC);

    if (failed)
    {
        e->status |= (uint8_t)(DTC_STATUS_TF | DTC_STATUS_TFTOC | DTC_STATUS_TFSLC | DTC_STATUS_PDTC);
        if (e->failCount < 0xFFU)
        {
            e->failCount++;
        }
        if (e->failCount >= threshold)
        {
            e->status |= DTC_STATUS_CDTC;   /* stays set until cleared (no aging yet) */
        }
    }
    else
    {
        e->status &= (uint8_t)~DTC_STATUS_TF;
        e->failCount = 0U;                  /* debounce: failures must be consecutive */
    }
    Unlock();
}

void DtcMgr_StartOperationCycle(void)
{
    Lock();
    for (uint8_t i = 0U; i < s_count; i++)
    {
        DtcEntry_t *e = &s_entries[i];

        /* pendingDTC survives into the next cycle only if the test failed in
         * the one that just ended (ISO 14229-1, D.2). */
        if ((e->status & DTC_STATUS_TFTOC) == 0U)
        {
            e->status &= (uint8_t)~DTC_STATUS_PDTC;
        }
        e->status &= (uint8_t)~DTC_STATUS_TFTOC;
        e->status |= DTC_STATUS_TNCTOC;
    }
    Unlock();
}

void DtcMgr_ClearAll(void)
{
    Lock();
    ResetAll();
    Unlock();
}

uint8_t DtcMgr_Count(void)
{
    return s_count;
}

uint8_t DtcMgr_GetStatus(uint8_t index)
{
    uint8_t status = 0U;

    if (index < s_count)
    {
        Lock();
        status = s_entries[index].status;
        Unlock();
    }
    return status;
}

uint8_t DtcMgr_CountByStatusMask(uint8_t mask)
{
    uint8_t n = 0U;

    Lock();
    for (uint8_t i = 0U; i < s_count; i++)
    {
        if ((s_entries[i].status & mask & DTC_STATUS_AVAILABILITY_MASK) != 0U)
        {
            n++;
        }
    }
    Unlock();
    return n;
}

uint8_t DtcMgr_GetByStatusMask(uint8_t mask, uint8_t *out, uint8_t maxRecords)
{
    uint8_t n = 0U;

    if (out == NULL)
    {
        return 0U;
    }

    Lock();
    for (uint8_t i = 0U; (i < s_count) && (n < maxRecords); i++)
    {
        uint8_t status = s_entries[i].status;

        if ((status & mask & DTC_STATUS_AVAILABILITY_MASK) != 0U)
        {
            uint8_t *rec = &out[(uint16_t)n * 4U];
            rec[0] = (uint8_t)((s_table[i].code >> 16U) & 0xFFU);
            rec[1] = (uint8_t)((s_table[i].code >> 8U) & 0xFFU);
            rec[2] = (uint8_t)(s_table[i].code & 0xFFU);
            rec[3] = (uint8_t)(status & DTC_STATUS_AVAILABILITY_MASK);
            n++;
        }
    }
    Unlock();
    return n;
}
