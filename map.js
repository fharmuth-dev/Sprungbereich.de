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

  // Geografische Begrenzung für Deutschland
  const germanyBounds = L.latLngBounds(
    L.latLng(47.2701, 5.8663),  // Südwest-Koordinate
    L.latLng(55.0581, 15.0419)  // Nordost-Koordinate
  );

  // Karte initialisieren mit Begrenzung auf Deutschland
  map = L.map("map", { 
    zoomControl: false,
    minZoom: 6,
    maxZoom: 16,
    maxBounds: germanyBounds,
    maxBoundsViscosity: 1.0
  }).setView([51.1657, 10.4515], 6);

  // Esri Dark Map Tiles
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ'
  }).addTo(map);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    interactive: false
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // === ERKENNUNG FÜR FREIES MAP-SCROLLEN ===
  map.on("dragstart", () => {
    resetSearchCenterState();
  });

  map.on("moveend zoomend", () => {
    applyAllFilters();
  });

  // Event Listener für Filter
  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);
  
  document.getElementById("radiusFilter").addEventListener("change", () => {
    if (currentSearchCenter) {
      updateRadiusAndPin(currentSearchCenter.lat, currentSearchCenter.lng);
    }
    applyAllFilters();
  });

  document.getElementById("searchBtn").addEventListener("click", executeSearch);
  
  const locateBtn = document.getElementById("locateBtn");
  if (locateBtn) {
    locateBtn.addEventListener("click", getUserLocation);
  }

  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });

  document.getElementById("closeSheetBtn").addEventListener("click", () => closeBottomSheet(true));
  
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
    const { data, error } = await supabaseClient
      .from('Spots')
      .select('*');

    if (error) {
      console.error("Fehler beim Laden aus Supabase:", error);
      return;
    }

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
      verified: spot.status === 'approved',
      status: spot.status,
      lat: Number(spot.latitude),
      lng: Number(spot.longitude)
    }));

    applyAllFilters();
  } catch (err) {
    console.error("Netzwerkfehler:", err);
  }
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
    
    const size = fontSizes[index % fontSizes.length];
    span.style.fontSize = `${size}px`;
    
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
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const maxRadiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;

  markersGroup.clearLayers();

  const bounds = map.getBounds();

  const filtered = allSpots.filter(spot => {
    if (isNaN(spot.lat) || isNaN(spot.lng) || spot.lat === 0 || spot.lng === 0) {
      return false;
    }

    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;

    let matchLocation = true;
    if (currentSearchCenter) {
      const dist = getDistanceInKm(currentSearchCenter.lat, currentSearchCenter.lng, spot.lat, spot.lng);
      matchLocation = dist <= maxRadiusKm;
    } else {
      matchLocation = bounds.contains([spot.lat, spot.lng]);
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
    
    // Icon Content & Style-Zuweisung
    const pinClass = isWildcard ? "pin-wildcard" : getSpotPinClass(spot.type);
    const pinContent = isWildcard ? THRASHER_W_SVG : `${spot.height}m`;

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
      status: 'pending',
      latitude: lat,
      longitude: lng
    };

    const { data, error } = await supabaseClient
      .from('Spots')
      .insert([newSpotData]);

    if (error) {
      console.error("Fehler beim Speichern in Supabase:", error);
      alert("Fehler beim Speichern des Spots!");
    } else {
      alert("Vielen Dank! Dein Spot wurde eingereicht und wird geprüft.");
      closeAddModal();
      document.getElementById("addSpotForm").reset();
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

  document.getElementById("poolTitle").textContent = spot.name;
  document.getElementById("poolType").textContent = `${spot.type} • Max. ${spot.height}m Turm`;

  // Sicherheitshinweis: dezent bei Bädern, deutlich als Alert bei See/Klippe
  if (safetyNotice) {
    if (spot.type === "See") {
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
      spot.images.forEach(url => {
        const img = document.createElement("img");
        img.src = url;
        img.style.width = "90px";
        img.style.height = "90px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.border = "1px solid rgba(255,255,255,0.2)";
        img.style.cursor = "pointer";
        img.onclick = () => window.open(url, '_blank');
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

async function executeSearch() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) {
    resetSearchCenterState();
    applyAllFilters();
    return;
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      currentSearchCenter = { lat, lng };
      updateRadiusAndPin(lat, lng);
      applyAllFilters();
    } else {
      alert("Ort nicht gefunden. Bitte Suchbegriff anpassen.");
    }
  } catch (err) {
    console.error("Fehler bei Ortssuche:", err);
  }
}

function openReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.classList.add("active");
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

  try {
    const { error } = await supabaseClient
      .from('spot_reports')
      .insert([{
        spot_id: activeSpotForReport.id,
        reason: reason,
        details: details
      }]);

    if (error) {
      console.error("Fehler beim Senden des Reports:", error);
      alert("Fehler beim Senden der Meldung.");
    } else {
      alert("Vielen Dank für deine Meldung! Wir prüfen das Problem.");
      closeReportModal();
      document.getElementById("reportSpotForm").reset();
    }
  } catch (err) {
    console.error("Netzwerkfehler beim Report:", err);
  }
}
