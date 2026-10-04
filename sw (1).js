// Service worker: lets the app open without reception and loads fast.
// Bump VERSION whenever you upload a new version, so phones pick it up.
const VERSION = "v3";
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_FILES = [
  "./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Data and sign-in always go to the network; never serve stale workouts from cache.
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return;

  // The app itself: try the network first (to get updates), fall back to the saved copy offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      // "no-cache" asks GitHub whether the file changed, instead of reusing the browser's copy for 10 minutes
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Fonts and the Supabase library from the CDN: serve the saved copy, refresh in the background.
  if (/(^|\.)(jsdelivr\.net|googleapis\.com|gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});
