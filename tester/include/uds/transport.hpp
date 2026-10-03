/**
 * @file    transport.hpp
 * @brief   Transport interface between the UDS client and the ECU.
 *
 * One call carries one complete UDS message. Segmentation (ISO-TP on CAN,
 * framing on RPMsg) is the job of the concrete transport, so the client
 * works unchanged over the simulated ECU, RPMsg or a CAN adapter.
 */
#pragma once

#include <chrono>
#include <cstdint>
#include <optional>
#include <span>
#include <vector>

namespace uds {

using Bytes = std::vector<std::uint8_t>;

enum class Addressing
{
    Physical,     ///< one ECU (0x7E0)
    Functional,   ///< all ECUs (0x7DF)
};

class ITransport
{
public:
    virtual ~ITransport() = default;

    /** Send one complete request. @return false if it could not be sent. */
    virtual bool send(std::span<const std::uint8_t> request, Addressing addressing) = 0;

    /** Wait up to @p timeout for one complete response. */
    virtual std::optional<Bytes> receive(std::chrono::milliseconds timeout) = 0;

protected:
    ITransport() = default;
    ITransport(const ITransport&) = default;
    ITransport& operator=(const ITransport&) = default;
};

}  // namespace uds
