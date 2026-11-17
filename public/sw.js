// Service worker "Untuk Dilla": hanya untuk notifikasi (Web Push).
// Sengaja TIDAK meng-cache file, supaya update website langsung terlihat tanpa urusan cache.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Untuk Dilla', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Untuk Dilla'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const same = all.find((c) => new URL(c.url).origin === url.origin)
      if (same) {
        // Tab/app sudah terbuka: pindah scene tanpa reload (lihat main.ts).
        same.postMessage({ type: 'buka', scene: url.searchParams.get('buka') })
        return same.focus()
      }
      return self.clients.openWindow(url.href)
    })(),
  )
})
