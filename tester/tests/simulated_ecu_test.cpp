/**
 * End-to-end tests: the C++ client against the real C UDS server and DTC
 * manager from common/ (the code that runs on the Control ECU).
 */
#include <gtest/gtest.h>

#include <stdexcept>

#include "uds/control_ecu.hpp"
#include "uds/scenario.hpp"
#include "uds/simulated_ecu.hpp"
#include "uds/uds_client.hpp"

namespace uds {
namespace {

using namespace std::chrono_literals;
using control_ecu::Monitor;

class SimulatedEcuTest : public ::testing::Test
{
protected:
    SimulatedEcu ecu;
    UdsClient    client{ecu};
};

TEST_F(SimulatedEcuTest, RegressionScenarioPasses)
{
    const ScenarioReport report = runRegressionScenario(client);
    for (const StepResult& s : report.steps)
    {
        EXPECT_TRUE(s.passed) << s.name << ": " << s.detail;
    }
    EXPECT_EQ(report.steps.size(), 14U);
}

TEST_F(SimulatedEcuTest, VersionAndSpeed)
{
    ecu.setSpeedX10(1613);
    EXPECT_EQ(client.readDid(control_ecu::kDidSoftwareVersion).value(), (Bytes{'C', 'T', 'R', 'L', '-', '0', '.', '3', '.', '0'}));
    EXPECT_EQ(client.readDid(control_ecu::kDidVehicleSpeed).value(), (Bytes{0x06, 0x4D}));
}

TEST_F(SimulatedEcuTest, FaultLifecycleSeenByTester)
{
    ecu.reportMonitor(Monitor::SpeedTimeout, true);   // confirm threshold 1
    auto dtcs = client.readDtcs(dtc_status::kFailedPendingConfirmed).value();
    ASSERT_EQ(dtcs.size(), 1U);
    EXPECT_EQ(formatDtc(dtcs[0].code), "U0100-87");
    EXPECT_TRUE(dtcs[0].testFailed());
    EXPECT_TRUE(dtcs[0].confirmed());
    EXPECT_EQ(client.readDid(control_ecu::kDidActiveFaults).value(), (Bytes{0x01}));

    ecu.reportMonitor(Monitor::SpeedTimeout, false);  // fault gone, DTC stays confirmed
    dtcs = client.readDtcs(dtc_status::kFailedPendingConfirmed).value();
    ASSERT_EQ(dtcs.size(), 1U);
    EXPECT_EQ(dtcs[0].status, 0x2E);

    ASSERT_TRUE(client.clearAllDtcs().ok());
    EXPECT_EQ(client.readDtcCount(dtc_status::kConfirmed).value(), 0U);
}

TEST_F(SimulatedEcuTest, RangeFaultNeedsThreeFailedReports)
{
    ecu.reportMonitor(Monitor::SpeedRange, true);
    ecu.reportMonitor(Monitor::SpeedRange, true);
    EXPECT_EQ(client.readDtcCount(dtc_status::kConfirmed).value(), 0U);
    ecu.reportMonitor(Monitor::SpeedRange, true);
    EXPECT_EQ(client.readDtcCount(dtc_status::kConfirmed).value(), 1U);
}

TEST_F(SimulatedEcuTest, HardResetOnlyInExtendedSession)
{
    EXPECT_TRUE(client.ecuReset(ResetType::Hard).error().isNrc(0x7E));
    EXPECT_EQ(ecu.hardResets(), 0);

    const ScenarioReport report = runResetScenario(client);
    EXPECT_TRUE(report.allPassed());
    EXPECT_EQ(ecu.hardResets(), 1);
    EXPECT_EQ(ecu.session(), 0x01);
    EXPECT_TRUE(client.testerPresent().ok());   // ECU answers again after the restart
}

TEST_F(SimulatedEcuTest, HardResetLosesDtcsBecauseTheyAreInRam)
{
    ecu.reportMonitor(Monitor::SpeedTimeout, true);
    ASSERT_TRUE(client.startSession(Session::Extended).ok());
    ASSERT_TRUE(client.ecuReset(ResetType::Hard).ok());
    EXPECT_TRUE(client.readDtcs(dtc_status::kFailedPendingConfirmed).value().empty());
}

TEST_F(SimulatedEcuTest, MonitorsThatNeverRanAreReportedWithStatus50)
{
    // Mask 0xFF also matches "test not completed" (0x50): every DTC is listed until its monitor runs.
    const auto all = client.readDtcs(dtc_status::kAll).value();
    ASSERT_EQ(all.size(), control_ecu::kMonitorCount);
    for (const Dtc& d : all)
    {
        EXPECT_EQ(d.status, 0x50);
    }
}

TEST_F(SimulatedEcuTest, S3TimeoutReturnsToDefaultSession)
{
    ASSERT_TRUE(client.startSession(Session::Extended).ok());
    ecu.advanceTime(4000ms);
    ASSERT_TRUE(client.testerPresentSuppressed());   // restarts S3
    ecu.advanceTime(4999ms);
    EXPECT_EQ(ecu.session(), 0x03);
    ecu.advanceTime(1ms);
    EXPECT_EQ(ecu.session(), 0x01);
}

TEST_F(SimulatedEcuTest, FunctionalUnknownDidIsSilent)
{
    const std::array<std::uint8_t, 3> req{0x22, 0x12, 0x34};
    EXPECT_EQ(client.request(req, Addressing::Functional).error().kind, Error::Kind::Timeout);
    EXPECT_TRUE(client.request(req, Addressing::Physical).error().isNrc(0x31));
}

TEST(SimulatedEcuLifetime, OnlyOneInstance)
{
    SimulatedEcu first;
    EXPECT_THROW(SimulatedEcu second, std::logic_error);
}

}  // namespace
}  // namespace uds
