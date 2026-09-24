/**
 * @file    adc_drv.c
 * @brief   MCAL - ADC driver, wraps ADC1 channel 1 (PA0).
 */
#include "adc_drv.h"
#include "main.h"

#define ADC_POLL_TIMEOUT_MS     (1U)

extern ADC_HandleTypeDef hadc1;   /* defined in main.c by CubeMX */

AdcDrv_Status_t AdcDrv_Init(void)
{
    /* Calibration removes the internal offset error (several LSB).
     * It must run while the ADC is disabled, i.e. before the first start. */
    if (HAL_ADCEx_Calibration_Start(&hadc1, ADC_SINGLE_ENDED) != HAL_OK)
    {
        return ADCDRV_ERROR;
    }
    return ADCDRV_OK;
}

AdcDrv_Status_t AdcDrv_Read(uint16_t *value)
{
    AdcDrv_Status_t status = ADCDRV_ERROR;

    if (value == NULL)
    {
        return ADCDRV_ERROR;
    }

    if (HAL_ADC_Start(&hadc1) == HAL_OK)
    {
        if (HAL_ADC_PollForConversion(&hadc1, ADC_POLL_TIMEOUT_MS) == HAL_OK)
        {
            *value = (uint16_t)HAL_ADC_GetValue(&hadc1);
            status = ADCDRV_OK;
        }
        (void)HAL_ADC_Stop(&hadc1);
    }

    return status;
}
