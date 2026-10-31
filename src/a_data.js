"use strict";
(() => {
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
  dashCdMul: 1, dashCostMul: 1, dashDamage: 3, doubleJump: false, burn: null, lowHpRegen: null, kiOnHit: 4,
  chill: 0, venom: null, crit: null, lifesteal: 0
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
      raceKey, clanKey: CLANS[c.clanKey] ? c.clanKey : "chama", body: BODY.sanitize(c.body), powers: (typeof Powers !== "undefined") ? Powers.sanitize(c.powers) : ["", ""], accessory: (typeof ACCESSORIES !== "undefined" && ACCESSORIES[c.accessory]) ? c.accessory : "none", outfit, hair, aura: col(c.aura, col(c.hair, race.defaults.aura))
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
