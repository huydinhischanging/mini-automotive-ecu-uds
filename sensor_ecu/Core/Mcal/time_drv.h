/**
 * @file    time_drv.h
 * @brief   MCAL - millisecond time base (wraps the HAL tick).
 */
#ifndef TIME_DRV_H
#define TIME_DRV_H

#include <stdint.h>

/** Monotonic milliseconds since reset, wraps after ~49 days. */
uint32_t TimeDrv_GetMs(void);

#endif /* TIME_DRV_H */
