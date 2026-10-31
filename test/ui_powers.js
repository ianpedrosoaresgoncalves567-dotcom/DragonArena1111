const { chromium } = require("playwright"); const path = require("path");
const URL = "file://" + path.resolve(__dirname, "../public/index.html"), OUT = path.join(__dirname, "shots"); require("fs").mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FALHA ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 1000 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(300);
  ok(await p.locator("#raceList .choice").count() === 12, "12 raças na lista");
  ok(await p.locator("#powList .choice").count() === 19, "19 poderes na lista");
  await p.click("#tabbtn-powers"); await p.click('#powList [data-key="faisca"]'); await p.click('#powSlots [data-slot="1"]'); await p.click('#powList [data-key="barreira"]');
  ok(/Faísca/.test(await p.locator("#powSlots .choice").nth(0).innerText()) && /Barreira/.test(await p.locator("#powSlots .choice").nth(1).innerText()), "dois poderes equipados");
  await p.screenshot({ path: path.join(OUT, "powers_tab.png") });
  await p.click("#tabbtn-char"); await p.click('#raceList [data-key="draconico"]'); await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, "race_draconico.png") });
  await p.click("#startBtn"); await p.waitForTimeout(2600);
  ok(await p.locator("#skP1").isVisible() && await p.locator("#skP2").isVisible(), "HUD mostra os 2 poderes");
  ok((await p.locator("#skRaceName").innerText()) === "Sopro dracônico", "HUD racial = Sopro dracônico");
  await p.evaluate(() => { const e = DragonArena.Game.match.enemy; e.x = 300; e.stun = 4; });
  await p.keyboard.press("1"); await p.waitForTimeout(500); await p.keyboard.press("2"); await p.waitForTimeout(250);
  const st = await p.evaluate(() => { const m = DragonArena.Game.match, f = m.player; return { cd1: f.cd.p1, cd2: f.cd.p2, shield: f.shield, proj: m.projectiles.length }; });
  ok(st.cd1 > 0 && st.cd2 > 0, "teclas 1 e 2 dispararam os poderes " + JSON.stringify(st));
  await p.screenshot({ path: path.join(OUT, "fight_powers.png") });
  await p.waitForTimeout(600); await p.keyboard.press("h"); await p.waitForTimeout(400); ok(await p.evaluate(() => DragonArena.Game.match.player.cd.race > 0), "tecla H (racial) funciona");
  // persistência: recarregar mantém os poderes
  await p.evaluate(() => DragonArena.Save.write(DragonArena.Game.profile)); await p.reload(); await p.waitForTimeout(300);
  const eq = await p.evaluate(() => DragonArena.UI.sel.powers); ok(eq[0] === "faisca" && eq[1] === "barreira", "poderes persistem após recarregar " + JSON.stringify(eq));
  // todas as raças desenham sem erro
  await p.evaluate(() => { for (const k of Object.keys(DragonArena.RACES)) { DragonArena.UI.pickRace(k); } });
  ok(errs.length === 0, "sem erros de página " + errs.join(" | "));
  // mobile
  await p.setViewportSize({ width: 390, height: 800 }); await p.click("#tabbtn-powers"); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem overflow horizontal no celular");
  await p.screenshot({ path: path.join(OUT, "powers_mobile.png") });
  await b.close(); console.log(fails ? fails + " falhas" : "UI PODERES OK"); process.exit(fails ? 1 : 0);
})();
