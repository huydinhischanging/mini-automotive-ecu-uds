/**
 * @file    uart_drv.h
 * @brief   MCAL - non-blocking character input from the ST-LINK virtual COM port
 *          (USART2). Output goes through printf (__io_putchar in main.c).
 */
#ifndef UART_DRV_H
#define UART_DRV_H

#include <stdbool.h>
#include <stdint.h>

/** @return true and the received byte in @p c if one is waiting. */
bool UartDrv_ReadChar(uint8_t *c);

#endif /* UART_DRV_H */
