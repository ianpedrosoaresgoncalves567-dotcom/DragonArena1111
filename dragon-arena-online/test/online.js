"use strict";
const http = require("http");
const { ok, sleep, boot, Client, summary } = require("./helpers");
const get = (port, p) => new Promise((res, rej) => http.get({ host: "127.0.0.1", port, path: p }, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res({ status: r.statusCode, body: b })); }).on("error", rej));
const CH = { raceKey: "ignar", clanKey: "chama", outfit: "#ff7a3d", hair: "#ffd45e", aura: "#ff9a3c" };

/* "bot" de teste: anda até o rival e ataca; o outro lado pode ficar parado */
function aggressive(c, slot) {
  const iv = setInterval(() => {
    if (c.closed || !c.last) return; const me = c.last.f[slot], op = c.last.f[1 - slot], d = op.x - me.x;
    c.send({ t: "in", mx: Math.abs(d) > 22 ? Math.sign(d) : 0, g: 0 }); c.send({ t: "press", a: Math.abs(d) < 34 ? "attack" : (Math.random() < .2 ? "blast" : "attack") });
  }, 90); return () => clearInterval(iv);
}
async function pair(port, a, b, ca, cb) {
  await ca.open(); await cb.open();
  ca.send({ t: "queue", character: CH }); cb.send({ t: "queue", character: Object.assign({}, CH, { raceKey: "luminar", clanKey: "vazio" }) });
  const [ma, mb] = await Promise.all([ca.waitT("match", 12000), cb.waitT("match", 12000)]); return [ma, mb];
}

(async () => {
  const { srv, port, dir } = await boot({ graceMs: 1500, mm: { base: 100, perSec: 400 } });
  console.log("HTTP");
  const h = await get(port, "/health"); ok(h.status === 200 && JSON.parse(h.body).ok, "/health responde");
  const idx = await get(port, "/"); ok(idx.status === 200 && idx.body.includes("Dragon Arena"), "/ serve o jogo");
  ok((await get(port, "/nada")).status === 404, "rota inexistente = 404");

  console.log("Contas");
  const A = new Client(port), B = new Client(port); await A.open(); await B.open();
  ok((await A.auth("register", "ab", "123456")).ok === false, "usuário curto é recusado");
  ok((await A.auth("register", "alice", "123")).ok === false, "senha curta é recusada");
  ok((await A.auth("register", "alice", "senha123", "99")).code === "version", "versão diferente é recusada");
  const ra = await A.auth("register", "Alice", "senha123"); ok(ra.ok && ra.token && ra.me.username === "alice" && ra.me.rating === 1000 && ra.me.rank.label === "Bronze II", "cadastro cria conta com 1000 pts (Bronze II)");
  ok((await B.auth("register", "alice", "outra123")).ok === false, "nome repetido (sem diferenciar maiúsculas) é recusado");
  const rb = await B.auth("register", "bob", "senha456"); ok(rb.ok, "segundo cadastro");
  const C = new Client(port); await C.open(); ok((await C.auth("login", "alice", "errada1")).ok === false, "senha errada é recusada");
  const lc = await C.auth("login", "alice", "senha123"); ok(lc.ok, "login correto");
  await sleep(50); ok(A.msgs.some(m => m.t === "kicked") || A.closed, "segundo login derruba a sessão anterior");
  C.close();
  const fs = require("fs"); await srv.storage.close(); const raw = fs.readFileSync(dir + "/db.json", "utf8"); ok(!raw.includes("senha123") && raw.includes('"hash"'), "senha não é guardada em texto puro");
  // brute force
  const V = new Client(port); await V.open(); await V.auth("register", "carol", "senha123"); V.close(); const D = new Client(port); await D.open(); let blocked = false; for (let i = 0; i < 10; i++) { const r = await D.auth("login", "carol", "x" + i + "xxxx"); if (r.msg && r.msg.includes("Muitas")) blocked = true; }
  ok(blocked, "muitas senhas erradas bloqueiam temporariamente"); D.close();
  ok((await new Client(port).open().then(async () => 1)), "novas conexões continuam aceitas");

  console.log("Partida ranqueada completa");
  const A2 = new Client(port), B2 = new Client(port); await A2.open(); await B2.open();
  const resA = await A2.auth("login", "alice", "senha123"), resB = await B2.auth("login", "bob", "senha456"); ok(resA.ok && resB.ok, "login dos dois");
  A2.send({ t: "queue", character: CH }); B2.send({ t: "queue", character: Object.assign({}, CH, { raceKey: "luminar", clanKey: "vazio", body: { gender: "fem", height: 110 } }) });
  const [m1, m2] = await Promise.all([A2.waitT("match", 12000), B2.waitT("match", 12000)]);
  ok(m1.slot + m2.slot === 1 && m1.id === m2.id, "os dois entram na mesma partida, em lados diferentes");
  ok(m1.names[0] !== m1.names[1] && m1.chars.length === 2 && m1.level === 10, "dados da partida (nomes, personagens, nível normalizado)");
  const bFem = m1.chars.find(c => c.raceKey === "luminar"); ok(bFem.body.gender === "fem" && bFem.body.height === 110, "corpo personalizado chega ao rival");
  const slotA = m1.slot;                      // Alice ataca; Bob fica parado
  const stop = aggressive(A2, slotA);
  const [fa, fb] = await Promise.all([A2.waitT("result", 90000), B2.waitT("result", 90000)]);
  stop();
  ok(A2.snaps > 100, "Alice recebeu snapshots durante a luta (" + A2.snaps + ")");
  ok(fa.res === "win" && fb.res === "loss" && fa.type === "ko", "Alice venceu por KO e Bob perdeu");
  ok(fa.delta > 0 && fb.delta < 0 && fa.rating === 1000 + fa.delta && fb.rating === 1000 + fb.delta, "pontos aplicados (" + fa.delta + " / " + fb.delta + ")");
  ok(fa.stats.dealt > 50 && fb.stats.taken > 50 && fa.stats.combo >= 1 && fa.stats.secs > 3, "estatísticas da partida (dano " + fa.stats.dealt + ", combo " + fa.stats.combo + ", " + fa.stats.secs + "s)");
  ok(fa.parts && fa.parts.S > .6 && fa.parts.dominance > 0, "nota da partida e domínio positivos para quem venceu");
  ok(fa.me.history.length === 1 && fa.me.history[0].opp === "bob" && fa.me.wins === 1 && fb.me.losses === 1, "histórico e contadores atualizados");
  const lb = await get(port, "/api/leaderboard"); const lbj = JSON.parse(lb.body); ok(lbj.length === 2 && lbj[0].username === "alice" && lbj[0].rating > lbj[1].rating, "ranking ordenado por pontos");
  await sleep(300);

  console.log("Abandono");
  const E = new Client(port), F = new Client(port); await E.open(); await F.open(); await E.auth("register", "erika", "senha123"); await F.auth("register", "fabio", "senha123");
  E.send({ t: "queue", character: CH }); F.send({ t: "queue", character: CH }); await Promise.all([E.waitT("match", 12000), F.waitT("match", 12000)]);
  await sleep(300); E.send({ t: "forfeit" }); const [fe, ff] = await Promise.all([E.waitT("result", 8000), F.waitT("result", 8000)]);
  ok(fe.res === "loss" && ff.res === "win" && fe.type === "forfeit" && fe.delta <= -10 && ff.delta >= 5, "abandonar = derrota com penalidade extra (" + fe.delta + "), rival vence (+" + ff.delta + ")");

  console.log("Desconexão e reconexão");
  const G = new Client(port), H = new Client(port); await G.open(); await H.open(); const rg = await G.auth("register", "gabi", "senha123"); await H.auth("register", "hugo", "senha123");
  G.send({ t: "queue", character: CH }); H.send({ t: "queue", character: CH }); const [mg] = await Promise.all([G.waitT("match", 12000), H.waitT("match", 12000)]);
  await sleep(400); const snapsBefore = H.snaps; G.close(); await H.waitT("oppdc", 3000); ok(true, "rival é avisado da queda");
  await sleep(300); const s1 = H.snaps; await sleep(300); ok(H.snaps === s1, "partida pausa enquanto o rival está fora");
  const G2 = new Client(port); await G2.open(); G2.send({ t: "resume", token: rg.token, v: "1" }); const rr = await G2.wait(m => m.t === "auth"); ok(rr.ok, "sessão retomada pelo token");
  const mg2 = await G2.waitT("match", 3000); ok(mg2.resumed && mg2.id === mg.id && mg2.slot === mg.slot, "volta para a mesma partida e lado"); await H.waitT("oppback", 3000); ok(true, "rival é avisado da volta");
  await sleep(500); ok(G2.snaps > 3 && H.snaps > s1, "snapshots voltam a fluir");
  G2.close(); const rH = await H.waitT("result", 6000); ok(rH.res === "win" && rH.type === "forfeit", "sem voltar dentro do prazo, quem caiu perde por abandono");

  console.log("Matchmaking por pontos");
  const st = srv.storage; for (const [n, r] of [["pro1", 1900], ["novato1", 1000]]) { const c = new Client(port); await c.open(); await c.auth("register", n, "senha123"); const u = await st.getUser(n); u.rating = r; await st.saveUser(u); c.close(); }
  const P = new Client(port), N = new Client(port); await P.open(); await N.open(); await P.auth("login", "pro1", "senha123"); await N.auth("login", "novato1", "senha123");
  P.send({ t: "queue", character: CH }); N.send({ t: "queue", character: CH }); await sleep(1400);
  ok(!P.msgs.some(m => m.t === "match"), "900 pts de diferença não casam de imediato"); await P.waitT("match", 8000); ok(true, "a janela de busca se amplia com o tempo e eles casam");
  P.send({ t: "forfeit" }); await sleep(300);

  await srv.stop(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.error("ERRO NO TESTE:", e); process.exit(2); });
