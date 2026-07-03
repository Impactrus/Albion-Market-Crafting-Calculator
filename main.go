package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

//go:embed web/*
var webFS embed.FS

// MarketOrder reprezentuje strukturę zamówienia rynkowego przesyłaną przez grę Albion Online
type MarketOrder struct {
	ID               int64  `json:"Id"`
	ItemTypeID       string `json:"ItemTypeId"`
	QualityLevel     int    `json:"QualityLevel"`
	UnitPriceSilver  int64  `json:"UnitPriceSilver"`
	Amount           int    `json:"Amount"`
	AuctionType      string `json:"AuctionType"` // "offer" (sprzedaż) lub "request" (kupno)
	LocationID       string `json:"LocationId"`
	EnchantmentLevel int    `json:"EnchantmentLevel"`
}

// MarketOfferInfo reprezentuje pojedynczą ofertę rynkową dla konkretnego miasta
type MarketOfferInfo struct {
	Price       int64     `json:"price"`
	Amount      int       `json:"amount"`
	AuctionType string    `json:"auction_type"`
	LastUpdate  string    `json:"last_update"`
	Timestamp   time.Time `json:"timestamp"`
}

// ItemPriceInfo przechowuje najlepsze ceny przedmiotu oraz listę wszystkich ofert dla kalkulatora
type ItemPriceInfo struct {
	ItemTypeID   string                       `json:"item_id"`
	IsResource   bool                         `json:"is_resource"`
	Quality      int                          `json:"quality"`
	Enchantments map[string]int64             `json:"enchantments"` // np. "0": cena, "1": cena
	Prices       map[string]int64             `json:"prices"`       // Klucz: ID Lokacji (np. "3003", "3008"), Wartość: cena (najlepsza)
	Amount       map[string]int               `json:"amount"`       // Klucz: ID Lokacji, Wartość: ilość sztuk w najlepszym zleceniu
	LastUpdate   map[string]string            `json:"last_update"`   // Kiedy ostatnio zaktualizowano najlepszą cenę
	Offers       map[string][]MarketOfferInfo `json:"offers"`        // Klucz: ID Lokacji, Wartość: Lista wszystkich aktualnych ofert
}

// RecentOrder to surowe zamówienie rynkowe ze znacznikiem czasu, do Live Feed
type RecentOrder struct {
	ItemTypeID   string `json:"item_id"`
	ItemName     string `json:"item_name"`
	LocationID   string `json:"location_id"`
	AuctionType  string `json:"auction_type"`
	Price        int64  `json:"price"`
	Quality      int    `json:"quality"`
	Enchantment  int    `json:"enchantment"`
	Amount       int    `json:"amount"`
	CapturedAt   string `json:"captured_at"`
}

// Globalna baza danych cen w pamięci RAM
var (
	priceDB       = make(map[string]*ItemPriceInfo)
	priceDBMu     sync.RWMutex
	websocketHub  *Hub
	recentOrders  []RecentOrder
	recentOrdersMu sync.RWMutex
	maxRecentOrders = 200
)

// Hub zarządza aktywnymi połączeniami WebSocket
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 1000),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run() {
	for {
		select {
		case conn := <-h.register:
			h.mu.Lock()
			h.clients[conn] = true
			h.mu.Unlock()
			log.Println("Nowy klient WebSocket połączony")
		case conn := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
				log.Println("Klient WebSocket rozłączony")
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for conn := range h.clients {
				err := conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("Błąd wysyłania WebSocket: %v", err)
					conn.Close()
					delete(h.clients, conn)
				}
			}
			h.mu.Unlock()
		}
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Zezwalaj na dowolne pochodzenie (localhost)
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Błąd upgrade do WebSocket: %v", err)
		return
	}
	websocketHub.register <- conn

	// Czekaj na zamknięcie połączenia
	defer func() {
		websocketHub.unregister <- conn
	}()

	// Wysyłamy natychmiastowy aktualny stan serwera nowemu klientowi
	initialRegion := GetServerRegion()
	regionJSON, _ := json.Marshal(map[string]interface{}{
		"type": "server_region_update",
		"data": initialRegion,
	})
	conn.WriteMessage(websocket.TextMessage, regionJSON)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// isResource sprawdza czy ID przedmiotu należy do surowców lub materiałów przetworzonych
func isResource(itemID string) bool {
	resSuffixes := []string{"_WOOD", "_ORE", "_FIBER", "_HIDE", "_ROCK", "_PLANKS", "_METALBAR", "_CLOTH", "_LEATHER", "_STONEBLOCK"}
	for _, suffix := range resSuffixes {
		if strings.Contains(itemID, suffix) {
			return true
		}
	}
	return false
}

// Zapisuje/aktualizuje ceny w naszej bazie danych w pamięci
func updateLocalPrice(order *MarketOrder) {
	updateLocalPriceWithTime(order, time.Now())
}

func updateLocalPriceWithTime(order *MarketOrder, timestamp time.Time) {
	if order.ItemTypeID == "" {
		return
	}

	// Formatowanie ID przedmiotu z poziomem zaklęcia (np. T7_SHOES_PLATE_SET1@3)
	// Gra czasami zwraca czyste ID i osobno poziom zaklęcia w innym polu.
	// Frontend i kalkulator oczekują formatu z "@" na potrzeby prawidłowego mapowania i tłumaczenia nazw.
	if order.EnchantmentLevel > 0 && !strings.Contains(order.ItemTypeID, "@") {
		order.ItemTypeID = fmt.Sprintf("%s@%d", order.ItemTypeID, order.EnchantmentLevel)
	}

	if order.LocationID == "" {
		return
	}


	// Dodajemy do bufora ostatnich zamówień (Live Feed)
	recentOrdersMu.Lock()
	newRecent := RecentOrder{
		ItemTypeID:  order.ItemTypeID,
		LocationID:  order.LocationID,
		AuctionType: order.AuctionType,
		Price:       order.UnitPriceSilver,
		Quality:     order.QualityLevel,
		Enchantment: order.EnchantmentLevel,
		Amount:      order.Amount,
		CapturedAt:  time.Now().Format("15:04:05"),
	}
	// Dodajemy na początek (najnowsze pierwsze)
	recentOrders = append([]RecentOrder{newRecent}, recentOrders...)
	if len(recentOrders) > maxRecentOrders {
		recentOrders = recentOrders[:maxRecentOrders]
	}
	recentOrdersMu.Unlock()

	// Wysyłamy powiadomienie o nowym wpisie w Live Feed
	rawJSON, err := json.Marshal(map[string]interface{}{
		"type": "recent_order",
		"data": newRecent,
	})
	if err == nil {
		websocketHub.broadcast <- rawJSON
	}

	priceDBMu.Lock()
	defer priceDBMu.Unlock()

	key := fmt.Sprintf("%s_%d", order.ItemTypeID, order.QualityLevel)
	info, exists := priceDB[key]
	if !exists {
		info = &ItemPriceInfo{
			ItemTypeID:   order.ItemTypeID,
			IsResource:   isResource(order.ItemTypeID),
			Quality:      order.QualityLevel,
			Prices:       make(map[string]int64),
			Amount:       make(map[string]int),
			LastUpdate:   make(map[string]string),
			Offers:       make(map[string][]MarketOfferInfo),
		}
		priceDB[key] = info
	}

	// Inicjalizacja Offers jeśli brak (np. po wczytaniu starej bazy)
	if info.Offers == nil {
		info.Offers = make(map[string][]MarketOfferInfo)
	}

	// Formatujemy datę ostatniej aktualizacji
	nowStr := fmt.Sprintf("live %s", order.AuctionType) // live offer / live request

	// Dodajemy ofertę do listy wszystkich ofert (z limitem 20 na miasto i typ)
	newOffer := MarketOfferInfo{
		Price:       order.UnitPriceSilver,
		Amount:      order.Amount,
		AuctionType: order.AuctionType,
		LastUpdate:  nowStr,
		Timestamp:   timestamp,
	}

	// Sprawdzamy duplikaty w aktualnej sesji
	isDuplicate := false
	locKey := order.LocationID
	if order.LocationID == "3003" && order.AuctionType == "offer" {
		locKey = "3003_sell"
	}

	for i, off := range info.Offers[locKey] {
		if off.Price == newOffer.Price && off.Amount == newOffer.Amount {
			info.Offers[locKey][i].Timestamp = timestamp
			info.Offers[locKey][i].LastUpdate = nowStr
			isDuplicate = true
			break
		}
	}

	if !isDuplicate {
		info.Offers[locKey] = append(info.Offers[locKey], newOffer)
		if len(info.Offers[locKey]) > 20 {
			info.Offers[locKey] = info.Offers[locKey][1:]
		}
		markPriceDBModified()
	}

	// Logika wyboru NAJLEPSZEJ ceny dla kalkulatora (zachowanie kompatybilności i rozszerzenie o surowce)
	if order.LocationID == "3003" {
		if order.AuctionType == "request" {
			// Czarny Rynek - zlecenie kupna (BM kupuje od nas) - bierzemy najwyższe
			if currentPrice, exists := info.Prices[order.LocationID]; !exists || order.UnitPriceSilver > currentPrice {
				info.Prices[order.LocationID] = order.UnitPriceSilver
				info.Amount[order.LocationID] = order.Amount
				info.LastUpdate[order.LocationID] = nowStr
				markPriceDBModified()
			}
		} else if order.AuctionType == "offer" {
			// Czarny Rynek - zlecenie sprzedaży (gracze wystawiają na BM) - bierzemy najniższe
			locSell := "3003_sell"
			if currentPrice, exists := info.Prices[locSell]; !exists || order.UnitPriceSilver < currentPrice || currentPrice == 0 {
				info.Prices[locSell] = order.UnitPriceSilver
				info.Amount[locSell] = order.Amount
				info.LastUpdate[locSell] = nowStr
				markPriceDBModified()
			}
		}
	} else {
		// Miasto królewskie
		if order.AuctionType == "offer" {
			// Cena sprzedaży (Sell Offer) - interesuje nas najniższa (za ile możemy kupić)
			// Standardowy klucz dla kompatybilności
			if currentPrice, exists := info.Prices[order.LocationID]; !exists || order.UnitPriceSilver < currentPrice || currentPrice == 0 {
				info.Prices[order.LocationID] = order.UnitPriceSilver
				info.Amount[order.LocationID] = order.Amount
				info.LastUpdate[order.LocationID] = nowStr
				markPriceDBModified()
			}
			
			// Jeśli to surowiec, zapisujemy też pod jawnym kluczem _sell
			if info.IsResource {
				keySell := order.LocationID + "_sell"
				if currentPrice, exists := info.Prices[keySell]; !exists || order.UnitPriceSilver < currentPrice || currentPrice == 0 {
					info.Prices[keySell] = order.UnitPriceSilver
					info.Amount[keySell] = order.Amount
					info.LastUpdate[keySell] = nowStr
					markPriceDBModified()
				}
			}
		} else if order.AuctionType == "request" && info.IsResource {
			// Cena kupna (Buy Order / Request) - interesuje nas najwyższa (za ile możemy natychmiast sprzedać)
			keyBuy := order.LocationID + "_buy"
			if currentPrice, exists := info.Prices[keyBuy]; !exists || order.UnitPriceSilver > currentPrice {
				info.Prices[keyBuy] = order.UnitPriceSilver
				info.Amount[keyBuy] = order.Amount
				info.LastUpdate[keyBuy] = nowStr
				markPriceDBModified()
			}
		}
	}

	// Wysyłamy natychmiastowe powiadomienie przez WebSocket o zmianie ceny
	updateJSON, err := json.Marshal(map[string]interface{}{
		"type": "price_update",
		"data": info,
	})
	if err == nil {
		websocketHub.broadcast <- updateJSON
	}
}

var (
	priceDBModified   = false
	priceDBModifiedMu sync.Mutex
)

func markPriceDBModified() {
	priceDBModifiedMu.Lock()
	priceDBModified = true
	priceDBModifiedMu.Unlock()
}

var (
	currentRegion     = "Nieznany"
	currentRegionMu   sync.Mutex
)

func getDBFilenameForRegion(region string) string {
	switch region {
	case "Europa (EU)":
		return "prices_db_eu.json"
	case "Ameryka (West)":
		return "prices_db_na.json"
	case "Azja (East)":
		return "prices_db_as.json"
	default:
		return "prices_db.json"
	}
}

func loadPricesFromFilename(filename string) {
	priceDBMu.Lock()
	defer priceDBMu.Unlock()

	priceDB = make(map[string]*ItemPriceInfo)

	data, err := os.ReadFile(filename)
	if err != nil {
		log.Printf("[BAZA] Nie odnaleziono pliku bazy danych %s. Zostanie utworzona nowa baza dla tego regionu.", filename)
		return
	}

	err = json.Unmarshal(data, &priceDB)
	if err != nil {
		log.Printf("[BAZA] Błąd odczytu %s: %v. Tworzenie nowej bazy.", filename, err)
		return
	}

	log.Printf("[BAZA] Pomyślnie wczytano %d wpisów cen z bazy: %s!", len(priceDB), filename)
}

func savePricesToFilename(filename string) {
	priceDBMu.RLock()
	data, err := json.MarshalIndent(priceDB, "", "  ")
	priceDBMu.RUnlock()

	if err != nil {
		log.Printf("[BAZA] Błąd serializacji bazy danych: %v", err)
		return
	}

	err = os.WriteFile(filename, data, 0644)
	if err != nil {
		log.Printf("[BAZA] Błąd zapisu bazy danych %s: %v", filename, err)
	}
}

func loadPricesFromDB() {
	currentRegionMu.Lock()
	region := currentRegion
	currentRegionMu.Unlock()
	loadPricesFromFilename(getDBFilenameForRegion(region))
}

func savePricesToDB() {
	currentRegionMu.Lock()
	region := currentRegion
	currentRegionMu.Unlock()
	savePricesToFilename(getDBFilenameForRegion(region))
}

func onServerRegionChanged(newRegion string) {
	currentRegionMu.Lock()
	oldRegion := currentRegion
	currentRegion = newRegion
	currentRegionMu.Unlock()

	if oldRegion == newRegion {
		return
	}

	log.Printf("[BAZA] Przełączanie regionu bazy z '%s' na '%s'...", oldRegion, newRegion)

	if oldRegion != "Nieznany" {
		oldFilename := getDBFilenameForRegion(oldRegion)
		savePricesToFilename(oldFilename)
	}

	newFilename := getDBFilenameForRegion(newRegion)
	loadPricesFromFilename(newFilename)

	syncSignal, err := json.Marshal(map[string]interface{}{
		"type": "bulk_sync_completed",
	})
	if err == nil {
		websocketHub.broadcast <- syncSignal
	}
}

func startBackgroundDBCleaner() {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for range ticker.C {
			cleanOldPrices()
		}
	}()
}

func cleanOldPrices() {
	priceDBMu.Lock()
	defer priceDBMu.Unlock()

	now := time.Now()
	threshold := 24 * time.Hour
	removedCount := 0

	for itemKey, info := range priceDB {
		modified := false
		
		// Czyścimy oferty
		for locID, offers := range info.Offers {
			newOffers := []MarketOfferInfo{}
			for _, off := range offers {
				if now.Sub(off.Timestamp) < threshold {
					newOffers = append(newOffers, off)
				} else {
					modified = true
				}
			}
			
			if modified {
				info.Offers[locID] = newOffers
				// Jeśli po czyszczeniu nie ma ofert dla tego miasta, czyścimy też Price
				if len(newOffers) == 0 {
					delete(info.Prices, locID)
					delete(info.Amount, locID)
					delete(info.LastUpdate, locID)
				} else {
					// Aktualizujemy najlepszą cenę na podstawie pozostałych ofert
					var bestPrice int64 = 0
					var bestAmount int = 0
					var bestTime string = ""
					
					for _, off := range newOffers {
						if locID == "3003" { // BM Request - najwyższa
							if bestPrice == 0 || off.Price > bestPrice {
								bestPrice = off.Price; bestAmount = off.Amount; bestTime = off.LastUpdate
							}
						} else { // Inne - najniższa
							if bestPrice == 0 || off.Price < bestPrice {
								bestPrice = off.Price; bestAmount = off.Amount; bestTime = off.LastUpdate
							}
						}
					}
					info.Prices[locID] = bestPrice
					info.Amount[locID] = bestAmount
					info.LastUpdate[locID] = bestTime
				}
			}
		}

		// Jeśli przedmiot nie ma już ŻADNYCH ofert w ŻADNYM mieście, usuwamy go z bazy
		if len(info.Prices) == 0 {
			delete(priceDB, itemKey)
			removedCount++
		}
	}

	if removedCount > 0 {
		log.Printf("[DB] Usunięto %d nieaktualnych przedmiotów (TTL 24h)", removedCount)
		markPriceDBModified()
	}
}

func apiCleanOldPrices(w http.ResponseWriter, r *http.Request) {
	cleanOldPrices()
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func startBackgroundDBSaver() {
	ticker := time.NewTicker(3 * time.Second)
	go func() {
		for range ticker.C {
			priceDBModifiedMu.Lock()
			modified := priceDBModified
			if modified {
				priceDBModified = false
			}
			priceDBModifiedMu.Unlock()

			if modified {
				savePricesToDB()
			}
		}
	}()
}

func apiGetPrices(w http.ResponseWriter, r *http.Request) {
	priceDBMu.RLock()
	defer priceDBMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(priceDB)
}

func apiGetRecentOrders(w http.ResponseWriter, r *http.Request) {
	recentOrdersMu.RLock()
	defer recentOrdersMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(recentOrders)
}

func apiSetLocation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		LocationID string `json:"location_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	SetPlayerLocation(req.LocationID)
	log.Printf("[LOKALIZACJA] Ręcznie zmieniono strefę gracza na ID: %s", req.LocationID)

	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "location_id": req.LocationID})
}

func openBrowser(url string) {
	err := exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	if err != nil {
		log.Printf("[PRZEGLĄDARKA] Nie udało się automatycznie otworzyć przeglądarki: %v", err)
	}
}

func apiClearDB(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	priceDBMu.Lock()
	priceDB = make(map[string]*ItemPriceInfo)
	priceDBMu.Unlock()

	// Zapisujemy pustą bazę do pliku aktualnego regionu
	savePricesToDB()

	// Powiadamiamy frontend o wyczyszczeniu i potrzebie odświeżenia tabel
	syncSignal, err := json.Marshal(map[string]interface{}{
		"type": "bulk_sync_completed",
	})
	if err == nil {
		websocketHub.broadcast <- syncSignal
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Baza danych wyczyszczona pomyślnie"})

	log.Println("[BAZA] Ręcznie wyczyszczono całą bazę danych cen rynkowych dla aktywnego regionu!")
}

func apiSyncPrices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	region := GetServerRegion()
	subdomain := "west" // Domyślny region globalny

	if strings.Contains(region, "Europa") || strings.Contains(region, "EU") {
		subdomain = "europe"
	} else if strings.Contains(region, "Azja") || strings.Contains(region, "East") {
		subdomain = "east"
	}

	priceDBMu.RLock()
	var itemIDs []string
	// Zbieramy unikalne ID przedmiotów z obecnej bazy, żeby je zaktualizować (ograniczenie do 100 przedmiotów dla Albion Data API ze względu na limit URL)
	for _, item := range priceDB {
		itemIDs = append(itemIDs, item.ItemTypeID)
		if len(itemIDs) >= 100 {
			break
		}
	}
	priceDBMu.RUnlock()

	if len(itemIDs) == 0 {
		itemIDs = []string{"T4_BAG", "T5_BAG", "T4_CAPE", "T5_CAPE", "T4_MOUNT_HORSE", "T4_MOUNT_OX"}
	}

	updatedCount := 0

	if len(itemIDs) > 0 {
		itemList := strings.Join(itemIDs, ",")
		apiURL := fmt.Sprintf("https://%s.albion-online-data.com/api/v2/stats/prices/%s", subdomain, itemList)
		
		log.Printf("[API] Synchronizacja z: %s", apiURL)
		
		resp, err := http.Get(apiURL)
		if err == nil {
			defer resp.Body.Close()
			var data []struct {
				ItemID           string `json:"item_id"`
				City             string `json:"city"`
				Quality          int    `json:"quality"`
				SellPriceMin     int64  `json:"sell_price_min"`
				SellPriceMinDate string `json:"sell_price_min_date"`
				BuyPriceMax      int64  `json:"buy_price_max"`
				BuyPriceMaxDate  string `json:"buy_price_max_date"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
				for _, entry := range data {
					if entry.SellPriceMin > 0 {
						locID := "3003" // Default Caerleon/BlackMarket fallback, we should map city name to ID
						// Mapowanie angielskich nazw miast na ID
						cityMap := map[string]string{
							"Lymhurst": "3008", "Bridgewatch": "1004", "Martlock": "3002",
							"Thetford": "1002", "Fort Sterling": "2004", "Caerleon": "3005",
							"Brecilien": "5003", "Black Market": "3003",
						}
						if id, ok := cityMap[entry.City]; ok {
							locID = id
						}
						
						// Używamy tego samego mechanizmu do aktualizacji co sniffer
						order := MarketOrder{
							ItemTypeID:      entry.ItemID,
							QualityLevel:    entry.Quality,
							UnitPriceSilver: entry.SellPriceMin, // API już zwraca czyste srebro
							Amount:          1,
							AuctionType:     "offer",
							LocationID:      locID,
						}
						
						// Ustawiamy czas z API jeśli dostępny
						apiTime, _ := time.Parse(time.RFC3339, entry.SellPriceMinDate)
						if apiTime.IsZero() {
							apiTime = time.Now()
						}
						
						updateLocalPriceWithTime(&order, apiTime)
						updatedCount++
					}
					
					// Zlecenia kupna (Black Market itd)
					if entry.BuyPriceMax > 0 {
						locID := "3003"
						cityMap := map[string]string{
							"Lymhurst": "3008", "Bridgewatch": "1004", "Martlock": "3002",
							"Thetford": "1002", "Fort Sterling": "2004", "Caerleon": "3005",
							"Brecilien": "5003", "Black Market": "3003",
						}
						if id, ok := cityMap[entry.City]; ok {
							locID = id
						}
						
						order := MarketOrder{
							ItemTypeID:      entry.ItemID,
							QualityLevel:    entry.Quality,
							UnitPriceSilver: entry.BuyPriceMax, // API już zwraca czyste srebro
							Amount:          1,
							AuctionType:     "request",
							LocationID:      locID,
						}
						
						apiTime, _ := time.Parse(time.RFC3339, entry.BuyPriceMaxDate)
						if apiTime.IsZero() {
							apiTime = time.Now()
						}
						
						updateLocalPriceWithTime(&order, apiTime)
						updatedCount++
					}
				}
			}
		} else {
			log.Printf("[API BŁĄD] Nie udało się pobrać danych z Albion Data Project: %v", err)
		}
	}

	// Powiadamiamy interfejs
	syncSignal, _ := json.Marshal(map[string]interface{}{
		"type": "bulk_sync_completed",
	})
	websocketHub.broadcast <- syncSignal

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"prices_recorded": updatedCount,
	})
}

func main() {
	log.Println("Uruchamianie serwera Albion Market Profit Calculator...")

	// Wczytywanie zbuforowanej bazy danych rynkowych z pliku
	loadPricesFromDB()

	// Uruchomienie automatycznego zapisywania w tle co 3 sekundy
	startBackgroundDBSaver()
	startBackgroundDBCleaner()

	// Inicjalizacja WebSocket Hub
	websocketHub = newHub()
	go websocketHub.run()

	// Pobieranie osadzonego katalogu statycznego i serwowanie go jako "/"
	subFS, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("Błąd inicjalizacji osadzonych plików frontendu: %v", err)
	}
	fileServer := http.FileServer(http.FS(subFS))
	http.Handle("/", fileServer)

	// Endpointy API i WebSocket
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/api/prices", apiGetPrices)
	http.HandleFunc("/api/recent", apiGetRecentOrders)
	http.HandleFunc("/api/clear-db", apiClearDB)
	http.HandleFunc("/api/set-location", apiSetLocation)
	http.HandleFunc("/api/sync-prices", apiSyncPrices)
	http.HandleFunc("/api/clean-old", apiCleanOldPrices)
	http.HandleFunc("/api/interfaces", apiGetInterfaces)
	http.HandleFunc("/api/start-sniffer", apiStartSniffer)
	http.HandleFunc("/api/shutdown", apiShutdown)

	// Uruchomienie domyślnego sniffera w tle (automatyczne wykrywanie karty sieciowej)
	go startDefaultSniffer()

	port := 8080
	log.Printf("Serwer działa pod adresem: http://localhost:%d", port)

	// Automatycznie otwieramy przeglądarkę dla gracza po uruchomieniu aplikacji!
	go func() {
		time.Sleep(500 * time.Millisecond)
		log.Printf("[PRZEGLĄDARKA] Automatyczne otwieranie kalkulatora: http://localhost:%d", port)
		openBrowser(fmt.Sprintf("http://localhost:%d", port))
	}()

	err = http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
	if err != nil {
		log.Fatalf("Błąd serwera HTTP: %v", err)
	}
}

// apiShutdown bezpiecznie zamyka aplikację
func apiShutdown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	log.Println("[SHUTDOWN] Otrzymano żądanie zamknięcia aplikacji...")

	// Zapisz bazę danych przed zamknięciem
	savePricesToDB()

	json.NewEncoder(w).Encode(map[string]string{"status": "shutting_down"})

	// Zamknij proces po 500ms (daje czas na wysłanie odpowiedzi HTTP)
	go func() {
		time.Sleep(500 * time.Millisecond)
		log.Println("[SHUTDOWN] Zamykanie procesu...")
		os.Exit(0)
	}()
}
