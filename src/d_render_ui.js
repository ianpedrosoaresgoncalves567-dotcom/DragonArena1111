
/* ---------- Renderização ---------- */
const Renderer = {
  canvas: null, ctx: null, layers: {}, glowCache: {}, vignette: null,
  init() {
    this.canvas = $("gameCanvas"); this.ctx = this.canvas.getContext("2d"); this.ctx.imageSmoothingEnabled = false;
    this.sets = { temple: this.buildBackground() };
  },
  getSet(id) { if (!this.sets[id]) { this.sets[id] = ArenaBuilders[id](this); } return this.sets[id]; },
  mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; },
  rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  posterize(c, levels) {
    const x = c.getContext("2d"), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] / 255 * levels) / levels * 255;
    x.putImageData(id, 0, 0); return c;
  },
  glow(color, r) {
    const key = color + r; if (this.glowCache[key]) return this.glowCache[key];
    const [c, x] = this.mk(r * 2 + 1, r * 2 + 1), g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, r * 2 + 1, r * 2 + 1);
    return this.glowCache[key] = this.posterize(c, 4);
  },
  ditherGradient(x, w, h, stops, levels) {
    const cols = stops.map(s => { const c = s[1]; return [s[0], parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; });
    const at = t => { let i = 0; while (i < cols.length - 2 && t > cols[i + 1][0]) i++; const a = cols[i], b = cols[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)]; };
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1), q = t * levels, lo = Math.floor(q) / levels, hi = Math.min(1, (Math.floor(q) + 1) / levels), fr = q - Math.floor(q);
      const cl = at(lo), ch = at(hi);
      for (let xx = 0; xx < w; xx++) { const useHi = fr > .75 ? 1 : fr > .5 ? ((xx + y) & 1) : fr > .25 ? ((xx & 1) && (y & 1)) : 0; const c = useHi ? ch : cl; x.fillStyle = "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; x.fillRect(xx, y, 1, 1); }
    }
  },
  ellipsePx(x, cx, cy, rx, ry, color, step, half) {
    x.fillStyle = color; const n = Math.round((rx + ry) * 4);
    for (let i = 0; i < n; i += step || 1) { const a = i / n * (half ? 3.1416 : 6.283) + (half ? 3.1416 : 0); x.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
  },
  fillEllipseRows(x, cx, cy, rx, ry, color, upperOnly) {
    x.fillStyle = color;
    for (let dy = upperOnly ? -ry : -ry; dy <= (upperOnly ? 0 : ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); x.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
  },
  buildBackground() {
    const LY = {};
    const W = CFG.W + 40, H = CFG.H, rg = this.rng(7), FY = 136;
    // céu
    let [sky, s] = this.mk(W, H);
    this.ditherGradient(s, W, H, [[0, "#070b26"], [.3, "#141c4e"], [.58, "#2f2f75"], [.78, "#6d4a87"], [1, "#c87c80"]], 12);
    for (let i = 0; i < 70; i++) { const x = Math.floor(rg() * W), y = Math.floor(rg() * 90); s.fillStyle = rg() < .25 ? "#ffffff" : rg() < .5 ? "#bcd0ff" : "#7d8fd0"; s.fillRect(x, y, 1, 1); if (rg() < .08) { s.fillRect(x - 1, y, 3, 1); s.fillRect(x, y - 1, 1, 3); } }
    // lua grande
    const mx = 238, my = 52, mr = 27;
    for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
      const d = Math.hypot(x, y); if (d > mr) continue; const l = (x * -.5 + y * -.6) / mr, v = d / mr;
      s.fillStyle = d > mr - 1.5 ? "#fff2d0" : l > .25 ? "#f7e9c9" : l > -.15 ? "#e3cfa3" : l > -.55 ? "#c4ab7e" : "#9a8460"; s.fillRect(mx + x, my + y, 1, 1);
    }
    [[-8, -6, 5], [6, 4, 4], [-4, 12, 3], [12, -10, 3]].forEach(c => this.ellipsePx(s, mx + c[0], my + c[1], c[2], c[2] * .8, "#a8916a"));
    s.fillStyle = "#1a1f4a88"; for (let i = 0; i < 4; i++) s.fillRect(mx - mr - 8 + i * 3, my + 8 + i * 5, mr * 2 + 16 - i * 6, 1);
    LY.sky = sky;
    // montanhas distantes
    let [far, f] = this.mk(W, H);
    for (let layer = 0; layer < 2; layer++) {
      const base = layer ? 128 : 112, col = layer ? "#1a2150" : "#252d63", rim = layer ? "#34407f" : "#3d4a8c";
      for (let x = 0; x < W; x++) {
        const h = 22 + Math.sin(x * (layer ? .045 : .03) + layer * 2) * 12 + Math.sin(x * (layer ? .11 : .075) + 1) * 6 + Math.sin(x * .2 + layer) * 2.5, top = Math.round(base - h);
        f.fillStyle = col; f.fillRect(x, top, 1, FY - top); f.fillStyle = rim; f.fillRect(x, top, 1, 1);
      }
    }
    for (let i = 0; i < 4; i++) { const x = 30 + i * 90 + Math.floor(rg() * 30), y = 38 + Math.floor(rg() * 26), w = 16 + Math.floor(rg() * 14);   // ilhas flutuantes
      f.fillStyle = "#2a3366"; f.fillRect(x, y, w, 3); f.fillStyle = "#3a4a8a"; f.fillRect(x, y, w, 1); f.fillStyle = "#1b2250"; for (let k = 0; k < 5; k++) f.fillRect(x + 2 + k * 2, y + 3 + k % 3, Math.max(1, 5 - k), 1); f.fillStyle = "#4fa8a0"; f.fillRect(x + 3, y - 1, 3, 1); }
    LY.far = far;
    // templo / colunata
    let [mid, m] = this.mk(W, H);
    const wallTop = 66;
    m.fillStyle = "#151b3f"; m.fillRect(0, wallTop, W, FY - wallTop);
    m.fillStyle = "#1d2652"; for (let y = wallTop + 4; y < FY; y += 9) { m.fillRect(0, y, W, 1); for (let x = ((y / 9) | 0) % 2 ? 0 : 7; x < W; x += 14) m.fillRect(x, y, 1, 9); }
    m.fillStyle = "#2a3670"; m.fillRect(0, wallTop, W, 3); m.fillStyle = "#3a4a92"; m.fillRect(0, wallTop, W, 1);
    // arcos (recortados)
    m.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 4; i++) { const cx = 20 + i * 100 + 20; this.fillEllipseRows(m, cx, 96, 22, 22, "#000", true); m.fillStyle = "#000"; m.fillRect(cx - 22, 96, 45, FY - 96); }
    m.globalCompositeOperation = "source-over";
    for (let i = 0; i < 4; i++) { const cx = 40 + i * 100; this.ellipsePx(m, cx, 96, 23, 23, "#3c4b94", 1, true); this.ellipsePx(m, cx, 96, 24, 24, "#27326a", 1, true); }
    // pilares
    for (let i = 0; i < 5; i++) {
      const px = i * 100 - 6; m.fillStyle = "#1a2250"; m.fillRect(px - 8, 62, 18, FY - 62); m.fillStyle = "#273270"; m.fillRect(px - 8, 62, 4, FY - 62);
      m.fillStyle = "#3c4b94"; m.fillRect(px + 4, 70, 2, FY - 70); m.fillRect(px - 10, 58, 22, 5); m.fillStyle = "#4a5aa8"; m.fillRect(px - 10, 58, 22, 1); m.fillRect(px - 10, FY - 6, 22, 6); m.fillStyle = "#0f1436";
      for (let y = 74; y < FY - 8; y += 12) m.fillRect(px - 5, y, 1, 7);
    }
    // janelas acesas e faixas
    for (let i = 0; i < 9; i++) { const x = 14 + Math.floor(rg() * (W - 28)), y = 70 + Math.floor(rg() * 12); m.fillStyle = "#ffb65a"; m.fillRect(x, y, 2, 3); m.fillStyle = "#ffe29a"; m.fillRect(x, y, 2, 1); }
    [60, 262].forEach(bx => { m.fillStyle = "#6a1f35"; m.fillRect(bx, 74, 10, 26); m.fillStyle = "#a02c4a"; m.fillRect(bx, 74, 10, 2); m.fillStyle = "#e0a944"; m.fillRect(bx + 4, 80, 2, 10); m.fillRect(bx + 2, 84, 6, 2); m.fillStyle = "#6a1f35"; m.fillRect(bx, 100, 3, 3); m.fillRect(bx + 7, 100, 3, 3); });
    LY.mid = mid;
    // piso
    let [fl, fx] = this.mk(CFG.W, H);
    for (let y = FY; y < H; y++) {
      const t = (y - FY) / (H - FY), c = [lerp(54, 20, t), lerp(66, 24, t), lerp(110, 46, t)];
      for (let x = 0; x < CFG.W; x++) { fx.fillStyle = "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; fx.fillRect(x, y, 1, 1); }
    }
    fx.fillStyle = "#6e84c8"; fx.fillRect(0, FY, CFG.W, 1); fx.fillStyle = "#4c5f9e"; fx.fillRect(0, FY + 1, CFG.W, 2); fx.fillStyle = "#34437a"; fx.fillRect(0, FY + 3, CFG.W, 1);
    fx.fillStyle = "#2d3a6a"; [4, 9, 16, 26, 38].forEach(o => fx.fillRect(0, FY + 3 + o, CFG.W, 1));
    for (let vx = -320; vx <= 640; vx += 36) { let x0 = 160 + (vx - 160) * .42, y0 = FY + 3, x1 = vx, y1 = H, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const k = i / n, xx = Math.round(lerp(x0, x1, k)), yy = Math.round(lerp(y0, y1, k)); if (xx >= 0 && xx < CFG.W) { fx.fillStyle = "#2d3a6a"; fx.fillRect(xx, yy, 1, 1); } } }
    this.ellipsePx(fx, 160, 160, 78, 13, "#6a7fc8"); this.ellipsePx(fx, 160, 160, 62, 10, "#4a5c9c"); this.ellipsePx(fx, 160, 160, 40, 6, "#3c4c88");
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; fx.fillStyle = "#8fa4e8"; fx.fillRect(Math.round(160 + Math.cos(a) * 70), Math.round(160 + Math.sin(a) * 11.5), 2, 1); }
    LY.floor = fl;
    // vinheta
    let [vg, v] = this.mk(CFG.W, H), g = v.createRadialGradient(CFG.W / 2, H / 2, H * .45, CFG.W / 2, H / 2, CFG.W * .62);
    g.addColorStop(0, "rgba(4,6,20,0)"); g.addColorStop(1, "rgba(4,6,20,.7)"); v.fillStyle = g; v.fillRect(0, 0, CFG.W, H);
    LY.vig = this.posterize(vg, 5); return LY;
  },
  softGlow(f, time) {
    const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .3 + Math.sin(time * 4) * .06; ctx.drawImage(this.glow(f.palette.aura, 24), R(f.x - 24), R(f.y - 20 - 24)); ctx.restore();
    if (Math.random() < .12) FX.ember(f.x, f.y - 6, f.palette.auraL, 1);
  },
  lights(ctx, time, AR) {
    for (const l of AR.lights) {
      const tx = l.x, c = l.c;
      if (l.kind === "torch") {
        const fl = Math.sin(time * 14 + tx) * 1.2, h = 5 + Math.round(fl + Math.sin(time * 9)); ctx.fillStyle = "#2a1c18"; ctx.fillRect(tx - 1, 112, 3, 16); ctx.fillStyle = "#6a4a30"; ctx.fillRect(tx - 3, 110, 7, 3);
        ctx.fillStyle = "#ff7a2e"; ctx.fillRect(tx - 2, 110 - h, 5, h); ctx.fillStyle = "#ffc24a"; ctx.fillRect(tx - 1, 110 - h + 1, 3, h - 1); ctx.fillStyle = "#fff2b0"; ctx.fillRect(tx, 110 - h + 3, 1, 2);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .42 + Math.sin(time * 11 + tx) * .06; ctx.drawImage(this.glow(c, 34), tx - 34, 106 - 34); ctx.globalAlpha = .22; ctx.drawImage(this.glow(c, 30), tx - 30, 150 - 14, 60, 30); ctx.restore();
      } else if (l.kind === "brazier") {
        const h = 8 + Math.round(Math.sin(time * 12 + tx) * 2 + Math.sin(time * 7) * 1.5); ctx.fillStyle = "#12080b"; ctx.fillRect(tx - 1, 124, 3, 14); ctx.fillStyle = "#3a1c22"; ctx.fillRect(tx - 6, 118, 13, 4); ctx.fillStyle = "#52262c"; ctx.fillRect(tx - 6, 118, 13, 1);
        ctx.fillStyle = "#ff4a10"; ctx.fillRect(tx - 5, 118 - h, 11, h); ctx.fillStyle = "#ffa030"; ctx.fillRect(tx - 3, 118 - h + 2, 7, h - 2); ctx.fillStyle = "#ffe080"; ctx.fillRect(tx - 1, 118 - h + 5, 3, h - 6);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .5 + Math.sin(time * 10 + tx) * .07; ctx.drawImage(this.glow(c, 40), tx - 40, 112 - 40); ctx.globalAlpha = .26; ctx.drawImage(this.glow(c, 30), tx - 36, 150 - 14, 72, 30); ctx.restore();
      } else if (l.kind === "neon") {
        const pulse = .8 + Math.sin(time * 6 + tx) * .2 + (Math.sin(time * 31 + tx) > .93 ? -.4 : 0);
        ctx.fillStyle = "#0d0820"; ctx.fillRect(tx - 3, 84, 7, 54); ctx.fillStyle = c; ctx.globalAlpha = clamp(pulse, .3, 1); ctx.fillRect(tx - 1, 88, 3, 46); ctx.fillStyle = "#ffffff"; ctx.fillRect(tx, 88, 1, 46); ctx.globalAlpha = 1;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .45 * clamp(pulse, .3, 1); ctx.drawImage(this.glow(c, 36), tx - 36, 110 - 36); ctx.globalAlpha = .25 * clamp(pulse, .3, 1); ctx.drawImage(this.glow(c, 30), tx - 30, 150 - 14, 60, 30); ctx.restore();
      } else if (l.kind === "crystal") {
        const by = 108 + Math.round(Math.sin(time * 2 + tx) * 3);
        for (let i = -6; i <= 6; i++) { const w = 6 - Math.abs(i); ctx.fillStyle = "#0d1226"; ctx.fillRect(tx - w - 1, by + i - 1, w * 2 + 3, 3); }
        for (let i = -6; i <= 6; i++) { const w = 6 - Math.abs(i); ctx.fillStyle = i < -1 ? "#ffffff" : c; ctx.fillRect(tx - w, by + i, w * 2 + 1, 1); }
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .4; ctx.drawImage(this.glow(c, 30), tx - 30, by - 30); ctx.restore();
      }
    }
  },
  ambient(ctx, time, AR) {
    if (AR.ambient === "embers") { if (Math.random() < .2) FX.ember(rnd(0, CFG.W), rnd(140, 178), "#ff7a2a", 1); }
    else if (AR.ambient === "rain") { ctx.fillStyle = "rgba(170,225,255,.38)"; for (let i = 0; i < 46; i++) { const x = ((i * 53 + time * 46) % 340) - 10, y = ((i * 37 + time * 230) % 196) - 10; ctx.fillRect(R(x), R(y), 1, 3); } }
    else if (AR.ambient === "petals") { for (let i = 0; i < 16; i++) { const x = (i * 71 + time * 16 + Math.sin(time * 1.3 + i) * 10) % 330, y = (i * 29 + time * 13) % 180; ctx.fillStyle = i % 2 ? "#ffc0d8" : "#ffffff"; ctx.fillRect(R(x), R(y), 2, 1); } }
  },
  aura(f, time) {
    const pal = f.palette, ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .55; const g = this.glow(pal.aura, 28); ctx.drawImage(g, R(f.x - 28), R(f.y - 20 - 28)); ctx.restore();
    ctx.save(); ctx.globalAlpha = .6;
    for (let i = 0; i < 10; i++) {
      const xo = -13 + i * 2.9, h = 16 + Math.sin(time * 13 + i * 2.1) * 6 + (i % 3) * 5 + Math.sin(time * 23 + i) * 2;
      ctx.fillStyle = i % 2 ? pal.aura : pal.auraL; ctx.fillRect(R(f.x + xo), R(f.y - h), 2, R(h) - 2); ctx.fillStyle = pal.auraL; ctx.fillRect(R(f.x + xo), R(f.y - h - 2), 1, 2);
    }
    ctx.restore();
  },
  fighter(f, time) {
    const ctx = this.ctx, pose = Sprites.poseFor(f), a = f.act;
    let orb = 0; if (a && a.type === "blast" && !a.fired) orb = clamp(a.t / a.startup, 0, 1); else if (a && a.type === "skill" && a.kind === "beam" && !a.fired) orb = clamp(a.t / a.startup, 0, 1) * 1.5;
    if (f.hidden) { if (Math.random() < .5) FX.spark(f.x, f.y - 18, f.palette.auraL, 1, 40, .25, 0); return; }
    const fwd = sign(f.vx) === f.face; const sp = fwd ? clamp(Math.abs(f.vx) / 120, 0, 1) : 0;
    const o = { x: f.x, y: f.y, face: f.face, t: f.animT, orb, speed: sp };
    if (f.invuln > 0 && !f.ko && Math.floor(time * 30) % 2) o.alpha = .55;
    if (f.hitFlash > 0) o.tint = "#ffffff";
    if (f.ko) o.rot = ease(clamp(f.koT / .5, 0, 1)) * 1.45;
    Sprites.draw(ctx, f, pose, o);
    if (f.armorT > 0) {
      ctx.save(); ctx.globalAlpha = (.22 + Math.sin(time * 14) * .06) * (f.armorT < .8 ? f.armorT / .8 : 1); this.fillEllipseRows(ctx, R(f.x), R(f.y - 20), 13, 23, "#efe6c4"); ctx.globalAlpha = .7;
      ctx.fillStyle = "#efe6c4"; for (let i = 0; i < 28; i++) { const an = i / 28 * 6.283; ctx.fillRect(R(f.x + Math.cos(an) * 13), R(f.y - 20 + Math.sin(an) * 23), 1, 1); } ctx.restore();
    }
    if (f.burn && Math.random() < .3) FX.ember(f.x, f.y - 20, "#ff9a3c", 1);
    if (f.guarding) {                                                                      // escudo de defesa
      ctx.save(); ctx.globalAlpha = f.guardT < CFG.PARRY_WINDOW ? .95 : .5; ctx.fillStyle = f.guardT < CFG.PARRY_WINDOW ? "#ffffff" : "#9fe8ff";
      for (let i = 0; i <= 16; i++) { const an = -1.1 + i / 16 * 2.2; ctx.fillRect(R(f.x + f.face * (5 + Math.cos(an) * 14)), R(f.y - 20 + Math.sin(an) * 17), 1, 2); }
      ctx.restore();
    }
  },
  shadow(f) {
    const ctx = this.ctx, k = 1 - clamp((CFG.GROUND - f.y) / 70, 0, .6), w = R(24 * k), x = R(f.x - w / 2), y = CFG.GROUND;
    ctx.fillStyle = "rgba(2,4,14,.5)"; ctx.fillRect(x + 3, y - 1, w - 6, 1); ctx.fillRect(x, y, w, 1); ctx.fillRect(x + 3, y + 1, w - 6, 1);
  },
  draw(m, time) {
    const ctx = this.ctx, W = CFG.W, H = CFG.H, p = m.player, e = m.enemy, mid = (p.x + e.x) / 2 - W / 2, L = this.getSet(m.arena), AR = ARENAS[m.arena];
    ctx.save(); ctx.clearRect(0, 0, W, H);
    if (FX.shake > .3) ctx.translate(R(rnd(-1, 1) * FX.shake * .55), R(rnd(-1, 1) * FX.shake * .45));
    ctx.drawImage(L.sky, -20 - R(mid * .015), 0); ctx.drawImage(L.far, -20 - R(mid * .04), 0); ctx.drawImage(L.mid, -20 - R(mid * .09), 0);
    ctx.drawImage(L.floor, 0, 0);
    this.lights(ctx, time, AR); this.ambient(ctx, time, AR);
    for (const f of [p, e]) {                                                               // luz colorida no chão
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = f.awakenT > 0 ? .55 : .22; const r = f.awakenT > 0 ? 34 : 22; ctx.drawImage(this.glow(f.palette.aura, r), R(f.x - r), CFG.GROUND - 7, r * 2, 14); ctx.restore();
    }
    this.shadow(p); this.shadow(e);
    for (const g of FX.ghosts) {
      const gf = g.f; Sprites.draw(ctx, gf, g.pose, { x: g.x, y: g.y, face: g.face, t: g.t, tint: g.c, alpha: .45 * g.life / g.max });
    }
    for (const f of [p, e]) if (f.awakenT > 0) this.aura(f, time); else if (f.look.accessory === "glow" && !f.ko) this.softGlow(f, time);
    const order = (p.act && p.act.type === "attack") ? [e, p] : (e.act && e.act.type === "attack") ? [p, e] : [e, p];
    if (p.ko) order.sort((a, b) => (a.ko ? -1 : 1)); // nocauteado fica atrás
    for (const f of order) this.fighter(f, time);
    for (const pr of m.projectiles) {                                                       // rajadas
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .6; ctx.drawImage(this.glow(pr.color, pr.r * 4), R(pr.x - pr.r * 4), R(pr.y - pr.r * 4)); ctx.restore();
      const px = R(pr.x), py = R(pr.y), r = pr.r;
      const disc = (rad, col) => { ctx.fillStyle = col; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad + .5 - dy * dy)); ctx.fillRect(px - w, py + dy, w * 2 + 1, 1); } };
      disc(r, pr.color); disc(r - 1, "#ffffff55"); disc(Math.max(1, r - 2), "#ffffff");
      ctx.fillStyle = pr.color; for (let i = 1; i < 5; i++) ctx.fillRect(px - sign(pr.vx) * (r + i * 3), py - 1 + (i % 2), 3, 1);
    }
    FX.draw(ctx);
    if (p.chainHits >= 2 && p.chainTimer > 0 && m.state === "fight") {                      // contador de combo
      ctx.globalAlpha = clamp(p.chainTimer * 2, 0, 1); ctx.textAlign = "left"; ctx.font = "bold 16px monospace"; ctx.fillStyle = "#0a1022"; const t = p.chainHits + " HITS";
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) ctx.fillText(t, 10 + ox, 22 + oy);
      ctx.fillStyle = "#ffd45e"; ctx.fillText(t, 10, 22); ctx.font = "bold 8px monospace"; ctx.fillStyle = "#fff"; ctx.fillText("COMBO", 10, 31); ctx.globalAlpha = 1;
    }
    ctx.drawImage(L.vig, 0, 0);
    ctx.restore();
    if (FX.flash > 0) { ctx.globalAlpha = clamp(FX.flash, 0, .6); ctx.fillStyle = FX.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  },
  /* prévia do editor */
  drawPreview(ctx, f, time, orb) {
    const W = 100, H = 100; ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0d1440"); g.addColorStop(.7, "#3a3478"); g.addColorStop(1, "#a86a7e"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 3 ? "#7d8fd0" : "#fff"; ctx.fillRect((i * 37 + 11) % W, (i * 23 + 5) % 50, 1, 1); }
    ctx.fillStyle = "#1a2150"; for (let x = 0; x < W; x++) ctx.fillRect(x, Math.round(60 - 14 - Math.sin(x * .09) * 8 - Math.sin(x * .2) * 3), 1, 30);
    ctx.fillStyle = "#2a3a6e"; ctx.fillRect(0, 84, W, 16); ctx.fillStyle = "#6e84c8"; ctx.fillRect(0, 84, W, 1); ctx.fillStyle = "#34437a"; ctx.fillRect(0, 92, W, 1);
    this.ellipsePx(ctx, 50, 90, 38, 6, "#4a5c9c");
    ctx.fillStyle = "rgba(2,4,14,.5)"; ctx.fillRect(36, 84, 28, 1); ctx.fillRect(34, 85, 32, 1);
    if (f.awakenT > 0) { const sv = this.ctx; this.ctx = ctx; f.x = 50; f.y = 84; this.aura(f, time); this.ctx = sv; }
    const pose = Sprites.poseFor(f), a = f.act;
    Sprites.draw(ctx, f, pose, { x: 50, y: 84, face: 1, t: f.animT, orb: a && a.type === "blast" && !a.fired ? clamp(a.t / a.startup, 0, 1) : 0, speed: 0 });
    if (orb) { ctx.fillStyle = f.palette.aura; ctx.fillRect(R(orb.x - 3), R(orb.y - 3), 7, 7); ctx.fillStyle = "#fff"; ctx.fillRect(R(orb.x - 1), R(orb.y - 1), 3, 3); }
  }
};

/* ---------- Prévia animada do editor ---------- */
const Preview = {
  f: null, ctx: null, raf: 0, last: 0, queue: [], orb: null, time: 0,
  init() { this.ctx = $("previewCanvas").getContext("2d"); this.ctx.imageSmoothingEnabled = false; $("previewCanvas").addEventListener("click", () => this.demo()); },
  rebuild(sel) {
    const stats = StatBuilder.build(sel.raceKey, sel.clanKey, Game.profile.level, Game.profile.upgrades);
    this.f = new Fighter({ id: 9, name: sel.name, isPlayer: true, raceKey: sel.raceKey, clanKey: sel.clanKey, stats, look: { outfit: sel.outfit, hair: sel.hair, aura: sel.aura, body: sel.body, accessory: Shop.hasAcc(Game.profile, sel.accessory) ? sel.accessory : "none" }, x: 50, face: 1 });
    this.queue.length = 0; this.orb = null;
  },
  demo() {
    if (!this.f || this.f.act || this.queue.length) return;
    this.queue = ["a1", "a2", "a3", "blast", "skill", "awaken"];
  },
  nextAct() {
    const f = this.f, n = this.queue.shift(); if (!n) return;
    if (n[0] === "a") { const s = +n[1]; f.act = { type: "attack", step: s, air: false, mv: MOVES[s - 1], k: 1 / f.stats.mods.atkSpeed, t: 0, hit: false }; }
    else if (n === "blast") f.act = { type: "blast", t: 0, startup: .13, recovery: .3, fired: false };
    else if (n === "awaken") f.act = { type: "awaken", t: 0, dur: .45, done: false };
    else if (n === "skill") { const k = f.race.skill.kind; f.act = { type: "skill", kind: k, t: 0, hit: false, startup: k === "beam" ? .45 : .28, vanish: .14, end: k === "armor" ? .4 : k === "beam" ? .75 : .6, fired: false }; }
  },
  start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(t => this.loop(t)); } },
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; },
  loop(ts) {
    this.raf = requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(.05, this.last ? (ts - this.last) / 1000 : 0); this.last = ts; this.time += dt;
    const f = this.f; if (!f) return; f.animT += dt; f.awakenT = Math.max(0, f.awakenT - dt);
    if (f.act) {
      const a = f.act; a.t += dt;
      if (a.type === "attack") { const tot = (a.mv.startup + a.mv.active + a.mv.recovery) * a.k; if (a.t >= tot) { f.act = null; } }
      else if (a.type === "blast") { if (!a.fired && a.t >= a.startup) { a.fired = true; this.orb = { x: 66, y: 58, vx: 110 }; } if (a.t >= a.startup + a.recovery) f.act = null; }
      else if (a.type === "skill") { if (a.t >= a.end) f.act = null; }
      else if (a.type === "awaken") { if (!a.done && a.t >= .2) { a.done = true; f.awakenT = 2.5; } if (a.t >= a.dur) f.act = null; }
    } else if (this.queue.length) this.nextAct();
    if (this.orb) { this.orb.x += this.orb.vx * dt; if (this.orb.x > 105) this.orb = null; }
    FX.clear(); Renderer.drawPreview(this.ctx, f, this.time, this.orb);
  }
};

/* ---------- Interface ---------- */
const UI = {
  sel: { name: "Guerreiro", raceKey: "ignar", clanKey: "chama", outfit: RACES.ignar.defaults.outfit, hair: RACES.ignar.defaults.hair, aura: RACES.ignar.defaults.aura, accessory: "none", body: BODY.defaults(), difficulty: "normal", mode: "quick" },
  touched: { outfit: false, hair: false, aura: false }, cache: {}, bt: 0, prev: { blast: 0, dash: 0, awaken: 0, race: 0 },
  init() {
    const rl = $("raceList"), cl = $("clanList");
    for (const k in RACES) { const r = RACES[k], b = document.createElement("button"); b.type = "button"; b.className = "choice"; b.dataset.key = k; b.setAttribute("role", "radio"); b.innerHTML = "<b>" + r.icon + " " + r.name + "</b><span>" + r.role + "</span>"; b.addEventListener("click", () => this.pickRace(k)); rl.appendChild(b); }
    for (const k in CLANS) { const c = CLANS[k], b = document.createElement("button"); b.type = "button"; b.className = "choice"; b.dataset.key = k; b.setAttribute("role", "radio"); b.innerHTML = "<b>" + c.icon + " " + c.name.replace("Clã d", "D") + "</b><span>" + c.short + "</span>"; b.addEventListener("click", () => { this.sel.clanKey = k; this.refresh(); }); cl.appendChild(b); }
    this.buildSwatches("outfit", "swOutfit"); this.buildSwatches("hair", "swHair"); this.buildSwatches("aura", "swAura");
    const al = $("accList");
    for (const k in ACCESSORIES) { const a = ACCESSORIES[k], b = document.createElement("button"); b.type = "button"; b.className = "choice"; b.dataset.key = k; b.setAttribute("role", "radio"); b.innerHTML = "<b>" + a.icon + " " + a.name + "</b><span>" + (k === "none" ? "Sem acessório" : "Da loja") + "</span>"; b.addEventListener("click", () => { if (Shop.hasAcc(Game.profile, k)) { this.sel.accessory = k; this.refresh(true); } }); al.appendChild(b); }
    this.buildBody(); this.initTabs();
    $("arena").addEventListener("change", e => { Game.profile.arena = e.target.value; Save.write(Game.profile); });
    this.refreshArena(); this.renderShop();
    $("fighterName").addEventListener("input", e => { this.sel.name = e.target.value; });
    $("mode").addEventListener("change", e => { this.sel.mode = e.target.value === "tourney" ? "tourney" : "quick"; this.refresh(true); });
    $("difficulty").addEventListener("change", e => { this.sel.difficulty = e.target.value === "hard" ? "hard" : "normal"; });
  },
  /* ---- abas do menu ---- */
  TABS: ["match", "online", "char", "colors", "body", "shop", "help"], tab: "match",
  initTabs() {
    const btns = [...document.querySelectorAll(".tabs [role=tab]")];
    btns.forEach((b, i) => {
      b.addEventListener("click", () => this.showTab(b.dataset.tab));
      b.addEventListener("keydown", e => {
        const k = e.key; let n = -1; if (k === "ArrowRight") n = (i + 1) % btns.length; else if (k === "ArrowLeft") n = (i - 1 + btns.length) % btns.length; else if (k === "Home") n = 0; else if (k === "End") n = btns.length - 1;
        if (n >= 0) { e.preventDefault(); this.showTab(btns[n].dataset.tab); btns[n].focus(); }
      });
    });
    document.querySelectorAll(".golink").forEach(a => a.addEventListener("click", e => { e.preventDefault(); this.showTab(a.dataset.go); }));
    this.showTab(this.tab);
  },
  showTab(name) {
    if (this.TABS.indexOf(name) < 0) name = "match"; this.tab = name;
    document.querySelectorAll(".tabs [role=tab]").forEach(b => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll("#editorCard .panel").forEach(p => p.classList.toggle("hidden", p.id !== "tab-" + name));
    if (name === "online") Online.onTabShown();
  },
  /* ---- editor de corpo ---- */
  buildBody() {
    const box = $("bodyBox"); box.innerHTML = ""; this.bodyEls = { sliders: {}, choices: [] };
    const mkRow = (label) => { const r = document.createElement("div"); r.className = "brow"; const l = document.createElement("span"); l.className = "lbl2"; l.textContent = label; r.appendChild(l); box.appendChild(r); return r; };
    const choiceRow = (label, items, get, set) => {
      const r = mkRow(label), g = document.createElement("div"); g.className = "mini"; g.setAttribute("role", "radiogroup"); g.setAttribute("aria-label", label);
      items.forEach(([key, txt]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.dataset.key = key; b.setAttribute("role", "radio"); b.addEventListener("click", () => { set(key); this.refresh(true); b.blur(); }); g.appendChild(b); });
      r.appendChild(g); this.bodyEls.choices.push([g, get]);
    };
    choiceRow("Gênero", Object.keys(BODY.GENDERS).map(k => [k, BODY.GENDERS[k].icon + " " + BODY.GENDERS[k].name]), b => b.gender, (k) => BODY.applyGender(this.sel.body, k));
    for (const k in BODY.FIELDS) {
      const [mn, mx, name] = BODY.FIELDS[k], r = mkRow(name), inp = document.createElement("input"), val = document.createElement("em");
      inp.type = "range"; inp.min = mn; inp.max = mx; inp.step = 1; inp.value = 100; inp.setAttribute("aria-label", name);
      inp.addEventListener("input", () => { this.sel.body[k] = +inp.value; this.refresh(true); }); r.appendChild(inp); r.appendChild(val); this.bodyEls.sliders[k] = [inp, val];
    }
    choiceRow("Tamanho dos olhos", BODY.EYE_SIZES.map((t, i) => [String(i), t]), b => String(b.eyeSize), k => { this.sel.body.eyeSize = +k; });
    choiceRow("Expressão dos olhos", BODY.EYE_SHAPES.map((t, i) => [String(i), t]), b => String(b.eyeShape), k => { this.sel.body.eyeShape = +k; });
    choiceRow("Posição dos olhos", [["-1", "Altos"], ["0", "Normal"], ["1", "Baixos"]], b => String(b.eyeY), k => { this.sel.body.eyeY = +k; });
    choiceRow("Cílios", [["1", "Sim"], ["0", "Não"]], b => b.lashes ? "1" : "0", k => { this.sel.body.lashes = k === "1"; });
    choiceRow("Estilo de cabelo", Object.keys(BODY.HAIRS).map(k => [k, BODY.HAIRS[k]]), b => b.hairStyle, k => { this.sel.body.hairStyle = k; });
    const sw = (label, list, prop, none) => {
      const r = mkRow(label), g = document.createElement("div"); g.className = "swatches";
      const add = (c, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "sw" + (c ? "" : " none"); if (c) b.style.background = c; b.dataset.c = c || ""; b.title = title; b.setAttribute("aria-label", title); b.textContent = c ? "" : "∅"; b.addEventListener("click", () => { this.sel.body[prop] = c; this.refresh(true); b.blur(); }); g.appendChild(b); };
      add(null, none); list.forEach(c => add(c, c)); r.appendChild(g); this.bodyEls[prop] = g;
    };
    sw("Cor da pele", BODY.SKINS, "skin", "Cor da raça"); sw("Cor dos olhos", BODY.EYES, "eye", "Cor da raça");
    const act = document.createElement("div"); act.className = "mini"; act.style.marginTop = "8px";
    const bt = (txt, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.addEventListener("click", () => { fn(); this.refresh(true); b.blur(); }); act.appendChild(b); };
    bt("↺ Restaurar corpo", () => { this.sel.body = BODY.defaults(); });
    bt("🎲 Corpo aleatório", () => { this.sel.body = BODY.random(); });
    box.appendChild(act);
    const note = document.createElement("p"); note.className = "small"; note.textContent = "O corpo é só visual: não muda hitbox, alcance nem atributos, então o combate continua justo."; box.appendChild(note);
  },
  syncBody() {
    const b = this.sel.body = BODY.sanitize(this.sel.body), E = this.bodyEls; if (!E) return;
    for (const k in E.sliders) { const [inp, val] = E.sliders[k]; inp.value = b[k]; val.textContent = b[k] + "%"; }
    for (const [g, get] of E.choices) { const cur = get(b); g.querySelectorAll("button").forEach(x => { const on = x.dataset.key === cur; x.classList.toggle("sel", on); x.setAttribute("aria-checked", on); }); }
    for (const p of ["skin", "eye"]) E[p].querySelectorAll(".sw").forEach(x => x.classList.toggle("sel", (x.dataset.c || null) === b[p]));
  },
  buildSwatches(key, id) {
    const box = $(id); box.innerHTML = "";
    SWATCH[key].concat(Shop.owned(Game.profile, "colors") ? EXTRA_SWATCH[key] : []).forEach(c => { const b = document.createElement("button"); b.type = "button"; b.className = "sw"; b.style.background = c; b.dataset.c = c; b.title = c; b.setAttribute("aria-label", "Cor " + c); b.addEventListener("click", () => { this.sel[key] = c; this.touched[key] = true; this.refresh(); }); box.appendChild(b); });
    const inp = document.createElement("input"); inp.type = "color"; inp.title = "Cor personalizada"; inp.value = this.sel[key]; inp.dataset.k = key;
    inp.addEventListener("input", e => { if (Save.isColor(e.target.value)) { this.sel[key] = e.target.value.toLowerCase(); this.touched[key] = true; this.refresh(true); } });
    box.appendChild(inp);
  },
  pickRace(k) {
    const old = RACES[this.sel.raceKey]; this.sel.raceKey = k; const nw = RACES[k];
    for (const c of ["outfit", "hair", "aura"]) if (!this.touched[c] || this.sel[c] === old.defaults[c]) { this.sel[c] = nw.defaults[c]; this.touched[c] = false; }
    this.refresh();
  },
  setSel(ch, difficulty, mode) {
    this.sel = { name: ch.name, raceKey: ch.raceKey, clanKey: ch.clanKey, outfit: ch.outfit, hair: ch.hair, aura: ch.aura, accessory: ch.accessory || "none", body: BODY.sanitize(ch.body), difficulty: difficulty === "hard" ? "hard" : "normal", mode: mode === "tourney" ? "tourney" : "quick" };
    this.touched = { outfit: true, hair: true, aura: true }; $("fighterName").value = ch.name; $("difficulty").value = this.sel.difficulty; $("mode").value = this.sel.mode; this.refresh();
  },
  character() { return Save.sanitizeCharacter(this.sel); },
  refreshArena() {
    const sel = $("arena"), p = Game.profile, own = Object.keys(ARENAS).filter(k => Shop.hasArena(p, k)); sel.innerHTML = "";
    const opt = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
    own.forEach(k => opt(k, ARENAS[k].icon + " " + ARENAS[k].name)); if (own.length > 1) opt("random", "🎲 Aleatória (entre as suas)");
    const v = (p.arena === "random" && own.length > 1) || own.includes(p.arena) ? p.arena : "temple"; sel.value = v; if (p.arena !== v) p.arena = v;
  },
  shopMsg(t) { $("shopMsg").textContent = t; },
  afterShop() { this.refreshProfile(); this.buildSwatches("outfit", "swOutfit"); this.buildSwatches("hair", "swHair"); this.buildSwatches("aura", "swAura"); this.refresh(true); },
  renderShop() {
    const p = Game.profile, box = $("shopList"); box.innerHTML = ""; $("shopCredits").textContent = p.credits + " créditos";
    const head = t => { const h = document.createElement("h3"); h.textContent = t; box.appendChild(h); };
    const row = (icon, name, text, extra, btnTxt, disabled, fn) => {
      const r = document.createElement("div"); r.className = "shop-row"; const l = document.createElement("div"); const b = document.createElement("b"); b.textContent = icon + " " + name; l.appendChild(b);
      const t = document.createElement("span"); t.className = "t"; t.textContent = text; l.appendChild(t);
      if (extra) { const e = document.createElement("span"); e.className = "pips"; e.textContent = extra; l.appendChild(e); }
      const bt = document.createElement("button"); bt.type = "button"; bt.textContent = btnTxt; bt.disabled = disabled; bt.addEventListener("click", () => { fn(); bt.blur(); }); r.appendChild(l); r.appendChild(bt); box.appendChild(r);
    };
    head("Itens");
    for (const it of SHOP_ITEMS) {
      const own = Shop.owned(p, it.id);
      row(it.icon, it.name, it.text, "", own ? "✔ Comprado" : "Comprar · " + it.price, own || p.credits < it.price, () => {
        const r = Shop.buy(p, it.id); this.shopMsg(r.msg);
        if (r.ok) { if (it.id.indexOf("acc:") === 0) this.sel.accessory = it.id.slice(4); if (it.id.indexOf("arena:") === 0) p.arena = it.id.slice(6); Save.write(p); this.afterShop(); }
      });
    }
    head("Treinos permanentes");
    for (const k in UPGRADES) {
      const u = UPGRADES[k], lv = p.upgrades[k], max = lv >= UPGRADE_MAX, cost = Shop.upgradeCost(p, k);
      row(u.icon, u.name, u.text, "●".repeat(lv) + "○".repeat(UPGRADE_MAX - lv), max ? "Máximo" : "Treinar · " + cost, max || p.credits < cost, () => { const r = Shop.upgrade(p, k); this.shopMsg(r.msg); if (r.ok) this.afterShop(); });
    }
  },
  refresh(keepInput) {
    const s = this.sel;
    document.querySelectorAll("#raceList .choice").forEach(b => { const on = b.dataset.key === s.raceKey; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); });
    document.querySelectorAll("#clanList .choice").forEach(b => { const on = b.dataset.key === s.clanKey; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); });
    for (const [key, id] of [["outfit", "swOutfit"], ["hair", "swHair"], ["aura", "swAura"]]) {
      document.querySelectorAll("#" + id + " .sw").forEach(b => b.classList.toggle("sel", b.dataset.c === s[key]));
      const inp = document.querySelector("#" + id + " input"); if (inp && !keepInput) inp.value = s[key];
    }
    this.syncBody();
    $("difficulty").disabled = s.mode === "tourney";
    if (!Shop.hasAcc(Game.profile, s.accessory)) s.accessory = "none";
    document.querySelectorAll("#accList .choice").forEach(b => { const own = Shop.hasAcc(Game.profile, b.dataset.key), on = b.dataset.key === s.accessory; b.disabled = !own; b.title = own ? "" : "Disponível na loja"; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); });
    const r = RACES[s.raceKey], c = CLANS[s.clanKey], st = StatBuilder.build(s.raceKey, s.clanKey, Game.profile.level, Game.profile.upgrades);
    const rows = [["Vida", st.hp, st.hp / 150], ["Energia", st.ki, st.ki / 150], ["Velocidade", Math.round(st.speed), st.speed / 100], ["Dano", Math.round(st.damage * 100) + "%", st.damage / 1.4], ["Recarga", st.kiRegen.toFixed(1) + "/s", st.kiRegen / 8]];
    $("statBars").innerHTML = rows.map(x => '<div class="stat"><span>' + x[0] + '</span><i><b style="width:' + clamp(x[2] * 100, 4, 100) + '%"></b></i><em>' + x[1] + "</em></div>").join("");
    $("raceInfo").innerHTML = "<h3>" + r.icon + " " + r.name + " · " + r.role + "</h3><p>" + r.desc + "</p><p><b>Passiva — " + r.passive.name + ":</b> " + r.passive.text + "</p><p><b>" + r.skill.icon + " Habilidade (H) — " + r.skill.name + ":</b> " + r.skill.text + ' <span class="small">Custo ' + r.skill.cost + " · recarga " + r.skill.cd + "s</span></p>";
    $("clanInfo").innerHTML = "<h3>" + c.icon + " " + c.name + "</h3><p>" + c.text + "</p><p class='small'>Bônus de raça e clã são somados e limitados. Nível " + Game.profile.level + " incluído nos atributos.</p>";
    Preview.rebuild(s);
  },
  refreshProfile() {
    const p = Game.profile, need = StatBuilder.xpNeed(p.level), maxed = p.level >= CFG.MAX_LEVEL;
    $("profLevel").textContent = "Nível " + p.level + (maxed ? " (máx.)" : ""); $("profRank").textContent = StatBuilder.rank(p.level, p.wins);
    $("profXpBar").style.transform = "scaleX(" + (maxed ? 1 : clamp(p.xp / need, 0, 1)) + ")"; $("profXpTxt").textContent = maxed ? "Nível máximo alcançado." : "XP " + p.xp + " / " + need;
    $("profWins").textContent = p.wins; $("profLosses").textContent = p.losses; $("profCredits").textContent = p.credits; $("profTourney").textContent = p.tourneyWins; this.renderShop(); this.refreshArena();
    $("continueBtn").disabled = !p.character;
    $("saveNote").textContent = Save.available ? "O progresso é salvo automaticamente neste navegador, neste dispositivo." : "⚠ Armazenamento local indisponível: o progresso não poderá ser salvo nesta sessão.";
  },
  log(msg) { $("battleLog").textContent = msg; },
  banner(title, sub, ms, lose, buttons) {
    clearTimeout(this.bt); const b = $("banner");
    if (!title) { b.classList.add("hidden"); b.classList.remove("dim"); return; }
    $("bannerTitle").textContent = title; $("bannerTitle").className = lose ? "lose" : ""; $("bannerSub").textContent = sub || "";
    const bx = $("bannerBtns"); bx.innerHTML = "";
    if (buttons) buttons.forEach(([label, fn, cls]) => { const x = document.createElement("button"); x.textContent = label; if (cls) x.className = cls; x.addEventListener("click", () => { x.blur(); fn(); }); bx.appendChild(x); });
    b.classList.toggle("dim", !!buttons); b.classList.remove("hidden");
    if (ms && !buttons) this.bt = setTimeout(() => { b.classList.add("hidden"); }, ms);
  },
  showResult(m) {
    const res = m.result, rw = m.reward || { xp: 0, credits: 0, levelsGained: 0 };
    const title = res === "win" ? "VITÓRIA!" : res === "draw" ? "EMPATE" : "DERROTA";
    let sub = "+" + rw.xp + " XP · +" + rw.credits + " créditos";
    if (rw.levelsGained > 0) sub += " · SUBIU DE NÍVEL! (Nível " + m.profile.level + ")";
    sub += " · Patente: " + StatBuilder.rank(m.profile.level, m.profile.wins);
    if (!m.saved) sub += " · (não foi possível salvar)";
    Sound.music(false); Sound.play(res === "win" ? (rw.champion ? "champ" : "win") : "lose");
    const t = m.tourney; let ttl = title, btns = [["Revanche", () => Game.rematch(), "primary"], ["← Menu", () => Game.toMenu()]];
    if (t) {
      if (res === "win" && t.stage < t.total) { ttl = "VITÓRIA!"; sub += " · Próxima: luta " + (t.stage + 1) + "/" + t.total + (t.stage + 1 === t.total ? " (FINAL)" : ""); btns = [["Próxima luta ▶", () => Game.nextStage(), "primary"], ["← Menu", () => Game.toMenu()]]; }
      else if (res === "win") { ttl = "CAMPEÃO!"; sub = "Você venceu o torneio! " + sub + " (inclui bônus de campeão)"; btns = [["Novo torneio", () => Game.startTourney(m.character), "gold"], ["← Menu", () => Game.toMenu()]]; }
      else { ttl = "ELIMINADO"; sub = "Você caiu na luta " + t.stage + "/" + t.total + ". " + sub; btns = [["Recomeçar torneio", () => Game.startTourney(m.character), "primary"], ["← Menu", () => Game.toMenu()]]; }
    }
    this.banner(ttl, sub, 0, res === "lose", btns);
    this.log(res === "win" ? "Vitória! " + sub : res === "draw" ? "Empate por tempo. " + sub : "Derrota. " + sub);
    $("pauseBtn").disabled = true;
  },
  setBar(id, v) { if (this.cache[id] !== v) { this.cache[id] = v; $(id).style.transform = "scaleX(" + v + ")"; } },
  setText(id, v) { if (this.cache[id] !== v) { this.cache[id] = v; $(id).textContent = v; } },
  badges(f) {
    const b = [];
    if (f.awakenT > 0) b.push('<span class="badge aw">DESPERTO ' + f.awakenT.toFixed(1) + "s</span>");
    if (f.burn) b.push('<span class="badge bn">QUEIMANDO</span>');
    if (f.stun > 0 && !f.ko) b.push('<span class="badge st">ATORDOADO</span>');
    if (f.guarding) b.push('<span class="badge gd">DEFENDENDO</span>');
    return b.join("");
  },
  initHud(m) {
    this.cache = {}; this.prev = { blast: 0, dash: 0, awaken: 0, race: 0 }; const p = m.player, e = m.enemy;
    $("pIcon").textContent = p.race.icon; $("eIcon").textContent = e.race.icon;
    $("pName").textContent = p.name; $("eName").textContent = e.name;
    $("pMeta").textContent = p.race.name + " · " + CLANS[p.clanKey].name + " · Nv " + p.stats.level + " · " + StatBuilder.rank(m.profile.level, m.profile.wins);
    $("eMeta").textContent = e.race.name + " · " + CLANS[e.clanKey].name + " · Nv " + e.stats.level;
    $("skBlastCost").textContent = Math.round(p.cost("blast")); $("skDashCost").textContent = Math.round(p.cost("dash")); $("skAwakenCost").textContent = Math.round(p.cost("awaken"));
    const sk = p.race.skill; $("skRaceIc").textContent = sk.icon; $("skRaceName").textContent = sk.name; $("skRaceCost").textContent = sk.cost;
    $("pauseBtn").disabled = false; $("pauseBtn").textContent = "Pausar";
    $("pHpG").style.transform = $("eHpG").style.transform = "scaleX(1)";
  },
  updateHud(m) {
    const p = m.player, e = m.enemy;
    const hp = (f, pre) => { const v = clamp(f.hp / f.stats.hp, 0, 1); this.setBar(pre + "Hp", v); this.setBar(pre + "HpG", v); this.setText(pre + "HpTxt", Math.ceil(f.hp) + " / " + f.stats.hp); this.setBar(pre + "Ki", clamp(f.ki / f.stats.ki, 0, 1)); this.setText(pre + "KiTxt", Math.floor(f.ki) + " / " + f.stats.ki); };
    hp(p, "p"); hp(e, "e");
    const ps = this.badges(p), es = this.badges(e); if (this.cache.pS !== ps) { this.cache.pS = ps; $("pStatus").innerHTML = ps; } if (this.cache.eS !== es) { this.cache.eS = es; $("eStatus").innerHTML = es; }
    this.setText("timer", Math.ceil(m.timeLeft)); this.setText("roundTxt", m.state === "intro" ? "PREPARAR" : m.state === "fight" ? (m.tourney ? "LUTA " + m.tourney.stage + "/" + m.tourney.total : "ROUND 1") : "FIM");
    const sk = (type, id, cdId, tId) => {
      const cd = p.cd[type], mx = p.maxCd(type), el = $(id);
      this.setText(tId, cd > 0 ? cd.toFixed(1) : ""); const h = mx > 0 ? clamp(cd / mx, 0, 1) * 100 : 0; if (this.cache[cdId] !== h) { this.cache[cdId] = h; $(cdId).style.height = h + "%"; }
      el.classList.toggle("nok", p.ki < p.cost(type) && cd <= 0);
      if (this.prev[type] > 0 && cd <= 0) { el.classList.remove("ready"); void el.offsetWidth; el.classList.add("ready"); }
      this.prev[type] = cd;
    };
    sk("race", "skRace", "skRaceCd", "skRaceT"); sk("blast", "skBlast", "skBlastCd", "skBlastT"); sk("dash", "skDash", "skDashCd", "skDashT"); sk("awaken", "skAwaken", "skAwakenCd", "skAwakenT");
    $("skAwaken").classList.toggle("on", p.awakenT > 0); if (p.awakenT > 0) this.setText("skAwakenT", p.awakenT.toFixed(1) + "s");
    $("skAtk").classList.toggle("on", !!(p.act && p.act.type === "attack")); this.setText("skAtkStep", (p.comboTimer > 0 && p.comboStep > 0 ? p.comboStep + 1 : 1) + "/3");
    $("skGuard").classList.toggle("on", p.guarding);
  }
};

/* ---------- Gerenciador do jogo ---------- */
const Game = {
  profile: null, match: null, raf: 0, last: 0, acc: 0, paused: false,
  init() {
    this.profile = Save.load();
    Input.init(); Renderer.init(); Preview.init(); UI.init(); Sound.init();
    if (this.profile.character) UI.setSel(this.profile.character, this.profile.difficulty, this.profile.mode); else { UI.refresh(); }
    UI.refreshProfile(); this.bind(); Online.init(); PWA.init(); this.fit(); window.addEventListener("resize", () => this.fit());
    Preview.start();
  },
  inBattle() { return !!this.match && !$("battle").classList.contains("hidden"); },
  fit() {
    const avail = Math.min(document.querySelector(".wrap").clientWidth - 32, 1180), k = Math.floor(avail / CFG.W);
    const w = k >= 2 ? k * CFG.W : Math.max(260, avail);
    $("stage").style.width = w + "px"; document.querySelector(".hud").style.width = w + "px";
  },
  /* torneio: 5 lutas, adversários com nível e IA crescentes e chefe final */
  startTourney(character) {
    const races = Object.keys(RACES).sort(() => Math.random() - .5), clans = Object.keys(CLANS), names = ENEMY_NAMES.slice().sort(() => Math.random() - .5), pl = this.profile.level, T = CFG.TOURNEY_STAGES, roster = [];
    for (let s = 1; s <= T; s++) roster.push({ raceKey: s === T ? races[Math.floor(Math.random() * races.length)] : races[(s - 1) % races.length], clanKey: clans[Math.floor(Math.random() * clans.length)], level: clamp(pl + [0, 0, 1, 1, 2][s - 1], 1, CFG.MAX_LEVEL), tier: (s - 1) / (T - 1), name: s === T ? BOSS_NAME : names[s - 1] });
    this.tourney = { stage: 1, total: T, roster, character }; this.startMatch(character, false, true);
  },
  nextStage() { if (!this.tourney) return; this.tourney.stage++; this.startMatch(this.tourney.character, false, true); },
  startMatch(character, hard, useTourney) {
    cancelAnimationFrame(this.raf); FX.clear(); Input.reset();
    if (!useTourney) this.tourney = null;
    const tp = useTourney && this.tourney ? { stage: this.tourney.stage, total: this.tourney.total, enemy: this.tourney.roster[this.tourney.stage - 1] } : null;
    this.profile.character = character; this.profile.difficulty = hard ? "hard" : "normal"; this.profile.mode = tp ? "tourney" : "quick"; Save.write(this.profile);
    this.match = new Match(this.profile, character, hard, tp); this.paused = false; this.acc = 0; this.last = 0; Sound.unlock(); Sound.music(true);
    $("menu").classList.add("hidden"); $("battle").classList.remove("hidden"); Preview.stop();
    UI.initHud(this.match); UI.log("Prepare-se! Arena: " + ARENAS[this.match.arena].name); UI.banner(this.roundTitle(this.match), this.match.player.name + "  vs  " + this.match.enemy.name);
    this.fit(); UI.updateHud(this.match);
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  roundTitle(m) { return m.tourney ? (m.tourney.stage === m.tourney.total ? "LUTA FINAL" : "LUTA " + m.tourney.stage + "/" + m.tourney.total) : "ROUND 1"; },
  loop(ts) {
    if (!this.match) return;
    this.raf = requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(.1, this.last ? (ts - this.last) / 1000 : 0); this.last = ts;
    if (!this.paused) { this.acc += dt; let n = 0; while (this.acc >= CFG.STEP && n < 6) { this.match.update(CFG.STEP); this.acc -= CFG.STEP; n++; } if (n >= 6) this.acc = 0; }
    Renderer.draw(this.match, ts / 1000); UI.updateHud(this.match);
  },
  press(a) { const m = this.match; if (!m || this.paused || m.state !== "fight") return; m.player.press(a); },
  setPaused(v) {
    if (Online.active) return;
    const m = this.match; if (!m || m.state === "over" || m.state === "ko") return;
    this.paused = v; $("pauseBtn").textContent = v ? "Continuar" : "Pausar"; Input.reset();
    Sound.music(!v && this.match.state === "fight" || !v && this.match.state === "intro");
    if (v) UI.banner("PAUSADO", "Esc ou P para continuar", 0, false, [["Continuar", () => this.setPaused(false), "primary"], ["Revanche", () => this.rematch(true)], ["← Menu", () => this.toMenu()]]);
    else { if (m.state === "intro") UI.banner(this.roundTitle(m), m.player.name + "  vs  " + m.enemy.name); else UI.banner(null); this.last = 0; }
  },
  togglePause() { this.setPaused(!this.paused); },
  autoPause() { if (Online.active) return; if (this.match && !this.paused && (this.match.state === "fight" || this.match.state === "intro")) this.setPaused(true); },
  rematch(force) { const m = this.match; if (!m || Online.active) return; if (!force && !(m.state === "over" || this.paused)) return; this.startMatch(m.character, m.hard, !!m.tourney); },
  toMenu() {
    if (Online.active) Online.leave();
    cancelAnimationFrame(this.raf); this.raf = 0; this.match = null; this.paused = false; Input.reset(); FX.clear(); UI.banner(null); Sound.music(false);
    $("battle").classList.add("hidden"); $("menu").classList.remove("hidden"); UI.refresh(); UI.refreshProfile(); Preview.start();
  },
  bind() {
    const blur = () => { if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur(); };
    $("startBtn").addEventListener("click", () => { const c = UI.character(); UI.sel.name = c.name; $("fighterName").value = c.name; if (UI.sel.mode === "tourney") this.startTourney(c); else this.startMatch(c, UI.sel.difficulty === "hard"); });
    $("continueBtn").addEventListener("click", () => { const c = this.profile.character; if (!c) { UI.log("Ainda não há personagem salvo."); return; } UI.setSel(c, this.profile.difficulty, this.profile.mode); if (this.profile.mode === "tourney") this.startTourney(c); else this.startMatch(c, this.profile.difficulty === "hard"); });
    $("resetBtn").addEventListener("click", () => { if (confirm("Apagar TODO o progresso salvo (nível, vitórias, créditos e personagem)?")) { this.profile = Save.wipe(); UI.refresh(); UI.refreshProfile(); } });
    $("backBtn").addEventListener("click", () => { blur(); if (Online.active && !Online.guardLeave()) return; this.toMenu(); });
    $("pauseBtn").addEventListener("click", () => { blur(); this.togglePause(); });
    $("restartBtn").addEventListener("click", () => { blur(); this.rematch(true); });
    const tap = (id, fn) => $(id).addEventListener("pointerdown", e => { e.preventDefault(); fn(); });
    tap("mobileAttack", () => this.press("attack")); tap("mobileBlast", () => this.press("blast")); tap("mobileDash", () => this.press("dash")); tap("mobileRace", () => this.press("race")); tap("mobileAwaken", () => this.press("awaken")); tap("tJump", () => this.press("jump"));
    const hold = (id, key) => { const el = $(id), on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { } Input.touch[key] = true; el.classList.add("hold"); }, off = () => { Input.touch[key] = false; el.classList.remove("hold"); };
      el.addEventListener("pointerdown", on); ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => el.addEventListener(ev, off)); };
    hold("tLeft", "left"); hold("tRight", "right"); hold("mobileGuard", "guard");
    $("gameCanvas").addEventListener("pointerdown", e => {
      const m = this.match; if (!m || m.state !== "fight" || this.paused) return; e.preventDefault();
      const r = $("gameCanvas").getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (y < .4) this.press("jump"); else { Input.tapDir = x < .5 ? -1 : 1; Input.tapUntil = performance.now() + 220; }
    });
    document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest("button") && !e.target.closest(".touchpad") && e.target.id !== "muteBtn") Sound.play("click"); }, true);
    $("gameCanvas").addEventListener("contextmenu", e => e.preventDefault());
  }
};

/* depuração/teste: expõe módulos sem alterar o jogo */
window.DragonArena = { Online, NetView, BODY, Shop, ARENAS, SHOP_ITEMS, UPGRADES, UPGRADE_MAX, Sound, Game, Match, Fighter, Combat, AI, FX, Input, Save, StatBuilder, Progress, RACES, CLANS, CFG, UI, MOVES, Sprites, Renderer };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Game.init()); else Game.init();
})();
