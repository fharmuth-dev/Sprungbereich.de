# OSM-Bäder-Import für Sprungbereich.de

Importiert automatisch Freibäder, Hallenbäder und offizielle Badestellen
(Seen/Flüsse) für **ganz Deutschland** aus den freien Geodaten von
[OpenStreetMap](https://www.openstreetmap.org/copyright) in eure Supabase-Datenbank.

Läuft **nicht** im Browser und **nicht** automatisch bei jedem Website-Besuch —
das ist ein einmalig (oder gelegentlich) manuell auszuführendes Node.js-Skript.
Es beeinflusst die Ladezeit der eigentlichen App zu keinem Zeitpunkt.

## Was das Skript macht

1. Fragt die öffentliche Overpass-API (OpenStreetMap) nach allen benannten,
   öffentlichen Schwimmbädern und Badestellen in Deutschland.
2. Lädt eure bereits vorhandenen Spots aus Supabase.
3. Vergleicht beides anhand der Koordinaten (150m-Radius) und überspringt
   alles, was schon existiert — **mehrfaches Ausführen ist also unbedenklich**,
   es entstehen keine Duplikate.
4. Legt alle neuen Bäder direkt als **freigeschaltet** (`status: 'approved'`)
   an, aber bewusst **ohne Sprunghöhe** — sie erscheinen in der App mit einem
   grauen Pin ("Höhe unbekannt") und einem Aufruf an die Community, die Info
   zu ergänzen.

## Vorbereitung (einmalig, in Supabase)

Bevor ihr das Skript laufen lasst, in eurer Supabase-Tabelle `Spots` eine
neue Spalte anlegen:

| Spalte   | Typ  | Default       | Nullable |
|----------|------|---------------|----------|
| `source` | text | `'community'` | ja       |

So bleiben alle bisherigen (community-eingetragenen) Spots automatisch auf
`'community'`, und die neu importierten werden als `'osm'` markiert.

## Voraussetzungen zum Ausführen

- Node.js Version 18 oder neuer (`node --version` zum Prüfen)
- Euer **Supabase Service Role Key** (⚠️ NICHT der `anon`-Key aus der
  Website!). Zu finden in Supabase: Project Settings → API → „service_role"
  (geheim halten, niemals ins Frontend/GitHub einbauen — nur lokal für dieses
  Skript verwenden, da er alle Sicherheitsregeln umgeht)

## Ausführen

```bash
cd tools/import-osm-pools
npm install

SUPABASE_URL=https://euer-projekt.supabase.co \
SUPABASE_SERVICE_KEY=euer-service-role-key \
node import-pools.mjs
```

Der Import für ganz Deutschland kann **1-3 Minuten** dauern (Overpass muss
einmal die komplette Fläche Deutschlands durchsuchen) — das ist normal, bitte
nicht abbrechen. Am Ende zeigt euch das Skript eine Zusammenfassung:

```
=== Fertig: 1.847 neue Spots erfolgreich importiert. ===
```

## Wichtige Hinweise

- **Qualität der Typ-Zuordnung**: Das Skript ordnet Freibad/Hallenbad/See
  anhand von OSM-Tags und Namensmustern zu (z. B. "Hallenbad" im Namen →
  Hallenbad). Das funktioniert in der großen Mehrheit der Fälle korrekt, ist
  aber keine 100%-Garantie. Falsch zugeordnete Einzelfälle lassen sich jederzeit
  direkt in Supabase per Klick korrigieren.
- **Fehlende Städte**: Manche OSM-Einträge haben kein `addr:city`-Tag, das
  Feld bleibt dann leer. Kein Problem für die Kartendarstellung, nur die
  Textsuche nach Stadtnamen greift dort ggf. nicht.
- **Erneutes Ausführen**: Für Aktualisierungen (z. B. neue Bäder, die
  zwischenzeitlich in OSM ergänzt wurden) das Skript einfach erneut laufen
  lassen — bereits vorhandene Spots werden automatisch übersprungen.

## Optional für später: Automatisierung

Aktuell ist das ein manueller Schritt. Falls ihr das später automatisieren
wollt (z. B. einmal im Monat automatisch neue Bäder nachziehen), lässt sich
dieses Skript relativ einfach in einen **Cloudflare Worker mit Cron Trigger**
überführen (im kostenlosen Free-Plan enthalten) — das ist aber bewusst noch
nicht gebaut, um den Umfang heute nicht unnötig aufzublähen. Bei Bedarf gerne
in einer späteren Session.
