/**
 * RentFleet Tracker — ESP32 firmware (Lite WiFi / Pro LTE)
 *
 * Arduino IDE:
 *  - Board: ESP32 Dev Module (ή ESP32-S3)
 *  - Libraries: TinyGPSPlus, ArduinoJson, TinyGSM (μόνο LTE)
 *
 * 1) Αντιγραφή secrets.h.example → secrets.h
 * 2) Pairing key από RentFleet → Trackers
 * 3) Upload · Serial 115200
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include "config.h"

TinyGPSPlus gps;
HardwareSerial GpsSerial(1);
HardwareSerial ObdSerial(2);

struct Telemetry {
  bool haveGps = false;
  double lat = 0;
  double lng = 0;
  float alt = 0;
  float speedKmh = 0;
  float fuelPercent = NAN;
  float odometerKm = NAN;
  int rpm = -1;
  float coolantC = NAN;
  float batteryV = NAN;
  bool ignition = false;
  String dtc;
};

Telemetry tel;
unsigned long lastSend = 0;
unsigned long bootMs = 0;

bool networkReady() {
  // Pro LTE: βάλε TinyGSM init εδώ όταν έχεις A7670/SIM7600.
  return WiFi.status() == WL_CONNECTED;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[net] WiFi %s\n", RF_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(RF_WIFI_SSID, RF_WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[net] OK %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[net] FAIL");
  }
}

void elmWrite(const char *cmd) {
  ObdSerial.print(cmd);
  ObdSerial.print("\r");
}

String elmRead(unsigned long timeoutMs = 800) {
  String out;
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    while (ObdSerial.available()) {
      char c = (char)ObdSerial.read();
      if (c == '>') return out;
      if (c >= 32 && c < 127) out += c;
    }
  }
  return out;
}

int parseHexByte(const String &s, int idx) {
  if (idx + 1 >= (int)s.length()) return -1;
  return (int)strtol(s.substring(idx, idx + 2).c_str(), nullptr, 16);
}

bool elmPid(const char *pid, String &payload) {
  elmWrite(pid);
  String r = elmRead();
  r.replace(" ", "");
  r.toUpperCase();
  // ψάχνει απάντηση 41xx...
  int i = r.indexOf("41");
  if (i < 0) return false;
  payload = r.substring(i);
  return payload.length() >= 6;
}

void readObd() {
#if RF_DEMO_MODE
  return;
#endif
  String p;
  if (elmPid("010C", p)) {  // RPM
    int A = parseHexByte(p, 4);
    int B = parseHexByte(p, 6);
    if (A >= 0 && B >= 0) tel.rpm = ((A * 256) + B) / 4;
  }
  if (elmPid("010D", p)) {  // Speed
    int A = parseHexByte(p, 4);
    if (A >= 0) tel.speedKmh = (float)A;
  }
  if (elmPid("0105", p)) {  // Coolant
    int A = parseHexByte(p, 4);
    if (A >= 0) tel.coolantC = (float)(A - 40);
  }
  if (elmPid("012F", p)) {  // Fuel %
    int A = parseHexByte(p, 4);
    if (A >= 0) tel.fuelPercent = (A * 100.0f) / 255.0f;
  }
  if (elmPid("0142", p)) {  // Battery / control module voltage
    int A = parseHexByte(p, 4);
    int B = parseHexByte(p, 6);
    if (A >= 0 && B >= 0) tel.batteryV = ((A * 256) + B) / 1000.0f;
  }
  // DTCs mode 03
  elmWrite("03");
  String d = elmRead(1200);
  d.replace(" ", "");
  d.toUpperCase();
  tel.dtc = "";
  // απλοποιημένο: αν υπάρχει κωδικός πέρα από 43 00
  if (d.indexOf("43") >= 0 && d.indexOf("4300") < 0) {
    tel.dtc = d.substring(0, 16);
  }
  tel.ignition = tel.rpm > 400;
}

void readGps() {
#if RF_DEMO_MODE
  return;
#endif
  while (GpsSerial.available()) {
    gps.encode(GpsSerial.read());
  }
  if (gps.location.isValid()) {
    tel.haveGps = true;
    tel.lat = gps.location.lat();
    tel.lng = gps.location.lng();
    if (gps.altitude.isValid()) tel.alt = gps.altitude.meters();
    if (gps.speed.isValid() && tel.speedKmh <= 0) {
      tel.speedKmh = gps.speed.kmph();
    }
  }
}

void applyDemo() {
#if RF_DEMO_MODE
  // Ηράκλειο · mock κίνηση για δοκιμή ingest χωρίς hardware
  tel.haveGps = true;
  tel.lat = 35.3387 + (sin(millis() / 15000.0) * 0.002);
  tel.lng = 25.1442 + (cos(millis() / 15000.0) * 0.002);
  tel.speedKmh = 35 + (millis() / 1000) % 20;
  tel.fuelPercent = 62;
  tel.odometerKm = 50120;
  tel.rpm = 1800;
  tel.coolantC = 90;
  tel.batteryV = 13.9;
  tel.ignition = true;
  tel.dtc = "";
#endif
}

bool sendTelemetry() {
  if (!networkReady()) {
    connectWifi();
    if (!networkReady()) return false;
  }

  JsonDocument doc;
  if (tel.haveGps) {
    doc["gps"]["lat"] = tel.lat;
    doc["gps"]["lng"] = tel.lng;
    if (tel.alt != 0) doc["gps"]["alt"] = tel.alt;
  }
  if (tel.speedKmh >= 0) doc["speed_kmh"] = tel.speedKmh;
  if (!isnan(tel.fuelPercent)) doc["fuel_percent"] = tel.fuelPercent;
  if (!isnan(tel.odometerKm)) doc["odometer_km"] = tel.odometerKm;
  if (tel.rpm >= 0) doc["rpm"] = tel.rpm;
  if (!isnan(tel.coolantC)) doc["coolant_c"] = tel.coolantC;
  if (!isnan(tel.batteryV)) doc["battery_v"] = tel.batteryV;
  doc["ignition"] = tel.ignition;
  if (tel.dtc.length() > 0) {
    JsonArray arr = doc["dtcs"].to<JsonArray>();
    arr.add(tel.dtc);
  }
#if RF_NETWORK_MODE == RF_MODE_LTE
  doc["network"]["type"] = "LTE";
#else
  doc["network"]["type"] = "WIFI";
#endif
  if (WiFi.RSSI() != 0) doc["network"]["rssi"] = WiFi.RSSI();
  doc["firmware"] = RF_FIRMWARE_VERSION;

  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();  // proto · βάλε root CA σε production firmware
  HTTPClient http;
  if (!http.begin(client, RF_INGEST_URL)) {
    Serial.println("[http] begin fail");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", RF_DEVICE_KEY);
  int code = http.POST(body);
  String resp = http.getString();
  http.end();
  Serial.printf("[http] %d %s\n", code, resp.c_str());
  return code >= 200 && code < 300;
}

void setupObd() {
  ObdSerial.begin(OBD_BAUD, SERIAL_8N1, OBD_RX_PIN, OBD_TX_PIN);
  delay(300);
  elmWrite("ATZ");
  delay(1000);
  elmRead(1500);
  elmWrite("ATE0");
  elmRead();
  elmWrite("ATL0");
  elmRead();
  elmWrite("ATS0");
  elmRead();
  elmWrite("ATH0");
  elmRead();
  elmWrite("ATSP0");  // auto protocol
  elmRead(1500);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  bootMs = millis();
  Serial.println("\nRentFleet Tracker " RF_FIRMWARE_VERSION);

  GpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
#if !RF_DEMO_MODE
  setupObd();
#endif
  connectWifi();
}

void loop() {
  readGps();
  applyDemo();

  static unsigned long lastObd = 0;
  if (millis() - lastObd > 2000) {
    lastObd = millis();
    readObd();
  }

  bool moving = tel.speedKmh > 5 || tel.ignition;
  unsigned long interval = moving ? RF_INTERVAL_MOVING_MS : RF_INTERVAL_IDLE_MS;

  if (millis() - lastSend >= interval) {
    lastSend = millis();
    sendTelemetry();
  }
}
