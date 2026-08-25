// GSAP Intro Animation
window.addEventListener('load', () => {
  const tl = gsap.timeline();
  tl.to('.splash-title', { duration: 0.8, opacity: 1, y: 0 })
    .to('.splash-slogan', { duration: 0.6, opacity: 1, y: 0 })
    .to('#splashScreen', { duration: 0.8, opacity: 0, delay: 1.5, onComplete: () => {
        document.getElementById('splashScreen').style.display = 'none';
    }})
    .from('#topOverlay', { duration: 0.6, y: -50, opacity: 0 });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

document.getElementById('heightFilter').addEventListener('change', applyFilters);
document.getElementById('typeFilter').addEventListener('change', applyFilters);

function applyFilters() {
  const selectedHeight = parseFloat(document.getElementById('heightFilter').value);
  const selectedType = document.getElementById('typeFilter').value;

  const filtered = poolsData.filter(pool => {
    const heightMatch = selectedHeight === 0 || pool.maxJump >= selectedHeight;
    const typeMatch = selectedType === 'all' || pool.type === selectedType;
    return heightMatch && typeMatch;
  });

  renderMarkers(filtered);
}

document.getElementById('locateBtn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    });
  }
});
