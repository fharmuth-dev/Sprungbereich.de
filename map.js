let map;
let markers = [];
let poolsData = [];

function initMap() {
  map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  fetch('pools.json')
    .then(res => res.json())
    .then(data => {
      poolsData = data;
      renderMarkers(poolsData);
    })
    .catch(err => console.error('Fehler beim Laden:', err));
}

function renderMarkers(data) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  data.forEach(pool => {
    const marker = L.marker([pool.lat, pool.lng]).addTo(map);
    marker.on('click', () => showBottomSheet(pool));
    markers.push(marker);
  });
}

function showBottomSheet(pool) {
  document.getElementById('poolTitle').innerText = pool.name;
  document.getElementById('poolType').innerText = pool.type;
  document.getElementById('poolDetails').innerHTML = `
    <p style="margin: 8px 0; color: #8892b0;">Sprunganlagen: <b style="color:#00f2fe;">${pool.jumps.join(', ')}</b></p>
    <p style="font-size:0.85rem; color:#aaa;">${pool.notes || ''}</p>
  `;
  document.getElementById('navBtn').href = `https://www.google.com/maps/dir/?api=1&destination=${pool.lat},${pool.lng}`;
  document.getElementById('bottomSheet').classList.add('active');
}

document.addEventListener('click', (e) => {
  const sheet = document.getElementById('bottomSheet');
  if (!sheet.contains(e.target) && !e.target.classList.contains('leaflet-marker-icon')) {
    sheet.classList.remove('active');
  }
});

window.onload = initMap;
