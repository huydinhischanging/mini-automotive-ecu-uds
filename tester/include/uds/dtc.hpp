/**
 * @file    dtc.hpp
 * @brief   DTC records as returned by ReadDTCInformation (0x19 02).
 */
#pragma once

#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <vector>

namespace uds {

namespace dtc_status {
inline constexpr std::uint8_t kTestFailed                  = 0x01;
inline constexpr std::uint8_t kTestFailedThisCycle         = 0x02;
inline constexpr std::uint8_t kPending                     = 0x04;
inline constexpr std::uint8_t kConfirmed                   = 0x08;
inline constexpr std::uint8_t kTestNotCompletedSinceClear  = 0x10;
inline constexpr std::uint8_t kTestFailedSinceClear        = 0x20;
inline constexpr std::uint8_t kTestNotCompletedThisCycle   = 0x40;
inline constexpr std::uint8_t kWarningIndicator            = 0x80;
inline constexpr std::uint8_t kAll                         = 0xFF;
/** DTCs that have actually failed; leaves out monitors that have not run yet (status 0x50). */
inline constexpr std::uint8_t kFailedPendingConfirmed      = kTestFailed | kPending | kConfirmed;
}  // namespace dtc_status

struct Dtc
{
    std::uint32_t code   = 0;   ///< 3-byte DTC number
    std::uint8_t  status = 0;   ///< ISO 14229-1 status byte

    bool testFailed() const noexcept { return (status & dtc_status::kTestFailed) != 0; }
    bool pending() const noexcept { return (status & dtc_status::kPending) != 0; }
    bool confirmed() const noexcept { return (status & dtc_status::kConfirmed) != 0; }

    friend bool operator==(const Dtc&, const Dtc&) = default;
};

/** SAE J2012 notation, e.g. 0xC10087 -> "U0100-87". */
std::string formatDtc(std::uint32_t code);

/** "failed pending confirmed", only the bits a technician cares about. */
std::string summarizeStatus(std::uint8_t status);

/** Split 4-byte records [code hi, mid, lo, status]; nullopt if the length is not a multiple of 4. */
std::optional<std::vector<Dtc>> parseDtcRecords(std::span<const std::uint8_t> records);

}  // namespace uds
