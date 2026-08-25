document.addEventListener("DOMContentLoaded", () => {
  // GSAP Animation: Männchen federt auf dem Brett ein paar Mal und springt dann ins Wasser
  if (typeof gsap !== "undefined") {
    const tl = gsap.timeline({
      delay: 0.2
    });

    // 1. Federn / Wippen auf dem Sprungbrett (2x hoch und runter)
    tl.to("#diverGroup", {
      duration: 0.3,
      y: 120, // Einsinken/Feder
      repeat: 2,
      yoyo: true,
      ease: "power1.inOut"
    })
    // 2. Abflug / Sprung nach oben und rechts ins Wasser
    .to("#diverGroup", {
      duration: 0.5,
      x: 35,
      y: 60,
      rotation: 70,
      ease: "power2.in"
    })
    // 3. Eintauchen (kleiner werden / ausblenden)
    .to("#diverGroup", {
      duration: 0.3,
      scale: 0.2,
      opacity: 0,
      ease: "power1.in"
    })
    // 4. Ganzes Splash-Screen Overlay nach oben wegschieben
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
    // 5. Suchleiste oben einfliegen lassen
    .from("#topOverlay", {
      duration: 0.5,
      y: -40,
      opacity: 0,
      ease: "power2.out"
    }, "-=0.3");
  } else {
    // Fallback falls GSAP nicht lädt
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
