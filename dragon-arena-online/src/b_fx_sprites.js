
/* ---------- Entrada (teclado, toque, toque na arena) ---------- */
const Input = {
  CODES: {
    left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"], up: ["KeyW", "ArrowUp"], guard: ["KeyS", "ArrowDown"],
    attack: ["KeyJ"], blast: ["KeyK"], dash: ["KeyL"], awaken: ["KeyU", "KeyI"], race: ["KeyH"]
  },
  held: new Set(), touch: { left: false, right: false, guard: false }, tapDir: 0, tapUntil: 0, codeToAction: {},
  init() {
    for (const a in this.CODES) for (const c of this.CODES[a]) this.codeToAction[c] = a;
    const typing = t => t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    window.addEventListener("keydown", e => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!Game.inBattle()) return;
      const act = this.codeToAction[e.code];
      const isCtl = act || e.code === "KeyM" || e.code === "Escape" || e.code === "KeyP" || e.code === "KeyR" || e.code === "Space";
      if (isCtl) e.preventDefault();
      if (act) this.held.add(e.code);
      if (e.repeat) return;
      if (e.code === "KeyM") Sound.toggle();
      else if (e.code === "Escape" || e.code === "KeyP") Game.togglePause();
      else if (e.code === "KeyR") Game.rematch();
      else if (act === "up") Game.press("jump");
      else if (act === "attack" || act === "blast" || act === "dash" || act === "awaken" || act === "race") Game.press(act);
    });
    window.addEventListener("keyup", e => { this.held.delete(e.code); });
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.reset(); Game.autoPause(); } });
  },
  reset() { this.held.clear(); this.touch.left = this.touch.right = this.touch.guard = false; this.tapDir = 0; document.querySelectorAll(".touchpad .hold").forEach(b => b.classList.remove("hold")); },
  isDown(a) { for (const c of this.CODES[a]) if (this.held.has(c)) return true; return false; },
  moveX() {
    const now = performance.now(), tap = now < this.tapUntil ? this.tapDir : 0;
    const l = this.isDown("left") || this.touch.left || tap < 0, r = this.isDown("right") || this.touch.right || tap > 0;
    return (r ? 1 : 0) - (l ? 1 : 0);
  },
  guard() { return this.isDown("guard") || this.touch.guard; },
  apply(f) { f.intent.moveX = this.moveX(); f.intent.guard = this.guard(); }
};

/* ---------- Efeitos (limites fixos para proteger o desempenho) ---------- */
const FX = {
  MAX: { pillars: 4, parts: 240, rings: 14, bursts: 12, crescents: 8, texts: 12, ghosts: 18 },
  pillars: [], parts: [], rings: [], bursts: [], crescents: [], texts: [], ghosts: [], shake: 0, flash: 0, flashColor: "#fff",
  clear() { this.pillars.length = this.parts.length = this.rings.length = this.bursts.length = this.crescents.length = this.texts.length = this.ghosts.length = 0; this.shake = this.flash = 0; },
  push(list, max, o) { if (list.length >= max) list.shift(); list.push(o); },
  spark(x, y, c, n, spd, life, g) {
    for (let i = 0; i < n && this.parts.length < this.MAX.parts; i++) {
      const a = Math.random() * 6.283, s = rnd(.3, 1) * spd, l = life * rnd(.6, 1);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, c, s: Math.random() < .3 ? 2 : 1, g: g == null ? 200 : g });
    }
  },
  ember(x, y, c, n) {
    for (let i = 0; i < n && this.parts.length < this.MAX.parts; i++) {
      const l = rnd(.3, .7); this.parts.push({ x: x + rnd(-5, 5), y, vx: rnd(-8, 8), vy: rnd(-40, -14), life: l, max: l, c, s: 1, g: -20 });
    }
  },
  dust(x, y, dir, n) {
    for (let i = 0; i < n && this.parts.length < this.MAX.parts; i++) {
      const l = rnd(.25, .5); this.parts.push({ x: x + rnd(-3, 3), y: y - 1, vx: dir * rnd(10, 40) + rnd(-12, 12), vy: rnd(-18, -4), life: l, max: l, c: "#b9c6e6", s: 1 + (Math.random() < .4 ? 1 : 0), g: 30 });
    }
  },
  ring(x, y, c, maxR, life, flat, th) { this.push(this.rings, this.MAX.rings, { x, y, r: 2, maxR, life, max: life, c, flat: flat || 1, th: th || 1 }); },
  burst(x, y, c, size) { this.push(this.bursts, this.MAX.bursts, { x, y, life: .16, max: .16, size, c }); },
  crescent(x, y, face, r, a0, a1, c) { this.push(this.crescents, this.MAX.crescents, { x, y, face, r, a0, a1, life: .16, max: .16, c }); },
  text(x, y, str, c, size) { this.push(this.texts, this.MAX.texts, { x, y, vy: -26, life: .8, max: .8, str, c, size: size || 8 }); },
  pillar(x, c) { this.push(this.pillars, this.MAX.pillars, { x, c, life: .45, max: .45 }); },
  ghost(f, pose, c) { this.push(this.ghosts, this.MAX.ghosts, { f, x: f.x, y: f.y, face: f.face, t: f.animT, pose, c, life: .22, max: .22 }); },
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const list of [this.pillars, this.rings, this.bursts, this.crescents, this.texts, this.ghosts]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i]; o.life -= dt; if (o.life <= 0) { list.splice(i, 1); continue; }
        if (o.maxR) o.r = lerp(2, o.maxR, 1 - o.life / o.max);
        if (o.vy != null) o.y += o.vy * dt, o.vy *= .94;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 22); this.flash = Math.max(0, this.flash - dt * 3);
  },
  draw(ctx) {
    for (const p of this.parts) { ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(R(p.x), R(p.y), p.s, p.s); }
    for (const pl of this.pillars) {
      const pr = 1 - pl.life / pl.max, h = Math.round(64 * Math.min(1, pr * 5)), w = Math.round(8 * (1 - Math.max(0, pr - .5) * 1.6)); ctx.globalAlpha = Math.min(1, pl.life / pl.max * 2);
      for (let i = -w; i <= w; i += 2) { const hh = h - Math.abs(i) * 2 - Math.round(Math.abs(Math.sin(pr * 40 + i)) * 6); if (hh > 0) { ctx.fillStyle = pl.c; ctx.fillRect(Math.round(pl.x + i), CFG.GROUND - hh, 2, hh); ctx.fillStyle = "#fff4b0"; ctx.fillRect(Math.round(pl.x + i), CFG.GROUND - hh, 2, 3); if (Math.abs(i) < w * .5) { ctx.fillStyle = "#ffffff"; ctx.fillRect(Math.round(pl.x + i), CFG.GROUND - hh * .6, 2, hh * .6); } } }
    }
    for (const o of this.rings) {
      ctx.globalAlpha = clamp(o.life / o.max, 0, 1) * .9; ctx.fillStyle = o.c;
      const n = Math.max(14, R(o.r * 3));
      for (let i = 0; i < n; i++) { const a = i / n * 6.283; ctx.fillRect(R(o.x + Math.cos(a) * o.r), R(o.y + Math.sin(a) * o.r * o.flat), o.th, o.th); }
    }
    for (const b of this.bursts) {
      const pr = 1 - b.life / b.max, L = Math.max(2, R(b.size * (.5 + pr * .8)));
      ctx.globalAlpha = 1; ctx.fillStyle = pr < .55 ? "#ffffff" : b.c; const x = R(b.x), y = R(b.y);
      ctx.fillRect(x - L, y, 2 * L + 1, 1); ctx.fillRect(x, y - L, 1, 2 * L + 1);
      for (let k = 1; k <= L * .7; k++) { ctx.fillRect(x + k, y + k, 1, 1); ctx.fillRect(x - k, y + k, 1, 1); ctx.fillRect(x + k, y - k, 1, 1); ctx.fillRect(x - k, y - k, 1, 1); }
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    for (const c of this.crescents) {
      const pr = 1 - c.life / c.max; ctx.globalAlpha = 1 - pr; ctx.fillStyle = c.c;
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps, a = lerp(c.a0, c.a1, k) * c.face, th = k > .25 && k < .85 ? 2 : 1;
        // face espelha o ângulo horizontalmente
        const ax = c.face > 0 ? Math.cos(lerp(c.a0, c.a1, k)) : -Math.cos(lerp(c.a0, c.a1, k));
        ctx.fillRect(R(c.x + ax * c.r), R(c.y + Math.sin(lerp(c.a0, c.a1, k)) * c.r), th, th);
      }
    }
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1); ctx.font = "bold " + t.size + "px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#0a1022"; const x = R(t.x), y = R(t.y);
      ctx.fillText(t.str, x + 1, y); ctx.fillText(t.str, x - 1, y); ctx.fillText(t.str, x, y + 1); ctx.fillText(t.str, x, y - 1);
      ctx.fillStyle = t.c; ctx.fillText(t.str, x, y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
};

/* ---------- Sprites procedurais em pixel art ---------- */
const Sprites = (() => {
  const LINE = "#0d1226";
  /* poses: [lean, dip, frontFoot, backFoot, frontHand, backHand] */
  const P = (lean, dip, ff, bf, fh, bh) => ({ lean, dip, ff: ff.slice(), bf: bf.slice(), fh: fh.slice(), bh: bh.slice() });
  const IDLE = P(0, 0, [5, 0], [-5, 0], [10, -29], [6, -25]);
  const POSES = {
    jabW: P(-1, 1, [6, 0], [-6, 0], [2, -27], [9, -30]), jabS: P(3, 0, [7, 0], [-6, 0], [20, -28], [4, -26]),
    kickW: P(-2, 0, [1, -9], [-5, 0], [8, -30], [3, -28]), kickS: P(-3, 0, [23, -21], [-4, 0], [8, -31], [2, -27]),
    finW: P(-3, 1, [7, 0], [-8, 0], [-5, -27], [-7, -24]), finS: P(5, 2, [11, 0], [-7, 0], [22, -27], [18, -22]),
    airS: P(-1, 0, [18, -11], [-3, -6], [8, -30], [2, -28]), airW: P(0, 0, [6, -8], [-3, -5], [8, -30], [3, -28]),
    blastW: P(0, 1, [5, 0], [-5, 0], [6, -26], [4, -25]), blastS: P(2, 0, [6, 0], [-6, 0], [17, -28], [14, -26]),
    dash: P(5, 3, [6, -4], [-10, -8], [-5, -26], [-8, -23]), dashBack: P(-4, 1, [-3, -5], [-9, 0], [3, -29], [-3, -26]),
    awakenW: P(0, 5, [7, 0], [-7, 0], [6, -11], [-6, -11]), awakenS: P(0, 0, [6, 0], [-6, 0], [11, -38], [-9, -36]),
    hurt: P(-4, 1, [4, 0], [-7, 0], [-7, -24], [-9, -30]), hurtAir: P(-6, 0, [-2, -10], [-9, -5], [-10, -26], [-12, -32]),
    guard: P(1, 3, [6, 0], [-6, 0], [9, -30], [8, -26]), jump: P(1, 0, [6, -9], [-3, -5], [10, -35], [-6, -32]),
    fall: P(0, 0, [6, -3], [-6, -7], [11, -34], [-8, -31]), land: P(0, 4, [8, 0], [-8, 0], [9, -24], [4, -22]),
    win: P(0, 0, [5, 0], [-5, 0], [8, -43], [-6, -27])
  };
  const mixP = (a, b, t) => ({
    lean: lerp(a.lean, b.lean, t), dip: lerp(a.dip, b.dip, t),
    ff: [lerp(a.ff[0], b.ff[0], t), lerp(a.ff[1], b.ff[1], t)], bf: [lerp(a.bf[0], b.bf[0], t), lerp(a.bf[1], b.bf[1], t)],
    fh: [lerp(a.fh[0], b.fh[0], t), lerp(a.fh[1], b.fh[1], t)], bh: [lerp(a.bh[0], b.bh[0], t), lerp(a.bh[1], b.bh[1], t)]
  });
  function atkPose(W, S, a) {
    const k = a.k, su = a.mv.startup * k, ac = a.mv.active * k, rc = a.mv.recovery * k, t = a.t;
    if (t < su) { const p = t / su; return p < .5 ? mixP(IDLE, W, ease(p * 2)) : mixP(W, S, ease((p - .5) * 2)); }
    if (t < su + ac) return S;
    return mixP(S, IDLE, ease(clamp((t - su - ac) / rc, 0, 1)));
  }
  /* Calcula a pose a partir do estado do lutador */
  function poseFor(f) {
    const t = f.animT, a = f.act;
    if (f.ko) return f.onGround && f.koT > .4 ? POSES.hurt : POSES.hurtAir;
    if (f.victory && !f.act && f.onGround && f.stun <= 0) return POSES.win;
    if (f.stun > 0) return f.onGround ? POSES.hurt : POSES.hurtAir;
    if (a) {
      if (a.type === "attack") {
        if (a.air) return atkPose(POSES.airW, POSES.airS, a);
        return a.step === 1 ? atkPose(POSES.jabW, POSES.jabS, a) : a.step === 2 ? atkPose(POSES.kickW, POSES.kickS, a) : atkPose(POSES.finW, POSES.finS, a);
      }
      if (a.type === "blast") { const p = clamp(a.t / a.startup, 0, 1); return a.t < a.startup ? mixP(POSES.blastW, POSES.blastS, ease(p)) : mixP(POSES.blastS, IDLE, ease(clamp((a.t - a.startup) / a.recovery, 0, 1))); }
      if (a.type === "dash") return a.t < a.dur ? (a.dir === f.face ? POSES.dash : POSES.dashBack) : IDLE;
      if (a.type === "awaken") return mixP(POSES.awakenW, POSES.awakenS, ease(clamp(a.t / a.dur, 0, 1)));
    }
    if (a && a.type === "skill") {
      if (a.kind === "pillar") return a.t < a.startup ? mixP(POSES.finW, POSES.finS, ease(clamp(a.t / a.startup, 0, 1))) : mixP(POSES.finS, IDLE, ease(clamp((a.t - a.startup) / (a.end - a.startup), 0, 1)));
      if (a.kind === "phase") return a.t < a.vanish ? POSES.dash : mixP(POSES.finS, IDLE, ease(clamp((a.t - a.vanish) / (a.end - a.vanish), 0, 1)));
      if (a.kind === "beam") return a.t < a.startup ? mixP(POSES.blastW, POSES.blastS, ease(clamp(a.t / a.startup, 0, 1))) : mixP(POSES.blastS, IDLE, ease(clamp((a.t - a.startup) / (a.end - a.startup), 0, 1)));
      if (a.kind === "armor") return mixP(POSES.awakenW, POSES.awakenS, ease(clamp(a.t / a.end, 0, 1)));
    }
    if (f.guarding) return POSES.guard;
    if (!f.onGround) return f.vy < 0 ? POSES.jump : POSES.fall;
    if (f.landT > 0) return POSES.land;
    if (Math.abs(f.vx) > 6) {
      const fwd = sign(f.vx) === f.face, ph = t * (fwd ? 13 : 10) * (f.stats.speed / 80) * (sign(f.vx) * f.face >= 0 ? 1 : -1), amp = fwd ? 7 : 5, s = Math.sin(ph), c = Math.cos(ph);
      return P(fwd ? 2 : -1, Math.abs(s) > .8 ? 1 : 0, [3 + s * amp, -Math.max(0, c) * 3.5], [-3 - s * amp, -Math.max(0, -c) * 3.5], [8 - s * 4, -27 + c * 1.2], [5 + s * 4, -25 - c * 1.2]);
    }
    const bob = Math.sin(t * 4.6) > 0 ? 1 : 0;
    return P(0, bob, IDLE.ff, IDLE.bf, [10, -29 + bob], [6, -25 + bob]);
  }

  /* IK de dois ossos: devolve [jx, jy] do cotovelo/joelho */
  function ik(ax, ay, tx, ty, l1, l2, s) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy); const mx = l1 + l2 - .01;
    if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    if (d < .5) d = .5;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [ax + dx * a / d - s * dy * h / d, ay + dy * a / d + s * dx * h / d];
  }

  /* ---- estilos registrados por nome (novas raças podem reutilizá-los ou registrar novos) ---- */
  const HAIR = {
    flame(b, fr, c) { // cabelo em chamas, espetado para trás
      const { hx, hy, t, pal } = c;
      fr(hx - 5, hy - 10, 11, 4, pal.hair); fr(hx - 5, hy - 7, 2, 5, pal.hair); fr(hx + 2, hy - 8, 4, 2, pal.hairD);
      for (let i = 0; i < 5; i++) {
        const h = 4 + ((i * 7 + 3) % 4) + R(Math.sin(t * 9 + i * 1.7) * 1.2), x = hx - 5 + i * 2.4;
        for (let j = 0; j < h; j++) fr(x - Math.floor(j / 2), hy - 10 - j, j > h - 3 ? 1 : 2, 1, j > h - 3 ? pal.hairL : (j % 3 ? pal.hair : pal.hairL));
      }
    },
    stream(b, fr, c) { // cabelo longo escorrido, faixa na testa
      const { hx, hy, t, pal, sp } = c;
      for (let i = 0; i < 6; i++) b(hx - 5 - i * 2.6 * (1 + sp * .5), hy - 8 + i * 1.3 + Math.sin(t * 7 + i * .9) * (1 + i * .3), 4 - (i > 3 ? 1 : 0), 3 - (i > 4 ? 1 : 0), i % 2 ? pal.hairD : pal.hair);
      fr(hx - 5, hy - 10, 11, 4, pal.hair); fr(hx - 5, hy - 7, 3, 5, pal.hair); fr(hx + 2, hy - 8, 5, 2, pal.hairL); fr(hx - 5, hy - 6, 11, 1, pal.accent);
    },
    halo(b, fr, c) { // cabelo curto + longos fios atrás + halo de luz
      const { hx, hy, t, pal } = c;
      for (let i = 0; i < 4; i++) b(hx - 6 - Math.sin(t * 3 + i) * 1 - i * .5, hy - 8 + i * 3, 3, 4, i % 2 ? pal.hairD : pal.hair);
      fr(hx - 5, hy - 10, 11, 4, pal.hair); fr(hx - 5, hy - 7, 2, 7, pal.hair); fr(hx + 1, hy - 8, 5, 2, pal.hairL); fr(hx + 4, hy - 7, 2, 3, pal.hair);
      const cy = hy - 15 + R(Math.sin(t * 3)), rx = 6, ry = 2;
      for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; fr(R(hx + Math.cos(a) * rx), R(cy + Math.sin(a) * ry), 1, 1, i % 3 ? pal.aura : pal.auraL, false); }
    },
    short(b, fr, c) { const { hx, hy, pal } = c; fr(hx - 5, hy - 10, 10, 3, pal.hair); fr(hx - 5, hy - 8, 3, 6, pal.hair); fr(hx + 1, hy - 9, 4, 1, pal.hairL); fr(hx - 2, hy - 8, 6, 1, pal.hairD); },
    ponytail(b, fr, c) {
      const { hx, hy, t, pal, sp } = c; for (let i = 0; i < 4; i++) b(hx - 8 - i * 2.2 * (1 + sp * .5), hy - 7 + i * 1.6 + Math.sin(t * 6 + i) * 1.2, 3, 3, i % 2 ? pal.hairD : pal.hair);
      fr(hx - 5, hy - 10, 11, 3, pal.hair); fr(hx - 5, hy - 8, 3, 6, pal.hair); fr(hx + 1, hy - 9, 5, 1, pal.hairL); fr(hx - 6, hy - 7, 2, 2, pal.accent);
    },
    bald(b, fr, c) { const { hx, hy, pal } = c; fr(hx - 1, hy - 8, 3, 1, pal.skinL); },
    crest(b, fr, c) { // crista óssea e testa saliente
      const { hx, hy, pal } = c;
      for (let k = 0; k < 3; k++) { const h = [5, 8, 6][k], x = hx - 2 + k * 3; for (let j = 0; j < h; j++) fr(x - (j > h - 3 ? 0 : 1) + (j > h - 3 ? 1 : 0), hy - 9 - j, j > h - 3 ? 1 : 3, 1, j % 2 ? pal.hair : pal.hairL); }
      b(hx - 6, hy - 8, 3, 3, pal.hairD); fr(hx - 4, hy - 9, 10, 2, pal.skinD); fr(hx, hy - 7, 7, 2, pal.hairD);
    }
  };
  const BACK = {
    sash(p, c) { for (let i = 0; i < 5; i++) p(-4 - i * 3 - c.sp * i, c.hipY - 2 + i * .8 + Math.sin(c.t * 8 + i) * 1.3, 4, 3, i % 2 ? c.pal.outfitD : c.pal.outfit); },
    scarf(p, c) { for (let i = 0; i < 8; i++) p(c.lean - 4 - i * 3 * (1 + c.sp * .6), c.shY - 1 + Math.sin(c.t * 10 + i * .8) * (1 + i * .35), 4, 3, i % 2 ? c.pal.accentD : c.pal.accent); },
    cape(p, c) {
      const sw = Math.sin(c.t * 3) * 1.2;
      for (let y = c.shY; y < c.hipY + 6; y++) { const k = (y - c.shY) / (c.hipY + 6 - c.shY), w = 4 + k * 6 + c.sp * k * 4; p(c.lean * (1 - k) - 5 - w + sw * k, y, w, 1, k > .9 ? c.pal.accent : (y % 4 ? c.pal.outfitD : c.pal.outfit)); }
    },
    tail(p, c) { for (let i = 0; i < 7; i++) p(-5 - i * 3 - c.sp * i, c.hipY - 1 + i * .9 + Math.sin(c.t * 4 + i * .6) * 1.5, 4 - (i > 3 ? 1 : 0), 4 - (i > 4 ? 1 : 0) - (i > 5 ? 1 : 0), i > 5 ? c.pal.accent : c.pal.skinD); }
  };
  const TORSO = {
    gi(fr, c) { const { pal, n, w } = c; fr(0, 0, w, n, pal.outfit); fr(0, 0, 2, n, pal.outfitD); fr(w - 5, 0, 3, 4, pal.skin); fr(w - 4, 4, 2, 3, pal.skinL); fr(w - 5, 0, 1, 7, pal.outfitL); fr(0, n - 2, w, 2, pal.belt); fr(w - 4, n - 2, 3, 2, pal.accent); },
    suit(fr, c) { const { pal, n, w } = c; fr(0, 0, w, n, pal.outfit); fr(0, 0, 2, n, pal.outfitD); fr(w - 4, 0, 2, n, pal.outfitL); fr(2, 2, w - 6, 1, pal.accent); fr(0, n - 2, w, 2, pal.accentD); fr(w - 3, n - 2, 2, 2, pal.accent); },
    tabard(fr, c) { const { pal, n, w } = c; fr(0, 0, w, n, pal.white); fr(0, 0, 2, n, "#b9c6e6"); fr(2, 0, w - 4, 2, pal.outfit); fr(w / 2 - 1, 2, 3, n - 2, pal.outfit); fr(0, n - 2, w, 2, pal.accent); const g = Math.sin(c.t * 5) > 0; fr(w / 2 - 1, 3, 2, 2, g ? pal.auraL : pal.aura, false); },
    brute(fr, c) { const { pal, n, w } = c; fr(0, 0, w, n, pal.skin); fr(0, 0, 3, n, pal.skinD); fr(w - 5, 1, 4, 3, pal.skinL); fr(w / 2 - 1, 3, 1, 4, pal.skinD); fr(2, 4, w - 4, 1, pal.skinD); fr(0, n - 3, w, 3, pal.outfitD); fr(w - 4, 2, 3, 1, pal.aura, false); }
  };
  const BODYDEF = BODY.defaults();
  const LCOL = (pal, k) => pal[k] || pal.skin;

  /* Desenha o lutador. o = {x,y,face,t,tint,alpha,orb} */
  function draw(ctx, f, pose, o) {
    const pal = f.palette, look = f.race.look, t = o.t, tint = o.tint;
    const sp = clamp(o.speed || 0, 0, 1);
    const dip = Math.round(pose.dip), lean = Math.round(pose.lean);
    const bd = (f.look && f.look.body) || BODYDEF, hk = bd.height / 100, ak = hk * bd.armLen / 100, lk = hk * bd.legLen / 100;
    const legL = 8.6 * lk, hipBase = -(2 * legL - 1.2), torsoN = Math.max(8, Math.round(13 * hk * bd.torsoLen / 100)), shBase = hipBase - (torsoN - 1);
    const hipY = hipBase + dip, shY = Math.round(shBase) + dip, hx = lean + 1, hy = shY - 1;
    const hand = h => [h[0] * ak, shBase + (h[1] + 28) * ak], foot = p => [p[0] * lk, p[1] * lk];
    const fhA = hand(pose.fh), bhA = hand(pose.bh), ffA = foot(pose.ff), bfA = foot(pose.bf);
    const bw = look.build, tw0 = 10 + bw, kMax = Math.max(bd.shoulders, bd.waist, bd.hips) / 100, tw = Math.round(tw0 * kMax);
    const rowK = u => (u < .5 ? lerp(bd.shoulders, bd.waist, u / .5) : lerp(bd.waist, bd.hips, (u - .5) / .5)) / 100;
    const shO = Math.round((bd.shoulders - 100) / 100 * 5), hipO = Math.round((bd.hips - 100) / 100 * 4);
    const C = c => tint || c;
    let parts = [];
    const px = (x, y, w, h, c, ol) => parts.push([R(x), R(y), w, h, c, ol !== false]);
    const flush = () => {
      ctx.fillStyle = LINE; for (const p of parts) if (p[5]) ctx.fillRect(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2);
      for (const p of parts) { ctx.fillStyle = C(p[4]); ctx.fillRect(p[0], p[1], p[2], p[3]); }
      parts = [];
    };
    const limb = (x0, y0, x1, y1, w, c) => { const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) { const k = i / n; px(lerp(x0, x1, k) - w / 2, lerp(y0, y1, k) - w / 2, w, w, c); } };
    const ctxs = { pal, t, hipY: Math.round(hipY), shY, lean, sp, hx, hy };

    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(R(o.x), R(o.y)); ctx.scale(o.face, 1);
    if (o.rot) { ctx.rotate(-o.rot); ctx.translate(0, -Math.sin(o.rot) * 5); }
    // 1. traseira (capa, cachecol, rabo)
    BACK[look.back](px, ctxs); flush();
    // 2. braço de trás
        const armPart = (shx, hand, front) => {
      const [ex, ey] = ik(shx, shY + 1, hand[0], hand[1], 6 * ak, 6.5 * ak, 1);
      const cu = LCOL(pal, look.arm[0]), cl = LCOL(pal, look.arm[1]), ch = LCOL(pal, look.arm[2]), w = Math.max(2, Math.round(look.armW * bd.armThick / 100));
      limb(shx, shY + 1, ex, ey, w, front ? cu : shade(cu, -.15)); limb(ex, ey, hand[0], hand[1], w, front ? cl : shade(cl, -.15));
      px(hand[0] - w / 2 - .5, hand[1] - w / 2 - .5, w + 1, w + 1, ch);
      if (look.build > 0) px(hand[0] + w / 2 - 1, hand[1] + w / 2, 1, 2, pal.hairL, false);
    };
    armPart(lean - 2 - shO, bhA, false); flush();
    // 3. perna de trás
    const legPart = (hipx, foot, front) => {
      const [kx, ky] = ik(hipx, hipY, foot[0], foot[1], legL, legL, -1), w = Math.max(2, Math.round(look.legW * bd.legThick / 100));
      const cu = LCOL(pal, look.leg[0]), cl = LCOL(pal, look.leg[1]), cb = LCOL(pal, look.leg[2]);
      limb(hipx, hipY, kx, ky, w, front ? cu : shade(cu, -.18)); limb(kx, ky, foot[0], foot[1] - 2, w, front ? cl : shade(cl, -.18));
      px(foot[0] - w / 2 - 1, foot[1] - 3, w + 3, 3, front ? cb : shade(cb, -.18));
    };
    legPart(-1 - hipO, bfA, false); flush();
    // 4. tronco (linhas deslocadas conforme a inclinação; largura por linha = ombros → cintura → quadril)
    {
      const n = Math.round(hipY) - shY + 1, w = tw;
      const off = r => Math.round(lean * clamp(1 - r / Math.max(1, n - 1), 0, 1));
      const rw = r => clamp(Math.round(tw0 * rowK(r / Math.max(1, n - 1))), 4, w), ins = r => Math.floor((w - rw(r)) / 2);
      ctx.fillStyle = LINE;
      ctx.fillRect(R(-w / 2 + off(0) + ins(0)) - 1, shY - 1, rw(0) + 2, 1); ctx.fillRect(R(-w / 2 + ins(n - 1)) - 1, shY + n, rw(n - 1) + 2, 1);
      for (let r = 0; r < n; r++) ctx.fillRect(R(-w / 2 + off(r) + ins(r)) - 1, shY + r, rw(r) + 2, 1);
      const fr = (x, y, ww, hh, c) => {
        for (let r = y; r < y + hh; r++) {
          const i = ins(r); let xx = x, wd = ww;
          if (ww >= w * .6) { xx = Math.max(x, i); wd = Math.min(x + ww, w - i) - xx; } else xx = x + ww / 2 > w / 2 ? x - i : x + i;
          if (wd > 0) px(-w / 2 + xx + off(r), shY + r, wd, 1, c, false);
        }
      };
      TORSO[look.torso](fr, { pal, n, w, t });
      flush();
    }
    // 5. perna da frente
    legPart(2 + hipO, ffA, true); flush();
    // 6. cabeça
    {
      const hair = HAIR[bd.hairStyle !== "race" && HAIR[bd.hairStyle] ? bd.hairStyle : look.hair]; const back = [], front = [];
      const hb = (x, y, w, h, c) => px(x, y, w, h, c), hf = (x, y, w, h, c, ol) => front.push([R(x), R(y), w, h, c, ol !== false]);
      hair(hb, hf, ctxs); flush();
      px(hx - 5, hy - 8, 10, 9, pal.skin); px(hx - 5, hy - 8, 2, 9, pal.skinD, false); px(hx - 1, hy + 1, 4, 1, pal.skinD, false);
      flush();
      const hurt = f.stun > 0 || f.ko;
      // rosto (tamanho/forma/altura dos olhos, cílios e boca vêm do corpo)
      const es = bd.eyeSize, ew = [2, 3, 4][es], eh = hurt ? 1 : [1, 2, 3][es], ex = R(hx + 1), ey = R(hy - 5 - (es === 2 ? 1 : 0) + bd.eyeY), by = Math.max(R(hy - 8), ey - 2), dark = C("#10182c");
      ctx.fillStyle = C("#ffffff"); ctx.fillRect(ex, ey, ew, eh);
      ctx.fillStyle = C(pal.eye); ctx.fillRect(ex + ew - 2, ey, 2, eh);
      ctx.fillStyle = dark; ctx.fillRect(ex + ew - 1, ey, 1, eh);
      if (bd.eyeShape === 1) { ctx.fillRect(R(hx), by, 3, 1); ctx.fillRect(R(hx + 3), by + 1, 2, 1); }
      else if (bd.eyeShape === 2) { ctx.fillRect(R(hx + 1), by - 1, 3, 1); }
      else ctx.fillRect(R(hx), by, 5, 1);
      if (bd.lashes) { ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillRect(ex - 1, ey, 1, 1); ctx.fillRect(ex + ew - 1, ey - 1, 1, 1); }
      if ((f.act || f.guarding || f.awakenT > 0) && bd.eyeShape !== 1) ctx.fillRect(R(hx + 1), ey - 1, 2, 1);
      ctx.fillStyle = C(bd.gender === "fem" ? "#c8506e" : pal.skinD); ctx.fillRect(R(hx + 1), R(hy - 1), hurt ? 3 : 2, 1);
      parts = front; flush();
      const acc = f.look && f.look.accessory;
      if (acc === "band") { ctx.fillStyle = C(pal.aura); ctx.fillRect(R(hx - 5), R(hy - 6), 10, 2); ctx.fillStyle = C(pal.auraL); ctx.fillRect(R(hx - 5), R(hy - 6), 10, 1); for (let i = 0; i < 4; i++) { ctx.fillStyle = C(i % 2 ? pal.auraD : pal.aura); ctx.fillRect(R(hx - 6 - i * 2.5 - sp * i), R(hy - 6 + Math.sin(t * 9 + i) * 1.5 + i * .6), 3, 2); } }
      else if (acc === "shades") { ctx.fillStyle = C("#0d1226"); ctx.fillRect(R(hx), R(hy - 6), 6, 3); ctx.fillRect(R(hx - 3), R(hy - 6), 3, 1); ctx.fillStyle = C("#46e6ff"); ctx.fillRect(R(hx + 1), R(hy - 6), 2, 1); }
    }
    // 7. braço da frente e ornamentos
    armPart(lean + 2 + shO, fhA, true); flush();
    if (o.orb > 0) {   // energia carregando nas mãos
      const r = Math.max(1, R(o.orb * 4)), ox = fhA[0] + 2, oy = fhA[1];
      ctx.fillStyle = C(pal.aura); ctx.fillRect(R(ox - r), R(oy - r), r * 2 + 1, r * 2 + 1); ctx.fillStyle = C(pal.auraL); ctx.fillRect(R(ox - r + 1), R(oy - r + 1), r * 2 - 1, r * 2 - 1); ctx.fillStyle = C("#fff"); ctx.fillRect(R(ox - 1), R(oy - 1), 2, 2);
    }
    ctx.restore();
  }
  return { makePalette, poseFor, draw, shade, POSES, IDLE, P };
})();
