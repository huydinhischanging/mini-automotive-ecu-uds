/**
 * @file    sys_drv.h
 * @brief   MCAL - system services of the Cortex-M4 on the STM32MP157.
 */
#ifndef SYS_DRV_H
#define SYS_DRV_H

/**
 * Restart the firmware from its reset vector without resetting the core.
 *
 * In production mode Linux owns the M4 life cycle: NVIC_SystemReset() puts
 * the core into reset and it then stays held (RCC_MP_GCR.BOOT_MCU = 0) until
 * Linux restarts it through remoteproc, which it does not know it has to do.
 * This function instead stops all interrupts, resets the peripherals owned by
 * the M4, restores the initial stack pointer and jumps to Reset_Handler, so
 * RAM is re-initialised and the firmware boots as after a power-on.
 * Does not return.
 */
void SysDrv_Restart(void);

#endif /* SYS_DRV_H */
