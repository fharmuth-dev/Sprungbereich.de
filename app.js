document.addEventListener("DOMContentLoaded", () => {
  // GSAP Animation mit garantiertem Start-State
  if (typeof gsap !== "undefined") {
    const tl = gsap.timeline();

    // 1. Sanftes Einblenden & Scale-Up des Bildes
    tl.to("#splashImg", {
      duration: 1.0,
      scale: 1,
      opacity: 1,
      ease: "power2.out"
    })
    // 2. Kurz wirken lassen (1.5 Sekunden)
    .to("#splashImg", {
      duration: 1.5,
      scale: 1.02,
      ease: "none"
    })
    // 3. Nach oben hin wegschieben (Smooth Exit)
    .to("#splashScreen", {
      duration: 0.7,
      y: "-100%",
      opacity: 0,
      ease: "power3.inOut",
      onComplete: () => {
        const splash = document.getElementById("splashScreen");
        if (splash) splash.style.display = "none";
      }
    })
    // 4. Suchleiste von oben einfliegen lassen
    .from("#topOverlay", {
      duration: 0.5,
      y: -40,
      opacity: 0,
      ease: "power2.out"
    }, "-=0.3");
  } else {
    // Fallback falls GSAP lädtverzögerung hat
    setTimeout(() => {
      const splash = document.getElementById("splashScreen");
      if (splash) splash.style.display = "none";
    }, 2500);
  }

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
