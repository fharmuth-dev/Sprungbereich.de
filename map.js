let map;
let markersGroup;

// Standard-Zentren
const countryCoordinates = {
  de: { lat: 51.1657, lng: 10.4515, zoom: 6 },
  at: { lat: 47.5162, lng: 14.5501, zoom: 7 },
  ch: { lat: 46.8182, lng: 8.2275, zoom: 8 },
  fr: { lat: 46.2276, lng: 2.2137, zoom: 6 },
  it: { lat: 41.8719, lng: 12.5674, zoom: 6 },
  es: { lat: 40.4637, lng: -3.7492, zoom: 6 }
};

// Fallback-Spots: Garantieren, dass die Karte NIEMALS leer ist!
const fallbackSpots = [
  { name: "Olympia-Schwimmhalle München", type: "Hallenbad / Sprungturm", height: 10, lat: 48.1732, lng: 11.5536 },
  { name: "Freibad Stadionbad Köln", type: "Freibad", height: 10, lat: 50.9333, lng: 6.8744 },
  { name: "Stadionbad Nürnberg", type: "Freibad", height: 10, lat: 49.4322, lng: 11.1194 },
  { name: "Freibad Untertürkheim Stuttgart", type: "Freibad", height: 10, lat: 48.7778, lng: 9.2514 },
  { name: "Strandbad Wannsee Berlin", type: "Freibad / See", height: 5, lat: 52.4384, lng: 13.1785 },
  { name: "Freibad Prinzenstraße Berlin", type: "Freibad", height: 10, lat: 52.4965, lng: 13.4116 },
  { name: "Inselbad Untertürkheim", type: "Freibad", height: 10, lat: 48.7780, lng: 9.2520 }
];

document.addEventListener("DOMContentLoaded", () => {
  // Kartenerstellung
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Bei jeder Kartenbewegung automatisch Daten laden
  map.on("moveend", () => {
    fetchSpotsForBounds();
  });
});

window.initMapForCountry = function(countryCode) {
  const config = countryCoordinates[countryCode] || countryCoordinates["de"];
  map.setView([config.lat, config.lng], config.zoom);
  
  setTimeout(() => {
    fetchSpotsForBounds();
  }, 400);
};

// Spots von Overpass laden + Fallback einbauen
function fetchSpotsForBounds() {
  if (!map) return;

  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  // Vereinfachte & schnellere Overpass-Abfrage
  const query = `[out:json][timeout:10];node["leisure"="swimming_pool"](${bbox});out body 50;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then(res => res.json())
    .then(data => {
      markersGroup.clearLayers();

      // Falls Overpass Daten liefert, diese anzeigen
      if (data.elements && data.elements.length > 0) {
        data.elements.forEach(item => {
          const name = item.tags?.name || "Freibad / Sprungbereich";
          addMarkerToMap(item.lat, item.lon, name, "Freibad / Hallenbad");
        });
      }
      
      // Zusätzlich IMMER die verifizierten Datenbank-Spots einblenden
      renderFallbackSpots();
    })
    .catch(err => {
      console.warn("Overpass API nicht erreichbar oder blockiert. Nutze Fallback-Daten.", err);
      markersGroup.clearLayers();
      renderFallbackSpots();
    });
}

function renderFallbackSpots() {
  const bounds = map.getBounds();
  fallbackSpots.forEach(spot => {
    // Prüfen, ob Spot im aktuellen Kartenausschnitt liegt (oder beim Zoom auf den Ort passt)
    if (bounds.contains([spot.lat, spot.lng]) || map.getZoom() <= 7) {
      addMarkerToMap(spot.lat, spot.lng, spot.name, spot.type);
    }
  });
}

function addMarkerToMap(lat, lng, name, type) {
  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: "#00f2fe",
    color: "#ffffff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  });

  marker.on("click", () => {
    showBottomSheet(name, type, lat, lng);
  });

  markersGroup.addLayer(marker);
}

// Suche verknüpfen (Nominatim Geocoding)
window.searchLocationWithFilters = function(query, country, height, type) {
  if (!query) return;

  const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${country}`;

  fetch(searchUrl)
    .then(res => res.json())
    .then(results => {
      if (results && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);

        // Auf Standort zoomen
        map.setView([lat, lon], 12);
      } else {
        alert("Ort oder PLZ nicht gefunden. Bitte Eingabe überprüfen.");
      }
    })
    .catch(err => {
      alert("Fehler bei der Suche. Bitte Internetverbindung prüfen.");
      console.error(err);
    });
};

function showBottomSheet(name, type, lat, lng) {
  const sheet = document.getElementById("bottomSheet");
  const title = document.getElementById("poolTitle");
  const poolType = document.getElementById("poolType");
  const navBtn = document.getElementById("navBtn");

  if (sheet && title) {
    title.textContent = name;
    poolType.textContent = type;
    navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    sheet.classList.add("active");
  }
}
