/**
 * @file    protocol.hpp
 * @brief   ISO 14229-1 constants used by the client.
 */
#pragma once

#include <cstdint>
#include <string_view>

namespace uds {

namespace sid {
inline constexpr std::uint8_t kSessionControl   = 0x10;
inline constexpr std::uint8_t kEcuReset         = 0x11;
inline constexpr std::uint8_t kClearDtc         = 0x14;
inline constexpr std::uint8_t kReadDtc          = 0x19;
inline constexpr std::uint8_t kReadDid          = 0x22;
inline constexpr std::uint8_t kTesterPresent    = 0x3E;
inline constexpr std::uint8_t kNegativeResponse = 0x7F;
inline constexpr std::uint8_t kPositiveOffset   = 0x40;
}  // namespace sid

/** Bit 7 of the sub-function: the ECU sends no positive response. */
inline constexpr std::uint8_t kSuppressPositiveResponse = 0x80;

enum class Session : std::uint8_t
{
    Default  = 0x01,
    Extended = 0x03,
};

enum class ResetType : std::uint8_t
{
    Hard = 0x01,
    Soft = 0x03,
};

enum class Nrc : std::uint8_t
{
    ServiceNotSupported              = 0x11,
    SubFunctionNotSupported          = 0x12,
    IncorrectMessageLength           = 0x13,
    ResponseTooLong                  = 0x14,
    RequestOutOfRange                = 0x31,
    ResponsePending                  = 0x78,
    SubFunctionNotSupportedInSession = 0x7E,
    ServiceNotSupportedInSession     = 0x7F,
};

/** Short ISO 14229 name of a negative response code, "unknown" if not listed. */
std::string_view nrcName(std::uint8_t nrc) noexcept;

}  // namespace uds
