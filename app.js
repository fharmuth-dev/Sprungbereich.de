document.addEventListener("DOMContentLoaded", () => {
  const startMapBtn = document.getElementById("startMapBtn");
  const startCountrySelect = document.getElementById("startCountrySelect");
  const splashScreen = document.getElementById("splashScreen");
  const bottomSheet = document.getElementById("bottomSheet");

  // GSAP Entrance Animation & Splash Screen Hide
  if (startMapBtn) {
    startMapBtn.addEventListener("click", () => {
      const selectedCountry = startCountrySelect.value;

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
      } else {
        splashScreen.style.display = "none";
      }

      if (typeof window.initMapForCountry === "function") {
        window.initMapForCountry(selectedCountry);
      }
    });
  }

  // Schließen des Bottom-Sheets bei Klick außerhalb der Map-Marker
  document.addEventListener("click", (e) => {
    if (bottomSheet && bottomSheet.classList.contains("active")) {
      const isClickInside = bottomSheet.contains(e.target);
      const isMarker = e.target.classList.contains("leaflet-interactive");
      const isTopOverlay = document.getElementById("topOverlay").contains(e.target);

      if (!isClickInside && !isMarker && !isTopOverlay) {
        bottomSheet.classList.remove("active");
      }
    }
  });
});
