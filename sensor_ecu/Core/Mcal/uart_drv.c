/**
 * @file    uart_drv.c
 * @brief   MCAL - non-blocking character input on USART2 (polling).
 */
#include "uart_drv.h"
#include "main.h"

extern UART_HandleTypeDef huart2;

bool UartDrv_ReadChar(uint8_t *c)
{
    bool received = false;

    /* An overrun (typing faster than the 10 ms poll) blocks further reception
     * until the flag is cleared; the lost characters are simply dropped. */
    if (__HAL_UART_GET_FLAG(&huart2, UART_FLAG_ORE))
    {
        __HAL_UART_CLEAR_OREFLAG(&huart2);
    }

    if ((c != NULL) && __HAL_UART_GET_FLAG(&huart2, UART_FLAG_RXNE))
    {
        *c = (uint8_t)(huart2.Instance->RDR & 0xFFU);
        received = true;
    }
    return received;
}
