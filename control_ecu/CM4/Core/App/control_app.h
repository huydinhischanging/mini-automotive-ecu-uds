/**
 * @file    control_app.h
 * @brief   Control ECU application (FreeRTOS).
 *
 * Tasks:
 *   ComRx   (AboveNormal) - takes CAN frames from the ISR queue, E2E-checks
 *                            0x100/0x101, feeds diagnostics (ISO-TP / UDS).
 *   Monitor (Normal, 10 ms) - timeout / range / E2E fault detection, DTC
 *                            reporting, output control (PWM), button, logging.
 */
#ifndef CONTROL_APP_H
#define CONTROL_APP_H

#include <stdbool.h>
#include <stdint.h>

/** Create RTOS objects and start CAN. Call after osKernelInitialize(),
 *  before osKernelStart(). @return false on driver/RTOS error. */
bool ControlApp_Init(void);

/* Services used by the diagnostics module (diag_app). */
bool     ControlApp_CanSend(uint16_t id, const uint8_t *data, uint8_t dlc);  /* thread safe */
uint16_t ControlApp_GetSpeedX10(void);
uint8_t  ControlApp_GetFaultMask(void);
void     ControlApp_SetLocalFaultInjection(bool active);
void     ControlApp_SoftReset(void);
void     ControlApp_Log(const char *fmt, ...);                                /* thread safe */

#endif /* CONTROL_APP_H */
