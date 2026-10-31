"use strict";
/* Service worker gerado por build.py (a versão muda a cada build, então atualizações chegam sozinhas). */
const VERSION = "__VERSION__", CACHE = "dragon-arena-" + VERSION;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-48.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("dragon-arena-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* Página: rede primeiro (pega a versão nova), mas se demorar mais de 2,5 s ou estiver offline abre a cópia guardada.
   Assim o jogo abre na hora mesmo com o servidor gratuito "dormindo". Ícones e manifesto: cache primeiro. */
async function page(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(r => { if (r.ok) cache.put("/", r.clone()); return r; });
  net.catch(() => { });
  try { return await Promise.race([net, new Promise((_, rej) => setTimeout(rej, 2500))]); }
  catch (e) { const c = await cache.match("/"); return c || net; }
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === "/health") return;
  if (req.mode === "navigate") { e.respondWith(page(req)); return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
});
