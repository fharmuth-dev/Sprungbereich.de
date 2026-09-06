// ==========================================
// Sprungbereich.de — Build-Skript
// ==========================================
// Wird von Cloudflare Pages automatisch vor dem Deploy ausgeführt.
// Minifiziert alle JS-Dateien (app.js, map.js, sw.js, Functions)
// und kopiert alles in den dist/-Ordner, den Cloudflare dann
// als Root deployt. CSS und HTML werden unverändert übernommen
// (HTML-Minifizierung birgt bei komplexen Templates mehr Risiko als Nutzen).
//
// Das Ergebnis: der ausgelieferte Code sieht für einen Kopierer aus wie:
//   let a=null;function b(c){...} — mühsam zu lesen, unmöglich zu warten.
// ==========================================

import { minify } from 'terser';
import fs from 'fs';
import path from 'path';

const SRC = '.';
const DIST = 'dist';

// Verzeichnisstruktur im dist-Ordner anlegen
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Dateien die 1:1 kopiert werden (kein Minifizieren sinnvoll/nötig)
const COPY_PATTERNS = [
  'index.html',
  'style.css',
  'manifest.json',
  'pools.json',
  '_headers',
  '.gitignore',
  'README.md',
];

// JS-Dateien die minifiziert werden
const JS_FILES = [
  'app.js',
  'map.js',
  'sw.js',
  'functions/api/submit-spot.js',
  'functions/api/submit-report.js',
];

const TERSER_OPTIONS = {
  compress: {
    drop_console: false,   // console.info/warn für Debugging-Hinweise behalten
    passes: 2,
  },
  mangle: {
    // Öffentliche Leaflet-APIs und DOM-IDs nicht umbenennen, da der Code
    // sie über String-Literale anspricht (getElementById("searchBtn") etc.)
    reserved: [],
  },
  format: {
    comments: false,       // alle Kommentare entfernen
  },
  module: false,
};

// Terser-Optionen für ES-Module (Functions verwenden export)
const TERSER_OPTIONS_ESM = {
  ...TERSER_OPTIONS,
  module: true,
};

async function buildJS(relPath, isModule = false) {
  const src = path.join(SRC, relPath);
  const dest = path.join(DIST, relPath);

  ensureDir(path.dirname(dest));

  const code = fs.readFileSync(src, 'utf8');
  const opts = isModule ? TERSER_OPTIONS_ESM : TERSER_OPTIONS;

  try {
    const result = await minify(code, opts);
    fs.writeFileSync(dest, result.code, 'utf8');
    const before = code.length;
    const after = result.code.length;
    const saving = ((1 - after / before) * 100).toFixed(1);
    console.log(`  ✓ ${relPath.padEnd(40)} ${(before/1024).toFixed(1)}KB → ${(after/1024).toFixed(1)}KB  (-${saving}%)`);
  } catch (err) {
    console.error(`  ✗ FEHLER bei ${relPath}:`, err.message);
    // Im Fehlerfall Original kopieren, damit der Deploy nicht komplett abbricht
    fs.copyFileSync(src, dest);
  }
}

function copyFile(relPath) {
  const src = path.join(SRC, relPath);
  const dest = path.join(DIST, relPath);
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  → ${relPath}`);
}

function copyDir(relDir) {
  const src = path.join(SRC, relDir);
  if (!fs.existsSync(src)) return;
  const dest = path.join(DIST, relDir);
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copyDir(path.join(relDir, entry.name));
    } else {
      copyFile(path.join(relDir, entry.name));
    }
  }
}

async function main() {
  console.log('\n🏗️  Sprungbereich.de — Build\n');

  // Alten dist-Ordner löschen
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  ensureDir(DIST);

  console.log('Minifiziere JavaScript:');
  for (const f of JS_FILES) {
    const isModule = f.startsWith('functions/');
    await buildJS(f, isModule);
  }

  console.log('\nKopiere statische Dateien:');
  for (const f of COPY_PATTERNS) copyFile(f);
  copyDir('images');

  console.log('\n✅ Build fertig → dist/\n');
}

main().catch(err => {
  console.error('Build fehlgeschlagen:', err);
  process.exit(1);
});
