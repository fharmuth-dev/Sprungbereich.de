document.addEventListener("DOMContentLoaded", () => {

  // Garantiert den Splash Screen ausblenden, egal was vorher schiefgeht
  function hideSplash() {
    const splash = document.getElementById("splashScreen");
    if (!splash || splash.dataset.hidden === "true") return; // schon ausgeblendet -> nichts tun
    splash.dataset.hidden = "true";

    try {
      if (typeof gsap !== "undefined") {
        gsap.to("#splashScreen", {
          duration: 0.7,
          y: "-100%",
          opacity: 0,
          ease: "power3.inOut",
          onComplete: () => { splash.style.display = "none"; }
        });
        gsap.from("#topOverlay", {
          duration: 0.5,
          y: -40,
          opacity: 0,
          ease: "power2.out",
          delay: 0.2
        });
      } else {
        splash.style.display = "none";
      }
    } catch (err) {
      // Falls GSAP aus irgendeinem Grund einen Fehler wirft: trotzdem ausblenden
      console.error("Splash-Übergang fehlgeschlagen, blende trotzdem aus:", err);
      splash.style.display = "none";
    }
  }

  // Regulärer Übergang nach einem Animationszyklus (2.6s)
  setTimeout(hideSplash, 2600);

  // Sicherheitsnetz: falls aus irgendeinem Grund (z.B. Fehler weiter oben im Skript,
  // alter Cache-Stand, etc.) der reguläre Timeout nicht greift, spätestens nach 5s erzwingen
  setTimeout(hideSplash, 5000);

  // Suche Event Listener
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const query = searchInput.value.trim();
      if (query && typeof window.searchLocation === "function") {
        window.searchLocation(query);
      }
    });
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query && typeof window.searchLocation === "function") {
          window.searchLocation(query);
        }
      }
    });
  }
});
