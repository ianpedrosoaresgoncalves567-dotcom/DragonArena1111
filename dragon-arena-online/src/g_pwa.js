
/* ---------- App instalável (PWA): service worker + botão "Instalar app" ---------- */
const PWA = {
  deferred: null,
  init() {
    if (!/^https?:$/.test(location.protocol)) return;                       // só quando servido por http(s)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => { });
    const btn = $("installBtn");
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); this.deferred = e; btn.classList.remove("hidden"); });
    window.addEventListener("appinstalled", () => { this.deferred = null; btn.classList.add("hidden"); });
    btn.addEventListener("click", async () => {
      if (this.deferred) { this.deferred.prompt(); try { await this.deferred.userChoice; } catch (e) { } this.deferred = null; btn.classList.add("hidden"); }
      else alert("No iPhone/iPad: toque em Compartilhar e depois em \"Adicionar à Tela de Início\".");
    });
    const standalone = window.matchMedia && matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) btn.classList.remove("hidden");   // iOS não dispara beforeinstallprompt
  }
};
