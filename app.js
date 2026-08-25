document.addEventListener("DOMContentLoaded", () => {
  // Nach 2.6 Sekunden (genau nach einem Animationszyklus) den Splash Screen wegschieben
  setTimeout(() => {
    if (typeof gsap !== "undefined") {
      gsap.to("#splashScreen", {
        duration: 0.7,
        y: "-100%",
        opacity: 0,
        ease: "power3.inOut",
        onComplete: () => {
          const splash = document.getElementById("splashScreen");
          if (splash) splash.style.display = "none";
        }
      });
      gsap.from("#topOverlay", {
        duration: 0.5,
        y: -40,
        opacity: 0,
        ease: "power2.out",
        delay: 0.2
      });
    } else {
      const splash = document.getElementById("splashScreen");
      if (splash) splash.style.display = "none";
    }
  }, 2600);
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
