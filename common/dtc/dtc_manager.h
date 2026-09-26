/**
 * @file    dtc_manager.h
 * @brief   Diagnostic Trouble Code manager with ISO 14229-1 status bits.
 *
 * The application runs its monitors (tests) periodically and reports each
 * result with DtcMgr_ReportResult(). The manager keeps, per DTC, the status
 * byte defined by ISO 14229-1 (Annex D) and a simple failure debounce:
 *
 *   bit 0  testFailed                          current result
 *   bit 1  testFailedThisOperationCycle
 *   bit 2  pendingDTC                          failed in this or the last cycle
 *   bit 3  confirmedDTC                        failed confirmThreshold times in a row
 *   bit 4  testNotCompletedSinceLastClear
 *   bit 5  testFailedSinceLastClear
 *   bit 6  testNotCompletedThisOperationCycle
 *   bit 7  warningIndicatorRequested           not supported (always 0)
 *
 * Storage is RAM only (no NVM on this platform yet). Hardware independent.
 * Not re-entrant by itself: pass lock/unlock callbacks when the manager is
 * shared between tasks.
 */
#ifndef DTC_MANAGER_H
#define DTC_MANAGER_H

#include <stdbool.h>
#include <stdint.h>

#define DTC_STATUS_TF       (0x01U)
#define DTC_STATUS_TFTOC    (0x02U)
#define DTC_STATUS_PDTC     (0x04U)
#define DTC_STATUS_CDTC     (0x08U)
#define DTC_STATUS_TNCSLC   (0x10U)
#define DTC_STATUS_TFSLC    (0x20U)
#define DTC_STATUS_TNCTOC   (0x40U)
#define DTC_STATUS_WIR      (0x80U)

/** Status bits this implementation supports (reported by UDS 0x19). */
#define DTC_STATUS_AVAILABILITY_MASK  (0x7FU)

#define DTC_MAX_ENTRIES     (16U)

typedef struct
{
    uint32_t code;              /* 3-byte DTC number (bits 23..0) */
    uint8_t  confirmThreshold;  /* consecutive failed reports before confirmed (>= 1) */
} DtcMgr_Config_t;

typedef void (*DtcMgr_LockFn)(void);

/**
 * @param table  DTC definitions, must stay valid (not copied)
 * @param lock   optional (may be NULL), same for unlock
 * @return false if count is 0 or larger than DTC_MAX_ENTRIES
 */
bool DtcMgr_Init(const DtcMgr_Config_t *table, uint8_t count,
                 DtcMgr_LockFn lock, DtcMgr_LockFn unlock);

/** Result of one execution of the monitor behind DTC number @p index. */
void DtcMgr_ReportResult(uint8_t index, bool failed);

/** Start a new operation cycle (e.g. after ECU reset / ignition on). */
void DtcMgr_StartOperationCycle(void);

/** UDS 0x14 group 0xFFFFFF: reset all status bytes and counters. */
void DtcMgr_ClearAll(void);

uint8_t DtcMgr_Count(void);
uint8_t DtcMgr_GetStatus(uint8_t index);

/**
 * Copy all DTCs whose (status & mask) != 0, as 4-byte records
 * [code23..16, code15..8, code7..0, status], into @p out.
 * @return number of records written (limited by maxRecords)
 */
uint8_t DtcMgr_GetByStatusMask(uint8_t mask, uint8_t *out, uint8_t maxRecords);

/** @return number of DTCs whose (status & mask) != 0 */
uint8_t DtcMgr_CountByStatusMask(uint8_t mask);

#endif /* DTC_MANAGER_H */
