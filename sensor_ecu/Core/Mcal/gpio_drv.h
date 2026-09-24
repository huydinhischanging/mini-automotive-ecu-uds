/**
 * @file    gpio_drv.h
 * @brief   MCAL - Digital I/O driver (LED, user button).
 *
 * Upper layers use this interface instead of HAL_GPIO_xxx so that the
 * application does not depend on pin numbers or the HAL.
 */
#ifndef GPIO_DRV_H
#define GPIO_DRV_H

#include <stdbool.h>

void GpioDrv_SetLed(bool on);
void GpioDrv_ToggleLed(void);

/** @return true while the user button is physically pressed (raw, not debounced). */
bool GpioDrv_IsButtonPressed(void);

#endif /* GPIO_DRV_H */
