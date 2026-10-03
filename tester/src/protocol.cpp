/**
 * @file    protocol.cpp
 * @brief   NRC names and hex helpers.
 */
#include "uds/protocol.hpp"

#include "uds/hex.hpp"

namespace uds {

std::string_view nrcName(std::uint8_t nrc) noexcept
{
    switch (static_cast<Nrc>(nrc))
    {
    case Nrc::ServiceNotSupported:
        return "serviceNotSupported";
    case Nrc::SubFunctionNotSupported:
        return "subFunctionNotSupported";
    case Nrc::IncorrectMessageLength:
        return "incorrectMessageLengthOrInvalidFormat";
    case Nrc::ResponseTooLong:
        return "responseTooLong";
    case Nrc::RequestOutOfRange:
        return "requestOutOfRange";
    case Nrc::ResponsePending:
        return "requestCorrectlyReceived-ResponsePending";
    case Nrc::SubFunctionNotSupportedInSession:
        return "subFunctionNotSupportedInActiveSession";
    case Nrc::ServiceNotSupportedInSession:
        return "serviceNotSupportedInActiveSession";
    }
    return "unknown";
}

std::string hex2(std::uint8_t value)
{
    static constexpr char kDigits[] = "0123456789ABCDEF";
    return {kDigits[value >> 4], kDigits[value & 0x0FU]};
}

std::string hexDump(std::span<const std::uint8_t> bytes)
{
    std::string s;
    for (std::uint8_t b : bytes)
    {
        if (!s.empty())
        {
            s += ' ';
        }
        s += hex2(b);
    }
    return s;
}

}  // namespace uds
