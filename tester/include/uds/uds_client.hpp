/**
 * @file    uds_client.hpp
 * @brief   ISO 14229-1 (UDS) client: builds requests, waits, decodes responses.
 *
 * Timing: the client waits P2 for a response; after NRC 0x78 (response
 * pending) it waits P2* for the final one. The defaults add a margin to the
 * ECU's P2 = 50 ms / P2* = 5000 ms for the transport and the host scheduler.
 */
#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

#include "uds/dtc.hpp"
#include "uds/protocol.hpp"
#include "uds/result.hpp"
#include "uds/transport.hpp"

namespace uds {

struct ClientTiming
{
    std::chrono::milliseconds p2{150};
    std::chrono::milliseconds p2Star{5500};
    int                       maxPending = 10;   ///< NRC 0x78 accepted in a row
};

/** Timing the ECU reports in its DiagnosticSessionControl response. */
struct SessionTiming
{
    std::chrono::milliseconds p2;
    std::chrono::milliseconds p2Star;
};

/** A DID in a multi-DID read. The response carries no lengths, so the caller supplies them. */
struct DidSpec
{
    std::uint16_t id;
    std::size_t   length;
};

struct DidValue
{
    std::uint16_t id;
    Bytes         data;
};

class UdsClient
{
public:
    explicit UdsClient(ITransport& transport, ClientTiming timing = {});

    /** Send any request; on success returns the positive response (first byte = SID + 0x40). */
    Result<Bytes> request(std::span<const std::uint8_t> req, Addressing addressing = Addressing::Physical);

    Result<SessionTiming> startSession(Session session);
    Status testerPresent(Addressing addressing = Addressing::Physical);
    /** 3E 80: keeps a session alive, the ECU does not answer. */
    bool testerPresentSuppressed(Addressing addressing = Addressing::Physical);
    Status ecuReset(ResetType type);

    /** 0x22 with one DID: returns all data bytes after the DID. */
    Result<Bytes> readDid(std::uint16_t id);
    /** 0x22 with several DIDs. The ECU skips DIDs it does not know. */
    Result<std::vector<DidValue>> readDids(std::span<const DidSpec> dids);

    Result<std::uint16_t> readDtcCount(std::uint8_t statusMask);
    Result<std::vector<Dtc>> readDtcs(std::uint8_t statusMask);
    Status clearAllDtcs();

private:
    ITransport&  m_transport;
    ClientTiming m_timing;
};

}  // namespace uds
