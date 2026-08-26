let map;
let markersGroup;
let countryBorderLayer = null;
let radiusCircleLayer = null; // Layer für den neon-grünen Radius-Kreis
let currentSearchCenter = null; // Speichert den aktuellen Suchmittelpunkt (Lat/Lng)
let allSpots = [];

// Supabase Konfiguration (Optional)
const SUPABASE_URL = "DEINE_SUPABASE_URL";
const SUPABASE_KEY = "DEIN_SUPABASE_ANON_KEY";
let supabaseClient = null;

if (typeof supabase !== "undefined" && SUPABASE_URL !== "DEINE_SUPABASE_URL") {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

const localDatabase = [
  { id: 1, name: "Olympia-Schwimmhalle München", country: "de", city: "München", zip: "80809", type: "Hallenbad", height: 10, verified: true, lat: 48.1732, lng: 11.5536 },
  { id: 2, name: "Stadionbad Nürnberg", country: "de", city: "Nürnberg", zip: "90471", type: "Freibad", height: 10, verified: true, lat: 49.4322, lng: 11.1194 },
  { id: 3, name: "Inselbad Untertürkheim Stuttgart", country: "de", city: "Stuttgart", zip: "70327", type: "Freibad", height: 10, verified: true, lat: 48.7780, lng: 9.2520 },
  { id: 4, name: "SSV Ulm 1846 Freibad", country: "de", city: "Ulm", zip: "89073", type: "Freibad", height: 5, verified: true, lat: 48.4011, lng: 9.9876 },
  { id: 5, name: "Freibad Neu-Ulm", country: "de", city: "Neu-Ulm", zip: "89231", type: "Freibad", height: 10, verified: true, lat: 48.3870, lng: 10.0050 },
  { id: 6, name: "Waldbad Günzburg", country: "de", city: "Günzburg", zip: "89312", type: "Freibad", height: 5, verified: true, lat: 48.4520, lng: 10.2740 },
  { id: 7, name: "Strandbad Wannsee Berlin", country: "de", city: "Berlin", zip: "14129", type: "See", height: 5, verified: false, lat: 52.4384, lng: 13.1785 },
  { id: 8, name: "Freibad Prinzenstraße Berlin", country: "de", city: "Berlin", zip: "10969", type: "Freibad", height: 10, verified: true, lat: 52.4965, lng: 13.4116 },
  { id: 9, name: "Stadionbad Köln", country: "de", city: "Köln", zip: "50933", type: "Freibad", height: 10, verified: true, lat: 50.9333, lng: 6.8744 }
];

window.germanStates = {
  "Baden-Württemberg": { lat: 48.6616, lng: 9.3501, zoom: 8 },
  "Bayern": { lat: 48.7904, lng: 11.4976, zoom: 7.5 },
  "Berlin": { lat: 52.5200, lng: 13.4050, zoom: 10 },
  "Brandenburg": { lat: 52.4125, lng: 12.5316, zoom: 8 },
  "Bremen": { lat: 53.0793, lng: 8.8017, zoom: 10 },
  "Hamburg": { lat: 53.5511, lng: 9.9937, zoom: 10 },
  "Hessen": { lat: 50.6521, lng: 9.1624, zoom: 8 },
  "Mecklenburg-Vorpommern": { lat: 53.6127, lng: 12.4296, zoom: 8 },
  "Niedersachsen": { lat: 52.6367, lng: 9.8451, zoom: 7.5 },
  "Nordrhein-Westfalen": { lat: 51.4332, lng: 7.6616, zoom: 8 },
  "Rheinland-Pfalz": { lat: 49.6358, lng: 7.5023, zoom: 8 },
  "Saarland": { lat: 49.3964, lng: 7.0230, zoom: 9 },
  "Sachsen": { lat: 51.1045, lng: 13.2017, zoom: 8 },
  "Sachsen-Anhalt": { lat: 51.9503, lng: 11.6923, zoom: 8 },
  "Schleswig-Holstein": { lat: 54.2194, lng: 9.6961, zoom: 8 },
  "Thüringen": { lat: 50.8318, lng: 11.0510, zoom: 8 }
};

document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  loadSpotsData();
  drawGermanyOutline();

  // Event Listener für Filteränderungen
  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);
  
  // Bei Ändern des Radius direkt neu filtern & Kreis anpassen
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

async function loadSpotsData() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from("spots").select("*");
      allSpots = (!error && data && data.length > 0) ? data : localDatabase;
    } catch {
      allSpots = localDatabase;
    }
  } else {
    allSpots = localDatabase;
  }
  applyAllFilters();
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
            opacity: 0.5,
            fillColor: "#00f2fe",
            fillOpacity: 0.02
          }
        }).addTo(map);
      }
    });
}

// Haversine-Formel zur präzisen Distanzberechnung in Kilometern
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

// Zeichnet den stylischen Neon-Grünen Radius-Kreis auf die Map
function updateRadiusCircle(lat, lng) {
  const radiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;
  const radiusMeters = radiusKm * 1000;

  if (radiusCircleLayer) {
    map.removeLayer(radiusCircleLayer);
  }

  radiusCircleLayer = L.circle([lat, lng], {
    radius: radiusMeters,
    color: "#10b981",       // Emerald-Grün
    weight: 2.5,
    opacity: 0.95,
    fillColor: "#10b981",
    fillOpacity: 0.08,
    dashArray: "6, 6"        // Stylische gestrichelte Neon-Linie
  }).addTo(map);

  // Zoom-Stufe automatisch so anpassen, dass der gesamte Radius-Kreis gut sichtbar ist
  map.fitBounds(radiusCircleLayer.getBounds(), { padding: [30, 30] });
}

window.highlightStateByName = function(stateName) {
  const conf = window.germanStates[stateName];
  if (conf) {
    map.setView([conf.lat, conf.lng], conf.zoom);
  }
};

function applyAllFilters() {
  const minHeight = parseFloat(document.getElementById("heightFilter").value) || 0;
  const type = document.getElementById("typeFilter").value;
  const verifiedOnly = document.getElementById("verifiedOnlyToggle").checked;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const maxRadiusKm = parseFloat(document.getElementById("radiusFilter").value) || 25;

  markersGroup.clearLayers();

  const filtered = allSpots.filter(spot => {
    // 1. Höhen-Filter
    const matchHeight = (spot.height || 0) >= minHeight;
    // 2. Typ-Filter
    const matchType = type === "all" || spot.type === type;
    // 3. Verifiziert-Filter
    const matchVerified = !verifiedOnly || spot.verified === true;

    // 4. Text-Filter (wenn kein Radius-Zentrum aktiv ist)
    let matchQuery = true;
    if (!currentSearchCenter && query !== "") {
      matchQuery = spot.name.toLowerCase().includes(query) || 
                 spot.city.toLowerCase().includes(query) || 
                 (spot.zip && spot.zip.includes(query));
    }

    // 5. Radius-Filter (falls eine Ortssuche stattgefunden hat)
    let matchRadius = true;
    if (currentSearchCenter) {
      const dist = getDistanceInKm(currentSearchCenter.lat, currentSearchCenter.lng, spot.lat, spot.lng);
      matchRadius = dist <= maxRadiusKm;
    }

    return matchHeight && matchType && matchVerified && matchQuery && matchRadius;
  });

  // Marker zeichnen
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
    // Wenn Suche gelöscht wird, Radius-Kreis aufheben
    currentSearchCenter = null;
    if (radiusCircleLayer) map.removeLayer(radiusCircleLayer);
    applyAllFilters();
    return;
  }

  // Geocoding via Nominatim (z.B. PLZ 89073 oder Ort "Ulm")
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=de`)
    .then(res => res.json())
    .then(results => {
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        
        // Neues Suchzentrum setzen
        currentSearchCenter = { lat, lng: lon };

        // Neon-Grünen Radius-Kreis zeichnen und Karte darauf ausrichten
        updateRadiusCircle(lat, lon);
        
        // Spots filtern (Kombination aus Radius + Höhe + Typ)
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
