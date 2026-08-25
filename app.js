document.addEventListener("DOMContentLoaded", () => {
  // Zeige den Text für 1.6 Sekunden, dann geschmeidiger Fade-Out
  setTimeout(() => {
    if (typeof gsap !== "undefined") {
      gsap.to("#splashScreen", {
        duration: 0.6,
        opacity: 0,
        ease: "power2.inOut",
        onComplete: () => {
          const splash = document.getElementById("splashScreen");
          if (splash) splash.style.display = "none";
        }
      });
      gsap.from("#topOverlay", {
        duration: 0.5,
        y: -30,
        opacity: 0,
        ease: "power2.out"
      });
    } else {
      const splash = document.getElementById("splashScreen");
      if (splash) splash.style.display = "none";
    }
  }, 1600);

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
