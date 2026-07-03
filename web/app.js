/* ==========================================================================
   ALBION MARKET PROFIT CALCULATOR - INTERACTIVE FRONTEND LOGIC (JS)
   ========================================================================== */

// Globalna baza danych i stan aplikacji
let pricesData = {};
let interfacesList = [];
let selectedInterface = "";
let isPremium = true;
let isBuyOrder = false;
let currentBmMode = "buy"; // "buy" (Szybka sprzedaż) lub "sell" (Zlecenie sprzedaży)
let currentSlideIndex = 0; // 0: Szybka Sprzedaż, 1: Zlecenie Sprzedaży
let currentPage = 1;
const itemsPerPage = 20;
let cityPageStates = {}; // Przechowuje aktualną stronę dla każdej tabeli miejskiej, np. {'body-prices-3008': 1}

// Dane do Refiningu
const refiningResources = {
    // Raw -> Refined
    "WOOD": "PLANKS",
    "ORE": "METALBAR",
    "FIBER": "CLOTH",
    "HIDE": "LEATHER",
    "ROCK": "STONEBLOCK"
};

const refinedToRaw = {
    "PLANKS": "WOOD",
    "METALBAR": "ORE",
    "CLOTH": "FIBER",
    "LEATHER": "HIDE",
    "STONEBLOCK": "ROCK"
};

const refiningReturnRates = {
    "none": 0.152,
    "lymhurst": { resource: "WOOD", rate: 0.367 },
    "thetford": { resource: "ORE", rate: 0.367 },
    "martlock": { resource: "HIDE", rate: 0.367 },
    "fort-sterling": { resource: "FIBER", rate: 0.367 },
    "bridgewatch": { resource: "ROCK", rate: 0.367 }
};

const refiningRatios = {
    "T2": { raw: 1, prev: 0 },
    "T3": { raw: 2, prev: 1 },
    "T4": { raw: 2, prev: 1 },
    "T5": { raw: 3, prev: 1 },
    "T6": { raw: 4, prev: 1 },
    "T7": { raw: 5, prev: 1 },
    "T8": { raw: 5, prev: 1 }
};

// Słownik mapowania ID przedmiotów z gry na piękne polskie nazwy (zgodne z polskim klientem)
const itemTranslations = {
    // Torby i akcesoria
    "BAG": "Bag",
    "BAG_INSIGHT": "Bag of Insight",
    "CAPE": "Cape",
    "CAPEITEM_FW_LYMHURST": "Lymhurst Cape",
    "CAPEITEM_FW_FORTSTERLING": "Fort Sterling Cape",
    "CAPEITEM_FW_THETFORD": "Thetford Cape",
    "CAPEITEM_FW_MARTLOCK": "Martlock Cape",
    "CAPEITEM_FW_BRIDGEWATCH": "Bridgewatch Cape",
    "CAPEITEM_FW_CAERLEON": "Caerleon Cape",
    "CAPEITEM_HERETIC": "Heretic Cape",
    "CAPEITEM_UNDEAD": "Undead Cape",
    "CAPEITEM_KEEPER": "Keeper Cape",
    "CAPEITEM_MORGANA": "Morgana Cape",
    "CAPEITEM_DEMON": "Demon Cape",
    
    // Zbroje płytowe (Plate - Wojownik)
    "ARMOR_PLATE": "Guardian Armor",
    "HEAD_PLATE": "Guardian Helmet",
    "SHOES_PLATE": "Guardian Boots",
    "ARMOR_PLATE_SET1": "Soldier Armor",
    "HEAD_PLATE_SET1": "Soldier Helmet",
    "SHOES_PLATE_SET1": "Soldier Boots",
    "ARMOR_PLATE_SET2": "Knight Armor",
    "HEAD_PLATE_SET2": "Knight Helmet",
    "SHOES_PLATE_SET2": "Knight Boots",
    "ARMOR_PLATE_SET3": "Graveguard Armor",
    "HEAD_PLATE_SET3": "Graveguard Helmet",
    "SHOES_PLATE_SET3": "Graveguard Boots",

    // Kurtki skórzane (Leather - Łowca)
    "ARMOR_LEATHER": "Mercenary Jacket",
    "HEAD_LEATHER": "Mercenary Hood",
    "SHOES_LEATHER": "Mercenary Shoes",
    "ARMOR_LEATHER_SET1": "Hunter Jacket",
    "HEAD_LEATHER_SET1": "Hunter Hood",
    "SHOES_LEATHER_SET1": "Hunter Shoes",
    "ARMOR_LEATHER_SET2": "Assassin Jacket",
    "HEAD_LEATHER_SET2": "Assassin Hood",
    "SHOES_LEATHER_SET2": "Assassin Shoes",
    "ARMOR_LEATHER_SET3": "Hellion Jacket",
    "HEAD_LEATHER_SET3": "Hellion Hood",
    "SHOES_LEATHER_SET3": "Hellion Shoes",

    // Szaty materiałowe (Cloth - Mag)
    "ARMOR_CLOTH": "Cleric Robe",
    "HEAD_CLOTH": "Cleric Cowl",
    "SHOES_CLOTH": "Cleric Sandals",
    "ARMOR_CLOTH_SET1": "Scholar Robe",
    "HEAD_CLOTH_SET1": "Scholar Cowl",
    "SHOES_CLOTH_SET1": "Scholar Sandals",
    "ARMOR_CLOTH_SET2": "Mage Robe",
    "HEAD_CLOTH_SET2": "Mage Cowl",
    "SHOES_CLOTH_SET2": "Mage Sandals",
    "ARMOR_CLOTH_SET3": "Cultist Robe",
    "HEAD_CLOTH_SET3": "Cultist Cowl",
    "SHOES_CLOTH_SET3": "Cultist Sandals",

    // Miecze (Swords)
    "MAIN_SWORD": "Broadsword",
    "2H_CLAYMORE": "Claymore",
    "2H_DUALSWORD": "Dual Swords",
    "2H_CLEAVER_HELL": "Carving Sword",
    
    // Łuki (Bows)
    "MAIN_BOW": "Bow",
    "2H_WARBOW": "Warbow",
    "2H_LONGBOW": "Longbow",
    "2H_BOW_HELL": "Whispering Bow",

    // Kostury (Staffs)
    "MAIN_FIRESTAFF": "Fire Staff",
    "2H_FIRESTAFF": "Great Fire Staff",
    "MAIN_HOLYSTAFF": "Holy Staff",
    "2H_HOLYSTAFF": "Great Holy Staff",
    "MAIN_NATURESTAFF": "Nature Staff",
    "2H_NATURESTAFF": "Great Nature Staff",
    "MAIN_CURSESTAFF": "Cursed Staff",
    "2H_CURSESTAFF": "Great Cursed Staff",

    // Topory, Włócznie, Sztylety, Buławy i Młoty
    "MAIN_AXE": "Battleaxe",
    "2H_HALBERD": "Halberd",
    "2H_SCYTHE": "Infernal Scythe",
    "MAIN_SPEAR": "Spear",
    "2H_GLAIVE": "Glaive",
    "MAIN_DAGGER": "Dagger",
    "2H_DAGGERPAIR": "Dagger Pair",
    "2H_CLAW": "Claws",
    "MAIN_MACE": "Mace",
    "2H_MACE": "Heavy Mace",
    "2H_HAMMER": "Great Hammer",
    "2H_POLEHAMMER": "Polehammer"
};

// Słownik oficjalnych prefiksów Tierów z oryginalnej wersji gry
const tierPrefixes = {
    "T4": "Adept's",
    "T5": "Expert's",
    "T6": "Master's",
    "T7": "Grandmaster's",
    "T8": "Elder's"
};

// Słownik mapowania ID lokalizacji na czytelne nazwy miast
const locationIDToName = {
    "3003": "Black Market",
    "3005": "Caerleon",
    "3008": "Lymhurst",
    "2004": "Fort Sterling",
    "1002": "Thetford",
    "3002": "Martlock",
    "1004": "Bridgewatch",
    "5003": "Brecilien"
};

const locationIDToSlug = {
    "3008": "lymhurst",
    "1004": "bridgewatch",
    "3002": "martlock",
    "1002": "thetford",
    "2004": "fort-sterling",
    "3005": "caerleon",
    "5003": "brecilien"
};

const cityIdToIcon = {
    "3008": "tree-pine",
    "1004": "compass",
    "3002": "shield",
    "1002": "droplet",
    "2004": "snowflake",
    "3005": "skull",
    "5003": "sparkles"
};

// Funkcja tłumacząca surowy ID przedmiotu z gry na piękną oryginalną nazwę (z uwzględnieniem Tieru i Zaklęcia)
function translateItem(itemID) {
    // format itemID: np. T4_BAG, T5_ARMOR_PLATE@1, T6_CAPEITEM_FW_LYMHURST@2
    const cleanID = itemID.split('@')[0];
    const parts = cleanID.split('_');
    if (parts.length < 2) return itemID;

    const tier = parts[0]; // T4, T5, itp.
    const baseID = parts.slice(1).join('_'); // np. BAG, ARMOR_PLATE_SET1, itp.

    const englishBase = itemTranslations[baseID] || baseID.replace(/_/g, " ");
    const tierName = tierPrefixes[tier] || tier;
    
    // Dodajemy oznaczenie zaklęcia (.1, .2, itp.) na koniec, aby gracz od razu widział wersję przedmiotu
    const enchantNum = itemID.includes('@') ? itemID.split('@')[1] : "0";
    const enchantSuffix = enchantNum !== "0" ? `.${enchantNum}` : "";

    return `${tierName} ${englishBase} (${tier}${enchantSuffix})`;
}

// Funkcja formatująca duże liczby (np. 154500 -> 154 500)
function formatSilver(amount) {
    if (amount === undefined || amount === null || amount === 0) return "-";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Funkcja formatująca srebro na skrócony zapis (np. 1.45M, 85k)
function formatShortSilver(amount) {
    if (amount === undefined || amount === null || amount === 0) return "0";
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
    }
    if (amount >= 1000) {
        return (amount / 1000).toFixed(1).replace(/\.?0+$/, "") + "k";
    }
    return amount.toString();
}

/* ==========================================================================
   KOMUNIKACJA SIECIOWA: WEBSOCKET & REST API
   ========================================================================== */

let ws;
function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        addConsoleLog("[WEBSOCKET] Próba połączenia...", "system");
        ws = new WebSocket(wsUrl);
    } catch (e) {
        console.error("WebSocket construction failed:", e);
        addConsoleLog("[BŁĄD WS] Nie udało się zainicjować połączenia: " + e.message, "error");
        return;
    }

    let isUiUpdatePending = false;
    let packetCountBuffer = 0;

    ws.onopen = function() {
        document.getElementById("network-indicator").className = "status-indicator connected";
        document.getElementById("network-status-val").innerText = "Połączony";
        addConsoleLog("[WEBSOCKET] Połączono z serwerem Go. Oczekiwanie na dane...", "success");
    };

    ws.onmessage = function(event) {
        const msg = JSON.parse(event.data);

        if (msg.type === "price_update") {
            const info = msg.data;
            const key = `${info.item_id}_${info.quality}`;
            pricesData[key] = info;

            packetCountBuffer++;

            // Throttling aktualizacji UI do 1 sekundy, aby nie zabić przeglądarki przy tysiącach pakietów
            if (!isUiUpdatePending) {
                isUiUpdatePending = true;
                setTimeout(() => {
                    if (packetCountBuffer > 0) {
                        addConsoleLog(`[LIVE] Zaktualizowano ${packetCountBuffer} ofert w tle...`, "packet");
                        packetCountBuffer = 0;
                    }
                    updateTable();
                    renderCityTabs();
                    renderRefiningTable();
                    isUiUpdatePending = false;
                }, 1000);
            }
        } else if (msg.type === "recent_order") {
            const order = msg.data;
            addLiveFeedRow(order, true);
            if (order.location_id === "3003") {
                addBlackMarketRow(order, true);
            }
        } else if (msg.type === "bulk_sync_completed") {
            addConsoleLog("[API] Zakończono zbiorczą synchronizację cen rynkowych.", "success");
            fetchPrices();
        } else if (msg.type === "location_update") {
            const locID = msg.data;
            const locName = locationIDToName[locID] || locID;
            addConsoleLog(`[STREFA] Wykryto automatyczną zmianę strefy gracza na: ${locName}`, "info");
            
            // Aktualizuj dropdown
            const sel = document.getElementById("select-manual-city");
            if (sel) sel.value = locID;

            // POWIADOMIENIE OD DRUIDA
            const comment = druidCityComments[locID] || `Widzę, że dotarłeś do ${locName}. Niech natura Ci sprzyja w handlu!`;
            showWizardBubble(`🌿 ${locName}`, comment, 8000); // Zamknij po 8s

        } else if (msg.type === "location_suggestion") {
            const suggestedID = msg.data;
            const suggestedName = locationIDToName[suggestedID] || suggestedID;
            const currentCitySelect = document.getElementById("select-manual-city");
            const currentVal = currentCitySelect ? currentCitySelect.value : "";
            
            // Nie pytaj, jeśli już ustawione na to samo miasto
            if (currentVal !== suggestedID) {
                addConsoleLog(`[AUTO-LOKALIZACJA] Wykryto przeglądanie marketu w: ${suggestedName}`, "info");
                // Gandalf pyta użytkownika!
                wizardAskLocation(suggestedID, suggestedName);
            }
        } else if (msg.type === "zone_suggestion") {
            // Gracz zmienił strefę (wszedł do klastra miasta)
            const zoneID = msg.data.zone_id;
            const suggestID = msg.data.suggest_id;
            const zoneName = locationIDToName[zoneID] || zoneID;
            const suggestName = locationIDToName[suggestID] || suggestID;
            
            const currentCitySelect = document.getElementById("select-manual-city");
            const currentVal = currentCitySelect ? currentCitySelect.value : "";
            
            if (currentVal !== suggestID) {
                addConsoleLog(`[STREFA] Gracz wszedł do klastra: ${zoneName}`, "info");
                
                // Specjalny komunikat dla Caerleonu
                if (zoneID === "3005" && suggestID === "3003") {
                    wizardAskZoneChange(suggestID, suggestName, 
                        `🏰 Właśnie wszedłeś do <strong style="color: var(--color-accent);">Caerleonu</strong>! Ustawić <strong style="color: #ffaa00;">Black Market</strong> jako Twoje aktywne miasto?`,
                        "Black Market"
                    );
                } else {
                    wizardAskZoneChange(suggestID, suggestName,
                        `🏰 Właśnie wszedłeś do <strong style="color: var(--color-accent);">${suggestName}</strong>! Ustawić rynek tego miasta?`,
                        suggestName
                    );
                }
            }
        } else if (msg.type === "packet_count_update") {
            document.getElementById("packet-count-val").innerText = msg.data;
        } else if (msg.type === "server_region_update") {
            document.getElementById("server-region-val").innerText = msg.data;

        } else if (msg.type === "backend_log") {
            addConsoleLog(`[SERWER] ${msg.data.text}`, msg.data.type);
        }
    };

    ws.onclose = function() {
        document.getElementById("network-indicator").className = "status-indicator";
        document.getElementById("network-status-val").innerText = "Rozłączony";
        addConsoleLog("[WEBSOCKET] Połączenie zerwane. Próba ponownego połączenia za 3 sekundy...", "system");
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = function(err) {
        console.error("WebSocket Error:", err);
    };
}

// Pobieranie aktualnie zbuforowanych cen z backendu
function fetchPrices() {
    fetch("/api/prices")
        .then(response => response.json())
        .then(data => {
            pricesData = data;
            updateTable();
            renderCityTabs();
            updateTotalPotentialProfit();
        })
        .catch(err => {
            console.error("Błąd pobierania cen:", err);
            addConsoleLog("[BŁĄD] Nie udało się załadować zbuforowanych cen z serwera.", "system");
        });
}

// Pobieranie listy kart sieciowych
function fetchInterfaces() {
    console.log("Fetching interfaces...");
    const select = document.getElementById("select-interface");
    if (!select) {
        console.error("select-interface element not found!");
        return;
    }

    if (typeof addConsoleLog === "function") {
        addConsoleLog("[SYSTEM] Wyszukiwanie kart sieciowych...", "info");
    }

    fetch("/api/interfaces")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Interfaces received:", data);
            interfacesList = data;
            select.innerHTML = "";

            if (!data || data.length === 0) {
                select.innerHTML = `<option value="">Brak kart (Uruchom jako Admin!)</option>`;
                if (typeof addConsoleLog === "function") {
                    addConsoleLog("[OSTRZEŻENIE] Nie znaleziono kart sieciowych. Sprawdź sterownik Npcap i uprawnienia Admina.", "warning");
                }
                return;
            }

            data.forEach(dev => {
                const opt = document.createElement("option");
                opt.value = dev.name;
                const desc = dev.description || dev.name;
                const shortDesc = desc.length > 50 ? desc.substring(0, 47) + "..." : desc;
                const ip = dev.ips && dev.ips.length > 0 ? ` (${dev.ips[0]})` : "";
                opt.textContent = shortDesc + ip;
                if (dev.is_active) {
                    opt.selected = true;
                    selectedInterface = dev.name;
                    
                    // Aktualizujemy status sniffera w UI jeśli to możliwe
                    const statusText = document.getElementById("sniffer-status-text");
                    if (statusText) {
                        statusText.innerText = "Aktywny";
                        statusText.style.color = "var(--color-success)";
                    }
                }
                select.appendChild(opt);
            });

            if (typeof addConsoleLog === "function") {
                addConsoleLog(`[SYSTEM] Znaleziono ${data.length} kart sieciowych.`, "success");
            }
            if (typeof lucide !== "undefined") lucide.createIcons();
        })
        .catch(err => {
            console.error("Błąd pobierania interfejsów:", err);
            if (select) select.innerHTML = '<option value="">Błąd połączenia z backendem</option>';
            if (typeof addConsoleLog === "function") {
                addConsoleLog(`[BŁĄD] Nie udało się pobrać listy kart: ${err.message}`, "error");
            }
        });
}

/* ==========================================================================
   LOGIKA KALKULATORA I RENDEROWANIA
   ========================================================================== */

// Funkcja dodająca wpis do czarnego terminala logów
function addConsoleLog(text, type = "info") {
    const consoleBox = document.getElementById("console-logs");
    const line = document.createElement("div");
    line.className = `console-line ${type}`;
    
    const timeStr = new Date().toLocaleTimeString();
    line.innerText = `[${timeStr}] ${text}`;
    
    consoleBox.appendChild(line);
    consoleBox.scrollTop = consoleBox.scrollHeight;

    // Ograniczamy liczbę linii do 50, aby jeszcze bardziej odciążyć RAM
    while (consoleBox.children.length > 50) {
        consoleBox.removeChild(consoleBox.firstChild);
    }
}

// Pobieranie listy ostatnich przechwyconych zamówień przy starcie
function fetchRecentOrders() {
    fetch("/api/recent")
        .then(r => r.json())
        .then(orders => {
            if (!orders || orders.length === 0) return;
            // Renderujemy całą listę (najnowsze pierwsze, już posortowane przez backend)
            orders.forEach(order => {
                addLiveFeedRow(order, false);
                if (order.location_id === "3003") {
                    addBlackMarketRow(order, false);
                }
            });
        })
        .catch(() => {});
}

// Dodaje wiersz do tabeli Live Feed lub go aktualizuje, licząc zysk z transportu na Czarny Rynek
let liveFeedCount = 0;
function addLiveFeedRow(order, isNew) {
    const tbody = document.getElementById("live-feed-body");
    if (!tbody) return;

    // Usuń placeholder jeśli istnieje
    const placeholder = tbody.querySelector(".table-placeholder");
    if (placeholder) placeholder.closest("tr").remove();

    // Generujemy unikalne ID dla kombinacji: przedmiot, miasto, typ oferty i jakość
    const rowId = `feed-row-${order.item_id}-${order.location_id}-${order.auction_type}-${order.quality}`.replace(/[^a-zA-Z0-9-]/g, "_");
    let existingRow = document.getElementById(rowId);

    const key = `${order.item_id}_${order.quality}`;
    const cachedItem = pricesData[key];

    let buyPrice = 0;
    let buyCityName = "";
    let buyTime = "";
    let bmPrice = 0;
    let bmTime = "";

    if (order.location_id === "3003") {
        // Zdarzenie pochodzi z Czarnego Rynku (Cena sprzedaży)
        bmPrice = order.price;
        bmTime = order.captured_at;

        // Szukamy najlepszej ceny zakupu w miastach królewskich z pamięci podręcznej
        let bestCityPrice = 0;
        let bestCityID = "";
        let bestCityTime = "";
        if (cachedItem) {
            for (const locID in cachedItem.prices) {
                if (locID === "3003") continue;
                const price = cachedItem.prices[locID] || 0;
                if (price > 0 && (bestCityPrice === 0 || price < bestCityPrice)) {
                    bestCityPrice = price;
                    bestCityID = locID;
                    bestCityTime = cachedItem.last_update[locID] || "brak";
                }
            }
        }

        if (bestCityPrice > 0) {
            buyPrice = bestCityPrice;
            buyCityName = locationIDToName[bestCityID] || "Miasto";
            buyTime = bestCityTime;
        } else {
            buyPrice = 0;
            buyCityName = "Brak cen w miastach";
            buyTime = "-";
        }
    } else {
        // Zdarzenie pochodzi z miasta królewskiego (Cena zakupu)
        buyPrice = order.price;
        buyCityName = locationIDToName[order.location_id] || order.location_id;
        buyTime = order.captured_at;

        // Pobieramy cenę Czarnego Rynku z pamięci podręcznej
        bmPrice = (cachedItem && cachedItem.prices["3003"]) || 0;
        bmTime = (cachedItem && cachedItem.last_update["3003"]) || "brak";
    }

    // Obliczenia profitu
    let bmTax = "-";
    let netProfit = "-";
    let roi = "-";
    let profitClass = "";
    let roiClass = "";

    if (buyPrice > 0 && bmPrice > 0) {
        const bmTaxRate = isPremium ? 0.04 : 0.08;
        const taxVal = Math.round(bmPrice * bmTaxRate);
        const royalSetupFee = Math.round(buyPrice * 0.015);
        const profitVal = bmPrice - taxVal - buyPrice - royalSetupFee;
        const roiVal = (profitVal / (buyPrice + royalSetupFee)) * 100;

        bmTax = `-${formatSilver(taxVal)}`;
        netProfit = `${profitVal >= 0 ? '+' : ''}${formatSilver(profitVal)}`;
        roi = `${roiVal.toFixed(1)}%`;

        profitClass = profitVal >= 0 ? "profit-plus" : "profit-minus";
        if (roiVal >= 25) {
            roiClass = "roi-high";
        } else if (roiVal >= 10) {
            roiClass = "roi-mid";
        } else {
            roiClass = "roi-low";
        }
    }

    const itemName = translateItem(order.item_id);
    const imgUrl = `https://render.albiononline.com/v1/item/${order.item_id}.png?quality=${order.quality}`;
    const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
    const qualityName = qualityNames[order.quality] || `Quality ${order.quality}`;

    // Wewnętrzny kod HTML rzędu (identyczny z Profit Calculatorem!)
    const rowInnerHTML = `
        <td>
            <div class="item-cell">
                <div class="item-img-wrapper">
                    <img src="${imgUrl}" alt="${itemName}" class="item-icon" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                </div>
                <div class="item-meta">
                    <span class="item-name">${itemName}</span>
                    <span class="badge badge-tier" style="margin-top: 4px; display: inline-block;">${qualityName}</span>
                </div>
            </div>
        </td>
        <td>
            <div class="price-value">
                <span class="price-silver">${formatSilver(buyPrice)} <small>sreb.</small></span>
                <span class="price-city">${buyCityName}</span>
                <span class="price-sub">${buyTime}</span>
            </div>
        </td>
        <td>
            <div class="price-value">
                <span class="price-silver" style="color: #ffaa00;">${formatSilver(bmPrice)} <small>sreb.</small></span>
                <span class="price-city">Black Market</span>
                <span class="price-sub">${bmTime}</span>
            </div>
        </td>
        <td>
            <span class="price-sub" style="color: #ff5f56; font-family: var(--font-mono); font-weight: bold;">${bmTax}</span>
        </td>
        <td>
            <span class="profit-value ${profitClass}">${netProfit}</span>
        </td>
        <td>
            <span class="roi-value ${roiClass}">${roi}</span>
        </td>
        <td class="feed-time">${order.captured_at}</td>
    `;

    // Istniejący wiersz - sprawdzamy czas w oknie 5s
    if (existingRow) {
        const timeDiff = new Date() - new Date(existingRow.dataset.lastUpdatedTime || 0);
        let currentPrice = parseInt(existingRow.querySelector(".price-silver")?.textContent?.replace(/[^0-9]/g, "")) || 0;

        let shouldUpdate = false;
        if (timeDiff > 5000) {
            shouldUpdate = true;
        } else {
            // Chcemy najniższy koszt zakupu dla miasta królewskiego, lub najwyższą sprzedaż dla BM
            if (order.location_id === "3003") {
                if (order.price > currentPrice || currentPrice === 0) {
                    shouldUpdate = true;
                }
            } else {
                if (order.price < currentPrice || currentPrice === 0) {
                    shouldUpdate = true;
                }
            }
        }

        if (shouldUpdate) {
            existingRow.innerHTML = rowInnerHTML;
            existingRow.dataset.lastUpdatedTime = new Date().toISOString();

            existingRow.classList.remove("feed-row-new");
            if (isNew) {
                requestAnimationFrame(() => existingRow.classList.add("feed-row-new"));
            }
        }

        tbody.insertBefore(existingRow, tbody.firstChild);
        lucide.createIcons();
        return;
    }

    // Tworzenie nowego wiersza
    const row = document.createElement("tr");
    row.id = rowId;
    row.dataset.lastUpdatedTime = new Date().toISOString();
    if (isNew) row.classList.add("feed-row-new");

    row.innerHTML = rowInnerHTML;
    tbody.insertBefore(row, tbody.firstChild);

    // Limit 50 wpisów w Live Feed, aby drastycznie oszczędzać RAM
    while (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }

    if (isNew) {
        liveFeedCount++;
        const badge = document.getElementById("live-feed-count");
        if (badge) badge.textContent = liveFeedCount;
    }
    lucide.createIcons();
}

// Dodaje wiersz do tabeli Black Market (zlecenia kupna Czarnego Rynku)
let blackMarketCount = 0;
function addBlackMarketRow(order, isNew) {
    const tbody = document.getElementById("black-market-body");
    if (!tbody) return;

    // Usuń placeholder jeśli istnieje
    const placeholder = tbody.querySelector(".table-placeholder");
    if (placeholder) placeholder.closest("tr").remove();

    // Generujemy unikalne ID dla Black Market: przedmiot i jakość
    const rowId = `bm-row-${order.item_id}-${order.quality}`.replace(/[^a-zA-Z0-9-]/g, "_");
    let existingRow = document.getElementById(rowId);

    const itemName = translateItem(order.item_id);
    const imgUrl = `https://render.albiononline.com/v1/item/${order.item_id}.png?quality=${order.quality}`;
    const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
    const qualityName = qualityNames[order.quality] || `Quality ${order.quality}`;

    const rowInnerHTML = `
        <td>
            <div class="item-cell">
                <div class="item-img-wrapper">
                    <img src="${imgUrl}" alt="${itemName}" class="item-icon" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                </div>
                <div class="item-meta">
                    <span class="item-name">${itemName}</span>
                    <span class="item-id">${order.item_id}</span>
                </div>
            </div>
        </td>
        <td>
            <span class="price-silver" style="color: #ffaa00; font-weight: bold; font-family: var(--font-mono);">${formatSilver(order.price)} <small>sreb.</small></span>
        </td>
        <td class="bm-amount" style="font-weight: bold; font-family: var(--font-mono);">${order.amount}</td>
        <td>
            <span class="badge badge-tier">${qualityName}</span>
        </td>
        <td class="bm-time">${order.captured_at}</td>
    `;

    if (existingRow) {
        const currentPrice = parseInt(existingRow.querySelector(".price-silver")?.textContent?.replace(/[^0-9]/g, "")) || 0;
        const timeDiff = new Date() - new Date(existingRow.dataset.lastUpdatedTime || 0);
        let shouldUpdate = false;
        
        // Zawsze aktualizujemy jeśli nowa cena jest wyższa (lepsze zlecenie BM) lub po 5s
        if (timeDiff > 5000 || order.price > currentPrice || currentPrice === 0) {
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            existingRow.innerHTML = rowInnerHTML;
            existingRow.dataset.lastUpdatedTime = new Date().toISOString();

            existingRow.classList.remove("feed-row-new");
            if (isNew) {
                requestAnimationFrame(() => existingRow.classList.add("feed-row-new"));
            }
        }

        tbody.insertBefore(existingRow, tbody.firstChild);
        lucide.createIcons();
        return;
    }

    // Tworzenie nowego wiersza
    const row = document.createElement("tr");
    row.id = rowId;
    row.dataset.lastUpdatedTime = new Date().toISOString();
    if (isNew) row.classList.add("feed-row-new");

    row.innerHTML = rowInnerHTML;
    tbody.insertBefore(row, tbody.firstChild);

    // Limit 100 (zmniejszony z 200 dla oszczędności RAM)
    while (tbody.children.length > 100) {
        tbody.removeChild(tbody.lastChild);
    }

    if (isNew) {
        blackMarketCount++;
        const badge = document.getElementById("black-market-count");
        if (badge) badge.textContent = blackMarketCount;
    }
    lucide.createIcons();
}


// Główna funkcja filtrująca, sortująca i generująca tabelę
function updateTable(highlightKey = null, resetPage = false) {
    if (resetPage) currentPage = 1;
    const tableBody = document.getElementById("profit-table-body");
    
    // Pobieramy wartości filtrów
    const searchQuery = document.getElementById("filter-search").value.toLowerCase();
    const cityFilter = document.getElementById("filter-city").value;
    const tierFilter = document.getElementById("filter-tier").value;
    const enchantmentFilter = document.getElementById("filter-enchantment").value;
    const qualityFilter = document.getElementById("filter-quality").value;
    const sortBy = document.getElementById("filter-sort").value;
    const isResourcesOnly = document.getElementById("filter-resources-only").checked;

    const itemsArray = [];

    // Przetwarzamy naszą bazę cen
    for (const key in pricesData) {
        const item = pricesData[key];
        const bmBuyPrice = item.prices["3003"] || 0;       // Czarny Rynek (Zlecenia kupna)
        const bmSellPrice = item.prices["3003_sell"] || 0;  // Czarny Rynek (Zlecenia sprzedaży)

        // Filtrujemy na podstawie wybranego trybu Czarnego Rynku (Szybka sprzedaż / Zlecenie sprzedaży)
        if (currentBmMode === "buy" && bmBuyPrice === 0) continue;
        if (currentBmMode === "sell" && bmSellPrice === 0) continue;

        // Szukamy najlepszej ceny zakupu w miastach królewskich
        let bestCityID = "";
        let bestCityPrice = 0;
        let bestCityTime = "";

        for (const locID in item.prices) {
            if (locID === "3003" || locID === "3003_sell") continue; // Pomijamy Czarny Rynek przy zakupie

            // Filtrujemy po wybranym mieście królewskim
            if (cityFilter !== "all" && locID !== cityFilter) continue;

            const price = item.prices[locID] || 0;
            if (price > 0) {
                if (bestCityPrice === 0 || price < bestCityPrice) {
                    bestCityPrice = price;
                    bestCityID = locID;
                    bestCityTime = item.last_update[locID] || "brak";
                }
            }
        }

        // Jeśli nie znaleźliśmy ceny zakupu, pomijamy
        if (bestCityPrice === 0) continue;

        // Filtrowanie po tekście (nazwa przedmiotu lub surowy ID)
        const polishName = translateItem(item.item_id);
        if (searchQuery && !polishName.toLowerCase().includes(searchQuery) && !item.item_id.toLowerCase().includes(searchQuery)) {
            continue;
        }

        // Filtrowanie TYLKO SUROWCE
        if (isResourcesOnly && !item.is_resource) {
            continue;
        }

        // Filtrowanie po Tierze (T4, T5, itp.)
        if (tierFilter !== "all" && !item.item_id.startsWith(tierFilter)) {
            continue;
        }

        // Filtrowanie po poziomie zaklęcia (.0 - .4)
        let itemEnchantment = "0";
        if (item.item_id.includes("@")) {
            itemEnchantment = item.item_id.split("@")[1];
        }
        if (enchantmentFilter !== "all" && itemEnchantment !== enchantmentFilter) {
            continue;
        }

        // Filtrowanie po jakości (1 - 5)
        if (qualityFilter !== "all" && item.quality.toString() !== qualityFilter) {
            continue;
        }

        // NOWOŚĆ: Filtrowanie TYLKO ZYSKOWNE (Oszczędność RAM)
        const isProfitableOnly = document.getElementById("filter-profitable-only").checked;
        const bmTaxRate = isPremium ? 0.04 : 0.08;
        
        // Zgrubne oszacowanie opłaty za wystawienie (setup fee) w mieście
        const royalSetupFee = isBuyOrder ? Math.round(bestCityPrice * 0.015) : 0;
        const totalCost = bestCityPrice + royalSetupFee;

        const maxItemProfit = Math.max(bmBuyPrice > 0 ? (bmBuyPrice - Math.round(bmBuyPrice * bmTaxRate) - totalCost) : -1, 
                                       bmSellPrice > 0 ? (bmSellPrice - 1 - Math.round(bmSellPrice * bmTaxRate) - totalCost) : -1);
        
        if (isProfitableOnly && maxItemProfit <= 0) {
            continue;
        }

        // OBLICZENIA MATEMATYCZNE PROFITU DLA WSZYSTKICH MIAST I OFERT
        const offers = [];
        let bmPrice = 0;
        let bmTime = "brak";

        if (currentBmMode === "buy") {
            bmPrice = bmBuyPrice;
            bmTime = item.last_update["3003"] || "brak";
        } else {
            bmPrice = bmSellPrice;
            bmTime = item.last_update["3003_sell"] || "brak";
        }

        const bmNetTarget = bmPrice - Math.round(bmPrice * bmTaxRate);

        // Jeśli mamy listę wielu ofert z backendu, iterujemy po nich wszystkich
        if (item.offers) {
            for (const locID in item.offers) {
                if (locID === "3003" || locID === "3003_sell") continue;
                if (cityFilter !== "all" && locID !== cityFilter) continue;

                const cityOffersList = item.offers[locID] || [];
                cityOffersList.forEach(off => {
                    // W miastach królewskich szukamy tylko ofert sprzedaży (buy from market)
                    if (off.auction_type !== "offer") return;

                    const cityPrice = off.price || 0;
                    if (cityPrice <= 0) return;

                    let royalSetupFee = 0;
                    if (isBuyOrder) {
                        royalSetupFee = Math.round(cityPrice * 0.015);
                    }
                    const totalCost = cityPrice + royalSetupFee;
                    const netProfit = bmNetTarget - totalCost;
                    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
                    const amount = off.amount || 0;

                    offers.push({
                        locID: locID,
                        cityName: locationIDToName[locID] || "Miasto",
                        price: cityPrice,
                        setupFee: royalSetupFee,
                        netProfit: netProfit,
                        roi: roi,
                        amount: amount,
                        time: off.last_update || "brak"
                    });
                });
            }
        } else {
            // Fallback dla starej bazy (pojedyncze ceny)
            for (const locID in item.prices) {
                if (locID === "3003" || locID === "3003_sell") continue;
                if (cityFilter !== "all" && locID !== cityFilter) continue;

                const cityPrice = item.prices[locID] || 0;
                if (cityPrice <= 0) continue;

                let royalSetupFee = 0;
                if (isBuyOrder) {
                    royalSetupFee = Math.round(cityPrice * 0.015);
                }
                const totalCost = cityPrice + royalSetupFee;
                const netProfit = bmNetTarget - totalCost;
                const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
                const amount = (item.amount && item.amount[locID]) || 0;

                offers.push({
                    locID: locID,
                    cityName: locationIDToName[locID] || "Miasto",
                    price: cityPrice,
                    setupFee: royalSetupFee,
                    netProfit: netProfit,
                    roi: roi,
                    amount: amount,
                    time: item.last_update[locID] || "brak"
                });
            }
        }

        if (offers.length === 0) continue;

        // Sortujemy wszystkie oferty od najlepszego profitu
        offers.sort((a, b) => b.netProfit - a.netProfit);
        const bestOffer = offers[0];

        // AGREGACJA DANYCH DLA JEDNEGO MIASTA (tego z najlepszą ofertą)
        // Zysk Łączny pokazuje realny zysk ograniczony do popytu na Black Markecie
        let aggregateTotalProfit = 0;
        let aggregateTotalCost = 0;
        let aggregateAmount = 0;
        const aggregateCityID = bestOffer.locID;
        
        let remainingBmAmount = (item.amount && (currentBmMode === "buy" ? item.amount["3003"] : item.amount["3003_sell"])) || 1;

        offers.forEach(off => {
            if (off.locID === aggregateCityID && off.netProfit > 0 && remainingBmAmount > 0) {
                const offAmount = off.amount > 0 ? off.amount : 1;
                const actualAmount = Math.min(offAmount, remainingBmAmount);
                
                aggregateTotalProfit += off.netProfit * actualAmount;
                aggregateTotalCost += (off.price + off.setupFee) * actualAmount;
                aggregateAmount += actualAmount;
                remainingBmAmount -= actualAmount;
            }
        });

        itemsArray.push({
            key: key,
            id: item.item_id,
            name: polishName,
            quality: item.quality,
            offers: offers,
            bestOffer: bestOffer,
            aggregateTotalProfit: aggregateTotalProfit,
            aggregateTotalCost: aggregateTotalCost,
            aggregateAmount: aggregateAmount,
            aggregateCityName: bestOffer.cityName,
            bmPrice: bmPrice,
            bmTime: bmTime
        });
    }

    // Sortowanie danych głównej tabeli
    if (sortBy === "profit") {
        itemsArray.sort((a, b) => b.bestOffer.netProfit - a.bestOffer.netProfit);
    } else if (sortBy === "total_profit") {
        itemsArray.sort((a, b) => b.aggregateTotalProfit - a.aggregateTotalProfit);
    } else if (sortBy === "roi") {
        itemsArray.sort((a, b) => b.bestOffer.roi - a.bestOffer.roi);
    } else if (sortBy === "name") {
        itemsArray.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "blackmarket") {
        itemsArray.sort((a, b) => b.bmPrice - a.bmPrice);
    } else if (sortBy === "amount") {
        itemsArray.sort((a, b) => b.aggregateAmount - a.aggregateAmount);
    } else if (sortBy === "age") {
        // Sortowanie po wieku danych (najnowsze pierwsze)
        itemsArray.sort((a, b) => {
            const getTimeVal = (time) => {
                if (time === "brak") return -1;
                if (time.includes("live")) return 9999999; // Live zawsze na górze
                const parts = time.split(" ");
                if (parts.length >= 2) {
                    const val = parseInt(parts[0]);
                    const unit = parts[1];
                    if (unit.startsWith("min")) return val * 60;
                    if (unit.startsWith("h")) return val * 3600;
                    if (unit.startsWith("sek")) return val;
                }
                return 0;
            };
            return getTimeVal(a.bestOffer.time) - getTimeVal(b.bestOffer.time);
        });
    }

    // Paginacja
    const totalPages = Math.max(1, Math.ceil(itemsArray.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const pageIndicator = document.getElementById("page-indicator");
    const btnPrev = document.getElementById("btn-page-prev");
    const btnNext = document.getElementById("btn-page-next");
    
    if (pageIndicator) pageIndicator.innerText = `Strona ${currentPage} z ${totalPages}`;
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = currentPage === totalPages;

    // Renderowanie tabeli
    if (itemsArray.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="table-placeholder">
                    <div class="placeholder-content">
                        <i data-lucide="search-code" class="placeholder-icon"></i>
                        <p>Brak wyników spełniających wybrane kryteria filtrów.</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tableBody.innerHTML = "";
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = itemsArray.slice(startIndex, startIndex + itemsPerPage);
    
    paginatedItems.forEach(item => {
        const row = document.createElement("tr");
        row.className = "expandable-row";
        if (highlightKey && item.key === highlightKey) {
            row.classList.add("row-update-flash");
        }
        row.onclick = () => toggleRowDetails(item.key);

        // Dobieramy styl dla ROI
        let roiClass = "roi-low";
        if (item.bestOffer.roi >= 25) {
            roiClass = "roi-high";
        } else if (item.bestOffer.roi >= 10) {
            roiClass = "roi-mid";
        }

        const profitClass = item.bestOffer.netProfit >= 0 ? "profit-plus" : "profit-minus";
        const totalProfitClass = item.aggregateTotalProfit >= 0 ? "profit-plus" : "profit-minus";

        // Tłumaczenie jakości na tekst (English)
        const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
        const qualityText = qualityNames[item.quality] || `Quality ${item.quality}`;

        const imgUrl = `https://render.albiononline.com/v1/item/${item.id}.png?quality=${item.quality}`;
        
        // Policzmy ile jest ofert w TYM SAMYM mieście
        const sameCityOffersCount = item.offers.filter(off => off.locID === item.bestOffer.locID && off.netProfit > 0).length;
        
        row.innerHTML = `
            <td class="expand-icon-cell">
                <i data-lucide="chevron-right" class="expand-icon"></i>
            </td>
            <td>
                <div class="item-cell">
                    <div class="item-img-wrapper">
                        <img src="${imgUrl}" alt="${item.name}" class="item-icon" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                    </div>
                    <div class="item-meta">
                        <span class="item-name">${item.name}</span>
                        <span class="item-id">${item.id}</span>
                        <span class="badge badge-tier" style="margin-top: 4px; font-size: 0.65rem;">${qualityText}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="price-value">
                    <span class="price-silver">${formatSilver(item.bestOffer.price)} <small>sreb.</small></span>
                    <span class="price-city" style="color: var(--color-accent);">${item.bestOffer.cityName}</span>
                    <span class="price-sub" style="color: #fff; font-size: 0.8rem;">
                        Dostępne: ${item.aggregateAmount} szt.
                    </span>
                    ${sameCityOffersCount > 1 ? `<span class="profitable-count-badge" style="background: var(--color-accent); color: #000; padding: 2px 4px; border-radius: 4px; font-weight: bold; margin-top: 4px; display: inline-block;">+${sameCityOffersCount - 1} inne oferty w ${item.bestOffer.cityName}</span>` : ''}
                </div>
            </td>
            <td>
                <div class="price-value">
                    <span class="price-silver" style="color: #ffaa00;">${formatSilver(item.bmPrice)} <small>sreb.</small></span>
                    <span class="price-city">Black Market</span>
                    <span class="price-sub">${item.bmTime}</span>
                </div>
            </td>
            <td>
                <div class="price-value" style="text-align: center;">
                    <span class="price-silver" style="font-weight: 800; color: #fff;">${item.aggregateAmount} <small>szt.</small></span>
                    <span class="price-sub" style="color: var(--success); font-weight: bold;">z ${item.aggregateCityName}</span>
                </div>
            </td>
            <td>
                <span class="price-sub" style="color: #ff5f56; font-family: var(--font-mono); font-weight: bold;">-${formatSilver(item.bestOffer.setupFee + Math.round(item.bmPrice * (isPremium ? 0.04 : 0.08)))}</span>
            </td>
            <td>
                <span class="profit-value ${profitClass}">${item.bestOffer.netProfit >= 0 ? '+' : ''}${formatSilver(item.bestOffer.netProfit)}</span>
            </td>
            <td>
                <span class="profit-value ${totalProfitClass}" style="font-size: 1.15rem;">${item.aggregateTotalProfit >= 0 ? '+' : ''}${formatSilver(item.aggregateTotalProfit)}</span>
            </td>
            <td>
                <span class="roi-value ${roiClass}">${item.bestOffer.roi.toFixed(1)}%</span>
            </td>
            <td class="price-sub" style="font-style: italic;">${item.bestOffer.time}</td>
        `;
        tableBody.appendChild(row);

        // Dodajemy wiersz szczegółów (ukryty)
        const detailsRow = document.createElement("tr");
        detailsRow.id = `details-${item.key}`;
        detailsRow.className = "details-row";
        
        let offersHtml = "";
        item.offers.forEach(off => {
            // Pokazujemy oferty ze wszystkich miast, które dają zysk
            if (off.netProfit <= 0) return;

            const offProfitClass = off.netProfit >= 0 ? "profit-plus" : "profit-minus";
            const offRoiClass = off.roi >= 25 ? "roi-high" : (off.roi >= 10 ? "roi-mid" : "roi-low");
            const cityIcon = cityIdToIcon[off.locID] || "map-pin";

            offersHtml += `
                <tr>
                    <td>
                        <div class="badge-city">
                            <i data-lucide="${cityIcon}"></i>
                            ${off.cityName}
                        </div>
                    </td>
                    <td><span class="price-silver">${formatSilver(off.price)}</span></td>
                    <td><span class="price-silver" style="font-weight: bold; color: #fff;">${off.amount} szt.</span></td>
                    <td><span class="price-sub" style="color: #ff5f56;">-${formatSilver(off.setupFee)}</span></td>
                    <td><span class="profit-value ${offProfitClass}" style="font-size: 0.85rem;">${off.netProfit >= 0 ? '+' : ''}${formatSilver(off.netProfit)}</span></td>
                    <td><span class="profit-value ${offProfitClass}" style="font-weight: 800;">${off.netProfit >= 0 ? '+' : ''}${formatSilver(off.netProfit * off.amount)}</span></td>
                    <td><span class="roi-value ${offRoiClass}" style="font-size: 0.75rem; padding: 1px 6px;">${off.roi.toFixed(1)}%</span></td>
                    <td><span class="price-sub">${off.time}</span></td>
                </tr>
            `;
        });

        detailsRow.innerHTML = `
            <td colspan="10" class="details-container">
                <table class="city-details-table">
                    <thead>
                        <tr>
                            <th>Miasto Królewskie</th>
                            <th>Cena zakupu</th>
                            <th>Ilość</th>
                            <th>Opłata</th>
                            <th>Zysk (1 szt)</th>
                            <th>Zysk Łączny</th>
                            <th>ROI %</th>
                            <th>Wiek danych</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${offersHtml}
                    </tbody>
                </table>
            </td>
        `;
        tableBody.appendChild(detailsRow);
    });
    updateInvestmentSummary(itemsArray);
    lucide.createIcons();
}

let invCitySortCol = 'cost';
let invCitySortAsc = false;
let invItemSortCol = 'cost';
let invItemSortAsc = false;

function sortInvTable(table, col) {
    if (table === 'city') {
        if (invCitySortCol === col) {
            invCitySortAsc = !invCitySortAsc;
        } else {
            invCitySortCol = col;
            invCitySortAsc = false;
        }
    } else if (table === 'item') {
        if (invItemSortCol === col) {
            invItemSortAsc = !invItemSortAsc;
        } else {
            invItemSortCol = col;
            invItemSortAsc = false;
        }
    }
    updateTable(null, false);
}

// Funkcja aktualizująca zakładkę Podsumowanie Inwestycji (Koszyk)
function updateInvestmentSummary(itemsArray) {
    let totalCost = 0;
    let totalProfit = 0;
    
    const cityMap = {}; // mapowanie po locID
    const itemMap = {}; // mapowanie po unikalnym kluczu przedmiotu (T.E + Quality)

    const filterCity = document.getElementById("filter-summary-city") ? document.getElementById("filter-summary-city").value : "all";

    itemsArray.forEach(item => {
        if (item.aggregateTotalProfit <= 0 || item.aggregateTotalCost <= 0) return;
        
        const cityID = item.bestOffer.locID;
        const cityName = item.bestOffer.cityName;

        // FILTR MIASTA
        if (filterCity !== "all" && cityID !== filterCity) return;
        
        totalCost += item.aggregateTotalCost;
        totalProfit += item.aggregateTotalProfit;

        // Koszyk wg Miast
        if (!cityMap[cityID]) {
            cityMap[cityID] = { name: cityName, cost: 0, profit: 0, amount: 0, roi: 0 };
        }
        cityMap[cityID].cost += item.aggregateTotalCost;
        cityMap[cityID].profit += item.aggregateTotalProfit;
        cityMap[cityID].amount += item.aggregateAmount;
        cityMap[cityID].roi = cityMap[cityID].cost > 0 ? (cityMap[cityID].profit / cityMap[cityID].cost) * 100 : 0;

        // Koszyk wg Przedmiotów
        const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
        const qualityName = qualityNames[item.quality] || `Quality ${item.quality}`;
        const itemKey = `${item.id}_${item.quality}_${cityID}`;
        
        if (!itemMap[itemKey]) {
            itemMap[itemKey] = {
                name: item.name,
                id: item.id,
                qualityText: qualityName,
                cityName: cityName,
                cost: 0,
                profit: 0,
                amount: 0,
                roi: 0
            };
        }
        itemMap[itemKey].cost += item.aggregateTotalCost;
        itemMap[itemKey].profit += item.aggregateTotalProfit;
        itemMap[itemKey].amount += item.aggregateAmount;
        itemMap[itemKey].roi = itemMap[itemKey].cost > 0 ? (itemMap[itemKey].profit / itemMap[itemKey].cost) * 100 : 0;
    });

    // Aktualizacja Globalnych Statystyk
    document.getElementById("inv-total-cost").textContent = `${formatSilver(totalCost)} sreb.`;
    document.getElementById("inv-total-profit").textContent = `+${formatSilver(totalProfit)} sreb.`;
    
    const totalRoi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const roiEl = document.getElementById("inv-total-roi");
    roiEl.textContent = `${totalRoi.toFixed(1)}%`;
    if (totalRoi >= 25) roiEl.className = "stat-value roi-high";
    else if (totalRoi >= 10) roiEl.className = "stat-value roi-mid";
    else roiEl.className = "stat-value roi-low";

    // Renderowanie Tabeli Miast
    const cityTableBody = document.getElementById("inv-city-body");
    if (cityTableBody) {
        cityTableBody.innerHTML = "";
        let sortedCities = Object.values(cityMap);
        
        sortedCities.sort((a, b) => {
            let valA = a[invCitySortCol];
            let valB = b[invCitySortCol];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return invCitySortAsc ? -1 : 1;
            if (valA > valB) return invCitySortAsc ? 1 : -1;
            return 0;
        });

        if (sortedCities.length === 0) {
            cityTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Brak zyskownych przedmiotów w koszyku.</td></tr>`;
        } else {
            sortedCities.forEach(city => {
                cityTableBody.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; color: var(--text);">${city.name}</td>
                        <td style="color: #ffaa00; font-family: var(--font-mono);">${formatSilver(city.cost)}</td>
                        <td class="profit-plus">+${formatSilver(city.profit)}</td>
                        <td><span class="badge ${city.roi >= 25 ? 'roi-high' : (city.roi >= 10 ? 'roi-mid' : 'roi-low')}">${city.roi.toFixed(1)}%</span></td>
                        <td style="font-family: var(--font-mono); font-weight: bold;">${city.amount}</td>
                    </tr>
                `;
            });
        }
    }

    // Renderowanie Tabeli Przedmiotów
    const itemTableBody = document.getElementById("inv-item-body");
    if (itemTableBody) {
        itemTableBody.innerHTML = "";
        let sortedItems = Object.values(itemMap);
        
        sortedItems.sort((a, b) => {
            let valA = a[invItemSortCol];
            let valB = b[invItemSortCol];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return invItemSortAsc ? -1 : 1;
            if (valA > valB) return invItemSortAsc ? 1 : -1;
            return 0;
        });

        if (sortedItems.length === 0) {
            itemTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Brak zyskownych przedmiotów w koszyku.</td></tr>`;
        } else {
            sortedItems.forEach(it => {
                itemTableBody.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; color: var(--text); display: flex; align-items: center; gap: 8px;">
                            <img src="https://render.albiononline.com/v1/item/${it.id}.png" style="width: 32px; height: 32px;">
                            ${it.name}
                        </td>
                        <td><span class="badge badge-tier">${it.qualityText}</span></td>
                        <td style="color: var(--text-muted);">${it.cityName}</td>
                        <td style="color: #ffaa00; font-family: var(--font-mono);">${formatSilver(it.cost)}</td>
                        <td class="profit-plus">+${formatSilver(it.profit)}</td>
                        <td><span class="badge ${it.roi >= 25 ? 'roi-high' : (it.roi >= 10 ? 'roi-mid' : 'roi-low')}">${it.roi.toFixed(1)}%</span></td>
                        <td style="font-family: var(--font-mono); font-weight: bold;">${it.amount}</td>
                    </tr>
                `;
            });
        }
    }
}

// Funkcja rozwijająca wiersz szczegółów
function toggleRowDetails(key) {
    const detailsRow = document.getElementById(`details-${key}`);
    if (!detailsRow) return;
    const mainRow = detailsRow.previousElementSibling;
    
    const isExpanded = detailsRow.classList.contains("active");
    
    if (isExpanded) {
        detailsRow.classList.remove("active");
        mainRow.classList.remove("expanded");
    } else {
        detailsRow.classList.add("active");
        mainRow.classList.add("expanded");
    }
}

const cityIds = ["3008", "1004", "3002", "1002", "2004", "3005", "5003"];

function renderCityTabs() {
    cityIds.forEach(cityId => {
        const pricesBody = document.getElementById(`body-prices-${cityId}`);
        const profitBody = document.getElementById(`body-profit-${cityId}`);
        if (!pricesBody || !profitBody) return;

        const pricesList = [];
        const profitList = [];

        for (const key in pricesData) {
            const item = pricesData[key];
            
            // Sprawdzamy wszystkie oferty dla tego miasta
            if (item.offers && item.offers[cityId]) {
                const cityOffersList = item.offers[cityId] || [];
                cityOffersList.forEach(off => {
                    if (off.auction_type !== "offer") return;
                    const price = off.price || 0;
                    if (price <= 0) return;

                    // Dodajemy do listy cen
                    pricesList.push({
                        id: item.item_id,
                        name: translateItem(item.item_id),
                        price: price,
                        amount: off.amount,
                        quality: item.quality,
                        time: off.last_update || "brak"
                    });

                    // Sprawdzamy profit (względem najlepszej ceny BM)
                    const bmPrice = Math.max(item.prices["3003"] || 0, item.prices["3003_sell"] || 0);
                    if (bmPrice > 0) {
                        const bmTaxRate = isPremium ? 0.04 : 0.08;
                        const bmTax = Math.round(bmPrice * bmTaxRate);
                        const netProfit = bmPrice - bmTax - price;
                        const roi = price > 0 ? (netProfit / price) * 100 : 0;

                        profitList.push({
                            id: item.item_id,
                            name: translateItem(item.item_id),
                            cityPrice: price,
                            bmPrice: bmPrice,
                            tax: bmTax,
                            netProfit: netProfit,
                            roi: roi,
                            quality: item.quality,
                            amount: off.amount
                        });
                    }
                });
            } else {
                // Fallback dla starej bazy (pojedyncze ceny)
                const cityPrice = item.prices[cityId] || 0;
                if (cityPrice > 0) {
                    pricesList.push({
                        id: item.item_id,
                        name: translateItem(item.item_id),
                        price: cityPrice,
                        amount: (item.amount && item.amount[cityId]) || 1,
                        quality: item.quality,
                        time: item.last_update[cityId] || "brak"
                    });

                    const bmPrice = Math.max(item.prices["3003"] || 0, item.prices["3003_sell"] || 0);
                    if (bmPrice > 0) {
                        const bmTaxRate = isPremium ? 0.04 : 0.08;
                        const bmTax = Math.round(bmPrice * bmTaxRate);
                        const netProfit = bmPrice - bmTax - cityPrice;
                        const roi = cityPrice > 0 ? (netProfit / cityPrice) * 100 : 0;

                        profitList.push({
                            id: item.item_id,
                            name: translateItem(item.item_id),
                            cityPrice: cityPrice,
                            bmPrice: bmPrice,
                            tax: bmTax,
                            netProfit: netProfit,
                            roi: roi,
                            quality: item.quality,
                            amount: (item.amount && item.amount[cityId]) || 1
                        });
                    }
                }
            }
        }

        // Paginacja cen w mieście
        const priceTableId = `body-prices-${cityId}`;
        if (!cityPageStates[priceTableId]) cityPageStates[priceTableId] = 1;
        
        const totalPricesPages = Math.max(1, Math.ceil(pricesList.length / itemsPerPage));
        if (cityPageStates[priceTableId] > totalPricesPages) cityPageStates[priceTableId] = totalPricesPages;

        const indicatorPrices = document.getElementById(`indicator-${priceTableId}`);
        if (indicatorPrices) indicatorPrices.innerText = `Strona ${cityPageStates[priceTableId]} z ${totalPricesPages}`;
        
        const btnPrevPrices = document.getElementById(`btn-prev-${priceTableId}`);
        const btnNextPrices = document.getElementById(`btn-next-${priceTableId}`);
        if (btnPrevPrices) btnPrevPrices.disabled = cityPageStates[priceTableId] === 1;
        if (btnNextPrices) btnNextPrices.disabled = cityPageStates[priceTableId] === totalPricesPages;

        // Renderowanie cen w tym mieście
        if (pricesList.length === 0) {
            const iconName = cityIdToIcon[cityId] || "radio";
            const cityName = locationIDToName[cityId] || "mieście";
            pricesBody.innerHTML = `
                <tr>
                    <td colspan="4" class="table-placeholder">
                        <div class="placeholder-content">
                            <i data-lucide="${iconName}" class="placeholder-icon"></i>
                            <p>Oczekiwanie na dane z ${cityName}... Otwórz tablicę rynku w ${cityName}.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Sortujemy po nazwie przedmiotu
            pricesList.sort((a, b) => a.name.localeCompare(b.name));

            pricesBody.innerHTML = "";
            const startIndex = (cityPageStates[priceTableId] - 1) * itemsPerPage;
            const paginatedPrices = pricesList.slice(startIndex, startIndex + itemsPerPage);

            paginatedPrices.forEach(p => {
                const row = document.createElement("tr");
                const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
                const qualityName = qualityNames[p.quality] || `Quality ${p.quality}`;
                const imgUrl = `https://render.albiononline.com/v1/item/${p.id}.png?quality=${p.quality}`;

                row.innerHTML = `
                    <td>
                        <div class="item-cell">
                            <div class="item-img-wrapper">
                                <img src="${imgUrl}" alt="${p.name}" class="item-icon" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                            </div>
                            <div class="item-meta">
                                <span class="item-name">${p.name}</span>
                                <span class="item-id">${p.id}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="price-silver" style="font-weight: bold; font-family: var(--font-mono);">${formatSilver(p.price)} <small>sreb.</small></span>
                    </td>
                    <td>
                        <span class="price-silver" style="color: #fff; font-size: 0.9rem;">${p.amount} <small>szt.</small></span>
                    </td>
                    <td>
                        <span class="badge badge-tier">${qualityName}</span>
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${p.time}</td>
                `;
                pricesBody.appendChild(row);
            });
        }

        // Paginacja kalkulatora zysków
        const profitTableId = `body-profit-${cityId}`;
        if (!cityPageStates[profitTableId]) cityPageStates[profitTableId] = 1;
        
        const totalProfitPages = Math.max(1, Math.ceil(profitList.length / itemsPerPage));
        if (cityPageStates[profitTableId] > totalProfitPages) cityPageStates[profitTableId] = totalProfitPages;

        const indicatorProfit = document.getElementById(`indicator-${profitTableId}`);
        if (indicatorProfit) indicatorProfit.innerText = `Strona ${cityPageStates[profitTableId]} z ${totalProfitPages}`;
        
        const btnPrevProfit = document.getElementById(`btn-prev-${profitTableId}`);
        const btnNextProfit = document.getElementById(`btn-next-${profitTableId}`);
        if (btnPrevProfit) btnPrevProfit.disabled = cityPageStates[profitTableId] === 1;
        if (btnNextProfit) btnNextProfit.disabled = cityPageStates[profitTableId] === totalProfitPages;

        // Renderowanie kalkulatora zysków dla tego miasta
        if (profitList.length === 0) {
            profitBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-placeholder">
                        <div class="placeholder-content">
                            <i data-lucide="trending-up" class="placeholder-icon"></i>
                            <p>Brak danych do wyliczenia zysku. Wyszukaj te przedmioty w tym mieście oraz na Czarnym Rynku.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Sortujemy po profitach malejąco
            profitList.sort((a, b) => b.netProfit - a.netProfit);

            profitBody.innerHTML = "";
            const startIndex = (cityPageStates[profitTableId] - 1) * itemsPerPage;
            const paginatedProfit = profitList.slice(startIndex, startIndex + itemsPerPage);

            paginatedProfit.forEach(p => {
                const row = document.createElement("tr");
                let roiClass = "roi-low";
                if (p.roi >= 25) {
                    roiClass = "roi-high";
                } else if (p.roi >= 10) {
                    roiClass = "roi-mid";
                }

                const qualityNames = ["", "Normal", "Good", "Outstanding", "Excellent", "Masterpiece"];
                const qualityName = qualityNames[p.quality] || `Quality ${p.quality}`;
                const imgUrl = `https://render.albiononline.com/v1/item/${p.id}.png?quality=${p.quality}`;

                row.innerHTML = `
                    <td>
                        <div class="item-cell">
                            <div class="item-img-wrapper">
                                <img src="${imgUrl}" alt="${p.name}" class="item-icon" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                            </div>
                            <div class="item-meta">
                                <span class="item-name">${p.name}</span>
                                <span class="badge badge-tier" style="margin-top: 4px; display: inline-block;">${qualityName}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="price-silver" style="font-weight: bold; font-family: var(--font-mono);">${formatSilver(p.cityPrice)} <small>sreb.</small></span>
                    </td>
                    <td>
                        <span class="price-silver" style="color: #fff; font-size: 0.9rem;">${p.amount} <small>szt.</small></span>
                    </td>
                    <td>
                        <span class="price-silver" style="color: #ffaa00; font-weight: bold; font-family: var(--font-mono);">${formatSilver(p.bmPrice)} <small>sreb.</small></span>
                    </td>
                    <td>
                        <span class="price-sub" style="color: #ff5f56; font-family: var(--font-mono); font-weight: bold;">-${formatSilver(p.tax)}</span>
                    </td>
                    <td>
                        <span class="profit-value ${p.netProfit >= 0 ? 'profit-plus' : 'profit-minus'}">
                            ${p.netProfit >= 0 ? '+' : ''}${formatSilver(p.netProfit)}
                        </span>
                    </td>
                    <td>
                        <span class="roi-value ${roiClass}">${p.roi.toFixed(1)}%</span>
                    </td>
                `;
                profitBody.appendChild(row);
            });
        }
    });

    // Zaktualizuj liczniki odznak (badge-counts) dla miast!
    cityIds.forEach(cityId => {
        let count = 0;
        for (const key in pricesData) {
            if (pricesData[key].prices[cityId] > 0) {
                count++;
            }
        }
        const badge = document.getElementById(`${locationIDToSlug[cityId]}-count`);
        if (badge) {
            badge.textContent = count;
        }
    });

    lucide.createIcons();
}

// Funkcja wyliczająca najbardziej opłacalny szlak transportowy z miast królewskich dla obu trybów Czarnego Rynku
function updateTotalPotentialProfit() {
    let totalProfit = 0;
    let opportunitiesCount = 0;
    const bmTaxRate = isPremium ? 0.04 : 0.08;

    for (const key in pricesData) {
        const item = pricesData[key];
        const bmBuyPrice = item.prices["3003"] || 0;
        const bmSellPrice = item.prices["3003_sell"] || 0;
        
        // Wybieramy cenę Black Market na podstawie aktualnie wybranego trybu (Szybka sprzedaż / Zlecenie)
        let bmPrice = 0;
        if (currentBmMode === "buy") {
            bmPrice = bmBuyPrice;
        } else {
            bmPrice = bmSellPrice;
        }
        
        if (bmPrice <= 0) continue;

        const bmNetTarget = bmPrice - Math.round(bmPrice * bmTaxRate);

        if (item.offers) {
            for (const locID in item.offers) {
                if (locID === "3003" || locID === "3003_sell") continue;
                const cityOffersList = item.offers[locID] || [];
                cityOffersList.forEach(off => {
                    if (off.auction_type !== "offer") return;
                    const cityPrice = off.price || 0;
                    if (cityPrice <= 0) return;

                    const netProfit = bmNetTarget - cityPrice;
                    if (netProfit > 0) {
                        const cityAmount = off.amount || 1;
                        const bmAmount = (item.amount && (currentBmMode === "buy" ? item.amount["3003"] : item.amount["3003_sell"])) || 1;
                        const actualAmount = Math.min(cityAmount, bmAmount);
                        totalProfit += netProfit * actualAmount;
                        opportunitiesCount++;
                    }
                });
            }
        } else {
            for (const locID in item.prices) {
                if (locID === "3003" || locID === "3003_sell") continue;
                const cityPrice = item.prices[locID] || 0;
                if (cityPrice <= 0) continue;

                const netProfit = bmNetTarget - cityPrice;
                if (netProfit > 0) {
                    const cityAmount = (item.amount && item.amount[locID]) || 1;
                    const bmAmount = (item.amount && (currentBmMode === "buy" ? item.amount["3003"] : item.amount["3003_sell"])) || 1;
                    const actualAmount = Math.min(cityAmount, bmAmount);
                    totalProfit += netProfit * actualAmount;
                    opportunitiesCount++;
                }
            }
        }
    }

    const totalEl = document.getElementById("total-potential-profit");
    const countEl = document.getElementById("total-opportunities-count");
    if (totalEl) totalEl.innerHTML = `${formatSilver(totalProfit)} <small style="font-size: 1rem;">sreb.</small>`;
    if (countEl) countEl.innerText = `${opportunitiesCount} okazji w bazie`;
}

function updateBestCityRecommendation() {
    const cityProfitsBuy = {
        "3008": { name: "Lymhurst", total: 0, count: 0 },
        "2004": { name: "Fort Sterling", total: 0, count: 0 },
        "1002": { name: "Thetford", total: 0, count: 0 },
        "3002": { name: "Martlock", total: 0, count: 0 },
        "1004": { name: "Bridgewatch", total: 0, count: 0 },
        "3005": { name: "Caerleon", total: 0, count: 0 },
        "5003": { name: "Brecilien", total: 0, count: 0 }
    };

    const cityProfitsSell = {
        "3008": { name: "Lymhurst", total: 0, count: 0 },
        "2004": { name: "Fort Sterling", total: 0, count: 0 },
        "1002": { name: "Thetford", total: 0, count: 0 },
        "3002": { name: "Martlock", total: 0, count: 0 },
        "1004": { name: "Bridgewatch", total: 0, count: 0 },
        "3005": { name: "Caerleon", total: 0, count: 0 },
        "5003": { name: "Brecilien", total: 0, count: 0 }
    };

    const bmTaxRate = isPremium ? 0.04 : 0.08;

    // Przetwarzamy całą pricesData
    for (const key in pricesData) {
        const item = pricesData[key];
        const bmTaxRate = isPremium ? 0.04 : 0.08;

        // 1. OBLICZENIA DLA SZYBKIEJ SPRZEDAŻY (Buy / Instant Sell)
        // Szukamy najlepszej ceny kupna przez BM (zlecenie request)
        const bmBuyPrice = item.prices["3003"] || 0;
        if (bmBuyPrice > 0) {
            const bmNet = bmBuyPrice - Math.round(bmBuyPrice * bmTaxRate);
            const bmAmount = (item.amount && item.amount["3003"]) || 1;

            if (item.offers) {
                for (const cityId in item.offers) {
                    if (cityId === "3003" || cityId === "3003_sell" || !cityProfitsBuy[cityId]) continue;
                    
                    item.offers[cityId].forEach(off => {
                        if (off.auction_type !== "offer") return;
                        const cityPrice = off.price || 0;
                        if (cityPrice > 0 && cityPrice < bmNet) {
                            const profitPerUnit = bmNet - cityPrice;
                            const cityAmount = off.amount || 1;
                            // Zysk ograniczony przez to, ile możemy kupić LUB ile BM chce kupić
                            const actualAmount = Math.min(cityAmount, bmAmount);
                            cityProfitsBuy[cityId].total += profitPerUnit * actualAmount;
                            cityProfitsBuy[cityId].count++;
                        }
                    });
                }
            } else {
                // Fallback dla uproszczonej bazy
                for (const cityId in cityProfitsBuy) {
                    const cityPrice = item.prices[cityId] || 0;
                    if (cityPrice > 0 && cityPrice < bmNet) {
                        const profitPerUnit = bmNet - cityPrice;
                        const cityAmount = (item.amount && item.amount[cityId]) || 1;
                        const actualAmount = Math.min(cityAmount, bmAmount);
                        cityProfitsBuy[cityId].total += profitPerUnit * actualAmount;
                        cityProfitsBuy[cityId].count++;
                    }
                }
            }
        }

        // 2. OBLICZENIA DLA ZLECENIA SPRZEDAŻY (Sell / Sell Order)
        // Szukamy najniższej ceny sprzedaży na BM (by ją przebić o 1 sreb.)
        const bmSellPrice = item.prices["3003_sell"] || 0;
        if (bmSellPrice > 0) {
            // Zakładamy przebicie ceny o 1 sreb. dla konkurencyjności
            const targetPrice = bmSellPrice - 1;
            const bmNet = targetPrice - Math.round(targetPrice * bmTaxRate);
            const bmAmount = (item.amount && item.amount["3003_sell"]) || 1;

            if (item.offers) {
                for (const cityId in item.offers) {
                    if (cityId === "3003" || cityId === "3003_sell" || !cityProfitsSell[cityId]) continue;
                    
                    item.offers[cityId].forEach(off => {
                        if (off.auction_type !== "offer") return;
                        const cityPrice = off.price || 0;
                        if (cityPrice > 0 && cityPrice < bmNet) {
                            const profitPerUnit = bmNet - cityPrice;
                            const cityAmount = off.amount || 1;
                            const actualAmount = Math.min(cityAmount, bmAmount);
                            cityProfitsSell[cityId].total += profitPerUnit * actualAmount;
                            cityProfitsSell[cityId].count++;
                        }
                    });
                }
            } else {
                for (const cityId in cityProfitsSell) {
                    const cityPrice = item.prices[cityId] || 0;
                    if (cityPrice > 0 && cityPrice < bmNet) {
                        const profitPerUnit = bmNet - cityPrice;
                        const cityAmount = (item.amount && item.amount[cityId]) || 1;
                        const actualAmount = Math.min(cityAmount, bmAmount);
                        cityProfitsSell[cityId].total += profitPerUnit * actualAmount;
                        cityProfitsSell[cityId].count++;
                    }
                }
            }
        }
    }

    // Sortujemy i filtrujemy zyskowne miasta dla Szybkiej Sprzedaży (buy)
    const sortedBuy = Object.keys(cityProfitsBuy)
        .map(id => ({ id, ...cityProfitsBuy[id] }))
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total);

    // Sortujemy i filtrujemy zyskowne miasta dla Zleceń Sprzedaży (sell)
    const sortedSell = Object.keys(cityProfitsSell)
        .map(id => ({ id, ...cityProfitsSell[id] }))
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total);

    const maxProfitBuy = sortedBuy.length > 0 ? sortedBuy[0].total : 0;
    const maxProfitSell = sortedSell.length > 0 ? sortedSell[0].total : 0;

    // 1. Aktualizacja widoku slajdu 1 (Buy / Szybka Sprzedaż)
    const nameBuyEl = document.getElementById("best-city-name-buy");
    const profitBuyEl = document.getElementById("best-city-profit-buy");
    const containerBuyEl = document.getElementById("other-cities-container-buy");

    if (nameBuyEl && profitBuyEl && containerBuyEl) {
        containerBuyEl.innerHTML = ""; // Wyczyszczenie runner-upów

        if (sortedBuy.length > 0) {
            // #1 to najlepsze miasto
            const best = sortedBuy[0];
            nameBuyEl.textContent = best.name;
            profitBuyEl.innerHTML = formatSilver(best.total) + ' <small style="font-size: 0.8rem;">sreb.</small>';

            // Pozostałe miasta są dodawane jako małe, urocze badge pod spodem
            const runnerUps = sortedBuy.slice(1);
            if (runnerUps.length > 0) {
                runnerUps.forEach(city => {
                    const badge = document.createElement("span");
                    badge.style.cssText = "background: rgba(255,170,0,0.06); border: 1px solid rgba(255,170,0,0.25); color: #ffaa00; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 2px; font-weight: bold;";
                    badge.innerHTML = `${city.name}: <span style="color: #fff;">+${formatShortSilver(city.total)}</span>`;
                    containerBuyEl.appendChild(badge);
                });
            } else {
                containerBuyEl.innerHTML = '<span style="color: var(--text-muted, #777); font-size: 0.65rem;">Brak innych zyskownych miast</span>';
            }
        } else {
            nameBuyEl.textContent = "Brak danych";
            profitBuyEl.innerHTML = '0 <small style="font-size: 0.8rem;">sreb.</small>';
            containerBuyEl.innerHTML = '<span style="color: var(--text-muted, #777); font-size: 0.65rem;">Przeskanuj ceny w miastach</span>';
        }
    }

    // 2. Aktualizacja widoku slajdu 2 (Sell / Zlecenie Sprzedaży)
    const nameSellEl = document.getElementById("best-city-name-sell");
    const profitSellEl = document.getElementById("best-city-profit-sell");
    const containerSellEl = document.getElementById("other-cities-container-sell");

    if (nameSellEl && profitSellEl && containerSellEl) {
        containerSellEl.innerHTML = ""; // Wyczyszczenie runner-upów

        if (sortedSell.length > 0) {
            // #1 to najlepsze miasto
            const best = sortedSell[0];
            nameSellEl.textContent = best.name;
            profitSellEl.innerHTML = formatSilver(best.total) + ' <small style="font-size: 0.8rem;">sreb.</small>';

            // Pozostałe miasta są dodawane jako małe, urocze badge pod spodem
            const runnerUps = sortedSell.slice(1);
            if (runnerUps.length > 0) {
                runnerUps.forEach(city => {
                    const badge = document.createElement("span");
                    badge.style.cssText = "background: rgba(0,255,204,0.06); border: 1px solid rgba(0,255,204,0.25); color: #00ffcc; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 2px; font-weight: bold;";
                    badge.innerHTML = `${city.name}: <span style="color: #fff;">+${formatShortSilver(city.total)}</span>`;
                    containerSellEl.appendChild(badge);
                });
            } else {
                containerSellEl.innerHTML = '<span style="color: var(--text-muted, #777); font-size: 0.65rem;">Brak innych zyskownych miast</span>';
            }
        } else {
            nameSellEl.textContent = "Brak danych";
            profitSellEl.innerHTML = '0 <small style="font-size: 0.8rem;">sreb.</small>';
            containerSellEl.innerHTML = '<span style="color: var(--text-muted, #777); font-size: 0.65rem;">Przeskanuj oferty sprzedaży rynkowej</span>';
        }
    }

    // Aktualizacja koloru lewego obramowania na podstawie aktywnego trybu
    const card = document.querySelector(".best-city-card");
    if (card) {
        const hasData = (currentSlideIndex === 0 && maxProfitBuy > 0) || (currentSlideIndex === 1 && maxProfitSell > 0);
        if (hasData) {
            card.style.borderLeft = currentSlideIndex === 0 ? "4px solid var(--success, #00ff66)" : "4px solid #00ffcc";
        } else {
            card.style.borderLeft = "4px solid var(--border, #333)";
        }
    }
}

/* ==========================================================================
   EVENT LISTENERS & INICJALIZACJA INTERFEJSU
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    // 1. Połączenie sieciowe
    connectWebSocket();
    fetchPrices();
    fetchInterfaces();
    fetchRecentOrders();

    // 2. Druid sprawdza lokalizację przy starcie
    setTimeout(() => {
        const citySel = document.getElementById("select-manual-city");
        if (citySel && !citySel.value) {
            showWizardBubble("🦉 Witaj, wędrowcze!", "Nie wybrałeś jeszcze swojego głównego rynku. Kliknij na listę miast na górze, abym mógł zacząć liczyć Twoje zyski!", 12000);
        } else if (citySel && citySel.value) {
            const cityName = locationIDToName[citySel.value] || "miasta";
            showWizardBubble("🌿 Witaj ponownie!", `Nadal handlujemy w <strong>${cityName}</strong>? Niech Twoje srebro rośnie tak gęsto jak mech w puszczy!`, 8000);
        }
    }, 2000);


    // Obsługa trybów głównych (Trading / Refining / Crafting)
    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const mode = this.dataset.mode;
            document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            
            // Ukryj wszystkie paski zakładek specyficzne dla trybów
            document.querySelectorAll(".mode-content").forEach(c => c.classList.remove("active"));
            const modeNav = document.getElementById(`mode-${mode}-nav`);
            if (modeNav) modeNav.classList.add("active");

            // Automatyczne przełączenie na pierwszy tab w danym trybie
            if (mode === "trading") {
                const activeTab = document.querySelector("#mode-trading-nav .tab-btn.active");
                if (activeTab) activeTab.click();
                else document.querySelector('.tab-btn[data-tab="live-feed"]').click();
            } else if (mode === "refining") {
                const refBtn = document.querySelector('.tab-btn[data-tab="refining"]');
                if (refBtn) refBtn.click();
            } else if (mode === "crafting") {
                const craftBtn = document.querySelector('.tab-btn[data-tab="crafting"]');
                if (craftBtn) craftBtn.click();
            }
        });
    });

    // Obsługa zakładek
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            const tabId = "tab-" + this.dataset.tab;
            const tabEl = document.getElementById(tabId);
            if (tabEl) tabEl.classList.add("active");
            // Reset licznika po wejściu na dany tab
            if (this.dataset.tab === "live-feed") {
                liveFeedCount = 0;
                const badge = document.getElementById("live-feed-count");
                if (badge) badge.textContent = "0";
            } else if (this.dataset.tab === "black-market") {
                blackMarketCount = 0;
                const badge = document.getElementById("black-market-count");
                if (badge) badge.textContent = "0";
            }
        });
    });

    // Filtry Refiningu
    const refCity = document.getElementById("refining-city");
    if (refCity) refCity.addEventListener("change", renderRefiningTable);
    const refFocus = document.getElementById("refining-focus");
    if (refFocus) refFocus.addEventListener("change", renderRefiningTable);
    const refStationFee = document.getElementById("refining-station-fee");
    if (refStationFee) refStationFee.addEventListener("input", renderRefiningTable);
    
    // Filtr Surowców
    const resFilter = document.getElementById("filter-resources-only");
    if (resFilter) resFilter.addEventListener("change", () => updateTable(null, true));

    // Przycisk czyszczenia Live Feed
    const btnClearFeed = document.getElementById("btn-clear-feed");
    if (btnClearFeed) {
        btnClearFeed.addEventListener("click", function() {
            const tbody = document.getElementById("live-feed-body");
            tbody.innerHTML = `<tr><td colspan="7" class="table-placeholder"><div class="placeholder-content"><i data-lucide="radio" class="placeholder-icon"></i><p>Feed wyczyszczony.</p></div></td></tr>`;
            liveFeedCount = 0;
            const badge = document.getElementById("live-feed-count");
            if (badge) badge.textContent = "0";
            lucide.createIcons();
        });
    }

    // Przycisk czyszczenia Black Market
    const btnClearBM = document.getElementById("btn-clear-bm");
    if (btnClearBM) {
        btnClearBM.addEventListener("click", function() {
            const tbody = document.getElementById("black-market-body");
            tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder"><div class="placeholder-content"><i data-lucide="shield-alert" class="placeholder-icon"></i><p>Zlecenia wyczyszczone.</p></div></td></tr>`;
            blackMarketCount = 0;
            const badge = document.getElementById("black-market-count");
            if (badge) badge.textContent = "0";
            lucide.createIcons();
        });
    }

    // Filtry Podsumowania
    const summaryCityFilter = document.getElementById("filter-summary-city");
    if (summaryCityFilter) {
        summaryCityFilter.addEventListener("change", () => {
            updateTable(null, false); // Odśwież widok bez resetowania paginacji
        });
    }

    // Przyciski czyszczenia miast
    document.querySelectorAll(".btn-clear-city").forEach(btn => {
        btn.addEventListener("click", function() {
            const cityId = this.dataset.city;
            const cityName = locationIDToName[cityId] || "mieście";
            
            // Czyścimy ceny dla tego miasta z pricesData
            for (const key in pricesData) {
                if (pricesData[key].prices[cityId]) {
                    delete pricesData[key].prices[cityId];
                    delete pricesData[key].last_update[cityId];
                }
            }

            addConsoleLog(`[LOKALIZACJA] Wyczyszczono wszystkie przechwycone ceny dla miasta: ${cityName}`, "info");
            
            // Odświeżamy widoki
            renderCityTabs();
            updateTable();
        });
    });

    // Regularne odpytywanie o pakiet sieciowy co 3 sekundy w celu wyświetlenia licznika pakietów
    setInterval(function() {
        fetch("/api/prices") // robimy lekki request, ale docelowo pobieramy status
            .then(() => {
                // Backend aktualizuje pakiet w pamięci, ale możemy też pobierać statystyki
                // Dla uproszczenia, w websocket_hub i tak dostajemy pakiety, 
                // więc zwiększamy licznik bezpośrednio przy nadejściu pakietu!
            })
            .catch(() => {});
    }, 5000);

    // 2. Obsługa przycisku "Wesprzyj Puszczę" (Donacja)
    const btnDonate = document.getElementById("btn-donate");
    if (btnDonate) {
        btnDonate.addEventListener("click", function(e) {
            e.stopPropagation(); // Zapobiegaj zamykaniu dymka przez globalny listener
            showWizardBubble("Dar dla Druida", `
                <div style="text-align: center; display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 1.4rem;">💰✨</div>
                    <div style="font-size: 0.95rem; line-height: 1.4;">
                        Twoje złoto pomoże mi dbać o te knieje i rozwijać nasze wspólne narzędzie!
                    </div>
                    <div style="background: rgba(255, 215, 0, 0.1); border: 1px dashed #ffd700; padding: 10px; border-radius: 8px;">
                        <div style="font-weight: bold; color: #ffd700; margin-bottom: 5px;">WYBIERZ FORMĘ OFIARY:</div>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                            <a href="#" class="btn btn-sm btn-donate" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i data-lucide="coffee" style="width:14px;"></i> Postaw Druidowi kawę
                            </a>
                            <a href="#" class="btn btn-sm" style="background: #0070ba; color: white; text-decoration: none; border: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i data-lucide="send" style="width:14px;"></i> PayPal
                            </a>
                            <a href="#" class="btn btn-sm" style="background: #333; color: white; text-decoration: none; border: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i data-lucide="bitcoin" style="width:14px;"></i> Krypto-ofiara
                            </a>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        Każdy grosz zasila rozwój sniffera i nowe funkcje leśnego centrum.
                    </div>
                </div>
            `, 0, 1); // priority 1
        });
    }

    // 2. Obsługa przycisku "Synchronizuj API"
    const btnSync = document.getElementById("btn-sync-api");
    btnSync.addEventListener("click", function() {
        btnSync.disabled = true;
        btnSync.innerHTML = `<i data-lucide="loader" class="btn-icon pulsate"></i> Syncowanie...`;
        lucide.createIcons();
        addConsoleLog("[API] Pobieranie aktualnych cen społeczności z Albion Online Data Project...", "info");

        fetch("/api/sync-prices")
            .then(res => res.json())
            .then(data => {
                addConsoleLog(`[API] Synchronizacja ukończona! Zaktualizowano ${data.prices_recorded} cen.`, "success");
                btnSync.disabled = false;
                btnSync.innerHTML = `<i data-lucide="refresh-cw" class="btn-icon"></i> Synchronizuj API`;
                lucide.createIcons();
                fetchPrices();
                updateTotalPotentialProfit();
            })
            .catch(err => {
                console.error(err);
                addConsoleLog("[API BŁĄD] Synchronizacja nie powiodła się. Sprawdź konsolę.", "system");
                btnSync.disabled = false;
                btnSync.innerHTML = `<i data-lucide="refresh-cw" class="btn-icon"></i> Synchronizuj API`;
                lucide.createIcons();
            });
    });

    // Obsługa przycisku "Wyczyść całą bazę"
    const btnCleanOld = document.getElementById("btn-clean-old");
    if (btnCleanOld) {
        btnCleanOld.addEventListener("click", () => {
            btnCleanOld.disabled = true;
            btnCleanOld.innerHTML = `<i data-lucide="loader-2" class="btn-icon spin"></i> Czyszczenie...`;
            lucide.createIcons();

            fetch("/api/clean-old")
                .then(() => {
                    addConsoleLog("[SYSTEM] Usunięto nieaktualne oferty (starsze niż 24h).", "system");
                    fetchPrices();
                })
                .finally(() => {
                    btnCleanOld.disabled = false;
                    btnCleanOld.innerHTML = `<i data-lucide="clock" class="btn-icon"></i> Usuń stare`;
                    lucide.createIcons();
                });
        });
    }

    const btnClearDB = document.getElementById("btn-clear-db");
    if (btnClearDB) {
        btnClearDB.addEventListener("click", function() {
            if (!confirm("Czy na pewno chcesz wyczyścić CAŁĄ bazę danych cen dla aktualnego regionu? Tej operacji nie można cofnąć!")) {
                return;
            }

            btnClearDB.disabled = true;
            btnClearDB.innerHTML = `<i data-lucide="loader" class="btn-icon pulsate"></i> Czyszczenie...`;
            lucide.createIcons();

            fetch("/api/clear-db", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    addConsoleLog("[BAZA] Baza danych rynkowych została pomyślnie wyczyszczona!", "success");
                    btnClearDB.disabled = false;
                    btnClearDB.innerHTML = `<i data-lucide="trash-2" class="btn-icon"></i> Wyczyść całą bazę`;
                    lucide.createIcons();
                    
                    // Reset lokalnego stanu i odświeżenie widoków
                    pricesData = {};
                    updateTable();
                    renderCityTabs();
                    updateTotalPotentialProfit();
                    updateBestCityRecommendation();
                    
                    // Czyścimy Live Feed
                    const liveFeedBody = document.getElementById("live-feed-body");
                    if (liveFeedBody) liveFeedBody.innerHTML = "";
                    
                    // Czyścimy Black Market
                    const bmBody = document.getElementById("black-market-body");
                    if (bmBody) bmBody.innerHTML = "";
                    
                    blackMarketCount = 0;
                    const bmBadge = document.getElementById("black-market-count");
                    if (bmBadge) bmBadge.textContent = "0";
                })
                .catch(err => {
                    console.error(err);
                    addConsoleLog("[BŁĄD] Nie udało się wyczyścić bazy danych.", "system");
                    btnClearDB.disabled = false;
                    btnClearDB.innerHTML = `<i data-lucide="trash-2" class="btn-icon"></i> Wyczyść całą bazę`;
                    lucide.createIcons();
                });
        });
    }

    // 3. Obsługa przycisku "Uruchom nasłuch" (jeśli istnieje)
    const btnStartSniffer = document.getElementById("btn-start-sniffer");
    if (btnStartSniffer) {
        btnStartSniffer.addEventListener("click", function() {
            const selectedDev = document.getElementById("select-interface").value;
            if (!selectedDev) {
                addConsoleLog("[BŁĄD] Wybierz kartę sieciową z listy!", "system");
                return;
            }

            btnStartSniffer.disabled = true;
            btnStartSniffer.innerHTML = `<i data-lucide="loader" class="btn-icon pulsate"></i> Uruchamianie...`;
            lucide.createIcons();

            fetch("/api/start-sniffer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interface_name: selectedDev })
            })
            .then(res => res.json())
            .then(data => {
                addConsoleLog(`[SNIFFER] Rozpoczęto aktywny nasłuch na: ${data.active}`, "success");
                selectedInterface = data.active;
                btnStartSniffer.disabled = false;
                btnStartSniffer.className = "btn btn-secondary";
                btnStartSniffer.innerHTML = `<i data-lucide="zap" class="btn-icon"></i> Nasłuch Aktywny`;
                lucide.createIcons();
                fetchInterfaces(); // Odśwież status w liście kart
            })
            .catch(err => {
                console.error(err);
                addConsoleLog("[BŁĄD] Nie udało się przełączyć sniffera na wybraną kartę.", "system");
                btnStartSniffer.disabled = false;
                btnStartSniffer.className = "btn btn-secondary";
                btnStartSniffer.innerHTML = `<i data-lucide="play" class="btn-icon"></i> Uruchom nasłuch`;
                lucide.createIcons();
            });
        });
    }

    // 4. Obsługa ręcznej zmiany strefy (Moja lokalizacja)
    const selectManualCity = document.getElementById("select-manual-city");
    if (selectManualCity) {
        selectManualCity.addEventListener("change", function() {
            const selectedVal = selectManualCity.value;
            if (!selectedVal) return;
            
            const cityName = locationIDToName[selectedVal] || (selectedVal === "3003" ? "Black Market" : selectedVal);
            addConsoleLog(`[LOKALIZACJA] Ręcznie ustawiono strefę gracza na: ${cityName}`, "info");
            selectManualCity.style.borderColor = "var(--border, #333)";

            fetch("/api/set-location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ location_id: selectedVal })
            })
            .then(res => res.json())
            .then(data => {
                addConsoleLog(`[LOKALIZACJA] Zsynchronizowano nową strefę: ${cityName}`, "success");
                
                // POWIADOMIENIE OD DRUIDA
                const comment = druidCityComments[selectedVal] || `Zmieniamy rynek na ${cityName}? Niech owoce tego handlu będą słodkie!`;
                showWizardBubble(`🌿 ${cityName}`, comment, 8000);
            })
            .catch(err => {
                console.error("Błąd synchronizacji lokacji:", err);
                addConsoleLog(`[LOKALIZACJA BŁĄD] Serwer odrzucił aktualizację strefy.`, "system");
            });
        });
    }

    // Obsługa przycisku odświeżania rekomendacji miasta
    const btnRefreshRec = document.getElementById("btn-refresh-recommendation");
    if (btnRefreshRec) {
        btnRefreshRec.addEventListener("click", () => {
            const icon = btnRefreshRec.querySelector("i");
            if(icon) icon.classList.add("pulsate");
            updateBestCityRecommendation();
            setTimeout(() => {
                if(icon) icon.classList.remove("pulsate");
            }, 500);
        });
    }

    // 5. Obsługa filtrów tabeli
    const filterSearch = document.getElementById("filter-search");
    const filterCity = document.getElementById("filter-city");
    const filterTier = document.getElementById("filter-tier");
    const filterEnchantment = document.getElementById("filter-enchantment");
    const filterQuality = document.getElementById("filter-quality");
    const filterProfitable = document.getElementById("filter-profitable-only");
    const filterResources = document.getElementById("filter-resources-only");
    const filterSort = document.getElementById("filter-sort");

    if (filterSearch) filterSearch.addEventListener("input", () => updateTable(null, true));
    if (filterCity) filterCity.addEventListener("change", () => updateTable(null, true));
    if (filterTier) filterTier.addEventListener("change", () => updateTable(null, true));
    if (filterEnchantment) filterEnchantment.addEventListener("change", () => updateTable(null, true));
    if (filterQuality) filterQuality.addEventListener("change", () => updateTable(null, true));
    if (filterProfitable) filterProfitable.addEventListener("change", () => updateTable(null, true));
    if (filterResources) filterResources.addEventListener("change", () => updateTable(null, true));
    if (filterSort) filterSort.addEventListener("change", () => updateTable(null, true));

    // Obsługa sortowania przez kliknięcie w nagłówki tabeli
    const tableHeaders = document.querySelectorAll("#profit-table th.sortable");
    tableHeaders.forEach(header => {
        header.addEventListener("click", function() {
            const sortType = this.getAttribute("data-sort");
            if (sortType && filterSort) {
                filterSort.value = sortType;
                // Wyzwalamy zdarzenie change, aby zaktualizować tabelę
                filterSort.dispatchEvent(new Event("change"));
                
                // Wizualna informacja o aktywnym sortowaniu
                tableHeaders.forEach(h => h.classList.remove("active-sort"));
                this.classList.add("active-sort");
            }
        });
    });

    // Obsługa zakładek trybu Czarnego Rynku (Szybka sprzedaż vs Zlecenie sprzedaży)
    document.querySelectorAll(".bm-mode-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".bm-mode-btn").forEach(b => {
                b.classList.remove("active");
                b.style.color = "var(--text-muted, #aaa)";
                b.style.borderBottom = "2px solid transparent";
            });
            this.classList.add("active");
            this.style.color = "var(--text, #fff)";
            this.style.borderBottom = "2px solid var(--primary, #5151e5)";
            
            currentBmMode = this.dataset.bmMode;
            updateTable(null, true);
            
            // Synchronizacja slajdu rekomendacji z wybranym trybem rynkowym
            setSlide(currentBmMode === "buy" ? 0 : 1);
            updateTotalPotentialProfit();
        });
    });

    // Obsługa nawigacji karuzeli rekomendacji miast
    const recPrevBtn = document.getElementById("rec-prev-btn");
    const recNextBtn = document.getElementById("rec-next-btn");
    const recSlidesContainer = document.getElementById("rec-slides-container");
    const recDots = [document.getElementById("rec-dot-0"), document.getElementById("rec-dot-1")];

    function setSlide(index) {
        if (index < 0 || index > 1) return;
        currentSlideIndex = index;
        
        // Przesuń kontener slajdów horyzontalnie
        if (recSlidesContainer) {
            recSlidesContainer.style.transform = `translateX(-${index * 50}%)`;
        }

        // Zaktualizuj stan kropek
        recDots.forEach((dot, idx) => {
            if (dot) {
                if (idx === index) {
                    dot.classList.add("active");
                    dot.style.background = "#fff";
                    dot.style.opacity = "1";
                } else {
                    dot.classList.remove("active");
                    dot.style.background = "rgba(255,255,255,0.2)";
                    dot.style.opacity = "0.5";
                }
            }
        });

        // Wywołaj aktualizację
        renderCityTabs();
        updateBestCityRecommendation();
        updateTotalPotentialProfit();
    }

    if (recPrevBtn) {
        recPrevBtn.addEventListener("click", function() {
            setSlide(currentSlideIndex === 0 ? 1 : 0);
        });
    }

    if (recNextBtn) {
        recNextBtn.addEventListener("click", function() {
            setSlide(currentSlideIndex === 0 ? 1 : 0);
        });
    }

    recDots.forEach((dot, idx) => {
        if (dot) {
            dot.addEventListener("click", function() {
                setSlide(idx);
            });
        }
    });

    // Obsługa kliknięć paginacji
    const btnPagePrev = document.getElementById("btn-page-prev");
    const btnPageNext = document.getElementById("btn-page-next");
    if (btnPagePrev) {
        btnPagePrev.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                updateTable();
            }
        });
    }
    if (btnPageNext) {
        btnPageNext.addEventListener("click", () => {
            currentPage++;
            updateTable();
        });
    }

    // Obsługa kliknięć paginacji dla miast
    const cityIdsForPagination = ["3008", "1004", "3002", "1002", "2004", "3005", "5003"];
    cityIdsForPagination.forEach(cityId => {
        ["prices", "profit"].forEach(type => {
            const tableId = `body-${type}-${cityId}`;
            const btnPrev = document.getElementById(`btn-prev-${tableId}`);
            const btnNext = document.getElementById(`btn-next-${tableId}`);
            if (btnPrev) {
                btnPrev.addEventListener("click", () => {
                    if (cityPageStates[tableId] > 1) {
                        cityPageStates[tableId]--;
                        renderCityTabs();
                    }
                });
            }
            if (btnNext) {
                btnNext.addEventListener("click", () => {
                    if (!cityPageStates[tableId]) cityPageStates[tableId] = 1;
                    cityPageStates[tableId]++;
                    renderCityTabs();
                });
            }
        });
    });

    // --- SNIFFER & INTERFACES LOGIC ---
    const selectInterface = document.getElementById("select-interface");
    const btnRefreshInterfaces = document.getElementById("btn-refresh-interfaces");
    const snifferStatusText = document.getElementById("sniffer-status-text");
    const snifferPacketCount = document.getElementById("sniffer-packet-count");


    if (selectInterface) {
        selectInterface.addEventListener("change", function() {
            const ifaceName = this.value;
            if (!ifaceName) return;

            addConsoleLog(`[SYSTEM] Przełączanie sniffera na kartę: ${ifaceName}...`, "info");
            snifferStatusText.innerText = "Przełączanie...";
            snifferStatusText.style.color = "var(--color-warning)";

            fetch("/api/start-sniffer", {
                method: "POST",
                body: JSON.stringify({ interface_name: ifaceName })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === "started") {
                    addConsoleLog(`[SYSTEM] Sniffer uruchomiony pomyślnie na: ${ifaceName}`, "success");
                    snifferStatusText.innerText = "Aktywny";
                    snifferStatusText.style.color = "var(--color-success)";
                }
            })
            .catch(err => {
                addConsoleLog(`[BŁĄD] Nie udało się zmienić karty: ${err}`, "error");
                snifferStatusText.innerText = "Błąd";
                snifferStatusText.style.color = "var(--color-danger)";
            });
        });
    }

    if (btnRefreshInterfaces) {
        btnRefreshInterfaces.addEventListener("click", fetchInterfaces);
    }

    // Pierwsze pobranie kart
    fetchInterfaces();

    // 6. Ustawienia handlowe (Premium i opłata za zlecenie)
    const togglePremium = document.getElementById("toggle-premium");
    const labelRoyalTax = document.getElementById("royal-tax-val");

    togglePremium.addEventListener("change", function() {
        isPremium = togglePremium.checked;
        if (isPremium) {
            labelRoyalTax.innerText = "4% (Premium)";
            addConsoleLog("[USTAWIENIA] Włączono status konta Premium (Podatki miast = 4%).", "info");
        } else {
            labelRoyalTax.innerText = "8% (Brak)";
            addConsoleLog("[USTAWIENIA] Wyłączono status konta Premium (Podatki miast = 8%).", "info");
        }
        updateTable();
    });

    const toggleBuyOrder = document.getElementById("toggle-buy-order");
    toggleBuyOrder.addEventListener("change", function() {
        isBuyOrder = toggleBuyOrder.checked;
        if (isBuyOrder) {
            addConsoleLog("[USTAWIENIA] Włączono kalkulację dla Zleceń Kupna (Buy Orders) w miastach (+1.5% kosztu instalacji).", "info");
        } else {
            addConsoleLog("[USTAWIENIA] Włączono kalkulację dla Natychmiastowego Zakupu (Sells Orders) w miastach.", "info");
        }
        updateTable();
    });



    // 7. Przycisk czyszczenia konsoli
    document.getElementById("btn-clear-console").addEventListener("click", function() {
        const consoleBox = document.getElementById("console-logs");
        consoleBox.innerHTML = `
            <div class="console-line system">[SYSTEM] Konsola wyczyszczona.</div>
        `;
        addConsoleLog("[SYSTEM] Nasłuch aktywny...", "system");
    });

    // 8. Zamykanie menu Gandalfa po kliknięciu poza nim
    document.addEventListener("click", function(e) {
        const container = document.getElementById("wizard-container");
        if (container && !container.contains(e.target)) {
            closeWizardMenu();
            closeWizardBubble();
        }
    });

    // 9. Przycisk zamykania aplikacji
    document.getElementById("btn-shutdown").addEventListener("click", function() {
        if (!confirm("Na pewno chcesz zamknąć Albion Market? Baza danych zostanie zapisana automatycznie.")) return;
        
        addConsoleLog("[SYSTEM] Zamykanie aplikacji...", "error");
        
        fetch("/api/shutdown", { method: "POST" })
            .then(() => {
                document.body.innerHTML = `
                    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; gap: 16px; font-family: var(--font-sans); color: #d4af37;">
                        <div style="font-size: 3rem;">🧙‍♂️</div>
                        <h2 style="font-family: 'Cinzel', serif;">Albion Market zamknięty</h2>
                        <p style="color: #b39f82;">Baza danych została bezpiecznie zapisana. Możesz zamknąć tę kartę.</p>
                    </div>
                `;
            })
            .catch(() => {
                document.body.innerHTML = `
                    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; gap: 16px; font-family: var(--font-sans); color: #d4af37;">
                        <div style="font-size: 3rem;">🧙‍♂️</div>
                        <h2 style="font-family: 'Cinzel', serif;">Albion Market zamknięty</h2>
                        <p style="color: #b39f82;">Aplikacja została zamknięta. Możesz zamknąć tę kartę.</p>
                    </div>
                `;
            });
    });
});

// =====================================================================
// DRUID MASCOT — INTERAKTYWNY OPIEKUN LASU (I TWOJEGO PORTFELA)
// =====================================================================

const wizardTips = [
    "🌳 Natura płacze, gdy kupujesz na Czarnym Rynku – tam się tylko SPRZEDAJE!",
    "🍃 Przedmioty T4 i T5 są jak liście na wietrze – schodzą na BM masowo i szybko.",
    "🪵 Zawsze sprawdzaj zapotrzebowanie! Jeśli las (BM) chce 1 sztukę, nie przynoś 50.",
    "🌿 Premium to jak nawóz dla Twoich zysków – 4% podatku zamiast 8% to kolosalna różnica!",
    "🍄 Ekwipunek Excellent/Masterpiece to rzadkie okazy – dają wielki zysk, ale długo rosną (sprzedają się).",
    "🦉 Transport z Bridgewatch jest bezpieczny jak gniazdo sowy, jeśli trzymasz się niebieskich stref.",
    "☘️ Dywersyfikuj towary – nie kładź wszystkich jaj do jednego koszyka, bo gankerzy je stłuką.",
    "🧙 ROI poniżej 10%? Nawet Druidzi wiedzą, że to za mało na transport przez czerwone strefy.",
    "🔥 Ceny na BM zmieniają się szybciej niż pogoda w puszczy – sprawdzaj dane regularnie!",
    "⚡ Filtr 'Tylko zyskowne' oszczędzi Twoje zasoby, tak jak deszcz oszczędza rośliny.",
    "🌲 'Podsumowanie Inwestycji' powie Ci dokładnie, ile srebra musisz zasiać, żeby zebrać plony.",
    "🦢 Najlepsi handlarze są jak łabędzie – spokojni na powierzchni, ale pod wodą ciężko pracują nad wolumenem.",
    "💧 Martlock i Lymhurst to źródła najtańszych surowców – czerp z nich mądrze.",
    "🐎 Wół to Twój najlepszy przyjaciel w lesie – większy udźwig to gęstsze plony z transportu.",
    "📊 Czasem bezpieczniejsza ścieżka przez las jest lepsza niż ta krótsza, usłana trupami kupców.",
    "🛠️ Przetwarzanie (Refining) w mieście z bonusem to podstawa – 36.7% zwrotu to Twój czysty zysk!",
    "🔥 Focus przy refiningu to jak słońce dla roślin – zwiększa zwrot surowców do ponad 50%!"
];

const wizardQuotes = [
    "\"Jeden złoty nie czyni kupca, ale dziesięć milionów już tak.\" — Druid z Lymhurst",
    "\"Kto rano wstaje, ten na BM-ie plony zbiera, zanim gankerzy się obudzą.\"",
    "\"W puszczy nie ma litości, są tylko marże i gęste krzaki.\" — Kupiec wygnany z Caerleonu",
    "\"Nie wszystko co się świeci to złoto... czasem to po prostu oczy gankera w krzakach.\"",
    "\"Kto nie ryzykuje, ten nie pije miodu w Martlocku... i nie jeździ luksusowym wierzchowcem.\"",
    "\"Cierpliwość jest jak korzenie – gorzka, ale owoce w srebrze są słodkie.\"",
    "\"Nie licz jagód przed zebraniem, ani zysku przed akceptacją zlecenia na BM.\"",
    "\"Kupuj gdy inni uciekają do miast, sprzedawaj gdy wszyscy pragną luksusu.\"",
    "\"Mała strata to tylko przycięcie gałęzi – Twój portfel dzięki temu urośnie silniejszy.\"",
    "\"Handel to taniec z naturą – jeśli nie czujesz rytmu, zjedzą Cię wilki.\""
];

const druidCityComments = {
    "3002": "Martlock? Obyś nie spotkał tam głodnych wilków... miej ze sobą chociaż porządny stek na przynętę!",
    "3003": "Czarny Rynek? Nawet natura tam nie zagląda, ale srebro pachnie tam najlepiej w całym Albionie!",
    "3005": "Caerleon... serce betonowej puszczy. Uważaj na gałęzie... to znaczy na noże gankerów w plecach!",
    "3008": "Lymhurst! Poczuj ten zapach sosen i zysku. Tutaj najlepsze okazje rosną prosto na drzewach!",
    "2004": "Fort Sterling? Brrr, tam nawet kora na drzewach zamarza. Ubierz się ciepło, bo zysk Cię nie ogrzeje!",
    "1002": "Thetford... wilgotno tu jak w starym bagnie, ale handel kwitnie gęściej niż nenufary na jeziorze!",
    "1004": "Bridgewatch? Piach w butach, piach w zębach, ale złoto w kieszeni wszystko Ci zrekompensuje!",
    "5003": "Brecilien? Magiczny las, magiczne ceny. Tylko nie zgub drogi powrotnej w tych mgłach!"
};



function toggleWizardMenu() {
    const menu = document.getElementById("wizard-menu");
    const bubble = document.getElementById("wizard-bubble");
    
    // Zamknij dymek jeśli otwarty
    if (bubble.classList.contains("visible")) {
        bubble.classList.remove("visible");
    }
    
    // Toggle menu
    menu.classList.toggle("visible");
    lucide.createIcons();
}

function closeWizardMenu() {
    const menu = document.getElementById("wizard-menu");
    if (menu) menu.classList.remove("visible");
}

function closeWizardBubble() {
    const bubble = document.getElementById("wizard-bubble");
    if (bubble) bubble.classList.remove("visible");
    wizardBubblePriority = 0; // Reset priorytetu przy zamknięciu
    if (wizardBubbleTimeout) {
        clearTimeout(wizardBubbleTimeout);
        wizardBubbleTimeout = null;
    }
}

let wizardBubbleTimeout = null;
let wizardBubblePriority = 0; // 0: info, 1: manual action (donations, settings)

function showWizardBubble(title, text, autoCloseMs = 0, priority = 0) {
    // Jeśli aktualny dymek ma wyższy priorytet, zignoruj nowe powiadomienie o niższym priorytecie
    if (wizardBubblePriority > priority && document.getElementById("wizard-bubble").classList.contains("visible")) {
        return;
    }

    closeWizardMenu();
    wizardBubblePriority = priority;
    
    // Wyczyść poprzedni timeout jeśli istnieje
    if (wizardBubbleTimeout) {
        clearTimeout(wizardBubbleTimeout);
        wizardBubbleTimeout = null;
    }
    
    const bubble = document.getElementById("wizard-bubble");
    const titleEl = bubble.querySelector(".wizard-bubble-title");
    const textEl = document.getElementById("wizard-bubble-text");
    
    // Zachowaj ikonę i zmień tekst tytułu
    titleEl.innerHTML = `<i data-lucide="leaf" style="width: 14px; height: 14px;"></i> ${title}`;
    textEl.innerHTML = text;
    
    bubble.classList.add("visible");
    lucide.createIcons();
    
    // Jeśli ustawiono autoClose, zaplanuj zamknięcie
    if (autoCloseMs > 0) {
        wizardBubbleTimeout = setTimeout(() => {
            closeWizardBubble();
            wizardBubbleTimeout = null;
            wizardBubblePriority = 0; // Reset priorytetu po zamknięciu
        }, autoCloseMs);
    }
}

function wizardAction(action) {
    switch(action) {
        case 'tip': {
            const tip = wizardTips[Math.floor(Math.random() * wizardTips.length)];
            showWizardBubble("Porada Handlowa", tip);
            break;
        }
        
        case 'summary': {
            // Generuj podsumowanie na żywo z aktualnych danych
            let totalItems = 0;
            let totalProfit = 0;
            let bestItemName = "—";
            let bestItemProfit = 0;
            
            for (const key in pricesData) {
                const item = pricesData[key];
                if (!item || !item.prices || !item.prices["3003"]) continue;
                totalItems++;
                
                const bmPrice = item.prices["3003"] || 0;
                let bestCityPrice = Infinity;
                for (const locID in item.prices) {
                    if (locID === "3003" || locID === "3003_sell") continue;
                    const p = item.prices[locID];
                    if (p > 0 && p < bestCityPrice) bestCityPrice = p;
                }
                if (bestCityPrice === Infinity) continue;
                
                const bmTaxRate = isPremium ? 0.04 : 0.08;
                const profit = bmPrice - Math.round(bmPrice * bmTaxRate) - bestCityPrice;
                if (profit > 0) totalProfit += profit;
                if (profit > bestItemProfit) {
                    bestItemProfit = profit;
                    bestItemName = translateItem(item.item_id);
                }
            }
            
            const summaryHtml = `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div>📦 <strong>Przedmioty w puszczy:</strong> ${totalItems}</div>
                    <div>💰 <strong>Suma zysków (1 szt):</strong> <span style="color: var(--color-success);">${formatSilver(totalProfit)}</span></div>
                    <div>🏆 <strong>Najlepszy okaz:</strong> ${bestItemName}</div>
                    <div>⚡ <strong>Zysk okazu:</strong> <span style="color: var(--color-success);">+${formatSilver(bestItemProfit)}</span></div>
                </div>
            `;
            showWizardBubble("Stan Natury", summaryHtml);
            break;
        }
        
        case 'lucky': {
            // Wylosuj losowy przedmiot z bazy
            const keys = Object.keys(pricesData);
            if (keys.length === 0) {
                showWizardBubble("Dar Lasu", "🌿 Puszcza jest jeszcze pusta! Najpierw przeskanuj rynek, a potem wróć po dar...");
                break;
            }
            
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const item = pricesData[randomKey];
            const name = translateItem(item.item_id);
            const imgUrl = `https://render.albiononline.com/v1/item/${item.item_id}.png?quality=${item.quality}`;
            
            const luckyHtml = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${imgUrl}" style="width: 48px; height: 48px; border: 1px solid var(--border-color); border-radius: 4px;" onerror="this.src='https://render.albiononline.com/v1/item/T4_BAG.png'">
                    <div>
                        <div style="font-weight: bold; color: var(--color-accent);">${name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">🍃 Szum wiatru mówi, że ten przedmiot przyniesie Ci dziś obfite plony!</div>
                    </div>
                </div>
            `;
            showWizardBubble("Dar Lasu", luckyHtml);
            break;
        }
        
        case 'quote': {
            const quote = wizardQuotes[Math.floor(Math.random() * wizardQuotes.length)];
            showWizardBubble("Cytat Dnia", `<em style="color: var(--text-secondary);">${quote}</em>`);
            break;
        }

        case 'roche': {
            showWizardBubble("Vernon Roche", `<div style="font-size: 1.1rem; color: var(--text);">Patriota chociaż chuj</div>`);
            break;
        }

        case 'iorweth': {
            showWizardBubble("Iorweth", `<div style="font-size: 1.1rem; color: var(--text);">Zwykły skurwysyn</div>`);
            break;
        }

        case 'fraszka': {
            showWizardBubble("Fraszka Druida", `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="font-size: 0.95rem;">Wpisz swe imię, wędrowcze, a puszcza odpowie Ci fraszką:</div>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="fraszka-name" placeholder="Twoje imię..." style="
                            flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--border, #333);
                            color: #fff; padding: 6px 10px; border-radius: 4px; outline: none; font-family: var(--font-sans);
                        " onkeydown="if(event.key === 'Enter') submitFraszkaName()">
                        <button onclick="submitFraszkaName()" style="
                            background: var(--primary, #5151e5); border: none; color: white;
                            padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;
                        ">Powiedz!</button>
                    </div>
                </div>
            `, 0);
            // Autofocus na input
            setTimeout(() => {
                const input = document.getElementById("fraszka-name");
                if (input) input.focus();
            }, 100);
            break;
        }
    }
}

function submitFraszkaName() {
    const input = document.getElementById("fraszka-name");
    const name = input ? input.value.trim() : "";
    if (!name) return;

    showWizardBubble("Fraszka dla Ciebie", `
        <div style="text-align: center; padding: 10px 0;">
            <div style="font-size: 1.25rem; font-family: 'Cinzel', serif; color: var(--color-accent); margin-bottom: 8px;">
                ${name}, ${name} Ty chuju
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">
                — Starodawna mądrość puszczy
            </div>
        </div>
    `, 8000);
}

// Uczyń funkcję dostępną globalnie dla atrybutów onclick
window.submitFraszkaName = submitFraszkaName;

// =====================================================================
// REFINING CALCULATOR
// =====================================================================

function renderRefiningTable() {
    const tbody = document.getElementById("refining-body");
    if (!tbody) return;

    const selectedCity = document.getElementById("refining-city").value;
    const useFocus = document.getElementById("refining-focus").checked;
    const stationFee = parseInt(document.getElementById("refining-station-fee").value) || 0;

    // Pobieramy wybrane miasto główne (gdzie chcemy PRZERABIAĆ)
    const activeCityId = document.getElementById("select-manual-city").value;
    if (!activeCityId) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-placeholder"><div class="placeholder-content"><i data-lucide="alert-circle" class="placeholder-icon"></i><p>Wybierz miasto w którym jesteś (na górze), aby wyliczyć zyski.</p></div></td></tr>`;
        lucide.createIcons();
        return;
    }

    const results = [];
    const taxRate = isPremium ? 0.04 : 0.08;

    // Funkcja pomocnicza dla wartości przedmiotu (ItemValue) - potrzebna do Taxu na stanowisku
    const getItemValue = (id) => {
        const t = id.split('_')[0];
        const e = id.includes('@') ? parseInt(id.split('@')[1]) : 0;
        let val = 0;
        if (t === 'T2') val = 1;
        else if (t === 'T3') val = 3;
        else if (t === 'T4') val = 9;
        else if (t === 'T5') val = 27;
        else if (t === 'T6') val = 81;
        else if (t === 'T7') val = 243;
        else if (t === 'T8') val = 729;
        return val * Math.pow(2, e);
    };

    // Funkcja szukająca NAJTANIEJSZEJ ceny zakupu na całym świecie
    const getCheapestSource = (itemID) => {
        let minPrice = Infinity;
        let cityID = "";
        
        // Sprawdzamy wszystkie jakości (choć dla surowców zwykle 1)
        for (let q = 1; q <= 5; q++) {
            const item = pricesData[`${itemID}_${q}`];
            if (item) {
                for (const loc in item.prices) {
                    // Ignorujemy Czarny Rynek przy zakupie surowców
                    if (loc === "3003" || loc.includes("_buy")) continue;
                    
                    const price = item.prices[loc + "_sell"] || item.prices[loc] || 0;
                    if (price > 0 && price < minPrice) {
                        minPrice = price;
                        cityID = loc;
                    }
                }
            }
        }
        return { price: minPrice === Infinity ? 0 : minPrice, city: cityID };
    };

    // Przeszukujemy bazę pod kątem surowców przetworzonych (np. CLOTH, PLANKS)
    const processedTypes = Object.keys(refinedToRaw); // PLANKS, METALBAR, CLOTH, LEATHER, STONEBLOCK
    
    // Zbieramy listę wszystkich unikalnych ID surowców przetworzonych jakie mamy w bazie
    const refinedItemsInDb = Object.keys(pricesData).filter(key => {
        const baseID = key.split('_').slice(1).join('_').split('@')[0];
        return refinedToRaw[baseID];
    });

    // Używamy Setu, aby nie dublować przedmiotów o różnych jakościach (interesuje nas bazowy ID)
    const uniqueRefinedIDs = [...new Set(refinedItemsInDb.map(k => k.split('_')[0] + "_" + k.split('_').slice(1).join('_').split('@')[0] + (k.includes('@') ? "@" + k.split('@')[1] : "")))];

    uniqueRefinedIDs.forEach(refinedID => {
        const parts = refinedID.split('_');
        const tier = parts[0];
        const resType = parts[1].split('@')[0];
        const enchantment = refinedID.includes('@') ? "@" + refinedID.split('@')[1] : "";
        const tierNum = parseInt(tier.substring(1));

        // CENA SPRZEDAŻY PRODUKTU (Tam gdzie jesteśmy)
        // Szukamy najlepszej ceny sprzedaży (Sell Order / Najwyższy Buy)
        const itemData = pricesData[`${refinedID}_1`]; // Zakładamy jakość Normal dla wyniku
        if (!itemData) return;

        const outputPrice = itemData.prices[activeCityId + "_buy"] || itemData.prices[activeCityId] || 0;
        if (outputPrice === 0) return;

        // SKŁADNIKI
        const rawType = refinedToRaw[resType];
        const rawID = `${tier}_${rawType}${enchantment}`;
        const rawSource = getCheapestSource(rawID);

        let prevSource = { price: 0, city: "" };
        if (tierNum > 2) {
            const prevRefinedID = `T${tierNum - 1}_${resType}`; // Zawsze .0 (bez enchantmentu dla niższych tierów w przepisie)
            prevSource = getCheapestSource(prevRefinedID);
        } else {
            // T2 nie potrzebuje poprzedniego tieru
            prevSource = { price: 1, city: "system" }; // Placeholder, żeby przeszło walidację
        }

        if (rawSource.price === 0 || prevSource.price === 0) return;

        // RRR (Return Rate)
        let rrr = refiningReturnRates.none;
        const bonusData = refiningReturnRates[selectedCity];
        if (bonusData && bonusData.resource === rawType) {
            rrr = 0.367; // Bonus miejski
        }
        if (useFocus) {
            rrr = (rrr === 0.367) ? 0.539 : 0.435;
        }

        const ratio = refiningRatios[tier] || { raw: 1, prev: 0 };
        const usageFee = (getItemValue(refinedID) * 0.05) * (stationFee / 100);

        const totalIngredientCost = (rawSource.price * ratio.raw) + (tierNum > 2 ? prevSource.price * ratio.prev : 0) + usageFee;
        const effectiveCost = totalIngredientCost * (1 - rrr);
        const netProfit = outputPrice - (outputPrice * taxRate) - effectiveCost;
        const roi = (netProfit / effectiveCost) * 100;

        results.push({
            id: refinedID,
            name: translateItem(refinedID),
            tier: tier + enchantment,
            outputPrice,
            effectiveCost,
            netProfit,
            roi,
            ingredients: [
                { id: rawID, name: translateItem(rawID), price: rawSource.price, city: rawSource.city, amount: ratio.raw },
                { id: tierNum > 2 ? `T${tierNum - 1}_${resType}` : null, name: tierNum > 2 ? translateItem(`T${tierNum - 1}_${resType}`) : null, price: prevSource.price, city: prevSource.city, amount: ratio.prev }
            ].filter(ing => ing.id)
        });
    });

    if (results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-placeholder"><div class="placeholder-content"><i data-lucide="zap" class="placeholder-icon"></i><p>Brak danych cenowych dla surowców. Skanuj rynki w różnych miastach!</p></div></td></tr>`;
    } else {
        results.sort((a, b) => b.netProfit - a.netProfit);
        tbody.innerHTML = results.map(r => {
            const rowId = `ref-row-${r.id}`.replace(/[^a-z0-9]/gi, '_');
            return `
                <tr class="expandable-row" onclick="toggleRefiningDetails('${rowId}')">
                    <td class="expand-icon-cell"><i data-lucide="chevron-right" class="expand-icon"></i></td>
                    <td>
                        <div class="item-cell">
                            <img src="https://render.albiononline.com/v1/item/${r.id}.png" class="item-icon" style="width: 32px; height: 32px;">
                            <span>${r.name}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-tier">${r.tier}</span></td>
                    <td><span class="price-silver" style="color: var(--color-accent);">${formatSilver(r.outputPrice)}</span></td>
                    <td><span class="profit-value ${r.netProfit >= 0 ? 'profit-plus' : 'profit-minus'}">${r.netProfit >= 0 ? '+' : ''}${formatSilver(Math.round(r.netProfit))}</span></td>
                    <td><span class="roi-value ${r.roi >= 20 ? 'roi-high' : (r.roi >= 10 ? 'roi-mid' : 'roi-low')}">${r.roi.toFixed(1)}%</span></td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">
                        ${r.ingredients[0].city ? locationIDToName[r.ingredients[0].city] : "?"} + ${r.ingredients[1].city ? locationIDToName[r.ingredients[1].city] : ""}
                    </td>
                </tr>
                <tr id="ref-details-${rowId}" class="details-row">
                    <td colspan="8" class="details-container">
                        <div style="padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                            <h5 style="margin-bottom: 10px; color: var(--color-accent);">Składniki (Najtańsze źródła):</h5>
                            <table class="city-details-table">
                                <thead>
                                    <tr>
                                        <th>Składnik</th>
                                        <th>Ilość</th>
                                        <th>Cena jedn.</th>
                                        <th>Lokalizacja</th>
                                        <th>Suma za 1 craft</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${r.ingredients.filter(ing => ing.id).map(ing => `
                                        <tr>
                                            <td>${ing.name}</td>
                                            <td>${ing.amount} szt.</td>
                                            <td><span class="price-silver">${formatSilver(ing.price)}</span></td>
                                            <td><div class="badge-city"><i data-lucide="${cityIdToIcon[ing.city] || 'map-pin'}"></i> ${locationIDToName[ing.city]}</div></td>
                                            <td><span class="price-silver">${formatSilver(ing.price * ing.amount)}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    lucide.createIcons();
}

function toggleRefiningDetails(key) {
    const detailsRow = document.getElementById(`ref-details-${key}`);
    if (!detailsRow) return;
    const mainRow = detailsRow.previousElementSibling;
    
    const isExpanded = detailsRow.classList.contains("active");
    if (isExpanded) {
        detailsRow.classList.remove("active");
        mainRow.classList.remove("expanded");
    } else {
        detailsRow.classList.add("active");
        mainRow.classList.add("expanded");
    }
}


// =====================================================================
// GANDALF — DETEKCJA LOKALIZACJI
// =====================================================================

let lastLocationSuggestion = "";
let locationSuggestionTimeout = null;

function wizardAskLocation(cityID, cityName) {
    // Debounce: nie pytaj o to samo miasto w ciągu 30 sekund
    if (lastLocationSuggestion === cityID) return;
    lastLocationSuggestion = cityID;
    
    // Reset po 30 sekundach
    if (locationSuggestionTimeout) clearTimeout(locationSuggestionTimeout);
    locationSuggestionTimeout = setTimeout(() => {
        lastLocationSuggestion = "";
    }, 30000);
    
    const html = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>🌿 Wygląda na to, że przeglądasz rynek w mieście <strong style="color: var(--color-accent);">${cityName}</strong>!</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Czy chcesz, abym zapuścił korzenie w tym mieście?</div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button onclick="acceptLocationSuggestion('${cityID}', '${cityName}')" style="
                    flex: 1; padding: 8px 12px; border: 1px solid var(--color-success); background: rgba(74, 222, 128, 0.15);
                    color: var(--color-success); border-radius: 6px; cursor: pointer; font-family: var(--font-sans);
                    font-weight: bold; font-size: 0.82rem; transition: all 0.2s;
                " onmouseover="this.style.background='rgba(74, 222, 128, 0.3)'" onmouseout="this.style.background='rgba(74, 222, 128, 0.15)'">
                    ✓ Tak, ustaw ${cityName}
                </button>
                <button onclick="closeWizardBubble()" style="
                    padding: 8px 12px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);
                    color: var(--text-secondary); border-radius: 6px; cursor: pointer; font-family: var(--font-sans);
                    font-size: 0.82rem; transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    ✗ Nie
                </button>
            </div>
        </div>
    `;
    
    showWizardBubble("Szept Puszczy", html, 15000);
}

function acceptLocationSuggestion(cityID, cityName) {
    // Ustawiamy miasto w dropdown
    const sel = document.getElementById("select-manual-city");
    if (sel) {
        sel.value = cityID;
        sel.dispatchEvent(new Event("change"));
    }
    
    addConsoleLog(`[LOKALIZACJA] Druid zapuścił korzenie w: ${cityName}`, "success");
    
    // Podziękuj Druidem
    showWizardBubble("Korzenie Zapuszczone", `
        <div style="text-align: center;">
            <div style="font-size: 1.2rem; margin-bottom: 4px;">🌿✨</div>
            <div>Zapuściłem korzenie w <strong>${cityName}</strong>!</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">Teraz wszystkie plony cen zostaną przypisane do tego miejsca.</div>
        </div>
    `, 4000);
}

// Gandalf pyta o zmianę miasta po wejściu do klastra (strefy)
let lastZoneSuggestion = "";
let zoneSuggestionTimeout = null;

function wizardAskZoneChange(cityID, cityName, messageHtml, buttonLabel) {
    // Debounce: nie pytaj o to samo miasto w ciągu 60 sekund
    if (lastZoneSuggestion === cityID) return;
    lastZoneSuggestion = cityID;
    
    if (zoneSuggestionTimeout) clearTimeout(zoneSuggestionTimeout);
    zoneSuggestionTimeout = setTimeout(() => {
        lastZoneSuggestion = "";
    }, 60000);
    
    const html = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>${messageHtml}</div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button onclick="acceptLocationSuggestion('${cityID}', '${buttonLabel}')" style="
                    flex: 1; padding: 8px 12px; border: 1px solid var(--color-success); background: rgba(74, 222, 128, 0.15);
                    color: var(--color-success); border-radius: 6px; cursor: pointer; font-family: var(--font-sans);
                    font-weight: bold; font-size: 0.82rem; transition: all 0.2s;
                " onmouseover="this.style.background='rgba(74, 222, 128, 0.3)'" onmouseout="this.style.background='rgba(74, 222, 128, 0.15)'">
                    ✓ Tak, ustaw ${buttonLabel}
                </button>
                <button onclick="closeWizardBubble()" style="
                    padding: 8px 12px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);
                    color: var(--text-secondary); border-radius: 6px; cursor: pointer; font-family: var(--font-sans);
                    font-size: 0.82rem; transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    ✗ Nie
                </button>
            </div>
        </div>
    `;
    
    showWizardBubble("Zmiana Strefy", html, 20000);
}
