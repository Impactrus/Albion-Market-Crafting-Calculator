package main
import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/pcap"
	photon_spectator "github.com/ao-data/photon-spectator"
)

var (
	snifferStopChan  chan struct{}
	snifferWG        sync.WaitGroup
	snifferMu        sync.Mutex
	activeInterface  string
	packetCount      int64
	packetCountMu    sync.RWMutex
	lastRawLogTime   time.Time
	lastRawLogTimeMu sync.Mutex
)

// InterfaceInfo reprezentuje informacje o lokalnej karcie sieciowej
type InterfaceInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	IPs         []string `json:"ips"`
	IsActive    bool     `json:"is_active"`
}

func incrementPacketCount() {
	packetCountMu.Lock()
	packetCount++
	packetCountMu.Unlock()
}

func GetPacketCount() int64 {
	packetCountMu.RLock()
	defer packetCountMu.RUnlock()
	return packetCount
}

var (
	activeServerRegion   = "Nieznany"
	activeServerRegionMu sync.RWMutex
)

func SetServerRegion(region string) {
	activeServerRegionMu.Lock()
	if activeServerRegion == region {
		activeServerRegionMu.Unlock()
		return
	}
	activeServerRegion = region
	activeServerRegionMu.Unlock()

	log.Printf("[SERWER] Wykryto aktywny region gry: %s", region)

	// Przełączamy bazę danych cen dla nowego regionu
	onServerRegionChanged(region)

	// Wysyłamy informację o serwerze do UI przez WebSocket
	updateJSON, err := json.Marshal(map[string]interface{}{
		"type": "server_region_update",
		"data": region,
	})
	if err == nil {
		websocketHub.broadcast <- updateJSON
	}
}

func GetServerRegion() string {
	activeServerRegionMu.RLock()
	defer activeServerRegionMu.RUnlock()
	return activeServerRegion
}

func sendWebLog(logType string, text string) {
	updateJSON, err := json.Marshal(map[string]interface{}{
		"type": "backend_log",
		"data": map[string]string{
			"type": logType,
			"text": text,
		},
	})
	if err == nil && websocketHub != nil {
		select {
		case websocketHub.broadcast <- updateJSON:
		default:
		}
	}
}

func apiGetInterfaces(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	log.Println("[API] Otrzymano żądanie listy kart sieciowych...")
	devices, err := pcap.FindAllDevs()
	if err != nil {
		log.Printf("[API BŁĄD] Błąd listowania kart: %v", err)
		http.Error(w, fmt.Sprintf("Błąd listowania kart: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("[API] Znaleziono %d kart sieciowych przez pcap.", len(devices))

	var list []InterfaceInfo
	snifferMu.Lock()
	currentActive := activeInterface
	snifferMu.Unlock()

	for _, dev := range devices {
		var ips []string
		for _, addr := range dev.Addresses {
			if addr.IP.To4() != nil {
				ips = append(ips, addr.IP.String())
			}
		}

		list = append(list, InterfaceInfo{
			Name:        dev.Name,
			Description: dev.Description,
			IPs:         ips,
			IsActive:    dev.Name == currentActive,
		})
	}

	json.NewEncoder(w).Encode(list)
}

func apiStartSniffer(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	var req struct {
		InterfaceName string `json:"interface_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := StartSnifferOnInterface(req.InterfaceName)
	if err != nil {
		http.Error(w, fmt.Sprintf("Błąd uruchamiania sniffera: %v", err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "started",
		"active": req.InterfaceName,
	})
}

// StartSnifferOnInterface zatrzymuje stary sniffer i uruchamia nowy na wybranej karcie
func StartSnifferOnInterface(interfaceName string) error {
	snifferMu.Lock()
	defer snifferMu.Unlock()

	// Zatrzymujemy stary sniffer jeśli istnieje
	if snifferStopChan != nil {
		log.Println("[SNIFFER] Zatrzymywanie aktualnego nasłuchu...")
		close(snifferStopChan)
		snifferStopChan = nil
		snifferWG.Wait()
	}

	log.Printf("[SNIFFER] Uruchamianie nasłuchu na karcie: %s", interfaceName)
	sendWebLog("system", fmt.Sprintf("Uruchamianie nasłuchu na karcie: %s...", interfaceName))
	snifferStopChan = make(chan struct{})
	activeInterface = interfaceName

	// Reset licznika pakietów
	packetCountMu.Lock()
	packetCount = 0
	packetCountMu.Unlock()

	snifferWG.Add(1)
	go func(stopChan chan struct{}, devName string) {
		defer snifferWG.Done()
		runCaptureLoop(stopChan, devName)
	}(snifferStopChan, interfaceName)

	return nil
}

// runCaptureLoop otwiera kartę sieciową i nasłuchuje pakiety UDP
func runCaptureLoop(stopChan chan struct{}, deviceName string) {
	// Konfiguracja przechwytywania: 65535 bajtów (brak obcinania pakietów), 
	// tryb promiscuous wyłączony (false) dla maksymalnej kompatybilności z kartami USB Wi-Fi / Tethering,
	// timeout 1 sekunda (standard dostarczania pakietów w Windows)
	handle, err := pcap.OpenLive(deviceName, 65535, false, 1*time.Second)
	if err != nil {
		log.Printf("[BŁĄD SNIFFERA] Nie można otworzyć karty %s: %v", deviceName, err)
		sendWebLog("error", fmt.Sprintf("Błąd otwierania karty %s: %v. Upewnij się, że kliknąłeś prawym i wybrałeś 'URUCHOM JAKO ADMINISTRATOR'!", deviceName, err))
		return
	}
	defer handle.Close()

	// Filtrujemy wyłącznie pakiety UDP na porcie gry Albion Online (5056)
	err = handle.SetBPFFilter("udp port 5056")
	if err != nil {
		log.Printf("[BŁĄD SNIFFERA] Błąd ustawiania filtra BPF: %v", err)
		sendWebLog("error", fmt.Sprintf("Błąd filtra sieciowego pcap: %v", err))
		return
	}

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	packets := packetSource.Packets()

	// Inicjalizacja bufora fragmentów dla protokołu Photon
	fragmentBuffer := photon_spectator.NewFragmentBuffer()

	log.Printf("[SNIFFER] Nasłuch UDP na porcie 5056 aktywny na %s...", deviceName)
	sendWebLog("success", fmt.Sprintf("Sukces! Nasłuch sieciowy portu 5056 aktywny na karcie: %s", deviceName))

	for {
		select {
		case <-stopChan:
			log.Println("[SNIFFER] Nasłuch zatrzymany pomyślnie.")
			return
		case packet, ok := <-packets:
			if !ok {
				return
			}

			incrementPacketCount()

			// Wysyłamy aktualną liczbę pakietów do UI
			updateJSON, err := json.Marshal(map[string]interface{}{
				"type": "packet_count_update",
				"data": GetPacketCount(),
			})
			if err == nil {
				websocketHub.broadcast <- updateJSON
			}

			// DEBUG: Loguj każdy pakiet do konsoli webowej (opcjonalnie odkomentuj jeśli pakiety: 0)
			// sendWebLog("raw", fmt.Sprintf("Odebrano pakiet UDP: %d bajtów", len(payload)))

			// Wysyłamy diagnostyczny log surowego pakietu z ograniczeniem częstotliwości (rate limit 300ms)
			if packet.NetworkLayer() != nil && packet.TransportLayer() != nil {
				netFlow := packet.NetworkLayer().NetworkFlow()
				transFlow := packet.TransportLayer().TransportFlow()
				
				srcIP := netFlow.Src().String()
				dstIP := netFlow.Dst().String()
				srcPort := transFlow.Src().String()
				dstPort := transFlow.Dst().String()
				length := len(packet.Data())
				
				lastRawLogTimeMu.Lock()
				if time.Since(lastRawLogTime) > 300*time.Millisecond {
					lastRawLogTime = time.Now()
					// Wysyłamy to jako typ "raw" do frontendu
					sendWebLog("raw", fmt.Sprintf("[RAW] %s:%s -> %s:%s (%d B)", srcIP, srcPort, dstIP, dstPort, length))
				}
				lastRawLogTimeMu.Unlock()
			}

			// Automatyczna detekcja serwera gry Albion Online na podstawie IP
			if packet.NetworkLayer() != nil && packet.TransportLayer() != nil {
				netFlow := packet.NetworkLayer().NetworkFlow()
				transFlow := packet.TransportLayer().TransportFlow()

				serverIP := ""
				if transFlow.Dst().String() == "5056" {
					serverIP = netFlow.Dst().String()
				} else if transFlow.Src().String() == "5056" {
					serverIP = netFlow.Src().String()
				}

				if serverIP != "" {
					region := "Nieznany"
					// Albion Europe (EU) uses Amsterdam servers which typically reside in 5.188.224.0/22 (5.188.224.* - 5.188.227.*)
					// Broad check: if it starts with 5.188. but is not West (5.188.124/125) or East (5.188.116), it is Albion Europe!
					isEurope := strings.Contains(serverIP, "5.188.224") || 
						strings.Contains(serverIP, "5.188.225") || 
						strings.Contains(serverIP, "5.188.226") || 
						strings.Contains(serverIP, "5.188.227") ||
						(strings.HasPrefix(serverIP, "5.188.") && !strings.Contains(serverIP, "5.188.12") && !strings.Contains(serverIP, "5.188.11")) ||
						strings.HasPrefix(serverIP, "193.169.")

					if isEurope {
						region = "Europa (EU)"
					} else if strings.Contains(serverIP, "5.188.125") || strings.Contains(serverIP, "5.188.124") {
						region = "Ameryka (West)"
					} else if strings.Contains(serverIP, "5.188.116") || strings.Contains(serverIP, "103.149.231") || strings.Contains(serverIP, "103.149.230") {
						region = "Azja (East)"
					} else {
						region = "Inny (" + serverIP + ")"
					}
					SetServerRegion(region)
				}
			}

			// Pobieramy dane warstwy aplikacyjnej (UDP payload)
			appLayer := packet.ApplicationLayer()
			if appLayer == nil {
				continue
			}

			payload := appLayer.Payload()
			if len(payload) == 0 {
				continue
			}

			// Przechwytywanie cen metodą brute-force bezpośrednio z surowego strumienia pakietów serwera
			if packet.TransportLayer() != nil && packet.TransportLayer().TransportFlow().Src().String() == "5056" {
				processRawServerPayload(payload)
			}


			// Dekodujemy surowy pakiet UDP jako warstwę Photon
			photonPacket := gopacket.NewPacket(payload, photon_spectator.PhotonLayerType, gopacket.Default)
			photonLayerInstance := photonPacket.Layer(photon_spectator.PhotonLayerType)
			if photonLayerInstance == nil {
				continue
			}

			photonLayer, ok := photonLayerInstance.(*photon_spectator.PhotonLayer)
			if !ok {
				continue
			}

			// Przetwarzamy wszystkie komendy wewnątrz pakietu Photon
			for _, command := range photonLayer.Commands {
				// Jeśli komenda jest fragmentem (SendReliableFragmentType = 8)
				if command.Type == photon_spectator.SendReliableFragmentType {
					fragment, err := command.ReliableFragment()
					if err != nil {
						continue
					}

					// Oferujemy fragment do bufora, który sklei go, jeśli mamy komplet
					assembledCommand := fragmentBuffer.Offer(fragment)
					if assembledCommand != nil {
						// Pomyślnie złożono pełny pakiet rynkowy z fragmentów!
						ProcessPhotonCommand(*assembledCommand)
					}
				} else {
					// Dla standardowych, nieframgentowanych wiadomości (SendReliableType = 6)
					// sendWebLog("raw", fmt.Sprintf("[PHOTON] Komenda: %d", command.Type))
					ProcessPhotonCommand(command)
				}
			}
		}
	}
}

// startDefaultSniffer automatycznie i inteligentnie znajduje najlepszą fizyczną kartę sieciową z IP (np. Wi-Fi, Ethernet)
func startDefaultSniffer() {
	// Czekamy chwilę na uruchomienie serwera HTTP i WebSockets
	time.Sleep(1 * time.Second)

	devices, err := pcap.FindAllDevs()
	if err != nil {
		log.Printf("[SNIFFER] Błąd podczas wyszukiwania kart sieciowych: %v", err)
		return
	}

	var bestDevice string
	var bestScore int = -9999

	for _, dev := range devices {
		hasIP := false
		isLoopback := false
		hasAPIPA := false   // 169.254.x.x = karta bez prawdziwego internetu
		hasRealIP := false  // prawdziwy adres IP (10.x, 192.168.x, 172.x)

		for _, addr := range dev.Addresses {
			ip4 := addr.IP.To4()
			if ip4 == nil {
				continue
			}
			hasIP = true
			if addr.IP.IsLoopback() {
				isLoopback = true
			}
			// APIPA: 169.254.0.0/16 — karta jest odłączona od sieci
			if ip4[0] == 169 && ip4[1] == 254 {
				hasAPIPA = true
			}
			// Prawdziwy prywatny adres IP
			if ip4[0] == 10 || (ip4[0] == 192 && ip4[1] == 168) || (ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31) {
				hasRealIP = true
			}
		}

		// Pomijamy karty bez IP lub pętlę zwrotną
		if !hasIP || isLoopback {
			continue
		}

		// Heurystyka oceny punktowej karty sieciowej
		score := 10 // Wynik bazowy dla każdej karty z IPv4
		desc := strings.ToLower(dev.Description)
		name := strings.ToLower(dev.Name)

		// Kary dla kart bez prawdziwego internetu (APIPA = 169.254.x.x)
		if hasAPIPA && !hasRealIP {
			score -= 200
		}

		// Bonus za prawdziwy adres IP (192.168.x.x, 10.x.x.x)
		if hasRealIP {
			score += 50
		}

		// Odejmujemy punkty za wirtualne adaptery Microsoftu (Wi-Fi Direct, Hyper-V, VPN itp.)
		if containsAny(desc, "vmware", "virtualbox", "vbox", "host-only", "hyper-v", "teredo", "pseudo", "tunnel", "vpn") ||
			containsAny(name, "vmware", "virtualbox", "vbox", "host-only", "hyper-v", "vpn") {
			score -= 100
		}

		// Kara za wirtualne karty Wi-Fi Direct Microsoftu (są zawsze bezużyteczne)
		if containsAny(desc, "wi-fi direct", "direct virtual") {
			score -= 150
		}

		// Bonus za fizyczne karty z prawdziwym podłączeniem (Wi-Fi, Ethernet)
		if containsAny(desc, "wi-fi", "wireless", "ethernet", "lan", "wlan", "realtek", "intel", "broadcom", "killer", "atheros", "gigabit") ||
			containsAny(name, "wi-fi", "wireless", "ethernet", "lan", "wlan") {
			score += 100
		}

		// Bonus za tethering telefoniczny (Remote NDIS) — bardzo częste w Polsce!
		if containsAny(desc, "remote ndis", "rndis", "mobile", "tethering", "android") {
			score += 150
		}

		log.Printf("[SNIFFER] Heurystyka karty: %s (%s) -> RealIP:%v APIPA:%v -> Wynik: %d", dev.Name, dev.Description, hasRealIP, hasAPIPA, score)

		if bestDevice == "" || score > bestScore {
			bestDevice = dev.Name
			bestScore = score
		}
	}

	if bestDevice != "" {
		log.Printf("[SNIFFER] Wybrano automatycznie najlepszą kartę: %s (Wynik heurystyki: %d)", bestDevice, bestScore)
		err := StartSnifferOnInterface(bestDevice)
		if err != nil {
			log.Printf("[SNIFFER] Błąd automatycznego startu na karcie %s: %v", bestDevice, err)
		}
	} else {
		log.Println("[SNIFFER] Nie wykryto automatycznie aktywnej karty sieciowej z IP. Wybierz kartę ręcznie w panelu webowym.")
	}
}

// containsAny sprawdza czy ciąg zawiera którykolwiek z podanych podciągów (case-insensitive)
func containsAny(s string, sub ...string) bool {
	sLower := strings.ToLower(s)
	for _, val := range sub {
		if strings.Contains(sLower, val) {
			return true
		}
	}
	return false
}

var (
	serverStreamBuf []byte
	serverStreamMu  sync.Mutex

	// Bufor do auto-detekcji miasta z brute-force sniffera
	recentLocationHits   map[string]int
	recentLocationMu     sync.Mutex
	recentLocationTimer  *time.Timer
)

func init() {
	recentLocationHits = make(map[string]int)
}

// flushLocationDetection analizuje zgromadzone LocationID z ostatnich 2 sekund
func flushLocationDetection() {
	recentLocationMu.Lock()
	defer recentLocationMu.Unlock()

	if len(recentLocationHits) == 0 {
		return
	}

	bestLoc := ""
	bestCount := 0
	total := 0
	for loc, count := range recentLocationHits {
		total += count
		if count > bestCount {
			bestCount = count
			bestLoc = loc
		}
	}

	// Reset bufora
	recentLocationHits = make(map[string]int)

	if bestLoc != "" && total >= 3 {
		ratio := float64(bestCount) / float64(total)
		if ratio > 0.5 && bestLoc != GetPlayerLocation() {
			log.Printf("[AUTO-LOKALIZACJA] Wykryto market miasta %s (%.0f%% z %d ofert)", bestLoc, ratio*100, total)
			
			// Zamiast automatycznie ustawiać, wysyłamy sugestię do frontendu (Gandalf zapyta)
			suggestJSON, err := json.Marshal(map[string]interface{}{
				"type": "location_suggestion",
				"data": bestLoc,
			})
			if err == nil && websocketHub != nil {
				websocketHub.broadcast <- suggestJSON
			}
		}
	}
}

// processRawServerPayload gromadzi i skanuje surowe pakiety serwera w poszukiwaniu kompletnych JSON-ów cenowych
func processRawServerPayload(payload []byte) {
	serverStreamMu.Lock()
	defer serverStreamMu.Unlock()

	serverStreamBuf = append(serverStreamBuf, payload...)

	lastParsedIdx := 0
	for i := 0; i < len(serverStreamBuf); i++ {
		// Szukamy otwierającego nawiasu klamrowego
		if serverStreamBuf[i] == '{' && i+5 < len(serverStreamBuf) {
			r := bytes.NewReader(serverStreamBuf[i:])
			dec := json.NewDecoder(r)
			var order MarketOrder
			if err := dec.Decode(&order); err != nil {
				continue
			}

			// Weryfikacja czy to jest poprawne zamówienie rynkowe z Albion Online
			if order.ItemTypeID != "" && order.UnitPriceSilver > 0 {
				if order.LocationID == "" || order.LocationID == "0" {
					order.LocationID = GetPlayerLocation()
				}
				if order.AuctionType == "" {
					order.AuctionType = "offer"
				}

				// Specjalne logowanie dla surowców, aby użytkownik widział, że są przechwytywane
				if isResource(order.ItemTypeID) {
					log.Printf("[SNIFFER] 💎 WYKRYTO SUROWIEC: %s (%s) za %d sreb. (Ilość: %d)", 
						order.ItemTypeID, order.AuctionType, order.UnitPriceSilver, order.Amount)
				} else {
					log.Printf("[SNIFFER] 📦 Wykryto przedmiot: %s (%s) za %d sreb. (Ilość: %d)", 
						order.ItemTypeID, order.AuctionType, order.UnitPriceSilver, order.Amount)
				}
				
				// Ceny w protokole sieciowym Albion Online są zawsze pomnożone przez 10000
				if order.UnitPriceSilver >= 10000 {
					order.UnitPriceSilver = order.UnitPriceSilver / 10000
				}

				// Auto-detekcja miasta: zbieramy LocationID do bufora
				if order.LocationID != "" && order.LocationID != "0" {
					recentLocationMu.Lock()
					recentLocationHits[order.LocationID]++
					if recentLocationTimer != nil {
						recentLocationTimer.Stop()
					}
					recentLocationTimer = time.AfterFunc(2*time.Second, flushLocationDetection)
					recentLocationMu.Unlock()
				}
				
				// Zapisujemy cenę lokalnie i wysyłamy przez WebSocket na frontend
				updateLocalPrice(&order)

				// Przesuwamy indeks pętli za zdekodowany obiekt
				bytesRead := len(serverStreamBuf[i:]) - r.Len()
				if bytesRead > 0 {
					i += bytesRead - 1
					lastParsedIdx = i + 1
				}
			}
		}
	}

	// Odcinamy pomyślnie zdekodowaną część bufora
	if lastParsedIdx > 0 {
		if lastParsedIdx >= len(serverStreamBuf) {
			serverStreamBuf = nil
		} else {
			serverStreamBuf = serverStreamBuf[lastParsedIdx:]
		}
	}

	// Limit bezpieczeństwa dla rozmiaru bufora (np. w przypadku błędnych danych)
	if len(serverStreamBuf) > 300000 {
		serverStreamBuf = serverStreamBuf[len(serverStreamBuf)-50000:]
	}
}

