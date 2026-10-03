/**
 * @file    scenario.hpp
 * @brief   Regression scenario against the Control ECU (same steps as the
 *          tester on the Sensor ECU, milestone M5).
 */
#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "uds/uds_client.hpp"

namespace uds {

struct StepResult
{
    std::string name;
    bool        passed = false;
    std::string detail;   ///< decoded data on success, the error otherwise
};

struct ScenarioReport
{
    std::vector<StepResult> steps;

    std::size_t passedCount() const;
    bool allPassed() const { return passedCount() == steps.size(); }
};

/** Services, DIDs, NRCs, DTC read/clear and functional addressing. Leaves the ECU in the default session. */
ScenarioReport runRegressionScenario(UdsClient& client);

/** ECU reset in the default session (refused) and in the extended session (accepted). */
ScenarioReport runResetScenario(UdsClient& client);

}  // namespace uds
