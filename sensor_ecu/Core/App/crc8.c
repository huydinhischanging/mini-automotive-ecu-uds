/**
 * @file    crc8.c
 * @brief   CRC-8 SAE-J1850, bitwise implementation (small, no lookup table).
 */
#include "crc8.h"

#define CRC8_POLY       (0x1DU)
#define CRC8_INIT       (0xFFU)
#define CRC8_XOR_OUT    (0xFFU)

uint8_t Crc8_SaeJ1850(const uint8_t *data, size_t length)
{
    uint8_t crc = CRC8_INIT;

    if (data == NULL)
    {
        return 0U;
    }

    for (size_t i = 0U; i < length; i++)
    {
        crc ^= data[i];
        for (uint8_t bit = 0U; bit < 8U; bit++)
        {
            if ((crc & 0x80U) != 0U)
            {
                crc = (uint8_t)((uint8_t)(crc << 1U) ^ CRC8_POLY);
            }
            else
            {
                crc = (uint8_t)(crc << 1U);
            }
        }
    }

    return (uint8_t)(crc ^ CRC8_XOR_OUT);
}
