/**
 * @file    uds_server.c
 * @brief   ISO 14229-1 server, see uds_server.h.
 */
#include "uds_server.h"

#include <stddef.h>

#include "dtc_manager.h"

#define SPRMIB                  (0x80U)     /* suppressPosRspMsgIndicationBit */
#define SUBFUNCTION_MASK        (0x7FU)
#define DTC_GROUP_ALL           (0xFFFFFFUL)
#define DTC_FORMAT_ISO14229_1   (0x01U)
#define DTC_RECORD_LEN          (4U)

#define RESET_NONE              (0x00U)
#define RESET_HARD              (0x01U)
#define RESET_SOFT              (0x03U)

static Uds_Config_t s_cfg;
static uint8_t      s_session = UDS_SESSION_DEFAULT;
static uint32_t     s_lastRequestMs = 0U;
static uint8_t      s_pendingReset = RESET_NONE;

typedef struct
{
    const uint8_t *req;
    uint16_t       reqLen;
    uint8_t       *resp;
    uint16_t       respMax;
    uint16_t       respLen;
    bool           suppressPositive;
} Ctx_t;

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
static uint16_t Negative(Ctx_t *c, uint8_t nrc)
{
    if (c->respMax < 3U)
    {
        return 0U;
    }
    c->resp[0] = UDS_SID_NEGATIVE_RESPONSE;
    c->resp[1] = c->req[0];
    c->resp[2] = nrc;
    return 3U;
}

static bool Put(Ctx_t *c, uint8_t byte)
{
    if (c->respLen >= c->respMax)
    {
        return false;
    }
    c->resp[c->respLen] = byte;
    c->respLen++;
    return true;
}

static const Uds_Did_t *FindDid(uint16_t id)
{
    for (uint8_t i = 0U; i < s_cfg.didCount; i++)
    {
        if (s_cfg.dids[i].id == id)
        {
            return &s_cfg.dids[i];
        }
    }
    return NULL;
}

/* ---------------------------------------------------------------------------
 * Services. Each returns 0 for a positive response (built in c->resp) or an NRC.
 * ------------------------------------------------------------------------- */
static uint8_t SessionControl(Ctx_t *c)
{
    uint8_t session;

    if (c->reqLen != 2U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    session = (uint8_t)(c->req[1] & SUBFUNCTION_MASK);
    if ((session != UDS_SESSION_DEFAULT) && (session != UDS_SESSION_EXTENDED))
    {
        return UDS_NRC_SUBFUNCTION_NOT_SUPPORTED;
    }

    s_session = session;
    c->suppressPositive = ((c->req[1] & SPRMIB) != 0U);
    (void)Put(c, (uint8_t)(UDS_SID_DIAG_SESSION_CONTROL + UDS_POSITIVE_OFFSET));
    (void)Put(c, session);
    /* sessionParameterRecord: P2 in 1 ms, P2* in 10 ms resolution */
    (void)Put(c, (uint8_t)((uint16_t)UDS_P2_SERVER_MS >> 8U));
    (void)Put(c, (uint8_t)((uint16_t)UDS_P2_SERVER_MS & 0xFFU));
    (void)Put(c, (uint8_t)((uint16_t)(UDS_P2STAR_SERVER_MS / 10U) >> 8U));
    (void)Put(c, (uint8_t)((uint16_t)(UDS_P2STAR_SERVER_MS / 10U) & 0xFFU));
    return 0U;
}

static uint8_t EcuReset(Ctx_t *c)
{
    uint8_t type;

    if (c->reqLen != 2U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    type = (uint8_t)(c->req[1] & SUBFUNCTION_MASK);
    if ((type != RESET_HARD) && (type != RESET_SOFT))
    {
        return UDS_NRC_SUBFUNCTION_NOT_SUPPORTED;
    }
    /* Design choice of this ECU: resets only from the extended session. */
    if (s_session != UDS_SESSION_EXTENDED)
    {
        return UDS_NRC_SUBFUNC_NOT_SUPP_IN_SESSION;
    }

    s_pendingReset = type;   /* executed after the response is on the bus */
    c->suppressPositive = ((c->req[1] & SPRMIB) != 0U);
    (void)Put(c, (uint8_t)(UDS_SID_ECU_RESET + UDS_POSITIVE_OFFSET));
    (void)Put(c, type);
    return 0U;
}

static uint8_t ClearDtc(Ctx_t *c)
{
    uint32_t group;

    if (c->reqLen != 4U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    group = ((uint32_t)c->req[1] << 16U) | ((uint32_t)c->req[2] << 8U) | c->req[3];
    if (group != DTC_GROUP_ALL)
    {
        return UDS_NRC_REQUEST_OUT_OF_RANGE;
    }

    DtcMgr_ClearAll();
    (void)Put(c, (uint8_t)(UDS_SID_CLEAR_DTC + UDS_POSITIVE_OFFSET));
    return 0U;
}

static uint8_t ReadDtc(Ctx_t *c)
{
    uint8_t subFunction;
    uint8_t mask;

    if (c->reqLen < 2U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    subFunction = (uint8_t)(c->req[1] & SUBFUNCTION_MASK);
    if ((subFunction != 0x01U) && (subFunction != 0x02U))
    {
        return UDS_NRC_SUBFUNCTION_NOT_SUPPORTED;
    }
    if (c->reqLen != 3U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    mask = c->req[2];

    (void)Put(c, (uint8_t)(UDS_SID_READ_DTC + UDS_POSITIVE_OFFSET));
    (void)Put(c, subFunction);
    (void)Put(c, DTC_STATUS_AVAILABILITY_MASK);

    if (subFunction == 0x01U)
    {
        uint16_t count = DtcMgr_CountByStatusMask(mask);
        (void)Put(c, DTC_FORMAT_ISO14229_1);
        (void)Put(c, (uint8_t)(count >> 8U));
        (void)Put(c, (uint8_t)(count & 0xFFU));
    }
    else
    {
        uint16_t room = (uint16_t)((c->respMax - c->respLen) / DTC_RECORD_LEN);
        uint8_t  maxRecords = (room > 0xFFU) ? 0xFFU : (uint8_t)room;
        uint8_t  n;

        if (DtcMgr_CountByStatusMask(mask) > maxRecords)
        {
            return UDS_NRC_RESPONSE_TOO_LONG;
        }
        n = DtcMgr_GetByStatusMask(mask, &c->resp[c->respLen], maxRecords);
        c->respLen = (uint16_t)(c->respLen + ((uint16_t)n * DTC_RECORD_LEN));
    }
    return 0U;
}

static uint8_t ReadDid(Ctx_t *c)
{
    uint16_t nDids;
    bool     anyFound = false;

    if ((c->reqLen < 3U) || (((c->reqLen - 1U) % 2U) != 0U))
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    nDids = (uint16_t)((c->reqLen - 1U) / 2U);

    (void)Put(c, (uint8_t)(UDS_SID_READ_DID + UDS_POSITIVE_OFFSET));
    for (uint16_t i = 0U; i < nDids; i++)
    {
        uint16_t id = (uint16_t)(((uint16_t)c->req[1U + (2U * i)] << 8U) | c->req[2U + (2U * i)]);
        const Uds_Did_t *did = FindDid(id);

        if (did == NULL)
        {
            continue;   /* unknown DIDs are skipped; NRC only if none is known */
        }
        if (((uint32_t)c->respLen + 2U + did->length) > c->respMax)
        {
            return UDS_NRC_RESPONSE_TOO_LONG;
        }
        (void)Put(c, (uint8_t)(id >> 8U));
        (void)Put(c, (uint8_t)(id & 0xFFU));
        did->read(&c->resp[c->respLen]);
        c->respLen = (uint16_t)(c->respLen + did->length);
        anyFound = true;
    }
    return anyFound ? 0U : UDS_NRC_REQUEST_OUT_OF_RANGE;
}

static uint8_t TesterPresent(Ctx_t *c)
{
    if (c->reqLen != 2U)
    {
        return UDS_NRC_INCORRECT_LENGTH;
    }
    if ((c->req[1] & SUBFUNCTION_MASK) != 0x00U)
    {
        return UDS_NRC_SUBFUNCTION_NOT_SUPPORTED;
    }
    c->suppressPositive = ((c->req[1] & SPRMIB) != 0U);
    (void)Put(c, (uint8_t)(UDS_SID_TESTER_PRESENT + UDS_POSITIVE_OFFSET));
    (void)Put(c, 0x00U);
    return 0U;
}

static bool IsSuppressedForFunctional(uint8_t nrc)
{
    return (nrc == UDS_NRC_SERVICE_NOT_SUPPORTED) ||
           (nrc == UDS_NRC_SUBFUNCTION_NOT_SUPPORTED) ||
           (nrc == UDS_NRC_REQUEST_OUT_OF_RANGE) ||
           (nrc == UDS_NRC_SUBFUNC_NOT_SUPP_IN_SESSION) ||
           (nrc == UDS_NRC_SERVICE_NOT_SUPP_IN_SESSION);
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */
void Uds_Init(const Uds_Config_t *cfg)
{
    if (cfg != NULL)
    {
        s_cfg = *cfg;
    }
    s_session      = UDS_SESSION_DEFAULT;
    s_pendingReset = RESET_NONE;
    s_lastRequestMs = (s_cfg.getTimeMs != NULL) ? s_cfg.getTimeMs() : 0U;
}

uint16_t Uds_ProcessRequest(const uint8_t *req, uint16_t reqLen, bool functional,
                            uint8_t *resp, uint16_t respMax)
{
    Ctx_t   c;
    uint8_t nrc;

    if ((req == NULL) || (resp == NULL) || (reqLen == 0U))
    {
        return 0U;
    }

    c.req = req;
    c.reqLen = reqLen;
    c.resp = resp;
    c.respMax = respMax;
    c.respLen = 0U;
    c.suppressPositive = false;

    /* Any request keeps a non-default session alive (S3 timer). */
    s_lastRequestMs = (s_cfg.getTimeMs != NULL) ? s_cfg.getTimeMs() : 0U;

    switch (req[0])
    {
        case UDS_SID_DIAG_SESSION_CONTROL: nrc = SessionControl(&c); break;
        case UDS_SID_ECU_RESET:            nrc = EcuReset(&c);       break;
        case UDS_SID_CLEAR_DTC:            nrc = ClearDtc(&c);       break;
        case UDS_SID_READ_DTC:             nrc = ReadDtc(&c);        break;
        case UDS_SID_READ_DID:             nrc = ReadDid(&c);        break;
        case UDS_SID_TESTER_PRESENT:       nrc = TesterPresent(&c);  break;
        default:                           nrc = UDS_NRC_SERVICE_NOT_SUPPORTED; break;
    }

    if (nrc != 0U)
    {
        if (functional && IsSuppressedForFunctional(nrc))
        {
            return 0U;
        }
        return Negative(&c, nrc);
    }
    return c.suppressPositive ? 0U : c.respLen;
}

void Uds_MainFunction(void)
{
    uint32_t now;

    if ((s_session == UDS_SESSION_DEFAULT) || (s_cfg.getTimeMs == NULL))
    {
        return;
    }
    now = s_cfg.getTimeMs();
    if ((uint32_t)(now - s_lastRequestMs) >= UDS_S3_SERVER_MS)
    {
        s_session = UDS_SESSION_DEFAULT;   /* tester gone: fall back to default */
    }
}

uint8_t Uds_GetSession(void)
{
    return s_session;
}

void Uds_ExecutePendingReset(void)
{
    uint8_t type = s_pendingReset;

    if (type == RESET_NONE)
    {
        return;
    }
    s_pendingReset = RESET_NONE;
    s_session      = UDS_SESSION_DEFAULT;
    if (s_cfg.ecuReset != NULL)
    {
        s_cfg.ecuReset(type);
    }
}
