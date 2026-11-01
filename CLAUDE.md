# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-node automotive ECU network on real hardware: a Sensor ECU (NUCLEO-G431RB, bare-metal) sends a
speed signal over CAN 500 kbit/s with E2E protection (alive counter + CRC-8), and a Control ECU
(Cortex-M4 of an STM32MP157D-DK1, FreeRTOS, loaded by Linux remoteproc) monitors it, drives a
safe-state PWM output, stores DTCs and is a UDS server over ISO-TP. `tester/` is a C++20 UDS client.
`README.md` is the source of truth for status (milestones M1–M5, roadmap, verified wiring).

## Commands

Development happens on Windows in Git Bash. MSYS2 UCRT64 (`C:\msys64\ucrt64\bin`) provides gcc, make,
cppcheck, cmake, ninja and GoogleTest but is **not on PATH by default**; `tools/check_all.sh` adds it.
For other commands, prefix `export PATH="/c/msys64/ucrt64/bin:$PATH"`.

```bash
tools/check_all.sh                      # everything below except the C++ tester (~25 s)
make -C tests                           # C unit tests for common/ (UBSan on Linux, not with MinGW)
make -C tests build/test_e2e.exe && tests/build/test_e2e.exe   # one test binary (no .exe on Linux)
tools/static_analysis.sh                # cppcheck + MISRA C:2012 addon, exit 1 on any finding
tools/arm_compile_check.sh [FILE.c...]  # compile firmware sources with arm-none-eabi-gcc, no link
```

Test binaries: `test_isotp`, `test_e2e`, `test_dtc`, `test_uds` (see `tests/Makefile`). Tests use the
tiny `tests/test_framework.h` (`CHECK`, `CHECK_EQ`, `CHECK_MEM`, `RUN_TEST`), no external framework.

C++ tester (CI runs it with ASan + UBSan, see `.github/workflows/tests.yml`):

```bash
cmake -S tester -B <builddir> -G Ninja && cmake --build <builddir>
ctest --test-dir <builddir>
<builddir>/tester_tests --gtest_filter='SimulatedEcuTest.*'   # single suite/test
<builddir>/uds_tester --sim                                     # M5 scenario against SimulatedEcu
```

The checked-in `tester/build/` cache was generated from another path (`E:/IC/STM32/...`) and cmake
refuses it; use a fresh build directory instead of deleting the user's.

Firmware is built, flashed and debugged only in STM32CubeIDE (projects `sensor_ecu/` and
`control_ecu/CM4/`). `tools/arm_compile_check.sh` finds the CubeIDE-bundled compiler under
`C:/ST/STM32CubeIDE_*` (override with `ARM_GCC`) and mirrors the defines and include paths of both
`.cproject` files; `common/` files are compiled for both targets. Hardware behaviour (bus timing,
fault reactions) can only be verified on the boards; logs of verified runs live in `docs/logs/`.

## Architecture

**Layering rule:** only `Core/Mcal/` (`can_drv`, `adc_drv`, `io_drv`, `sys_drv`, ...) includes the
HAL. Everything in `common/` is plain, hardware-independent C. Hardware and OS are injected through
config structs of function pointers (`IsoTp_Config_t.sendFrame/getTimeMs`, `Uds_Config_t.getTimeMs/
ecuReset` and the DID table, `DtcMgr_Init` lock/unlock). That is why the same `common/` sources run
in three places: both firmwares (linked as the `common` folder in each CubeIDE project), `tests/`
with fake CAN driver and clock, and `tester/`'s `SimulatedEcu`, which links the real
`uds_server.c` and `dtc_manager.c`.

**`common/can/can_matrix.h` is the shared contract** for IDs, cycle times, signal layout and the
speed timeout. Cyclic frames always put the alive counter in byte 6 and the CRC in byte 7
(`common/e2e`).

**Control ECU data path** (`control_ecu/CM4/Core/App/control_app.c`): FDCAN ISR only copies the
frame into a 32-entry queue → `ComRxTask` (AboveNormal, 2 ms queue timeout so ISO-TP/UDS timers keep
running) runs `E2e_Check` and writes a mutex-protected `SensorView_t`, or hands 0x7E0/0x7DF frames
to `diag_app` → `MonitorTask` (Normal, `osDelayUntil` 10 ms) evaluates the five monitors, reports
**every** result to the DTC manager each cycle (debounce counts consecutive cycles), forces PWM to
0 % on speed faults, and sends 0x200 every 100 ms. `ControlApp_CanSend` serialises TX with a mutex
because the HAL TX call is not re-entrant.

**Index-coupled tables, keep in sync:** `Fault_t` in `control_app.c`, `k_dtcTable` in `diag_app.c`
and `enum class Monitor` in `tester/include/uds/control_ecu.hpp` share the same order (timeout,
range, E2E, ADC, local output). Adding a monitor means touching all three, plus the README tables.

**Diagnostics** (`diag_app.c`): ISO-TP link TX 0x7E8 / RX 0x7E0; functional 0x7DF accepts single
frames only. An accepted ECUReset is executed from the ISO-TP TX confirmation, i.e. after the
positive response is on the bus. Hard reset uses `SysDrv_Restart()` (jump to the reset vector), not
`NVIC_SystemReset()`: in production mode that leaves the M4 held in reset because Linux owns its
life cycle. DTCs are RAM-only, so a hard reset clears them.

**Sensor ECU** (`sensor_ecu/Core/App/sensor_app.c`): 10 ms task from TIM6. Button B1 cycles fault
injection modes NONE → SILENT → OUT_OF_RANGE. E2E fault modes (corrupted CRC, repeated counter, counter
jump) are on the roadmap as an exercise the owner writes; the course lesson 5.1.4 holds the spec. If a
mode damages one frame in N, N must stay at or below the Control ECU's `E2E_HEAL_FRAMES` (10), or the
E2E fault heals between damaged frames. `tester_app.c` makes the same board a UDS tester driven by keys
on the ST-LINK VCP.

**Loopback self-tests:** `SENSOR_APP_CAN_LOOPBACK` and `CONTROL_APP_CAN_LOOPBACK` (compile-time) switch
FDCAN to internal loopback; on the Control ECU this also fakes Sensor frames and runs a 14-step UDS
self-test from a second ISO-TP link.

## Rules for changes

- The owner writes core firmware (drivers, ISRs, RTOS tasks, E2E, protocol code) himself for job
  interviews: explain, give a spec and a skeleton with TODOs, review. Tooling, tests and docs may be
  written directly. No AI attribution lines in commits.
- MISRA: `tools/static_analysis.sh` must stay at **no findings**. Prefer fixing the code; a new
  deviation needs an entry in `docs/misra_deviations.md` and a narrowly scoped line in
  `tools/misra_suppressions.txt`. Match the existing style: `Module_Function` names, `s_` for file
  statics, `k_` for const tables, `U` suffixes, `(void)` on ignored return values.
- CubeMX-generated files (`main.c`, `FreeRTOSConfig.h`, `.ioc`, ...) are regenerated by the tool:
  change them only inside `USER CODE BEGIN/END` blocks (see the `USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION`
  override in `FreeRTOSConfig.h`).
- Keep README claims truthful: a roadmap item is ticked, and a requirement in the report
  (`docs/report/`, LaTeX, `main.pdf` committed) is "met", only with a hardware log or an automated
  test behind it. Code checked only on the host is described as such.
