# RentFleet Tracker — λίστα αγορών πρωτότυπου

Εσωτερικό doc (όχι για πελάτες). Παράγγειλε πρώτα **Lite ×3** και **Pro ×2**.

## A) RF-Track Lite (WiFi) — ~30–45€/τεμ.

| # | Μέρος | Αναζήτηση / SKU | Ποσ. | Σημείωση |
|---|--------|-----------------|------|----------|
| 1 | MCU | ESP32-WROOM-32 DevKit / ESP32-S3-DevKitC | 1 | USB για flash |
| 2 | GPS | u-blox NEO-6M ή NEO-M8N + κεραία | 1 | UART 9600 |
| 3 | OBD | ELM327 USB→UART (ή Bluetooth ELM + HC-05) | 1 | καλύτερα **UART ELM327** |
| 4 | Level shifter | 5V↔3.3V (αν χρειάζεται ELM) | 1 | προστασία ESP32 |
| 5 | Buck 12V→5V | Mini360 / MP1584 | 1 | από OBD pin 16 |
| 6 | Καλώδιο OBD-II male | 16-pin plug + καλώδια | 1 | pin 4/5 GND, 16 +12V, 6/14 CAN ή K-line ανά ELM |
| 7 | Θήκη | μικρό ABS κουτί ή OBD dongle shell | 1 | |
| 8 | Καλώδια Dupont / PCB proto | — | 1 σετ | πρωτότυπο breadboard OK |

**Στόχος Lite:** δοκιμές σε κατάστημα / WiFi hotspot αυτοκινήτου.

## B) RF-Track Pro (4G) — ~70–110€/τεμ.

Όλα τα Lite **συν**:

| # | Μέρος | Αναζήτηση / SKU | Ποσ. | Σημείωση |
|---|--------|-----------------|------|----------|
| 9 | 4G modem | LilyGO T-A7670E **ή** SIM7600EI breakout | 1 | LTE Ευρώπη (E = EU bands) |
| 10 | SIM IoT | Cosmote / Vodafone / Nova IoT prepaid | 1 | 50–200 MB/μήνα αρκετά |
| 11 | Κεραία LTE | SMA stub / stick | 1 | |
| 12 | Κεραία GPS | ενεργή με μαγνήτη (οροφή) | 1 | καλύτερο σήμα από εσωτερική |

**Προτεινόμενο board για γρήγορο Pro:**  
[LilyGO T-A7670E](https://www.lilygo.cc/) = ESP32 + A7670 + GPS σε ένα · λιγότερη καλωδίωση.

## C) Εργαλεία πάγκου (μία φορά)

| Μέρος | Γιατί |
|--------|--------|
| USB-C καλώδια data | flash firmware |
| Πολύμετρο | 12V / 5V έλεγχος |
| Κολλητήρι 40W + καλάι | τελική συναρμολόγηση |
| OBD-II extension / splitter | δοκιμή χωρίς να μπλοκάρεις θύρα |
| Φορητό powerbank 5V | δοκιμή χωρίς αυτοκίνητο |

## D) Πού να παραγγείλεις

1. **Mouser / DigiKey / RS** — ESP32, regulators, κεραίες (γρήγορα EU)  
2. **AliExpress / LilyGO official** — T-A7670E, NEO-M8N, ELM327 UART (φθηνότερα, 2–4 εβδ.)  
3. **Τοπικά** — OBD καλώδια, θήκες, SIM

## E) Σειρά αγοράς / δοκιμής

1. Παράγγειλε Lite BOM + 1× T-A7670E  
2. Flash `firmware/rentfleet-tracker` (mode WIFI)  
3. Δημιούργησε συσκευή στο RentFleet → βάλε το pairing key στο `secrets.h`  
4. Δοκίμασε GPS + mock OBD · μετά πραγματικό ELM  
5. Μετάάλλαξε σε `MODE_LTE` για Pro

## F) Τι να μην αγοράσεις στην αρχή

- 5G modem  
- Ακριβό CAN professional stack  
- Custom PCB (πρώτα breadboard / LilyGO)  
- Bluetooth-only ELM χωρίς UART bridge
