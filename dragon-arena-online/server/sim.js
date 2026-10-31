"use strict";
/* ARQUIVO GERADO por build.py — não edite. */
module.exports = (() => {

/* =====================================================================
 *  DRAGON ARENA 0.2
 *  Módulos: CFG · Dados (RACES/CLANS/RANKS) · StatBuilder · Save/Progress
 *           Input · FX · Sprites · Fighter · Combat · AI · Match
 *           Renderer · UI · Game
 * ===================================================================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
const R = Math.round;
const ease = t => t * t * (3 - 2 * t);
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);

/* ---------- Configuração geral (unidades = pixels da resolução interna 320x180) ---------- */
const CFG = {
  W: 320, H: 180, GROUND: 150, ARENA_L: 16, ARENA_R: 304,
  STEP: 1 / 60, GRAVITY: 520, JUMP_V: 200,
  BODY_W: 12, BODY_H: 34, BUFFER: .14, ROUND_TIME: 90, MAX_LEVEL: 20, VERSION: 2,
  TOURNEY_STAGES: 5, PARRY_WINDOW: .12, KO_TIME: 1.7, INTRO_TIME: 1.8
};

/* ---------- Dados de raças (extensível: basta adicionar uma entrada) ----------
 * mods  -> modificadores mecânicos genéricos lidos pelo código de combate.
 * look  -> parâmetros visuais lidos pelo renderizador (estilos registrados em Sprites).
 * future-> espaço reservado para habilidades e transformações exclusivas.        */
const DEFAULT_MODS = {
  atkSpeed: 1, stunResist: 1, knockResist: 1, blastCostMul: 1, blastDmgMul: 1, blastRadius: 4,
  dashCdMul: 1, dashCostMul: 1, dashDamage: 3, doubleJump: false, burn: null, lowHpRegen: null, kiOnHit: 4
};
const RACES = {
  ignar: {
    id: "ignar", name: "Ignar", role: "Pressão ofensiva", icon: "🔥",
    desc: "Guerreiros de sangue vulcânico que sufocam o rival com combos rápidos.",
    passive: { name: "Punhos acesos", text: "Golpes 10% mais rápidos. O 3º golpe do combo incendeia o alvo, causando dano contínuo." },
    base: { hp: 100, ki: 90, speed: 78, kiRegen: 3.5 }, bonus: { damage: .06 },
    mods: { atkSpeed: 1.1, burn: { dps: 1.6, dur: 2.5 } },
    look: { skin: "#d98c63", eye: "#ffe27a", accent: "#ff7a2e", build: 0, hair: "flame", back: "sash", torso: "gi", arm: ["skin", "wrap", "wrap"], leg: ["outfitD", "outfitD", "wrap"], armW: 3, legW: 4 },
    skill: { kind: "pillar", name: "Erupção", icon: "🌋", cost: 30, cd: 9, text: "Ergue uma coluna de fogo à frente que lança o rival ao ar e o incendeia." },
    defaults: { outfit: "#ff7a3d", hair: "#ffd45e", aura: "#ff9a3c" },
    future: { skills: [], transformations: [] }
  },
  vortice: {
    id: "vortice", name: "Vórtice", role: "Mobilidade e investidas", icon: "🌀",
    desc: "Lutadores ágeis que dominam o espaço da arena com velocidade e saltos.",
    passive: { name: "Passo veloz", text: "Duplo pulo. Investida com recarga 40% menor e custo reduzido, que causa dano ao colidir." },
    base: { hp: 92, ki: 100, speed: 92, kiRegen: 4 }, bonus: {},
    mods: { dashCdMul: .6, dashCostMul: .8, dashDamage: 7, doubleJump: true },
    look: { skin: "#e9c7b5", eye: "#7cecff", accent: "#7cecff", build: -1, hair: "stream", back: "scarf", torso: "suit", arm: ["outfit", "outfit", "accent"], leg: ["outfit", "outfit", "accent"], armW: 3, legW: 4 },
    skill: { kind: "phase", name: "Passo fantasma", icon: "👻", cost: 28, cd: 8, text: "Some por um instante (invulnerável por 0,14 s), reaparece atrás do rival e o corta." },
    defaults: { outfit: "#62d9ff", hair: "#eeeeff", aura: "#7cecff" },
    future: { skills: [], transformations: [] }
  },
  luminar: {
    id: "luminar", name: "Luminar", role: "Energia e longo alcance", icon: "✨",
    desc: "Seres de luz que dominam o combate à distância com rajadas poderosas.",
    passive: { name: "Núcleo luminoso", text: "Rajadas custam 30% menos energia, são maiores e causam 20% mais dano. Maior regeneração de energia." },
    base: { hp: 92, ki: 125, speed: 78, kiRegen: 6.5 }, bonus: { damage: .02 },
    mods: { blastCostMul: .7, blastDmgMul: 1.2, blastRadius: 6 },
    look: { skin: "#f6d9c4", eye: "#b78cff", accent: "#ffe08a", build: 0, hair: "halo", back: "cape", torso: "tabard", arm: ["outfit", "white", "white"], leg: ["white", "white", "accent"], armW: 3, legW: 4 },
    skill: { kind: "beam", name: "Raio solar", icon: "☀️", cost: 40, cd: 10, text: "Concentra energia por um instante e dispara um raio grande e veloz." },
    defaults: { outfit: "#b78cff", hair: "#ffd45e", aura: "#d9b8ff" },
    future: { skills: [], transformations: [] }
  },
  mutante: {
    id: "mutante", name: "Mutante", role: "Resistência e regeneração", icon: "🧬",
    desc: "Corpos adaptados à dor: aguentam golpes e se recuperam quando acuados.",
    passive: { name: "Adaptação", text: "35% menos atordoamento e 40% menos repulsão. Abaixo de 45% de vida regenera até 22% da vida máxima por luta." },
    base: { hp: 120, ki: 90, speed: 70, kiRegen: 3 }, bonus: { damage: -.04 },
    mods: { stunResist: .65, knockResist: .6, lowHpRegen: { threshold: .45, rate: 2.4, pool: .22 } },
    look: { skin: "#7bd88f", eye: "#ff5f75", accent: "#efe6c4", build: 4, hair: "crest", back: "tail", torso: "brute", arm: ["skin", "skin", "skinD"], leg: ["skin", "skin", "outfitD"], armW: 4, legW: 5 },
    skill: { kind: "armor", name: "Carapaça", icon: "🛡️", cost: 30, cd: 14, text: "Por 3,5 s não é atordoado e sofre 40% menos dano, mas anda 15% mais devagar." },
    defaults: { outfit: "#7ef0a1", hair: "#ffd45e", aura: "#7ef0a1" },
    future: { skills: [], transformations: [] }
  }
};
const CLANS = {
  chama: { id: "chama", name: "Clã da Chama", icon: "🔥", short: "+6% de dano", bonus: { damage: .06 },
    text: "Ofensiva refinada: +6% de dano causado." },
  muralha: { id: "muralha", name: "Clã da Muralha", icon: "🧱", short: "Defesa sólida", bonus: { taken: -.08, guard: -.05, speed: -.02 },
    text: "Defesa sólida: -8% de dano sofrido, bloqueios absorvem mais (recebe 20% em vez de 25%) e -2% de velocidade." },
  vazio: { id: "vazio", name: "Clã do Vazio", icon: "🌑", short: "Agilidade e energia", bonus: { speed: .04, kiRegen: .15, dashCd: -.1 },
    text: "Agilidade: +4% de velocidade, +15% de regeneração de energia e investida com recarga 10% menor." }
};
const RANKS = [ // do maior para o menor (mesmos requisitos da versão 0.1)
  { name: "Lenda", level: 10, wins: 10 }, { name: "Mestre", level: 6, wins: 5 },
  { name: "Elite", level: 3, wins: 2 }, { name: "Combatente", level: 2, wins: 0 }, { name: "Iniciante", level: 1, wins: 0 }
];
const SWATCH = {
  outfit: ["#ffb35c", "#62d9ff", "#b78cff", "#7ef0a1", "#f4f4ff", "#ff5f75", "#3d5bd6", "#2b2f45"],
  hair: ["#22243a", "#ffd45e", "#ff5e74", "#7cecff", "#eeeeff", "#b78cff", "#7ef0a1", "#ff9a3c"],
  aura: ["#ff9a3c", "#7cecff", "#d9b8ff", "#7ef0a1", "#ffd45e", "#ff5e74", "#eeeeff", "#5b8cff"]
};

/* ---------- Corpo do personagem (apenas aparência: não altera hitbox, hurtbox nem atributos) ---------- */
const BODY = {
  FIELDS: {
    height: [88, 112, "Altura", "%"], torsoLen: [85, 120, "Comprimento do tronco", "%"], shoulders: [80, 125, "Ombros", "%"], waist: [70, 120, "Cintura", "%"], hips: [80, 125, "Quadril", "%"],
    armLen: [80, 125, "Comprimento dos braços", "%"], armThick: [70, 140, "Espessura dos braços", "%"], legLen: [80, 125, "Comprimento das pernas", "%"], legThick: [70, 140, "Espessura das pernas", "%"]
  },
  GENDERS: {
    masc: { name: "Masculino", icon: "♂", preset: { shoulders: 110, waist: 100, hips: 96, armThick: 110, legThick: 102, torsoLen: 100 }, lashes: false },
    fem: { name: "Feminino", icon: "♀", preset: { shoulders: 92, waist: 80, hips: 110, armThick: 88, legThick: 96, torsoLen: 98 }, lashes: true },
    neutro: { name: "Neutro", icon: "⚧", preset: { shoulders: 100, waist: 94, hips: 100, armThick: 100, legThick: 100, torsoLen: 100 }, lashes: false }
  },
  EYE_SIZES: ["Pequenos", "Médios", "Grandes"], EYE_SHAPES: ["Neutro", "Sério", "Suave"],
  HAIRS: { race: "Da raça", flame: "Chamas", stream: "Longo solto", halo: "Longo com halo", crest: "Crista", short: "Curto", ponytail: "Rabo de cavalo", bald: "Careca" },
  SKINS: ["#ffd9bd", "#f2c29b", "#e9c7b5", "#d9a273", "#b97a4b", "#8a5634", "#5c3a24", "#3b2619", "#f3e1ff", "#9fe7ff", "#a6e8a0", "#c7ccd6"],
  EYES: ["#2a2a2a", "#5b3a1e", "#2f7bd9", "#27a35a", "#8e5bd6", "#e04a3f", "#f0b429", "#46e6ff"],
  defaults() { const o = { gender: "neutro", eyeSize: 1, eyeShape: 0, eyeY: 0, lashes: false, hairStyle: "race", skin: null, eye: null }; for (const k in this.FIELDS) o[k] = 100; return o; },
  applyGender(b, g) { const G = this.GENDERS[g]; if (!G) return b; b.gender = g; for (const k in G.preset) b[k] = G.preset[k]; b.lashes = G.lashes; return b; },
  sanitize(raw) {
    const b = this.defaults(); if (!raw || typeof raw !== "object") return b;
    b.gender = this.GENDERS[raw.gender] ? raw.gender : "neutro";
    for (const k in this.FIELDS) b[k] = Save.int(raw[k], this.FIELDS[k][0], this.FIELDS[k][1], 100);
    b.eyeSize = Save.int(raw.eyeSize, 0, 2, 1); b.eyeShape = Save.int(raw.eyeShape, 0, 2, 0); b.eyeY = Save.int(raw.eyeY, -1, 1, 0);
    b.lashes = raw.lashes === true; b.hairStyle = this.HAIRS[raw.hairStyle] ? raw.hairStyle : "race";
    b.skin = Save.isColor(raw.skin) ? raw.skin.toLowerCase() : null; b.eye = Save.isColor(raw.eye) ? raw.eye.toLowerCase() : null;
    return b;
  },
  random(rng) {      // inimigos ganham corpos variados (só visual)
    rng = rng || Math.random; const g = ["masc", "fem", "neutro"][Math.floor(rng() * 3)], b = this.applyGender(this.defaults(), g), j = n => Math.round((rng() - .5) * 2 * n);
    for (const k in this.FIELDS) b[k] = clamp(b[k] + j(k === "height" ? 8 : 12), this.FIELDS[k][0], this.FIELDS[k][1]);
    b.eyeSize = Math.floor(rng() * 3); b.eyeShape = Math.floor(rng() * 3); return b;
  }
};

const BOSS_NAME = "Imperador Zhar";
const ENEMY_NAMES = ["Kaizen", "Ryuga", "Zephyr", "Orion", "Nyx", "Vega", "Brutus", "Aurelio", "Sol", "Draven"];

/* ---------- Construtor de atributos: UMA única fórmula aditiva e limitada ---------- */
const StatBuilder = {
  xpNeed(level) { return 100 + 40 * (level - 1); },
  rank(level, wins) { for (const r of RANKS) if (level >= r.level && wins >= r.wins) return r.name; return "Iniciante"; },
  build(raceKey, clanKey, level, upg) {
    upg = upg || { hp: 0, dmg: 0, regen: 0 };
    const r = RACES[raceKey] || RACES.ignar, c = CLANS[clanKey] || CLANS.chama;
    const lv = clamp(Math.floor(level) || 1, 1, CFG.MAX_LEVEL), up = lv - 1;
    const extra = { hp: upg.hp * UPGRADES.hp.per, damage: upg.dmg * UPGRADES.dmg.per, kiRegen: upg.regen * UPGRADES.regen.per };   // melhorias da loja (teto de 5 níveis)
    const sum = k => (r.bonus[k] || 0) + (c.bonus[k] || 0) + (extra[k] || 0);       // bônus de raça e clã são SOMADOS
    const mods = Object.assign({}, DEFAULT_MODS, r.mods);
    return {
      raceKey: r.id, clanKey: c.id, level: lv,
      hp: Math.round(r.base.hp * clamp(1 + sum("hp") + up * .015, .8, 1.6)),
      ki: Math.round(r.base.ki * clamp(1 + up * .01, 1, 1.25)),
      speed: r.base.speed * clamp(1 + sum("speed"), .85, 1.2),
      damage: clamp(1 + sum("damage") + up * .008, .8, 1.4),
      kiRegen: r.base.kiRegen * clamp(1 + sum("kiRegen") + up * .005, .7, 1.5),
      takenMul: clamp(1 + (c.bonus.taken || 0), .8, 1.2),
      guardTakes: clamp(.25 + (c.bonus.guard || 0), .1, .5),
      dashCdMul: clamp(mods.dashCdMul * (1 + (c.bonus.dashCd || 0)), .4, 1.2),
      mods
    };
  }
};

/* ---------- Salvamento ---------- */
const Save = {
  KEY: "dragonArena_v02_save", OLD: ["dragonArena_v01_save"], available: true,
  defaults() { return { version: CFG.VERSION, xp: 0, level: 1, wins: 0, losses: 0, credits: 0, tourneyWins: 0, bestStage: 0, owned: [], upgrades: { hp: 0, dmg: 0, regen: 0 }, arena: "temple", character: null, difficulty: "normal", mode: "quick" }; },
  isColor(v) { return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v); },
  int(v, min, max, def) { v = Number(v); return Number.isFinite(v) ? clamp(Math.floor(v), min, max) : def; },
  sanitizeCharacter(c) {
    if (!c || typeof c !== "object") return null;
    const raceKey = RACES[c.raceKey] ? c.raceKey : "ignar", race = RACES[raceKey];
    const col = (v, d) => this.isColor(v) ? v.toLowerCase() : d;
    const outfit = col(c.outfit, col(c.skin, race.defaults.outfit)), hair = col(c.hair, race.defaults.hair);
    return {
      name: String(c.name == null ? "" : c.name).replace(/[\u0000-\u001f<>&"']/g, "").trim().slice(0, 18) || "Guerreiro",
      raceKey, clanKey: CLANS[c.clanKey] ? c.clanKey : "chama", body: BODY.sanitize(c.body), accessory: (typeof ACCESSORIES !== "undefined" && ACCESSORIES[c.accessory]) ? c.accessory : "none", outfit, hair, aura: col(c.aura, col(c.hair, race.defaults.aura))
    };
  },
  sanitize(raw) {
    const d = this.defaults(); if (!raw || typeof raw !== "object") return d;
    d.level = this.int(raw.level, 1, CFG.MAX_LEVEL, 1); d.xp = this.int(raw.xp, 0, 1e7, 0);
    d.wins = this.int(raw.wins, 0, 1e6, 0); d.losses = this.int(raw.losses, 0, 1e6, 0); d.credits = this.int(raw.credits, 0, 1e9, 0); d.tourneyWins = this.int(raw.tourneyWins, 0, 1e6, 0); d.bestStage = this.int(raw.bestStage, 0, CFG.TOURNEY_STAGES, 0);
    while (d.level < CFG.MAX_LEVEL && d.xp >= StatBuilder.xpNeed(d.level)) { d.xp -= StatBuilder.xpNeed(d.level); d.level++; }
    if (d.level >= CFG.MAX_LEVEL) d.xp = 0; else d.xp = Math.min(d.xp, StatBuilder.xpNeed(d.level) - 1);
    d.character = this.sanitizeCharacter(raw.character); d.difficulty = raw.difficulty === "hard" ? "hard" : "normal"; d.mode = raw.mode === "tourney" ? "tourney" : "quick";
    const known = SHOP_ITEMS.map(x => x.id); d.owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter(x => known.indexOf(x) >= 0))] : [];
    const u = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {}; for (const k of Object.keys(UPGRADES)) d.upgrades[k] = this.int(u[k], 0, UPGRADE_MAX, 0);
    d.arena = raw.arena === "random" || (ARENAS[raw.arena] && (raw.arena === "temple" || d.owned.indexOf("arena:" + raw.arena) >= 0)) ? raw.arena : "temple";
    if (d.character && d.character.accessory !== "none" && d.owned.indexOf("acc:" + d.character.accessory) < 0) d.character.accessory = "none";
    return d;
  },
  load() {
    try {
      const txt = localStorage.getItem(this.KEY);
      if (txt) {
        try { return this.sanitize(JSON.parse(txt)); }
        catch (e) { try { localStorage.setItem(this.KEY + "_corrupt", txt); } catch (_) { } }   // guarda cópia em vez de apagar
      }
      for (const k of this.OLD) {            // migração do protótipo 0.1 (a chave antiga é mantida)
        const t = localStorage.getItem(k);
        if (t) { try { const p = this.sanitize(JSON.parse(t)); this.write(p); return p; } catch (e) { } }
      }
    } catch (e) { this.available = false; }
    return this.defaults();
  },
  write(p) {
    try { localStorage.setItem(this.KEY, JSON.stringify(p)); this.available = true; return true; }
    catch (e) { this.available = false; return false; }
  },
  wipe() { try { localStorage.removeItem(this.KEY); } catch (e) { } return this.defaults(); }
};

/* ---------- Progressão (com teto de nível) ---------- */
const Progress = {
  reward(result, hard, level) {
    if (result === "win") return { xp: 70 + (hard ? 30 : 0), credits: 40 + 5 * level + (hard ? 20 : 0) };
    if (result === "draw") return { xp: 35, credits: 20 };
    return { xp: hard ? 25 : 20, credits: 10 };
  },
  tourneyBonus(p) {                                   // bônus único ao vencer o torneio completo
    const before = p.level; p.tourneyWins++; p.credits = Math.min(1e9, p.credits + 150);
    if (p.level < CFG.MAX_LEVEL) { p.xp += 100; while (p.level < CFG.MAX_LEVEL && p.xp >= StatBuilder.xpNeed(p.level)) { p.xp -= StatBuilder.xpNeed(p.level); p.level++; } if (p.level >= CFG.MAX_LEVEL) p.xp = 0; }
    return { xp: 100, credits: 150, levelsGained: p.level - before };
  },
  apply(p, result, hard) {
    const before = p.level, rw = this.reward(result, hard, p.level);
    if (result === "win") p.wins++; else if (result === "lose") p.losses++;
    p.credits = Math.min(1e9, p.credits + rw.credits);
    if (p.level < CFG.MAX_LEVEL) {
      p.xp += rw.xp;
      while (p.level < CFG.MAX_LEVEL && p.xp >= StatBuilder.xpNeed(p.level)) { p.xp -= StatBuilder.xpNeed(p.level); p.level++; }
      if (p.level >= CFG.MAX_LEVEL) p.xp = 0;
    }
    return { xp: rw.xp, credits: rw.credits, levelsGained: p.level - before };
  }
};
/* ---------- Paleta (compartilhada entre cliente e servidor) ---------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = a => "#" + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
const shade = (h, amt) => { const c = hex(h); return toHex(amt < 0 ? c.map(v => v * (1 + amt)) : c.map(v => v + (255 - v) * amt)); };
function makePalette(look, race) {
  const o = look.outfit, h = look.hair, a = look.aura, sk = (look.body && look.body.skin) || race.look.skin;
  return {
    skin: sk, skinD: shade(sk, -.24), skinL: shade(sk, .2), outfit: o, outfitD: shade(o, -.35), outfitL: shade(o, .28),
    hair: h, hairD: shade(h, -.3), hairL: shade(h, .32), aura: a, auraL: shade(a, .55), auraD: shade(a, -.3),
    accent: race.look.accent, accentD: shade(race.look.accent, -.35), white: "#e8eeff", wrap: shade(o, .45), eye: (look.body && look.body.eye) || race.look.eye, belt: "#1a2038"
  };
}

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

/* =====================================================================
 *  STUBS DO SERVIDOR — a simulação roda sem navegador. FX/Sound não
 *  desenham nem tocam nada: apenas REGISTRAM cada chamada em NetRec,
 *  e os clientes reproduzem os mesmos efeitos a partir desses eventos.
 * ===================================================================== */
const NetRec = {
  events: [], MAX: 80,
  push(e) { if (this.events.length < this.MAX) this.events.push(e); },
  take() { const e = this.events; this.events = []; return e; }
};
const FX_NAMES = { spark: 1, ember: 1, dust: 1, ring: 1, burst: 1, crescent: 1, text: 1, pillar: 1 };
const FX = new Proxy({ shake: 0, flash: 0, flashColor: "#ffffff" }, {
  get(t, k) {
    if (k in t) return t[k];
    if (FX_NAMES[k]) return (...a) => { if (a.every(v => typeof v === "number" || typeof v === "string")) NetRec.push({ f: k, a }); };
    if (k === "resetTick") return () => { t.shake = 0; t.flash = 0; };
    return () => { };                                                  // clear, update, draw, ghost…: nada a fazer no servidor
  },
  set(t, k, v) { if (k === "shake" || k === "flash" || k === "flashColor") { NetRec.push({ s: k, v }); } t[k] = v; return true; }
});
const Sound = { play(name) { NetRec.push({ a: name }); }, music() { }, unlock() { } };
const UI = { log() { }, banner() { }, showResult() { } };
const Input = { apply() { } };
const Sprites = { makePalette, poseFor() { return {}; }, draw() { }, shade };

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

/* =====================================================================
 *  PARTIDA JOGADOR x JOGADOR (autoritativa, roda no servidor)
 *  Reaproveita Fighter/Combat/Match do jogo offline. Nada de IA, XP,
 *  créditos ou melhorias da loja: ranqueada usa atributos normalizados.
 * ===================================================================== */
const RANKED_LEVEL = 10;
const PRESS_OK = { attack: 1, blast: 1, dash: 1, awaken: 1, race: 1, jump: 1 };

function makePvP(chars, arena) {
  const m = Object.create(Match.prototype);
  m.profile = null; m.tourney = null; m.hard = false; m.character = chars[0]; m.arena = arena;
  m.fighters = chars.map((c, i) => new Fighter({
    id: i, name: c.name, isPlayer: true, raceKey: c.raceKey, clanKey: c.clanKey, stats: StatBuilder.build(c.raceKey, c.clanKey, RANKED_LEVEL),
    look: { outfit: c.outfit, hair: c.hair, aura: c.aura, accessory: c.accessory, body: c.body }, x: i ? 225 : 95, face: i ? -1 : 1
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
    cs: f.comboStep, ct: r1(f.comboTimer), ch: f.chainHits, cht: r1(f.chainTimer), burn: f.burn ? 1 : 0,
    cd: { blast: r1(f.cd.blast), dash: r1(f.cd.dash), awaken: r1(f.cd.awaken), race: r1(f.cd.race) }, act
  };
}
function pvpSnap(m, withEvents) {
  return {
    t: "snap", n: m.tick, s: m.state, tl: r1(m.timeLeft), f: [fighterSnap(m.fighters[0]), fighterSnap(m.fighters[1])],
    p: m.projectiles.map(p => ({ x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), r: p.r, c: p.color, o: p.owner.id })),
    e: withEvents ? NetRec.take() : undefined
  };
}

return { CFG, RACES, CLANS, ARENAS, BODY, StatBuilder, Save, MOVES, AIR_MOVE, Fighter, Combat, FX, NetRec, RANKED_LEVEL, makePvP, pvpInput, pvpPress, pvpSnap };
})();
