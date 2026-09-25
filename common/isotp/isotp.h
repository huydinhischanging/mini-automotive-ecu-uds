/**
 * @file    isotp.h
 * @brief   ISO 15765-2 (ISO-TP) transport layer for Classic CAN, normal addressing.
 *
 * Splits messages of up to 4095 bytes into 8-byte CAN frames and reassembles them:
 *
 *   SF  Single Frame       [0x0L] + up to 7 data bytes          (L = length 1..7)
 *   FF  First Frame        [0x1L LL] + 6 data bytes              (12-bit length 8..4095)
 *   CF  Consecutive Frame  [0x2N] + 7 data bytes                 (N = sequence 0..15)
 *   FC  Flow Control       [0x3S BS STmin]                       (S: 0 CTS, 1 WAIT, 2 OVFLW)
 *
 * Hardware independent: the CAN driver and the clock are injected through
 * IsoTp_Config_t, so the same code runs on the MCU and in host unit tests.
 *
 * Threading: IsoTp_RxFrame(), IsoTp_Transmit() and IsoTp_MainFunction() of one
 * link must be called from the same context (one task, or main loop). They are
 * not re-entrant.
 */
#ifndef ISOTP_H
#define ISOTP_H

#include <stdbool.h>
#include <stdint.h>

#define ISOTP_CAN_DL            (8U)        /* Classic CAN frame size, always padded */
#define ISOTP_PADDING_BYTE      (0xCCU)
#define ISOTP_MAX_MESSAGE_LEN   (4095U)     /* 12-bit FF_DL */

#define ISOTP_DEFAULT_N_BS_MS   (1000U)     /* sender waits this long for FC */
#define ISOTP_DEFAULT_N_CR_MS   (1000U)     /* receiver waits this long for next CF */
#define ISOTP_MAX_WFT           (10U)       /* max consecutive FC.WAIT accepted */

typedef enum
{
    ISOTP_OK = 0,
    ISOTP_ERR_BUSY,             /* a transmission is already in progress */
    ISOTP_ERR_PARAM,            /* NULL pointer or length 0 / too long */
    ISOTP_ERR_TIMEOUT_BS,       /* N_Bs: no Flow Control from the receiver */
    ISOTP_ERR_TIMEOUT_CR,       /* N_Cr: no Consecutive Frame from the sender */
    ISOTP_ERR_WRONG_SN,         /* CF sequence number out of order */
    ISOTP_ERR_OVERFLOW,         /* peer's buffer (FC.OVFLW) or ours is too small */
    ISOTP_ERR_WFT_OVRN,         /* peer sent too many FC.WAIT */
    ISOTP_ERR_UNEXP_PDU,        /* new SF/FF interrupted an ongoing reception */
    ISOTP_ERR_INVALID_FS        /* FC with reserved flow status */
} IsoTp_Result_t;

/** Send one CAN frame (always 8 bytes). @return false if the driver is busy (retried later). */
typedef bool (*IsoTp_SendFrameFn)(void *ctx, uint16_t canId, const uint8_t *data, uint8_t dlc);

/** Monotonic millisecond clock (wrap-around safe). */
typedef uint32_t (*IsoTp_GetTimeMsFn)(void);

/** A complete message was received (result == ISOTP_OK) or a reception failed.
 *  @p data is only valid during the call - copy it if needed. */
typedef void (*IsoTp_RxIndicationFn)(void *ctx, const uint8_t *data, uint16_t length,
                                     IsoTp_Result_t result);

/** The message passed to IsoTp_Transmit() was fully sent, or sending failed. */
typedef void (*IsoTp_TxConfirmationFn)(void *ctx, IsoTp_Result_t result);

typedef struct
{
    uint16_t txId;              /* CAN ID we send on (e.g. 0x7E8 for an ECU) */
    uint16_t rxId;              /* CAN ID we listen to (e.g. 0x7E0) - filtering is the caller's job */

    uint8_t  *rxBuffer;
    uint16_t  rxBufferSize;
    uint8_t  *txBuffer;
    uint16_t  txBufferSize;

    uint8_t  blockSize;         /* BS we announce in our FC: CFs per block, 0 = no limit */
    uint8_t  stMin;             /* STmin we announce in our FC (raw ISO encoding) */
    uint16_t nBsTimeoutMs;
    uint16_t nCrTimeoutMs;

    IsoTp_SendFrameFn      sendFrame;
    IsoTp_GetTimeMsFn      getTimeMs;
    IsoTp_RxIndicationFn   rxIndication;    /* may be NULL */
    IsoTp_TxConfirmationFn txConfirmation;  /* may be NULL */
    void                  *ctx;             /* passed back to all callbacks */
} IsoTp_Config_t;

typedef enum
{
    ISOTP_TX_IDLE = 0,
    ISOTP_TX_SEND_FIRST,        /* SF/FF not accepted by the driver yet */
    ISOTP_TX_WAIT_FC,
    ISOTP_TX_SEND_CF
} IsoTp_TxState_t;

typedef enum
{
    ISOTP_RX_IDLE = 0,
    ISOTP_RX_RECEIVING
} IsoTp_RxState_t;

/** Runtime state of one ISO-TP connection. Treat as opaque. */
typedef struct
{
    IsoTp_Config_t cfg;

    /* sender side */
    IsoTp_TxState_t txState;
    uint16_t txLength;
    uint16_t txOffset;
    uint8_t  txSeq;
    uint8_t  txBlockSize;       /* BS received from the peer */
    uint8_t  txBlockCount;      /* CFs sent in the current block */
    uint32_t txStMinMs;         /* STmin received from the peer, in ms */
    uint32_t txTimerStart;
    uint32_t txLastCfTime;
    uint8_t  txWaitCount;

    /* receiver side */
    IsoTp_RxState_t rxState;
    uint16_t rxLength;
    uint16_t rxOffset;
    uint8_t  rxSeq;
    uint8_t  rxBlockCount;
    uint32_t rxTimerStart;
    bool     rxFcPending;       /* FC could not be sent yet, retry in MainFunction */
    uint8_t  rxFcStatus;
} IsoTp_Link_t;

void IsoTp_Init(IsoTp_Link_t *link, const IsoTp_Config_t *cfg);

/** Queue a message for sending. The data is copied into cfg.txBuffer. */
IsoTp_Result_t IsoTp_Transmit(IsoTp_Link_t *link, const uint8_t *data, uint16_t length);

/** Feed a CAN frame received on cfg.rxId. */
void IsoTp_RxFrame(IsoTp_Link_t *link, const uint8_t *data, uint8_t dlc);

/** Drive timers and send pending CFs/FCs. Call periodically (every 1 ms ideally). */
void IsoTp_MainFunction(IsoTp_Link_t *link);

bool IsoTp_IsTxBusy(const IsoTp_Link_t *link);

#endif /* ISOTP_H */
