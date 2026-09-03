// ==========================================
// Sprungbereich.de — OSM-Bäder-Import für ganz Deutschland
// ==========================================
// Holt Freibäder, Hallenbäder und offizielle Badestellen (Seen) aus den
// freien Geodaten von OpenStreetMap (Overpass API) und legt sie als neue
// Spots in Supabase an — automatisch freigeschaltet (status: 'approved'),
// aber ohne Sprunghöhe ("Höhe unbekannt"), damit die Community sie ergänzen
// kann. Bereits vorhandene Spots (egal ob community oder osm) werden anhand
// der Koordinaten übersprungen, Mehrfachausführung ist daher unproblematisch.
//
// AUFRUF:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_KEY=ey... \
//   node import-pools.mjs
//
// Voraussetzung in Supabase: Spalte "source" (text) in der Tabelle "Spots".
// Siehe README.md für alle Details.
// ==========================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Bitte SUPABASE_URL und SUPABASE_SERVICE_KEY als Umgebungsvariablen setzen (siehe README.md).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Primärer Overpass-Endpunkt + Fallback-Mirrors bei Downtime/Rate-Limit/Blockade
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

// Nur benannte, öffentlich zugängliche Bäder/Badestellen — private
// Gartenpools (sehr häufig in OSM!) werden durch die name-Pflicht sowie den
// access-Ausschluss zuverlässig herausgefiltert.
const OVERPASS_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="DE"][admin_level=2]->.de;
(
  nwr["leisure"="swimming_pool"]["name"]["access"!="private"]["access"!="no"](area.de);
  nwr["leisure"="bathing_place"]["name"](area.de);
  nwr["leisure"="sports_centre"]["sport"="swimming"]["name"](area.de);
);
out center tags;
`;

const DEDUPE_RADIUS_KM = 0.15; // 150m — verhindert Duplikate zu bereits vorhandenen Spots

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchOsmData() {
  const body = new URLSearchParams({ data: OVERPASS_QUERY });

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`→ Frage Overpass-API an: ${endpoint} (kann 1-3 Minuten dauern für ganz Deutschland)...`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "SprungbereichDeImport/1.0 (+https://sprungbereich.de; einmaliger Community-Datenimport)"
        },
        body
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log(`✓ ${json.elements.length} Rohdatensätze von OpenStreetMap erhalten.`);
      return json.elements;
    } catch (err) {
      console.warn(`  Endpunkt ${endpoint} fehlgeschlagen (${err.message}), versuche nächsten...`);
    }
  }
  throw new Error("Alle Overpass-Endpunkte fehlgeschlagen. Später erneut versuchen.");
}

function mapOsmElementToSpot(el) {
  const tags = el.tags || {};
  const name = (tags.name || "").trim();
  if (!name) return null;

  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lon = el.type === "node" ? el.lon : el.center?.lon;
  if (lat == null || lon == null) return null;

  // Typ-Heuristik anhand von OSM-Tags + Namen
  const nameLower = name.toLowerCase();
  let type = "Freibad";

  if (tags.leisure === "bathing_place") {
    type = "See";
  } else if (nameLower.includes("frei- und hallenbad") || nameLower.includes("kombibad")) {
    type = "Frei- und Hallenbad";
  } else if (
    tags.location === "indoor" ||
    tags.leisure === "sports_centre" ||
    nameLower.includes("hallenbad") ||
    nameLower.includes("schwimmhalle")
  ) {
    type = "Hallenbad";
  } else {
    type = "Freibad";
  }

  const city = tags["addr:city"] || tags["addr:suburb"] || tags["addr:town"] || "";
  const website = tags.website || tags["contact:website"] || "";

  return {
    title: name,
    city,
    description: "",
    type,
    height: 0, // bewusst unbekannt — Community ergänzt das
    facilities: [],
    website_url: website,
    status: "approved", // Existenz des Bades ist verifizierte Geodaten, keine manuelle Prüfung nötig
    source: "osm",
    latitude: lat,
    longitude: lon
  };
}

async function fetchExistingSpots() {
  console.log("→ Lade bereits vorhandene Spots aus Supabase zum Duplikat-Abgleich...");
  const { data, error } = await supabase.from("Spots").select("latitude, longitude");
  if (error) throw new Error(`Supabase-Fehler beim Laden bestehender Spots: ${error.message}`);
  console.log(`✓ ${data.length} bestehende Spots gefunden.`);
  return data.filter(s => s.latitude != null && s.longitude != null);
}

function isDuplicate(candidate, existingSpots) {
  return existingSpots.some(
    s => haversineKm(candidate.latitude, candidate.longitude, s.latitude, s.longitude) < DEDUPE_RADIUS_KM
  );
}

async function insertInBatches(spots, batchSize = 300) {
  let inserted = 0;
  for (let i = 0; i < spots.length; i += batchSize) {
    const batch = spots.slice(i, i + batchSize);
    const { error } = await supabase.from("Spots").insert(batch);
    if (error) {
      console.error(`❌ Fehler beim Einfügen von Batch ${i / batchSize + 1}:`, error.message);
      continue;
    }
    inserted += batch.length;
    console.log(`  ...${inserted} / ${spots.length} eingefügt`);
  }
  return inserted;
}

async function main() {
  console.log("=== Sprungbereich.de — OSM-Bäder-Import (Deutschland) ===\n");

  const [osmElements, existingSpots] = await Promise.all([fetchOsmData(), fetchExistingSpots()]);

  const candidates = osmElements
    .map(mapOsmElementToSpot)
    .filter(Boolean);

  console.log(`\n→ ${candidates.length} gültige, benannte Bäder/Badestellen aus OSM extrahiert.`);

  // Duplikate zu bestehenden Spots UND innerhalb der OSM-Ergebnisse selbst entfernen
  const seen = [];
  const newSpots = [];
  for (const candidate of candidates) {
    if (isDuplicate(candidate, existingSpots) || isDuplicate(candidate, seen)) continue;
    seen.push(candidate);
    newSpots.push(candidate);
  }

  const skipped = candidates.length - newSpots.length;
  console.log(`→ ${skipped} Duplikate übersprungen (bereits vorhanden oder mehrfach in OSM gelistet).`);
  console.log(`→ ${newSpots.length} neue Spots werden angelegt.\n`);

  if (newSpots.length === 0) {
    console.log("Nichts zu tun — alle gefundenen Bäder sind bereits erfasst. ✓");
    return;
  }

  const inserted = await insertInBatches(newSpots);

  console.log(`\n=== Fertig: ${inserted} neue Spots erfolgreich importiert. ===`);
}

main().catch(err => {
  console.error("\n❌ Import abgebrochen:", err.message);
  process.exit(1);
});
