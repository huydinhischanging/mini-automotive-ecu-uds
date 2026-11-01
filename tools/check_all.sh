#!/bin/bash
# Run every host-side check: unit tests, static analysis (cppcheck + MISRA), then
# a compile of the firmware sources with the ARM toolchain (skipped if absent).
#
#   tools/check_all.sh
#
# On Windows the MSYS2 UCRT64 toolchain (gcc, make, cppcheck) is added to PATH
# automatically if it is installed in the default location.
set -u
cd "$(dirname "$0")/.."

if [ -d /c/msys64/ucrt64/bin ]; then
    export PATH="/c/msys64/ucrt64/bin:/c/msys64/usr/bin:$PATH"
    export MISRA_ADDON=${MISRA_ADDON:-C:/msys64/ucrt64/share/cppcheck/addons/misra.py}
fi

echo "=============== Unit tests ==============="
make -s -C tests || exit 1

echo
echo "=============== Static analysis (cppcheck + MISRA C:2012) ==============="
bash tools/static_analysis.sh || exit 1

echo
echo "=============== Target compile (arm-none-eabi-gcc) ==============="
# Kept in a variable: with MSYS2 first on PATH, its /tmp is not Git Bash's /tmp.
out=$(bash tools/arm_compile_check.sh 2>&1)
rc=$?
if [ $rc -eq 2 ]; then
    echo "skipped: $out"
else
    echo "$out" | grep -v '^ok '
fi
[ $rc -eq 0 ] || [ $rc -eq 2 ] || exit 1

echo
echo "All checks passed."
