# ESP32 / OBD2 → RentFleet τηλεμετρία

Υποστήριξη trackers **ESP32** (WiFi ή LTE/4G/5G modem) με OBD2 (ELM327 / CAN / PID).

## 1. Δημιουργία συσκευής στο RentFleet

1. Login → μενού **OBD2 / ESP32** (`/telematics`)
2. Νέο tracker → σύνδεση με όχημα
3. Αντιγραφή του **API key** (`rf_tel_…`) — εμφανίζεται **μία φορά**

## 2. Endpoint

```
POST https://rentfleet-app.vercel.app/api/telematics/ingest
Header: X-Device-Key: rf_tel_xxxxxxxx
Content-Type: application/json
```

Health check: `GET /api/telematics/ingest`

## 3. JSON payload (προτεινόμενο)

```json
{
  "ts": "2026-11-05T16:00:00.000Z",
  "gps": { "lat": 35.3387, "lng": 25.1442, "alt": 42, "hdop": 1.1, "satellites": 9 },
  "speed_kmh": 48.5,
  "fuel_percent": 62,
  "odometer_km": 45210.4,
  "rpm": 2100,
  "coolant_c": 88,
  "battery_v": 13.8,
  "ignition": true,
  "dtcs": ["P0301"],
  "pids": { "throttle": 18, "maf": 4.2, "load": 35 },
  "network": { "type": "LTE", "rssi": -78 },
  "firmware": "1.0.0"
}
```

| Πεδίο | Περιγραφή |
|-------|-----------|
| `gps.lat/lng` | Θέση → ενημερώνει χάρτη οχήματος |
| `speed_kmh` | Ταχύτητα |
| `fuel_percent` ή `fuel_level` | Στάθμη (0–100 ή 0–1) |
| `odometer_km` | Οδόμετρο |
| `rpm`, `coolant_c`, `battery_v` | Κινητήρας / μπαταρία |
| `ignition` | ON/OFF |
| `dtcs` | Κωδικοί βλάβης OBD |
| `pids` / `extras` | Οποιαδήποτε επιπλέον PIDs |
| `network.type` | `WIFI` / `LTE` / `NR` |

Συχνότητα: κάθε **5–30 δευτ.** σε κίνηση, **1–5 λεπτά** σταματημένο. Ιστορικό κρατιέται ~7 ημέρες.

## 4. Arduino / ESP32 σκίτσο (ψευδοκώδικας)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASS";
const char* DEVICE_KEY = "rf_tel_REPLACE_ME";
const char* INGEST = "https://rentfleet-app.vercel.app/api/telematics/ingest";

void sendTelemetry(float lat, float lng, float speed, float fuel, int rpm) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(INGEST);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  StaticJsonDocument<768> doc;
  doc["gps"]["lat"] = lat;
  doc["gps"]["lng"] = lng;
  doc["speed_kmh"] = speed;
  doc["fuel_percent"] = fuel;
  doc["rpm"] = rpm;
  doc["ignition"] = true;
  doc["network"]["type"] = "WIFI";
  doc["firmware"] = "1.0.0";

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  // code 200 = OK
}
```

Για **4G/5G**: χρησιμοποίησε modem (SIM7600 / A7670 / Quectel) με TinyGSM ή AT commands· το HTTP POST παραμένει ίδιο, βάλε `"network":{"type":"LTE"}` ή `"NR"`.

## 5. OBD2 PIDs (ενδεικτικά)

| Πληροφορία | PID |
|------------|-----|
| RPM | 010C |
| Speed | 010D |
| Coolant | 0105 |
| Fuel level | 012F |
| Throttle | 0111 |
| DTCs | 03 / Mode 03 |

Το RentFleet **δεν** απαιτεί συγκεκριμένο PID set — στείλε ό,τι έχεις στο `pids` / `extras`.

## 6. Ασφάλεια

- Μην βάζεις το key στο Git
- Rotate key από UI αν διαρρεύσει
- HTTPS μόνο (Vercel)
- Η συσκευή δεν κάνει login χρήστη — μόνο device key
