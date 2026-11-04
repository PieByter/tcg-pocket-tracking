// Service worker PocketLedger:
// - aset statis Next (immutable) dan thumbnail kartu di-cache agar kunjungan berikutnya cepat;
// - halaman HTML selalu network-only supaya data pribadi tidak tersaji basi;
// - saat offline, navigasi menampilkan halaman offline ringan (tanpa data).
const VERSION = "pocketledger-v1";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const IMAGE_LIMIT = 500;

const OFFLINE_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline — PocketLedger</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f131d;
    color: #dfe2f1; font-family: ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 24px; }
  .card { max-width: 380px; border: 1px solid rgba(255,255,255,.08); background: rgba(23,27,38,.85);
    border-radius: 12px; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 6px; color: #bcc9cd; font-size: 14px; line-height: 1.5; }
  button { margin-top: 16px; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600;
    background: #06b6d4; color: #003640; cursor: pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>Kamu sedang offline</h1>
    <p>PocketLedger butuh koneksi untuk memuat data terbaru.</p>
    <p>You are offline — reconnect to load fresh data.</p>
    <button onclick="location.reload()">Coba lagi / Retry</button>
  </div>
</body>
</html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  const isStatic =
    url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
  const isCardImage =
    request.destination === "image" &&
    url.hostname === "raw.githubusercontent.com" &&
    url.pathname.includes("/pokemon-tcg-exchange/");

  if (!isStatic && !isCardImage) return;

  event.respondWith(cacheFirst(request, isStatic ? STATIC_CACHE : IMAGE_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (cacheName === IMAGE_CACHE) void prune(cache);
  }
  return response;
}

async function prune(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - IMAGE_LIMIT).map((key) => cache.delete(key)));
}
