/**
 * @file    sys_drv.c
 * @brief   MCAL - system services of the Cortex-M4 on the STM32MP157.
 */
#include "sys_drv.h"
#include "main.h"

#define NVIC_REGISTER_COUNT     (8U)

typedef void (*ResetHandler_t)(void);

void SysDrv_Restart(void)
{
    /* Deviation D6 (docs/misra_deviations.md): the vector table address is an
     * integer register value; reaching the reset vector requires the cast. */
    const uint32_t *vectors = (const uint32_t *)SCB->VTOR;
    uint32_t        initialSp = vectors[0];
    ResetHandler_t  resetHandler = (ResetHandler_t)vectors[1];

    __disable_irq();

    /* Stop every interrupt source of the core. */
    SysTick->CTRL = 0U;
    for (uint32_t i = 0U; i < NVIC_REGISTER_COUNT; i++)
    {
        NVIC->ICER[i] = 0xFFFFFFFFU;
        NVIC->ICPR[i] = 0xFFFFFFFFU;
    }

    /* Put the peripherals owned by the M4 back into their reset state, so the
     * HAL initialises them from scratch. FDCAN leaves the bus cleanly. */
    __HAL_RCC_FDCAN_FORCE_RESET();
    __HAL_RCC_TIM1_FORCE_RESET();
    __HAL_RCC_TIM7_FORCE_RESET();
    __HAL_RCC_UART7_FORCE_RESET();
    __HAL_RCC_FDCAN_RELEASE_RESET();
    __HAL_RCC_TIM1_RELEASE_RESET();
    __HAL_RCC_TIM7_RELEASE_RESET();
    __HAL_RCC_UART7_RELEASE_RESET();

    /* Called from an RTOS task (process stack): switch back to the main stack
     * in privileged thread mode with no FPU context, as after a reset. */
    __set_CONTROL(0U);
    __ISB();
    __set_MSP(initialSp);
    __DSB();
    __ISB();

    /* All sources are disabled, so interrupts can be enabled again: the HAL
     * time base needs them before the scheduler starts. */
    __enable_irq();
    resetHandler();

    for (;;)
    {
        /* not reached */
    }
}
