/**
 * @file    tester_app.h
 * @brief   Minimal UDS tester on the Sensor ECU, driven by single-key commands
 *          on the ST-LINK virtual COM port.
 *
 * It uses the shared ISO-TP module (TX 0x7E0, RX 0x7E8) against the Control
 * ECU on the real bus. Commands:
 *   t  full test sequence      d  read DTCs        c  clear DTCs
 *   v  version and speed       f  functional 0x7DF r  hard reset + recovery
 *   ?  help
 */
#ifndef TESTER_APP_H
#define TESTER_APP_H

#include "can_drv.h"

void TesterApp_Init(void);

/** Interrupt context: queue a received frame if it is a UDS response. */
void TesterApp_OnCanFrameIsr(const CanDrv_Frame_t *frame);

/** Call every 10 ms from the main loop: console, ISO-TP, sequence. */
void TesterApp_Task(void);

#endif /* TESTER_APP_H */
