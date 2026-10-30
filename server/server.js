"use strict";
/* =====================================================================
 *  Dragon Arena — servidor online
 *  HTTP:  GET /  (o jogo), /health, /api/leaderboard
 *  WS:    contas, fila ranqueada, partidas autoritativas, ranking
 *  O servidor roda a MESMA simulação de combate do jogo (server/sim.js, gerada
 *  a partir de src/); os clientes só enviam entradas e desenham o que recebem.
 * ===================================================================== */
const http = require("http"), fs = require("fs"), path = require("path");
const { WebSocketServer } = require("ws");
const sim = require("./sim");
const rating = require("./rating");
const auth = require("./auth");
const { createStorage } = require("./storage");

const NET_VERSION = "1";
const STEP = 1 / 60, SNAP_EVERY = 2, HISTORY_MAX = 20, LB_SIZE = 20, ROOM_LINGER_MS = 4000;

function createServer(opts) {
  opts = opts || {};
  const storage = opts.storage || createStorage(opts);
  const publicDir = opts.publicDir || path.join(__dirname, "..", "public");
  const log = opts.quiet ? () => { } : (...a) => console.log("[dragon]", ...a);
  const allowed = (opts.allowedOrigins !== undefined ? opts.allowedOrigins : process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const conns = new Set(), byUser = new Map(), rooms = new Map(), userRoom = new Map(), queue = [];
  const loginIp = new auth.Limiter(15, 10 * 60e3), loginUser = new auth.Limiter(8, 10 * 60e3), regIp = new auth.Limiter(10, 3600e3);
  let nextId = 1, lbCache = { at: 0, list: [] }, timers = [], httpServer = null, wss = null;
  const GRACE_MS = opts.graceMs || 20e3, MM = Object.assign({ base: 100, perSec: 40 }, opts.mm || {});
  const now = () => Date.now();
  const send = (c, o) => { if (c && c.ws && c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(o)); } catch (e) { } } };

  /* ---------- perfil público ---------- */
  function publicMe(u) {
    return {
      username: u.username, rating: u.rating, rank: rating.rankOf(u.rating), games: u.games, wins: u.wins, losses: u.losses, draws: u.draws, kos: u.kos, streak: u.streak,
      bestRating: u.bestRating, dmgDealt: Math.round(u.dmgDealt), dmgTaken: Math.round(u.dmgTaken), placement: Math.max(0, 5 - u.games), history: (u.history || []).slice(0, 10), character: u.character || null
    };
  }
  async function leaderboard() {
    if (now() - lbCache.at < 4000) return lbCache.list;
    const top = await storage.top(LB_SIZE);
    lbCache = { at: now(), list: top.map((u, i) => ({ pos: i + 1, username: u.username, rating: u.rating, rank: rating.rankOf(u.rating).label, wins: u.wins, losses: u.losses, games: u.games })) };
    return lbCache.list;
  }
  const stats = () => ({ online: [...conns].filter(c => c.user).length, queue: queue.length, matches: rooms.size });

  /* ---------- HTTP ---------- */
  let indexHtml = null;
  const loadIndex = () => { try { indexHtml = fs.readFileSync(path.join(publicDir, "index.html")); } catch (e) { indexHtml = null; } };
  httpServer = http.createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    const hdr = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
    try {
      if (url === "/" || url === "/index.html") {
        if (!indexHtml) loadIndex(); if (!indexHtml) { res.writeHead(500, hdr); return res.end("public/index.html não encontrado (rode: python3 build.py)"); }
        res.writeHead(200, Object.assign({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }, hdr)); return res.end(indexHtml);
      }
      if (url === "/health") { res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, hdr)); return res.end(JSON.stringify(Object.assign({ ok: true, v: NET_VERSION, storage: storage.kind }, stats()))); }
      if (url === "/api/leaderboard") { res.writeHead(200, Object.assign({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=5" }, hdr)); return res.end(JSON.stringify(await leaderboard())); }
      res.writeHead(404, hdr); res.end("Não encontrado");
    } catch (e) { res.writeHead(500, hdr); res.end("Erro"); }
  });

  /* ---------- WebSocket ---------- */
  wss = new WebSocketServer({
    server: httpServer, maxPayload: 4096, perMessageDeflate: false,
    verifyClient: info => !allowed.length || allowed.indexOf(info.origin) >= 0
  });
  wss.on("connection", (ws, req) => {
    const c = { id: nextId++, ws, ip: String((req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?")).split(",")[0].trim(), user: null, tokens: 300, tokAt: now(), alive: true, lastPress: 0, queued: null };
    conns.add(c); send(c, Object.assign({ t: "hello", v: NET_VERSION }, stats()));
    ws.on("pong", () => { c.alive = true; });
    ws.on("message", async data => {
      const t = now(); c.tokens = Math.min(300, c.tokens + (t - c.tokAt) / 1000 * 150); c.tokAt = t;       // 150 msgs/s sustentado, rajada de 300
      if (--c.tokens < 0) { ws.close(1008, "rate"); return; }
      let m; try { m = JSON.parse(data.toString()); } catch (e) { return; }
      if (!m || typeof m.t !== "string") return;
      try { await onMessage(c, m); } catch (e) { log("erro msg", m.t, e && e.message); send(c, { t: "err", msg: "Erro interno." }); }
    });
    ws.on("close", () => onClose(c));
    ws.on("error", () => { });
  });
  timers.push(setInterval(() => { for (const c of conns) { if (!c.alive) { try { c.ws.terminate(); } catch (e) { } continue; } c.alive = false; try { c.ws.ping(); } catch (e) { } } }, 20e3));

  /* ---------- contas ---------- */
  async function bindUser(c, user) {
    const old = byUser.get(user.username);
    if (old && old !== c) { send(old, { t: "kicked", msg: "Sua conta entrou em outro lugar." }); old.user = null; removeFromQueue(old); try { old.ws.close(1000, "outra sessão"); } catch (e) { } }
    c.user = user.username; byUser.set(user.username, c);
    const room = userRoom.get(user.username);
    if (room && !room.done) rebind(room, c);
  }
  async function onMessage(c, m) {
    const t = m.t;
    if (t === "ping") return send(c, { t: "pong", c: m.c });
    if (t === "register" || t === "login" || t === "resume") {
      if (m.v !== NET_VERSION) return send(c, { t: "err", code: "version", msg: "Versão do jogo diferente da do servidor. Recarregue a página." });
      if (c.user) return send(c, { t: "err", msg: "Você já está conectado." });
      if (t === "resume") {
        if (typeof m.token !== "string" || m.token.length !== 64) return send(c, { t: "auth", ok: false, resume: true });
        const s = await storage.getSession(auth.tokenHash(m.token)); const u = s && await storage.getUser(s.u);
        if (!u) return send(c, { t: "auth", ok: false, resume: true });
        await bindUser(c, u); return send(c, { t: "auth", ok: true, token: m.token, me: publicMe(u) });
      }
      const name = auth.normUser(m.u);
      if (!auth.validUser(name)) return send(c, { t: "auth", ok: false, msg: "Usuário: 3 a 16 caracteres (letras, números e _)." });
      if (!auth.validPass(m.p)) return send(c, { t: "auth", ok: false, msg: "Senha: 6 a 72 caracteres." });
      if (t === "register") {
        if (!regIp.hit(c.ip)) return send(c, { t: "auth", ok: false, msg: "Muitos cadastros deste endereço. Tente mais tarde." });
        const pw = await auth.hashPassword(m.p);
        const u = { username: name, salt: pw.salt, hash: pw.hash, createdAt: now(), rating: rating.START, bestRating: rating.START, games: 0, wins: 0, losses: 0, draws: 0, kos: 0, dmgDealt: 0, dmgTaken: 0, streak: 0, history: [], character: null };
        if (!(await storage.createUser(u))) return send(c, { t: "auth", ok: false, msg: "Esse nome de usuário já existe." });
        return finishLogin(c, u);
      }
      if (loginIp.blocked(c.ip) || loginUser.blocked(name)) return send(c, { t: "auth", ok: false, msg: "Muitas tentativas. Aguarde alguns minutos." });
      const u = await storage.getUser(name);
      const ok = u && await auth.checkPassword(m.p, u);
      if (!ok) { loginIp.hit(c.ip); loginUser.hit(name); return send(c, { t: "auth", ok: false, msg: "Usuário ou senha incorretos." }); }
      loginUser.clear(name); return finishLogin(c, u);
    }
    if (!c.user) return send(c, { t: "err", code: "auth", msg: "Entre na sua conta primeiro." });
    if (t === "logout") { removeFromQueue(c); if (userRoom.get(c.user)) return send(c, { t: "err", msg: "Termine a partida antes de sair." }); byUser.delete(c.user); c.user = null; return send(c, { t: "loggedout" }); }
    if (t === "me") { const u = await storage.getUser(c.user); return send(c, { t: "me", me: publicMe(u) }); }
    if (t === "lb") return send(c, { t: "lb", list: await leaderboard(), stats: stats() });
    if (t === "queue") {
      if (userRoom.get(c.user)) return send(c, { t: "err", msg: "Você já está em uma partida." });
      if (c.queued) return;
      const u = await storage.getUser(c.user); const ch = sim.Save.sanitizeCharacter(m.character) || sim.Save.sanitizeCharacter({});
      ch.name = u.username; u.character = ch; await storage.saveUser(u);
      c.queued = { c, at: now(), rating: u.rating, char: ch, user: u.username }; queue.push(c.queued); send(c, { t: "queued", rating: u.rating }); return;
    }
    if (t === "unqueue") { removeFromQueue(c); return send(c, { t: "unqueued" }); }
    const room = userRoom.get(c.user); if (!room || room.done) return;
    const slot = room.slots[0].user === c.user ? 0 : 1;
    if (t === "in") sim.pvpInput(room.m, slot, +m.mx || 0, m.g);
    else if (t === "press") { const n = now(); if (n - c.lastPress >= 25) { c.lastPress = n; sim.pvpPress(room.m, slot, m.a); } }
    else if (t === "forfeit") { room.m.forfeit(slot); }
  }
  async function finishLogin(c, u) {
    const token = auth.newToken(); await storage.setSession(auth.tokenHash(token), { u: u.username, exp: now() + auth.SESSION_MS });
    await bindUser(c, u); send(c, { t: "auth", ok: true, token, me: publicMe(u) });
  }
  function removeFromQueue(c) { const i = queue.findIndex(q => q.c === c); if (i >= 0) queue.splice(i, 1); c.queued = null; }
  function onClose(c) {
    conns.delete(c); removeFromQueue(c);
    if (c.user && byUser.get(c.user) === c) {
      byUser.delete(c.user);
      const room = userRoom.get(c.user);
      if (room && !room.done) { const s = room.slots.findIndex(x => x.user === c.user); room.slots[s].c = null; room.slots[s].dcAt = now(); room.paused = true; send(room.slots[1 - s].c, { t: "oppdc", secs: GRACE_MS / 1000 }); }
    }
  }

  /* ---------- matchmaking ---------- */
  function matchmake() {
    const t = now(); queue.sort((a, b) => a.at - b.at); const used = new Set();
    for (const a of queue) {
      if (used.has(a)) continue; let best = null, bd = 1e9; const wa = MM.base + MM.perSec * ((t - a.at) / 1000);
      for (const b of queue) {
        if (b === a || used.has(b) || b.user === a.user) continue;
        const d = Math.abs(a.rating - b.rating), wb = MM.base + MM.perSec * ((t - b.at) / 1000);
        if (d <= Math.max(wa, wb) && d < bd) { best = b; bd = d; }
      }
      if (best) { used.add(a); used.add(best); startRoom(a, best); }
    }
    for (let i = queue.length - 1; i >= 0; i--) if (used.has(queue[i])) { queue[i].c.queued = null; queue.splice(i, 1); }
  }
  timers.push(setInterval(matchmake, 1000));

  /* ---------- salas / partidas ---------- */
  function startRoom(a, b) {
    const arenas = Object.keys(sim.ARENAS), arena = arenas[Math.floor(Math.random() * arenas.length)];
    const flip = Math.random() < .5, pair = flip ? [b, a] : [a, b], chars = pair.map(q => q.char);
    const room = { id: nextId++, m: sim.makePvP(chars, arena), arena, acc: 0, paused: false, done: false, ev: [], slots: pair.map(q => ({ c: q.c, user: q.user, rating: q.rating, dcAt: null })), result: null, doneAt: 0, chars };
    rooms.set(room.id, room); for (const s of room.slots) userRoom.set(s.user, room);
    for (let i = 0; i < 2; i++) sendMatch(room, i);
    log("partida", room.id, room.slots.map(s => s.user + "(" + s.rating + ")").join(" x "), arena);
  }
  function sendMatch(room, slot, resumed) {
    const s = room.slots[slot], o = room.slots[1 - slot];
    send(s.c, { t: "match", id: room.id, slot, arena: room.arena, level: sim.RANKED_LEVEL, chars: room.chars, names: room.slots.map(x => x.user), ratings: room.slots.map(x => x.rating), ranks: room.slots.map(x => rating.rankOf(x.rating).label), resumed: !!resumed });
  }
  function rebind(room, c) {
    const slot = room.slots.findIndex(s => s.user === c.user); if (slot < 0) return;
    room.slots[slot].c = c; room.slots[slot].dcAt = null; sendMatch(room, slot, true);
    if (room.slots.every(s => s.c)) { room.paused = false; send(room.slots[0].c, { t: "oppback" }); send(room.slots[1].c, { t: "oppback" }); }
    send(c, Object.assign(sim.pvpSnap(room.m, false), { e: [] }));
  }
  const farmCheck = (u, opp, t) => rating.isFarm(u.history, opp, t);
  async function finalize(room) {
    const m = room.m, t = now(), A = await storage.getUser(room.slots[0].user), B = await storage.getUser(room.slots[1].user), us = [A, B];
    const w = m.winner, wf = w >= 0 ? m.fighters[w] : null, lf = w >= 0 ? m.fighters[1 - w] : null;
    const info = {
      type: m.endType, winner: w, timeLeft: m.timeLeft, hpLead: wf ? Math.max(0, Math.min(1, wf.hp / wf.stats.hp - lf.hp / lf.stats.hp)) : 0,
      stats: m.st, elapsed: m.elapsed
    };
    const sc = rating.score(info, us.map(u => ({ rating: u.rating, games: u.games })), { farm: [farmCheck(A, B.username, t), farmCheck(B, A.username, t)] });
    const out = [], pre = us.map(u => u.rating);
    for (let i = 0; i < 2; i++) {
      const u = us[i], o = us[1 - i], s = sc[i], st = m.st[i], f = m.fighters[i];
      const before = rating.rankOf(pre[i]).label, after = rating.rankOf(s.after).label, tierBefore = rating.rankOf(pre[i]).tier, tierAfter = rating.rankOf(s.after).tier;
      u.rating = s.after; u.bestRating = Math.max(u.bestRating || 0, u.rating); u.games++;
      if (s.result === "win") { u.wins++; u.streak = u.streak > 0 ? u.streak + 1 : 1; if (info.type === "ko") u.kos++; } else if (s.result === "loss") { u.losses++; u.streak = u.streak < 0 ? u.streak - 1 : -1; } else { u.draws++; u.streak = 0; }
      u.dmgDealt += st.dealt; u.dmgTaken += st.taken;
      const rec = { at: t, opp: o.username, oppRating: pre[1 - i], res: s.result, type: info.type, delta: s.delta, after: u.rating, dealt: Math.round(st.dealt), taken: Math.round(st.taken), combo: st.combo, secs: Math.round(m.elapsed) };
      u.history = [rec].concat(u.history || []).slice(0, HISTORY_MAX); await storage.saveUser(u);
      out.push({
        t: "result", res: s.result, type: info.type, delta: s.delta, rating: u.rating, rank: rating.rankOf(u.rating), rankBefore: before, rankAfter: after, promo: tierAfter > tierBefore ? "up" : tierAfter < tierBefore ? "down" : (after !== before ? (s.delta > 0 ? "div-up" : "div-down") : null),
        stats: { dealt: Math.round(st.dealt), taken: Math.round(st.taken), combo: st.combo, secs: Math.round(m.elapsed), hpPct: Math.round(100 * f.hp / f.stats.hp), timeLeft: Math.round(m.timeLeft) },
        parts: { outcome: s.outcome, dominance: s.dominance, S: s.S, E: s.E, K: s.K, farm: s.farm }, opp: { name: o.username, rating: pre[1 - i] }, streak: u.streak, me: publicMe(u)
      });
    }
    lbCache.at = 0; return out;
  }
  async function endRoom(room) {
    room.done = true; room.doneAt = now();
    try { room.result = await finalize(room); } catch (e) { log("erro ao finalizar", e && e.stack); room.result = [null, null]; }
    for (let i = 0; i < 2; i++) { if (room.result[i]) send(room.slots[i].c, room.result[i]); }
    for (const s of room.slots) if (userRoom.get(s.user) === room) userRoom.delete(s.user);          // já pode buscar outra partida
    setTimeout(() => rooms.delete(room.id), ROOM_LINGER_MS).unref();
  }

  /* ---------- laço fixo de 60 Hz ---------- */
  let last = process.hrtime.bigint();
  timers.push(setInterval(() => {
    const t = process.hrtime.bigint(); let dt = Number(t - last) / 1e9; last = t; dt = Math.min(dt, .1);
    for (const room of rooms.values()) {
      if (room.done) continue;
      if (room.paused) {                                                               // aguardando reconexão
        for (let i = 0; i < 2; i++) { const s = room.slots[i]; if (!s.c && s.dcAt && now() - s.dcAt > GRACE_MS && !room.m.result) { room.m.forfeit(i); } }
      } else {
        room.acc += dt; let n = 0;
        while (room.acc >= STEP && n < 5 && room.m.state !== "over") {
          sim.FX.resetTick(); room.m.update(STEP); room.acc -= STEP; n++;
          const ev = sim.NetRec.take(); if (ev.length && room.ev.length < 120) room.ev.push(...ev);
          if (room.m.tick % SNAP_EVERY === 0) { const snap = sim.pvpSnap(room.m, false); snap.e = room.ev; room.ev = []; const s = JSON.stringify(snap); for (const sl of room.slots) if (sl.c && sl.c.ws.readyState === 1) { try { sl.c.ws.send(s); } catch (e) { } } }
        }
        if (n >= 5) room.acc = 0;
      }
      if (room.m.result && !room.done && (room.m.state === "over" || room.m.endType === "forfeit")) {
        const snap = sim.pvpSnap(room.m, false); snap.e = room.ev; room.ev = []; for (const sl of room.slots) send(sl.c, snap);
        endRoom(room);
      }                                                                                // KO em andamento: a animação termina antes do resultado
    }
  }, 1000 / 60));

  return {
    storage, httpServer, stats, rooms, queue, conns,
    async start(port, host) { await storage.init(); loadIndex(); await new Promise(r => httpServer.listen(port, host || "0.0.0.0", r)); log("ouvindo na porta", httpServer.address().port, "| armazenamento:", storage.kind); return httpServer.address().port; },
    async stop() { for (const t of timers) clearInterval(t); for (const c of conns) { try { c.ws.terminate(); } catch (e) { } } await new Promise(r => wss.close(() => r())); await new Promise(r => httpServer.close(() => r())); await storage.close(); }
  };
}
module.exports = { createServer, NET_VERSION };
