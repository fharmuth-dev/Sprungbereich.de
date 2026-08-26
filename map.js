let map;
let markersGroup;
let countryBorderLayer = null;
let radiusCircleLayer = null;
let centerPinMarker = null;
let currentSearchCenter = null;

// Die Liste startet JETZT KOMPLETT LEER
let allSpots = [];

document.addEventListener("DOMContentLoaded", () => {
  // Loading Screen ausblenden
  setTimeout(() => {
    const loader = document.getElementById("loadingScreen");
    if (loader) loader.classList.add("fade-out");
  }, 3500);

  // Map initialisieren
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Deutschland-Grenze rendern
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

  // UX FIX 1: Schließen-Button (X) Event
  document.getElementById("closeSheetBtn").addEventListener("click", () => closeBottomSheet(true));

  // UX FIX 2: Klick auf die Karte schließt das Detail-Panel
  map.on("click", () => {
    closeBottomSheet(true);
  });

  // UX FIX 3: Handy-Zurück-Taste abfangen
  window.addEventListener("popstate", () => {
    const sheet = document.getElementById("bottomSheet");
    if (sheet.classList.contains("active")) {
      closeBottomSheet(false);
    }
  });

  // Initial Suche
  executeSearch();
});

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

// Hilfsfunktion: Gibt jedem Spot seine exakte Farbe
function getSpotColor(type) {
  switch (type) {
    case "Freibad":
      return "#ffd166"; // Gelb
    case "Hallenbad":
      return "#a855f7"; // Lila
    case "See":
    default:
      return "#00f2fe"; // Blau
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
    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;

    let matchQuery = true;
    if (!currentSearchCenter && query !== "") {
      matchQuery = spot.name.toLowerCase().includes(query) || 
                   spot.city.toLowerCase().includes(query) || 
                   (spot.zip && spot.zip.includes(query));
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
      radius: 9,
      fillColor: spotColor,
      color: "#ffffff",
      weight: 2,
      fillOpacity: 0.95,
      interactive: true
    });

    marker.on("add", () => {
      if (marker._path) {
        marker._path.style.cursor = "pointer";
      }
    });

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openBottomSheet(spot);
    });

    markersGroup.addLayer(marker);
  });
}

function openBottomSheet(spot) {
  const sheet = document.getElementById("bottomSheet");
  const badge = document.getElementById("verifiedBadge");
  const navBtn = document.getElementById("navBtn");

  document.getElementById("poolTitle").textContent = spot.name;
  document.getElementById("poolType").textContent = `${spot.type} • Max. ${spot.height}m Turm`;
  
  if (spot.verified) {
    badge.textContent = "✅ Offiziell Verifiziert";
    badge.className = "badge verified";
  } else {
    badge.textContent = "🟡 Community-Eintrag (Ungeprüft)";
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
