/* Teste da simulação com os poderes: IA x IA em todas as raças, cada poder usado pelo menos uma vez, sem exceções/NaN */
const sim = require("../server/sim.js"); const { RACES, POWERS, Powers, AI, makePvP, CFG } = sim;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FALHA:", m); } };
const used = {}; const wins = {};
function fight(ra, rb, pa, pb, tier) {
  const ch = (r, p, n) => ({ name: n, raceKey: r, clanKey: "chama", outfit: "#ff0000", hair: "#00ff00", aura: "#0000ff", accessory: "none", body: sim.BODY.sanitize(null), powers: p });
  const m = makePvP([ch(ra, pa, "A"), ch(rb, pb, "B")], "temple");
  for (const f of m.fighters) { f.ai = AI.make(tier); }
  let n = 0; while (m.state !== "over" && n < 60 * 140) {
    for (const f of m.fighters) { AI.think(f, 1 / 60, m); }
    m.update(1 / 60); n++;
    for (const f of m.fighters) {
      if (f.act && f.act.type === "skill") { const id = f.act.pid || "race_" + f.raceKey; used[id] = (used[id] || 0) + 1; }
      for (const k of ["x", "y", "hp", "ki"]) if (!Number.isFinite(f[k])) { ok(false, "NaN em " + k + " " + ra + "/" + rb); return null; }
      if (f.hp > f.stats.hp + .01) ok(false, "hp acima do máximo");
    }
  }
  return m;
}
const races = Object.keys(RACES), eq = Powers.list();
ok(races.length === 12, "12 raças"); ok(eq.length === 19, "19 poderes equipáveis, tem " + eq.length);
for (const r of races) ok(RACES[r].skill && POWERS[RACES[r].skill.id], "skill registrada " + r);
// matriz raça x raça (2 partidas cada, poderes aleatórios)
for (const a of races) for (const b of races) for (let i = 0; i < 2; i++) {
  const m = fight(a, b, Powers.random(2), Powers.random(2), .8); if (!m) continue;
  ok(m.state === "over", "terminou " + a + " x " + b);
  const w = m.winner; if (w >= 0) { const r = w === 0 ? a : b; wins[r] = (wins[r] || 0) + 1; }
}
// cada equipável usado ao menos uma vez (duelo de IA com o poder equipado)
for (const id of eq) for (let i = 0; i < 4 && !used[id]; i++) fight("ignar", "mutante", [id, ""], [id, ""], .9);
for (const id of eq.concat(races.map(r => RACES[r].skill.id))) ok(used[id] > 0, "poder nunca usado pela IA: " + id);
console.log("vitórias por raça:", JSON.stringify(wins));
// poderes isolados
const one = (id, who) => { const m = makePvP([{ name: "A", raceKey: "ignar", clanKey: "chama", outfit: "#f00000", hair: "#00ff00", aura: "#0000ff", accessory: "none", body: sim.BODY.sanitize(null), powers: [id, ""] }, { name: "B", raceKey: "mutante", clanKey: "chama", outfit: "#f00000", hair: "#00ff00", aura: "#0000ff", accessory: "none", body: sim.BODY.sanitize(null), powers: ["", ""] }], "temple"); while (m.state !== "fight") m.update(1 / 60); return m; };
let m = one("curar"); m.fighters[0].hp = 50; m.fighters[0].press("p1"); for (let i = 0; i < 90; i++) m.update(1 / 60); ok(m.fighters[0].hp > 60, "curar cura " + m.fighters[0].hp);
m = one("barreira"); m.fighters[0].press("p1"); for (let i = 0; i < 40; i++) m.update(1 / 60); ok(m.fighters[0].shield > 0, "barreira"); const before = m.fighters[0].hp; sim.Combat.hit(m.fighters[1], m.fighters[0], { type: "melee", damage: 10, knock: 0, stun: .1, launch: 0, hitstop: 0, fromX: 0, step: 1 }); ok(m.fighters[0].hp === before, "barreira absorve");
m = one("contra"); m.fighters[0].press("p1"); for (let i = 0; i < 25; i++) m.update(1 / 60); const hp0 = m.fighters[0].hp; sim.Combat.hit(m.fighters[1], m.fighters[0], { type: "melee", damage: 10, knock: 0, stun: .1, launch: 0, hitstop: 0, fromX: 0, step: 1 }); ok(m.fighters[0].hp === hp0 && m.fighters[1].stun > .4, "contra-ataque");
m = one("furia"); m.fighters[0].press("p1"); for (let i = 0; i < 40; i++) m.update(1 / 60); ok(m.fighters[0].st.rage > 4, "fúria");
m = one("dardo"); m.fighters[0].x = 100; m.fighters[1].x = 160; m.fighters[0].press("p1"); for (let i = 0; i < 100; i++) m.update(1 / 60); ok(m.fighters[1].poison || m.fighters[1].hp < m.fighters[1].stats.hp, "dardo envenena");
m = one("selo"); m.fighters[0].x = 100; m.fighters[1].x = 160; const ki1 = m.fighters[1].ki; m.fighters[0].press("p1"); for (let i = 0; i < 60; i++) m.update(1 / 60); ok(m.fighters[1].cd.blast > 1, "selo adia rajada");
// saneamento
ok(JSON.stringify(Powers.sanitize(["faisca", "faisca"])) === '["faisca",""]', "sem duplicados"); ok(JSON.stringify(Powers.sanitize(["prisao", "x"])) === '["",""]', "exclusivo não equipa"); ok(JSON.stringify(Powers.sanitize(null)) === '["",""]', "null");
const snap = sim.pvpSnap(m, false); ok(JSON.stringify(snap).length < 2500, "snapshot pequeno " + JSON.stringify(snap).length);
console.log(fails ? fails + " falhas" : "TODOS OS TESTES DE PODERES OK"); process.exit(fails ? 1 : 0);
