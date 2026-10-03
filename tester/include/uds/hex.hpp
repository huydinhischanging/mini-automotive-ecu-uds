/**
 * @file    hex.hpp
 * @brief   Hex formatting for logs ("22 F1 95").
 */
#pragma once

#include <cstdint>
#include <span>
#include <string>

namespace uds {

/** Two upper-case hex digits. */
std::string hex2(std::uint8_t value);

/** Bytes separated by spaces. */
std::string hexDump(std::span<const std::uint8_t> bytes);

}  // namespace uds
