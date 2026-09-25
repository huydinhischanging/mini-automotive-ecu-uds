/**
 * @file    can_drv.c
 * @brief   MCAL - Classic CAN driver on FDCAN1 (STM32MP1 HAL, Cortex-M4).
 */
#include "can_drv.h"
#include "main.h"

/* On MP1 (and H7) the HAL encodes the DLC in bits 19:16 of the header word,
 * unlike the G4 HAL where FDCAN_DLC_BYTES_8 == 8. */
#define DLC_SHIFT                       (16U)
_Static_assert(FDCAN_DLC_BYTES_8 == (8UL << DLC_SHIFT), "FDCAN DLC encoding changed");

#define KERNEL_CLOCK_HSE_HZ             (24000000UL)
#define KERNEL_CLOCK_PLL4R_HZ           (74250000UL)

#define BUSOFF_RECOVERY_DELAY_TICKS     (10U)   /* x 10 ms */
#define MAX_STD_FILTERS                 (2U)    /* must match StdFiltersNbr in CubeMX */

extern FDCAN_HandleTypeDef hfdcan1;

static CanDrv_RxIndication_t s_rxIndication = NULL;
static volatile bool         s_busOffPending = false;
static uint32_t              s_busOffTimer = 0U;
static uint32_t              s_kernelClockHz = 0U;

static volatile CanDrv_Stats_t s_stats = {0U, 0U, 0U, 0U, 0U};

/* Kernel clock muxes are glitch-free: a switch only completes while BOTH the
 * old and the new source are running. Linux selects PLL4_R for FDCAN but keeps
 * that PLL output disabled (unused), so a plain switch to HSE gets stuck and
 * FDCAN is left with no clock at all (CCCR.INIT can never be cleared).
 * Returns the PLLxCR register and DIVxEN bit feeding the current source. */
static void OldSourceGate(uint32_t source, volatile uint32_t **pllcr, uint32_t *diven)
{
    *pllcr = NULL;
    *diven = 0U;
    switch (source)
    {
        case RCC_FDCANCLKSOURCE_PLL3:   *pllcr = &RCC->PLL3CR; *diven = RCC_PLL3CR_DIVQEN; break;
        case RCC_FDCANCLKSOURCE_PLL4_Q: *pllcr = &RCC->PLL4CR; *diven = RCC_PLL4CR_DIVQEN; break;
        case RCC_FDCANCLKSOURCE_PLL4_R: *pllcr = &RCC->PLL4CR; *diven = RCC_PLL4CR_DIVREN; break;
        default:                        break;   /* HSE: nothing to do */
    }
}

uint32_t CanDrv_PrepareKernelClock(void)
{
    uint32_t           current = READ_BIT(RCC->FDCANCKSELR, RCC_FDCANCKSELR_FDCANSRC);
    volatile uint32_t *pllcr;
    uint32_t           diven;
    bool               tempEnabled = false;

    /* The HSE oscillator runs, but its output towards peripheral kernel clocks
     * is gated separately (HSEKERON) and Linux leaves it off because none of
     * its own drivers needs it. OCENSETR is write-1-to-set. */
    WRITE_REG(RCC->OCENSETR, RCC_OCENSETR_HSEKERON);

    if (current != RCC_FDCANCLKSOURCE_HSE)
    {
        OldSourceGate(current, &pllcr, &diven);
        if ((pllcr != NULL) && (READ_BIT(*pllcr, diven) == 0U))
        {
            SET_BIT(*pllcr, diven);     /* old source present for the switch */
            tempEnabled = true;
        }

        /* Linux does not use FDCAN (node disabled in the device tree), so the
         * M4 may pick the kernel clock. HSE gives exactly 500 kbit/s, 16 tq. */
        __HAL_RCC_FDCAN_CONFIG(RCC_FDCANCLKSOURCE_HSE);
        HAL_Delay(1U);                  /* >> a few cycles of both clocks */

        if (tempEnabled)
        {
            CLEAR_BIT(*pllcr, diven);   /* leave the PLL as Linux configured it */
        }
    }

    /* Read back: with RCC TrustZone enabled the write could be ignored. */
    s_kernelClockHz = HAL_RCCEx_GetPeriphCLKFreq(RCC_PERIPHCLK_FDCAN);
    return s_kernelClockHz;
}

/* 24 MHz: CubeMX values (presc 3, 1+13+2 tq) -> 500 kbit/s, SP 87.5 %.
 * 74.25 MHz fallback: 148 tq -> 501.7 kbit/s (+0.34 %), SP 87.2 %, still
 * inside the CAN oscillator tolerance with the large SJW. */
static CanDrv_Status_t ApplyBitTiming(void)
{
    if (s_kernelClockHz == KERNEL_CLOCK_HSE_HZ)
    {
        return CANDRV_OK;   /* MX_FDCAN1_Init() already used these values */
    }

    if (s_kernelClockHz == KERNEL_CLOCK_PLL4R_HZ)
    {
        hfdcan1.Init.NominalPrescaler     = 1U;
        hfdcan1.Init.NominalTimeSeg1      = 128U;
        hfdcan1.Init.NominalTimeSeg2      = 19U;
        hfdcan1.Init.NominalSyncJumpWidth = 19U;
        return (HAL_FDCAN_Init(&hfdcan1) == HAL_OK) ? CANDRV_OK : CANDRV_ERROR;
    }

    return CANDRV_ERROR;   /* unknown clock: refuse to run with a wrong bitrate */
}

static CanDrv_Status_t ConfigureFilters(const CanDrv_Filter_t *filters, uint8_t count)
{
    FDCAN_FilterTypeDef f = {0};

    if ((filters == NULL) || (count == 0U) || (count > MAX_STD_FILTERS))
    {
        return CANDRV_ERROR;
    }

    for (uint8_t i = 0U; i < count; i++)
    {
        f.IdType       = FDCAN_STANDARD_ID;
        f.FilterIndex  = i;
        f.FilterType   = FDCAN_FILTER_RANGE;
        f.FilterConfig = FDCAN_FILTER_TO_RXFIFO0;
        f.FilterID1    = filters[i].firstId;
        f.FilterID2    = filters[i].lastId;
        if (HAL_FDCAN_ConfigFilter(&hfdcan1, &f) != HAL_OK)
        {
            return CANDRV_ERROR;
        }
    }

    /* Everything else is dropped in hardware. */
    if (HAL_FDCAN_ConfigGlobalFilter(&hfdcan1, FDCAN_REJECT, FDCAN_REJECT,
                                     FDCAN_REJECT_REMOTE, FDCAN_REJECT_REMOTE) != HAL_OK)
    {
        return CANDRV_ERROR;
    }
    return CANDRV_OK;
}

CanDrv_Status_t CanDrv_Init(CanDrv_Mode_t mode, CanDrv_RxIndication_t rxIndication,
                            const CanDrv_Filter_t *filters, uint8_t filterCount)
{
    s_rxIndication       = rxIndication;
    s_stats.kernelClockHz = s_kernelClockHz;

    if (ApplyBitTiming() != CANDRV_OK)
    {
        return CANDRV_ERROR;
    }

    if (mode == CANDRV_MODE_INTERNAL_LOOPBACK)
    {
        hfdcan1.Init.Mode = FDCAN_MODE_INTERNAL_LOOPBACK;
        if (HAL_FDCAN_Init(&hfdcan1) != HAL_OK)
        {
            return CANDRV_ERROR;
        }
    }

    if (ConfigureFilters(filters, filterCount) != CANDRV_OK)
    {
        return CANDRV_ERROR;
    }

    if (HAL_FDCAN_ActivateNotification(&hfdcan1,
                                       FDCAN_IT_RX_FIFO0_NEW_MESSAGE | FDCAN_IT_BUS_OFF,
                                       0U) != HAL_OK)
    {
        return CANDRV_ERROR;
    }

    return (HAL_FDCAN_Start(&hfdcan1) == HAL_OK) ? CANDRV_OK : CANDRV_ERROR;
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
    header.DataLength          = (uint32_t)frame->dlc << DLC_SHIFT;
    header.ErrorStateIndicator = FDCAN_ESI_ACTIVE;
    header.BitRateSwitch       = FDCAN_BRS_OFF;
    header.FDFormat            = FDCAN_CLASSIC_CAN;
    header.TxEventFifoControl  = FDCAN_NO_TX_EVENTS;
    header.MessageMarker       = 0U;

    if (HAL_FDCAN_AddMessageToTxFifoQ(&hfdcan1, &header, (uint8_t *)frame->data) != HAL_OK)
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
        /* Leave INIT: the controller re-joins after 128 x 11 recessive bits. */
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
        stats->txQueued      = s_stats.txQueued;
        stats->txDropped     = s_stats.txDropped;
        stats->rxCount       = s_stats.rxCount;
        stats->busOffCount   = s_stats.busOffCount;
        stats->kernelClockHz = s_stats.kernelClockHz;
    }
}

/* ---------------------------------------------------------------------------
 * HAL callbacks (interrupt context, FDCAN1_IT0)
 * ------------------------------------------------------------------------- */
void HAL_FDCAN_RxFifo0Callback(FDCAN_HandleTypeDef *hfdcan, uint32_t RxFifo0ITs)
{
    FDCAN_RxHeaderTypeDef header;
    CanDrv_Frame_t        frame;
    uint32_t              dlc;

    if ((RxFifo0ITs & FDCAN_IT_RX_FIFO0_NEW_MESSAGE) == 0U)
    {
        return;
    }

    while (HAL_FDCAN_GetRxFifoFillLevel(hfdcan, FDCAN_RX_FIFO0) > 0U)
    {
        if (HAL_FDCAN_GetRxMessage(hfdcan, FDCAN_RX_FIFO0, &header, frame.data) != HAL_OK)
        {
            break;
        }

        dlc       = header.DataLength >> DLC_SHIFT;
        frame.id  = (uint16_t)header.Identifier;
        frame.dlc = (dlc > CANDRV_MAX_DLC) ? (uint8_t)CANDRV_MAX_DLC : (uint8_t)dlc;
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
