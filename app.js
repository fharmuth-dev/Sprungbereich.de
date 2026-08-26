// Übersetzungs-Wörterbuch (DE / EN)
const i18n = {
  de: {
    subtitle: "Die ultimative Map für Turm- und Klippenspringen in Deutschland",
    selectStateLabel: "Bundesland wählen",
    startBtn: "Karte erkunden",
    tagline: "Live Filter & Spots",
    searchPlaceholder: "Ort oder PLZ eingeben...",
    allHeights: "⚡ Alle Höhen",
    h1: "1m Brett / Plattform",
    h3: "Ab 3m Turm",
    h5: "Ab 5m Turm",
    h75: "Ab 7.5m Turm",
    h10: "🔥 10m Profi-Turm",
    allTypes: "🏊‍♂️ Alle Typen",
    freibad: "Freibad",
    hallenbad: "Hallenbad",
    see: "See / Klippe",
    verifiedToggle: "Nur verifizierte Spots",
    startRoute: "Route starten",
    editData: "Daten anpassen"
  },
  en: {
    subtitle: "The ultimate map for cliff diving and high diving in Germany",
    selectStateLabel: "Select State",
    startBtn: "Explore Map",
    tagline: "Live Filters & Spots",
    searchPlaceholder: "Enter city or zip code...",
    allHeights: "⚡ All Heights",
    h1: "1m Board / Platform",
    h3: "From 3m Tower",
    h5: "From 5m Tower",
    h75: "From 7.5m Tower",
    h10: "🔥 10m Pro Tower",
    allTypes: "🏊‍♂️ All Types",
    freibad: "Outdoor Pool",
    hallenbad: "Indoor Pool",
    see: "Lake / Cliff",
    verifiedToggle: "Verified Spots Only",
    startRoute: "Start Route",
    editData: "Edit Spot"
  }
};

let currentLang = localStorage.getItem("app_lang") || "de";
let selectedState = "Bayern"; // Standard-Bundesland

document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  initBundeslandCarousel();

  const startMapBtn = document.getElementById("startMapBtn");
  const splashScreen = document.getElementById("splashScreen");

  if (startMapBtn) {
    startMapBtn.addEventListener("click", () => {
      if (typeof gsap !== "undefined") {
        gsap.to(splashScreen, {
          duration: 0.6,
          y: "-100%",
          opacity: 0,
          ease: "power3.inOut",
          onComplete: () => {
            splashScreen.style.display = "none";
          }
        });
      } else {
        splashScreen.style.display = "none";
      }

      // Startet die Map intuitiv im gewählten Bundesland (Standard: Bayern)
      if (typeof window.highlightStateByName === "function") {
        window.highlightStateByName(selectedState);
      }
    });
  }
});

// Sprachumschaltung verwalten
function initLanguage() {
  const deBtn = document.getElementById("langDeBtn");
  const enBtn = document.getElementById("langEnBtn");

  applyLanguage(currentLang);

  deBtn.addEventListener("click", () => setLanguage("de"));
  enBtn.addEventListener("click", () => setLanguage("en"));
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("app_lang", lang);
  applyLanguage(lang);
}

function applyLanguage(lang) {
  document.getElementById("langDeBtn").classList.toggle("active", lang === "de");
  document.getElementById("langEnBtn").classList.toggle("active", lang === "en");

  const dict = i18n[lang];

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    if (dict[key]) el.placeholder = dict[key];
  });
}

// Bundesland-Eingabe + Karussell
function initBundeslandCarousel() {
  const container = document.getElementById("stateSuggestions");
  const input = document.getElementById("stateSearchInput");
  const states = Object.keys(window.germanStates);

  function renderStates(filterText = "") {
    container.innerHTML = "";
    const filtered = states.filter(s => s.toLowerCase().startsWith(filterText.toLowerCase()));

    filtered.forEach(state => {
      const pill = document.createElement("div");
      pill.className = `state-pill ${state === selectedState ? 'active' : ''}`;
      pill.textContent = state;
      
      pill.addEventListener("click", () => {
        selectedState = state;
        input.value = state;
        renderStates(filterText);
      });

      container.appendChild(pill);
    });
  }

  input.addEventListener("input", (e) => {
    renderStates(e.target.value);
  });

  // Standardmäßig Bayern als vorausgewählt im Input anzeigen
  input.value = "Bayern";
  renderStates();
}
