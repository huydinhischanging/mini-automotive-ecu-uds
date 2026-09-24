/**
 * @file    can_drv.c
 * @brief   MCAL - Classic CAN driver on FDCAN1 (STM32G4 HAL).
 */
#include "can_drv.h"
#include "main.h"

/* Since G4 HAL v1.2 the DLC constants equal the byte count for 0..8,
 * which lets us pass frame->dlc straight into the TX header. */
_Static_assert(FDCAN_DLC_BYTES_8 == 8U, "FDCAN DLC encoding changed - update CanDrv_Write()");

/* After bus-off, wait this many CanDrv_MainFunction() calls (x10 ms) before
 * re-joining the bus, so a faulty node does not flood it with error frames. */
#define BUSOFF_RECOVERY_DELAY_TICKS     (10U)

extern FDCAN_HandleTypeDef hfdcan1;   /* defined in main.c by CubeMX */

static CanDrv_RxIndication_t s_rxIndication = NULL;
static volatile bool         s_busOffPending = false;
static uint32_t              s_busOffTimer = 0U;

static volatile CanDrv_Stats_t s_stats = {0U, 0U, 0U, 0U};

static CanDrv_Status_t ConfigureFilters(void)
{
    FDCAN_FilterTypeDef filter = {0};

    /* Filter 0: accept every standard ID into RX FIFO 0.
     * Narrow this down per node once the CAN matrix is fixed. */
    filter.IdType       = FDCAN_STANDARD_ID;
    filter.FilterIndex  = 0U;
    filter.FilterType   = FDCAN_FILTER_RANGE;
    filter.FilterConfig = FDCAN_FILTER_TO_RXFIFO0;
    filter.FilterID1    = 0x000U;
    filter.FilterID2    = CANDRV_MAX_STD_ID;

    if (HAL_FDCAN_ConfigFilter(&hfdcan1, &filter) != HAL_OK)
    {
        return CANDRV_ERROR;
    }

    /* Anything not matching a filter, remote frames and extended IDs are dropped
     * in hardware, so the CPU never sees them. */
    if (HAL_FDCAN_ConfigGlobalFilter(&hfdcan1, FDCAN_REJECT, FDCAN_REJECT,
                                     FDCAN_REJECT_REMOTE, FDCAN_REJECT_REMOTE) != HAL_OK)
    {
        return CANDRV_ERROR;
    }

    return CANDRV_OK;
}

CanDrv_Status_t CanDrv_Init(CanDrv_Mode_t mode, CanDrv_RxIndication_t rxIndication)
{
    s_rxIndication = rxIndication;

    if (mode == CANDRV_MODE_INTERNAL_LOOPBACK)
    {
        /* Re-init with the same bit timing, only the operating mode changes. */
        hfdcan1.Init.Mode = FDCAN_MODE_INTERNAL_LOOPBACK;
        if (HAL_FDCAN_Init(&hfdcan1) != HAL_OK)
        {
            return CANDRV_ERROR;
        }
    }

    if (ConfigureFilters() != CANDRV_OK)
    {
        return CANDRV_ERROR;
    }

    if (HAL_FDCAN_ActivateNotification(&hfdcan1,
                                       FDCAN_IT_RX_FIFO0_NEW_MESSAGE | FDCAN_IT_BUS_OFF,
                                       0U) != HAL_OK)
    {
        return CANDRV_ERROR;
    }

    if (HAL_FDCAN_Start(&hfdcan1) != HAL_OK)
    {
        return CANDRV_ERROR;
    }

    return CANDRV_OK;
}

CanDrv_Status_t CanDrv_Write(const CanDrv_Frame_t *frame)
{
    FDCAN_TxHeaderTypeDef header = {0};

    if ((frame == NULL) || (frame->dlc > CANDRV_MAX_DLC) || (frame->id > CANDRV_MAX_STD_ID))
    {
        return CANDRV_ERROR;
    }

    if (HAL_FDCAN_GetTxFifoFreeLevel(&hfdcan1) == 0U)
    {
        s_stats.txDropped++;
        return CANDRV_TX_FULL;
    }

    header.Identifier          = frame->id;
    header.IdType              = FDCAN_STANDARD_ID;
    header.TxFrameType         = FDCAN_DATA_FRAME;
    header.DataLength          = frame->dlc;
    header.ErrorStateIndicator = FDCAN_ESI_ACTIVE;
    header.BitRateSwitch       = FDCAN_BRS_OFF;
    header.FDFormat            = FDCAN_CLASSIC_CAN;
    header.TxEventFifoControl  = FDCAN_NO_TX_EVENTS;
    header.MessageMarker       = 0U;

    if (HAL_FDCAN_AddMessageToTxFifoQ(&hfdcan1, &header, frame->data) != HAL_OK)
    {
        s_stats.txDropped++;
        return CANDRV_ERROR;
    }

    s_stats.txQueued++;
    return CANDRV_OK;
}

void CanDrv_MainFunction(void)
{
    if (!s_busOffPending)
    {
        return;
    }

    s_busOffTimer++;
    if (s_busOffTimer >= BUSOFF_RECOVERY_DELAY_TICKS)
    {
        s_busOffTimer   = 0U;
        s_busOffPending = false;
        /* Hardware set CCCR.INIT on bus-off. Clearing it starts the ISO 11898
         * recovery sequence: the node re-joins after 128 x 11 recessive bits. */
        CLEAR_BIT(hfdcan1.Instance->CCCR, FDCAN_CCCR_INIT);
    }
}

bool CanDrv_IsBusOff(void)
{
    return ((hfdcan1.Instance->PSR & FDCAN_PSR_BO) != 0U);
}

void CanDrv_GetStats(CanDrv_Stats_t *stats)
{
    if (stats != NULL)
    {
        stats->txQueued    = s_stats.txQueued;
        stats->txDropped   = s_stats.txDropped;
        stats->rxCount     = s_stats.rxCount;
        stats->busOffCount = s_stats.busOffCount;
    }
}

/* ---------------------------------------------------------------------------
 * HAL callbacks (interrupt context, FDCAN1_IT0)
 * ------------------------------------------------------------------------- */

void HAL_FDCAN_RxFifo0Callback(FDCAN_HandleTypeDef *hfdcan, uint32_t RxFifo0ITs)
{
    FDCAN_RxHeaderTypeDef header;
    CanDrv_Frame_t        frame;

    if ((RxFifo0ITs & FDCAN_IT_RX_FIFO0_NEW_MESSAGE) == 0U)
    {
        return;
    }

    /* Drain the FIFO: several frames may have arrived before we got here. */
    while (HAL_FDCAN_GetRxFifoFillLevel(hfdcan, FDCAN_RX_FIFO0) > 0U)
    {
        if (HAL_FDCAN_GetRxMessage(hfdcan, FDCAN_RX_FIFO0, &header, frame.data) != HAL_OK)
        {
            break;
        }

        frame.id  = (uint16_t)header.Identifier;
        frame.dlc = (header.DataLength > CANDRV_MAX_DLC) ? (uint8_t)CANDRV_MAX_DLC
                                                         : (uint8_t)header.DataLength;
        s_stats.rxCount++;

        if (s_rxIndication != NULL)
        {
            s_rxIndication(&frame);
        }
    }
}

void HAL_FDCAN_ErrorStatusCallback(FDCAN_HandleTypeDef *hfdcan, uint32_t ErrorStatusITs)
{
    (void)hfdcan;

    if ((ErrorStatusITs & FDCAN_IT_BUS_OFF) != 0U)
    {
        s_stats.busOffCount++;
        s_busOffTimer   = 0U;
        s_busOffPending = true;
    }
}
