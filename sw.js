// ── SERVICE WORKER · FinanzasHRZ ────────────────────────────
// Guarda la "cáscara" de la app para que abra rápido y funcione
// instalada. Para HTML/JS/CSS propios usa red primero y cae a caché
// si no hay conexión. Firebase y otros servicios externos no se tocan.

const VERSION = 'finanzashrz-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './secciones/ingresos.html',
  './secciones/gastos.html',
  './secciones/mas.html',
  './secciones/categorias.html',
  './secciones/divisas.html',
  './secciones/agenda.html',
  './elementos/css/style.css',
  './elementos/css/cuentas.css',
  './elementos/css/movimientos.css',
  './elementos/css/categorias.css',
  './elementos/css/divisas.css',
  './elementos/css/agenda.css',
  './elementos/css/pro.css',
  './elementos/js/app.js',
  './elementos/js/firebase.js',
  './elementos/js/cuentas.js',
  './elementos/js/movimientos.js',
  './elementos/js/categorias.js',
  './elementos/js/divisas.js',
  './elementos/js/agenda.js',
  './elementos/js/quick-mov.js',
  './elementos/js/pickers-cuenta.js',
  './elementos/js/cat-picker.js',
  './elementos/js/cuenta-picker.js',
  './elementos/js/icon-picker.js',
  './elementos/js/icon-library.js',
  './elementos/js/cats-store.js',
  './elementos/js/calendar.js',
  './elementos/js/ai-config.js',
  './elementos/img/icon-192.png',
  './elementos/img/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, fuentes, CDN: directo a la red

  e.respondWith(
    fetch(req, { cache: 'no-cache' })   // revalida con el servidor: nunca sirve CSS/JS viejos
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
