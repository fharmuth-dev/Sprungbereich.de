// ==========================================
// 1. SPRACH-WÖRTERBUCH & LOKALISIERUNG
// ==========================================
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

// ==========================================
// 2. HAUPT-INITIALISIERUNG (DOM READY)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Sprachumschaltung & Bundesland-Karussell initialisieren
  initLanguage();
  initBundeslandCarousel();

  // Loading-Screen & Splash-Screen Handling
  initSplashScreen();

  // Modal-System, Titel-Effekte & Uploads
  initModals();
  initGraffitiTitle();
  initImageUploadPreview();
});

// ==========================================
// 3. SPRACH-FUNKTIONEN
// ==========================================
function initLanguage() {
  const deBtn = document.getElementById("langDeBtn");
  const enBtn = document.getElementById("langEnBtn");

  applyLanguage(currentLang);

  if (deBtn) deBtn.addEventListener("click", () => setLanguage("de"));
  if (enBtn) enBtn.addEventListener("click", () => setLanguage("en"));
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("app_lang", lang);
  applyLanguage(lang);
}

function applyLanguage(lang) {
  const deBtn = document.getElementById("langDeBtn");
  const enBtn = document.getElementById("langEnBtn");

  if (deBtn) deBtn.classList.toggle("active", lang === "de");
  if (enBtn) enBtn.classList.toggle("active", lang === "en");

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

// ==========================================
// 4. BUNDESLAND CAROUSEL / SUCHE
// ==========================================
function initBundeslandCarousel() {
  const container = document.getElementById("stateSuggestions");
  const input = document.getElementById("stateSearchInput");

  if (!container || !input) return;

  // Fallback, falls window.germanStates noch nicht definiert ist
  const states = window.germanStates ? Object.keys(window.germanStates) : [
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
    "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
    "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"
  ];

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

  input.value = selectedState;
  renderStates();
}

// ==========================================
// 5. SPLASH & LOADING SCREEN
// ==========================================
function initSplashScreen() {
  const startMapBtn = document.getElementById("startMapBtn");
  const splashScreen = document.getElementById("splashScreen");
  const loadingScreen = document.getElementById("loadingScreen");

  // Automatisches Ausblenden des Lade-Bildschirms nach Ladeanimation
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
    }, 3200);
  }

  // Splash Screen Button Event (Startet die Karte)
  if (startMapBtn && splashScreen) {
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

      // Zeige Welcome-Modal nach Verlassen des Splash-Screens
      const welcomeModal = document.getElementById("welcomeModal");
      if (welcomeModal) {
        welcomeModal.classList.add("active");
      }

      // Startet die Map im gewählten Bundesland
      if (typeof window.highlightStateByName === "function") {
        window.highlightStateByName(selectedState);
      }
    });
  }
}

// ==========================================
// 6. MODAL STEUERUNG
// ==========================================
function initModals() {
  const setupModal = (triggerId, modalId, closeId) => {
    const trigger = document.getElementById(triggerId);
    const modal = document.getElementById(modalId);
    const close = document.getElementById(closeId);

    if (trigger && modal) {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        modal.classList.add("active");
      });
    }

    if (close && modal) {
      close.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      });
    }
  };

  // Setup aller Popups & Dialoge
  setupModal("openAddModalBtn", "addSpotModal", "closeAddModalBtn");
  setupModal("openReportBtn", "reportModal", "closeReportModalBtn");
  setupModal("openImpressumBtn", "impressumModal", "closeImpressumBtn");
  setupModal("openPrivacyBtn", "privacyModal", "closePrivacyBtn");

  // Onboarding Close Button
  const closeWelcomeBtn = document.getElementById("closeWelcomeBtn");
  const welcomeModal = document.getElementById("welcomeModal");
  if (closeWelcomeBtn && welcomeModal) {
    closeWelcomeBtn.addEventListener("click", () => {
      welcomeModal.classList.remove("active");
    });
  }
}

// ==========================================
// 7. GRAFFITI BANNER TITEL (DYNAMISCHE SPANS)
// ==========================================
function initGraffitiTitle() {
  const titleContainer = document.getElementById("dynamicGraffitiTitle");
  if (titleContainer) {
    const text = "SPOT DROPPEN";
    titleContainer.innerHTML = text
      .split("")
      .map(char => `<span class="g-letter">${char === " " ? "&nbsp;" : char}</span>`)
      .join("");
  }
}

// ==========================================
// 8. IMAGE UPLOAD PREVIEW
// ==========================================
function initImageUploadPreview() {
  const spotImagesInput = document.getElementById("spotImages");
  const previewContainer = document.getElementById("imagePreviewContainer");

  if (spotImagesInput && previewContainer) {
    spotImagesInput.addEventListener("change", (e) => {
      previewContainer.innerHTML = "";
      const files = Array.from(e.target.files).slice(0, 3); // Maximal 3 Fotos

      files.forEach(file => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = document.createElement("img");
            img.src = event.target.result;
            img.classList.add("preview-thumb");
            previewContainer.appendChild(img);
          };
          reader.readAsDataURL(file);
        }
      });
    });
  }
}
