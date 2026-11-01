#!/bin/bash
# Target compile check: build project-owned C files with the ARM toolchain and the
# same defines / include paths as the STM32CubeIDE projects. Catches errors the
# host tests cannot see (HAL types, target-only code) without opening the IDE.
#
#   tools/arm_compile_check.sh                 every App, Mcal and common/ file
#   tools/arm_compile_check.sh FILE.c ...      only these files
#
# Files in common/ are compiled for both ECUs, since both firmwares link them.
# Objects go to a temp dir; nothing in the repo is touched (no link step).
# Compiler: $ARM_GCC, else arm-none-eabi-gcc on PATH, else the one bundled
# with STM32CubeIDE under C:/ST.
set -u
cd "$(dirname "$0")/.."

ARM_GCC=${ARM_GCC:-$(command -v arm-none-eabi-gcc 2>/dev/null || true)}
if [ -z "$ARM_GCC" ]; then
    # Newest STM32CubeIDE install wins (Windows layout).
    ARM_GCC=$(ls -d /c/ST/STM32CubeIDE_*/STM32CubeIDE/plugins/*gnu-tools-for-stm32*/tools/bin/arm-none-eabi-gcc.exe 2>/dev/null | sort | tail -n 1)
fi
if [ -z "$ARM_GCC" ] || [ ! -x "$ARM_GCC" ]; then
    echo "arm-none-eabi-gcc not found: install STM32CubeIDE or set ARM_GCC" >&2
    exit 2
fi

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

CPU="-mcpu=cortex-m4 -mfpu=fpv4-sp-d16 -mfloat-abi=hard -mthumb"
CFLAGS="-std=gnu11 -O2 -Wall -Wextra -ffunction-sections -fdata-sections"
COMMON_INC="-Icommon/can -Icommon/e2e -Icommon/isotp -Icommon/uds -Icommon/dtc"

G4=sensor_ecu/Drivers
SENSOR="-DDEBUG -DUSE_HAL_DRIVER -DSTM32G431xx
    -Isensor_ecu/Core/Inc -Isensor_ecu/Core/Mcal -Isensor_ecu/Core/App
    -I$G4/STM32G4xx_HAL_Driver/Inc -I$G4/STM32G4xx_HAL_Driver/Inc/Legacy
    -I$G4/CMSIS/Device/ST/STM32G4xx/Include -I$G4/CMSIS/Include"

MP1=control_ecu/Drivers
MW=control_ecu/Middlewares/Third_Party
CONTROL="-DDEBUG -DCORE_CM4 -DUSE_HAL_DRIVER -DSTM32MP157Dxx -DNO_ATOMIC_64_SUPPORT
    -DMETAL_INTERNAL -DMETAL_MAX_DEVICE_REGIONS=2 -DVIRTIO_SLAVE_ONLY
    -Icontrol_ecu/CM4/Core/Inc -Icontrol_ecu/CM4/Core/Mcal -Icontrol_ecu/CM4/Core/App -Icontrol_ecu/CM4/OPENAMP
    -I$MP1/STM32MP1xx_HAL_Driver/Inc -I$MP1/STM32MP1xx_HAL_Driver/Inc/Legacy
    -I$MP1/CMSIS/Device/ST/STM32MP1xx/Include -I$MP1/CMSIS/Include -I$MP1/CMSIS/RTOS2/Include
    -I$MW/FreeRTOS/Source/include -I$MW/FreeRTOS/Source/CMSIS_RTOS_V2 -I$MW/FreeRTOS/Source/portable/GCC/ARM_CM4F
    -I$MW/OpenAMP/open-amp/lib/include -I$MW/OpenAMP/libmetal/lib/include -I$MW/OpenAMP/virtual_driver"

if [ $# -gt 0 ]; then
    FILES=("$@")
else
    FILES=(common/*/*.c sensor_ecu/Core/App/*.c sensor_ecu/Core/Mcal/*.c
           control_ecu/CM4/Core/App/*.c control_ecu/CM4/Core/Mcal/*.c)
fi

status=0
n=0
compile() {
    local target=$1 file=$2 flags=$3
    local log="$OUT/log.txt"
    # shellcheck disable=SC2086
    if "$ARM_GCC" $CPU $CFLAGS $COMMON_INC $flags -c "$file" -o "$OUT/$n.o" 2> "$log"; then
        if [ -s "$log" ]; then echo "warn  [$target] $file"; sed 's/^/      /' "$log"; else echo "ok    [$target] $file"; fi
    else
        echo "FAIL  [$target] $file"; sed 's/^/      /' "$log"; status=1
    fi
    n=$((n + 1))
}

for f in "${FILES[@]}"; do
    f=${f//\\//}
    case "$f" in
        *common/*)      compile sensor  "$f" "$SENSOR"; compile control "$f" "$CONTROL" ;;
        *sensor_ecu/*)  compile sensor  "$f" "$SENSOR" ;;
        *control_ecu/*) compile control "$f" "$CONTROL" ;;
        *) echo "skip  $f (not in common/, sensor_ecu/ or control_ecu/)" ;;
    esac
done

if [ $status -eq 0 ]; then echo "arm compile check: $n compilations, no errors"; fi
exit $status
