# MISRA C:2012 compliance and deviations

Static analysis runs with **cppcheck 2.21** and its **MISRA C:2012 addon**:

```
tools/static_analysis.sh
```

The script analyses all project-owned code (`common/`, and the `App` and `Mcal` layers of
both ECUs) with the real HAL, CMSIS and FreeRTOS headers for type information. Vendor code
(STM32Cube HAL, CMSIS, FreeRTOS) and STM32CubeMX-generated headers (`Core/Inc`) are parsed
but not reported. Current result: **no findings**.

The cppcheck addon checks the rules that can be decided automatically; it is not a certified
MISRA checker, and it does not replace a manual review for the undecidable rules.

## Findings fixed in the code

| Rule | Category | Location | Fix |
|---|---|---|---|
| 12.2 | Required | `uds_server.c` | shift of an 8-bit constant by 8: cast to `uint16_t` before shifting |
| 10.8 | Required | `isotp.c`, `sensor_app.c`, `control_app.c`, `diag_app.c` | composite expressions cast to a wider type: cast the operand before the operation |
| 17.7 | Required | `sensor_app.c`, `control_app.c` | unused return values of `printf` / `osMutexAcquire` / `osMutexRelease` cast to `void` |
| 17.8 | Advisory | `io_drv.c` | parameter modified: clamped into a local variable |
| 13.4 | Advisory | `io_drv.c` | HAL setter macros with assignments in expressions replaced by register writes |
| 11.8 | Required | `can_drv.c` (MP1) | `const` cast away for the HAL TX call: payload copied into a local buffer |
| 12.1 | Advisory | `uds_server.c`, `diag_app.c` | explicit parentheses |
| 15.4 | Advisory | `isotp.c` | two `break`s in the CF send loop replaced by a loop flag |
| 2.5 | Advisory | `dtc_manager.h` | unused macro `DTC_STATUS_WIR` now defines the availability mask |

cppcheck also reported a `variableScope` style issue and a condition it considered always
false in the self-test logger; both were rewritten.

## Deviations

Only the deviations below are active (`tools/misra_suppressions.txt`), each scoped as
narrowly as the tool allows.

| ID | Rule | Category | Scope | Rationale |
|---|---|---|---|---|
| D1 | 15.5 single point of exit | Advisory | all | Early `return` for parameter and state validation keeps the nominal path unindented and readable. Widely deviated in automotive code. |
| D2 | 8.7, 2.5 | Advisory | `common/` | Public module APIs and constants are used by the firmware, which the tool analyses as a separate unit, so they appear unused or local. |
| D3 | 8.9 object at block scope | Advisory | all | Module state is kept at file scope on purpose: on the STM32MP157 it is located by symbol name and read from Linux through `/dev/mem`, the technique used to find both bring-up defects. |
| D4 | 11.4 pointer/integer conversion | Advisory | `Core/Mcal` | Peripheral access through CMSIS base-address macros (`GPIOA`, `RCC`, ...). Confined to the MCAL, the only layer allowed to touch hardware. |
| D5 | 21.6 `<stdio.h>`, 17.1 `<stdarg.h>` | Required | `Core/App` | Debug log (`printf` / `vprintf`) on the UART. Not used on any control or communication path; a production build would replace it with a bounded logger. |

Deviating a *required* rule (D5) needs a documented justification under MISRA
Compliance:2020; the one above is the record for this project.
