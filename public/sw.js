/* CPS Fit · service worker (sin dependencias).
   - Estáticos (_next/static, iconos, marca): cache-first.
   - Páginas de /app: network-first con copia en caché para verlas sin conexión.
   - Datos de Supabase NO se cachean aquí: los entrenos pendientes viven en IndexedDB (cola de sincronización). */
const VERSION = 'cpsfit-v2'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add('/offline.html')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')
  if (isStatic) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Solo navegaciones HTML (las peticiones RSC de Next no se cachean: colisionarían con el HTML de la misma URL).
  if (req.mode === 'navigate' && !req.headers.get('RSC')) {
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(req, { ignoreVary: true, ignoreSearch: true })) || (await caches.match('/offline.html'))),
    )
  }
})

// La app pide precachear las pantallas clave (rutina y entreno) para usarlas sin cobertura.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache') return
  event.waitUntil(
    caches.open(PAGES).then((cache) =>
      Promise.all(
        (event.data.urls || []).map((u) =>
          fetch(u, { credentials: 'same-origin' })
            .then((res) => (res.ok && !res.redirected ? cache.put(u, res) : null))
            .catch(() => null),
        ),
      ),
    ),
  )
})
