/**
 * @file    can_matrix.h
 * @brief   CAN matrix of the Mini ECU network (IDs, cycle times, signal layout).
 *
 * Shared contract between all nodes: the Sensor ECU and the Control ECU both
 * compile against this file, so the frame layout can never drift apart.
 * Byte 6/7 of cyclic frames (alive counter, CRC) are handled by common/e2e.
 */
#ifndef CAN_MATRIX_H
#define CAN_MATRIX_H

/* ---------------------------------------------------------------------------
 * 0x100 SENSOR_SPEED   Sensor ECU -> bus   DLC 8   cycle 10 ms
 *   byte 0-1 : VehicleSpeed  0.1 km/h/bit, big-endian, valid 0..2500
 *   byte 2-3 : AdcRaw        12-bit raw value, big-endian (debug)
 *   byte 4   : Status        bit0 = fault injection active, bit1 = ADC read error
 *   byte 5   : reserved (0)
 *   byte 6   : AliveCounter  0..15, +1 every frame
 *   byte 7   : CRC8 SAE-J1850 over bytes 0..6
 * ------------------------------------------------------------------------- */
#define CANID_SENSOR_SPEED          (0x100U)
#define SENSOR_SPEED_DLC            (8U)
#define SENSOR_SPEED_CYCLE_MS       (10U)
#define SENSOR_SPEED_MAX_X10        (2500U)     /* 250.0 km/h */
#define SENSOR_STATUS_FAULT_INJ     (0x01U)
#define SENSOR_STATUS_ADC_ERROR     (0x02U)

/* ---------------------------------------------------------------------------
 * 0x101 SENSOR_ALIVE   Sensor ECU -> bus   DLC 8   cycle 100 ms
 *   byte 0   : NodeState     0 = normal, 1 = fault injection
 *   byte 1-4 : Uptime        seconds, big-endian
 *   byte 5   : BusOffCount   saturates at 255
 *   byte 6   : AliveCounter  0..15, +1 every frame
 *   byte 7   : CRC8 SAE-J1850 over bytes 0..6
 * ------------------------------------------------------------------------- */
#define CANID_SENSOR_ALIVE          (0x101U)
#define SENSOR_ALIVE_DLC            (8U)
#define SENSOR_ALIVE_CYCLE_MS       (100U)

/* ---------------------------------------------------------------------------
 * UDS diagnostics (ISO 14229 over ISO 15765-2), physical addressing
 * ------------------------------------------------------------------------- */
#define CANID_UDS_REQ_CONTROL       (0x7E0U)    /* Tester -> Control ECU */
#define CANID_UDS_RESP_CONTROL      (0x7E8U)    /* Control ECU -> Tester */

/* Timeout after which the Control ECU treats 0x100 as lost (10 missed cycles). */
#define SENSOR_SPEED_TIMEOUT_MS     (100U)

#endif /* CAN_MATRIX_H */
