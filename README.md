# Albion-Market-Crafting-Calculator

Zaawansowany kalkulator rzemiosła (Crafting Calculator) oraz sniffer sieciowy dedykowany dla gry Albion Online. Projekt łączy w sobie wydajny analizator pakietów sieciowych napisany w języku **Go (Golang)** oraz intuicyjny, medieval-style panel webowy służący do monitorowania cen i kalkulacji zysków w czasie rzeczywistym.

Aplikacja w bezpieczny (pasywny) sposób przechwytuje pakiety sieciowe gry, dekoduje je i umożliwia analizę rynku bez ingerencji w klienta gry.

---

## 🚀 Główne Funkcjonalności

### 1. Pasywny Sniffer Sieciowy (Network Sniffer)
* Przechwytywanie ruchu sieciowego na porcie gry za pomocą biblioteki `gopacket` i bibliotek systemowych PCAP.
* Pasywne dekodowanie protokołu sieciowego gry (operacji giełdowych, cenników i wpisów rynkowych) przy użyciu dekodera opartego na parserze struktur gry.
* Automatyczne rozróżnianie serwerów regionalnych (EU / NA) i zapisywanie historii cen do dedykowanych plików lokalnych JSON cache.

### 2. Crafting Calculator & Dashboard
* Wbudowany serwer WebSocket przesyłający zdekodowane dane rynkowe w czasie rzeczywistym bezpośrednio do przeglądarki.
* Medieval-styled interfejs użytkownika z elementami graficznymi (wizard, druid) oraz stylizacją dopasowaną do klimatu fantasy gry.
* Kalkulator zysków z rzemiosła (craftingu) uwzględniający koszty surowców, podatki rynkowe oraz opłaty za korzystanie ze stanowisk rzemieślniczych w miastach.

---

## 🛠️ Architektura i Technologie

Projekt został zbudowany z naciskiem na ekstremalną wydajność i niskie zużycie zasobów procesora:

* **Backend (Sniffer & WebSocket Server)**:
  * **Go (Golang) 1.24.0**: Wykorzystany ze względu na wielowątkowość i szybkość przetwarzania surowych danych sieciowych.
  * **GoPacket**: Niskopoziomowe przechwytywanie pakietów.
  * **Photon Spectator**: Dekodowanie struktur protokołu sieciowego.
  * **Gorilla WebSocket**: Komunikacja duplex czasu rzeczywistego z panelem webowym.
* **Frontend (Dashboard)**:
  * Czysty **JavaScript (ES6)** + HTML5 + CSS3 (custom medieval theme z pełną responsywnością).
  * WebSocket Client do dynamicznej aktualizacji cen bez przeładowywania strony.
* **Storage**:
  * Zoptymalizowany plikowy cache JSON ułatwiający szybki odczyt historycznych cen surowców.
