document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap !== "undefined") {
    const tl = gsap.timeline({
      delay: 0.3
    });

    // 1. Flüssiges Wippen direkt vorne am Brett (wiederholt sich 2x)
    tl.to("#diverGroup", {
      duration: 0.25,
      y: 118, // Federt leicht nach unten
      repeat: 3,
      yoyo: true,
      ease: "power1.inOut"
    })
    // 2. Der eigentliche Kopfsprung nach vorne ins Wasser
    .to("#diverGroup", {
      duration: 0.45,
      x: 40,
      y: 55,
      rotation: 75,
      ease: "power2.in"
    })
    // 3. Eintauchen (kleiner werden & wegblenden)
    .to("#diverGroup", {
      duration: 0.25,
      scale: 0.1,
      opacity: 0,
      ease: "power1.in"
    })
    // 4. Splash Screen nach oben wegfahren
    .to("#splashScreen", {
      duration: 0.6,
      y: "-100%",
      opacity: 0,
      ease: "power3.inOut",
      onComplete: () => {
        const splash = document.getElementById("splashScreen");
        if (splash) splash.style.display = "none";
      }
    })
    // 5. Suchleiste oben einfliegen lassen
    .from("#topOverlay", {
      duration: 0.5,
      y: -40,
      opacity: 0,
      ease: "power2.out"
    }, "-=0.2");
  } else {
    setTimeout(() => {
      const splash = document.getElementById("splashScreen");
      if (splash) splash.style.display = "none";
    }, 2000);
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
