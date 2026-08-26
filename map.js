let map;
let markersGroup;
let countryBorderLayer = null;
let regionBorderLayer = null;
let allSpots = [];

// Supabase Konfiguration (Optional)
const SUPABASE_URL = "DEINE_SUPABASE_URL";
const SUPABASE_KEY = "DEIN_SUPABASE_ANON_KEY";
let supabaseClient = null;

if (typeof supabase !== "undefined" && SUPABASE_URL !== "DEINE_SUPABASE_URL") {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Lokale deutsche Stammdaten
const localDatabase = [
  { id: 1, name: "Olympia-Schwimmhalle München", country: "de", state: "Bayern", city: "München", zip: "80809", type: "Hallenbad", height: 10, verified: true, lat: 48.1732, lng: 11.5536 },
  { id: 2, name: "Stadionbad Nürnberg", country: "de", state: "Bayern", city: "Nürnberg", zip: "90471", type: "Freibad", height: 10, verified: true, lat: 49.4322, lng: 11.1194 },
  { id: 3, name: "Inselbad Untertürkheim Stuttgart", country: "de", state: "Baden-Württemberg", city: "Stuttgart", zip: "70327", type: "Freibad", height: 10, verified: true, lat: 48.7780, lng: 9.2520 },
  { id: 4, name: "SSV Ulm Freibad SSV Ulm 1846", country: "de", state: "Baden-Württemberg", city: "Ulm", zip: "89073", type: "Freibad", height: 5, verified: true, lat: 48.4011, lng: 9.9876 },
  { id: 5, name: "Strandbad Wannsee Berlin", country: "de", state: "Berlin", city: "Berlin", zip: "14129", type: "See", height: 5, verified: false, lat: 52.4384, lng: 13.1785 },
  { id: 6, name: "Freibad Prinzenstraße Berlin", country: "de", state: "Berlin", city: "Berlin", zip: "10969", type: "Freibad", height: 10, verified: true, lat: 52.4965, lng: 13.4116 },
  { id: 7, name: "Stadionbad Köln", country: "de", state: "Nordrhein-Westfalen", city: "Köln", zip: "50933", type: "Freibad", height: 10, verified: true, lat: 50.9333, lng: 6.8744 }
];

// Liste aller 16 Bundesländer mit Koordinaten & Standard-Start auf Bayern
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
  // Deutschland-Zentrum
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  loadSpotsData();
  drawGermanyOutline();

  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);

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

// Zeichnet die Deutschland-Außengrenze (Cyan)
async function drawGermanyOutline() {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&country=Germany&limit=1`);
    const data = await res.json();
    if (data && data[0] && data[0].geojson) {
      countryBorderLayer = L.geoJSON(data[0].geojson, {
        style: {
          color: "#00f2fe",
          weight: 2,
          opacity: 0.6,
          fillColor: "#00f2fe",
          fillOpacity: 0.02
        }
      }).addTo(map);
    }
  } catch (e) {
    console.log("Deutschland-Grenze konnte nicht geladen werden.");
  }
}

// Hebt das gewählte Bundesland grün hervor (z. B. Bayern)
window.highlightStateByName = async function(stateName) {
  const conf = window.germanStates[stateName];
  if (conf) {
    map.setView([conf.lat, conf.lng], conf.zoom);
  }

  if (regionBorderLayer) {
    map.removeLayer(regionBorderLayer);
    regionBorderLayer = null;
  }

  try {
    const searchRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(stateName)}&countrycodes=de&limit=1`);
    const searchData = await searchRes.json();

    if (searchData && searchData[0] && searchData[0].geojson) {
      regionBorderLayer = L.geoJSON(searchData[0].geojson, {
        style: {
          color: "#10b981", // Emerald Grün
          weight: 3,
          opacity: 0.9,
          fillColor: "#10b981",
          fillOpacity: 0.08
        }
      }).addTo(map);
    }
  } catch (e) {
    console.log("Bundesland-Umrandung konnte nicht geladen werden.");
  }
};

function applyAllFilters() {
  const minHeight = parseFloat(document.getElementById("heightFilter").value) || 0;
  const type = document.getElementById("typeFilter").value;
  const verifiedOnly = document.getElementById("verifiedOnlyToggle").checked;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();

  markersGroup.clearLayers();

  const filtered = allSpots.filter(spot => {
    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;
    const matchQuery = !query || 
                       spot.name.toLowerCase().includes(query) || 
                       spot.city.toLowerCase().includes(query) || 
                       (spot.zip && spot.zip.includes(query));

    return matchHeight && matchType && matchVerified && matchQuery;
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
  const filtered = applyAllFilters();

  if (query !== "") {
    if (filtered.length > 0) {
      const target = filtered[0];
      map.setView([target.lat, target.lng], 12);
      if (target.state) window.highlightStateByName(target.state);
    } else {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=de`)
        .then(res => res.json())
        .then(results => {
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            map.setView([lat, lon], 12);
            
            // Zugehöriges Bundesland auflösen
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6`)
              .then(r => r.json())
              .then(data => {
                if (data && data.address && data.address.state) {
                  window.highlightStateByName(data.address.state);
                }
              });
          } else {
            alert("Kein Ort in Deutschland gefunden.");
          }
        });
    }
  }
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
