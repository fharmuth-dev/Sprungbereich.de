// ==========================================
// 1. HAUPT-INITIALISIERUNG (DOM READY)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Loading-Screen ausblenden & danach Welcome-Onboarding zeigen
  initSplashAndWelcome();

  // Modal-System, Titel-Effekte & Uploads
  initModals();
});

// ==========================================
// 2. SPLASH / LOADING SCREEN & WELCOME-ONBOARDING
// ==========================================
function initSplashAndWelcome() {
  const loadingScreen = document.getElementById("loadingScreen");
  const welcomeModal = document.getElementById("welcomeModal");

  // Automatisches Ausblenden des Lade-Bildschirms nach Ladeanimation
  // (map.js blendet den Screen ebenfalls spätestens nach dem Laden der Karte aus)
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");

      // Beim allerersten Besuch das Onboarding-Modal zeigen
      if (welcomeModal && !localStorage.getItem("welcome_seen")) {
        setTimeout(() => {
          welcomeModal.classList.add("active");
        }, 400);
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

  // Setup Rechtliches (Impressum & Datenschutz). Add-Spot & Report werden
  // bereits vollständig von map.js gesteuert (dort inkl. zusätzlicher Logik).
  setupModal("openImpressumBtn", "impressumModal", "closeImpressumBtn");
  setupModal("openPrivacyBtn", "privacyModal", "closePrivacyBtn");

  // Bei ALLEN Modals: Klick auf den dunklen Hintergrund schließt das Modal
  // (auch für Add-Spot & Report, die ihre Öffnen/Schließen-Logik separat in map.js haben)
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  });

  // Onboarding Close Button (merkt sich, dass das Modal gesehen wurde)
  const closeWelcomeBtn = document.getElementById("closeWelcomeBtn");
  const welcomeModal = document.getElementById("welcomeModal");
  if (closeWelcomeBtn && welcomeModal) {
    closeWelcomeBtn.addEventListener("click", () => {
      welcomeModal.classList.remove("active");
      localStorage.setItem("welcome_seen", "1");
    });
  }
  if (welcomeModal) {
    welcomeModal.addEventListener("click", (e) => {
      if (e.target === welcomeModal) {
        localStorage.setItem("welcome_seen", "1");
      }
    });
  }
}
