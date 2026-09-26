/**
 * @file    uds_server.h
 * @brief   ISO 14229-1 (UDS) server - application layer, hardware independent.
 *
 * Supported services
 *   0x10 DiagnosticSessionControl   01 default, 03 extended
 *   0x11 ECUReset                   01 hard, 03 soft   (extended session only)
 *   0x14 ClearDiagnosticInformation group 0xFFFFFF (all DTCs)
 *   0x19 ReadDTCInformation         01 number of DTCs by mask, 02 DTCs by mask
 *   0x22 ReadDataByIdentifier       one or more DIDs from the configured table
 *   0x3E TesterPresent              00
 *
 * Negative responses: 7F <SID> <NRC> with NRC 0x11, 0x12, 0x13, 0x31, 0x7E, 0x7F.
 * For functionally addressed requests (0x7DF) NRC 0x11/0x12/0x31/0x7E/0x7F are
 * suppressed, and the suppressPosRspMsgIndicationBit (0x80 in the sub-function)
 * is honoured for 0x10, 0x11 and 0x3E, as required by the standard.
 *
 * The transport (ISO-TP) is not part of this module: the caller passes a
 * complete request and sends back the returned response.
 */
#ifndef UDS_SERVER_H
#define UDS_SERVER_H

#include <stdbool.h>
#include <stdint.h>

#define UDS_SID_DIAG_SESSION_CONTROL   (0x10U)
#define UDS_SID_ECU_RESET              (0x11U)
#define UDS_SID_CLEAR_DTC              (0x14U)
#define UDS_SID_READ_DTC               (0x19U)
#define UDS_SID_READ_DID               (0x22U)
#define UDS_SID_TESTER_PRESENT         (0x3EU)
#define UDS_SID_NEGATIVE_RESPONSE      (0x7FU)
#define UDS_POSITIVE_OFFSET            (0x40U)

#define UDS_NRC_SERVICE_NOT_SUPPORTED          (0x11U)
#define UDS_NRC_SUBFUNCTION_NOT_SUPPORTED      (0x12U)
#define UDS_NRC_INCORRECT_LENGTH               (0x13U)
#define UDS_NRC_RESPONSE_TOO_LONG              (0x14U)
#define UDS_NRC_REQUEST_OUT_OF_RANGE           (0x31U)
#define UDS_NRC_SUBFUNC_NOT_SUPP_IN_SESSION    (0x7EU)
#define UDS_NRC_SERVICE_NOT_SUPP_IN_SESSION    (0x7FU)

#define UDS_SESSION_DEFAULT            (0x01U)
#define UDS_SESSION_EXTENDED           (0x03U)

#define UDS_P2_SERVER_MS               (50U)     /* reported in 0x50 response */
#define UDS_P2STAR_SERVER_MS           (5000U)
#define UDS_S3_SERVER_MS               (5000U)   /* non-default session timeout */

typedef struct
{
    uint16_t id;
    uint8_t  length;                                /* bytes returned by read() */
    void   (*read)(uint8_t *out);                   /* fills exactly `length` bytes */
} Uds_Did_t;

typedef struct
{
    const Uds_Did_t *dids;
    uint8_t          didCount;
    uint32_t       (*getTimeMs)(void);
    /** Called by Uds_ExecutePendingReset(), i.e. after the response was sent. */
    void           (*ecuReset)(uint8_t resetType);
} Uds_Config_t;

void Uds_Init(const Uds_Config_t *cfg);

/**
 * Process one complete request.
 * @param functional  true if received on the functional address (0x7DF)
 * @return length of the response written to @p resp, 0 = send nothing
 */
uint16_t Uds_ProcessRequest(const uint8_t *req, uint16_t reqLen, bool functional,
                            uint8_t *resp, uint16_t respMax);

/** S3 session timeout. Call periodically. */
void Uds_MainFunction(void);

uint8_t Uds_GetSession(void);

/** Run a reset accepted by 0x11 (call once its response has been transmitted). */
void Uds_ExecutePendingReset(void);

#endif /* UDS_SERVER_H */
