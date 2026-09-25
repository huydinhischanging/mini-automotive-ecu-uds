/**
 * @file    crc8.h
 * @brief   CRC-8 SAE-J1850 (poly 0x1D, init 0xFF, xor-out 0xFF).
 *
 * Same CRC as AUTOSAR E2E Profile 1. Hardware independent.
 * Check value: Crc8_SaeJ1850("123456789", 9) == 0x4B
 */
#ifndef CRC8_H
#define CRC8_H

#include <stddef.h>
#include <stdint.h>

uint8_t Crc8_SaeJ1850(const uint8_t *data, size_t length);

#endif /* CRC8_H */
