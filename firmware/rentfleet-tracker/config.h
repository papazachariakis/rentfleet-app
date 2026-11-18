#pragma once

#include "secrets.h"

// 0 = Lite WiFi | 1 = Pro LTE (A7670 / SIM7600 μέσω TinyGSM)
#define RF_MODE_WIFI 0
#define RF_MODE_LTE  1
#ifndef RF_NETWORK_MODE
#define RF_NETWORK_MODE RF_MODE_WIFI
#endif

#define RF_FIRMWARE_VERSION "1.0.0-proto"

// Πόσο συχνά στέλνει όταν κινείται / σταματημένο (ms)
#define RF_INTERVAL_MOVING_MS 15000
#define RF_INTERVAL_IDLE_MS   120000

// GPS UART (NEO-6M / M8N) — άλλαξε pins ανά board
#ifndef GPS_RX_PIN
#define GPS_RX_PIN 16
#endif
#ifndef GPS_TX_PIN
#define GPS_TX_PIN 17
#endif
#define GPS_BAUD 9600

// ELM327 UART
#ifndef OBD_RX_PIN
#define OBD_RX_PIN 18
#endif
#ifndef OBD_TX_PIN
#define OBD_TX_PIN 19
#endif
#define OBD_BAUD 38400

// Αν 1: στέλνει mock δεδομένα χωρίς OBD/GPS (δοκιμή API)
#ifndef RF_DEMO_MODE
#define RF_DEMO_MODE 0
#endif
