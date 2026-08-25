let map;
let markersGroup;

const countryCoordinates = {
  de: { lat: 51.1657, lng: 10.4515, zoom: 6 },
  at: { lat: 47.5162, lng: 14.5501, zoom: 7 },
  ch: { lat: 46.8182, lng: 8.2275, zoom: 8 },
  fr: { lat: 46.2276, lng: 2.2137, zoom: 6 },
  it: { lat: 41.8719, lng: 12.5674, zoom: 6 },
  es: { lat: 40.4637, lng: -3.7492, zoom: 6 }
};

document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map", { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Automatisch Spots nachladen, sobald der Nutzer die Karte bewegt oder zoomt
  map.on("moveend", () => {
    fetchSpotsForBounds();
  });
});

window.initMapForCountry = function(countryCode) {
  const config = countryCoordinates[countryCode] || countryCoordinates["de"];
  map.setView([config.lat, config.lng], config.zoom);
  
  // Kurze Verzögerung, damit Leaflet die Bounding Box sicher berechnet hat
  setTimeout(fetchSpotsForBounds, 300);
};

// Fragt echte Bäder, Freibäder, Hallenbäder und Wasserparks ab
function fetchSpotsForBounds() {
  if (!map) return;
  
  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  // Breitere Overpass-Abfrage nach Bädern jeglicher Art
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="swimming_pool"](${bbox});
      way["leisure"="swimming_pool"](${bbox});
      node["leisure"="water_park"](${bbox});
      way["leisure"="water_park"](${bbox});
      node["sport"="swimming"](${bbox});
      way["sport"="swimming"](${bbox});
      node["amenity"="public_bath"](${bbox});
    );
    out center 100;
  `;

  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then(res => res.json())
    .then(data => {
      markersGroup.clearLayers();

      if (!data.elements || data.elements.length === 0) return;

      data.elements.forEach(item => {
        const lat = item.lat || (item.center && item.center.lat);
        const lng = item.lon || (item.center && item.center.lon);
        const name = item.tags ? (item.tags.name || "Schwimmbad / Sprungspot") : "Schwimmbad / Sprungspot";
        const type = item.tags && item.tags.leisure === "water_park" ? "Erlebnisbad" : "Freibad / Hallenbad";

        if (lat && lng) {
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
      });
    })
    .catch(err => console.error("Fehler beim Laden der Spots:", err));
}

// Sucheingabe verarbeiten und direkt anspringen
window.searchLocationWithFilters = function(query, country, height, type) {
  const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${country}`;

  fetch(searchUrl)
    .then(res => res.json())
    .then(results => {
      if (results && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);

        // Zoom direkt auf den Standort (Zoomlevel 13 für Städte & PLZ)
        map.setView([lat, lon], 13);
        
        // Durch moveend wird fetchSpotsForBounds() automatisch ausgelöst!
      } else {
        alert("Ort oder PLZ nicht gefunden. Bitte Eingabe prüfen.");
      }
    })
    .catch(err => console.error("Suchfehler:", err));
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
