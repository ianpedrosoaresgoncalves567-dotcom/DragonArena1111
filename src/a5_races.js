
/* =====================================================================
 *  RAÇAS DO LOTE 1 (as 4 originais estão em a_data.js)
 *  Cada raça: atributos base, bônus, mods passivos, aparência e um
 *  poder exclusivo (skill = POWERS[...]).
 * ===================================================================== */
for (const k of Object.keys(RACES)) { const s = RACES[k].skill; s.id = "race_" + k; s.excl = true; POWERS[s.id] = s; }   // habilidades originais entram no registro

const mkRace = (id, o) => { RACES[id] = Object.assign({ id, future: { skills: [], transformations: [] } }, o); };
mkRace("glacial", {
  name: "Glacial", role: "Controle e resistência", icon: "🧊", desc: "Povo das geleiras: lentos, firmes e capazes de congelar o ritmo da luta.",
  passive: { name: "Toque de gelo", text: "Golpes deixam o rival lento por 1,5 s. 10% menos atordoamento." },
  base: { hp: 110, ki: 95, speed: 72, kiRegen: 3.5 }, bonus: {}, mods: { chill: 1.5, stunResist: .9 },
  look: { skin: "#bfe6f2", eye: "#2a6fff", accent: "#9fe8ff", build: 1, hair: "spikes", back: "scarf", torso: "brute", arm: ["skin", "outfit", "accent"], leg: ["outfit", "outfit", "accent"], armW: 3, legW: 4 },
  skill: POWERS.prisao, defaults: { outfit: "#5aa8ff", hair: "#e8fbff", aura: "#9fe8ff" }
});
mkRace("vibora", {
  name: "Víbora", role: "Veneno e agilidade", icon: "🐍", desc: "Caçadores ágeis que vencem aos poucos: cada golpe forte deixa veneno.",
  passive: { name: "Presas", text: "O 3º golpe do combo envenena o alvo por 3 s. Investida causa mais dano." },
  base: { hp: 90, ki: 95, speed: 88, kiRegen: 4 }, bonus: {}, mods: { venom: { dur: 3, dps: 2.2 }, dashDamage: 5 },
  look: { skin: "#8fae5a", eye: "#ffd83a", accent: "#b6ff4a", build: -1, hair: "bald", back: "tail", torso: "suit", arm: ["skin", "outfit", "accent"], leg: ["outfit", "outfit", "accent"], armW: 3, legW: 4 },
  skill: POWERS.bote, defaults: { outfit: "#3c8a4a", hair: "#b6ff4a", aura: "#b6ff4a" }
});
mkRace("trovao", {
  name: "Trovão", role: "Velocidade e críticos", icon: "⚡", desc: "Guerreiros elétricos: golpes rápidos e chance de descargas críticas.",
  passive: { name: "Descarga", text: "Golpes 8% mais rápidos. 15% de chance de acerto crítico (+50% de dano) nos golpes." },
  base: { hp: 90, ki: 105, speed: 90, kiRegen: 4.5 }, bonus: {}, mods: { atkSpeed: 1.08, crit: { p: .15, mul: 1.5 } },
  look: { skin: "#f1d19a", eye: "#fff27a", accent: "#fff27a", build: 0, hair: "spikes", back: "sash", torso: "gi", arm: ["skin", "wrap", "accent"], leg: ["outfitD", "outfitD", "accent"], armW: 3, legW: 4 },
  skill: POWERS.relampago, defaults: { outfit: "#f4c430", hair: "#fff27a", aura: "#fff27a" }
});
mkRace("petreo", {
  name: "Pétreo", role: "Tanque implacável", icon: "🪨", desc: "Corpos de rocha: lentos e quase imóveis diante de golpes.",
  passive: { name: "Pele de pedra", text: "50% menos repulsão, 20% menos atordoamento. Rajadas causam 10% menos dano." },
  base: { hp: 135, ki: 80, speed: 62, kiRegen: 2.8 }, bonus: { damage: .03 }, mods: { knockResist: .5, stunResist: .8, blastDmgMul: .9 },
  look: { skin: "#9a9aa6", eye: "#ffb347", accent: "#6f6f7c", build: 4, hair: "bald", back: "cape", torso: "brute", arm: ["skin", "skin", "skinD"], leg: ["skin", "skin", "outfitD"], armW: 4, legW: 5 },
  skill: POWERS.tremor, defaults: { outfit: "#7a7a88", hair: "#cfcfda", aura: "#d9c59a" }
});
mkRace("zefiro", {
  name: "Zéfiro", role: "Mobilidade aérea", icon: "🍃", desc: "Filhos do vento: duplo pulo, investidas curtas e luta de longe.",
  passive: { name: "Brisa", text: "Duplo pulo e investida com recarga 25% menor." },
  base: { hp: 88, ki: 100, speed: 98, kiRegen: 4 }, bonus: {}, mods: { doubleJump: true, dashCdMul: .75 },
  look: { skin: "#cfe9d4", eye: "#4ad6a0", accent: "#bff0ff", build: -1, hair: "stream", back: "scarf", torso: "suit", arm: ["outfit", "outfit", "accent"], leg: ["outfit", "outfit", "accent"], armW: 3, legW: 3 },
  skill: POWERS.vendaval, defaults: { outfit: "#6fe0b0", hair: "#e8fff4", aura: "#bff0ff" }
});
mkRace("sanguis", {
  name: "Sanguis", role: "Vampirismo", icon: "🩸", desc: "Sedentos por sangue: curam-se ao ferir o rival.",
  passive: { name: "Sede", text: "Recupera 10% do dano causado em golpes corpo a corpo." },
  base: { hp: 100, ki: 90, speed: 80, kiRegen: 3.5 }, bonus: {}, mods: { lifesteal: .1 },
  look: { skin: "#e8b7bf", eye: "#ff2a4a", accent: "#ff2a4a", build: 0, hair: "ponytail", back: "cape", torso: "suit", arm: ["outfit", "outfit", "accent"], leg: ["outfitD", "outfitD", "accent"], armW: 3, legW: 4 },
  skill: POWERS.pacto, defaults: { outfit: "#8a1c34", hair: "#2a1a22", aura: "#ff2a4a" }
});
mkRace("astral", {
  name: "Astral", role: "Energia e debuffs", icon: "🌌", desc: "Nascidos entre as estrelas: dominam a energia e enfraquecem o rival.",
  passive: { name: "Poeira estelar", text: "Rajadas custam 15% menos energia. Cada golpe recupera mais energia (6)." },
  base: { hp: 90, ki: 120, speed: 80, kiRegen: 6 }, bonus: {}, mods: { blastCostMul: .85, kiOnHit: 6 },
  look: { skin: "#9d8cd6", eye: "#ffffff", accent: "#ffe08a", build: 0, hair: "stream", back: "cape", torso: "suit", arm: ["outfit", "outfit", "accent"], leg: ["outfit", "outfit", "accent"], armW: 3, legW: 4 },
  skill: POWERS.eclipse, defaults: { outfit: "#3a2a7a", hair: "#ffe08a", aura: "#b9a6ff" }
});
mkRace("draconico", {
  name: "Dracônico", role: "Brutalidade flamejante", icon: "🐉", desc: "Descendentes de dragões: escamas grossas e hálito de fogo.",
  passive: { name: "Escamas ardentes", text: "20% menos repulsão. O 3º golpe causa queimadura leve." },
  base: { hp: 115, ki: 95, speed: 74, kiRegen: 3.5 }, bonus: {}, mods: { burn: { dps: 1.2, dur: 2 }, knockResist: .8 },
  look: { skin: "#c0553a", eye: "#ffd23a", accent: "#ffb347", build: 3, hair: "horns", back: "tail", torso: "brute", arm: ["skin", "skin", "skinD"], leg: ["skin", "skin", "outfitD"], armW: 4, legW: 5 },
  skill: POWERS.sopro, defaults: { outfit: "#7a2a1a", hair: "#ffd23a", aura: "#ff7a2e" }
});
