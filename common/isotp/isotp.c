/**
 * @file    isotp.c
 * @brief   ISO 15765-2 transport layer, see isotp.h.
 */
#include "isotp.h"

#include <string.h>

#define PCI_TYPE_SF         (0x0U)
#define PCI_TYPE_FF         (0x1U)
#define PCI_TYPE_CF         (0x2U)
#define PCI_TYPE_FC         (0x3U)

#define FC_STATUS_CTS       (0x0U)
#define FC_STATUS_WAIT      (0x1U)
#define FC_STATUS_OVFLW     (0x2U)

#define SF_MAX_DATA         (7U)
#define FF_DATA             (6U)
#define CF_MAX_DATA         (7U)
#define SEQ_MASK            (0x0FU)

#define STMIN_MAX_MS        (0x7FU)
#define STMIN_US_FIRST      (0xF1U)
#define STMIN_US_LAST       (0xF9U)

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
static uint32_t Now(const IsoTp_Link_t *link)
{
    return link->cfg.getTimeMs();
}

/* Unsigned subtraction stays correct when the ms counter wraps at 2^32. */
static uint32_t Elapsed(const IsoTp_Link_t *link, uint32_t start)
{
    return (uint32_t)(Now(link) - start);
}

static bool SendFrame(IsoTp_Link_t *link, const uint8_t *frame)
{
    return link->cfg.sendFrame(link->cfg.ctx, link->cfg.txId, frame, (uint8_t)ISOTP_CAN_DL);
}

static void InitFrame(uint8_t *frame)
{
    (void)memset(frame, (int)ISOTP_PADDING_BYTE, ISOTP_CAN_DL);
}

/* STmin encoding (ISO 15765-2 table 20):
 *   0x00-0x7F : 0..127 ms
 *   0xF1-0xF9 : 100..900 us -> rounded up to 1 ms (our timer resolution)
 *   reserved  : treat as the maximum, 127 ms */
static uint32_t DecodeStMin(uint8_t raw)
{
    if (raw <= STMIN_MAX_MS)
    {
        return raw;
    }
    if ((raw >= STMIN_US_FIRST) && (raw <= STMIN_US_LAST))
    {
        return 1U;
    }
    return STMIN_MAX_MS;
}

/* ---------------------------------------------------------------------------
 * Sender side
 * ------------------------------------------------------------------------- */
static void TxFinish(IsoTp_Link_t *link, IsoTp_Result_t result)
{
    link->txState = ISOTP_TX_IDLE;
    if (link->cfg.txConfirmation != NULL)
    {
        link->cfg.txConfirmation(link->cfg.ctx, result);
    }
}

/* Send the SF or FF. @return true if the driver accepted it. */
static bool TxSendFirst(IsoTp_Link_t *link)
{
    uint8_t frame[ISOTP_CAN_DL];

    InitFrame(frame);

    if (link->txLength <= SF_MAX_DATA)
    {
        frame[0] = (uint8_t)((PCI_TYPE_SF << 4U) | link->txLength);
        (void)memcpy(&frame[1], link->cfg.txBuffer, link->txLength);
        if (!SendFrame(link, frame))
        {
            return false;
        }
        TxFinish(link, ISOTP_OK);
        return true;
    }

    frame[0] = (uint8_t)((PCI_TYPE_FF << 4U) | ((link->txLength >> 8U) & 0x0FU));
    frame[1] = (uint8_t)(link->txLength & 0xFFU);
    (void)memcpy(&frame[2], link->cfg.txBuffer, FF_DATA);
    if (!SendFrame(link, frame))
    {
        return false;
    }

    link->txOffset     = FF_DATA;
    link->txSeq        = 1U;
    link->txWaitCount  = 0U;
    link->txState      = ISOTP_TX_WAIT_FC;
    link->txTimerStart = Now(link);
    return true;
}

static void TxSendConsecutiveFrames(IsoTp_Link_t *link)
{
    bool keepSending = true;

    while (keepSending && (link->txState == ISOTP_TX_SEND_CF))
    {
        uint8_t  frame[ISOTP_CAN_DL];
        uint16_t remaining = (uint16_t)(link->txLength - link->txOffset);
        uint16_t chunk = (remaining > CF_MAX_DATA) ? (uint16_t)CF_MAX_DATA : remaining;

        /* With a 1 ms clock, "elapsed >= STmin" could fire after only a fraction of
         * a ms (sent at x.99, checked at x+1.00). Waiting one extra tick guarantees
         * the receiver always gets at least STmin between frames. */
        if ((link->txStMinMs > 0U) && (Elapsed(link, link->txLastCfTime) <= link->txStMinMs))
        {
            keepSending = false;
            continue;
        }

        InitFrame(frame);
        frame[0] = (uint8_t)((PCI_TYPE_CF << 4U) | link->txSeq);
        (void)memcpy(&frame[1], &link->cfg.txBuffer[link->txOffset], chunk);
        if (!SendFrame(link, frame))
        {
            keepSending = false;   /* driver busy, try again next MainFunction */
            continue;
        }

        link->txOffset     = (uint16_t)(link->txOffset + chunk);
        link->txSeq        = (uint8_t)((link->txSeq + 1U) & SEQ_MASK);
        link->txLastCfTime = Now(link);

        if (link->txOffset >= link->txLength)
        {
            TxFinish(link, ISOTP_OK);
        }
        else if (link->txBlockSize != 0U)
        {
            link->txBlockCount++;
            if (link->txBlockCount >= link->txBlockSize)
            {
                link->txState      = ISOTP_TX_WAIT_FC;
                link->txTimerStart = Now(link);
            }
        }
        else
        {
            /* BS = 0: keep sending until STmin or the driver stops us */
        }
    }
}

static void TxOnFlowControl(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc)
{
    uint8_t status;

    if ((link->txState != ISOTP_TX_WAIT_FC) || (dlc < 3U))
    {
        return;   /* unexpected FC is ignored, as required by the standard */
    }

    status = (uint8_t)(data[0] & 0x0FU);

    if (status == FC_STATUS_CTS)
    {
        link->txBlockSize  = data[1];
        link->txBlockCount = 0U;
        link->txWaitCount  = 0U;
        link->txStMinMs    = DecodeStMin(data[2]);
        /* First CF of a block may go out immediately. */
        link->txLastCfTime = Now(link) - (link->txStMinMs + 1U);
        link->txState      = ISOTP_TX_SEND_CF;
        TxSendConsecutiveFrames(link);
    }
    else if (status == FC_STATUS_WAIT)
    {
        link->txWaitCount++;
        if (link->txWaitCount > ISOTP_MAX_WFT)
        {
            TxFinish(link, ISOTP_ERR_WFT_OVRN);
        }
        else
        {
            link->txTimerStart = Now(link);   /* receiver asked for more time */
        }
    }
    else if (status == FC_STATUS_OVFLW)
    {
        TxFinish(link, ISOTP_ERR_OVERFLOW);
    }
    else
    {
        TxFinish(link, ISOTP_ERR_INVALID_FS);
    }
}

/* ---------------------------------------------------------------------------
 * Receiver side
 * ------------------------------------------------------------------------- */
static void RxFinish(IsoTp_Link_t *link, IsoTp_Result_t result)
{
    uint16_t length = (result == ISOTP_OK) ? link->rxLength : link->rxOffset;

    link->rxState = ISOTP_RX_IDLE;
    if (link->cfg.rxIndication != NULL)
    {
        link->cfg.rxIndication(link->cfg.ctx, link->cfg.rxBuffer, length, result);
    }
}

static void RxSendFlowControl(IsoTp_Link_t *link, uint8_t status)
{
    uint8_t frame[ISOTP_CAN_DL];

    InitFrame(frame);
    frame[0] = (uint8_t)((PCI_TYPE_FC << 4U) | status);
    frame[1] = link->cfg.blockSize;
    frame[2] = link->cfg.stMin;

    if (SendFrame(link, frame))
    {
        link->rxFcPending = false;
    }
    else
    {
        link->rxFcPending = true;
        link->rxFcStatus  = status;
    }
}

static void RxOnSingleFrame(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc)
{
    uint8_t length = (uint8_t)(data[0] & 0x0FU);

    if ((length == 0U) || (length > SF_MAX_DATA) || (length > (uint8_t)(dlc - 1U)) ||
        (length > link->cfg.rxBufferSize))
    {
        return;   /* malformed SF */
    }

    if (link->rxState == ISOTP_RX_RECEIVING)
    {
        RxFinish(link, ISOTP_ERR_UNEXP_PDU);   /* old message is lost */
    }

    (void)memcpy(link->cfg.rxBuffer, &data[1], length);
    link->rxLength = length;
    RxFinish(link, ISOTP_OK);
}

static void RxOnFirstFrame(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc)
{
    uint16_t length = (uint16_t)((((uint16_t)data[0] & 0x0FU) << 8U) | data[1]);

    if ((dlc < ISOTP_CAN_DL) || (length <= SF_MAX_DATA))
    {
        return;   /* FF must be a full frame and carry more than an SF could */
    }

    if (link->rxState == ISOTP_RX_RECEIVING)
    {
        RxFinish(link, ISOTP_ERR_UNEXP_PDU);
    }

    if (length > link->cfg.rxBufferSize)
    {
        RxSendFlowControl(link, FC_STATUS_OVFLW);
        return;
    }

    (void)memcpy(link->cfg.rxBuffer, &data[2], FF_DATA);
    link->rxLength     = length;
    link->rxOffset     = FF_DATA;
    link->rxSeq        = 1U;
    link->rxBlockCount = 0U;
    link->rxState      = ISOTP_RX_RECEIVING;
    link->rxTimerStart = Now(link);
    RxSendFlowControl(link, FC_STATUS_CTS);
}

static void RxOnConsecutiveFrame(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc)
{
    uint16_t remaining;
    uint16_t chunk;

    if (link->rxState != ISOTP_RX_RECEIVING)
    {
        return;   /* CF without FF: ignore */
    }

    if ((data[0] & SEQ_MASK) != link->rxSeq)
    {
        RxFinish(link, ISOTP_ERR_WRONG_SN);
        return;
    }

    remaining = (uint16_t)(link->rxLength - link->rxOffset);
    chunk     = (remaining > CF_MAX_DATA) ? (uint16_t)CF_MAX_DATA : remaining;
    if (chunk > ((uint16_t)dlc - 1U))
    {
        return;   /* frame too short for the data it should carry */
    }

    (void)memcpy(&link->cfg.rxBuffer[link->rxOffset], &data[1], chunk);
    link->rxOffset     = (uint16_t)(link->rxOffset + chunk);
    link->rxSeq        = (uint8_t)((link->rxSeq + 1U) & SEQ_MASK);
    link->rxTimerStart = Now(link);

    if (link->rxOffset >= link->rxLength)
    {
        RxFinish(link, ISOTP_OK);
    }
    else if (link->cfg.blockSize != 0U)
    {
        link->rxBlockCount++;
        if (link->rxBlockCount >= link->cfg.blockSize)
        {
            link->rxBlockCount = 0U;
            RxSendFlowControl(link, FC_STATUS_CTS);   /* allow the next block */
        }
    }
    else
    {
        /* BS = 0: sender continues without further FC */
    }
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
void IsoTp_Init(IsoTp_Link_t *link, const IsoTp_Config_t *cfg)
{
    if ((link == NULL) || (cfg == NULL))
    {
        return;
    }

    (void)memset(link, 0, sizeof(*link));
    link->cfg = *cfg;

    if (link->cfg.nBsTimeoutMs == 0U)
    {
        link->cfg.nBsTimeoutMs = ISOTP_DEFAULT_N_BS_MS;
    }
    if (link->cfg.nCrTimeoutMs == 0U)
    {
        link->cfg.nCrTimeoutMs = ISOTP_DEFAULT_N_CR_MS;
    }
}

IsoTp_Result_t IsoTp_Transmit(IsoTp_Link_t *link, const uint8_t *data, uint16_t length)
{
    if ((link == NULL) || (data == NULL) || (length == 0U) ||
        (length > ISOTP_MAX_MESSAGE_LEN) || (length > link->cfg.txBufferSize))
    {
        return ISOTP_ERR_PARAM;
    }
    if (link->txState != ISOTP_TX_IDLE)
    {
        return ISOTP_ERR_BUSY;
    }

    (void)memcpy(link->cfg.txBuffer, data, length);
    link->txLength     = length;
    link->txOffset     = 0U;
    link->txState      = ISOTP_TX_SEND_FIRST;
    link->txTimerStart = Now(link);

    (void)TxSendFirst(link);   /* if the driver is busy, MainFunction retries */
    return ISOTP_OK;
}

void IsoTp_RxFrame(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc)
{
    if ((link == NULL) || (data == NULL) || (dlc == 0U) || (dlc > ISOTP_CAN_DL))
    {
        return;
    }

    switch (data[0] >> 4U)
    {
        case PCI_TYPE_SF:
            RxOnSingleFrame(link, data, dlc);
            break;
        case PCI_TYPE_FF:
            RxOnFirstFrame(link, data, dlc);
            break;
        case PCI_TYPE_CF:
            RxOnConsecutiveFrame(link, data, dlc);
            break;
        case PCI_TYPE_FC:
            TxOnFlowControl(link, data, dlc);
            break;
        default:
            break;   /* reserved PCI type: ignore */
    }
}

void IsoTp_MainFunction(IsoTp_Link_t *link)
{
    if (link == NULL)
    {
        return;
    }

    /* receiver */
    if (link->rxFcPending)
    {
        RxSendFlowControl(link, link->rxFcStatus);
    }
    if ((link->rxState == ISOTP_RX_RECEIVING) &&
        (Elapsed(link, link->rxTimerStart) >= link->cfg.nCrTimeoutMs))
    {
        RxFinish(link, ISOTP_ERR_TIMEOUT_CR);
    }

    /* sender */
    switch (link->txState)
    {
        case ISOTP_TX_SEND_FIRST:
            if (!TxSendFirst(link) &&
                (Elapsed(link, link->txTimerStart) >= link->cfg.nBsTimeoutMs))
            {
                TxFinish(link, ISOTP_ERR_TIMEOUT_BS);
            }
            break;
        case ISOTP_TX_WAIT_FC:
            if (Elapsed(link, link->txTimerStart) >= link->cfg.nBsTimeoutMs)
            {
                TxFinish(link, ISOTP_ERR_TIMEOUT_BS);
            }
            break;
        case ISOTP_TX_SEND_CF:
            TxSendConsecutiveFrames(link);
            break;
        case ISOTP_TX_IDLE:
        default:
            break;
    }
}

bool IsoTp_IsTxBusy(const IsoTp_Link_t *link)
{
    return (link != NULL) && (link->txState != ISOTP_TX_IDLE);
}
