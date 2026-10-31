"use strict";
const { ok, boot, sleep, summary } = require("./helpers");
const { chromium } = require("playwright");
(async () => {
  const { srv, port } = await boot(); const base = "http://127.0.0.1:" + port;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } }); const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "/"); await p.waitForTimeout(500);
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); return { status: r.status, type: r.headers.get("content-type"), j: await r.json() }; });
  ok(man.status === 200 && /manifest/.test(man.type) && man.j.name === "Dragon Arena" && man.j.icons.length === 3, "manifesto é servido e válido");
  const ic = await p.evaluate(async icons => Promise.all(icons.map(async i => { const r = await fetch(i.src); const bl = await r.blob(); return [r.status, bl.type, bl.size]; })), man.j.icons);
  ok(ic.every(x => x[0] === 200 && x[1] === "image/png" && x[2] > 1000), "os 3 ícones carregam (PNG)");
  ok((await p.evaluate(() => fetch("/icons/../server/sim.js").then(r => r.status))) === 404 && (await p.evaluate(() => fetch("/server/sim.js").then(r => r.status))) === 404, "arquivos do servidor não são expostos");
  await p.evaluate(() => navigator.serviceWorker.ready); const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); });
  ok(reg, "service worker registrado e ativo");
  await sleep(600); const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return (await c.keys()).length; }); ok(cached >= 6, "arquivos do app guardados no cache (" + cached + ")");
  await p.reload(); await p.waitForTimeout(500);                                   // agora a página é controlada pelo SW
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  ok((await p.title()).includes("Dragon Arena") && await p.evaluate(() => !!window.DragonArena && !!window.DragonArena.Game), "com a internet cortada o jogo abre pelo cache");
  await p.click("#startBtn"); await p.waitForTimeout(2500); ok(await p.evaluate(() => window.DragonArena.Game.match && window.DragonArena.Game.match.state === "fight"), "e dá para jogar offline (luta contra o computador)");
  await ctx.setOffline(false);
  ok(errs.length === 0, "nenhum erro de página" + (errs.length ? ": " + errs[0] : ""));
  await b.close(); await srv.stop(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.error("ERRO NO TESTE PWA:", e); process.exit(2); });
