"use strict";
/* =====================================================================
 *  Sistema de pontos ranqueados (puro, sem I/O — fácil de testar)
 *
 *  Cada jogador recebe uma NOTA DA PARTIDA S entre 0 e 1:
 *     S = 0,70 · Resultado  +  0,30 · Domínio
 *  - Resultado: vitória por KO vale 0,85–1,00 (quanto mais cedo o KO, mais perto de 1);
 *               vitória por tempo vale 0,60–0,75 (pela vantagem de vida);
 *               empate 0,50; o perdedor recebe o complemento (1 − resultado do vencedor).
 *  - Domínio: (dano causado − dano sofrido) / (dano causado + dano sofrido), de −1 a +1,
 *             mapeado para 0–1. Perder lutando bem dói menos; vencer apanhando rende menos.
 *  Os pontos vêm do Elo: Δ = K · (S − E), com E = chance esperada pela diferença de pontos.
 *  Garantias: vencer sempre rende ao menos +MIN_WIN; perder nunca tira mais que o teto;
 *  pontos nunca ficam abaixo de 0; abandono conta como derrota com nota 0.
 * ===================================================================== */
const START = 1000, FORFEIT_EXTRA = 10, FLOOR = 0, MIN_WIN = 5, MAX_LOSS_PER_GAME = 60, MIN_LOSS = 2;
const W_RESULT = 0.7, W_DOMINANCE = 0.3, ROUND_TIME = 90;
const K_PLACEMENT = 48, K_NORMAL = 32, PLACEMENT_GAMES = 5, FARM_WINDOW_MS = 3600e3, FARM_LIMIT = 3, FARM_GAIN_MUL = .5;

const TIERS = [["Bronze", 0], ["Prata", 1150], ["Ouro", 1300], ["Platina", 1450], ["Diamante", 1600], ["Mestre", 1750], ["Lenda", 1950]];
const BRONZE_BASE = 850;      // abaixo disso continua Bronze III; quem começa com 1000 entra em Bronze II
const DIVS = ["III", "II", "I"];

function rankOf(pts) {
  pts = Math.max(0, Math.floor(pts)); let i = 0; for (let k = 0; k < TIERS.length; k++) if (pts >= TIERS[k][1]) i = k;
  const name = TIERS[i][0], lo = TIERS[i][1], next = TIERS[i + 1] ? TIERS[i + 1][1] : null;
  if (next == null) return { tier: i, name, div: "", label: name, floor: lo, next: null, progress: 1 };
  const base = i === 0 ? BRONZE_BASE : lo, width = (next - base) / 3, d = Math.max(0, Math.min(2, Math.floor((pts - base) / width)));
  const dlo = base + d * width, dhi = d === 2 ? next : base + (d + 1) * width;
  return { tier: i, name, div: DIVS[d], label: name + " " + DIVS[d], floor: Math.round(dlo), next: Math.round(dhi), progress: Math.max(0, Math.min(1, (pts - dlo) / (dhi - dlo))) };
}

const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* nota de resultado do VENCEDOR (0..1); o perdedor recebe 1 − isso */
function winnerOutcome(info) {
  if (info.type === "ko") return .85 + .15 * clamp01(info.timeLeft / ROUND_TIME);
  if (info.type === "time") return .6 + .15 * clamp01(info.hpLead);
  if (info.type === "forfeit") return .8;
  return .5;
}

/**
 * info: { type: "ko"|"time"|"draw"|"forfeit", winner: 0|1|-1, timeLeft, hpLead (0..1, vantagem de vida do vencedor),
 *         stats: [{dealt,taken,combo},{...}], elapsed }
 * players: [{ rating, games }, { rating, games }]
 * ctx: { farm: [bool,bool] }  (true = repetição excessiva do mesmo par: ganhos reduzidos)
 */
function score(info, players, ctx) {
  ctx = ctx || {}; const out = [];
  const wo = winnerOutcome(info);
  for (let i = 0; i < 2; i++) {
    const me = players[i], op = players[1 - i], st = info.stats[i], os = info.stats[1 - i];
    let outcome = info.winner === -1 ? .5 : info.winner === i ? wo : 1 - wo;
    if (info.type === "forfeit" && info.winner !== i) outcome = 0;                              // quem abandona fica com nota 0
    const tot = st.dealt + os.dealt, dom = tot < 10 ? 0 : (st.dealt - os.dealt) / (st.dealt + os.dealt);
    const S = clamp01(W_RESULT * outcome + W_DOMINANCE * (.5 + .5 * dom)), E = expected(me.rating, op.rating);
    const K = me.games < PLACEMENT_GAMES ? K_PLACEMENT : K_NORMAL;
    let delta = Math.round(K * (S - E)); const won = info.winner === i, lost = info.winner === 1 - i;
    if (won) delta = Math.max(MIN_WIN, delta); else if (lost) delta = Math.min(-MIN_LOSS, Math.max(-MAX_LOSS_PER_GAME, delta));
    if (info.type === "forfeit" && lost) delta -= FORFEIT_EXTRA;                                // abandonar custa mais
    if (delta > 0 && ctx.farm && ctx.farm[i]) delta = Math.max(1, Math.round(delta * FARM_GAIN_MUL));
    const after = Math.max(FLOOR, me.rating + delta);
    out.push({ delta: after - me.rating, before: me.rating, after, S: +S.toFixed(3), E: +E.toFixed(3), outcome: +outcome.toFixed(3), dominance: +dom.toFixed(3), K, farm: !!(ctx.farm && ctx.farm[i]), result: won ? "win" : lost ? "loss" : "draw" });
  }
  return out;
}

/* a mesma dupla já se enfrentou FARM_LIMIT vezes na última hora? */
function isFarm(history, opponent, now) { let n = 0; for (const h of history || []) if (h.opp === opponent && now - h.at < FARM_WINDOW_MS) n++; return n >= FARM_LIMIT; }

module.exports = { START, TIERS, rankOf, expected, score, isFarm, MIN_WIN, ROUND_TIME };
