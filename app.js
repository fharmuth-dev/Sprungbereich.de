// ==========================================
// 1. HAUPT-INITIALISIERUNG (DOM READY)
// ==========================================
let deferredInstallPrompt = null; // wird von "beforeinstallprompt" befüllt (Android/Chrome)

document.addEventListener("DOMContentLoaded", () => {
  // Loading-Screen ausblenden & danach Welcome-Onboarding zeigen
  initSplashAndWelcome();

  // Modal-System
  initModals();

  // "Zum Startbildschirm hinzufügen"-Funktion
  initInstallPrompt();

  // Geräte-/browserspezifische Installationsanleitung
  initInstallInstructions();
});

// ==========================================
// 2. SPLASH / LOADING SCREEN & WELCOME-ONBOARDING
// ==========================================
function initSplashAndWelcome() {
  const loadingScreen = document.getElementById("loadingScreen");
  const welcomeModal = document.getElementById("welcomeModal");

  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");

      // Das Onboarding-Modal zeigen, außer der Nutzer hat "nicht mehr anzeigen" aktiviert
      if (welcomeModal && !localStorage.getItem("welcome_dontshow")) {
        setTimeout(() => {
          welcomeModal.classList.add("active");
        }, 400);
      } else {
        // Wurde das Willkommens-Modal übersprungen, kann direkt der Install-Hinweis kommen
        maybeShowInstallHintOnce();
      }
    }, 1800);
  }
}

// ==========================================
// 3. MODAL STEUERUNG
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
  };

  // Setup Rechtliches & Installations-Hinweis. Add-Spot & Report werden
  // bereits vollständig von map.js gesteuert (dort inkl. zusätzlicher Logik).
  setupModal("openImpressumBtn", "impressumModal", "closeImpressumBtn");
  setupModal("openPrivacyBtn", "privacyModal", "closePrivacyBtn");
  setupModal("openInstallBtn", "installModal", "closeInstallBtn");

  // Bei ALLEN Modals außer dem Welcome-Modal (das hat eigene Checkbox-Logik):
  // Klick auf den dunklen Hintergrund schließt das Modal
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    if (modal.id === "welcomeModal") return;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  });

  // --- Onboarding / Welcome-Modal: Checkbox entscheidet, ob es künftig erscheint ---
  const closeWelcomeBtn = document.getElementById("closeWelcomeBtn");
  const welcomeModal = document.getElementById("welcomeModal");
  const dontShowCheckbox = document.getElementById("dontShowWelcomeAgain");

  const closeWelcomeModal = () => {
    if (!welcomeModal) return;
    welcomeModal.classList.remove("active");

    if (dontShowCheckbox && dontShowCheckbox.checked) {
      localStorage.setItem("welcome_dontshow", "1");
    } else {
      // Checkbox nicht aktiv -> Meldung soll beim nächsten Besuch wieder erscheinen
      localStorage.removeItem("welcome_dontshow");
    }

    // Nach dem Onboarding ggf. den Install-Hinweis zeigen
    maybeShowInstallHintOnce();
  };

  if (closeWelcomeBtn) {
    closeWelcomeBtn.addEventListener("click", closeWelcomeModal);
  }
  if (welcomeModal) {
    welcomeModal.addEventListener("click", (e) => {
      if (e.target === welcomeModal) closeWelcomeModal();
    });
  }
}

// ==========================================
// 4. "ZUM STARTBILDSCHIRM HINZUFÜGEN" (PWA-Installation)
// ==========================================
function initInstallPrompt() {
  const nativeInstallBtn = document.getElementById("nativeInstallBtn");

  // Chrome/Android feuert dieses Event, wenn ein natives Install-Prompt möglich ist
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (nativeInstallBtn) nativeInstallBtn.style.display = "block";
  });

  if (nativeInstallBtn) {
    nativeInstallBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      nativeInstallBtn.style.display = "none";
    });
  }

  // Wurde die App bereits installiert, verschwindet der native Button wieder
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (nativeInstallBtn) nativeInstallBtn.style.display = "none";
    localStorage.setItem("install_hint_seen", "1");
  });
}

// Zeigt den Install-Hinweis einmalig auf Mobilgeräten, sofern die App noch
// nicht installiert ist und der Hinweis noch nicht gezeigt wurde.
// Erkennt Gerät + Browser und zeigt nur die wirklich passende Anleitung.
// Grund: Die Schritte unterscheiden sich je Browser deutlich – eine
// Universal-Anleitung lässt viele Nutzer bei der Installation stranden.
function detectInstallTarget() {
  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) return "installed";

  // iPadOS meldet sich seit iOS 13 als Mac -> Touchpunkte mitprüfen
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    const isRealSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isRealSafari ? "ios-safari" : "ios-other";
  }

  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Firefox/.test(ua)) return "android-firefox";
    if (/Chrome/.test(ua)) return "android-chrome";
    return "fallback";
  }

  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";
  return "fallback";
}

function initInstallInstructions() {
  const container = document.getElementById("installInstructions");
  const showAllBtn = document.getElementById("showAllInstallBtn");
  if (!container) return;

  const blocks = container.querySelectorAll("[data-install]");
  const target = detectInstallTarget();

  blocks.forEach(b => { b.hidden = b.dataset.install !== target; });

  // Sicherheitsnetz: falls die Erkennung danebenliegt, alles einblendbar machen
  if (showAllBtn) {
    showAllBtn.hidden = target === "installed";
    showAllBtn.addEventListener("click", () => {
      blocks.forEach(b => { if (b.dataset.install !== "installed") b.hidden = false; });
      showAllBtn.hidden = true;
    }, { once: true });
  }
}

function maybeShowInstallHintOnce() {
  if (localStorage.getItem("install_hint_seen")) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (!isIOS && !isAndroid) return; // nur auf Mobilgeräten automatisch anzeigen

  const installModal = document.getElementById("installModal");
  if (!installModal) return;

  setTimeout(() => {
    installModal.classList.add("active");
    localStorage.setItem("install_hint_seen", "1");
  }, 600);
}


// ==========================================
// 5. iOS-VIEWPORT-FIX (Adressleisten-Höhenbug)
// ==========================================
// Ältere iOS-Safari-Versionen kennen kein 100dvh. Sie melden bei 100vh die
// Höhe OHNE Adressleiste, wodurch der untere Teil der Karte abgeschnitten
// wird. Diese Variable liefert die tatsächlich sichtbare Höhe nach.
(function fixMobileViewportHeight() {
  const setVh = () => {
    const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  };
  setVh();
  window.addEventListener("resize", setVh, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(setVh, 250), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setVh, { passive: true });
  }
})();

// ==========================================
// 6. FILTER-DRAWER (aufklappbarer Filterbereich)
// ==========================================
// Hält die Startansicht bewusst ruhig: sichtbar ist nur die Suche. Alle
// Filter, die Legende und die Rechtstexte liegen eine Ebene tiefer, sind
// aber jederzeit mit einem Tipp erreichbar.
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const drawer = document.getElementById("filterDrawer");
  const countBadge = document.getElementById("activeFilterCount");

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener("click", () => {
    const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!isOpen));
    drawer.hidden = isOpen;
  });

  // Zeigt im eingeklappten Zustand an, wie viele Filter gerade aktiv sind –
  // verhindert das klassische "Warum sehe ich nichts?"-Problem.
  const updateActiveFilterCount = () => {
    if (!countBadge) return;
    let active = 0;

    const height = document.getElementById("heightFilter");
    const type = document.getElementById("typeFilter");
    const verified = document.getElementById("verifiedOnlyToggle");
    const allPools = document.getElementById("showAllPoolsToggle");

    if (height && parseFloat(height.value) > 0) active++;
    if (type && type.value !== "all") active++;
    if (verified && verified.checked) active++;
    if (allPools && allPools.checked) active++;

    countBadge.textContent = String(active);
    countBadge.hidden = active === 0;
  };

  ["heightFilter", "typeFilter", "verifiedOnlyToggle", "showAllPoolsToggle"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", updateActiveFilterCount);
  });

  updateActiveFilterCount();
});
