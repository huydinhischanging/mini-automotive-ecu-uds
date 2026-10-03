/**
 * @file    dtc.cpp
 * @brief   DTC formatting and parsing, see dtc.hpp.
 */
#include "uds/dtc.hpp"

#include "uds/hex.hpp"

namespace uds {

std::string formatDtc(std::uint32_t code)
{
    // Byte 0: bits 7-6 system, bits 5-4 first digit, bits 3-0 second digit.
    static constexpr char kSystem[] = {'P', 'C', 'B', 'U'};
    const auto b0 = static_cast<std::uint8_t>(code >> 16);
    const auto b1 = static_cast<std::uint8_t>(code >> 8);
    const auto b2 = static_cast<std::uint8_t>(code);

    std::string s;
    s += kSystem[b0 >> 6];
    s += static_cast<char>('0' + ((b0 >> 4) & 0x03));
    s += hex2(b0).back();
    s += hex2(b1);
    s += '-';
    s += hex2(b2);   // failure type byte
    return s;
}

std::string summarizeStatus(std::uint8_t status)
{
    std::string s;
    const auto  add = [&s](const char* word) {
        if (!s.empty())
        {
            s += ' ';
        }
        s += word;
    };
    if ((status & dtc_status::kTestFailed) != 0)
    {
        add("failed");
    }
    if ((status & dtc_status::kPending) != 0)
    {
        add("pending");
    }
    if ((status & dtc_status::kConfirmed) != 0)
    {
        add("confirmed");
    }
    return s;
}

std::optional<std::vector<Dtc>> parseDtcRecords(std::span<const std::uint8_t> records)
{
    if ((records.size() % 4U) != 0U)
    {
        return std::nullopt;
    }
    std::vector<Dtc> dtcs;
    dtcs.reserve(records.size() / 4U);
    for (std::size_t i = 0U; i < records.size(); i += 4U)
    {
        const std::uint32_t code = (static_cast<std::uint32_t>(records[i]) << 16) |
                                   (static_cast<std::uint32_t>(records[i + 1U]) << 8) |
                                   records[i + 2U];
        dtcs.push_back(Dtc{code, records[i + 3U]});
    }
    return dtcs;
}

}  // namespace uds
