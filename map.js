// === SUPABASE ZUGANGSDATEN ===
const SUPABASE_URL = "https://bmngqythtalsddqtfuib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TPwfBJvsktOEDPZmQAcG0w_AnYnaQeW";

// Supabase Client initialisieren
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map;
let markersGroup;
let radiusCircleLayer = null;
let centerPinMarker = null;
let currentSearchCenter = null;

let tempMarker = null;          
let tempSelectedLatLng = null; 
let pendingPickedLatLng = null; 
let isPickingOnMap = false;    
let activeSpotForReport = null; 

let allSpots = [];

document.addEventListener("DOMContentLoaded", () => {
  // Loading Screen nach Animation ausblenden
  setTimeout(() => {
    const loader = document.getElementById("loadingScreen");
    if (loader) loader.classList.add("fade-out");
  }, 3500);

  renderGraffitiTitle("Deine Location dabei?");

  // Geografische Begrenzung: Deutschland mit großzügigem Rand.
  // Vorher endete die Grenze exakt an der Landesgrenze und zog die Karte
  // mit voller Härte zurück – im Grenzgebiet (Bodensee, Alpen, Nordsee,
  // Grenzregionen) war das Navigieren dadurch kaum möglich.
  const germanyBounds = L.latLngBounds(
    L.latLng(44.5, 1.5),    // Südwest – reicht bis Schweiz/Österreich/Frankreich
    L.latLng(57.5, 19.5)    // Nordost – reicht bis Dänemark/Polen/Tschechien
  );

  map = L.map("map", {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 17,
    maxBounds: germanyBounds,
    // 0.4 statt 1.0: sanftes Abfedern am Rand statt hartem Zurückschnappen
    maxBoundsViscosity: 0.4
  }).setView([51.1657, 10.4515], 6);

  // Esri Dark Map Tiles
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 17,
    maxNativeZoom: 16,
    attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ | Teile der Spot-Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
  }).addTo(map);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 17,
    maxNativeZoom: 16,
    interactive: false
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Bewusst KEIN Zurücksetzen beim Verschieben der Karte:
  // Suchmittelpunkt, Radiuskreis und Markierung bleiben erhalten, bis der
  // Nutzer aktiv neu sucht, den Standort nutzt oder das Suchfeld leert.
  map.on("moveend zoomend", () => {
    applyAllFilters();
  });

  // Event Listener für Filter
  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);

  // Bonus-Layer "Alle bekannten Bäder": Legende-Eintrag ein-/ausblenden + neu filtern
  const showAllPoolsToggle = document.getElementById("showAllPoolsToggle");
  const legendUnknownItem = document.getElementById("legendUnknownItem");
  if (showAllPoolsToggle) {
    showAllPoolsToggle.addEventListener("change", () => {
      if (legendUnknownItem) {
        legendUnknownItem.style.display = showAllPoolsToggle.checked ? "flex" : "none";
      }
      applyAllFilters();
    });
  }
  
  document.getElementById("radiusFilter").addEventListener("change", () => {
    if (currentSearchCenter) {
      updateRadiusAndPin(currentSearchCenter.lat, currentSearchCenter.lng);
    }
    applyAllFilters();
  });

  document.getElementById("searchBtn").addEventListener("click", executeSearch);

  // Live-Vorschläge beim Tippen (entprellt, damit es auf dem Handy flüssig bleibt)
  const searchInputEl = document.getElementById("searchInput");
  if (searchInputEl) {
    let suggestTimer = null;
    searchInputEl.addEventListener("input", () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(renderSuggestions, 140);
    });
    searchInputEl.addEventListener("focus", () => {
      if (searchInputEl.value.trim().length >= 2) renderSuggestions();
    });
  }

  // Klick außerhalb schließt die Vorschlagsliste
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-autocomplete")) hideSuggestions();
  });

  // Modal Öffnen / Schließen Events
  document.getElementById("openAddModalBtn").addEventListener("click", () => {
    removeTempMarker();
    tempSelectedLatLng = null;
    const statusText = document.getElementById("locationStatusText");
    if (statusText) statusText.textContent = "";
    openAddModal();
  });
  
  document.getElementById("closeAddModalBtn").addEventListener("click", closeAddModal);
  document.getElementById("addSpotForm").addEventListener("submit", handleAddSpotSubmit);

  const pickBtn = document.getElementById("pickOnMapBtn");
  if (pickBtn) {
    pickBtn.addEventListener("click", () => {
      isPickingOnMap = true;
      document.getElementById("addSpotModal").classList.remove("active");
    });
  }

  // RECHTLICHES & REPORT EVENTS
  const impressumBtn = document.getElementById("openImpressumBtn");
  if (impressumBtn) {
    impressumBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("impressumModal").classList.add("active");
    });
  }
  const closeImpressumBtn = document.getElementById("closeImpressumBtn");
  if (closeImpressumBtn) {
    closeImpressumBtn.addEventListener("click", () => {
      document.getElementById("impressumModal").classList.remove("active");
    });
  }

  const privacyBtn = document.getElementById("openPrivacyBtn");
  if (privacyBtn) {
    privacyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("privacyModal").classList.add("active");
    });
  }
  const closePrivacyBtn = document.getElementById("closePrivacyBtn");
  if (closePrivacyBtn) {
    closePrivacyBtn.addEventListener("click", () => {
      document.getElementById("privacyModal").classList.remove("active");
    });
  }

  const reportBtn = document.getElementById("openReportBtn");
  if (reportBtn) reportBtn.addEventListener("click", openReportModal);

  const closeReportBtn = document.getElementById("closeReportModalBtn");
  if (closeReportBtn) closeReportBtn.addEventListener("click", closeReportModal);

  const reportForm = document.getElementById("reportSpotForm");
  if (reportForm) reportForm.addEventListener("submit", handleReportSubmit);

  // Klick-Logik auf der Karte
  map.on("click", (e) => {
    const sheet = document.getElementById("bottomSheet");
    if (sheet && sheet.classList.contains("active")) {
      closeBottomSheet(true);
      return;
    }

    if (isPickingOnMap) {
      pendingPickedLatLng = e.latlng;
      removeTempMarker();
      
      tempMarker = L.marker(e.latlng, { icon: create3DPinIcon("📍", "pin-wildcard") }).addTo(map);

      const popupContent = document.createElement("div");
      popupContent.style.textAlign = "center";
      popupContent.style.padding = "4px";
      popupContent.innerHTML = `
        <p style="margin:0 0 8px 0; font-size:13px; font-weight:bold; color:#0b1120;">Ist das der richtige Ort?</p>
        <div style="display:flex; gap:6px; justify-content:center;">
          <button id="confirmPickBtn" style="background:#10b981; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">Ja</button>
          <button id="cancelPickBtn" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Abbrechen</button>
        </div>
      `;

      tempMarker.bindPopup(popupContent, { closeButton: false }).openPopup();

      setTimeout(() => {
        const confirmBtn = document.getElementById("confirmPickBtn");
        const cancelBtn = document.getElementById("cancelPickBtn");

        if (confirmBtn) {
          confirmBtn.addEventListener("click", async () => {
            tempSelectedLatLng = pendingPickedLatLng;
            isPickingOnMap = false;
            tempMarker.closePopup();

            await fetchAddressFromLatLng(tempSelectedLatLng.lat, tempSelectedLatLng.lng);
            document.getElementById("addSpotModal").classList.add("active");

            const statusText = document.getElementById("locationStatusText");
            if (statusText) {
              statusText.textContent = "✓ Standort auf Karte gewählt & Adresse ermittelt!";
            }
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => {
            removeTempMarker();
            pendingPickedLatLng = null;
          });
        }
      }, 50);

      return;
    }

    placeTempMarker(e.latlng);
  });

  window.addEventListener("popstate", () => {
    const sheet = document.getElementById("bottomSheet");
    if (sheet && sheet.classList.contains("active")) {
      closeBottomSheet(false);
    }
    closeAddModal();
    closeReportModal();
  });

  loadSpotsFromSupabase();
});

function resetSearchCenterState() {
  if (currentSearchCenter || radiusCircleLayer || centerPinMarker) {
    currentSearchCenter = null;
    if (radiusCircleLayer) {
      map.removeLayer(radiusCircleLayer);
      radiusCircleLayer = null;
    }
    if (centerPinMarker) {
      map.removeLayer(centerPinMarker);
      centerPinMarker = null;
    }
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
  }
}

function getUserLocation() {
  const locateBtn = document.getElementById("locateBtn");

  if (!navigator.geolocation) {
    alert("Geolocation wird von deinem Browser nicht unterstützt.");
    return;
  }

  if (locateBtn) locateBtn.style.opacity = "0.5";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (locateBtn) locateBtn.style.opacity = "1";
      const { latitude, longitude } = position.coords;
      
      currentSearchCenter = { lat: latitude, lng: longitude };
      
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = "Mein Standort";
      
      updateRadiusAndPin(latitude, longitude);
      applyAllFilters();
    },
    (error) => {
      if (locateBtn) locateBtn.style.opacity = "1";
      alert("Standort konnte nicht ermittelt werden.");
    },
    { enableHighAccuracy: true }
  );
}

async function fetchAddressFromLatLng(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();

    if (data && data.address) {
      const addr = data.address;
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      const road = addr.road || addr.pedestrian || addr.suburb || "";
      const houseNumber = addr.house_number || "";
      const streetFull = road ? (houseNumber ? `${road} ${houseNumber}` : road) : "";

      if (city) {
        const cityInput = document.getElementById("newSpotCity");
        if (cityInput) cityInput.value = city;
      }

      if (streetFull) {
        const streetInput = document.getElementById("newSpotStreet");
        if (streetInput) streetInput.value = streetFull;
      }
    }
  } catch (err) {
    console.warn("Reverse Geocoding Hinweis:", err);
  }
}

function placeTempMarker(latlng) {
  removeTempMarker();

  tempSelectedLatLng = latlng;
  tempMarker = L.marker(latlng, { 
    draggable: true,
    icon: create3DPinIcon("➕", "pin-wildcard")
  }).addTo(map);

  const popupContent = document.createElement("div");
  popupContent.style.textAlign = "center";
  popupContent.style.padding = "4px";
  popupContent.innerHTML = `
    <p style="margin:0 0 8px 0; font-size:13px; font-weight:bold; color:#0b1120;">Ist das der richtige Ort?</p>
    <div style="display:flex; gap:6px; justify-content:center;">
      <button id="confirmSpotBtn" style="background:#10b981; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">Ja, Spot eintragen</button>
      <button id="cancelSpotBtn" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;">Abbrechen</button>
    </div>
  `;

  tempMarker.bindPopup(popupContent, { closeButton: false }).openPopup();

  tempMarker.on("dragend", (event) => {
    tempSelectedLatLng = event.target.getLatLng();
    tempMarker.openPopup();
  });

  setTimeout(() => {
    const confirmBtn = document.getElementById("confirmSpotBtn");
    const cancelBtn = document.getElementById("cancelSpotBtn");

    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        await fetchAddressFromLatLng(tempSelectedLatLng.lat, tempSelectedLatLng.lng);
        openAddModal();
        const statusText = document.getElementById("locationStatusText");
        if (statusText) statusText.textContent = "✓ Standort auf Karte gewählt & Adresse ermittelt!";
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        removeTempMarker();
      });
    }
  }, 100);
}

function removeTempMarker() {
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
}

async function loadSpotsFromSupabase() {
  try {
    // WICHTIG: Supabase liefert pro Anfrage höchstens 1.000 Zeilen.
    // Ohne Blättern fehlten dadurch alle Spots ab dem 1001. Eintrag –
    // also ausgerechnet jeder neu hinzugefügte Spot (höchste ID).
    const PAGE_SIZE = 1000;
    let data = [];
    let from = 0;

    while (true) {
      const { data: page, error } = await supabaseClient
        .from('Spots')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Fehler beim Laden aus Supabase:", error);
        if (data.length === 0) return;   // gar nichts geladen -> abbrechen
        break;                            // Teilergebnis trotzdem anzeigen
      }

      if (!page || page.length === 0) break;

      data = data.concat(page);
      if (page.length < PAGE_SIZE) break; // letzte Seite erreicht
      from += PAGE_SIZE;

      if (from > 50000) break;            // Sicherheitsnetz gegen Endlosschleife
    }

    console.info(`Sprungbereich: ${data.length} Spots geladen.`);

    allSpots = data.map(spot => ({
      id: spot.id,
      name: spot.title || "Unbenannter Spot",
      city: spot.city || "",
      description: spot.description || "",
      type: spot.type || "Freibad",
      height: Number(spot.height) || 0,
      facilities: spot.facilities || [],
      images: spot.images || [],
      websiteUrl: spot.website_url || "",
      jumpAllowed: spot.jump_allowed || "",
      waterDepth: spot.water_depth || "",
      source: spot.source || "community",
      verified: spot.status === 'approved',
      status: spot.status,
      lat: Number(spot.latitude),
      lng: Number(spot.longitude)
    }));

    applyAllFilters();

    // Falls die Seite über einen geteilten Spot-Link geöffnet wurde,
    // direkt den passenden Spot öffnen (Deep-Link)
    openSharedSpotFromUrl();
  } catch (err) {
    console.error("Netzwerkfehler:", err);
  }
}

// ==========================================
// Teilen-Funktion
// ==========================================
async function shareSpot(spot) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;
  const shareText = `Schau dir "${spot.name}" auf Sprungbereich.de an!`;

  if (navigator.share) {
    try {
      await navigator.share({ title: spot.name, text: shareText, url: shareUrl });
    } catch (err) {
      // Nutzer hat den Teilen-Dialog abgebrochen – kein Fehler, einfach ignorieren
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showShareToast("Link kopiert! ✓");
    } catch (err) {
      showShareToast("Kopieren fehlgeschlagen – Link: " + shareUrl);
    }
  } else {
    showShareToast(shareUrl);
  }
}

// Kleiner, unaufdringlicher Hinweis unten am Bildschirmrand (statt alert())
function showShareToast(message) {
  let toast = document.getElementById("shareToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "shareToast";
    toast.style.cssText = "position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#0f172a; color:#00f2fe; border:1px solid rgba(0,242,254,0.4); padding:10px 18px; border-radius:8px; font-size:13px; font-weight:600; z-index:5000; box-shadow:0 4px 20px rgba(0,0,0,0.4); pointer-events:none; opacity:0; transition:opacity 0.25s;";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => { toast.style.opacity = "1"; });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = "0"; }, 2200);
}

// Öffnet automatisch den Spot aus ?spot=<id> in der URL (für geteilte Links)
function openSharedSpotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sharedId = params.get("spot");
  if (!sharedId) return;

  const spot = allSpots.find(s => String(s.id) === String(sharedId));
  if (!spot || isNaN(spot.lat) || isNaN(spot.lng)) return;

  map.setView([spot.lat, spot.lng], 15);
  setTimeout(() => openBottomSheet(spot), 400);
}

function renderGraffitiTitle(text) {
  const container = document.getElementById("dynamicGraffitiTitle");
  if (!container) return;
  container.innerHTML = "";
  
  const fontSizes = [22, 18, 16, 17, 19, 21, 17, 15, 18, 20, 16, 18, 17, 19, 21, 16, 18, 20, 22, 17, 19];

  text.split("").forEach((char, index) => {
    const span = document.createElement("span");
    span.className = "g-letter";
    span.textContent = char === " " ? "\u00A0" : char;
    
    // Relative Einheit statt fester Pixel: so wächst der Schriftzug auf
    // großen Bildschirmen automatisch mit (siehe Media-Queries im CSS).
    const size = fontSizes[index % fontSizes.length];
    span.style.fontSize = `${(size / 16).toFixed(3)}em`;
    
    const rotate = (index % 2 === 0 ? 3 : -3);
    span.style.transform = `rotate(${rotate}deg)`;

    container.appendChild(span);
  });
}

function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function updateRadiusAndPin(lat, lng) {
  const radiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;
  
  if (radiusCircleLayer) map.removeLayer(radiusCircleLayer);
  if (centerPinMarker) map.removeLayer(centerPinMarker);

  radiusCircleLayer = L.circle([lat, lng], {
    radius: radiusKm * 1000,
    color: "#10b981",
    weight: 2,
    fillColor: "#10b981",
    fillOpacity: 0.08,
    dashArray: "5, 5",
    interactive: false
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: 'center-pin-wrapper',
    html: `
      <div class="center-pin" style="width:24px; height:24px; background:#10b981; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 15px #10b981; display:flex; align-items:center; justify-content:center;">
        <div style="width:6px; height:6px; background:#0b1120; border-radius:50%; margin:auto;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  centerPinMarker = L.marker([lat, lng], { icon: pinIcon, interactive: false }).addTo(map);
  map.fitBounds(radiusCircleLayer.getBounds(), { padding: [30, 30] });
}

/* ==========================================
   HELFER: ERSTELLUNG DER NEUEN 3D-MARKER
   ========================================== */
function create3DPinIcon(content, styleClass) {
  return L.divIcon({
    className: 'custom-3d-pin',
    html: `
      <div class="pin-container">
        <div class="pin-badge ${styleClass}">
          ${content}
        </div>
        <div class="pin-pointer ${styleClass}"></div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42]
  });
}

function getSpotPinClass(type) {
  switch (type) {
    case "Freibad": return "pin-freibad";
    case "Hallenbad": return "pin-hallenbad";
    case "Frei- und Hallenbad": return "pin-frei-hallenbad";
    case "See": default: return "pin-see";
  }
}

// Spots ohne bekannte Sprunghöhe (z. B. automatisch aus offenen Kartendaten
// importierte Bäder ohne Community-Angabe) bekommen bewusst einen dezenten,
// grauen Pin statt eines falschen "0m" – ehrliche Lücke statt Falschangabe.
function hasUnknownHeight(spot) {
  return !spot.height || spot.height <= 0;
}

function hasWildcardFeature(spot) {
  if (!spot.facilities || !Array.isArray(spot.facilities)) return false;
  return spot.facilities.some(f => 
    f.includes("Bubble") || f.includes("Rope Swing") || f.includes("Trampolin") || f.includes("Trampdive")
  );
}

// HQ THRASHER FLAME W AS HIGH-RES VECTOR SVG
const THRASHER_W_SVG = `
  <svg class="hq-thrasher-w" viewBox="0 0 100 100" width="24" height="24" style="vertical-align: middle; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.8));">
    <defs>
      <linearGradient id="thrasherGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFEE00"/>
        <stop offset="45%" stop-color="#FF5500"/>
        <stop offset="90%" stop-color="#D30000"/>
      </linearGradient>
    </defs>
    <!-- Wildcard Flame-W Dynamic Vector -->
    <path fill="url(#thrasherGrad)" stroke="#000000" stroke-width="4" stroke-linejoin="bevel"
      d="M 10,22 Q 13,10 18,3 Q 22,17 26,24 Q 30,12 36,7 Q 40,20 44,38 L 47,38 Q 49,24 53,16 Q 58,28 60,38 L 63,38 Q 67,14 74,5 Q 77,20 80,30 Q 86,10 92,2 Q 88,25 84,45 L 70,95 L 53,95 L 47,56 L 43,56 L 31,95 L 14,95 L 2,42 Q 6,32 10,22 Z" />
  </svg>
`;

// Haupt-Filterfunktion mit neuen 3D Arcade Markern
function applyAllFilters() {
  const minHeight = parseFloat(document.getElementById("heightFilter").value) || 0;
  const type = document.getElementById("typeFilter").value;
  const verifiedOnly = document.getElementById("verifiedOnlyToggle").checked;
  const showAllPools = document.getElementById("showAllPoolsToggle")?.checked || false;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const maxRadiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;

  markersGroup.clearLayers();

  const bounds = map.getBounds();

  const filtered = allSpots.filter(spot => {
    if (isNaN(spot.lat) || isNaN(spot.lng) || spot.lat === 0 || spot.lng === 0) {
      return false;
    }

    // Bonus-Layer: NUR automatisch importierte OSM-Bäder ohne Sprung-Info
    // verstecken. Von Menschen eingereichte Community-Spots bleiben immer
    // sichtbar – auch wenn beim Eintragen keine Höhe angegeben wurde.
    if (hasUnknownHeight(spot) && spot.source === "osm" && !showAllPools) {
      return false;
    }

    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;

    // Sichtbar ist, was im Suchradius liegt ODER gerade im Kartenausschnitt
    // zu sehen ist. Dadurch bleibt das gesuchte Bad samt Radius bestehen,
    // während beim Weiterschieben trotzdem neue Spots auftauchen.
    let matchLocation = bounds.contains([spot.lat, spot.lng]);
    if (!matchLocation && currentSearchCenter) {
      const dist = getDistanceInKm(currentSearchCenter.lat, currentSearchCenter.lng, spot.lat, spot.lng);
      matchLocation = dist <= maxRadiusKm;
    }

    let matchQuery = true;
    if (query !== "" && query !== "mein standort") {
      matchQuery = spot.name.toLowerCase().includes(query) || 
                   (spot.city && spot.city.toLowerCase().includes(query)) ||
                   (spot.description && spot.description.toLowerCase().includes(query));
    }

    return matchHeight && matchType && matchVerified && matchLocation && matchQuery;
  });

  filtered.forEach(spot => {
    const isWildcard = hasWildcardFeature(spot);
    const isUnknown = !isWildcard && hasUnknownHeight(spot);

    // Icon Content & Style-Zuweisung
    let pinClass, pinContent;
    if (isWildcard) {
      pinClass = "pin-wildcard";
      pinContent = THRASHER_W_SVG;
    } else if (isUnknown) {
      pinClass = "pin-unknown";
      pinContent = "?";
    } else {
      pinClass = getSpotPinClass(spot.type);
      pinContent = `${spot.height}m`;
    }

    const customIcon = create3DPinIcon(pinContent, pinClass);
    const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openBottomSheet(spot);
    });

    markersGroup.addLayer(marker);
  });
}

function openAddModal() {
  document.getElementById("addSpotModal").classList.add("active");
  resetTurnstile("addSpotTurnstile");
}

function closeAddModal() {
  document.getElementById("addSpotModal").classList.remove("active");
  removeTempMarker();
  tempSelectedLatLng = null;
  pendingPickedLatLng = null;
  isPickingOnMap = false;
}

async function handleAddSpotSubmit(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]') || document.getElementById("submitSpotBtn");
  const originalBtnText = submitBtn ? submitBtn.textContent : "";

  const name = document.getElementById("newSpotName").value.trim();
  const city = document.getElementById("newSpotCity").value.trim();
  const streetEl = document.getElementById("newSpotStreet");
  const street = streetEl ? streetEl.value.trim() : "";
  const type = document.getElementById("newSpotType").value;
  const description = document.getElementById("newSpotDescription") ? document.getElementById("newSpotDescription").value.trim() : "";
  const websiteEl = document.getElementById("spotWebsite");
  const website = websiteEl ? websiteEl.value.trim() : "";

  const checkedBoxes = document.querySelectorAll(".height-cb:checked");
  
  if (checkedBoxes.length === 0) {
    alert("Bitte wähle mindestens ein Sprungelement / eine Höhe aus!");
    return;
  }

  const selectedLabels = [];
  let maxHeight = 0;

  checkedBoxes.forEach(cb => {
    const val = parseFloat(cb.value);
    selectedLabels.push(cb.dataset.label);
    if (val > maxHeight) maxHeight = val;
  });

  const cbBubble = document.getElementById("cbBubbleSystem");
  if (cbBubble && cbBubble.checked) selectedLabels.push("🫧 Bubble-Anlage");

  const cbRope = document.getElementById("cbRopeSwing");
  if (cbRope && cbRope.checked) selectedLabels.push("🧗 Rope Swing / Seilbahn");

  const cbTramp = document.getElementById("cbTrampdive");
  if (cbTramp && cbTramp.checked) selectedLabels.push("🤸 Trampolin / Trampdive");

  if (!name || !city) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "WIRD GESPEICHERT...";
  }

  try {
    let lat = null;
    let lng = null;

    if (tempSelectedLatLng) {
      lat = tempSelectedLatLng.lat;
      lng = tempSelectedLatLng.lng;
    } else {
      const fullAddress = street ? `${street}, ${city}, Germany` : `${city}, Germany`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
      const data = await res.json();

      if (data && data.length > 0) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
      } else {
        alert("Standort konnte nicht geocodiert werden. Bitte nutze die Kartenauswahl.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
        return;
      }
    }

    const newSpotData = {
      title: name,
      city: city,
      description: description,
      type: type,
      height: maxHeight,
      facilities: selectedLabels,
      website_url: website,
      jump_allowed: document.getElementById("spotJumpAllowed")?.value || "",
      water_depth: document.getElementById("spotWaterDepth")?.value || "",
      website_hp: document.getElementById("spotWebsiteHp")?.value || "", // Honeypot
      turnstileToken: getTurnstileToken("addSpotTurnstile"),
      latitude: lat,
      longitude: lng
    };

    if (!newSpotData.turnstileToken) {
      alert("Bitte warte einen Moment, bis die Sicherheitsprüfung geladen ist, und versuche es erneut.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
      return;
    }

    const res = await fetch("/api/submit-spot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSpotData)
    });
    const result = await res.json();

    if (!result.success) {
      console.error("Fehler beim Speichern:", result.error);
      alert(result.error || "Fehler beim Speichern des Spots!");
      resetTurnstile("addSpotTurnstile");
    } else {
      alert("Vielen Dank! Dein Spot wurde eingereicht und wird geprüft.");
      closeAddModal();
      document.getElementById("addSpotForm").reset();
      resetTurnstile("addSpotTurnstile");
      loadSpotsFromSupabase();
    }
  } catch (err) {
    console.error("Fehler beim Verarbeiten des Formulars:", err);
    alert("Es ist ein unerwarteter Fehler aufgetreten.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}

function openBottomSheet(spot) {
  activeSpotForReport = spot;

  const sheet = document.getElementById("bottomSheet");
  const badge = document.getElementById("verifiedBadge");
  const navBtn = document.getElementById("navBtn");
  const websiteBtn = document.getElementById("websiteBtn");
  const facilitiesContainer = document.getElementById("poolFacilities");
  const galleryContainer = document.getElementById("poolGallery");
  const descContainer = document.getElementById("poolDescription");
  const safetyNotice = document.getElementById("safetyNotice");

  const unknownHeight = hasUnknownHeight(spot);

  renderSpotFacts(spot);

  document.getElementById("poolTitle").textContent = spot.name;
  document.getElementById("poolType").textContent = unknownHeight
    ? `${spot.type} • Keine Angabe zu Sprunganlagen`
    : `${spot.type} • Max. ${spot.height}m Turm`;

  // Teilen-Button: nativer Share-Dialog auf Mobilgeräten, sonst Link kopieren
  const shareBtn = document.getElementById("shareSpotBtn");
  if (shareBtn) {
    shareBtn.onclick = () => shareSpot(spot);
  }

  // Report-Button: bei fehlender Höhenangabe leicht angepasster Text, aber
  // bewusst NICHT hervorgehoben/optimistisch formuliert – wir wissen nicht,
  // ob es hier überhaupt einen Sprungbereich gibt (siehe hint-Box unten).
  const reportBtn = document.getElementById("openReportBtn");
  if (reportBtn) {
    if (unknownHeight) {
      reportBtn.textContent = "✏️ Sprunganlagen-Info ergänzen";
    } else {
      reportBtn.textContent = "✏️ Änderung melden";
    }
    reportBtn.style.background = "transparent";
    reportBtn.style.borderColor = "rgba(255,255,255,0.3)";
    reportBtn.style.color = "#ccc";
    reportBtn.style.fontWeight = "normal";
  }

  // Sicherheitshinweis: bei fehlender Sprung-Info neutrale Herkunfts-Erklärung,
  // sonst wie gehabt dezent bei Bädern / deutlich als Alert bei See-Klippe
  if (safetyNotice) {
    if (unknownHeight) {
      safetyNotice.textContent = "ℹ️ Dieses Bad stammt aus offenen Kartendaten. Ob es hier überhaupt Sprungmöglichkeiten gibt, ist noch nicht bekannt.";
      safetyNotice.className = "safety-notice safety-notice-mild";
    } else if (spot.type === "See") {
      safetyNotice.textContent = "⚠️ ACHTUNG – Sprung auf eigene Gefahr: Springe niemals allein. Prüfe Wassertiefe, Untergrund und Strömung vor jedem Sprung persönlich vor Ort!";
      safetyNotice.className = "safety-notice safety-notice-alert";
    } else {
      safetyNotice.textContent = "ℹ️ Bitte springe nur an dafür vorgesehenen Stellen und beachte die Baderegeln sowie Anweisungen des Personals vor Ort.";
      safetyNotice.className = "safety-notice safety-notice-mild";
    }
    safetyNotice.style.display = "block";
  }

  if (descContainer) {
    if (spot.description) {
      descContainer.textContent = spot.description;
      descContainer.style.display = "block";
    } else {
      descContainer.style.display = "none";
    }
  }

  facilitiesContainer.innerHTML = "";
  if (spot.facilities && spot.facilities.length > 0) {
    spot.facilities.forEach(label => {
      const chip = document.createElement("span");
      chip.className = "facility-chip";
      
      if (label.includes("Bubble") || label.includes("Rope Swing") || label.includes("Trampolin") || label.includes("Trampdive")) {
        chip.style.borderColor = "#f59e0b";
        chip.style.color = "#f59e0b";
        chip.style.fontWeight = "bold";
      }

      chip.textContent = label;
      facilitiesContainer.appendChild(chip);
    });
  }

  if (galleryContainer) {
    galleryContainer.innerHTML = "";
    if (spot.images && spot.images.length > 0) {
      galleryContainer.style.display = "flex";
      let visibleImages = 0;

      spot.images.forEach(url => {
        if (!url || typeof url !== "string") return;

        const img = document.createElement("img");
        // Lazy + async: blockiert das Öffnen des Panels nicht mehr
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = `Foto von ${spot.name}`;
        img.style.cssText = "width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;background:rgba(255,255,255,0.05);flex:0 0 auto;";

        // Tote Bild-URLs (z. B. aus dem entfernten Storage-Bucket) sauber
        // ausblenden statt als kaputtes Platzhalter-Icon stehen zu lassen
        img.addEventListener("error", () => {
          img.remove();
          visibleImages--;
          if (visibleImages <= 0) galleryContainer.style.display = "none";
        });

        img.addEventListener("load", () => { visibleImages++; });

        img.src = url;
        img.onclick = () => window.open(url, "_blank", "noopener");
        galleryContainer.appendChild(img);
      });
    } else {
      galleryContainer.style.display = "none";
    }
  }

  if (spot.verified) {
    badge.textContent = "Verifiziert";
    badge.className = "badge verified";
  } else {
    badge.textContent = "Community-Eintrag";
    badge.className = "badge community";
  }

  navBtn.href = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;

  if (websiteBtn) {
    if (spot.websiteUrl) {
      websiteBtn.href = spot.websiteUrl;
      websiteBtn.style.display = "block";
    } else {
      websiteBtn.style.display = "none";
      websiteBtn.removeAttribute("href");
    }
  }

  sheet.classList.add("active");

  if (!history.state || !history.state.sheetOpen) {
    history.pushState({ sheetOpen: true }, "");
  }
}

function closeBottomSheet(shouldGoBackHistory = true) {
  const sheet = document.getElementById("bottomSheet");
  if (sheet) sheet.classList.remove("active");
  if (shouldGoBackHistory && history.state && history.state.sheetOpen) {
    history.back();
  }
}

// ==========================================
// INTELLIGENTE SUCHE
// ==========================================
// Reihenfolge bewusst so gewählt: Erst wird geprüft, ob der Eingabetext auf
// einen bereits erfassten Spot passt (Badname!). Nur wenn nichts passt, wird
// als Fallback die Ortssuche (Nominatim) bemüht. Vorher scheiterte die Suche
// nach einem Badnamen, weil Nominatim Badnamen meist nicht kennt.

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Findet passende Spots und sortiert sie nach Trefferqualität
function findMatchingSpots(rawQuery, limit = 6) {
  const q = normalizeText(rawQuery);
  if (q.length < 2) return [];

  const scored = [];
  for (const spot of allSpots) {
    if (isNaN(spot.lat) || isNaN(spot.lng)) continue;

    const name = normalizeText(spot.name);
    const city = normalizeText(spot.city);
    let score = 0;

    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (`${name} ${city}`.includes(q)) score = 40;
    else if (city.startsWith(q)) score = 20;

    // Spots mit bekannter Sprunghöhe leicht bevorzugen – das ist der Kern der App
    if (score > 0) {
      if (!hasUnknownHeight(spot)) score += 5;
      scored.push({ spot, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.spot.name.localeCompare(b.spot.name));
  return scored.slice(0, limit).map(s => s.spot);
}

// Springt zu einem konkreten Spot und öffnet dessen Detailansicht
function focusSpot(spot) {
  if (!spot) return;

  // Falls der Spot durch aktive Filter unsichtbar wäre, Filter passend lösen,
  // damit der Nutzer nicht auf eine leere Karte schaut.
  const showAll = document.getElementById("showAllPoolsToggle");
  if (hasUnknownHeight(spot) && showAll && !showAll.checked) {
    showAll.checked = true;
    showAll.dispatchEvent(new Event("change"));
  }

  const heightFilter = document.getElementById("heightFilter");
  if (heightFilter && parseFloat(heightFilter.value) > (spot.height || 0)) {
    heightFilter.value = "0";
    heightFilter.dispatchEvent(new Event("change"));
  }

  const typeFilter = document.getElementById("typeFilter");
  if (typeFilter && typeFilter.value !== "all" && typeFilter.value !== spot.type) {
    typeFilter.value = "all";
    typeFilter.dispatchEvent(new Event("change"));
  }

  // Gefundenes Bad wird als Suchmittelpunkt markiert und bleibt fixiert
  currentSearchCenter = { lat: spot.lat, lng: spot.lng };
  updateRadiusAndPin(spot.lat, spot.lng);
  map.setView([spot.lat, spot.lng], 14);
  applyAllFilters();
  setTimeout(() => openBottomSheet(spot), 350);
}

async function executeSearch() {
  const input = document.getElementById("searchInput");
  const query = input.value.trim();

  hideSuggestions();

  if (!query) {
    resetSearchCenterState();
    applyAllFilters();
    return;
  }

  // 1. Zuerst in den eigenen Spots suchen (Badnamen!)
  const matches = findMatchingSpots(query, 1);
  if (matches.length > 0) {
    focusSpot(matches[0]);
    return;
  }

  // 2. Fallback: Ortssuche über Nominatim
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.classList.add("is-loading");

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=de&limit=1&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      currentSearchCenter = { lat, lng };
      updateRadiusAndPin(lat, lng);
      applyAllFilters();
    } else {
      showSearchFeedback(`Für „${query}" wurde weder ein Bad noch ein Ort gefunden.`);
    }
  } catch (err) {
    console.error("Fehler bei Ortssuche:", err);
    showSearchFeedback("Suche gerade nicht erreichbar – bitte Verbindung prüfen.");
  } finally {
    if (searchBtn) searchBtn.classList.remove("is-loading");
  }
}

// Rückmeldung ohne störendes alert()
function showSearchFeedback(message) {
  const list = document.getElementById("searchSuggestions");
  if (!list) return;
  list.innerHTML = `<li class="suggestion-hint">${message}</li>`;
  list.hidden = false;
  setTimeout(() => hideSuggestions(), 3500);
}

function hideSuggestions() {
  const list = document.getElementById("searchSuggestions");
  const input = document.getElementById("searchInput");
  if (list) { list.hidden = true; list.innerHTML = ""; }
  if (input) input.setAttribute("aria-expanded", "false");
}

// Live-Vorschläge während des Tippens
function renderSuggestions() {
  const input = document.getElementById("searchInput");
  const list = document.getElementById("searchSuggestions");
  if (!input || !list) return;

  const query = input.value.trim();
  if (query.length < 2) { hideSuggestions(); return; }

  const matches = findMatchingSpots(query, 6);
  if (matches.length === 0) { hideSuggestions(); return; }

  list.innerHTML = "";
  matches.forEach(spot => {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.setAttribute("role", "option");

    const unknown = hasUnknownHeight(spot);
    const badge = unknown ? "?" : `${spot.height}m`;

    li.innerHTML = `
      <span class="suggestion-main">
        <span class="suggestion-name"></span>
        <span class="suggestion-meta"></span>
      </span>
      <span class="suggestion-height ${unknown ? "is-unknown" : ""}">${badge}</span>
    `;
    // Nutzerdaten bewusst als Text setzen (kein HTML aus der Datenbank ausführen)
    li.querySelector(".suggestion-name").textContent = spot.name;
    li.querySelector(".suggestion-meta").textContent =
      [spot.city, spot.type].filter(Boolean).join(" · ");

    li.addEventListener("click", () => {
      input.value = spot.name;
      hideSuggestions();
      focusSpot(spot);
    });

    list.appendChild(li);
  });

  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function openReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.classList.add("active");
  resetTurnstile("reportTurnstile");
}

function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.classList.remove("active");
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const reason = document.getElementById("reportReason").value;
  const details = document.getElementById("reportDescription").value.trim();

  if (!activeSpotForReport) return;

  const turnstileToken = getTurnstileToken("reportTurnstile");
  if (!turnstileToken) {
    alert("Bitte warte einen Moment, bis die Sicherheitsprüfung geladen ist, und versuche es erneut.");
    return;
  }

  try {
    const res = await fetch("/api/submit-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spot_id: activeSpotForReport.id,
        reason: reason,
        details: details,
        website_hp: document.getElementById("reportWebsiteHp")?.value || "", // Honeypot
        turnstileToken: turnstileToken
      })
    });
    const result = await res.json();

    if (!result.success) {
      console.error("Fehler beim Senden des Reports:", result.error);
      alert(result.error || "Fehler beim Senden der Meldung.");
      resetTurnstile("reportTurnstile");
    } else {
      alert("Vielen Dank für deine Meldung! Wir prüfen das Problem.");
      closeReportModal();
      document.getElementById("reportSpotForm").reset();
      resetTurnstile("reportTurnstile");
    }
  } catch (err) {
    console.error("Netzwerkfehler beim Report:", err);
    alert("Netzwerkfehler – bitte versuche es erneut.");
  }
}

// ==========================================
// Cloudflare Turnstile Hilfsfunktionen
// ==========================================
function getTurnstileToken(widgetContainerId) {
  const container = document.getElementById(widgetContainerId);
  if (!container) return null;
  const input = container.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
  return input ? input.value : null;
}

function resetTurnstile(widgetContainerId) {
  if (window.turnstile && typeof window.turnstile.reset === "function") {
    const container = document.getElementById(widgetContainerId);
    if (container) {
      try {
        window.turnstile.reset(container);
      } catch (e) {
        // Widget evtl. noch nicht gerendert – ignorieren
      }
    }
  }
}
