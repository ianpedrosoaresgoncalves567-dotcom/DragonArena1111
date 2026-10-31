"use strict";
/* Fila vazia: depois de 20 s aparece "Treinar contra o computador" e ele inicia uma luta offline */
const { ok, sleep, boot, summary } = require("./helpers"); const { chromium } = require("playwright");
(async () => {
  const { srv, port } = await boot({ graceMs: 3000 }); const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://127.0.0.1:" + port + "/"); await p.click("#tabbtn-online");
  await p.waitForFunction(() => document.getElementById("onStatus").textContent.includes("Conectado"), null, { timeout: 8000 });
  await p.fill("#onUser", "solo"); await p.fill("#onPass", "senha123"); await p.click("#onRegister");
  await p.waitForFunction(() => !document.getElementById("onHome").classList.contains("hidden"), null, { timeout: 8000 });
  await p.click("#onQueue"); await sleep(1500); ok(await p.locator("#onBot").isHidden(), "botão do computador escondido no começo da fila");
  await sleep(20000); ok(await p.locator("#onBot").isVisible(), "após 20 s aparece 'Treinar contra o computador'");
  ok(/online/.test(await p.textContent("#onQueueInfo")), "mostra quantos jogadores online");
  await p.click("#onBot"); await p.waitForFunction(() => !document.getElementById("battle").classList.contains("hidden"), null, { timeout: 5000 }); await sleep(2500);
  ok(await p.evaluate(() => DragonArena.Game.match && DragonArena.Game.match.state === "fight" && !DragonArena.Online.active), "luta offline começou");
  await sleep(500); const q = await p.evaluate(() => ({ s: DragonArena.Online.status })); ok(q.s !== "queued", "saiu da fila (" + q.s + ")");
  ok(errs.length === 0, "sem erros de página " + errs.join("|"));
  await b.close(); srv.close && srv.close(); summary(); process.exit(0);
})();
