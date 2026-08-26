let map;
let markersGroup;
let countryBorderLayer = null;
let regionBorderLayer = null;
let allSpots = [];

// Supabase Konfiguration
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
  { id: 4, name: "Strandbad Wannsee Berlin", country: "de", city: "Berlin", zip: "14129", type: "See", height: 5, verified: false, lat: 52.4384, lng: 13.1785 },
  { id: 5, name: "Freibad Prinzenstraße Berlin", country: "de", city: "Berlin", zip: "10969", type: "Freibad", height: 10, verified: true, lat: 52.4965, lng: 13.4116 },
  { id: 6, name: "Stadionbad Köln", country: "de", city: "Köln", zip: "50933", type: "Freibad", height: 10, verified: true, lat: 50.9333, lng: 6.8744 },
  { id: 7, name: "Stadthallenbad Wien", country: "at", city: "Wien", zip: "1150", type: "Hallenbad", height: 10, verified: true, lat: 48.2023, lng: 16.3336 },
  { id: 8, name: "Freibad Prater Wien", country: "at", city: "Wien", zip: "1020", type: "Freibad", height: 5, verified: true, lat: 48.2145, lng: 16.4022 },
  { id: 9, name: "Hallenbad Oerlikon Zürich", country: "ch", city: "Zürich", zip: "8050", type: "Hallenbad", height: 10, verified: true, lat: 47.4105, lng: 8.5471 }
];

const countrySettings = {
  de: { lat: 51.1657, lng: 10.4515, zoom: 6, bboxName: "Germany" },
  at: { lat: 47.5162, lng: 14.5501, zoom: 7, bboxName: "Austria" },
  ch: { lat: 46.8182, lng: 8.2275, zoom: 8, bboxName: "Switzerland" },
  fr: { lat: 46.2276, lng: 2.2137, zoom: 6, bboxName: "France" },
  it: { lat: 41.8719, lng: 12.5674, zoom: 6, bboxName: "Italy" },
  es: { lat: 40.4637, lng: -3.7492, zoom: 6, bboxName: "Spain" }
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

  document.getElementById("heightFilter").addEventListener("change", applyAllFilters);
  document.getElementById("typeFilter").addEventListener("change", applyAllFilters);
  document.getElementById("verifiedOnlyToggle").addEventListener("change", applyAllFilters);
  
  const countrySelect = document.getElementById("countryFilter");
  countrySelect.addEventListener("change", () => {
    updateCountrySelection(countrySelect.value);
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

// 1. Ganzen Staat (Landesgrenze) mit Cyan-Leuchten markieren
async function updateCountrySelection(countryCode) {
  const conf = countrySettings[countryCode];
  if (!conf) return;

  map.setView([conf.lat, conf.lng], conf.zoom);

  if (regionBorderLayer) {
    map.removeLayer(regionBorderLayer);
    regionBorderLayer = null;
  }

  if (countryBorderLayer) {
    map.removeLayer(countryBorderLayer);
    countryBorderLayer = null;
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&country=${conf.bboxName}&limit=1`);
    const data = await res.json();
    if (data && data[0] && data[0].geojson) {
      countryBorderLayer = L.geoJSON(data[0].geojson, {
        style: {
          color: "#00f2fe",
          weight: 2,
          opacity: 0.7,
          fillColor: "#00f2fe",
          fillOpacity: 0.03
        }
      }).addTo(map);
    }
  } catch (e) {
    console.log("Ländergrenze konnte nicht geladen werden.");
  }
}

// 2. Zuverlässiges Laden des echten Bundeslandes / Kantons (z.B. "Baden-Württemberg")
async function highlightStateForLocation(lat, lon, countryCode) {
  if (regionBorderLayer) {
    map.removeLayer(regionBorderLayer);
    regionBorderLayer = null;
  }

  try {
    // Wir fragen Nominatim explizit nach adressdetails ab, um an den Namen des Bundeslandes/Kantons zu kommen
    const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6`);
    const revData = await revRes.json();
    
    let stateName = "";
    if (revData && revData.address) {
      // In DE/AT/CH heißt das Feld in der Adresse meist 'state'
      stateName = revData.address.state || revData.address.region || "";
    }

    if (stateName) {
      // Jetzt suchen wir exakt nach diesem Bundesland, damit wir das saubere GeoJSON-Polygon der Landesfläche bekommen
      const searchRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(stateName)}&countrycodes=${countryCode}&limit=1`);
      const searchData = await searchRes.json();

      if (searchData && searchData[0] && searchData[0].geojson) {
        regionBorderLayer = L.geoJSON(searchData[0].geojson, {
          style: {
            color: "#10b981", // Sattes Neon-Grün für das Bundesland / den Kanton
            weight: 3,
            opacity: 0.9,
            fillColor: "#10b981",
            fillOpacity: 0.06
          }
        }).addTo(map);
      }
    }
  } catch (e) {
    console.log("Bundesland-Grenze konnte nicht geladen werden.");
  }
}

window.initMapForCountry = function(countryCode) {
  const select = document.getElementById("countryFilter");
  select.value = countryCode;
  updateCountrySelection(countryCode);
  applyAllFilters();
};

function applyAllFilters() {
  const country = document.getElementById("countryFilter").value;
  const minHeight = parseFloat(document.getElementById("heightFilter").value) || 0;
  const type = document.getElementById("typeFilter").value;
  const verifiedOnly = document.getElementById("verifiedOnlyToggle").checked;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();

  markersGroup.clearLayers();

  const filtered = allSpots.filter(spot => {
    const matchCountry = !country || spot.country === country;
    const matchHeight = (spot.height || 0) >= minHeight;
    const matchType = type === "all" || spot.type === type;
    const matchVerified = !verifiedOnly || spot.verified === true;
    const matchZoomQuery = !query || 
                           spot.name.toLowerCase().includes(query) || 
                           spot.city.toLowerCase().includes(query) || 
                           (spot.zip && spot.zip.includes(query));

    return matchCountry && matchHeight && matchType && matchVerified && matchZoomQuery;
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
  const country = document.getElementById("countryFilter").value;
  const filtered = applyAllFilters();

  if (query !== "") {
    if (filtered.length > 0) {
      const target = filtered[0];
      map.setView([target.lat, target.lng], 10);
      highlightStateForLocation(target.lat, target.lng, country);
    } else {
      // PLZ oder Stadt-Suche (z.B. Ulm) via Nominatim
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${country}`)
        .then(res => res.json())
        .then(results => {
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            
            // Auf den gesuchten Ort zoomen
            map.setView([lat, lon], 10);
            
            // Jetzt exakt das übergeordnete Bundesland/Kanton grün umranden lassen!
            highlightStateForLocation(lat, lon, country);
          } else {
            alert("Kein Ort gefunden. Du kannst diesen Spot aber über den '+' Button anlegen!");
          }
        })
        .catch(() => alert("Fehler bei der Verbindung."));
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
