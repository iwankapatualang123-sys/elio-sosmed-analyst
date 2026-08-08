// File: public/sw.js
// Service worker PWA: caching untuk akses offline/koneksi lemah (blueprint bagian 11).
// PENTING (perbaikan konten basi): navigasi halaman SELALU ambil dari jaringan tanpa
// cache HTTP (no-store) supaya sehabis deploy langsung tampil versi baru — cache
// hanya dipakai sebagai cadangan saat OFFLINE. Aset statis ber-hash (/_next/static)
// aman cache-first (nama file berubah tiap build). API & non-GET tidak pernah dicache.
//
// Naikkan versi CACHE tiap kali strategi berubah supaya cache lama dibersihkan saat
// 'activate', dan versi baru mengambil alih (skipWaiting + clients.claim). Halaman
// akan auto-reload sekali lewat components/ServiceWorkerRegister.jsx.

const CACHE = "elio-v3";
const PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Aset yang aman di-cache (nama ber-hash / ikon statis).
function isCacheableAsset(url) {
  return url.pathname.startsWith("/_next/static/")
    || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
    || url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // data dinamis: jangan diintervensi

  // Navigasi halaman: JARINGAN DULU tanpa cache HTTP (selalu versi terbaru).
  // Simpan salinan hanya untuk cadangan offline; saat offline pakai cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/login"))),
    );
    return;
  }

  // Aset statis ber-hash: cache-first (cepat & aman).
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
        }
        return res;
      })),
    );
    return;
  }

  // Selain itu (mis. RSC/data): jaringan dulu, cache hanya cadangan offline.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
