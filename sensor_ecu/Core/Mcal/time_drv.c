/**
 * @file    time_drv.c
 * @brief   MCAL - millisecond time base.
 */
#include "time_drv.h"
#include "main.h"

uint32_t TimeDrv_GetMs(void)
{
    return HAL_GetTick();
}
