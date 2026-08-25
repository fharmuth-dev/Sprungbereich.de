document.addEventListener("DOMContentLoaded", () => {
  const startMapBtn = document.getElementById("startMapBtn");
  const startCountrySelect = document.getElementById("startCountrySelect");
  const countryFilter = document.getElementById("countryFilter");
  const splashScreen = document.getElementById("splashScreen");

  // Wenn der Nutzer auf "Karte öffnen" klickt
  if (startMapBtn) {
    startMapBtn.addEventListener("click", () => {
      const selectedCountry = startCountrySelect.value;
      
      // Synchronisiere das Land mit dem Suchfeld in der Overlay-Leiste
      if (countryFilter) {
        countryFilter.value = selectedCountry;
      }

      // Splash Screen ausblenden
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
        gsap.from("#topOverlay", {
          duration: 0.5,
          y: -40,
          opacity: 0,
          ease: "power2.out",
          delay: 0.2
        });
      } else {
        splashScreen.style.display = "none";
      }

      // Übergabe des gewählten Landes an die Map (in map.js definiert)
      if (typeof window.initMapForCountry === "function") {
        window.initMapForCountry(selectedCountry);
      }
    });
  }

  // Verknüpfung der Hauptsuche auf der Map
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");

  if (searchBtn && searchInput) {
    const triggerSearch = () => {
      const query = searchInput.value.trim();
      const country = countryFilter ? countryFilter.value : "de";
      const height = document.getElementById("heightFilter").value;
      const type = document.getElementById("typeFilter").value;

      if (query && typeof window.searchLocationWithFilters === "function") {
        window.searchLocationWithFilters(query, country, height, type);
      } else if (query && typeof window.searchLocation === "function") {
        window.searchLocation(query);
      }
    };

    searchBtn.addEventListener("click", triggerSearch);
    searchInput.keypress?.((e) => {
      if (e.key === "Enter") triggerSearch();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") triggerSearch();
    });
  }
});
