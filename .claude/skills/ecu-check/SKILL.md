---
name: ecu-check
description: Verify changes to this repo's C firmware or C++ tester before reporting them done or committing. Runs the host unit tests, cppcheck + MISRA C:2012, an arm-none-eabi-gcc compile of both ECUs, and the C++ tester when common/uds or common/dtc changed. Use after editing anything in common/, sensor_ecu/Core, control_ecu/CM4/Core or tester/, or when the user asks to check, test or verify the firmware.
---

# ECU check

Runs every check that can be done without the boards and reports exactly what passed. It does not
replace a hardware run: bus timing and fault reactions are only proven by logs from the real boards.

## 1. Find what changed

```bash
git status --short
git diff --name-only HEAD
```

Note which areas are touched: `common/`, `sensor_ecu/Core/`, `control_ecu/CM4/Core/`, `tester/`,
`tests/`. Ignore CubeIDE output (`Debug/`, `Release/`) and `.settings/`.

## 2. Run the checks

Always run the full host check. It takes about 25 s and covers unit tests, MISRA, and the ARM
compile of every project-owned file:

```bash
bash tools/check_all.sh
```

For a quicker loop while iterating on one file, compile just that file first:

```bash
bash tools/arm_compile_check.sh path/to/file.c
```

If `common/uds/`, `common/dtc/`, `tester/` or the DTC table changed, also build and run the C++
tester. Use a fresh build directory in the scratchpad (the checked-in `tester/build/` cache points at
another path and cmake rejects it):

```bash
export PATH="/c/msys64/ucrt64/bin:$PATH"
cmake -S tester -B "$BUILD" -G Ninja && cmake --build "$BUILD" && ctest --test-dir "$BUILD" --output-on-failure && "$BUILD/uds_tester" --sim
```

## 3. Check the cross-file invariants the tools cannot see

- A change to the fault list or DTC table must touch all three in the same order: `Fault_t` in
  `control_ecu/CM4/Core/App/control_app.c`, `k_dtcTable` in `control_ecu/CM4/Core/App/diag_app.c`,
  `enum class Monitor` in `tester/include/uds/control_ecu.hpp`, plus the DTC table in `README.md`.
- A frame layout change belongs in `common/can/can_matrix.h` only, never as local constants.
- If `sensor_app.c` has E2E fault modes that damage one frame in N, N must stay at or below
  `E2E_HEAL_FRAMES` in `control_app.c`, or the E2E fault heals between damaged frames.
- CubeMX-generated files may only change inside `USER CODE BEGIN/END` blocks.

## 4. Fix, do not suppress

- Compile error or warning: fix it. The firmware currently compiles with zero warnings under
  `-Wall -Wextra`; keep it that way.
- MISRA finding: fix the code. Only if there is no conforming way, add a deviation to
  `docs/misra_deviations.md` (rule, scope, rationale) and a narrowly scoped entry in
  `tools/misra_suppressions.txt`, and tell the user, since a deviation is a design decision.
- Failing unit test: find whether the code or the test is wrong before changing either.

Re-run step 2 after every fix until everything passes.

## 5. Report

Give the user a short table: each check, pass or fail, with counts from the output (unit test checks,
"no findings", number of ARM compilations, C++ tests passed). Then state plainly what is still
unverified, typically "not run on the hardware". If the change affects behaviour on the bus, say
which log the user should capture (for example `docs/logs/<milestone>_*.log`) before the README
roadmap or the report may claim it.
