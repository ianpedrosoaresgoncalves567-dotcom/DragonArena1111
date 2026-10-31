
/* ---------- Golpes (dados) ---------- */
const MOVES = [
  { name: "Soco", startup: .07, active: .06, recovery: .13, damage: 6, knock: 55, stun: .20, launch: 0, hitstop: .04, box: { x0: 3, x1: 21, y0: -31, y1: -21 }, lunge: 34 },
  { name: "Chute", startup: .08, active: .07, recovery: .15, damage: 7, knock: 70, stun: .22, launch: 0, hitstop: .045, box: { x0: 3, x1: 25, y0: -26, y1: -12 }, lunge: 28 },
  { name: "Golpe final", startup: .12, active: .08, recovery: .30, damage: 11, knock: 150, stun: .42, launch: 120, hitstop: .09, box: { x0: 2, x1: 28, y0: -36, y1: -14 }, lunge: 50 }
];
const AIR_MOVE = { name: "Chute aéreo", startup: .07, active: .12, recovery: .12, damage: 7, knock: 70, stun: .24, launch: 0, hitstop: .04, box: { x0: 2, x1: 20, y0: -22, y1: -4 }, lunge: 0 };
const COST = { blast: 16, dash: 12, awaken: 45 };
const CD = { blast: .9, dash: 1.4, awaken: 20 };
const AWAKEN = { dur: 7, dmg: 1.2, speed: 1.1, regen: 1.4, taken: .9 };
const DASH = { dur: .2, end: .3, iframes: .14, speed: 250, backSpeed: 190, box: { x0: 0, x1: 13, y0: -30, y1: -6 } };

/* ---------- Lutador ---------- */
class Fighter {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.isPlayer = !!o.isPlayer; this.raceKey = o.raceKey; this.race = RACES[o.raceKey];
    this.clanKey = o.clanKey; this.stats = o.stats; this.look = o.look; this.palette = Sprites.makePalette(o.look, this.race);
    this.opp = null; this.m = null; this.ai = null; this.reset(o.x, o.face);
  }
  reset(x, face) {
    const s = this.stats;
    Object.assign(this, {
      x, y: CFG.GROUND, vx: 0, vy: 0, kx: 0, face, onGround: true, hp: s.hp, ki: s.ki, act: null, stun: 0, invuln: 0, hitFlash: 0, blockT: 0,
      guarding: false, guardT: 0, parryCd: 0, parryOK: false, comboStep: 0, comboTimer: 0, chainHits: 0, chainTimer: 0, hitsTaken: 0, hitsTakenT: 0,
      cd: { blast: 0, dash: 0, awaken: 0, race: 0 }, awakenT: 0, armorT: 0, hidden: false, burn: null, regenUsed: 0, regenTick: 0, airJumps: 0, airAtk: false,
      buf: { attack: 0, blast: 0, dash: 0, awaken: 0, race: 0, jump: 0 }, intent: { moveX: 0, guard: false },
      animT: 0, landT: 0, wake: false, ko: false, koT: 0, victory: false, trailT: 0, lastMsg: ""
    });
  }
  press(a) { if (this.m && this.m.state === "fight" && !this.ko) this.buf[a] = CFG.BUFFER; }
  cost(type) { const m = this.stats.mods; if (type === "race") return this.race.skill.cost; return type === "blast" ? COST.blast * m.blastCostMul : type === "dash" ? COST.dash * m.dashCostMul : COST.awaken; }
  maxCd(type) { if (type === "race") return this.race.skill.cd; return type === "dash" ? CD.dash * this.stats.dashCdMul : CD[type]; }
  fail(msg) { if (this.isPlayer && this.m) this.m.log(msg); return false; }

  tryAttack(chain) {
    const mods = this.stats.mods; let step, mv, air = false;
    if (!this.onGround) { if (this.airAtk) return false; air = true; mv = AIR_MOVE; step = 1; this.airAtk = true; }
    else {
      step = chain ? this.act.step + 1 : (this.comboTimer > 0 && this.comboStep > 0 && this.comboStep < 3) ? this.comboStep + 1 : 1;
      mv = MOVES[step - 1];
    }
    this.buf.attack = 0;
    if (this.opp && Math.abs(this.opp.x - this.x) > 1) this.face = sign(this.opp.x - this.x);
    this.act = { type: "attack", step, air, mv, k: 1 / mods.atkSpeed, t: 0, hit: false, fx: false };
    return true;
  }
  tryBlast() {
    this.buf.blast = 0; const c = this.cost("blast");
    if (this.cd.blast > 0) return false; if (this.ki < c) return this.fail("Energia insuficiente para a rajada.");
    this.ki -= c; this.cd.blast = CD.blast;
    this.act = { type: "blast", t: 0, startup: .13, recovery: .2, fired: false }; return true;
  }
  tryDash() {
    this.buf.dash = 0; const c = this.cost("dash");
    if (this.cd.dash > 0) return false; if (this.ki < c) return this.fail("Energia insuficiente para a investida.");
    this.ki -= c; this.cd.dash = this.maxCd("dash");
    const mv = this.intent.moveX, dir = mv !== 0 ? mv : this.face;
    this.act = { type: "dash", t: 0, dur: DASH.dur, end: DASH.end, dir, hit: false };
    this.invuln = Math.max(this.invuln, DASH.iframes);                       // invulnerabilidade curta e limitada
    Sound.play("dash"); FX.dust(this.x, this.y, -dir, 5); FX.ring(this.x, this.y - 16, this.palette.aura, 12, .2, 1, 1); return true;
  }
  tryAwaken() {
    this.buf.awaken = 0; const c = this.cost("awaken");
    if (this.awakenT > 0 || this.cd.awaken > 0) return false; if (this.ki < c) return this.fail("Energia insuficiente para despertar.");
    this.ki -= c; this.cd.awaken = CD.awaken;
    this.act = { type: "awaken", t: 0, dur: .45, done: false }; Sound.play("awaken"); return true;
  }
  trySkill() {
    this.buf.race = 0; const sk = this.race.skill; if (!sk || this.cd.race > 0) return false;
    if (this.ki < sk.cost) return this.fail("Energia insuficiente para " + sk.name + ".");
    this.ki -= sk.cost; this.cd.race = sk.cd; const k = sk.kind, base = { type: "skill", kind: k, t: 0, hit: false };
    if (this.opp && Math.abs(this.opp.x - this.x) > 1) this.face = sign(this.opp.x - this.x);
    if (k === "pillar") this.act = Object.assign(base, { startup: .28, active: .14, end: .6, fx: false });
    else if (k === "phase") { this.act = Object.assign(base, { vanish: .14, active: .1, end: .5, tp: false }); this.invuln = Math.max(this.invuln, .14); Sound.play("phase"); FX.ring(this.x, this.y - 18, this.palette.auraL, 14, .2, 1, 1); FX.spark(this.x, this.y - 18, this.palette.auraL, 10, 80, .3, 0); }
    else if (k === "beam") { this.act = Object.assign(base, { startup: .45, end: .75, fired: false }); Sound.play("beamCharge"); }
    else if (k === "armor") this.act = Object.assign(base, { end: .4, done: false });
    if (this.isPlayer) this.m.log(sk.name + "!");
    return true;
  }
  tryJump() {
    this.buf.jump = 0; Sound.play("jump");
    if (this.onGround) { this.vy = -CFG.JUMP_V; this.onGround = false; this.airJumps = this.stats.mods.doubleJump ? 1 : 0; this.airAtk = false; FX.dust(this.x, this.y, 0, 4); return true; }
    if (this.airJumps > 0) { this.airJumps--; this.vy = -CFG.JUMP_V * .88; FX.ring(this.x, this.y - 6, this.palette.auraL, 10, .22, .35, 1); return true; }
    return false;
  }

  step(dt, m) {
    const s = this.stats, mods = s.mods, fight = m.state === "fight", o = this.opp;
    this.animT += dt; this.hidden = false;
    const wasStun = this.stun > 0;
    this.stun = Math.max(0, this.stun - dt); this.invuln = Math.max(0, this.invuln - dt); this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.blockT = Math.max(0, this.blockT - dt); this.landT = Math.max(0, this.landT - dt); this.parryCd = Math.max(0, this.parryCd - dt);
    if (wasStun && this.stun <= 0 && this.wake) { this.wake = false; this.invuln = Math.max(this.invuln, .35); }  // levantar com invulnerabilidade curta
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const k in this.buf) this.buf[k] = fight ? Math.max(0, this.buf[k] - dt) : 0;
    this.comboTimer = Math.max(0, this.comboTimer - dt); if (this.comboTimer <= 0 && !this.act) this.comboStep = 0;
    this.chainTimer -= dt; if (this.chainTimer <= 0) this.chainHits = 0;
    this.hitsTakenT -= dt; if (this.hitsTakenT <= 0) this.hitsTaken = 0;
    if (this.armorT > 0) { this.armorT = Math.max(0, this.armorT - dt); if (this.armorT <= 0) FX.ring(this.x, this.y - 18, "#efe6c4", 16, .25, 1, 1); }
    if (this.awakenT > 0) { this.awakenT -= dt; if (this.awakenT <= 0) { this.awakenT = 0; FX.ring(this.x, this.y - 18, this.palette.aura, 18, .3, 1, 1); } }

    if (fight && !this.ko) {
      this.ki = Math.min(s.ki, this.ki + s.kiRegen * (this.awakenT > 0 ? AWAKEN.regen : 1) * (this.guarding ? .5 : 1) * dt);
      const lr = mods.lowHpRegen;
      if (lr && this.hp > 0 && this.hp < s.hp * lr.threshold && this.regenUsed < lr.pool * s.hp) {
        const amt = Math.min(lr.rate * dt, lr.pool * s.hp - this.regenUsed); this.hp = Math.min(s.hp, this.hp + amt); this.regenUsed += amt;
        this.regenTick -= dt; if (this.regenTick <= 0) { this.regenTick = .6; FX.text(this.x, this.y - 44, "+", "#7ef0a1", 9); FX.ember(this.x, this.y - 10, "#7ef0a1", 2); }
      }
      if (this.burn) {
        this.burn.t -= dt; Combat.dot(this, this.burn.dps * dt, this.burn.src);
        if (this.burn) { if (Math.random() < dt * 12) FX.ember(this.x, this.y - 18, "#ff9a3c", 1); if (this.burn.t <= 0) this.burn = null; }
      }
    }

    const free = !this.ko && this.stun <= 0 && !this.act;
    if (free && o && Math.abs(o.x - this.x) > 1) this.face = sign(o.x - this.x);

    // defesa (só no chão, sem agir, e apenas durante a luta)
    const wantGuard = fight && this.intent.guard && this.onGround && free;
    if (wantGuard) { if (!this.guarding) { this.guarding = true; this.guardT = 0; this.parryOK = this.parryCd <= 0; } else this.guardT += dt; }
    else if (this.guarding) { this.guarding = false; this.parryCd = .5; }

    // início de ações
    if (fight && free && this.blockT <= 0) {
      if (this.buf.awaken > 0) this.tryAwaken();
      else if (this.buf.race > 0) this.trySkill();
      else if (this.buf.dash > 0) this.tryDash();
      else if (this.buf.blast > 0) this.tryBlast();
      else if (this.buf.attack > 0) this.tryAttack(false);
      else if (this.buf.jump > 0) this.tryJump();
    } else if (fight && !this.ko && this.stun <= 0 && !this.act && this.blockT <= 0 && this.buf.jump > 0) this.tryJump();

    // andamento da ação atual
    if (this.act && !this.ko) this.updateAct(dt, m);
    const a = this.act;

    // velocidade horizontal
    let tvx = 0, ctl = false;
    if (!this.ko && this.stun <= 0) {
      if (!a) { ctl = true; tvx = (this.guarding || this.blockT > 0) ? 0 : this.intent.moveX * s.speed * (this.awakenT > 0 ? AWAKEN.speed : 1) * (this.armorT > 0 ? .85 : 1); }
      else if (a.type === "attack") { const ph = a.t < (a.mv.startup + a.mv.active) * a.k; tvx = ph && this.onGround ? this.face * a.mv.lunge : 0; if (!this.onGround) tvx = this.vx; }
      else if (a.type === "dash") { tvx = a.t < a.dur ? a.dir * (a.dir === this.face ? DASH.speed : DASH.backSpeed) : 0; this.vx = tvx; }
      else if (!this.onGround) tvx = this.vx;
    } else if (!this.onGround) tvx = this.vx * .98;
    if (this.onGround) this.vx = tvx; else if (a && a.type === "dash") this.vx = tvx; else this.vx = approach(this.vx, tvx, (ctl ? 650 : 120) * dt);

    // física
    const dashAir = a && a.type === "dash" && a.t < a.dur && !this.onGround;
    if (!this.onGround || this.vy < 0) {
      if (dashAir) this.vy = 0; else this.vy += CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= CFG.GROUND) { this.y = CFG.GROUND; if (this.vy > 60) { this.landT = .09; FX.dust(this.x, this.y, 0, 4); } this.vy = 0; this.onGround = true; this.airAtk = false; this.airJumps = 0; }
      else this.onGround = false;
    }
    this.x += (this.vx + this.kx) * dt;
    this.kx = approach(this.kx, 0, (this.onGround ? 700 : 160) * dt);
    if (this.x < CFG.ARENA_L) { this.x = CFG.ARENA_L; if (this.kx < 0) this.kx = 0; if (this.vx < 0 && this.stun > 0) this.vx = 0; }
    if (this.x > CFG.ARENA_R) { this.x = CFG.ARENA_R; if (this.kx > 0) this.kx = 0; if (this.vx > 0 && this.stun > 0) this.vx = 0; }

    // rastros de movimento
    this.trailT -= dt;
    if (this.trailT <= 0 && !this.ko && ((a && a.type === "dash" && a.t < a.dur) || this.awakenT > 0 && Math.abs(this.vx) > s.speed * .8)) {
      this.trailT = .05; FX.ghost(this, Sprites.poseFor(this), this.palette.aura);
    }
    if (this.awakenT > 0 && Math.random() < dt * 14) FX.ember(this.x, this.y - 4, this.palette.aura, 1);
    if (this.ko) { this.koT += dt; if (this.onGround && this.stun <= 0) this.vx = 0; }
  }

  updateAct(dt, m) {
    const a = this.act; a.t += dt;
    if (a.type === "attack") {
      const mv = a.mv, k = a.k, su = mv.startup * k, ac = mv.active * k, tot = (mv.startup + mv.active + mv.recovery) * k;
      if (!a.fx && a.t >= su) {
        a.fx = true; const c = this.palette.auraL, f = this.face; Sound.play(a.step === 3 ? "whooshH" : "whoosh");
        if (a.air) FX.crescent(this.x + f * 6, this.y - 14, f, 16, .3, 1.7, c);
        else if (a.step === 1) FX.crescent(this.x + f * 6, this.y - 26, f, 15, -1.0, .9, c);
        else if (a.step === 2) FX.crescent(this.x + f * 4, this.y - 17, f, 19, -1.1, .6, c);
        else FX.crescent(this.x + f * 4, this.y - 22, f, 22, -1.6, 1.4, "#ffffff");
      }
      if (a.t >= su + ac && a.hit && !a.air && a.step < 3 && this.buf.attack > 0 && this.stun <= 0) { this.tryAttack(true); return; }   // cancelamento no acerto
      if (a.t >= tot) {
        if (!a.air) { this.comboStep = a.step < 3 ? a.step : 0; this.comboTimer = a.step < 3 ? .32 : 0; }
        this.act = null;
      }
    } else if (a.type === "blast") {
      if (!a.fired && a.t >= a.startup) {
        a.fired = true; const mods = this.stats.mods;
        m.projectiles.push({ x: this.x + this.face * 12, y: this.y - 26, vx: this.face * 190, owner: this, r: mods.blastRadius, life: 2.2, dmg: 9 * mods.blastDmgMul, color: this.palette.aura, trail: 0 });
        Sound.play("blast"); FX.spark(this.x + this.face * 12, this.y - 26, this.palette.auraL, 6, 60, .25, 0); FX.ring(this.x + this.face * 10, this.y - 26, this.palette.aura, 9, .2, 1, 1);
        if (this.isPlayer) m.log("Rajada disparada!");
      }
      if (a.t >= a.startup + a.recovery) this.act = null;
    } else if (a.type === "skill") {
      const pal = this.palette;
      if (a.kind === "pillar") {
        if (!a.fx && a.t >= a.startup) { a.fx = true; const px = this.x + this.face * 38; FX.pillar(px, pal.aura); FX.ring(px, this.y - 2, pal.auraL, 30, .4, .22, 2); FX.spark(px, this.y - 10, pal.auraL, 18, 120, .5, 60); FX.shake = Math.max(FX.shake, 4); Sound.play("pillar"); }
      } else if (a.kind === "phase") {
        this.hidden = a.t < a.vanish;
        if (!a.tp && a.t >= a.vanish) {
          a.tp = true; const o = this.opp, dir = sign(o.x - this.x) || this.face; let nx = o.x + dir * 18; if (nx < CFG.ARENA_L + 2 || nx > CFG.ARENA_R - 2) nx = o.x - dir * 18;
          this.x = clamp(nx, CFG.ARENA_L, CFG.ARENA_R); this.face = sign(o.x - this.x) || this.face; this.y = CFG.GROUND; this.vy = 0; this.onGround = true;
          FX.burst(this.x, this.y - 20, pal.auraL, 6); FX.ring(this.x, this.y - 18, pal.aura, 18, .25, 1, 1); FX.crescent(this.x + this.face * 4, this.y - 22, this.face, 20, -1.4, 1.2, "#ffffff"); Sound.play("whooshH");
        }
      } else if (a.kind === "beam") {
        if (!a.fired && a.t >= a.startup) {
          a.fired = true; const mods = this.stats.mods;
          m.projectiles.push({ x: this.x + this.face * 14, y: this.y - 26, vx: this.face * 330, owner: this, r: 8, life: 1.6, dmg: 20 * mods.blastDmgMul, color: pal.aura, trail: 0, knock: 130, stun: .35, hitstop: .08, big: true });
          FX.ring(this.x + this.face * 12, this.y - 26, pal.auraL, 22, .3, 1, 2); FX.spark(this.x + this.face * 12, this.y - 26, pal.auraL, 12, 120, .3, 0); FX.shake = Math.max(FX.shake, 3); Sound.play("beam");
        }
      } else if (a.kind === "armor") {
        if (!a.done && a.t >= .15) { a.done = true; this.armorT = 3.5; FX.ring(this.x, this.y - 18, "#efe6c4", 24, .35, 1, 2); FX.spark(this.x, this.y - 18, "#efe6c4", 14, 90, .4, 40); Sound.play("armor"); }
      }
      if (a.t >= a.end) { this.act = null; this.hidden = false; }
    } else if (a.type === "dash") {
      if (a.t >= a.end) this.act = null;
    } else if (a.type === "awaken") {
      if (!a.done && a.t >= .2) {
        a.done = true; this.awakenT = AWAKEN.dur; Combat.shockwave(this, m);
        if (this.isPlayer) m.log("DESPERTAR! Mais dano, velocidade e energia por " + AWAKEN.dur + "s.");
      }
      if (a.t >= a.dur) this.act = null;
    }
  }
}

/* ---------- Combate: áreas de acerto, dano, projéteis ---------- */
const Combat = {
  hurtbox(f) { return { l: f.x - CFG.BODY_W / 2, r: f.x + CFG.BODY_W / 2, t: f.y - CFG.BODY_H, b: f.y }; },
  boxOf(f, b) { return { l: f.face > 0 ? f.x + b.x0 : f.x - b.x1, r: f.face > 0 ? f.x + b.x1 : f.x - b.x0, t: f.y + b.y0, b: f.y + b.y1 }; },
  overlap(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; },
  resolve(m) {
    const order = m.tick % 2 ? [m.player, m.enemy] : [m.enemy, m.player];
    for (const f of order) this.melee(f, m);
  },
  melee(f, m) {
    const a = f.act, d = f.opp; if (!a || f.ko || m.state !== "fight" || d.ko) return;
    if (a.type === "attack") {
      const mv = a.mv, k = a.k; if (a.hit || a.t < mv.startup * k || a.t >= (mv.startup + mv.active) * k) return;
      if (d.invuln > 0) return;
      if (this.overlap(this.boxOf(f, mv.box), this.hurtbox(d))) {
        a.hit = true;
        this.hit(f, d, { type: "melee", damage: mv.damage, knock: mv.knock, stun: mv.stun, launch: mv.launch, hitstop: mv.hitstop, fromX: f.x, y: f.y - 24, step: a.step, shake: a.step === 3 ? 4 : 2 });
      }
    } else if (a.type === "skill") {
      if (a.hit || d.invuln > 0) return; let box = null, par = null;
      if (a.kind === "pillar" && a.t >= a.startup && a.t < a.startup + a.active) { box = { x0: 18, x1: 58, y0: -54, y1: 0 }; par = { damage: 15, knock: 90, stun: .42, launch: 150, hitstop: .09, step: 3, shake: 5 }; }
      else if (a.kind === "phase" && a.tp && a.t < a.vanish + a.active) { box = { x0: 0, x1: 24, y0: -36, y1: -2 }; par = { damage: 9, knock: 70, stun: .3, launch: 0, hitstop: .05, step: 2, shake: 3 }; }
      if (box && this.overlap(this.boxOf(f, box), this.hurtbox(d))) { a.hit = true; this.hit(f, d, Object.assign({ type: "melee", fromX: f.x, y: f.y - 24 }, par)); }
    } else if (a.type === "dash") {
      const dmg = f.stats.mods.dashDamage; if (a.hit || a.t >= a.dur || a.dir !== f.face || dmg <= 0 || d.invuln > 0) return;
      if (this.overlap(this.boxOf(f, DASH.box), this.hurtbox(d))) {
        a.hit = true; a.t = Math.max(a.t, a.dur);
        this.hit(f, d, { type: "melee", damage: dmg, knock: 90, stun: .24, launch: 0, hitstop: .05, fromX: f.x, y: f.y - 20, step: 0, shake: 3 });
      }
    }
  },
  /* Resolve UM acerto. Retorna false se ignorado. */
  hit(att, def, h) {
    const m = att.m; if (m.state !== "fight" || def.ko) return false;
    const ds = def.stats, as = att.stats;
    let dmg = h.damage * as.damage * (att.awakenT > 0 ? AWAKEN.dmg : 1) * ds.takenMul * (def.awakenT > 0 ? AWAKEN.taken : 1) * (def.armorT > 0 ? .6 : 1);
    if (h.type === "melee") dmg *= Math.max(.55, 1 - .07 * def.hitsTaken);                  // anti combo infinito
    const dir = h.dir || sign(def.x - h.fromX) || att.face;
    const front = (sign(h.fromX - def.x) || def.face) === def.face;
    const cx = def.x - dir * 4, cy = h.y != null ? h.y : def.y - 22, pal = att.palette;
    let hpLoss = 0;
    if (def.guarding && def.onGround && front) {
      if (def.guardT <= CFG.PARRY_WINDOW && def.parryOK) {                                      // bloqueio perfeito
        def.ki = Math.min(ds.ki, def.ki + 8); def.invuln = Math.max(def.invuln, .2);
        if (h.type === "melee" && att.act) { att.act = null; att.stun = .38; att.kx = -dir * 70; att.guarding = false; }
        Sound.play("parry"); FX.burst(cx + dir * 2, cy, "#9fe8ff", 7); FX.ring(cx, cy, "#9fe8ff", 16, .25, 1, 1); FX.text(def.x, def.y - 46, "PERFEITO!", "#9fe8ff", 8);
        m.hitstopT = Math.max(m.hitstopT, .09); FX.shake = Math.max(FX.shake, 2);
        if (def.isPlayer) m.log("Bloqueio perfeito! O rival ficou atordoado."); else m.log("O rival bloqueou perfeitamente seu golpe.");
        return true;
      }
      const take = dmg * ds.guardTakes, cost = dmg * .55;
      if (def.ki >= cost) {
        def.ki -= cost; hpLoss = take; def.hp = Math.max(0, def.hp - take); def.blockT = .1; def.kx = dir * h.knock * .45;
        Sound.play("block"); FX.spark(cx, cy, "#a9dfff", 6, 90, .25); FX.burst(cx, cy, "#a9dfff", 3); FX.text(def.x, def.y - 46, "-" + Math.max(1, R(take)), "#a9dfff", 7);
        att.ki = Math.min(as.ki, att.ki + 1.5); m.hitstopT = Math.max(m.hitstopT, h.hitstop * .5); FX.shake = Math.max(FX.shake, 1);
        if (def.isPlayer) m.log("Golpe bloqueado.");
      } else {                                                                                  // guarda quebrada
        def.ki = 0; hpLoss = dmg * .5; def.hp = Math.max(0, def.hp - hpLoss); def.stun = .55 * ds.mods.stunResist; def.guarding = false; def.kx = dir * h.knock * .8; def.act = null;
        Sound.play("break"); FX.burst(cx, cy, "#ff9fb0", 8); FX.text(def.x, def.y - 46, "GUARDA QUEBRADA", "#ff9fb0", 7); m.hitstopT = Math.max(m.hitstopT, .1); FX.shake = Math.max(FX.shake, 3);
        if (def.isPlayer) m.log("Sua guarda quebrou! Falta energia para bloquear.");
      }
    } else {
      hpLoss = dmg; def.hp = Math.max(0, def.hp - dmg); const arm = def.armorT > 0; def.stun = arm ? 0 : clamp(h.stun * ds.mods.stunResist, .1, .55); def.kx = arm ? 0 : dir * h.knock * ds.mods.knockResist;
      if (!arm) { def.act = null; def.guarding = false; } def.hitFlash = .1; def.hitsTaken++; def.hitsTakenT = .9; def.comboTimer = 0;
      if (arm) { FX.text(def.x, def.y - 52, "ARMADURA", "#efe6c4", 6); }
      else if (h.launch > 0) { def.vy = -h.launch; def.onGround = false; def.wake = true; }
      else if (!def.onGround) def.vy = Math.min(def.vy, -30);
      att.chainHits++; att.chainTimer = 1.1; att.ki = Math.min(as.ki, att.ki + (h.type === "melee" ? as.mods.kiOnHit : 1)); def.ki = Math.min(ds.ki, def.ki + 2);
      if (h.type === "melee" && h.step === 3 && as.mods.burn) { def.burn = { t: as.mods.burn.dur, dps: as.mods.burn.dps * as.damage, src: att }; FX.ember(def.x, def.y - 20, "#ff9a3c", 6); }
      const big = h.step === 3 || h.type === "blast"; Sound.play(big ? "hitH" : "hit");
      FX.burst(cx, cy, pal.auraL, big ? 8 : 5); FX.spark(cx, cy, "#fff4b0", big ? 12 : 7, 130, .3); FX.spark(cx, cy, pal.aura, big ? 8 : 4, 90, .35);
      if (big) FX.ring(cx, cy, pal.auraL, 20, .28, 1, 1);
      FX.text(def.x + rnd(-3, 3), def.y - 46, String(Math.max(1, R(dmg))), def.isPlayer ? "#ff7a8e" : "#ffe08a", big ? 10 : 8);
      m.hitstopT = Math.max(m.hitstopT, h.hitstop); FX.shake = Math.max(FX.shake, h.shake || 2);
      if (att.isPlayer) m.log(att.chainHits >= 2 ? "Combo x" + att.chainHits + "! " + R(dmg) + " de dano." : R(dmg) + " de dano.");
      else m.log("Você recebeu um golpe! (-" + R(dmg) + ")");
    }
    if (def.hp <= 0) m.knockout(def, att);
    return true;
  },
  dot(def, amount, src) {                                                                       // dano contínuo (queimadura)
    const m = def.m; if (m.state !== "fight" || def.ko) return;
    def.hp = Math.max(0, def.hp - amount * def.stats.takenMul);
    if (def.hp <= 0) m.knockout(def, src || def.opp);
  },
  shockwave(f, m) {                                                                             // onda de choque do despertar
    const pal = f.palette; FX.ring(f.x, f.y - 18, pal.aura, 44, .45, 1, 2); FX.ring(f.x, f.y - 2, pal.auraL, 54, .5, .22, 1);
    FX.spark(f.x, f.y - 18, pal.auraL, 26, 150, .5, 40); FX.ember(f.x, f.y - 2, pal.aura, 10); FX.shake = Math.max(FX.shake, 4); FX.flash = .5; FX.flashColor = pal.auraL;
    const d = f.opp;
    if (!d.ko && d.invuln <= 0 && Math.abs(d.x - f.x) < 56 && Math.abs(d.y - f.y) < 40) {
      const dir = sign(d.x - f.x) || f.face;
      if (d.guarding) { d.kx = dir * 120; d.blockT = .2; } else { d.kx = dir * 170; d.stun = Math.max(d.stun, .22); d.act = null; d.guarding = false; }
    }
  },
  updateProjectiles(m, dt) {
    const L = m.projectiles;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; if (p.dead) continue;
      p.x += p.vx * dt; p.life -= dt; p.trail -= dt;
      if (p.trail <= 0) { p.trail = .035; FX.spark(p.x - sign(p.vx) * 3, p.y + rnd(-2, 2), p.color, 1, 14, .22, 0); }
      for (let j = i + 1; j < L.length; j++) {                                                  // rajadas se anulam
        const q = L[j]; if (q.dead || q.owner === p.owner) continue;
        if (Math.abs(p.x - q.x) < p.r + q.r + 2 && Math.abs(p.y - q.y) < p.r + q.r + 2) {
          p.dead = q.dead = true; FX.burst((p.x + q.x) / 2, p.y, "#fff", 7); FX.ring((p.x + q.x) / 2, p.y, p.color, 18, .3, 1, 1); FX.spark(p.x, p.y, q.color, 10, 100, .3); FX.shake = Math.max(FX.shake, 2);
        }
      }
      if (p.dead) continue;
      const d = p.owner.opp;
      if (!d.ko && d.invuln <= 0 && Math.abs(p.x - d.x) < CFG.BODY_W / 2 + p.r && p.y > d.y - CFG.BODY_H - p.r && p.y < d.y + p.r) {
        p.dead = true;
        this.hit(p.owner, d, { type: "blast", damage: p.dmg, knock: p.knock || 75, stun: p.stun || .26, launch: 0, hitstop: p.hitstop || .045, fromX: p.x - sign(p.vx) * 2, dir: sign(p.vx), y: p.y, step: 0, shake: p.big ? 5 : 2 });
        FX.ring(p.x, p.y, p.color, 14, .22, 1, 1);
      }
      if (p.life <= 0 || p.x < -10 || p.x > CFG.W + 10) p.dead = true;
    }
    m.projectiles = L.filter(p => !p.dead);
  }
};

/* ---------- IA: apenas produz entradas (mesmas regras do jogador) ---------- */
const AI = {
  PROFILE: {
    ignar: { lo: 12, hi: 20, blast: .12, dash: .3, awaken: .6 }, vortice: { lo: 14, hi: 24, blast: .15, dash: .6, awaken: .5 },
    luminar: { lo: 70, hi: 115, blast: .75, dash: .15, awaken: .5 }, mutante: { lo: 12, hi: 20, blast: .1, dash: .15, awaken: .55 }
  },
  make(tier) {
    if (tier === true) tier = .8; else if (tier === false || tier == null) tier = .3; const hard = tier >= .6;
    return { hard, tier, reaction: lerp(.32, .15, tier), aggr: lerp(.5, .88, tier), chain: lerp(.45, .9, tier), guardP: lerp(.45, .8, tier), decide: .3, guardT: 0, reactT: 0, seen: false, retreatT: 0, crossT: 0 };
  },
  respond(f, o, proj, d, dir) {
    const ai = f.ai, r = Math.random(), it = f.intent;
    if (proj) { if (f.onGround && r < ai.guardP * .6) ai.guardT = .5; else if (f.onGround && r < .85) { f.press("jump"); ai.crossT = .0; } return false; }
    if (r < ai.guardP) { ai.guardT = rnd(.35, .6); return false; }
    if (r < ai.guardP + .15 && f.cd.dash <= 0 && f.ki >= f.cost("dash")) { it.moveX = -dir; f.press("dash"); return true; }
    if (r < ai.guardP + .25 && f.onGround) { f.press("jump"); it.moveX = -dir; }
    return false;
  },
  think(f, dt, m) {
    const ai = f.ai, o = f.opp, it = f.intent, pr = this.PROFILE[f.raceKey] || this.PROFILE.ignar;
    it.moveX = 0;
    if (m.state !== "fight" || f.ko) { it.guard = false; return; }
    const dx = o.x - f.x, d = Math.abs(dx), dir = sign(dx) || f.face;
    ai.decide -= dt; ai.guardT -= dt; ai.retreatT -= dt; ai.crossT -= dt;
    it.guard = ai.guardT > 0 && f.onGround;
    if (f.stun > 0 || f.act && f.act.type !== "attack") return;
    // percepção com tempo de reação
    const meleeThreat = o.act && o.act.type === "attack" && d < 44;
    const proj = m.projectiles.find(p => p.owner === o && sign(f.x - p.x) === sign(p.vx) && Math.abs(f.x - p.x) < 85);
    if (meleeThreat || proj) {
      if (!ai.seen) { ai.seen = true; ai.reactT = ai.reaction * rnd(.75, 1.25); }
      else if (ai.reactT > 0) { ai.reactT -= dt; if (ai.reactT <= 0 && !f.act && this.respond(f, o, proj, d, dir)) return; }
    } else ai.seen = false;
    // encadeia combo
    if (f.act) { if (f.act.hit && f.act.step < 3 && f.buf.attack <= 0 && Math.random() < dt * 14 * ai.chain) f.press("attack"); return; }
    if (ai.crossT > 0) { it.moveX = dir; return; }
    if (ai.guardT > 0) return;
    const cornered = ((dir > 0 && f.x < CFG.ARENA_L + 26) || (dir < 0 && f.x > CFG.ARENA_R - 26)) && d < 42;
    if (f.hitsTaken >= 3 && ai.retreatT <= 0 && !cornered) ai.retreatT = .5;
    if (ai.retreatT > 0 && !cornered) { it.moveX = -dir; if (f.cd.dash <= 0 && f.ki >= f.cost("dash") && Math.random() < dt * 3) f.press("dash"); return; }
    const reach = 26;
    if (ai.decide <= 0) {
      ai.decide = rnd(.16, .38) / (ai.hard ? 1.3 : 1); const r = Math.random();
      if (cornered) {                                                                           // sair do canto: pular por cima, atacar ou defender
        if (f.race.skill.kind === "phase" && f.cd.race <= 0 && f.ki >= f.race.skill.cost && r < .3) f.press("race");
        else if (r < .4 && f.onGround) { f.press("jump"); ai.crossT = .6; it.moveX = dir; } else if (r < .7) f.press("attack"); else ai.guardT = .5;
        return;
      }
      if (f.awakenT <= 0 && f.cd.awaken <= 0 && f.ki >= f.cost("awaken") + 8 && (f.hp < f.stats.hp * .8 || o.hp < o.stats.hp * .6) && r < pr.awaken * .5) { f.press("awaken"); return; }
      const sk = f.race.skill;
      if (sk && f.cd.race <= 0 && f.ki >= sk.cost + 6 && Math.random() < .5 && f.onGround) {
        const k = sk.kind, ok = k === "pillar" ? d < 46 : k === "phase" ? d > 30 && d < 130 : k === "beam" ? d > 60 : (d < 44 && (f.hp < f.stats.hp * .75 || !!o.act));
        if (ok) { f.press("race"); return; }
      }
      if (d > 40 && f.cd.blast <= 0 && f.ki >= f.cost("blast") + 8 && Math.random() < pr.blast) { f.press("blast"); return; }
      if (d > 40 && d < 120 && f.cd.dash <= 0 && f.ki >= f.cost("dash") + 6 && Math.random() < pr.dash * .5) { it.moveX = dir; f.press("dash"); return; }
      if (d <= reach + 3) { if (r < ai.aggr) f.press("attack"); else if (r < ai.aggr + .2) ai.guardT = rnd(.3, .5); }
    }
    if (d > pr.hi) it.moveX = dir;
    else if (pr.lo > 40 && d < pr.lo && !cornered) it.moveX = -dir;
    else if (pr.lo < 40 && d > reach - 6) it.moveX = dir;
  }
};

/* ---------- Partida ---------- */
class Match {
  constructor(profile, character, hard, tourney) {
    this.profile = profile; this.tourney = tourney || null; this.character = character; this.hard = hard;
    this.state = "intro"; this.introT = 0; this.koT = 0; this.timeLeft = CFG.ROUND_TIME; this.hitstopT = 0; this.projectiles = []; this.result = null; this.reward = null; this.tick = 0; this.timeUp = false; this.fightBannerShown = false;
    const pst = StatBuilder.build(character.raceKey, character.clanKey, profile.level, profile.upgrades); this.arena = Shop.resolveArena(profile);
    this.player = new Fighter({ id: 0, name: character.name, isPlayer: true, raceKey: character.raceKey, clanKey: character.clanKey, stats: pst, look: { outfit: character.outfit, hair: character.hair, aura: character.aura, body: character.body, accessory: Shop.hasAcc(profile, character.accessory) ? character.accessory : "none" }, x: 95, face: 1 });
    const te = tourney ? tourney.enemy : null;
    const rk = Object.keys(RACES), er = te ? te.raceKey :  rk[Math.floor(Math.random() * rk.length)], ck = Object.keys(CLANS), ec = te ? te.clanKey : ck[Math.floor(Math.random() * ck.length)];
    const rr = RACES[er], pick = list => { const l = list.filter(c => c.toLowerCase() !== character.outfit.toLowerCase()); return l[Math.floor(Math.random() * l.length)]; };
    const elv = te ? te.level : clamp(profile.level + (hard ? 1 : 0), 1, CFG.MAX_LEVEL);
    this.enemy = new Fighter({ id: 1, name: te ? te.name : (hard ? "Elite " : "") + ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)], isPlayer: false, raceKey: er, clanKey: ec, stats: StatBuilder.build(er, ec, elv), look: { outfit: pick(SWATCH.outfit), hair: pick(SWATCH.hair), aura: rr.defaults.aura, body: BODY.random() }, x: 225, face: -1 });
    this.enemy.ai = AI.make(te ? te.tier : hard ? .8 : .3);
    this.enemyLevel = elv;
    for (const f of [this.player, this.enemy]) { f.m = this; }
    this.player.opp = this.enemy; this.enemy.opp = this.player;
  }
  log(msg) { UI.log(msg); }
  knockout(loser, winner) {
    if (this.state !== "fight") return;
    this.state = "ko"; this.koT = 0; this.projectiles.length = 0;
    loser.ko = true; loser.koT = 0; loser.act = null; loser.armorT = 0; loser.hidden = false; Sound.play("ko"); loser.guarding = false; loser.burn = null; loser.stun = 9;
    const dir = sign(loser.x - winner.x) || winner.face; loser.kx = dir * 120; loser.vy = -90; loser.onGround = false;
    winner.victory = true; this.hitstopT = Math.max(this.hitstopT, .14); FX.shake = 6; FX.flash = .8; FX.flashColor = "#ffffff";
    FX.burst(loser.x, loser.y - 22, "#fff", 12); FX.ring(loser.x, loser.y - 22, "#fff", 40, .5, 1, 2);
    this.finish(winner.isPlayer ? "win" : "lose");
    UI.banner("K.O.", "", null, !winner.isPlayer);
  }
  endByTime() {
    if (this.state !== "fight") return;
    this.state = "ko"; this.koT = 0; this.timeUp = true; this.projectiles.length = 0;
    const p = this.player.hp / this.player.stats.hp, e = this.enemy.hp / this.enemy.stats.hp;
    const res = Math.abs(p - e) < .005 ? "draw" : p > e ? "win" : "lose";
    if (res === "win") this.player.victory = true; if (res === "lose") this.enemy.victory = true;
    this.finish(res); UI.banner("TEMPO ESGOTADO", "", null, res === "lose");
  }
  finish(result) {                                                                              // aplica recompensa UMA única vez
    if (this.result) return; this.result = result;
    this.reward = Progress.apply(this.profile, result, this.hard);
    if (this.tourney && result === "win") {
      const t = this.tourney; this.profile.bestStage = Math.max(this.profile.bestStage, t.stage);
      if (t.stage >= t.total) { const b = Progress.tourneyBonus(this.profile); this.reward.xp += b.xp; this.reward.credits += b.credits; this.reward.levelsGained += b.levelsGained; this.reward.champion = true; }
    }
    this.saved = Save.write(this.profile);
  }
  separate() {
    const a = this.player, b = this.enemy, min = CFG.BODY_W;
    if (Math.abs(a.y - b.y) >= 26) return;                                                      // acima do rival: pode atravessar
    const dx = b.x - a.x, ov = min - Math.abs(dx); if (ov <= 0) return;
    const dir = dx > 0 ? 1 : dx < 0 ? -1 : (a.face > 0 ? 1 : -1);
    a.x -= dir * ov / 2; b.x += dir * ov / 2;
    a.x = clamp(a.x, CFG.ARENA_L, CFG.ARENA_R); b.x = clamp(b.x, CFG.ARENA_L, CFG.ARENA_R);
    const ov2 = min - Math.abs(b.x - a.x);
    if (ov2 > 0) {                                                                              // sobrou sobreposição (parede): empurra quem pode se mover
      const aWall = a.x <= CFG.ARENA_L || a.x >= CFG.ARENA_R;
      if (aWall) b.x = clamp(b.x + dir * ov2, CFG.ARENA_L, CFG.ARENA_R); else a.x = clamp(a.x - dir * ov2, CFG.ARENA_L, CFG.ARENA_R);
    }
  }
  update(dt) {
    if (this.hitstopT > 0) { this.hitstopT -= dt; FX.update(dt * .25); return; }
    this.tick++; const real = dt;
    if (this.state === "ko" && this.koT < 1.0) dt *= .4;                                         // câmera lenta no nocaute
    if (this.state === "intro") {
      this.introT += dt;
      if (!this.fightBannerShown && this.introT >= CFG.INTRO_TIME - .6) { this.fightBannerShown = true; UI.banner("LUTE!", "", 600); Sound.play("fight"); }
      if (this.introT >= CFG.INTRO_TIME) { this.state = "fight"; UI.banner(null); this.log("Luta iniciada! Combine golpes e administre sua energia."); }
    }
    const fight = this.state === "fight";
    if (fight) { Input.apply(this.player); AI.think(this.enemy, dt, this); this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.endByTime(); } }
    else { this.player.intent.moveX = 0; this.player.intent.guard = false; this.enemy.intent.moveX = 0; this.enemy.intent.guard = false; }
    const order = this.tick % 2 ? [this.player, this.enemy] : [this.enemy, this.player];
    for (const f of order) f.step(dt, this);
    if (this.state === "fight") { Combat.resolve(this); Combat.updateProjectiles(this, dt); }
    this.separate();
    FX.update(dt);
    if (this.state === "ko") { this.koT += real; if (this.koT >= CFG.KO_TIME) { this.state = "over"; UI.showResult(this); } }
  }
}
