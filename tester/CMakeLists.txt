cmake_minimum_required(VERSION 3.20)
project(uds_tester LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_C_STANDARD 99)

option(UDS_TESTER_BUILD_TESTS "Build the GoogleTest unit tests" ON)

set(COMMON_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../common)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(WARNINGS -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion)
endif()

# UDS client: hardware independent, no dependency on the ECU code.
add_library(uds_client
    src/uds_client.cpp
    src/dtc.cpp
    src/protocol.cpp
    src/scenario.cpp)
target_include_directories(uds_client PUBLIC include)
target_compile_options(uds_client PRIVATE ${WARNINGS})

# Simulated Control ECU: the real C UDS server and DTC manager from common/.
add_library(ecu_sim
    src/simulated_ecu.cpp
    ${COMMON_DIR}/uds/uds_server.c
    ${COMMON_DIR}/dtc/dtc_manager.c)
target_include_directories(ecu_sim PRIVATE ${COMMON_DIR}/uds ${COMMON_DIR}/dtc)
target_link_libraries(ecu_sim PUBLIC uds_client)
# Warnings for the C++ wrapper only; the C sources are checked by tools/static_analysis.sh.
target_compile_options(ecu_sim PRIVATE $<$<COMPILE_LANGUAGE:CXX>:${WARNINGS}>)

add_executable(uds_tester apps/uds_tester.cpp)
target_link_libraries(uds_tester PRIVATE uds_client ecu_sim)
target_compile_options(uds_tester PRIVATE ${WARNINGS})

if(UDS_TESTER_BUILD_TESTS)
    enable_testing()
    find_package(GTest REQUIRED)
    add_executable(tester_tests
        tests/dtc_test.cpp
        tests/uds_client_test.cpp
        tests/simulated_ecu_test.cpp)
    target_link_libraries(tester_tests PRIVATE uds_client ecu_sim GTest::gtest_main)
    target_compile_options(tester_tests PRIVATE ${WARNINGS})
    include(GoogleTest)
    # PRE_TEST: list the tests when ctest runs, not at link time, so the build
    # does not need to start the test program (and find its DLLs on Windows).
    gtest_discover_tests(tester_tests DISCOVERY_MODE PRE_TEST)
endif()
