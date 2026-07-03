package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"

	photon_spectator "github.com/ao-data/photon-spectator"
)

// getStringVal konwertuje dowolną wartość (np. int32, string, float64) na string
func getStringVal(val any) string {
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	case int32:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case int:
		return fmt.Sprintf("%d", v)
	case float64:
		return fmt.Sprintf("%.0f", v)
	case float32:
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%v", val)
}

func sendParserLog(logType string, text string) {
	msgJSON, err := json.Marshal(map[string]interface{}{
		"type": "backend_log",
		"data": map[string]string{
			"type": logType,
			"text": text,
		},
	})
	if err == nil && websocketHub != nil {
		websocketHub.broadcast <- msgJSON
	}
}



var (
	currentPlayerLocation   = "" // Brak domyślnego miasta!
	currentPlayerLocationMu sync.RWMutex
)

// SetPlayerLocation ręcznie lub automatycznie aktualizuje aktualną strefę gracza
func SetPlayerLocation(locID string) {
	currentPlayerLocationMu.Lock()
	currentPlayerLocation = locID
	currentPlayerLocationMu.Unlock()
	log.Printf("[LOKALIZACJA] Zaktualizowano strefę gracza do ID: %s", locID)

	// Wysyłamy informację o zmianie lokacji do UI przez WebSocket
	updateJSON, err := json.Marshal(map[string]interface{}{
		"type": "location_update",
		"data": locID,
	})
	if err == nil {
		websocketHub.broadcast <- updateJSON
	}
}

func GetPlayerLocation() string {
	currentPlayerLocationMu.RLock()
	defer currentPlayerLocationMu.RUnlock()
	return currentPlayerLocation
}

func ProcessPhotonCommand(command photon_spectator.PhotonCommand) {
	// Rozkodowujemy komendę do formy ReliableMessage
	msg, err := command.ReliableMessage()
	if err != nil {
		return
	}

	// Diagnostyka: logujemy każdą komendę do konsoli webowej
	sendParserLog("raw", fmt.Sprintf("[LOG] Photon Typ: %d, Kod: %d", msg.Type, msg.OperationCode))

	// Sprawdzamy typ wiadomości rynkowej/strefowej
	switch msg.Type {
	case photon_spectator.OperationResponse:
		handleOperationResponse(msg)
	case photon_spectator.OperationRequest:
		handleOperationRequest(msg)
	case 3: // EventData
		handleEventData(msg)
	default:
		// log.Printf("[PHOTON] Nieobsługiwany typ wiadomości: %d", msg.Type)
	}
}

func handleEventData(msg photon_spectator.ReliableMessage) {
	// Logujemy każde zdarzenie dla diagnostyki
	sendParserLog("raw", fmt.Sprintf("[EVENT] Code: %d", msg.OperationCode))

	// Event 1 (ChangeCluster), 2 (JoinFinished), 3 (Move)
	if msg.OperationCode == 1 || msg.OperationCode == 2 || msg.OperationCode == 3 {
		params := photon_spectator.DecodeReliableMessage(msg)
		
		// Przeszukujemy parametry w poszukiwaniu ID strefy
		zoneRaw := ""
		for _, idx := range []int{0, 1, 2, 3, 4, 8, 252} {
			if val := getStringVal(params[byte(idx)]); val != "" {
				// ID strefy to zazwyczaj 4-8 cyfrowy numer lub nazwa miasta
				if len(val) >= 4 {
					zoneRaw = val
					break
				}
			}
		}

		if zoneRaw != "" {
			log.Printf("[EVENT-%d] Wykryto potencjalną strefę: %s", msg.OperationCode, zoneRaw)
			sendParserLog("info", fmt.Sprintf("Wykryto zdarzenie strefy (Kod %d): %s", msg.OperationCode, zoneRaw))
			tryDetectCityFromZone(zoneRaw)
		}
	}
}


func handleOperationRequest(msg photon_spectator.ReliableMessage) {
	// Logowanie operacji wychodzących (zapytania gracza do serwera)
	if msg.OperationCode == 2 || msg.OperationCode == 253 {
		params := photon_spectator.DecodeReliableMessage(msg)
		for k, v := range params {
			valStr := getStringVal(v)
			if valStr != "" {
				log.Printf("[OPREQ-%d-DEBUG] param[%d] = '%s'", msg.OperationCode, k, valStr)
			}
		}
	}
}

// tryDetectCityFromZone próbuje rozpoznać miasto z dowolnego formatu zone ID
func tryDetectCityFromZone(zoneRaw string) {
	// Mapowanie znanych miast królewskich
	cityMap := map[string]string{
		"3002": "3002", // Martlock
		"3005": "3005", // Caerleon
		"3008": "3008", // Lymhurst
		"2004": "2004", // Fort Sterling
		"1002": "1002", // Thetford
		"1004": "1004", // Bridgewatch
		"5003": "5003", // Brecilien
		"3003": "3003", // Black Market
	}

	// Mapowanie nazw miast (na wypadek gdyby zone ID było tekstowe)
	cityNameMap := map[string]string{
		"Martlock":      "3002",
		"Caerleon":      "3005",
		"Lymhurst":      "3008",
		"Fort Sterling": "2004",
		"Thetford":      "1002",
		"Bridgewatch":   "1004",
		"Brecilien":     "5003",
		"Black Market":  "3003",
	}

	detectedCity := ""

	// 1. Próba dokładnego dopasowania (zone ID = city ID)
	if city, ok := cityMap[zoneRaw]; ok {
		detectedCity = city
	}

	// 2. Próba dopasowania po nazwie w stringu (np. "0301-Caerleon" lub "Martlock")
	if detectedCity == "" {
		for name, cityID := range cityNameMap {
			if strings.Contains(strings.ToLower(zoneRaw), strings.ToLower(name)) {
				detectedCity = cityID
				break
			}
		}
	}

	// 3. Próba dopasowania podciągu numerycznego (np. zone "30050001" zawiera "3005")
	if detectedCity == "" {
		for numID, cityID := range cityMap {
			if strings.Contains(zoneRaw, numID) {
				detectedCity = cityID
				break
			}
		}
	}

	if detectedCity == "" {
		log.Printf("[STREFA] Klaster '%s' nie pasuje do żadnego znanego miasta", zoneRaw)
		sendParserLog("info", fmt.Sprintf("Wykryto klastra '%s', ale nie przypisano do miasta.", zoneRaw))
		return
	}

	suggestedCity := detectedCity
	// SPECJALNA LOGIKA CAERLEONU:
	// Wejście do Caerleonu (3005) = gracz idzie na Black Market (3003)
	if detectedCity == "3005" {
		suggestedCity = "3003"
	}

	log.Printf("[STREFA] Wykryto miasto: %s → sugestia: %s (z zone: '%s')", detectedCity, suggestedCity, zoneRaw)
	sendParserLog("success", fmt.Sprintf("Wykryto miasto: %s (Zone: %s)", detectedCity, zoneRaw))

	suggestJSON, err := json.Marshal(map[string]interface{}{
		"type": "zone_suggestion",
		"data": map[string]string{
			"zone_id":    detectedCity,
			"suggest_id": suggestedCity,
		},
	})
	if err == nil {
		websocketHub.broadcast <- suggestJSON
	}
}




func handleOperationResponse(msg photon_spectator.ReliableMessage) {
	params := photon_spectator.DecodeReliableMessage(msg)

	switch msg.OperationCode {
	case 2: // opJoin
		// Gracz loguje się do gry lub zmienia strefę (klaster)
		// Logujemy WSZYSTKIE parametry żeby zdiagnozować format
		for k, v := range params {
			log.Printf("[OPJOIN-DEBUG] param[%d] = %v (type: %T)", k, v, v)
		}

		// Próbujemy kilka znanych indeksów parametrów
		zoneRaw := ""
		for _, idx := range []int{8, 1, 0, 252} {
			if val := getStringVal(params[byte(idx)]); val != "" {
				if zoneRaw == "" {
					zoneRaw = val
				}
				log.Printf("[OPJOIN] param[%d] = '%s'", idx, val)
			}
		}

		if zoneRaw != "" {
			log.Printf("[STREFA] Gracz wszedł do klastra: '%s'", zoneRaw)
			tryDetectCityFromZone(zoneRaw)
		}

	case 75, 76, 81, 82: // opAuctionGetOffers (75/81) i opAuctionGetRequests (76/82)
		// Przechwycono ceny z tablicy rynkowej!
		params := photon_spectator.DecodeReliableMessage(msg)

		// Parametr rynkowy o indeksie 0 zawiera tablicę JSON-ów rynkowych
		ordersData, ok := params[0]
		if !ok {
			return
		}

		ordersSlice, ok := ordersData.([]string)
		if !ok {
			// Alternatywnie, jeśli jest to pojedynczy string
			singleStr, ok := ordersData.(string)
			if ok {
				ordersSlice = []string{singleStr}
			} else {
				return
			}
		}

		auctionType := "offer"
		if msg.OperationCode == 76 || msg.OperationCode == 82 {
			auctionType = "request"
		}

		log.Printf("[MARKET] Przechwycono %d ofert rynkowych (Typ: %s)", len(ordersSlice), auctionType)

		// Zliczamy LocationID w tej partii, żeby wykryć w którym mieście jesteśmy
		locationCounts := make(map[string]int)
		var parsedOrders []MarketOrder

		for _, orderJSON := range ordersSlice {
			var order MarketOrder
			err := json.Unmarshal([]byte(orderJSON), &order)
			if err != nil {
				continue
			}

			// Dołączamy typ aukcji
			order.AuctionType = auctionType

			// Zliczamy ile ofert pochodzi z jakiego miasta
			if order.LocationID != "" && order.LocationID != "0" {
				locationCounts[order.LocationID]++
			}

			parsedOrders = append(parsedOrders, order)
		}

		// AUTO-DETEKCJA MIASTA: jeśli >60% ofert w partii pochodzi z jednego miasta,
		// wysyłamy sugestię do frontendu zamiast automatycznie ustawiać
		if len(parsedOrders) > 0 {
			bestLoc := ""
			bestCount := 0
			totalWithLoc := 0
			for loc, count := range locationCounts {
				totalWithLoc += count
				if count > bestCount {
					bestCount = count
					bestLoc = loc
				}
			}

			// AGRESYWNA DETEKCJA: Jeśli nie mamy wybranego miasta, a widzimy dane
			if bestLoc != "" && (GetPlayerLocation() == "" || GetPlayerLocation() == "0") {
				log.Printf("[AUTO-LOKALIZACJA] Brak miasta! Wykryto dane z %s. Sugestia Druida.", bestLoc)
				suggestJSON, _ := json.Marshal(map[string]interface{}{
					"type": "location_suggestion",
					"data": bestLoc,
				})
				websocketHub.broadcast <- suggestJSON
			} else if bestLoc != "" && totalWithLoc > 0 {
				ratio := float64(bestCount) / float64(totalWithLoc)
				if ratio > 0.6 && bestLoc != GetPlayerLocation() {
					log.Printf("[AUTO-LOKALIZACJA] Wykryto market miasta %s (%.0f%% ofert)", bestLoc, ratio*100)
					suggestJSON, _ := json.Marshal(map[string]interface{}{
						"type": "location_suggestion",
						"data": bestLoc,
					})
					websocketHub.broadcast <- suggestJSON
				}
			}
		}

		// Przetwarzamy wszystkie oferty
		for _, order := range parsedOrders {
			// Jeśli zamówienie nie ma przypisanej lokalizacji,
			// przypisujemy aktualną lokalizację gracza
			if order.LocationID == "" || order.LocationID == "0" {
				order.LocationID = GetPlayerLocation()
			}

			// Ceny w protokole sieciowym Albion Online są zawsze pomnożone przez 10000
			if order.UnitPriceSilver >= 10000 {
				order.UnitPriceSilver = order.UnitPriceSilver / 10000
			}

			// Zapisujemy cenę w bazie RAM i wysyłamy przez WebSocket do frontendu
			updateLocalPrice(&order)
		}
	}
}
