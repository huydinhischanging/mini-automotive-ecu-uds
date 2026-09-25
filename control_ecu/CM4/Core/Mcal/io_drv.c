/**
 * @file    io_drv.c
 * @brief   MCAL - digital input and PWM output of the Control ECU.
 */
#include "io_drv.h"
#include "main.h"

extern TIM_HandleTypeDef htim1;

bool IoDrv_Init(void)
{
    /* ARR = 1000 - 1 gives a duty resolution of 0.1 %, independent of the
     * timer clock Linux configured (only the PWM frequency depends on it). */
    __HAL_TIM_SET_AUTORELOAD(&htim1, IODRV_PWM_MAX - 1U);
    __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_2, 0U);

    /* TIM1 is an advanced timer: HAL_TIM_PWM_Start also sets MOE, without
     * which the output stays disabled. */
    return (HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_2) == HAL_OK);
}

bool IoDrv_IsUserButtonPressed(void)
{
    return (HAL_GPIO_ReadPin(USER1_GPIO_Port, USER1_Pin) == GPIO_PIN_RESET);
}

void IoDrv_SetPwm(uint16_t duty)
{
    if (duty > IODRV_PWM_MAX)
    {
        duty = IODRV_PWM_MAX;
    }
    __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_2, duty);
}
