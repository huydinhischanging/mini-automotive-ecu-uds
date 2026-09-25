/**
 * @file    control_app.h
 * @brief   Control ECU application (FreeRTOS).
 *
 * Tasks:
 *   ComRx   (AboveNormal) - takes CAN frames from the ISR queue, E2E-checks
 *                            0x100/0x101, updates the received speed signal.
 *   Monitor (Normal, 10 ms) - timeout / range / E2E fault detection, output
 *                            control (PWM), button, bus-off recovery, logging.
 */
#ifndef CONTROL_APP_H
#define CONTROL_APP_H

#include <stdbool.h>

/** Create RTOS objects and start CAN. Call after osKernelInitialize(),
 *  before osKernelStart(). @return false on driver/RTOS error. */
bool ControlApp_Init(void);

#endif /* CONTROL_APP_H */
