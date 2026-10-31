
/* ---------- Arenas, loja e cosméticos (dados) ---------- */
const ARENAS = {
  temple: { id: "temple", name: "Templo da Lua", icon: "🌙", price: 0, vig: "4,6,20,.7", ambient: null, lights: [{ x: 40, kind: "torch", c: "#ff8a30" }, { x: 280, kind: "torch", c: "#ff8a30" }] },
  volcano: { id: "volcano", name: "Vulcão Ardente", icon: "🌋", price: 200, vig: "22,2,2,.72", ambient: "embers", lights: [{ x: 40, kind: "brazier", c: "#ff5a1a" }, { x: 280, kind: "brazier", c: "#ff5a1a" }] },
  neon: { id: "neon", name: "Cidade Neon", icon: "🌆", price: 300, vig: "10,0,34,.7", ambient: "rain", lights: [{ x: 30, kind: "neon", c: "#46e6ff" }, { x: 290, kind: "neon", c: "#ff4fa0" }] },
  garden: { id: "garden", name: "Jardim Celeste", icon: "☁️", price: 400, vig: "30,50,110,.28", ambient: "petals", lights: [{ x: 40, kind: "crystal", c: "#7fe8ff" }, { x: 280, kind: "crystal", c: "#ffd0f0" }] }
};
const ACCESSORIES = {
  none: { id: "none", name: "Nenhum", icon: "—", price: 0 },
  band: { id: "band", name: "Faixa de combate", icon: "🎗️", price: 120, text: "Uma faixa na cor da sua energia, que balança com o movimento." },
  shades: { id: "shades", name: "Óculos escuros", icon: "🕶️", price: 180, text: "Visual frio, com um brilho no vidro." },
  glow: { id: "glow", name: "Brilho eterno", icon: "✨", price: 250, text: "Aura sutil permanente, com faíscas, mesmo sem despertar." }
};
const EXTRA_SWATCH = {
  outfit: ["#ffd45e", "#ff9a3c", "#c0392b", "#8e44ad", "#16a085", "#1a1a2e", "#9aa7bd", "#f06fb0"],
  hair: ["#ffffff", "#c0392b", "#27ae60", "#2980b9", "#f06fb0", "#ffcc99", "#6b4423", "#00e5ff"],
  aura: ["#00e5ff", "#ff3df2", "#a6ff00", "#ff6a00", "#ffffff", "#ffe066", "#8e7bff", "#ff2d55"]
};
/* melhorias permanentes: pequenas, com teto de 5 níveis, somadas à mesma fórmula de atributos */
const UPGRADES = {
  hp: { name: "Treino de vida", icon: "❤️", per: .02, text: "+2% de vida por nível" },
  dmg: { name: "Treino de força", icon: "💪", per: .01, text: "+1% de dano por nível" },
  regen: { name: "Treino de energia", icon: "🔋", per: .02, text: "+2% de regeneração de energia por nível" }
};
const UPGRADE_MAX = 5, UPGRADE_COST = [100, 160, 240, 340, 460];
const SHOP_ITEMS = [
  { id: "arena:volcano", name: "Arena: Vulcão Ardente", icon: "🌋", price: 200, text: "Cenário de lava, brasas e basalto." },
  { id: "arena:neon", name: "Arena: Cidade Neon", icon: "🌆", price: 300, text: "Metrópole sob chuva e letreiros luminosos." },
  { id: "arena:garden", name: "Arena: Jardim Celeste", icon: "☁️", price: 400, text: "Ilhas flutuantes e colunas de mármore, em pleno dia." },
  { id: "colors", name: "Pacote de cores especiais", icon: "🎨", price: 150, text: "8 cores extras para roupa, cabelo e energia." },
  { id: "acc:band", name: "Acessório: Faixa de combate", icon: "🎗️", price: 120, text: ACCESSORIES.band.text },
  { id: "acc:shades", name: "Acessório: Óculos escuros", icon: "🕶️", price: 180, text: ACCESSORIES.shades.text },
  { id: "acc:glow", name: "Acessório: Brilho eterno", icon: "✨", price: 250, text: ACCESSORIES.glow.text }
];
const Shop = {
  owned(p, id) { return p.owned.indexOf(id) >= 0; },
  hasArena(p, id) { return id === "temple" || this.owned(p, "arena:" + id); },
  hasAcc(p, id) { return id === "none" || this.owned(p, "acc:" + id); },
  buy(p, id) {
    const it = SHOP_ITEMS.find(x => x.id === id); if (!it || this.owned(p, id)) return { ok: false, msg: "Item indisponível." };
    if (p.credits < it.price) return { ok: false, msg: "Créditos insuficientes." };
    p.credits -= it.price; p.owned.push(id); Save.write(p); return { ok: true, msg: it.name + " comprado!" };
  },
  upgradeCost(p, key) { const r = p.upgrades[key]; return r >= UPGRADE_MAX ? 0 : UPGRADE_COST[r]; },
  upgrade(p, key) {
    if (!UPGRADES[key]) return { ok: false, msg: "Melhoria inválida." }; if (p.upgrades[key] >= UPGRADE_MAX) return { ok: false, msg: "Nível máximo." };
    const c = this.upgradeCost(p, key); if (p.credits < c) return { ok: false, msg: "Créditos insuficientes." };
    p.credits -= c; p.upgrades[key]++; Save.write(p); return { ok: true, msg: UPGRADES[key].name + " → nível " + p.upgrades[key] };
  },
  resolveArena(p) {                                                                 // "random" sorteia entre as arenas que você possui
    if (p.arena !== "random" && this.hasArena(p, p.arena)) return p.arena;
    const own = Object.keys(ARENAS).filter(k => this.hasArena(p, k)); return own[Math.floor(Math.random() * own.length)];
  }
};

/* ---------- Construtores de cenário (recebem o Renderer para reutilizar utilitários) ---------- */
const ArenaBuilders = {
  vig(r, rgba) { const [vg, v] = r.mk(CFG.W, CFG.H), g = v.createRadialGradient(CFG.W / 2, CFG.H / 2, CFG.H * .45, CFG.W / 2, CFG.H / 2, CFG.W * .62); g.addColorStop(0, "rgba(" + rgba.split(",").slice(0, 3).join(",") + ",0)"); g.addColorStop(1, "rgba(" + rgba + ")"); v.fillStyle = g; v.fillRect(0, 0, CFG.W, CFG.H); return r.posterize(vg, 5); },
  disc(s, cx, cy, rad, pick) { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y); if (d <= rad) { s.fillStyle = pick(x, y, d, rad); s.fillRect(cx + x, cy + y, 1, 1); } } },
  line(x, x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); x.fillStyle = col; for (let i = 0; i <= n; i++) { const k = i / n; x.fillRect(Math.round(lerp(x0, x1, k)), Math.round(lerp(y0, y1, k)), 1, 1); } },
  floorGrad(fx, top, bot, FY) { for (let y = FY; y < CFG.H; y++) { const t = (y - FY) / (CFG.H - FY); fx.fillStyle = "rgb(" + [0, 1, 2].map(i => Math.round(lerp(top[i], bot[i], t))).join(",") + ")"; fx.fillRect(0, y, CFG.W, 1); } },

  volcano(r) {
    const W = CFG.W + 40, H = CFG.H, FY = 136, rg = r.rng(21), L = {};
    let [sky, s] = r.mk(W, H); r.ditherGradient(s, W, H, [[0, "#150404"], [.4, "#4a0e0a"], [.7, "#a82e10"], [.88, "#e8741e"], [1, "#ffb347"]], 12);
    for (let i = 0; i < 80; i++) { s.fillStyle = rg() < .3 ? "#ff9a50" : "#5a2018"; s.fillRect(Math.floor(rg() * W), Math.floor(rg() * 100), 1, 1); }
    this.disc(s, 80, 48, 22, (x, y, d, rad) => d > rad - 1.5 ? "#ffe0b0" : (x * -.5 + y * -.6) / rad > .1 ? "#ffcf9a" : "#e08a4a");
    L.sky = sky;
    let [far, f] = r.mk(W, H);
    for (let x = 0; x < W; x++) { const h = 30 + Math.sin(x * .05 + 1) * 10 + Math.sin(x * .13) * 4, top = Math.round(118 - h); f.fillStyle = "#2a0d10"; f.fillRect(x, top, 1, FY - top); f.fillStyle = "#4a1a14"; f.fillRect(x, top, 1, 1); }
    const px = 205, py = 34;
    for (let x = 0; x < W; x++) { const dx = Math.abs(x - px); let top = dx < 10 ? py : Math.round(py + (dx - 10) * .72 + Math.sin(x * .4) * 1.2); if (top >= FY) continue; f.fillStyle = "#1a0a0c"; f.fillRect(x, top, 1, FY - top); f.fillStyle = x < px ? "#4a1a14" : "#2a0f12"; f.fillRect(x, top, 1, 2); }
    f.fillStyle = "#ff7a20"; f.fillRect(px - 9, py - 1, 19, 3); f.fillStyle = "#ffd070"; f.fillRect(px - 5, py - 1, 11, 1);
    let lx = px + 6; for (let y = py + 2; y < FY - 6; y += 2) { lx += Math.round(rg() * 4 - 1.2); f.fillStyle = "#ff5a14"; f.fillRect(lx, y, 2, 2); f.fillStyle = "#ffc060"; f.fillRect(lx, y, 1, 1); }
    s.globalAlpha = 1; far.getContext("2d").globalAlpha = .5; f.drawImage(r.glow("#ff6a20", 40), px - 40, py - 40, 80, 80); f.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { const x = Math.floor(rg() * W), y = 30 + Math.floor(rg() * 40); f.fillStyle = "#3a1a1a66"; r.fillEllipseRows(f, x, y, 14 + Math.floor(rg() * 10), 3, "#3a1a1a66"); }
    L.far = far;
    let [mid, m] = r.mk(W, H);
    for (let x = -4; x < W; x += 11) { const h = 22 + ((x * 37) % 31) + (x % 3) * 4, top = FY - h; m.fillStyle = "#1e0f13"; m.fillRect(x, top, 10, h); m.fillStyle = "#3a1c22"; m.fillRect(x, top, 2, h); m.fillStyle = "#52262c"; m.fillRect(x, top, 10, 2); m.fillStyle = "#12080b"; m.fillRect(x + 8, top + 2, 2, h);
      for (let k = 0; k < 2; k++) { const cy = top + 6 + Math.floor(rg() * (h - 12)); m.fillStyle = "#ff6a1a"; m.fillRect(x + 3 + Math.floor(rg() * 3), cy, 1, 3 + Math.floor(rg() * 4)); } }
    m.fillStyle = "#0e0608"; m.fillRect(0, FY - 8, W, 8); m.fillStyle = "#ff7a30"; for (let x = 0; x < W; x += 3) if (rg() < .5) m.fillRect(x, FY - 2, 2, 1);
    L.mid = mid;
    let [fl, fx] = r.mk(CFG.W, H); this.floorGrad(fx, [44, 21, 25], [15, 6, 8], FY);
    fx.fillStyle = "#3a1c20"; [5, 11, 19, 30].forEach(o => fx.fillRect(0, FY + o, CFG.W, 1));
    for (let vx = -320; vx <= 640; vx += 40) this.line(fx, 160 + (vx - 160) * .42, FY + 3, vx, H, "#3a1c20");
    for (let i = 0; i < 16; i++) { let x = Math.floor(rg() * CFG.W), y = FY + 4 + Math.floor(rg() * 38); const n = 8 + Math.floor(rg() * 22); for (let k = 0; k < n; k++) { fx.fillStyle = "#ff5a14"; fx.fillRect(x, y, 1, 1); if (k % 2) { fx.fillStyle = "#ffc060"; fx.fillRect(x, y, 1, 1); } x += Math.round(rg() * 2 - .6); y += Math.round(rg() * 1.4 - .5); if (y > H - 1 || y < FY + 2) break; } }
    fx.fillStyle = "#ff7a30"; fx.fillRect(0, FY, CFG.W, 1); fx.fillStyle = "#8a3418"; fx.fillRect(0, FY + 1, CFG.W, 2); fx.fillStyle = "#4a1a14"; fx.fillRect(0, FY + 3, CFG.W, 1);
    L.floor = fl; L.vig = this.vig(r, ARENAS.volcano.vig); return L;
  },

  neon(r) {
    const W = CFG.W + 40, H = CFG.H, FY = 136, rg = r.rng(33), L = {};
    let [sky, s] = r.mk(W, H); r.ditherGradient(s, W, H, [[0, "#08021c"], [.45, "#2a0a52"], [.78, "#7a1a82"], [1, "#ff4fa0"]], 12);
    for (let i = 0; i < 40; i++) { s.fillStyle = rg() < .3 ? "#ffffff" : "#b08aff"; s.fillRect(Math.floor(rg() * W), Math.floor(rg() * 70), 1, 1); }
    this.disc(s, 245, 66, 32, (x, y, d, rad) => { const k = (y + rad) / (rad * 2); if (y > 0 && (y % 6) < y / 7) return "rgba(0,0,0,0)"; return k < .5 ? "#ffe45e" : k < .75 ? "#ff9a5a" : "#ff2d95"; });
    s.clearRect(0, 0, 0, 0); L.sky = sky;
    let [far, f] = r.mk(W, H);
    for (let x = 0, i = 0; x < W; x += 14 + Math.floor(rg() * 12), i++) { const w = 14 + Math.floor(rg() * 14), h = 40 + Math.floor(rg() * 50), top = FY - h; f.fillStyle = "#1a0b45"; f.fillRect(x, top, w, h); f.fillStyle = "#2c1470"; f.fillRect(x, top, w, 1); f.fillStyle = "#6a3aa0"; for (let k = 0; k < 10; k++) if (rg() < .6) f.fillRect(x + 2 + Math.floor(rg() * (w - 4)), top + 3 + Math.floor(rg() * (h - 8)), 1, 1); }
    L.far = far;
    let [mid, m] = r.mk(W, H); let x = -6, bi = 0;
    while (x < W) {
      const w = 30 + Math.floor(rg() * 22), h = 52 + Math.floor(rg() * 44), top = FY - h; m.fillStyle = "#0f0730"; m.fillRect(x, top, w, h); m.fillStyle = "#2a1366"; m.fillRect(x, top, w, 2); m.fillRect(x, top, 2, h); m.fillStyle = "#07031a"; m.fillRect(x + w - 3, top, 3, h);
      for (let wy = top + 6; wy < FY - 12; wy += 7) for (let wx = x + 5; wx < x + w - 6; wx += 6) { const q = rg(); m.fillStyle = q < .45 ? "#1c1050" : q < .65 ? "#ffd45e" : q < .85 ? "#46e6ff" : "#ff4fa0"; m.fillRect(wx, wy, 3, 4); }
      if (bi % 2 === 0) { const col = bi % 4 === 0 ? "#46e6ff" : "#ff4fa0", sy = top + 12; m.fillStyle = col; m.fillRect(x + 4, sy, w - 8, 1); m.fillRect(x + 4, sy + 8, w - 8, 1); m.fillRect(x + 4, sy, 1, 9); m.fillRect(x + w - 5, sy, 1, 9); m.fillStyle = "#fff"; for (let k = 0; k < (w - 12) / 3; k++) if (rg() < .7) m.fillRect(x + 7 + k * 3, sy + 3, 2, 3); }
      if (rg() < .5) { m.fillStyle = "#3a2a6a"; m.fillRect(x + (w >> 1), top - 10, 1, 10); m.fillStyle = "#ff2d55"; m.fillRect(x + (w >> 1), top - 11, 1, 1); }
      x += w + 2; bi++;
    }
    m.fillStyle = "#07031a"; m.fillRect(0, FY - 10, W, 10);
    L.mid = mid;
    let [fl, fx] = r.mk(CFG.W, H); this.floorGrad(fx, [30, 16, 60], [8, 4, 24], FY);
    fx.fillStyle = "#4a1f80"; [5, 11, 19, 30].forEach(o => fx.fillRect(0, FY + o, CFG.W, 1));
    for (let vx = -320; vx <= 640; vx += 36) this.line(fx, 160 + (vx - 160) * .42, FY + 3, vx, H, "#6a2aa0");
    fx.fillStyle = "#ffd45e"; for (let dx = 0; dx < CFG.W; dx += 20) fx.fillRect(dx, FY + 22, 11, 1);
    for (let k = 0; k < 22; k++) { const rx = Math.floor(rg() * CFG.W), col = rg() < .5 ? "#46e6ff" : "#ff4fa0", len = 8 + Math.floor(rg() * 24); for (let j = 0; j < len; j++) { fx.globalAlpha = .55 * (1 - j / len); fx.fillStyle = col; fx.fillRect(rx, FY + 3 + j, 1, 1); } fx.globalAlpha = 1; }
    fx.fillStyle = "#46e6ff"; fx.fillRect(0, FY, CFG.W, 1); fx.fillStyle = "#1a4a7a"; fx.fillRect(0, FY + 1, CFG.W, 2);
    L.floor = fl; L.vig = this.vig(r, ARENAS.neon.vig); return L;
  },

  garden(r) {
    const W = CFG.W + 40, H = CFG.H, FY = 136, rg = r.rng(55), L = {};
    let [sky, s] = r.mk(W, H); r.ditherGradient(s, W, H, [[0, "#3a9aff"], [.45, "#7cc4ff"], [.8, "#cfeaff"], [1, "#fff0d0"]], 12);
    s.globalAlpha = .6; s.drawImage(r.glow("#fff6c0", 46), 24, -2); s.globalAlpha = 1;
    this.disc(s, 70, 44, 15, (x, y, d, rad) => d > rad - 1.5 ? "#ffe9a0" : "#fff7c8");
    for (let i = 0; i < 9; i++) { const cx = 20 + Math.floor(rg() * (W - 40)), cy = 24 + Math.floor(rg() * 70); for (let k = 0; k < 4; k++) { const ox = cx + k * 7 - 10, rr = 5 + Math.floor(rg() * 4); r.fillEllipseRows(s, ox, cy + (k % 2 ? -2 : 0), rr + 3, rr - 1, "#ffffff"); r.fillEllipseRows(s, ox, cy + 3 + (k % 2 ? -2 : 0), rr + 2, 2, "#cfe0f8"); } }
    L.sky = sky;
    let [far, f] = r.mk(W, H);
    for (let layer = 0; layer < 2; layer++) for (let x = 0; x < W; x++) { const h = 24 + Math.sin(x * (layer ? .05 : .03) + layer * 3) * 10 + Math.sin(x * .12) * 3, top = Math.round((layer ? 126 : 112) - h); f.fillStyle = layer ? "#8fb4e6" : "#a9c8f0"; f.fillRect(x, top, 1, FY - top); f.fillStyle = layer ? "#b0cdf2" : "#c8dcf8"; f.fillRect(x, top, 1, 1); }
    [[40, 56, 34], [150, 40, 40], [260, 62, 36]].forEach(([x, y, w]) => { r.fillEllipseRows(f, x, y + 2, w / 2, 7, "#7a5a3a"); for (let k = 0; k < 7; k++) { f.fillStyle = "#5a4028"; f.fillRect(x - 5 + k * 2, y + 8 + (k % 3) * 2, 2, 4 + (k % 2) * 3); } f.fillStyle = "#5cc060"; f.fillRect(x - w / 2, y - 3, w, 3); f.fillStyle = "#8ae080"; f.fillRect(x - w / 2, y - 3, w, 1); f.fillStyle = "#2f8a48"; f.fillRect(x - 5, y - 10, 8, 7); f.fillRect(x + 6, y - 8, 6, 5); f.fillStyle = "#58b868"; f.fillRect(x - 5, y - 10, 8, 2); f.fillStyle = "#a0e0ff"; f.fillRect(x + w / 2 - 6, y + 4, 1, 28); f.fillStyle = "#e8f8ff"; f.fillRect(x + w / 2 - 6, y + 4, 1, 4); });
    L.far = far;
    let [mid, m] = r.mk(W, H); const wallTop = 66;
    m.fillStyle = "#d8d4ea"; m.fillRect(0, wallTop, W, FY - wallTop); m.fillStyle = "#c2bedb"; for (let y = wallTop + 6; y < FY; y += 10) m.fillRect(0, y, W, 1);
    m.fillStyle = "#b8b0d8"; m.fillRect(0, wallTop, W, 4); m.fillStyle = "#ffffff"; m.fillRect(0, wallTop, W, 1); m.fillStyle = "#e0c060"; m.fillRect(0, wallTop + 4, W, 1);
    m.globalCompositeOperation = "destination-out"; for (let i = 0; i < 4; i++) { const cx = 40 + i * 100; r.fillEllipseRows(m, cx, 98, 22, 24, "#000", true); m.fillStyle = "#000"; m.fillRect(cx - 22, 98, 45, FY - 98); } m.globalCompositeOperation = "source-over";
    for (let i = 0; i < 4; i++) { const cx = 40 + i * 100; r.ellipsePx(m, cx, 98, 23, 24, "#a8a2cc", 1, true); r.ellipsePx(m, cx, 98, 24, 25, "#f4f0ff", 1, true); }
    for (let i = 0; i < 5; i++) { const px = i * 100 - 10; m.fillStyle = "#efeaf8"; m.fillRect(px - 8, 60, 18, FY - 60); m.fillStyle = "#b5b0d0"; m.fillRect(px + 6, 66, 4, FY - 66); m.fillStyle = "#cfcae6"; for (let k = -4; k <= 6; k += 4) m.fillRect(px + k, 68, 1, FY - 74); m.fillStyle = "#ffffff"; m.fillRect(px - 10, 56, 22, 5); m.fillRect(px - 10, FY - 6, 22, 6); m.fillStyle = "#e0c060"; m.fillRect(px - 10, 60, 22, 1); }
    for (let i = 0; i < 22; i++) { const vx = Math.floor(rg() * W), len = 8 + Math.floor(rg() * 26); m.fillStyle = "#3e9a52"; m.fillRect(vx, wallTop + 4, 1, len); m.fillStyle = "#6ad07a"; for (let k = 3; k < len; k += 5) m.fillRect(vx - 1, wallTop + 4 + k, 3, 1); }
    [66, 268].forEach(bx => { m.fillStyle = "#2a5ac0"; m.fillRect(bx, 76, 10, 26); m.fillStyle = "#4a7ae0"; m.fillRect(bx, 76, 10, 2); m.fillStyle = "#ffd45e"; m.fillRect(bx + 4, 82, 2, 10); m.fillRect(bx + 2, 86, 6, 2); });
    L.mid = mid;
    let [fl, fx] = r.mk(CFG.W, H); this.floorGrad(fx, [236, 232, 248], [160, 156, 192], FY);
    fx.fillStyle = "#9a96b8"; [5, 11, 19, 30].forEach(o => fx.fillRect(0, FY + o, CFG.W, 1));
    for (let vx = -320; vx <= 640; vx += 36) this.line(fx, 160 + (vx - 160) * .42, FY + 3, vx, H, "#9a96b8");
    r.ellipsePx(fx, 160, 160, 78, 13, "#e0b040"); r.ellipsePx(fx, 160, 160, 62, 10, "#c89a30"); r.ellipsePx(fx, 160, 160, 40, 6, "#e0b040");
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; fx.fillStyle = "#b07a10"; fx.fillRect(Math.round(160 + Math.cos(a) * 70), Math.round(160 + Math.sin(a) * 11.5), 2, 1); }
    fx.fillStyle = "#ffffff"; fx.fillRect(0, FY, CFG.W, 1); fx.fillStyle = "#c8c4e0"; fx.fillRect(0, FY + 1, CFG.W, 2);
    L.floor = fl; L.vig = this.vig(r, ARENAS.garden.vig); return L;
  }
};
