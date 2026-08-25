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
