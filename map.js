let map;
let markersGroup;
let radiusCircleLayer = null;
let currentSearchCenter = null;
let allSpots = [];

// Lokale Datenbank (Freibäder & Spots in und um Ulm / Deutschland)
const localDatabase = [
  { id: 1, name: "Olympia-Schwimmhalle München", city: "München", zip: "80809", type: "Hallenbad", height: 10, verified: true, lat: 48.1732, lng: 11.5536 },
  { id: 2, name: "Stadionbad Nürnberg", city: "Nürnberg", zip: "90471", type: "Freibad", height: 10, verified: true, lat: 49.4322, lng: 11.1194 },
  { id: 3, name: "Inselbad Untertürkheim", city: "Stuttgart", zip: "70327", type: "Freibad", height: 10, verified: true, lat: 48.7780, lng: 9.2520 },
  { id: 4, name: "SSV Ulm 1846 Freibad", city: "Ulm", zip: "89073", type: "Freibad", height: 5, verified: true, lat: 48.4011, lng: 9.9876 },
  { id: 5, name: "Freibad Neu-Ulm", city: "Neu-Ulm", zip: "89231", type: "Freibad", height: 10, verified: true, lat: 48.3870, lng: 10.0050 },
  { id: 6, name: "Waldbad Günzburg", city: "Günzburg", zip: "89312", type: "Freibad", height: 5, verified: true, lat: 48.4520, lng: 10.2740 },
  { id: 7, name: "Strandbad Wannsee Berlin", city: "Berlin", zip: "14129", type: "See", height: 5, verified: false, lat: 52.4384, lng: 13.1785 },
  { id: 8, name: "Freibad Prinzenstraße", city: "Berlin", zip: "10969", type: "Freibad", height: 10, verified: true, lat: 52.4965, lng: 13.4116 },
  { id: 9, name: "Stadionbad Köln", city: "Köln", zip: "50933", type: "Freibad", height: 10, verified: true, lat: 50.9333, lng: 6.8744 }
];

document.addEventListener("DOMContentLoaded", () => {
  // Leaflet Karte auf Deutschland zentriert initialisieren
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  allSpots = localDatabase;
  applyAllFilters();

  // Event Listener für Filteränderungen
  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);
  
  // Radius-Änderung verarbeiten
  document.getElementById("radiusFilter").addEventListener("change", () => {
    if (currentSearchCenter) {
      updateRadiusCircle(currentSearchCenter.lat, currentSearchCenter.lng);
    }
    applyAllFilters();
  });

  document.getElementById("searchBtn").addEventListener("click", executeSearch);
  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") executeSearch();
  });
});

// Haversine-Formel zur Distanzberechnung in Kilometern
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Zeichnet den neon-grünen Kreis auf die Karte
function updateRadiusCircle(lat, lng) {
  const radiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;
  const radiusMeters = radiusKm * 1000;

  if (radiusCircleLayer) {
    map.removeLayer(radiusCircleLayer);
  }

  radiusCircleLayer = L.circle([lat, lng], {
    radius: radiusMeters,
    color: "#10b981",
    weight: 2.5,
    opacity: 0.95,
    fillColor: "#10b981",
    fillOpacity: 0.08,
    dashArray: "6, 6"
  }).addTo(map);

  map.fitBounds(radiusCircleLayer.getBounds(), { padding: [30, 30] });
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
      const dist = getDistanceInKm(currentSearchCenter.lat, currentSearchCenter.lng, spot.lat, spot.lng);
      matchRadius = dist <= maxRadiusKm;
    }

    return matchHeight && matchType && matchVerified && matchQuery && matchRadius;
  });

  filtered.forEach(spot => {
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 9,
      fillColor: spot.verified ? "#00f2fe" : "#ffb703",
      color: "#ffffff",
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.95
    });

    marker.on("click", () => {
      showBottomSheet(spot.name, `${spot.type} • ${spot.height}m Turm`, spot.verified, spot.lat, spot.lng);
    });

    markersGroup.addLayer(marker);
  });

  return filtered;
}

function executeSearch() {
  const query = document.getElementById("searchInput").value.trim();

  if (query === "") {
    currentSearchCenter = null;
    if (radiusCircleLayer) map.removeLayer(radiusCircleLayer);
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
        updateRadiusCircle(lat, lon);
        applyAllFilters();
      } else {
        alert("Kein Ort in Deutschland gefunden.");
      }
    })
    .catch(() => alert("Fehler bei der Suche."));
}

function showBottomSheet(name, typeInfo, isVerified, lat, lng) {
  const sheet = document.getElementById("bottomSheet");
  document.getElementById("poolTitle").textContent = name;
  document.getElementById("poolType").textContent = typeInfo;
  
  const badge = document.getElementById("verifiedBadge");
  badge.textContent = isVerified ? "Verifiziert" : "Unbestätigt";
  badge.style.background = isVerified ? "rgba(0,242,254,0.15)" : "rgba(255,255,255,0.05)";
  badge.style.color = isVerified ? "#00f2fe" : "#94a3b8";

  document.getElementById("navBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  sheet.classList.add("active");
}
