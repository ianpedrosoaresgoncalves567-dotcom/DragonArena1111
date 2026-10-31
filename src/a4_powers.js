
/* =====================================================================
 *  PODERES
 *  Cada poder é um objeto de dados + funções (start/fire/tick) que usam
 *  os auxiliares de `Powers`. Dois tipos:
 *    - exclusivo (excl: true): poder da raça, fica no slot "race" (tecla H)
 *    - equipável: o jogador escolhe até 2 na aba Poderes (slots p1/p2)
 *  Mesma simulação no jogo offline e no servidor ranqueado.
 *  Campos: cost, cd, startup, end, pose (blast|slam|buff), rng:[min,max]
 *  (distância em que a IA usa), need ("low" vida baixa, "threat" rival
 *  atacando, "self" sempre ok perto do rival).
 * ===================================================================== */
const STATUS_INFO = {
  slow: { icon: "🐌", name: "Lento", color: "#9fe8ff" }, haste: { icon: "💨", name: "Veloz", color: "#b6ff8a" }, rage: { icon: "😡", name: "Fúria", color: "#ff6a5a" },
  weak: { icon: "📉", name: "Enfraquecido", color: "#b06cff" }, ward: { icon: "🔰", name: "Barreira", color: "#8fd0ff" }, counter: { icon: "↩️", name: "Contra-ataque", color: "#ffe08a" },
  vamp: { icon: "🩸", name: "Vampirismo", color: "#ff4a6a" }
};

const Powers = {
  give(f, k, t) { f.st[k] = Math.max(f.st[k] || 0, t); },
  heal(f, amt) { const a = Math.min(amt, f.stats.hp - f.hp); if (a <= 0) return; f.hp += a; FX.text(f.x, f.y - 44, "+" + Math.max(1, R(a)), "#7ef0a1", 8); FX.ember(f.x, f.y - 14, "#7ef0a1", 4); },
  shoot(f, m, o) {
    const mods = f.stats.mods, p = Object.assign({ x: f.x + f.face * 12, y: f.y - 26, vx: f.face * 190, vy: 0, owner: f, r: 4, life: 2.2, dmg: 9, color: f.palette.aura, trail: 0 }, o);
    if (!o.raw) p.dmg *= mods.blastDmgMul; delete p.raw; m.projectiles.push(p); return p;
  },
  /* golpe corpo a corpo instantâneo numa caixa à frente */
  strike(f, m, box, par, on) {
    const d = f.opp; if (d.ko || d.invuln > 0) return false;
    if (!Combat.overlap(Combat.boxOf(f, box), Combat.hurtbox(d))) return false;
    return Combat.hit(f, d, Object.assign({ type: "melee", fromX: f.x, y: f.y - 24, launch: 0, hitstop: .06, step: 2, shake: 3, on }, par));
  },
  applyOn(att, def, on, dmg) {
    if (on.slow) this.give(def, "slow", on.slow);
    if (on.weak) this.give(def, "weak", on.weak);
    if (on.freeze) { def.stun = Math.max(def.stun, on.freeze * def.stats.mods.stunResist); def.act = null; def.guarding = false; FX.ring(def.x, def.y - 18, "#bff0ff", 18, .3, 1, 1); FX.text(def.x, def.y - 52, "CONGELADO", "#bff0ff", 6); }
    if (on.poison) { def.poison = { t: on.poison.t, dps: on.poison.dps * att.stats.damage, src: att }; FX.text(def.x, def.y - 52, "VENENO", "#9bff5a", 6); }
    if (on.burn) { def.burn = { t: on.burn.t, dps: on.burn.dps * att.stats.damage, src: att }; }
    if (on.steal) this.heal(att, dmg * on.steal);
    if (on.drain) { const a = Math.min(on.drain, def.ki); def.ki -= a; att.ki = Math.min(att.stats.ki, att.ki + a * .4); def.cd.blast += 2; def.cd.dash += 2; FX.text(def.x, def.y - 52, "SELADO", "#7fa8ff", 6); }
  },
  /* IA: este poder faz sentido agora? */
  aiOK(f, o, d, p) {
    if (p.need === "low") return f.hp < f.stats.hp * .65;
    if (p.need === "threat") return !!(o.act && o.act.type === "attack") && d < 46;
    if (p.need === "self") return d < 120;
    if (p.need === "ki") return o.ki > 30 && d < 190;
    const r = p.rng || [0, 200]; return d >= r[0] && d <= r[1];
  },
  list() { return Object.keys(POWERS).filter(k => !POWERS[k].excl); },
  sanitize(arr) {
    const out = ["", ""]; if (!Array.isArray(arr)) return out; let n = 0;
    for (const id of arr.slice(0, 2)) { const ok = typeof id === "string" && POWERS[id] && !POWERS[id].excl && !out.includes(id); out[n++] = ok ? id : ""; }
    return out;
  },
  random(n) { const l = this.list(), r = []; while (r.length < n && l.length) r.push(l.splice(Math.floor(Math.random() * l.length), 1)[0]); while (r.length < 2) r.push(""); return r; }
};

const defPower = (id, o) => { POWERS[id] = Object.assign({ id, kind: "cast", startup: .2, end: .5, pose: "blast" }, o); };
const POWERS = {};
const flare = (f, c, n) => { FX.ring(f.x, f.y - 18, c, 20, .3, 1, 2); FX.spark(f.x, f.y - 18, c, n || 12, 90, .4, 30); };

/* ---------- Equipáveis (lote 1) ---------- */
defPower("faisca", { name: "Faísca rápida", icon: "⚡", cost: 8, cd: 2.5, startup: .08, end: .25, text: "Projétil pequeno e veloz. Barato, serve para pressionar de longe.", tag: "Ataque", rng: [40, 200],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 340, r: 3, dmg: 6, life: 1.4, knock: 45, stun: .2 }); Sound.play("blast"); } });
defPower("esfera", { name: "Esfera pesada", icon: "🔮", cost: 26, cd: 8, startup: .35, end: .7, text: "Esfera lenta e enorme: 17 de dano, empurra forte e atordoa.", tag: "Ataque", rng: [70, 200],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 115, r: 9, dmg: 17, life: 3, knock: 140, stun: .4, hitstop: .08, big: true }); Sound.play("beam"); FX.ring(f.x + f.face * 12, f.y - 26, f.palette.auraL, 18, .3, 1, 2); } });
defPower("leque", { name: "Leque de energia", icon: "🪭", cost: 24, cd: 7, startup: .2, end: .5, text: "Três projéteis em leque; cobre o espaço à frente.", tag: "Ataque", rng: [30, 130],
  fire(f, m) { for (const vy of [-34, 0, 34]) Powers.shoot(f, m, { vx: f.face * 200, vy, r: 3, dmg: 5, life: 1.1, knock: 45, stun: .2 }); Sound.play("blast"); } });
defPower("mina", { name: "Mina de energia", icon: "💣", cost: 20, cd: 10, startup: .15, end: .4, pose: "slam", text: "Planta uma mina à frente (dura 7 s). Explode em quem encostar.", tag: "Armadilha", rng: [45, 120],
  fire(f, m) {
    const mine = m.projectiles.filter(p => p.owner === f && p.mine); if (mine.length >= 2) mine[0].dead = true;
    Powers.shoot(f, m, { x: clamp(f.x + f.face * 36, CFG.ARENA_L, CFG.ARENA_R), y: f.y - 7, vx: 0, r: 7, dmg: 13, life: 7, ghost: true, mine: true, knock: 90, stun: .45, hitstop: .06, color: "#ffd45e" }); Sound.play("armor"); FX.ring(f.x + f.face * 36, f.y - 4, "#ffd45e", 12, .25, 1, 1); } });
defPower("curar", { name: "Meditação", icon: "💚", cost: 30, cd: 22, startup: .3, end: .85, pose: "buff", need: "low", text: "Recupera 15% da vida máxima. Fique longe do rival: você fica parado.", tag: "Defesa",
  fire(f) { Powers.heal(f, f.stats.hp * .15); flare(f, "#7ef0a1"); Sound.play("heal"); } });
defPower("barreira", { name: "Barreira", icon: "🔰", cost: 28, cd: 16, startup: .15, end: .4, pose: "buff", need: "self", text: "Barreira que absorve 26 de dano por até 5 s.", tag: "Defesa",
  fire(f) { f.shield = 26; Powers.give(f, "ward", 5); flare(f, "#8fd0ff"); Sound.play("armor"); } });
defPower("furia", { name: "Fúria", icon: "😡", cost: 22, cd: 18, startup: .2, end: .45, pose: "buff", need: "self", text: "6 s causando 25% mais dano, mas recebendo 15% mais.", tag: "Reforço",
  fire(f) { Powers.give(f, "rage", 6); flare(f, "#ff6a5a"); Sound.play("awaken"); } });
defPower("passoVeloz", { name: "Passo veloz", icon: "💨", cost: 20, cd: 14, startup: .1, end: .3, pose: "buff", need: "self", text: "5 s com 30% mais velocidade de movimento.", tag: "Reforço",
  fire(f) { Powers.give(f, "haste", 5); flare(f, "#b6ff8a", 8); Sound.play("dash"); } });
defPower("toqueGelido", { name: "Toque gélido", icon: "❄️", cost: 20, cd: 9, startup: .15, end: .4, text: "Projétil gelado: 6 de dano e deixa o rival lento por 3 s.", tag: "Controle", rng: [40, 180],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 250, r: 4, dmg: 6, color: "#9fe8ff", on: { slow: 3 } }); Sound.play("blast"); } });
defPower("dardo", { name: "Dardo venenoso", icon: "🧪", cost: 18, cd: 8, startup: .12, end: .35, text: "Envenena: 4 s de dano contínuo (3 por segundo).", tag: "Controle", rng: [40, 190],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 280, r: 3, dmg: 3, color: "#9bff5a", on: { poison: { t: 4, dps: 3 } } }); Sound.play("blast"); } });
defPower("maldicao", { name: "Maldição", icon: "☠️", cost: 20, cd: 12, startup: .2, end: .45, text: "Projétil sombrio: o rival causa 25% menos dano por 5 s.", tag: "Controle", rng: [40, 190],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 230, r: 4, dmg: 3, color: "#b06cff", on: { weak: 5 } }); Sound.play("phase"); } });
defPower("contra", { name: "Contra-ataque", icon: "↩️", cost: 22, cd: 12, startup: .05, end: .35, pose: "buff", need: "threat", text: "Por 1,1 s, o próximo golpe é anulado: o rival fica atordoado e leva dano.", tag: "Defesa",
  fire(f) { Powers.give(f, "counter", 1.1); flare(f, "#ffe08a", 8); Sound.play("parry"); } });
defPower("sismo", { name: "Abalo sísmico", icon: "🌍", cost: 28, cd: 11, startup: .3, end: .6, pose: "slam", text: "Pancada no chão: lança no ar quem estiver perto e no chão.", tag: "Ataque", rng: [0, 64],
  fire(f, m) {
    FX.ring(f.x, f.y - 2, "#d9c59a", 60, .4, .22, 2); FX.spark(f.x, f.y - 2, "#d9c59a", 16, 110, .4, 40); FX.shake = Math.max(FX.shake, 5); Sound.play("pillar");
    const o = f.opp; if (o.onGround && Math.abs(o.x - f.x) < 70) Combat.hit(f, o, { type: "melee", damage: 10, knock: 100, stun: .5, launch: 90, hitstop: .07, fromX: f.x, y: o.y - 10, step: 3, shake: 5 });
  } });
defPower("gancho", { name: "Gancho de energia", icon: "🪝", cost: 18, cd: 10, startup: .25, end: .55, text: "Puxa o rival (até 140 de distância) para perto e o atordoa de leve.", tag: "Controle", rng: [70, 140],
  fire(f, m) {
    const o = f.opp; Sound.play("whooshH"); if (o.ko || o.invuln > 0 || Math.abs(o.x - f.x) > 140) { FX.text(f.x, f.y - 46, "Errou", "#aaa", 6); return; }
    FX.crescent(f.x + f.face * 10, f.y - 24, f.face, 26, -1, .2, f.palette.auraL); o.x = clamp(f.x + f.face * 22, CFG.ARENA_L, CFG.ARENA_R); o.kx = 0; o.act = null;
    Combat.hit(f, o, { type: "melee", damage: 5, knock: 10, stun: .4, launch: 0, hitstop: .05, fromX: f.x, y: o.y - 20, step: 1, shake: 2 });
  } });
defPower("repulsao", { name: "Repulsão", icon: "🌬️", cost: 14, cd: 8, startup: .1, end: .4, need: "threat", text: "Onda curta que arremessa o rival para longe. Ótima para sair de aperto.", tag: "Defesa", rng: [0, 50],
  fire(f, m) {
    FX.ring(f.x, f.y - 18, "#dff6ff", 34, .3, 1, 2); Sound.play("whooshH"); const o = f.opp;
    if (!o.ko && o.invuln <= 0 && Math.abs(o.x - f.x) < 62 && Math.abs(o.y - f.y) < 40) Combat.hit(f, o, { type: "melee", damage: 4, knock: 290, stun: .3, launch: 0, hitstop: .05, fromX: f.x, y: o.y - 20, step: 2, shake: 3 });
  } });
defPower("meteoros", { name: "Chuva de meteoros", icon: "☄️", cost: 34, cd: 14, startup: .45, end: .8, pose: "buff", text: "Três meteoros caem sobre o ponto onde o rival está. Ele precisa se mexer!", tag: "Ataque", rng: [40, 200],
  fire(f, m) { const o = f.opp; for (const dx of [-24, 0, 24]) Powers.shoot(f, m, { x: clamp(o.x + dx, 10, CFG.W - 10), y: -14 - Math.abs(dx) * .6, vx: 0, vy: 200, r: 5, dmg: 7, life: 2.4, ghost: true, knock: 60, stun: .25, color: "#ff9a3c" }); Sound.play("beamCharge"); flare(f, "#ff9a3c", 6); } });
defPower("drenar", { name: "Drenar vida", icon: "🩸", cost: 24, cd: 11, startup: .2, end: .45, text: "Projétil que causa 8 de dano e cura quase o mesmo valor.", tag: "Ataque", rng: [40, 170],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 230, r: 4, dmg: 8, color: "#ff4a6a", on: { steal: .9 } }); Sound.play("phase"); } });
defPower("selo", { name: "Selo de energia", icon: "🔒", cost: 16, cd: 12, startup: .2, end: .45, need: "ki", text: "Drena 30 de energia do rival (você recupera parte) e adia a rajada e a investida dele.", tag: "Controle",
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 300, r: 4, dmg: 2, color: "#7fa8ff", on: { drain: 30 } }); Sound.play("phase"); } });
defPower("nova", { name: "Explosão nova", icon: "💥", cost: 32, cd: 13, startup: .35, end: .7, pose: "buff", text: "Explosão ao redor de você: 14 de dano e repulsão forte.", tag: "Ataque", rng: [0, 50],
  fire(f, m) {
    FX.ring(f.x, f.y - 18, f.palette.auraL, 52, .4, 1, 2); FX.burst(f.x, f.y - 18, "#ffffff", 12); FX.shake = Math.max(FX.shake, 5); FX.flash = .4; FX.flashColor = f.palette.auraL; Sound.play("pillar");
    const o = f.opp; if (!o.ko && o.invuln <= 0 && Math.abs(o.x - f.x) < 54 && Math.abs(o.y - f.y) < 40) Combat.hit(f, o, { type: "melee", damage: 14, knock: 180, stun: .4, launch: 0, hitstop: .08, fromX: f.x, y: o.y - 20, step: 3, shake: 5 });
  } });

/* ---------- Exclusivos das novas raças (lote 1) ---------- */
defPower("prisao", { excl: true, name: "Prisão de gelo", icon: "🧊", cost: 34, cd: 12, startup: .3, end: .65, text: "Bola de gelo que congela o rival por 1 s e o deixa lento por 3 s.", rng: [50, 170],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 200, r: 8, dmg: 8, big: true, knock: 40, stun: .2, color: "#bff0ff", on: { freeze: 1, slow: 3 } }); Sound.play("beam"); } });
defPower("bote", { excl: true, name: "Bote venenoso", icon: "🐍", cost: 26, cd: 9, startup: .14, end: .5, pose: "slam", text: "Bote rápido: 8 de dano e veneno por 5 s (3,5 por segundo).", rng: [0, 44],
  fire(f, m) { f.kx = f.face * 90; Sound.play("whooshH"); FX.crescent(f.x + f.face * 6, f.y - 22, f.face, 24, -1.2, 1, "#b6ff4a"); Powers.strike(f, m, { x0: 0, x1: 44, y0: -36, y1: -2 }, { damage: 8, knock: 60, stun: .3 }, { poison: { t: 5, dps: 3.5 } }); } });
defPower("relampago", { excl: true, name: "Relâmpago", icon: "🌩️", cost: 30, cd: 10, startup: .4, end: .75, pose: "buff", text: "Marca o ponto onde o rival está e, 0,4 s depois, cai um raio ali. Exige que ele não se mova.", rng: [30, 200],
  start(f, m, a) { a.tx = f.opp.x; FX.ring(a.tx, f.y - 1, "#fff2a0", 22, .4, .22, 2); },
  fire(f, m, a) {
    FX.pillar(a.tx, "#fff2a0"); FX.shake = Math.max(FX.shake, 5); FX.flash = .5; FX.flashColor = "#fff2a0"; Sound.play("beam");
    const o = f.opp; if (!o.ko && o.invuln <= 0 && Math.abs(o.x - a.tx) < 15 && o.y > CFG.GROUND - 40) Combat.hit(f, o, { type: "melee", damage: 17, knock: 80, stun: .45, launch: 100, hitstop: .09, fromX: a.tx, dir: sign(o.x - f.x) || f.face, y: o.y - 22, step: 3, shake: 6 });
  } });
defPower("tremor", { excl: true, name: "Tremor brutal", icon: "🪨", cost: 30, cd: 10, startup: .3, end: .7, pose: "slam", text: "Pancada devastadora: 14 de dano e atordoa; você ganha uma barreira de 12.", rng: [0, 46],
  fire(f, m) {
    FX.ring(f.x + f.face * 20, f.y - 2, "#d9c59a", 40, .4, .22, 2); FX.spark(f.x + f.face * 24, f.y - 4, "#d9c59a", 14, 100, .4, 40); FX.shake = Math.max(FX.shake, 6); Sound.play("pillar");
    f.shield = Math.max(f.shield, 12); Powers.give(f, "ward", 4);
    Powers.strike(f, m, { x0: 0, x1: 48, y0: -40, y1: 0 }, { damage: 14, knock: 90, stun: .55, launch: 60, hitstop: .1, step: 3, shake: 6 });
  } });
defPower("vendaval", { excl: true, name: "Rajada de vento", icon: "🌪️", cost: 22, cd: 8, startup: .2, end: .5, text: "Vento que empurra o rival com força. Você ganha velocidade por 3 s.", rng: [20, 140],
  fire(f, m) { Powers.shoot(f, m, { vx: f.face * 260, r: 7, dmg: 4, big: true, knock: 300, stun: .35, color: "#dff6ff" }); Powers.give(f, "haste", 3); Sound.play("whooshH"); flare(f, "#dff6ff", 8); } });
defPower("pacto", { excl: true, name: "Pacto de sangue", icon: "🩸", cost: 10, cd: 20, startup: .3, end: .6, pose: "buff", need: "self", text: "Sacrifica 12% da vida máxima: por 7 s causa mais dano e rouba 30% do dano como vida.",
  fire(f) { f.hp = Math.max(1, f.hp - f.stats.hp * .12); Powers.give(f, "rage", 7); Powers.give(f, "vamp", 7); flare(f, "#ff2a4a", 14); Sound.play("awaken"); FX.text(f.x, f.y - 46, "PACTO", "#ff4a6a", 8); } });
defPower("eclipse", { excl: true, name: "Eclipse", icon: "🌑", cost: 30, cd: 14, startup: .35, end: .7, pose: "buff", need: "ki", text: "Escurece a arena: o rival perde 25 de energia e causa 25% menos dano por 5 s. Você ganha 15 de energia.",
  fire(f, m) {
    const o = f.opp; FX.flash = .6; FX.flashColor = "#2a1a5a"; Sound.play("phase"); flare(f, "#b9a6ff", 14);
    if (!o.ko && Math.abs(o.x - f.x) < 190) { o.ki = Math.max(0, o.ki - 25); Powers.give(o, "weak", 5); f.ki = Math.min(f.stats.ki, f.ki + 15); FX.text(o.x, o.y - 50, "ECLIPSE", "#b9a6ff", 7); }
  } });
defPower("sopro", { excl: true, name: "Sopro dracônico", icon: "🐲", cost: 36, cd: 12, startup: .3, end: 1.05, text: "Sopra chamas por 0,6 s: várias chamas que queimam o rival.", rng: [20, 110],
  tick(f, m, a) {
    a.n = a.n || 0; while (a.n < 6 && a.t >= a.startup + a.n * .1) { a.n++; Powers.shoot(f, m, { vx: f.face * (220 + a.n * 8), vy: ((a.n * 7) % 5 - 2) * 4, r: 4, dmg: 3, life: .5, ghost: true, knock: 20, stun: .12, hitstop: .02, color: "#ff7a2e", on: { burn: { t: 2, dps: 1.5 } } }); if (a.n === 1) Sound.play("beam"); }
  }, fire(f) { FX.ring(f.x + f.face * 12, f.y - 24, "#ff7a2e", 14, .2, 1, 1); } });
