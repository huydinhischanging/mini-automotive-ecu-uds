/**
 * @file    io_drv.h
 * @brief   MCAL - digital input and PWM output of the Control ECU.
 *
 *   USER1 button : PA14, active low (internal pull-up)
 *   Output       : PE11 / TIM1_CH2 PWM -> external LED on Arduino D10
 */
#ifndef IO_DRV_H
#define IO_DRV_H

#include <stdbool.h>
#include <stdint.h>

#define IODRV_PWM_MAX   (1000U)     /* duty resolution: 0 .. 1000 = 0 .. 100 % */

bool IoDrv_Init(void);

/** @return true while USER1 is physically pressed (raw, not debounced). */
bool IoDrv_IsUserButtonPressed(void);

/** @param duty 0 .. IODRV_PWM_MAX, clamped. */
void IoDrv_SetPwm(uint16_t duty);

#endif /* IO_DRV_H */
