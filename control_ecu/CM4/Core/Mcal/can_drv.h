/**
 * @file    can_drv.h
 * @brief   MCAL - Classic CAN driver on FDCAN1 of the STM32MP157 Cortex-M4.
 *
 * Same interface as the Sensor ECU driver, plus:
 *  - kernel clock handling (Linux owns the clock tree in production mode),
 *  - configurable acceptance filters.
 */
#ifndef CAN_DRV_H
#define CAN_DRV_H

#include <stdbool.h>
#include <stdint.h>

#define CANDRV_MAX_DLC      (8U)
#define CANDRV_MAX_STD_ID   (0x7FFU)

typedef struct
{
    uint16_t id;
    uint8_t  dlc;
    uint8_t  data[CANDRV_MAX_DLC];
} CanDrv_Frame_t;

typedef enum
{
    CANDRV_OK = 0,
    CANDRV_ERROR,
    CANDRV_TX_FULL
} CanDrv_Status_t;

typedef enum
{
    CANDRV_MODE_NORMAL = 0,
    CANDRV_MODE_INTERNAL_LOOPBACK
} CanDrv_Mode_t;

/** Accept standard IDs firstId..lastId (inclusive). */
typedef struct
{
    uint16_t firstId;
    uint16_t lastId;
} CanDrv_Filter_t;

typedef struct
{
    uint32_t txQueued;
    uint32_t txDropped;
    uint32_t rxCount;
    uint32_t busOffCount;
    uint32_t kernelClockHz;
} CanDrv_Stats_t;

/** Called from interrupt context for every received frame. */
typedef void (*CanDrv_RxIndication_t)(const CanDrv_Frame_t *frame);

/**
 * Select HSE (24 MHz) as FDCAN kernel clock. Must run BEFORE MX_FDCAN1_Init():
 * in production mode the clock left by Linux (PLL4_R) may be gated off, and
 * HAL_FDCAN_Init() would then time out.
 * @return the kernel clock actually in use, in Hz (read back from RCC).
 */
uint32_t CanDrv_PrepareKernelClock(void);

/** Filters, bit timing check, notifications, start. Call after MX_FDCAN1_Init(). */
CanDrv_Status_t CanDrv_Init(CanDrv_Mode_t mode, CanDrv_RxIndication_t rxIndication,
                            const CanDrv_Filter_t *filters, uint8_t filterCount);

CanDrv_Status_t CanDrv_Write(const CanDrv_Frame_t *frame);

/** Bus-off recovery. Call every 10 ms. */
void CanDrv_MainFunction(void);

bool CanDrv_IsBusOff(void);
void CanDrv_GetStats(CanDrv_Stats_t *stats);

#endif /* CAN_DRV_H */
