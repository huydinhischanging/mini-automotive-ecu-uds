/**
 * @file    sensor_app.h
 * @brief   Sensor ECU application: sample the pedal/speed potentiometer and
 *          publish it on CAN (0x100 every 10 ms, 0x101 every 100 ms).
 */
#ifndef SENSOR_APP_H
#define SENSOR_APP_H

#include <stdbool.h>
#include <stdint.h>

/** @return false if a driver failed to initialise (caller should stop). */
bool SensorApp_Init(void);

/** Call exactly once every 10 ms from the main loop (not from an ISR). */
void SensorApp_Task10ms(void);

/** Speed currently published on 0x100 (0.1 km/h), for the tester display. */
uint16_t SensorApp_GetSpeedX10(void);

#endif /* SENSOR_APP_H */
