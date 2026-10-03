#include <gtest/gtest.h>

#include <array>

#include "uds/dtc.hpp"

namespace uds {
namespace {

TEST(FormatDtc, ProjectCodes)
{
    EXPECT_EQ(formatDtc(0xC10087), "U0100-87");
    EXPECT_EQ(formatDtc(0x050100), "P0501-00");
    EXPECT_EQ(formatDtc(0xC40081), "U0400-81");
    EXPECT_EQ(formatDtc(0x050096), "P0500-96");
    EXPECT_EQ(formatDtc(0x9A0011), "B1A00-11");
}

TEST(FormatDtc, AllFourSystemsAndDigits)
{
    EXPECT_EQ(formatDtc(0x000000), "P0000-00");
    EXPECT_EQ(formatDtc(0x7FFFFF), "C3FFF-FF");
    EXPECT_EQ(formatDtc(0xB12345), "B3123-45");
    EXPECT_EQ(formatDtc(0xFFFFFF), "U3FFF-FF");
}

TEST(SummarizeStatus, TechnicianBits)
{
    EXPECT_EQ(summarizeStatus(0x2E), "pending confirmed");
    EXPECT_EQ(summarizeStatus(0x2F), "failed pending confirmed");
    EXPECT_EQ(summarizeStatus(0x50), "");
}

TEST(ParseDtcRecords, SplitsFourByteRecords)
{
    const std::array<std::uint8_t, 8> raw{0xC1, 0x00, 0x87, 0x2E, 0xC4, 0x00, 0x81, 0x2F};
    const auto dtcs = parseDtcRecords(raw);
    ASSERT_TRUE(dtcs.has_value());
    ASSERT_EQ(dtcs->size(), 2U);
    EXPECT_EQ((*dtcs)[0], (Dtc{0xC10087, 0x2E}));
    EXPECT_EQ((*dtcs)[1], (Dtc{0xC40081, 0x2F}));
    EXPECT_FALSE((*dtcs)[0].testFailed());
    EXPECT_TRUE((*dtcs)[1].testFailed());
    EXPECT_TRUE((*dtcs)[1].confirmed());
}

TEST(ParseDtcRecords, EmptyIsValid)
{
    const auto dtcs = parseDtcRecords({});
    ASSERT_TRUE(dtcs.has_value());
    EXPECT_TRUE(dtcs->empty());
}

TEST(ParseDtcRecords, RejectsPartialRecord)
{
    const std::array<std::uint8_t, 5> raw{0xC1, 0x00, 0x87, 0x2E, 0xC4};
    EXPECT_FALSE(parseDtcRecords(raw).has_value());
}

}  // namespace
}  // namespace uds
