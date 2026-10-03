/**
 * Client tests with a scripted transport: each test lists the responses the
 * "ECU" gives and checks the requests the client sent.
 */
#include <gtest/gtest.h>

#include <deque>

#include "uds/control_ecu.hpp"
#include "uds/uds_client.hpp"

namespace uds {
namespace {

using namespace std::chrono_literals;

class ScriptedTransport final : public ITransport
{
public:
    bool send(std::span<const std::uint8_t> request, Addressing addressing) override
    {
        sent.emplace_back(request.begin(), request.end());
        lastAddressing = addressing;
        return sendOk;
    }

    std::optional<Bytes> receive(std::chrono::milliseconds timeout) override
    {
        timeouts.push_back(timeout);
        if (responses.empty())
        {
            return std::nullopt;
        }
        Bytes r = std::move(responses.front());
        responses.pop_front();
        return r;
    }

    std::deque<Bytes>                      responses;
    std::vector<Bytes>                     sent;
    std::vector<std::chrono::milliseconds> timeouts;
    Addressing                             lastAddressing = Addressing::Physical;
    bool                                   sendOk         = true;
};

class UdsClientTest : public ::testing::Test
{
protected:
    ScriptedTransport link;
    UdsClient         client{link, ClientTiming{100ms, 5000ms, 3}};
};

TEST_F(UdsClientTest, PositiveResponseIsReturned)
{
    link.responses = {{0x62, 0xF1, 0x95, 'C', 'T', 'R', 'L'}};
    const auto r = client.readDid(0xF195);
    ASSERT_TRUE(r.ok());
    EXPECT_EQ(r.value(), (Bytes{'C', 'T', 'R', 'L'}));
    EXPECT_EQ(link.sent.at(0), (Bytes{0x22, 0xF1, 0x95}));
    EXPECT_EQ(link.timeouts.at(0), 100ms);
}

TEST_F(UdsClientTest, NegativeResponseCarriesNrc)
{
    link.responses = {{0x7F, 0x22, 0x31}};
    const auto r = client.readDid(0x1234);
    ASSERT_FALSE(r.ok());
    EXPECT_EQ(r.error().kind, Error::Kind::Negative);
    EXPECT_TRUE(r.error().isNrc(0x31));
    EXPECT_EQ(r.error().describe(), "NRC 31 requestOutOfRange");
}

TEST_F(UdsClientTest, ResponsePendingSwitchesToP2Star)
{
    link.responses = {{0x7F, 0x14, 0x78}, {0x7F, 0x14, 0x78}, {0x54}};
    EXPECT_TRUE(client.clearAllDtcs().ok());
    ASSERT_EQ(link.timeouts.size(), 3U);
    EXPECT_EQ(link.timeouts[0], 100ms);
    EXPECT_EQ(link.timeouts[1], 5000ms);
    EXPECT_EQ(link.timeouts[2], 5000ms);
}

TEST_F(UdsClientTest, EndlessResponsePendingGivesUp)
{
    for (int i = 0; i < 10; ++i)
    {
        link.responses.push_back({0x7F, 0x14, 0x78});
    }
    const auto r = client.clearAllDtcs();
    ASSERT_FALSE(r.ok());
    EXPECT_EQ(r.error().kind, Error::Kind::Timeout);
}

TEST_F(UdsClientTest, NoResponseIsTimeout)
{
    const auto r = client.testerPresent();
    ASSERT_FALSE(r.ok());
    EXPECT_EQ(r.error().kind, Error::Kind::Timeout);
}

TEST_F(UdsClientTest, SendFailureIsReported)
{
    link.sendOk = false;
    const auto r = client.testerPresent();
    ASSERT_FALSE(r.ok());
    EXPECT_EQ(r.error().kind, Error::Kind::SendFailed);
    EXPECT_TRUE(link.timeouts.empty());
}

TEST_F(UdsClientTest, ResponseToOtherServiceIsMalformed)
{
    link.responses = {{0x50, 0x03, 0x00, 0x32, 0x01, 0xF4}};
    const auto r = client.testerPresent();
    ASSERT_FALSE(r.ok());
    EXPECT_EQ(r.error().kind, Error::Kind::Malformed);
}

TEST_F(UdsClientTest, SessionTimingIsDecoded)
{
    link.responses = {{0x50, 0x03, 0x00, 0x32, 0x01, 0xF4}};
    const auto r = client.startSession(Session::Extended);
    ASSERT_TRUE(r.ok());
    EXPECT_EQ(r.value().p2, 50ms);
    EXPECT_EQ(r.value().p2Star, 5000ms);   // 0x01F4 x 10 ms
}

TEST_F(UdsClientTest, SuppressedTesterPresentDoesNotWait)
{
    EXPECT_TRUE(client.testerPresentSuppressed(Addressing::Functional));
    EXPECT_EQ(link.sent.at(0), (Bytes{0x3E, 0x80}));
    EXPECT_EQ(link.lastAddressing, Addressing::Functional);
    EXPECT_TRUE(link.timeouts.empty());
}

TEST_F(UdsClientTest, MultiDidResponseIsSplitByKnownLengths)
{
    link.responses = {{0x62, 0x01, 0x00, 0x06, 0x4D, 0x01, 0x01, 0x03}};
    const std::array<DidSpec, 3> dids{{{0xF195, 10}, {0x0100, 2}, {0x0101, 1}}};

    const auto r = client.readDids(dids);   // the ECU skipped F195 in this script

    ASSERT_TRUE(r.ok());
    ASSERT_EQ(r.value().size(), 2U);
    EXPECT_EQ(r.value()[0].id, 0x0100);
    EXPECT_EQ(r.value()[0].data, (Bytes{0x06, 0x4D}));
    EXPECT_EQ(r.value()[1].id, 0x0101);
    EXPECT_EQ(r.value()[1].data, (Bytes{0x03}));
    EXPECT_EQ(link.sent.at(0), (Bytes{0x22, 0xF1, 0x95, 0x01, 0x00, 0x01, 0x01}));
}

TEST_F(UdsClientTest, MultiDidResponseTooShortIsMalformed)
{
    link.responses = {{0x62, 0x01, 0x00, 0x06}};
    const std::array<DidSpec, 1> dids{{{0x0100, 2}}};
    EXPECT_EQ(client.readDids(dids).error().kind, Error::Kind::Malformed);
}

TEST_F(UdsClientTest, DtcListIsDecoded)
{
    link.responses = {{0x59, 0x02, 0x7F, 0xC1, 0x00, 0x87, 0x2E}};
    const auto r = client.readDtcs(0xFF);
    ASSERT_TRUE(r.ok());
    ASSERT_EQ(r.value().size(), 1U);
    EXPECT_EQ(formatDtc(r.value()[0].code), "U0100-87");
    EXPECT_EQ(link.sent.at(0), (Bytes{0x19, 0x02, 0xFF}));
}

TEST_F(UdsClientTest, DtcCountIsDecoded)
{
    link.responses = {{0x59, 0x01, 0x7F, 0x01, 0x00, 0x02}};
    const auto r = client.readDtcCount(0x08);
    ASSERT_TRUE(r.ok());
    EXPECT_EQ(r.value(), 2U);
}

}  // namespace
}  // namespace uds
