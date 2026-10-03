/**
 * @file    scenario.cpp
 * @brief   Regression scenarios, see scenario.hpp.
 */
#include "uds/scenario.hpp"

#include <algorithm>
#include <array>
#include <cstdio>
#include <utility>

#include "uds/control_ecu.hpp"
#include "uds/hex.hpp"

namespace uds {

namespace {

std::string asText(const Bytes& b)
{
    return std::string(b.begin(), b.end());
}

std::string speedText(const Bytes& b)
{
    if (b.size() != 2U)
    {
        return "?";
    }
    const unsigned x10 = (static_cast<unsigned>(b[0]) << 8) | b[1];
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%u.%u km/h", x10 / 10U, x10 % 10U);
    return buf;
}

std::string dtcListText(const std::vector<Dtc>& dtcs)
{
    if (dtcs.empty())
    {
        return "no DTC";
    }
    std::string s;
    for (const Dtc& d : dtcs)
    {
        if (!s.empty())
        {
            s += ", ";
        }
        s += formatDtc(d.code) + " " + hex2(d.status);
        const std::string summary = summarizeStatus(d.status);
        if (!summary.empty())
        {
            s += " " + summary;
        }
    }
    return s;
}

/** Collects step results; each helper states what the step expects. */
class Recorder
{
public:
    explicit Recorder(ScenarioReport& report) : m_report(report) {}

    template <typename T, typename Describe>
    void expectOk(std::string name, const Result<T>& r, Describe describe)
    {
        add(std::move(name), r.ok(), r.ok() ? describe(r.value()) : r.error().describe());
    }

    template <typename T>
    void expectNrc(std::string name, const Result<T>& r, Nrc nrc)
    {
        const bool pass = !r.ok() && r.error().isNrc(static_cast<std::uint8_t>(nrc));
        add(std::move(name), pass, r.ok() ? "positive response" : r.error().describe());
    }

    /** Functional requests that the ECU must not answer (suppressed NRC). */
    template <typename T>
    void expectSilence(std::string name, const Result<T>& r)
    {
        const bool pass = !r.ok() && (r.error().kind == Error::Kind::Timeout);
        add(std::move(name), pass, pass ? "no response" : "ECU answered");
    }

    void add(std::string name, bool passed, std::string detail)
    {
        m_report.steps.push_back(StepResult{std::move(name), passed, std::move(detail)});
    }

private:
    ScenarioReport& m_report;
};

const auto kNoDetail = [](const auto&) { return std::string(); };

}  // namespace

std::size_t ScenarioReport::passedCount() const
{
    return static_cast<std::size_t>(
        std::count_if(steps.begin(), steps.end(), [](const StepResult& s) { return s.passed; }));
}

ScenarioReport runRegressionScenario(UdsClient& client)
{
    using namespace control_ecu;

    ScenarioReport report;
    Recorder       rec(report);

    rec.expectOk("TesterPresent", client.testerPresent(), kNoDetail);

    rec.expectOk("ReadDID F195 version", client.readDid(kDidSoftwareVersion),
                 [](const Bytes& b) { return "\"" + asText(b) + "\""; });

    rec.expectOk("ReadDID 0100 speed", client.readDid(kDidVehicleSpeed), speedText);

    rec.expectOk("ReadDID F195 + 0100 + 0101", client.readDids(kAllDids),
                 [](const std::vector<DidValue>& v) { return std::to_string(v.size()) + " DIDs"; });

    const std::array<std::uint8_t, 2> unknownService{0x85, 0x01};
    rec.expectNrc("Unknown service -> NRC 11", client.request(unknownService), Nrc::ServiceNotSupported);

    rec.expectNrc("Unknown DID -> NRC 31", client.readDid(0x1234), Nrc::RequestOutOfRange);

    rec.expectNrc("Reset in default session -> NRC 7E", client.ecuReset(ResetType::Hard),
                  Nrc::SubFunctionNotSupportedInSession);

    rec.expectOk("Read all DTCs", client.readDtcs(dtc_status::kAll), dtcListText);

    rec.expectOk("Session extended", client.startSession(Session::Extended), [](const SessionTiming& t) {
        return "P2 " + std::to_string(t.p2.count()) + " ms, P2* " + std::to_string(t.p2Star.count()) + " ms";
    });

    rec.expectOk("Clear all DTCs", client.clearAllDtcs(), kNoDetail);

    const auto confirmed = client.readDtcCount(dtc_status::kConfirmed);
    rec.add("Confirmed DTCs = 0 after clear", confirmed.ok() && (confirmed.value() == 0U),
            confirmed.ok() ? std::to_string(confirmed.value()) + " confirmed" : confirmed.error().describe());

    rec.expectOk("Session default", client.startSession(Session::Default), kNoDetail);

    rec.expectOk("Functional TesterPresent", client.testerPresent(Addressing::Functional), kNoDetail);

    rec.expectSilence("Functional unknown service: silent",
                      client.request(unknownService, Addressing::Functional));

    return report;
}

ScenarioReport runResetScenario(UdsClient& client)
{
    ScenarioReport report;
    Recorder       rec(report);

    rec.expectOk("Session extended", client.startSession(Session::Extended), kNoDetail);
    rec.expectOk("ECUReset hard", client.ecuReset(ResetType::Hard), kNoDetail);
    return report;
}

}  // namespace uds
