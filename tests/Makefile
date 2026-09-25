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

ifeq ($(OS),Windows_NT)
  # UBSan is not available with MinGW
  CFLAGS := $(filter-out -fsanitize=undefined -fno-sanitize-recover=all,$(CFLAGS))
  EXE    := .exe
endif

TESTS := test_isotp

.PHONY: all run clean
all: run

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/test_isotp$(EXE): test_isotp.c $(COMMON)/isotp/isotp.c $(COMMON)/isotp/isotp.h test_framework.h | $(BUILD)
	$(CC) $(CFLAGS) -I$(COMMON)/isotp -o $@ test_isotp.c $(COMMON)/isotp/isotp.c

run: $(addprefix $(BUILD)/,$(addsuffix $(EXE),$(TESTS)))
	@for t in $^; do ./$$t || exit 1; done

clean:
	rm -rf $(BUILD)
