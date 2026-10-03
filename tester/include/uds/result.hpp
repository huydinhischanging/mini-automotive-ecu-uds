/**
 * @file    result.hpp
 * @brief   Value-or-error return type of the UDS client.
 *
 * A negative response is an expected outcome in diagnostics (the tester often
 * checks that the ECU refuses a request), so errors are returned as values
 * instead of thrown.
 */
#pragma once

#include <cstdint>
#include <string>
#include <utility>
#include <variant>

namespace uds {

struct Error
{
    enum class Kind
    {
        Timeout,      ///< no response within P2 / P2*
        Negative,     ///< 7F <SID> <NRC>
        Malformed,    ///< response does not match the request
        SendFailed,   ///< transport refused the request
    };

    Kind         kind = Kind::Timeout;
    std::uint8_t nrc  = 0;   ///< valid for Kind::Negative

    bool isNrc(std::uint8_t code) const noexcept { return (kind == Kind::Negative) && (nrc == code); }
    std::string describe() const;
};

template <typename T>
class Result
{
public:
    Result(T value) : m_value(std::move(value)) {}   // NOLINT: implicit on purpose
    Result(Error error) : m_value(error) {}           // NOLINT: implicit on purpose

    bool ok() const noexcept { return std::holds_alternative<T>(m_value); }
    explicit operator bool() const noexcept { return ok(); }

    const T& value() const& { return std::get<T>(m_value); }
    T&& value() && { return std::get<T>(std::move(m_value)); }
    const Error& error() const& { return std::get<Error>(m_value); }

private:
    std::variant<T, Error> m_value;
};

/** Result of a request that returns no data. */
using Status = Result<std::monostate>;

}  // namespace uds
