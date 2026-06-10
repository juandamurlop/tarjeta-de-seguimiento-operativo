const CACHE_NAME = 'freimanautos-pwa-v214';

// Lista alineada con lo que carga index.html tras la reestructuración de
// carpetas (css/main.css importa el resto; js dividido en core/ordenes/views).
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',

  // CSS (main.css importa el resto vía @import, pero los precacheamos
  // explícitamente para que el offline funcione sin red)
  '/css/main.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/ordenes.css',
  '/css/cotizaciones.css',
  '/css/vistas.css',

  // Core: configuración, API, utilidades, estado global, autenticación
  '/js/config.js',
  '/js/core/api.js',
  '/js/core/utils.js',
  '/js/core/state.js',
  '/js/core/auth.js',

  // Módulo órdenes
  '/js/ordenes/ordenes-lista.js',
  '/js/ordenes/ordenes-detalle.js',
  '/js/ordenes/ordenes-nueva.js',
  '/js/ordenes/ordenes-jefe.js',
  '/js/ordenes/ordenes-sistema.js',

  // Vistas
  '/js/views/dashboard.js',
  '/js/views/mecanico.js',
  '/js/views/cliente.js',
  '/js/views/cotizaciones.js',
  '/js/views/taller.js',
  '/js/views/taller-kpi.js',
  '/js/views/repuestos.js',
  '/js/views/reportes.js',
  '/js/views/encuestas.js',
  '/js/views/metas.js',
  '/js/views/ventas.js',
  '/js/views/flotillas.js',
  '/js/views/aseguradoras.js',
  '/js/views/cartera-cliente.js',
  '/js/views/consumibles.js',

  // Bootstrap
  '/js/core/app.js'
];

// Hosts externos que siempre van por red
const EXTERNAL_HOSTS = [
  'supabase.co',
  'supabase.in',
  'googleapis.com',
  'cdnjs.cloudflare.com',
  'telegram.org',
  'api.telegram.org'
];

function isExternal(url) {
  try {
    const { hostname } = new URL(url);
    return EXTERNAL_HOSTS.some(h => hostname.includes(h));
  } catch {
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const method = request.method.toUpperCase();

  // Red exclusiva: métodos mutantes o requests externos
  if (method !== 'GET' || isExternal(request.url)) {
    event.respondWith(fetch(request));
    return;
  }

  // El documento HTML (navegación) va NETWORK-FIRST: tras un deploy —sobre todo
  // si cambió la estructura de archivos— el index.html siempre será el actual y
  // referenciará los .js/.css correctos. Evita servir una mezcla vieja/nueva
  // (causa del error "Cannot access 'API_METHODS' before initialization").
  // Si no hay red, cae a la caché.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // STALE-WHILE-REVALIDATE para assets locales GET (CSS/JS):
  // responde al instante desde la caché (rápido) y, en paralelo, baja la
  // versión nueva para actualizar la caché de cara a la próxima carga.
  // Equilibrio ideal: rápido como cache-first y se actualiza solo.
  event.respondWith(
    caches.match(request).then(cached => {
      const red = fetch(request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || red;
    })
  );
});
