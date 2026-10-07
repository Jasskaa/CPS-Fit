/* CPS Fit · service worker (sin dependencias).
   - Estáticos (_next/static, iconos, marca): cache-first.
   - Páginas de /app: network-first con copia en caché para verlas sin conexión.
   - Datos de Supabase NO se cachean aquí: los entrenos pendientes viven en IndexedDB (cola de sincronización). */
const VERSION = 'cpsfit-v1'
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

  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html') || req.headers.get('RSC')) {
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
        .catch(async () => (await caches.match(req)) || (await caches.match('/offline.html'))),
    )
  }
})
