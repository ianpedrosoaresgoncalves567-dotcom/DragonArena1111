
/* =====================================================================
 *  MODO ONLINE (cliente)
 *  O servidor decide tudo na partida ranqueada; aqui só enviamos entradas
 *  e desenhamos o estado recebido (NetView), reproduzindo os efeitos
 *  (partículas e sons) que o servidor registrou.
 * ===================================================================== */
const NET_VERSION = "2";
const FX_REPLAY = { spark: 1, ember: 1, dust: 1, ring: 1, burst: 1, crescent: 1, text: 1, pillar: 1 };

/* "Partida" visual: mesmos campos que Renderer/HUD esperam de Match, preenchidos por snapshots */
class NetView {
  constructor(msg) {
    this.id = msg.id; this.slot = msg.slot; this.arena = ARENAS[msg.arena] ? msg.arena : "temple"; this.state = "intro"; this.timeLeft = CFG.ROUND_TIME;
    this.tourney = null; this.projectiles = []; this.hitstopT = 0; this.koT = 0; this.tick = 0; this.hard = false; this.result = null; this.got = false; this.names = msg.names; this.ranks = msg.ranks; this.ratings = msg.ratings;
    this.fighters = msg.chars.map((c, i) => new Fighter({
      id: i, name: msg.names[i], isPlayer: true, raceKey: c.raceKey, clanKey: c.clanKey, stats: StatBuilder.build(c.raceKey, c.clanKey, msg.level),
      look: { outfit: c.outfit, hair: c.hair, aura: c.aura, accessory: c.accessory, body: c.body }, powers: c.powers, x: i ? 225 : 95, face: i ? -1 : 1
    }));
    this.player = this.fighters[msg.slot]; this.enemy = this.fighters[1 - msg.slot];
    for (const f of this.fighters) { f.m = this; f.opp = f === this.player ? this.enemy : this.player; f._tx = f.x; f._ty = f.y; }
    this.player.press = a => Online.press(a);
    this.profile = { level: msg.level, wins: 0 }; this.character = msg.chars[msg.slot]; this.prevState = "intro";
  }
  apply(s) {
    this.tick = s.n; this.prevState = this.state; this.state = s.s; this.timeLeft = s.tl;
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i], q = s.f[i];
      if (!this.got || Math.abs(q.x - f._tx) > 50 || Math.abs(q.y - f._ty) > 40) { f.x = q.x; f.y = q.y; }
      f._tx = q.x; f._ty = q.y; f.vx = q.vx; f.vy = q.vy; f.face = q.face; f.onGround = !!q.g; f.hp = q.hp; f.ki = q.ki; f.stun = q.stun; f.invuln = q.inv ? .1 : 0; f.hitFlash = q.hf ? .1 : 0;
      f.guarding = !!q.gd; f.landT = q.lt ? .09 : 0; f.awakenT = q.aw; f.armorT = q.ar; f.hidden = !!q.hid; f.ko = !!q.ko; f.koT = q.kt; f.victory = !!q.vic;
      f.comboStep = q.cs; f.comboTimer = q.ct; f.chainHits = q.ch; f.chainTimer = q.cht; f.burn = q.burn ? { t: 1 } : null; f.poison = q.po ? { t: 1 } : null; f.shield = q.sh || 0; f.st = q.st || {}; Object.assign(f.cd, q.cd);
      if (q.act) { const a = q.act; if (a.type === "attack") a.mv = a.air ? AIR_MOVE : MOVES[(a.step || 1) - 1]; f.act = a; } else f.act = null;
    }
    this.projectiles = s.p.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy || 0, r: p.r, color: p.c }));
    this.got = true;
    if (s.e) for (const e of s.e) this.replay(e);
    if (this.prevState === "intro" && this.state === "fight") UI.banner("LUTE!", "", 600);
    if (this.prevState === "fight" && this.state !== "fight" && this.state !== "intro" && !Online.result) UI.banner(this.timeLeft <= .05 ? "TEMPO ESGOTADO" : "K.O.", "", null, this.player.ko);
  }
  replay(e) {
    if (e.f) { if (FX_REPLAY[e.f] && Array.isArray(e.a) && e.a.length <= 8) FX[e.f].apply(FX, e.a); }
    else if (e.s === "shake") FX.shake = Math.max(FX.shake, +e.v || 0);
    else if (e.s === "flash") FX.flash = Math.max(FX.flash, +e.v || 0);
    else if (e.s === "flashColor") { if (Save.isColor(e.v)) FX.flashColor = e.v; }
    else if (typeof e.a === "string") Sound.play(e.a.slice(0, 16));
  }
  update(dt) {
    for (const f of this.fighters) {
      f.animT += dt; if (f.act) f.act.t += dt;
      const k = 1 - Math.exp(-dt * 26); f.x += (f._tx - f.x) * k; f.y += (f._ty - f.y) * k;
      f.trailT -= dt; const a = f.act;
      if (f.trailT <= 0 && !f.ko && ((a && a.type === "dash" && a.t < a.dur) || f.awakenT > 0 && Math.abs(f.vx) > f.stats.speed * .8)) { f.trailT = .05; FX.ghost(f, Sprites.poseFor(f), f.palette.aura); }
    }
    for (const p of this.projectiles) { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (this.state === "fight") this.timeLeft = Math.max(0, this.timeLeft - dt);
    FX.update(dt);
  }
}

const Online = {
  KEY_URL: "dragonArena_online_url", KEY_TOK: "dragonArena_online_token",
  ws: null, url: "", token: null, me: null, status: "idle", view: null, active: false, finished: false, result: null, raf: 0, last: 0, sent: { mx: 0, g: 0, at: 0 },
  retry: 0, retryT: 0, wantConn: false, pingMs: 0, pingT: 0, queuedAt: 0, qT: 0, lbT: 0, serverStats: null, authBusy: false,

  store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } },
  load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  defaultUrl() { return /^https?:$/.test(location.protocol) ? (location.protocol === "https:" ? "wss://" : "ws://") + location.host : ""; },
  init() {
    this.url = this.load(this.KEY_URL) || this.defaultUrl(); this.token = this.load(this.KEY_TOK);
    $("onUrl").value = this.url;
    $("onConnect").addEventListener("click", () => { this.setUrl($("onUrl").value); this.connect(true); });
    $("onLogin").addEventListener("click", () => this.submitAuth("login"));
    $("onRegister").addEventListener("click", () => this.submitAuth("register"));
    $("onPass").addEventListener("keydown", e => { if (e.key === "Enter") this.submitAuth("login"); });
    $("onQueue").addEventListener("click", () => this.queue());
    $("onBot").addEventListener("click", () => { $("onCancel").click(); $("startBtn").click(); });
    $("onCancel").addEventListener("click", () => this.send({ t: "unqueue" }));
    $("onLogout").addEventListener("click", () => this.logout());
    $("onRefresh").addEventListener("click", () => this.send({ t: "lb" }));
    this.render();
  },
  onTabShown() { if (!this.ws && (this.token || this.url)) this.connect(false); this.send({ t: "lb" }); },
  setUrl(u) { u = String(u || "").trim(); if (u && !/^wss?:\/\//i.test(u)) u = (/^localhost|^127\./.test(u) ? "ws://" : "wss://") + u.replace(/^https?:\/\//i, ""); this.url = u.replace(/\/+$/, ""); $("onUrl").value = this.url; this.store(this.KEY_URL, this.url); },

  /* ---------- conexão ---------- */
  connect(manual) {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    if (!this.url) { this.msg("Informe o endereço do servidor (ex.: wss://seu-jogo.onrender.com)."); return; }
    this.wantConn = true; this.status = "connecting"; this.connAt = this.connAt || performance.now(); clearTimeout(this.wakeT); this.wakeT = setTimeout(() => this.render(), 5000); this.render();
    let ws; try { ws = new WebSocket(this.url); } catch (e) { this.msg("Endereço inválido."); this.status = "idle"; this.render(); return; }
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.connAt = 0; this.status = "connected"; if (this.token) this.send({ t: "resume", token: this.token, v: NET_VERSION }); this.render(); this.pingTimer(); };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return; this.ws = null; clearInterval(this.pingT); this.me = this.me; this.status = "offline";
      if (this.active && !this.finished) UI.banner("Conexão perdida", "Tentando reconectar…", null, true);
      this.render();
      if (this.wantConn) { this.retry++; const wait = Math.min(15, 1 + this.retry * 1.5) * 1000; clearTimeout(this.retryT); this.retryT = setTimeout(() => this.connect(false), wait); }
    };
    ws.onerror = () => { };
  },
  disconnect() { this.wantConn = false; this.connAt = 0; clearTimeout(this.retryT); if (this.ws) { try { this.ws.close(); } catch (e) { } } },
  send(o) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); return true; } catch (e) { } } return false; },
  pingTimer() { clearInterval(this.pingT); this.pingT = setInterval(() => this.send({ t: "ping", c: performance.now() }), 4000); this.send({ t: "ping", c: performance.now() }); },
  msg(t, bad) { const el = $("onMsg"); if (el) { el.textContent = t || ""; el.style.color = bad === false ? "#9fe8b0" : "#ffb4c0"; } },

  /* ---------- contas ---------- */
  submitAuth(kind) {
    const u = $("onUser").value, p = $("onPass").value;
    if (!this.ws || this.ws.readyState !== 1) { this.setUrl($("onUrl").value); this.connect(true); this.msg("Conectando… tente de novo em instantes."); return; }
    this.msg(""); this.send({ t: kind, u, p, v: NET_VERSION });
  },
  logout() { this.send({ t: "logout" }); },
  queue() { if (!this.me) return; this.msg(""); this.send({ t: "queue", character: UI.character() }); },

  /* ---------- mensagens ---------- */
  onMsg(m) {
    switch (m.t) {
      case "hello": this.serverStats = m; if (m.v !== NET_VERSION) this.msg("Versão do servidor diferente. Recarregue a página.", true); this.render(); break;
      case "auth":
        if (m.ok) { this.token = m.token; this.store(this.KEY_TOK, m.token); this.me = m.me; this.status = "ready"; $("onPass").value = ""; this.msg(""); this.send({ t: "lb" }); }
        else { if (m.resume) { this.token = null; this.store(this.KEY_TOK, null); } else this.msg(m.msg || "Não foi possível entrar.", true); }
        this.render(); break;
      case "me": this.me = m.me; this.render(); break;
      case "lb": this.renderLb(m.list); this.serverStats = Object.assign(this.serverStats || {}, m.stats); this.render(); break;
      case "queued": this.status = "queued"; this.queuedAt = performance.now(); this.render(); clearInterval(this.qT); this.qT = setInterval(() => this.render(), 1000); break;
      case "unqueued": this.status = "ready"; clearInterval(this.qT); this.render(); break;
      case "loggedout": this.me = null; this.token = null; this.store(this.KEY_TOK, null); this.status = "connected"; this.render(); break;
      case "kicked": this.me = null; this.token = null; this.store(this.KEY_TOK, null); this.msg(m.msg, true); this.wantConn = false; this.render(); break;
      case "err": this.msg(m.msg || "Erro.", true); if (m.code === "version") this.wantConn = false; this.render(); break;
      case "pong": this.pingMs = Math.round(performance.now() - m.c); this.render(); break;
      case "match": this.startMatch(m); break;
      case "snap": if (this.view && this.active) this.view.apply(m); break;
      case "oppdc": if (this.active) UI.banner("Rival desconectado", "Aguardando a volta por até " + m.secs + " s. Se não voltar, você vence.", null, false); break;
      case "oppback": if (this.active && !this.finished) UI.banner(null); break;
      case "result": this.onResult(m); break;
    }
  },

  /* ---------- partida ---------- */
  startMatch(msg) {
    clearInterval(this.qT); this.status = "match";
    if (this.view && this.view.id === msg.id && this.active) { UI.banner(null); return; }                // reconexão: continua a mesma partida
    cancelAnimationFrame(Game.raf); Game.raf = 0; FX.clear(); Input.reset();
    this.view = new NetView(msg); this.active = true; this.finished = false; this.result = null; this.sent = { mx: 0, g: 0, at: 0 };
    Game.match = this.view; Game.paused = false; Sound.unlock(); Sound.music(true);
    $("menu").classList.add("hidden"); $("battle").classList.remove("hidden"); Preview.stop();
    UI.initHud(this.view);
    const v = this.view, rk = (f, i) => f.race.name + " · " + v.ranks[i] + " (" + v.ratings[i] + " pts)";
    $("pMeta").textContent = rk(v.player, v.slot); $("eMeta").textContent = rk(v.enemy, 1 - v.slot);
    $("pauseBtn").style.display = "none"; $("restartBtn").style.display = "none"; $("pauseBtn").disabled = true;
    UI.log("Partida ranqueada! Arena: " + ARENAS[v.arena].name + " — atributos iguais para todos (nível " + msg.level + ").");
    UI.banner("RANQUEADA", v.player.name + "  vs  " + v.enemy.name);
    Game.fit(); UI.updateHud(v); this.last = 0; this.raf = requestAnimationFrame(t => this.loop(t));
  },
  loop(ts) {
    if (!this.active || !this.view) return;
    this.raf = requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(.1, this.last ? (ts - this.last) / 1000 : 0); this.last = ts;
    const mx = Input.moveX(), g = Input.guard() ? 1 : 0, now = performance.now();
    if (!this.finished && (mx !== this.sent.mx || g !== this.sent.g || now - this.sent.at > 250)) { this.sent = { mx, g, at: now }; this.send({ t: "in", mx, g }); }
    this.view.update(dt); Renderer.draw(this.view, ts / 1000); UI.updateHud(this.view);
  },
  press(a) { if (this.active && !this.finished && this.view && this.view.state === "fight") this.send({ t: "press", a }); },
  guardLeave() { if (!this.active || this.finished) return true; if (!confirm("Sair agora conta como abandono e você perde pontos. Sair mesmo?")) return false; this.send({ t: "forfeit" }); return true; },
  leave() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.active = false; this.view = null; this.result = null; this.finished = false;
    $("pauseBtn").style.display = ""; $("restartBtn").style.display = ""; $("pauseBtn").disabled = false; if (this.status === "match") this.status = this.me ? "ready" : "connected";
    this.send({ t: "me" }); this.render();
  },
  onResult(m) {
    if (!this.active) { this.me = m.me; this.render(); return; }
    this.finished = true; this.result = m; this.me = m.me; Input.reset(); this.send({ t: "in", mx: 0, g: 0 });
    const win = m.res === "win", draw = m.res === "draw";
    const typ = { ko: "por nocaute", time: "por tempo", forfeit: "por abandono", draw: "" }[m.type] || "";
    const title = draw ? "EMPATE" : win ? "VITÓRIA" : "DERROTA";
    const promo = { up: "  ⭐ SUBIU DE RANK!", down: "  ⬇ Caiu de rank", "div-up": "  ▲ Subiu de divisão", "div-down": "  ▼ Caiu de divisão" }[m.promo] || "";
    const pct = x => Math.round(x * 100), sg = x => (x > 0 ? "+" : "") + x;
    const sub = (draw ? "" : title[0] + title.slice(1).toLowerCase() + " " + typ + " · ") + sg(m.delta) + " pts → " + m.rating + " pts · " + m.rank.label + promo + "\n" +
      "Dano causado " + m.stats.dealt + " · Dano sofrido " + m.stats.taken + " · Combo máx. " + m.stats.combo + " · Duração " + m.stats.secs + " s · Vida restante " + m.stats.hpPct + "%\n" +
      "Nota da partida " + pct(m.parts.S) + " (esperada " + pct(m.parts.E) + "): resultado " + pct(m.parts.outcome) + " (70%) + domínio de dano " + sg(pct(m.parts.dominance)) + " (30%)" + (m.parts.farm ? "\nGanho reduzido: mesmo rival várias vezes na última hora." : "");
    Sound.music(false); Sound.play(win ? "win" : draw ? "block" : "lose");
    UI.banner(title, sub, 0, !win && !draw, [["Buscar outra partida", () => { this.leave(); Game.toMenu(); UI.showTab("online"); this.queue(); }, "primary"], ["← Menu", () => Game.toMenu()]]);
  },

  /* ---------- interface ---------- */
  render() {
    const on = this.ws && this.ws.readyState === 1, me = this.me, st = this.status;
    const sEl = $("onStatus");
    sEl.textContent = on ? "🟢 Conectado" + (this.pingMs ? " · " + this.pingMs + " ms" : "") + (this.serverStats && this.serverStats.online != null ? " · " + this.serverStats.online + " online" : "") : st === "connecting" ? "🟡 Conectando…" + (this.connAt && performance.now() - this.connAt > 5000 ? " o servidor gratuito estava dormindo e está acordando (pode levar até 1 minuto)" : "") : this.wantConn ? "🟠 Reconectando…" : "⚪ Desconectado";
    $("onConnect").textContent = on ? "Reconectar" : "Conectar";
    $("onAuth").classList.toggle("hidden", !on || !!me); $("onHome").classList.toggle("hidden", !me);
    if (me) {
      const r = me.rank; $("onRank").textContent = r.label; $("onPts").textContent = me.rating + " pts";
      $("onBar").style.transform = "scaleX(" + clamp(r.progress, 0, 1) + ")"; $("onNext").textContent = r.next ? me.rating + " / " + r.next + " para a próxima divisão" : "Rank máximo!";
      $("onUserName").textContent = me.username;
      $("onStats").textContent = me.wins + "V · " + me.losses + "D · " + me.draws + "E · " + me.kos + " KOs · sequência " + (me.streak > 0 ? "+" + me.streak : me.streak) + " · recorde " + me.bestRating + " pts";
      $("onPlace").textContent = me.placement > 0 ? "Fase de classificação: mais " + me.placement + " partida(s) com pontuação ampliada." : "";
      const h = $("onHist"); h.textContent = ""; (me.history || []).forEach(x => { const li = document.createElement("li"); li.textContent = (x.res === "win" ? "V" : x.res === "loss" ? "D" : "E") + " · " + x.opp + " (" + x.oppRating + ") · " + (x.delta > 0 ? "+" : "") + x.delta + " pts · dano " + x.dealt + "/" + x.taken + " · " + x.secs + " s" + ({ ko: " · KO", forfeit: " · abandono", time: " · tempo" }[x.type] || ""); li.className = x.res; h.appendChild(li); });
      if (!(me.history || []).length) { const li = document.createElement("li"); li.textContent = "Nenhuma partida ainda."; h.appendChild(li); }
    }
    const q = st === "queued"; $("onQueue").classList.toggle("hidden", q || st === "match"); $("onCancel").classList.toggle("hidden", !q);
    const qs = q ? Math.floor((performance.now() - this.queuedAt) / 1000) : 0, ss = this.serverStats;
    $("onQueueInfo").textContent = q ? "Procurando rival de pontuação próxima… " + qs + " s (a faixa de busca aumenta com o tempo)" + (ss && ss.online != null ? " · " + ss.online + " online" : "") + (qs >= 20 ? " — poucos jogadores agora? Que tal treinar contra o computador enquanto espera." : "") : "";
    $("onBot").classList.toggle("hidden", !(q && qs >= 20));
    $("onQueue").disabled = !on || !me;
  },
  renderLb(list) {
    const t = $("onLb"); t.textContent = ""; list = list || [];
    if (!list.length) { const li = document.createElement("li"); li.textContent = "Ainda não há jogadores ranqueados."; t.appendChild(li); return; }
    list.forEach(x => { const li = document.createElement("li"); li.textContent = x.pos + ". " + x.username + " — " + x.rank + " · " + x.rating + " pts · " + x.wins + "V/" + x.losses + "D"; if (this.me && this.me.username === x.username) li.className = "me"; t.appendChild(li); });
  }
};
