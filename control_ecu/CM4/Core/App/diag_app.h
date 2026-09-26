/**
 * @file    diag_app.h
 * @brief   Control ECU diagnostics: ISO-TP link, UDS server, DTC table.
 *
 * Threading: DiagApp_OnFrame() and DiagApp_MainFunction() run in the ComRx
 * task only (single ISO-TP context). DiagApp_ReportFault() runs in the Monitor
 * task; the DTC manager is protected by a mutex.
 */
#ifndef DIAG_APP_H
#define DIAG_APP_H

#include <stdbool.h>
#include <stdint.h>

#include "can_drv.h"

bool DiagApp_Init(bool loopbackSelfTest);

/** A frame on 0x7E0, 0x7DF or 0x7E8 (0x7E8 only used by the loopback self-test). */
void DiagApp_OnFrame(const CanDrv_Frame_t *frame);

/** ISO-TP timers, UDS S3 timer, self-test sequencer. Call every few ms. */
void DiagApp_MainFunction(void);

/** Result of the monitor behind fault @p index (same order as the DTC table). */
void DiagApp_ReportFault(uint8_t index, bool failed);

uint8_t DiagApp_ConfirmedDtcCount(void);

#endif /* DIAG_APP_H */
