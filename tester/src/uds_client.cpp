/**
 * @file    uds_client.cpp
 * @brief   UDS client, see uds_client.hpp.
 */
#include "uds/uds_client.hpp"

#include <algorithm>
#include <array>
#include <string>

#include "uds/hex.hpp"

namespace uds {

namespace {

Error malformed()
{
    return Error{Error::Kind::Malformed};
}

std::uint16_t be16(std::uint8_t hi, std::uint8_t lo)
{
    return static_cast<std::uint16_t>((hi << 8) | lo);
}

}  // namespace

std::string Error::describe() const
{
    switch (kind)
    {
    case Kind::Timeout:
        return "no response";
    case Kind::Negative:
        return "NRC " + hex2(nrc) + " " + std::string(nrcName(nrc));
    case Kind::Malformed:
        return "unexpected response";
    case Kind::SendFailed:
        return "send failed";
    }
    return "unknown error";
}

UdsClient::UdsClient(ITransport& transport, ClientTiming timing)
    : m_transport(transport), m_timing(timing)
{
}

Result<Bytes> UdsClient::request(std::span<const std::uint8_t> req, Addressing addressing)
{
    if (req.empty())
    {
        return malformed();
    }
    if (!m_transport.send(req, addressing))
    {
        return Error{Error::Kind::SendFailed};
    }

    const std::uint8_t sid     = req[0];
    auto               timeout = m_timing.p2;

    for (int pending = 0; pending <= m_timing.maxPending; ++pending)
    {
        auto response = m_transport.receive(timeout);
        if (!response)
        {
            return Error{Error::Kind::Timeout};
        }

        const Bytes& r = *response;
        if ((r.size() == 3U) && (r[0] == sid::kNegativeResponse) && (r[1] == sid))
        {
            if (r[2] != static_cast<std::uint8_t>(Nrc::ResponsePending))
            {
                return Error{Error::Kind::Negative, r[2]};
            }
            timeout = m_timing.p2Star;   // ECU needs more time: wait for the final response
            continue;
        }
        if (!r.empty() && (r[0] == static_cast<std::uint8_t>(sid + sid::kPositiveOffset)))
        {
            return std::move(*response);
        }
        return malformed();
    }
    return Error{Error::Kind::Timeout};
}

Result<SessionTiming> UdsClient::startSession(Session session)
{
    const std::array<std::uint8_t, 2> req{sid::kSessionControl, static_cast<std::uint8_t>(session)};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    const Bytes& b = r.value();
    if ((b.size() != 6U) || (b[1] != req[1]))
    {
        return malformed();
    }
    // P2 in 1 ms, P2* in 10 ms steps (ISO 14229-2).
    return SessionTiming{std::chrono::milliseconds(be16(b[2], b[3])),
                         std::chrono::milliseconds(be16(b[4], b[5]) * 10)};
}

Status UdsClient::testerPresent(Addressing addressing)
{
    const std::array<std::uint8_t, 2> req{sid::kTesterPresent, 0x00};

    auto r = request(req, addressing);
    if (!r)
    {
        return r.error();
    }
    if ((r.value().size() != 2U) || (r.value()[1] != 0x00))
    {
        return malformed();
    }
    return std::monostate{};
}

bool UdsClient::testerPresentSuppressed(Addressing addressing)
{
    const std::array<std::uint8_t, 2> req{sid::kTesterPresent, kSuppressPositiveResponse};
    return m_transport.send(req, addressing);
}

Status UdsClient::ecuReset(ResetType type)
{
    const std::array<std::uint8_t, 2> req{sid::kEcuReset, static_cast<std::uint8_t>(type)};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    if ((r.value().size() < 2U) || (r.value()[1] != req[1]))
    {
        return malformed();
    }
    return std::monostate{};
}

Result<Bytes> UdsClient::readDid(std::uint16_t id)
{
    const std::array<std::uint8_t, 3> req{sid::kReadDid, static_cast<std::uint8_t>(id >> 8),
                                          static_cast<std::uint8_t>(id & 0xFFU)};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    const Bytes& b = r.value();
    if ((b.size() < 3U) || (be16(b[1], b[2]) != id))
    {
        return malformed();
    }
    return Bytes(b.begin() + 3, b.end());
}

Result<std::vector<DidValue>> UdsClient::readDids(std::span<const DidSpec> dids)
{
    Bytes req{sid::kReadDid};
    for (const DidSpec& d : dids)
    {
        req.push_back(static_cast<std::uint8_t>(d.id >> 8));
        req.push_back(static_cast<std::uint8_t>(d.id & 0xFFU));
    }

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }

    // Response: 62 [DID hi, DID lo, data...]*, in request order, unknown DIDs left out.
    const Bytes&          b = r.value();
    std::vector<DidValue> values;
    std::size_t           pos = 1U;
    while (pos < b.size())
    {
        if ((pos + 2U) > b.size())
        {
            return malformed();
        }
        const std::uint16_t id   = be16(b[pos], b[pos + 1U]);
        const auto          spec = std::find_if(dids.begin(), dids.end(),
                                                [id](const DidSpec& d) { return d.id == id; });
        pos += 2U;
        if ((spec == dids.end()) || ((pos + spec->length) > b.size()))
        {
            return malformed();
        }
        const auto first = b.begin() + static_cast<std::ptrdiff_t>(pos);
        values.push_back(DidValue{id, Bytes(first, first + static_cast<std::ptrdiff_t>(spec->length))});
        pos += spec->length;
    }
    return values;
}

Result<std::uint16_t> UdsClient::readDtcCount(std::uint8_t statusMask)
{
    const std::array<std::uint8_t, 3> req{sid::kReadDtc, 0x01, statusMask};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    // 59 01 <availability mask> <format> <count hi> <count lo>
    const Bytes& b = r.value();
    if ((b.size() != 6U) || (b[1] != 0x01))
    {
        return malformed();
    }
    return be16(b[4], b[5]);
}

Result<std::vector<Dtc>> UdsClient::readDtcs(std::uint8_t statusMask)
{
    const std::array<std::uint8_t, 3> req{sid::kReadDtc, 0x02, statusMask};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    // 59 02 <availability mask> [code hi, mid, lo, status]*
    const Bytes& b = r.value();
    if ((b.size() < 3U) || (b[1] != 0x02))
    {
        return malformed();
    }
    auto dtcs = parseDtcRecords(std::span(b).subspan(3));
    if (!dtcs)
    {
        return malformed();
    }
    return std::move(*dtcs);
}

Status UdsClient::clearAllDtcs()
{
    const std::array<std::uint8_t, 4> req{sid::kClearDtc, 0xFF, 0xFF, 0xFF};

    auto r = request(req);
    if (!r)
    {
        return r.error();
    }
    if (r.value().size() != 1U)
    {
        return malformed();
    }
    return std::monostate{};
}

}  // namespace uds
