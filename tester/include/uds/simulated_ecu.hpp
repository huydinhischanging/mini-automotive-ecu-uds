/**
 * @file    simulated_ecu.hpp
 * @brief   Control ECU on the host: the real C UDS server and DTC manager from
 *          common/, behind the ITransport interface.
 *
 * The client is tested against the same server code that runs on the M4.
 * Time is simulated: a missing response is reported at once instead of after
 * the timeout, and advanceTime() drives the S3 session timer.
 *
 * The C modules keep their state in static variables, so only one instance
 * may exist at a time (enforced in the constructor).
 */
#pragma once

#include <array>
#include <chrono>
#include <cstdint>
#include <deque>
#include <optional>
#include <span>

#include "uds/control_ecu.hpp"
#include "uds/transport.hpp"

namespace uds {

class SimulatedEcu final : public ITransport
{
public:
    SimulatedEcu();
    ~SimulatedEcu() override;

    SimulatedEcu(const SimulatedEcu&) = delete;
    SimulatedEcu& operator=(const SimulatedEcu&) = delete;

    bool send(std::span<const std::uint8_t> request, Addressing addressing) override;
    std::optional<Bytes> receive(std::chrono::milliseconds timeout) override;

    /** Vehicle speed returned by DID 0x0100, in 0.1 km/h. */
    void setSpeedX10(std::uint16_t speed) { m_speedX10 = speed; }

    /** One execution of a monitor, as the Monitor task does every 10 ms on the ECU. */
    void reportMonitor(control_ecu::Monitor monitor, bool failed);

    /** Let simulated time pass (runs the S3 session timer). */
    void advanceTime(std::chrono::milliseconds dt);

    int hardResets() const { return m_hardResets; }
    int softResets() const { return m_softResets; }
    std::uint8_t session() const;

private:
    void powerOn();

    static std::uint32_t cbGetTimeMs();
    static void cbEcuReset(std::uint8_t type);
    static void cbReadVersion(std::uint8_t* out);
    static void cbReadSpeed(std::uint8_t* out);
    static void cbReadFaults(std::uint8_t* out);

    static SimulatedEcu* s_active;

    std::deque<Bytes>                                   m_responses;
    std::array<bool, control_ecu::kMonitorCount>        m_faults{};
    std::uint32_t                                       m_nowMs        = 0U;
    std::uint16_t                                       m_speedX10     = 0U;
    std::optional<std::uint8_t>                         m_pendingReset;
    int                                                 m_hardResets   = 0;
    int                                                 m_softResets   = 0;
};

}  // namespace uds
