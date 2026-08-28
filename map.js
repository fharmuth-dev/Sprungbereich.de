// === SUPABASE ZUGANGSDATEN ===
const SUPABASE_URL = "https://bmngqythtalsddqtfuib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TPwfBJvsktOEDPZmQAcG0w_AnYnaQeW";

// Supabase Client initialisieren
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map;
let markersGroup;
let countryBorderLayer = null;
let radiusCircleLayer = null;
let centerPinMarker = null;
let currentSearchCenter = null;

let tempMarker = null;          // Temporärer Marker für die Standort-Bestätigung
let tempSelectedLatLng = null; // Speichert finale Koordinaten für das Formular
let pendingPickedLatLng = null; // Speichert Zwischen-Koordinaten vor der Ja/Nein Bestätigung
let isPickingOnMap = false;    // Status: Nutzer wählt gerade auf der Karte aus
let selectedImageFiles = [];   // Speichert die bis zu 3 ausgewählten Bild-Dateien

let allSpots = [];

document.addEventListener("DOMContentLoaded", () => {
  // Loading Screen nach Animation ausblenden
  setTimeout(() => {
    const loader = document.getElementById("loadingScreen");
    if (loader) loader.classList.add("fade-out");
  }, 3500);

  renderGraffitiTitle("Deine Location dabei?");

  // Karte initialisieren
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  // Esri Dark Map Tiles (Stabil, kostenlos, ohne Key)
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  }).addTo(map);

  // Deutsche Beschriftungen / Labels
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    interactive: false
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  drawGermanyOutline();

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
  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });

  document.getElementById("closeSheetBtn").addEventListener("click", () => closeBottomSheet(true));
  
  // Modal Öffnen / Schließen Events
  document.getElementById("openAddModalBtn").addEventListener("click", () => {
    removeTempMarker();
    tempSelectedLatLng = null;
    resetImageSelection();
    const statusText = document.getElementById("locationStatusText");
    if (statusText) statusText.textContent = "";
    openAddModal();
  });
  
  document.getElementById("closeAddModalBtn").addEventListener("click", closeAddModal);
  document.getElementById("addSpotForm").addEventListener("submit", handleAddSpotSubmit);

  // Event für Bild-Upload Auswahl (Max. 3 Bilder)
  const imageInput = document.getElementById("spotImages");
  if (imageInput) {
    imageInput.addEventListener("change", handleImageSelect);
  }

  // Button "Auf Karte markieren" im Modal
  const pickBtn = document.getElementById("pickOnMapBtn");
  if (pickBtn) {
    pickBtn.addEventListener("click", () => {
      isPickingOnMap = true;
      document.getElementById("addSpotModal").classList.remove("active");
    });
  }

  // Klick-Logik auf der Karte
  map.on("click", (e) => {
    const sheet = document.getElementById("bottomSheet");
    if (sheet && sheet.classList.contains("active")) {
      closeBottomSheet(true);
      return;
    }

    // 1. Wenn Nutzer aus dem Modal heraus "Auf Karte markieren" gewählt hat
    if (isPickingOnMap) {
      pendingPickedLatLng = e.latlng;
      removeTempMarker();
      
      tempMarker = L.marker(e.latlng).addTo(map);

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

            // Adresse via Reverse Geocoding abfragen
            await fetchAddressFromLatLng(tempSelectedLatLng.lat, tempSelectedLatLng.lng);

            // Modal wieder öffnen
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

    // 2. Standard-Klick auf der Karte mit Bestätigung (außerhalb des Modals)
    placeTempMarker(e.latlng);
  });

  window.addEventListener("popstate", () => {
    const sheet = document.getElementById("bottomSheet");
    if (sheet && sheet.classList.contains("active")) {
      closeBottomSheet(false);
    }
    closeAddModal();
  });

  // Spots aus Supabase laden
  loadSpotsFromSupabase();
});

// Reverse Geocoding: Adresse aus Lat/Lng über Nominatim laden
async function fetchAddressFromLatLng(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();

    if (data && data.address) {
      const addr = data.address;
      
      // Stadt / Ort ermitteln
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      // Straße & Hausnummer ermitteln
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

// Temporären Pin auf der Karte setzen
function placeTempMarker(latlng) {
  removeTempMarker();

  tempSelectedLatLng = latlng;
  tempMarker = L.marker(latlng, { draggable: true }).addTo(map);

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
        // Adresse via Reverse Geocoding vorbefüllen
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

// Handler für die Bildauswahl (Maximal 3 Bilder)
function handleImageSelect(e) {
  const files = Array.from(e.target.files);

  if (files.length > 3) {
    alert("Du kannst maximal 3 Bilder hochladen!");
    e.target.value = "";
    resetImageSelection();
    return;
  }

  selectedImageFiles = files;
  renderImagePreviews();
}

function renderImagePreviews() {
  const container = document.getElementById("imagePreviewContainer");
  if (!container) return;
  container.innerHTML = "";

  selectedImageFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgWrap = document.createElement("div");
      imgWrap.style.position = "relative";
      imgWrap.style.width = "60px";
      imgWrap.style.height = "60px";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      img.style.border = "1px solid #00f2fe";

      imgWrap.appendChild(img);
      container.appendChild(imgWrap);
    };
    reader.readAsDataURL(file);
  });
}

function resetImageSelection() {
  selectedImageFiles = [];
  const container = document.getElementById("imagePreviewContainer");
  if (container) container.innerHTML = "";
  const input = document.getElementById("spotImages");
  if (input) input.value = "";
}

// Bilder in Supabase Storage hochladen
async function uploadSpotImages() {
  const uploadedUrls = [];

  for (const file of selectedImageFiles) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabaseClient.storage
      .from('spot-images')
      .upload(filePath, file);

    if (error) {
      console.error("Upload-Fehler bei Bild:", error);
      continue;
    }

    // Public URL des hochgeladenen Bildes holen
    const { data: publicUrlData } = supabaseClient.storage
      .from('spot-images')
      .getPublicUrl(filePath);

    if (publicUrlData && publicUrlData.publicUrl) {
      uploadedUrls.push(publicUrlData.publicUrl);
    }
  }

  return uploadedUrls;
}

// Spots aus Supabase laden (Angepasst für korrekte Typen & Sichtbarkeit)
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
      city: spot.description || "",
      type: spot.type || "Freibad",
      height: Number(spot.height) || 0,
      facilities: spot.facilities || [],
      images: spot.images || [],
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

function drawGermanyOutline() {
  fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&country=Germany&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (data && data[0] && data[0].geojson) {
        countryBorderLayer = L.geoJSON(data[0].geojson, {
          style: {
            color: "#00f2fe",
            weight: 2,
            opacity: 0.6,
            fillColor: "#00f2fe",
            fillOpacity: 0.03
          },
          interactive: false
        }).addTo(map);
      }
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

function getSpotColor(type) {
  switch (type) {
    case "Freibad": return "#ffd166";
    case "Hallenbad": return "#a855f7";
    case "Frei- und Hallenbad": return "#ec4899";
    case "See": default: return "#00f2fe";
  }
}

function applyAllFilters() {
  const minHeight = parseFloat(document.getElementById("heightFilter").value) || 0;
  const type = document.getElementById("typeFilter").value;
  const verifiedOnly = document.getElementById("verifiedOnlyToggle").checked;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const maxRadiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;

  markersGroup.clearLayers();

  const filtered = allSpots.filter(spot => {
    // Falls Koordinaten ungültig sind, ausfiltern
    if (isNaN(spot.lat) || isNaN(spot.lng) || spot.lat === 0 || spot.lng === 0) {
      return false;
    }

    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;

    let matchQuery = true;
    if (!currentSearchCenter && query !== "") {
      matchQuery = spot.name.toLowerCase().includes(query) || 
                   spot.city.toLowerCase().includes(query);
    }

    let matchRadius = true;
    if (currentSearchCenter) {
      matchRadius = getDistanceInKm(currentSearchCenter.lat, currentSearchCenter.lng, spot.lat, spot.lng) <= maxRadiusKm;
    }

    return matchHeight && matchType && matchVerified && matchQuery && matchRadius;
  });

  filtered.forEach(spot => {
    const spotColor = getSpotColor(spot.type);

    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 10,
      fillColor: spotColor,
      color: "#ffffff",
      weight: 2,
      fillOpacity: 0.95,
      interactive: true
    });

    marker.on("add", () => {
      if (marker._path) marker._path.style.cursor = "pointer";
    });

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
  resetImageSelection();
}

/* Formular absenden & Verknüpfung mit genauer Adresse / Koordinaten / Upload */
async function handleAddSpotSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("newSpotName").value.trim();
  const city = document.getElementById("newSpotCity").value.trim();
  const streetEl = document.getElementById("newSpotStreet");
  const street = streetEl ? streetEl.value.trim() : "";
  const type = document.getElementById("newSpotType").value;

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

  if (!name || !city) return;

  let lat = null;
  let lng = null;

  // 1. Wenn Koordinaten direkt durch Klick auf der Karte gesetzt wurden
  if (tempSelectedLatLng) {
    lat = tempSelectedLatLng.lat;
    lng = tempSelectedLatLng.lng;
  } else {
    // 2. Ansonsten: Adresse/Ort über Geocoding exakt bestimmen
    const fullAddress = street ? `${street}, ${city}, Germany` : `${city}, Germany`;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
      const results = await res.json();
      
      if (results && results.length > 0) {
        lat = parseFloat(results[0].lat);
        lng = parseFloat(results[0].lon);
      } else {
        alert("Die eingegebene Adresse/Ort konnte nicht gefunden werden. Bitte nutze 'Auf Karte markieren'.");
        return;
      }
    } catch (err) {
      console.error("Geocoding Fehler:", err);
      alert("Fehler bei der Adresssuche. Bitte versuche es erneut.");
      return;
    }
  }

  const addressText = street ? `${street}, ${city}` : city;

  // Bilder hochladen, falls welche ausgewählt wurden
  let imageUrls = [];
  if (selectedImageFiles.length > 0) {
    imageUrls = await uploadSpotImages();
  }

  // In Supabase Tabelle 'Spots' eintragen
  const { error } = await supabaseClient
    .from('Spots')
    .insert([
      {
        title: name,
        description: addressText,
        type: type,
        height: maxHeight,
        facilities: selectedLabels,
        images: imageUrls,
        latitude: lat,
        longitude: lng,
        status: 'approved'
      }
    ]);

  if (error) {
    console.error("Fehler beim Speichern in Supabase:", error);
    alert("Fehler beim Speichern: " + error.message);
    return;
  }

  removeTempMarker();
  await loadSpotsFromSupabase();

  closeAddModal();
  document.getElementById("addSpotForm").reset();
  resetImageSelection();
  const statusText = document.getElementById("locationStatusText");
  if (statusText) statusText.textContent = "";

  // Karte sofort auf den eingetragenen Spot zentrieren
  map.setView([lat, lng], 15);
}

function openBottomSheet(spot) {
  const sheet = document.getElementById("bottomSheet");
  const badge = document.getElementById("verifiedBadge");
  const navBtn = document.getElementById("navBtn");
  const facilitiesContainer = document.getElementById("poolFacilities");
  const galleryContainer = document.getElementById("poolGallery");

  document.getElementById("poolTitle").textContent = spot.name;
  document.getElementById("poolType").textContent = `${spot.type} • Max. ${spot.height}m Turm`;
  
  facilitiesContainer.innerHTML = "";
  if (spot.facilities && spot.facilities.length > 0) {
    spot.facilities.forEach(label => {
      const chip = document.createElement("span");
      chip.className = "facility-chip";
      chip.textContent = label;
      facilitiesContainer.appendChild(chip);
    });
  }

  // Galerie-Bilder rendern
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

  navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  sheet.classList.add("active");

  if (!history.state || !history.state.sheetOpen) {
    history.pushState({ sheetOpen: true }, "");
  }
}

function closeBottomSheet(triggerPopstate = true) {
  const sheet = document.getElementById("bottomSheet");
  if (sheet.classList.contains("active")) {
    sheet.classList.remove("active");
    if (triggerPopstate && history.state && history.state.sheetOpen) {
      history.back();
    }
  }
}

function executeSearch() {
  const query = document.getElementById("searchInput").value.trim();

  if (query === "") {
    currentSearchCenter = null;
    if (radiusCircleLayer) map.removeLayer(radiusCircleLayer);
    if (centerPinMarker) map.removeLayer(centerPinMarker);
    applyAllFilters();
    return;
  }

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=de`)
    .then(res => res.json())
    .then(results => {
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        currentSearchCenter = { lat, lng: lon };
        updateRadiusAndPin(lat, lon);
        applyAllFilters();
      }
    });
}
