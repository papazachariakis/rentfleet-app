# RentFleet Tracker Firmware (εσωτερικό)

Firmware για τα δικά σου trackers. **Μην** το εκθέσεις σε πελάτες / UI.

## Γρήγορα (πρώτο πρωτότυπο χωρίς OBD/GPS)

1. Arduino IDE → εγκατάσταση ESP32 board support  
2. Libraries: `ArduinoJson`, `TinyGPSPlus`  
3. `secrets.h.example` → `secrets.h`  
4. Στο RentFleet → **Trackers** → Δημιουργία + pairing key → βάλε στο `RF_DEVICE_KEY`  
5. Στο `config.h` βάλε `#define RF_DEMO_MODE 1`  
6. Upload στο ESP32 · άνοιξε Serial 115200  
7. Στο χάρτη / Trackers πρέπει να φαίνεται online + θέση Ηρακλείου (mock)

## Πραγματικό Lite (WiFi + GPS + ELM327)

1. `RF_DEMO_MODE 0`  
2. Καλώδιωσε:
   - GPS TX→GPIO16, RX→GPIO17, VCC 3.3/5V, GND  
   - ELM327 TX→GPIO18, RX→GPIO19 (μέσω level shifter αν 5V)  
3. WiFi SSID/PASS στο `secrets.h`  
4. Βάλε στη θύρα OBD του αυτοκινήτου (με buck 12→5 για τροφοδοσία)

## Pro (4G)

- Προτίμησε **LilyGO T-A7670E**  
- Στο `config.h`: `#define RF_NETWORK_MODE LTE`  
- Ολοκλήρωσε TinyGSM init στο `networkReady()` / `connectWifi()` (επόμενο βήμα όταν έχεις το board)

## Αγορές

Δες `docs/rentfleet-tracker-bom.md`
