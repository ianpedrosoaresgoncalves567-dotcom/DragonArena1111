
/* =====================================================================
 *  PARTIDA JOGADOR x JOGADOR (autoritativa, roda no servidor)
 *  Reaproveita Fighter/Combat/Match do jogo offline. Nada de IA, XP,
 *  créditos ou melhorias da loja: ranqueada usa atributos normalizados.
 * ===================================================================== */
const RANKED_LEVEL = 10;
const PRESS_OK = { attack: 1, blast: 1, dash: 1, awaken: 1, race: 1, p1: 1, p2: 1, jump: 1 };

function makePvP(chars, arena) {
  const m = Object.create(Match.prototype);
  m.profile = null; m.tourney = null; m.hard = false; m.character = chars[0]; m.arena = arena;
  m.fighters = chars.map((c, i) => new Fighter({
    id: i, name: c.name, isPlayer: true, raceKey: c.raceKey, clanKey: c.clanKey, stats: StatBuilder.build(c.raceKey, c.clanKey, RANKED_LEVEL),
    look: { outfit: c.outfit, hair: c.hair, aura: c.aura, accessory: c.accessory, body: c.body }, powers: c.powers, x: i ? 225 : 95, face: i ? -1 : 1
  }));
  m.player = m.fighters[0]; m.enemy = m.fighters[1];
  for (const f of m.fighters) f.m = m;
  m.player.opp = m.enemy; m.enemy.opp = m.player;
  Object.assign(m, { state: "intro", introT: 0, koT: 0, timeLeft: CFG.ROUND_TIME, hitstopT: 0, projectiles: [], result: null, tick: 0, timeUp: false, fightBannerShown: false, winner: null, endType: null, elapsed: 0 });
  m.st = [{ dealt: 0, taken: 0, combo: 0 }, { dealt: 0, taken: 0, combo: 0 }];
  m.prevHp = m.fighters.map(f => f.hp);
  m.finish = function (res) {
    if (this.result) return; this.result = res;
    if (this.endType !== "ko") { this.endType = res === "draw" ? "draw" : "time"; this.winner = res === "win" ? 0 : res === "lose" ? 1 : -1; }
  };
  const baseKO = Match.prototype.knockout;
  m.knockout = function (loser, winner) { if (this.state !== "fight") return; this.endType = "ko"; this.winner = winner.id; baseKO.call(this, loser, winner); };
  m.forfeit = function (slot) {                                   // abandono: o outro lado vence imediatamente
    if (this.result) return; this.endType = "forfeit"; this.winner = 1 - slot; this.result = slot === 0 ? "lose" : "win"; this.state = "over";
  };
  m.update = function (dt) {
    if (this.hitstopT > 0) { this.hitstopT -= dt; return; }
    this.tick++; const real = dt; this.elapsed += real;
    if (this.state === "ko" && this.koT < 1.0) dt *= .4;
    if (this.state === "intro") {
      this.introT += dt;
      if (!this.fightBannerShown && this.introT >= CFG.INTRO_TIME - .6) { this.fightBannerShown = true; Sound.play("fight"); }
      if (this.introT >= CFG.INTRO_TIME) this.state = "fight";
    }
    if (this.state === "fight") { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.endByTime(); } }
    else for (const f of this.fighters) { f.intent.moveX = 0; f.intent.guard = false; }
    const order = this.tick % 2 ? [this.player, this.enemy] : [this.enemy, this.player];
    for (const f of order) f.step(dt, this);
    if (this.state === "fight") { Combat.resolve(this); Combat.updateProjectiles(this, dt); }
    this.separate();
    for (let i = 0; i < 2; i++) {                                  // estatísticas da partida (para a pontuação)
      const f = this.fighters[i], drop = this.prevHp[i] - f.hp;
      if (drop > 0) { this.st[i].taken += drop; this.st[1 - i].dealt += drop; }
      this.prevHp[i] = f.hp; this.st[i].combo = Math.max(this.st[i].combo, f.chainHits);
    }
    if (this.state === "ko") { this.koT += real; if (this.koT >= CFG.KO_TIME) this.state = "over"; }
  };
  return m;
}

const r1 = v => Math.round(v * 10) / 10;
/* Entradas do jogador (só movimento e botões válidos; nada de estado do cliente é confiável) */
function pvpInput(m, slot, mx, g) { const f = m.fighters[slot]; f.intent.moveX = mx > 0 ? 1 : mx < 0 ? -1 : 0; f.intent.guard = !!g; }
function pvpPress(m, slot, a) { if (PRESS_OK[a] === 1) m.fighters[slot].press(a); }

/* Foto do estado para os clientes: somente o que o renderizador/HUD precisa */
function fighterSnap(f) {
  let act = null; if (f.act) { act = {}; for (const k in f.act) if (k !== "mv") act[k] = typeof f.act[k] === "number" ? r1(f.act[k] * 1000) / 1000 : f.act[k]; }
  return {
    x: r1(f.x), y: r1(f.y), vx: Math.round(f.vx), vy: Math.round(f.vy), face: f.face, g: f.onGround ? 1 : 0, hp: r1(f.hp), ki: r1(f.ki), stun: r1(f.stun * 100) / 100, inv: f.invuln > 0 ? 1 : 0,
    hf: f.hitFlash > 0 ? 1 : 0, gd: f.guarding ? 1 : 0, lt: f.landT > 0 ? 1 : 0, aw: r1(f.awakenT), ar: r1(f.armorT), hid: f.hidden ? 1 : 0, ko: f.ko ? 1 : 0, kt: r1(f.koT), vic: f.victory ? 1 : 0,
    cs: f.comboStep, ct: r1(f.comboTimer), ch: f.chainHits, cht: r1(f.chainTimer), burn: f.burn ? 1 : 0, po: f.poison ? 1 : 0, sh: r1(f.shield), st: Object.keys(f.st).reduce((o, k) => { if (f.st[k] > 0) o[k] = r1(f.st[k]); return o; }, {}),
    cd: { blast: r1(f.cd.blast), dash: r1(f.cd.dash), awaken: r1(f.cd.awaken), race: r1(f.cd.race), p1: r1(f.cd.p1), p2: r1(f.cd.p2) }, act
  };
}
function pvpSnap(m, withEvents) {
  return {
    t: "snap", n: m.tick, s: m.state, tl: r1(m.timeLeft), f: [fighterSnap(m.fighters[0]), fighterSnap(m.fighters[1])],
    p: m.projectiles.map(p => ({ x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy || 0), r: p.r, c: p.color, o: p.owner.id })),
    e: withEvents ? NetRec.take() : undefined
  };
}
