/**
 * @file    uds_tester.cpp
 * @brief   Command-line UDS tester for the Control ECU.
 *
 *   uds_tester --sim      run the regression scenario against the simulated ECU
 *
 * The RPMsg transport to the real Control ECU (/dev/ttyRPMSG0 on the DK1) is
 * the next step; the scenario and the client do not change for it.
 */
#include <cstdio>
#include <string_view>

#include "uds/control_ecu.hpp"
#include "uds/scenario.hpp"
#include "uds/simulated_ecu.hpp"
#include "uds/uds_client.hpp"

namespace {

int printReport(const char* title, const uds::ScenarioReport& report)
{
    std::printf("\n%s\n", title);
    const std::size_t total = report.steps.size();
    for (std::size_t i = 0U; i < total; ++i)
    {
        const uds::StepResult& s = report.steps[i];
        std::printf("[TESTER] %2zu/%zu %-38s %s\n", i + 1U, total, s.name.c_str(), s.passed ? "PASS" : "FAIL");
        if (!s.detail.empty())
        {
            std::printf("         %s\n", s.detail.c_str());
        }
    }
    std::printf("[TESTER] %zu/%zu passed\n", report.passedCount(), total);
    return report.allPassed() ? 0 : 1;
}

int runSimulation()
{
    using control_ecu::Monitor;

    uds::SimulatedEcu ecu;
    ecu.setSpeedX10(1613U);   // 161.3 km/h

    // Same situation as in the M5 log: two faults occurred and are gone again.
    ecu.reportMonitor(Monitor::SpeedTimeout, true);
    for (int i = 0; i < 3; ++i)
    {
        ecu.reportMonitor(Monitor::E2e, true);
    }
    // One passing cycle of every monitor, as the Monitor task runs them all every 10 ms.
    for (std::size_t i = 0U; i < control_ecu::kMonitorCount; ++i)
    {
        ecu.reportMonitor(static_cast<Monitor>(i), false);
    }

    uds::UdsClient client(ecu);
    int            failures = printReport("Regression scenario (simulated Control ECU)",
                                          uds::runRegressionScenario(client));
    failures += printReport("ECU reset", uds::runResetScenario(client));
    std::printf("\nsimulated ECU: %d hard reset(s), session 0x%02X after reset\n", ecu.hardResets(),
                static_cast<unsigned>(ecu.session()));
    return (failures == 0) ? 0 : 1;
}

void usage()
{
    std::puts("usage: uds_tester --sim");
}

}  // namespace

int main(int argc, char** argv)
{
    if ((argc == 2) && (std::string_view(argv[1]) == "--sim"))
    {
        return runSimulation();
    }
    usage();
    return 2;
}
