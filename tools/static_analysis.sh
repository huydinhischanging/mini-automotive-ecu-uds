#!/bin/bash
# Static analysis: cppcheck (bugs, style, portability) + MISRA C:2012 addon.
#
#   tools/static_analysis.sh            analyse everything, exit 1 on findings
#
# Scope: project-owned code only (common/, the App and Mcal layers of both
# ECUs). Vendor HAL/CMSIS/FreeRTOS and CubeMX-generated files are parsed for
# type information but not reported (see tools/misra_suppressions.txt).
# Requires cppcheck >= 2.x (MSYS2: pacman -S mingw-w64-ucrt-x86_64-cppcheck)
# and Python for the MISRA addon.
set -u
cd "$(dirname "$0")/.."

CPPCHECK=${CPPCHECK:-cppcheck}
MISRA_ADDON=${MISRA_ADDON:-$(dirname "$(command -v "$CPPCHECK")")/../share/cppcheck/addons/misra.py}
BUILD_DIR=${TMPDIR:-/tmp}/cppcheck_build
mkdir -p "$BUILD_DIR"

# The CMSIS headers stop with "#error Unknown compiler" unless the target
# compiler is known, which would hide every HAL type from the analysis.
TARGET_DEFS="-D__GNUC__=14 -D__arm__ -D__ARM_ARCH_7EM__ -DUSE_HAL_DRIVER"
COMMON_INC="-Icommon/can -Icommon/e2e -Icommon/isotp -Icommon/uds -Icommon/dtc"

OPTS=(--std=c11 --enable=warning,style,performance,portability --inline-suppr
      --addon="$MISRA_ADDON" --suppressions-list=tools/misra_suppressions.txt
      --cppcheck-build-dir="$BUILD_DIR" --error-exitcode=1 -q
      --template='{file}:{line}: [{severity}] {id}: {message}')

status=0
run() {
    local name=$1; shift
    echo "== $name"
    "$CPPCHECK" "${OPTS[@]}" "$@" || status=1
}

run "common (hardware independent)" $COMMON_INC common

G4=sensor_ecu/Drivers
run "sensor_ecu (App + MCAL)" $COMMON_INC $TARGET_DEFS -DSTM32G431xx \
    -Isensor_ecu/Core/Inc -Isensor_ecu/Core/Mcal -Isensor_ecu/Core/App \
    -I$G4/STM32G4xx_HAL_Driver/Inc -I$G4/CMSIS/Device/ST/STM32G4xx/Include -I$G4/CMSIS/Include \
    sensor_ecu/Core/App sensor_ecu/Core/Mcal

MP1=control_ecu/Drivers
RTOS=control_ecu/Middlewares/Third_Party/FreeRTOS/Source
run "control_ecu (App + MCAL)" $COMMON_INC $TARGET_DEFS -DSTM32MP157Dxx -DCORE_CM4 \
    -Icontrol_ecu/CM4/Core/Inc -Icontrol_ecu/CM4/Core/Mcal -Icontrol_ecu/CM4/Core/App \
    -I$MP1/STM32MP1xx_HAL_Driver/Inc -I$MP1/CMSIS/Device/ST/STM32MP1xx/Include -I$MP1/CMSIS/Include \
    -I$MP1/CMSIS/RTOS2/Include \
    -I$RTOS/include -I$RTOS/CMSIS_RTOS_V2 -I$RTOS/portable/GCC/ARM_CM4F \
    control_ecu/CM4/Core/App control_ecu/CM4/Core/Mcal

if [ $status -eq 0 ]; then echo "static analysis: no findings"; fi
exit $status
