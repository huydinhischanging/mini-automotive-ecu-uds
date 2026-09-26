#!/bin/bash
# Run every host-side check: unit tests, then static analysis (cppcheck + MISRA).
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
echo "All checks passed."
