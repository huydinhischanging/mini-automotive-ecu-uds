/**
 * @file    control_ecu.hpp
 * @brief   Diagnostic data of the project's Control ECU (DIDs, DTCs).
 *
 * Mirrors the tables in control_ecu/CM4/Core/App/diag_app.c.
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

#include "uds/uds_client.hpp"

namespace control_ecu {

inline constexpr std::uint16_t kDidSoftwareVersion = 0xF195;   ///< ASCII, 10 bytes
inline constexpr std::uint16_t kDidVehicleSpeed    = 0x0100;   ///< 0.1 km/h, big-endian
inline constexpr std::uint16_t kDidActiveFaults    = 0x0101;   ///< fault bit mask

inline constexpr std::size_t kSoftwareVersionLength = 10U;

inline constexpr std::array<uds::DidSpec, 3> kAllDids{{
    {kDidSoftwareVersion, kSoftwareVersionLength},
    {kDidVehicleSpeed, 2U},
    {kDidActiveFaults, 1U},
}};

/** Monitors of the Control ECU, in DTC table order. */
enum class Monitor : std::uint8_t
{
    SpeedTimeout,   ///< U0100-87
    SpeedRange,     ///< P0501-00
    E2e,            ///< U0400-81
    SensorAdc,      ///< P0500-96
    OutputLocal,    ///< B1A00-11
};

inline constexpr std::size_t kMonitorCount = 5U;

}  // namespace control_ecu
