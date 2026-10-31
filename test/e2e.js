"use strict";
/* Teste de ponta a ponta no navegador: dois jogadores reais (duas páginas) contra o servidor real */
const { ok, sleep, boot, summary } = require("./helpers");
const { chromium } = require("playwright");
(async () => {
  const { srv, port } = await boot({ graceMs: 3000 });
  const b = await chromium.launch(); const errs = [];
  const mk = async name => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on("pageerror", e => errs.push(name + ": " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push(name + " console: " + m.text()); }); await p.goto("http://127.0.0.1:" + port + "/"); await p.waitForTimeout(400); return p; };
  const A = await mk("A"), B = await mk("B");
  for (const [p, u] of [[A, "ana"], [B, "beto"]]) {
    await p.click("#tabbtn-online"); await p.waitForFunction(() => document.getElementById("onStatus").textContent.includes("Conectado"), null, { timeout: 8000 });
    await p.fill("#onUser", u); await p.fill("#onPass", "senha123"); await p.click("#onRegister");
    await p.waitForFunction(() => !document.getElementById("onHome").classList.contains("hidden"), null, { timeout: 8000 });
  }
  ok(true, "duas contas criadas pela interface"); ok((await A.textContent("#onRank")) === "Bronze II" && (await A.textContent("#onPts")) === "1000 pts", "perfil mostra Bronze II · 1000 pts");
  await B.click("#tabbtn-body"); await B.click('#bodyBox .mini button[data-key="fem"]'); await B.click("#tabbtn-online");
  await A.click("#tabbtn-char"); await A.click('#raceList [data-key="glacial"]'); await A.click("#tabbtn-powers"); await A.click('#powList [data-key="meteoros"]'); await A.click("#tabbtn-online");
  await A.click("#onQueue"); await sleep(300); ok((await A.textContent("#onQueueInfo")).includes("Procurando"), "tela mostra que está procurando partida"); await B.click("#onQueue");
  await A.waitForFunction(() => !document.getElementById("battle").classList.contains("hidden"), null, { timeout: 12000 }); await B.waitForFunction(() => !document.getElementById("battle").classList.contains("hidden"), null, { timeout: 12000 });
  ok(true, "os dois entram na arena online");
  const names = await A.evaluate(() => [document.getElementById("pName").textContent, document.getElementById("eName").textContent]); ok(names.join() === "ana,beto", "HUD mostra os dois nomes (o meu à esquerda)");
  await A.waitForFunction(() => window.DragonArena.Online.view && window.DragonArena.Online.view.state === "fight", null, { timeout: 8000 }); ok(true, "a luta começa (estado vindo do servidor)");
  await sleep(2500); await A.screenshot({ path: "test/e2e_A.png" }); await B.screenshot({ path: "test/e2e_B.png" });
  const px = await A.evaluate(() => { const c = document.getElementById("gameCanvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 30) n++; return n; }); ok(px > 200, "o canvas está desenhando a luta");
  await sleep(2400); await A.keyboard.press("1"); await sleep(900);
  const pw = await A.evaluate(() => { const v = window.DragonArena.Online.view; return { cd: v.player.cd.p1, hud: document.getElementById("skP1").style.display !== "none", name: document.getElementById("skP1Name").textContent, race: document.getElementById("skRaceName").textContent, proj: v.projectiles.length, vy: v.projectiles.some(p => p.vy > 0) }; });
  ok(pw.cd > 5 && pw.hud && pw.name === "Chuva de meteoros" && pw.race === "Prisão de gelo", "poder equipado funciona online pelo teclado: " + JSON.stringify(pw));
  // Ana ataca pelo teclado real; Beto fica parado
  let stop = false; (async () => { while (!stop) { const dir = await A.evaluate(() => { const v = window.DragonArena.Online.view; return v && v.enemy.x > v.player.x ? 1 : -1; }); const key = dir > 0 ? "KeyD" : "KeyA", other = dir > 0 ? "KeyA" : "KeyD"; await A.keyboard.up(other); await A.keyboard.down(key); await A.keyboard.press("KeyJ"); await sleep(110); } })();
  await A.waitForFunction(() => /VIT|DERROTA|EMPATE/.test(document.getElementById("bannerTitle").textContent), null, { timeout: 90000 }); stop = true; await A.keyboard.up("KeyA"); await A.keyboard.up("KeyD");
  await B.waitForFunction(() => /VIT|DERROTA|EMPATE/.test(document.getElementById("bannerTitle").textContent), null, { timeout: 10000 });
  const ta = await A.textContent("#bannerTitle"), tb = await B.textContent("#bannerTitle"), sa = await A.textContent("#bannerSub"); ok(ta === "VITÓRIA" && tb === "DERROTA", "Ana vê VITÓRIA e Beto vê DERROTA"); ok(/pts/.test(sa) && /Dano causado/.test(sa), "resultado mostra pontos e detalhes: " + sa.split("\n")[0]);
  await A.screenshot({ path: "test/e2e_result.png" });
  await A.click("#banner .btns button:nth-child(2)"); await sleep(400); await A.click("#tabbtn-online"); await sleep(600);
  const ptsA = await A.textContent("#onPts"); ok(+ptsA.replace(/\D/g, "") > 1000, "pontos da Ana subiram: " + ptsA); ok((await A.textContent("#onLb")).includes("ana"), "ranking lista a Ana");
  ok(/KO|nocaute|V ·/.test(await A.textContent("#onHist")), "histórico registrou a partida");
  ok(errs.length === 0, "nenhum erro de página/console" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""));
  await b.close(); await srv.stop(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.error("ERRO NO E2E:", e); process.exit(2); });
