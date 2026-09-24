/**
 * @file    adc_drv.h
 * @brief   MCAL - ADC driver (single channel, software triggered).
 */
#ifndef ADC_DRV_H
#define ADC_DRV_H

#include <stdint.h>

#define ADCDRV_MAX_VALUE    (4095U)   /* 12-bit full scale */

typedef enum
{
    ADCDRV_OK = 0,
    ADCDRV_ERROR
} AdcDrv_Status_t;

/** Run the factory offset calibration. Call once, before the first read. */
AdcDrv_Status_t AdcDrv_Init(void);

/**
 * Start one conversion and wait for the result (~2.5 us).
 * @param[out] value  raw 12-bit result, 0..ADCDRV_MAX_VALUE
 */
AdcDrv_Status_t AdcDrv_Read(uint16_t *value);

#endif /* ADC_DRV_H */
