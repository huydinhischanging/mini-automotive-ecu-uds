/**
 * @file    simulated_ecu.cpp
 * @brief   Host-side Control ECU, see simulated_ecu.hpp.
 */
#include "uds/simulated_ecu.hpp"

#include <cstring>
#include <stdexcept>

extern "C" {
#include "dtc_manager.h"
#include "uds_server.h"
}

namespace uds {

namespace {

constexpr char        kVersion[]      = "CTRL-0.3.0";
constexpr std::size_t kMaxResponseLen = 4095U;   // ISO-TP limit on classic CAN

// Same DTC table as diag_app.c: code, confirm threshold.
constexpr DtcMgr_Config_t kDtcTable[control_ecu::kMonitorCount] = {
    {0xC10087UL, 1U},   // U0100-87
    {0x050100UL, 3U},   // P0501-00
    {0xC40081UL, 3U},   // U0400-81
    {0x050096UL, 3U},   // P0500-96
    {0x9A0011UL, 3U},   // B1A00-11
};

}  // namespace

SimulatedEcu* SimulatedEcu::s_active = nullptr;

SimulatedEcu::SimulatedEcu()
{
    if (s_active != nullptr)
    {
        throw std::logic_error("only one SimulatedEcu may exist at a time");
    }
    s_active = this;
    powerOn();
}

SimulatedEcu::~SimulatedEcu()
{
    s_active = nullptr;
}

void SimulatedEcu::powerOn()
{
    static const Uds_Did_t kDids[] = {
        {control_ecu::kDidSoftwareVersion, static_cast<std::uint8_t>(control_ecu::kSoftwareVersionLength),
         cbReadVersion},
        {control_ecu::kDidVehicleSpeed, 2U, cbReadSpeed},
        {control_ecu::kDidActiveFaults, 1U, cbReadFaults},
    };
    static const Uds_Config_t kUds = {kDids, 3U, cbGetTimeMs, cbEcuReset};

    // DTCs live in RAM on the M4, so a restart loses them; the simulation does the same.
    (void)DtcMgr_Init(kDtcTable, static_cast<std::uint8_t>(control_ecu::kMonitorCount), nullptr, nullptr);
    Uds_Init(&kUds);
    m_faults.fill(false);
}

bool SimulatedEcu::send(std::span<const std::uint8_t> request, Addressing addressing)
{
    if (request.empty() || (request.size() > kMaxResponseLen))
    {
        return false;
    }

    Bytes            response(kMaxResponseLen);
    const std::uint16_t len =
        Uds_ProcessRequest(request.data(), static_cast<std::uint16_t>(request.size()),
                           addressing == Addressing::Functional, response.data(),
                           static_cast<std::uint16_t>(response.size()));
    if (len > 0U)
    {
        response.resize(len);
        m_responses.push_back(std::move(response));
    }

    // As on the ECU: the reset runs only after its response has been sent.
    Uds_ExecutePendingReset();
    if (m_pendingReset)
    {
        if (*m_pendingReset == static_cast<std::uint8_t>(0x01))
        {
            ++m_hardResets;
            powerOn();
        }
        else
        {
            ++m_softResets;
            DtcMgr_StartOperationCycle();
        }
        m_pendingReset.reset();
    }
    return true;
}

std::optional<Bytes> SimulatedEcu::receive(std::chrono::milliseconds /*timeout*/)
{
    if (m_responses.empty())
    {
        return std::nullopt;
    }
    Bytes r = std::move(m_responses.front());
    m_responses.pop_front();
    return r;
}

void SimulatedEcu::reportMonitor(control_ecu::Monitor monitor, bool failed)
{
    const auto index = static_cast<std::uint8_t>(monitor);
    m_faults[index]  = failed;
    DtcMgr_ReportResult(index, failed);
}

void SimulatedEcu::advanceTime(std::chrono::milliseconds dt)
{
    m_nowMs += static_cast<std::uint32_t>(dt.count());
    Uds_MainFunction();
}

std::uint8_t SimulatedEcu::session() const
{
    return Uds_GetSession();
}

std::uint32_t SimulatedEcu::cbGetTimeMs()
{
    return s_active->m_nowMs;
}

void SimulatedEcu::cbEcuReset(std::uint8_t type)
{
    s_active->m_pendingReset = type;
}

void SimulatedEcu::cbReadVersion(std::uint8_t* out)
{
    std::memcpy(out, kVersion, control_ecu::kSoftwareVersionLength);
}

void SimulatedEcu::cbReadSpeed(std::uint8_t* out)
{
    out[0] = static_cast<std::uint8_t>(s_active->m_speedX10 >> 8);
    out[1] = static_cast<std::uint8_t>(s_active->m_speedX10 & 0xFFU);
}

void SimulatedEcu::cbReadFaults(std::uint8_t* out)
{
    std::uint8_t mask = 0U;
    for (std::size_t i = 0U; i < s_active->m_faults.size(); ++i)
    {
        if (s_active->m_faults[i])
        {
            mask = static_cast<std::uint8_t>(mask | (1U << i));
        }
    }
    out[0] = mask;
}

}  // namespace uds
