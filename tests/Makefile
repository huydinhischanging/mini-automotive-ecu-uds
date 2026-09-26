# Host unit tests for the hardware-independent modules in common/.
#   make        build and run all tests
#   make clean
#
# Windows: needs MSYS2 UCRT64 gcc on PATH (C:\msys64\ucrt64\bin).

ifeq ($(origin CC),default)
  CC := gcc
endif
CFLAGS  := -std=c11 -g -O0 -Wall -Wextra -Wpedantic -Wshadow -Wconversion \
           -fsanitize=undefined -fno-sanitize-recover=all
COMMON  := ../common
BUILD   := build

ifneq (,$(findstring mingw,$(shell $(CC) -dumpmachine)))
  # UBSan is not available with MinGW (Windows)
  CFLAGS := $(filter-out -fsanitize=undefined -fno-sanitize-recover=all,$(CFLAGS))
  EXE    := .exe
endif

TESTS := test_isotp test_e2e test_dtc test_uds

.PHONY: all run clean
all: run

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/test_isotp$(EXE): test_isotp.c $(COMMON)/isotp/isotp.c $(COMMON)/isotp/isotp.h test_framework.h | $(BUILD)
	$(CC) $(CFLAGS) -I$(COMMON)/isotp -o $@ test_isotp.c $(COMMON)/isotp/isotp.c

$(BUILD)/test_e2e$(EXE): test_e2e.c $(COMMON)/e2e/e2e.c $(COMMON)/e2e/crc8.c $(COMMON)/e2e/e2e.h test_framework.h | $(BUILD)
	$(CC) $(CFLAGS) -I$(COMMON)/e2e -o $@ test_e2e.c $(COMMON)/e2e/e2e.c $(COMMON)/e2e/crc8.c

$(BUILD)/test_dtc$(EXE): test_dtc.c $(COMMON)/dtc/dtc_manager.c $(COMMON)/dtc/dtc_manager.h test_framework.h | $(BUILD)
	$(CC) $(CFLAGS) -I$(COMMON)/dtc -o $@ test_dtc.c $(COMMON)/dtc/dtc_manager.c

$(BUILD)/test_uds$(EXE): test_uds.c $(COMMON)/uds/uds_server.c $(COMMON)/uds/uds_server.h $(COMMON)/dtc/dtc_manager.c test_framework.h | $(BUILD)
	$(CC) $(CFLAGS) -I$(COMMON)/uds -I$(COMMON)/dtc -o $@ test_uds.c $(COMMON)/uds/uds_server.c $(COMMON)/dtc/dtc_manager.c

run: $(addprefix $(BUILD)/,$(addsuffix $(EXE),$(TESTS)))
	@for t in $^; do ./$$t || exit 1; done

clean:
	rm -rf $(BUILD)
