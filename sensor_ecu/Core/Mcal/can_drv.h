/**
 * @file    can_drv.h
 * @brief   MCAL - Classic CAN driver on top of FDCAN1 (11-bit IDs, DLC 0..8).
 *
 * Bit timing (500 kbit/s, SP ~88 %) is configured by CubeMX in MX_FDCAN1_Init().
 * This driver adds: acceptance filter, start, TX, RX indication, bus-off recovery.
 */
#ifndef CAN_DRV_H
#define CAN_DRV_H

#include <stdbool.h>
#include <stdint.h>

#define CANDRV_MAX_DLC      (8U)
#define CANDRV_MAX_STD_ID   (0x7FFU)

typedef struct
{
    uint16_t id;                    /* 11-bit standard identifier */
    uint8_t  dlc;                   /* 0..8 */
    uint8_t  data[CANDRV_MAX_DLC];
} CanDrv_Frame_t;

typedef enum
{
    CANDRV_OK = 0,
    CANDRV_ERROR,
    CANDRV_TX_FULL                  /* all 3 TX FIFO slots busy, frame dropped */
} CanDrv_Status_t;

typedef enum
{
    CANDRV_MODE_NORMAL = 0,
    CANDRV_MODE_INTERNAL_LOOPBACK   /* TX looped back inside the MCU, no transceiver needed */
} CanDrv_Mode_t;

typedef struct
{
    uint32_t txQueued;
    uint32_t txDropped;
    uint32_t rxCount;
    uint32_t busOffCount;
} CanDrv_Stats_t;

/** Called from interrupt context for every received frame: keep it short. */
typedef void (*CanDrv_RxIndication_t)(const CanDrv_Frame_t *frame);

CanDrv_Status_t CanDrv_Init(CanDrv_Mode_t mode, CanDrv_RxIndication_t rxIndication);
CanDrv_Status_t CanDrv_Write(const CanDrv_Frame_t *frame);

/** Periodic housekeeping (bus-off recovery). Call every 10 ms. */
void CanDrv_MainFunction(void);

bool CanDrv_IsBusOff(void);
void CanDrv_GetStats(CanDrv_Stats_t *stats);

#endif /* CAN_DRV_H */
