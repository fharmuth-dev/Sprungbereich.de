document.addEventListener("DOMContentLoaded", () => {
  // GSAP Entrance & Exit Animation for Loading Screen
  if (typeof gsap !== "undefined") {
    const tl = gsap.timeline();

    // 1. Zoom in & Fade in Bild
    tl.to("#splashImg", {
      duration: 1.0,
      scale: 1,
      opacity: 1,
      ease: "back.out(1.4)"
    })
    // 2. Halteseite für 1.8 Sekunden
    .to("#splashImg", {
      duration: 1.8,
      scale: 1.03,
      ease: "none"
    })
    // 3. Zoom out / Smooth Fade out nach oben weg
    .to("#splashScreen", {
      duration: 0.8,
      y: "-100%",
      opacity: 0,
      ease: "power3.inOut",
      onComplete: () => {
        const splash = document.getElementById("splashScreen");
        if (splash) splash.style.display = "none";
      }
    })
    // 4. Einblenden der Suchleiste
    .from("#topOverlay", {
      duration: 0.6,
      y: -50,
      opacity: 0,
      ease: "power2.out"
    }, "-=0.3");
  }

  // Suche Event Listener (Go Button)
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
