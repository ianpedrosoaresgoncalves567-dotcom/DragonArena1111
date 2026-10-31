"use strict";
const WebSocket = require("ws"), fs = require("fs"), os = require("os"), path = require("path");
const { createServer } = require("../server/server");
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; console.log("  ✓", msg); } else { fails++; console.log("  ✗ FALHOU:", msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "da-test-"));
  const srv = createServer(Object.assign({ quiet: true, dataDir: dir, databaseUrl: "", allowedOrigins: "" }, extra || {}));
  const port = await srv.start(0, "127.0.0.1"); return { srv, port, dir };
}
class Client {
  constructor(port) { this.port = port; this.msgs = []; this.waiters = []; this.snaps = 0; this.last = null; }
  open() { return new Promise((res, rej) => { this.ws = new WebSocket("ws://127.0.0.1:" + this.port); this.ws.on("open", res); this.ws.on("error", rej); this.ws.on("message", d => { const m = JSON.parse(d); if (m.t === "snap") { this.snaps++; this.last = m; } this.msgs.push(m); this.waiters = this.waiters.filter(w => { if (w.f(m)) { w.r(m); return false; } return true; }); }); this.ws.on("close", () => { this.closed = true; }); }); }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(f, ms) { const hit = this.msgs.find(f); if (hit) return Promise.resolve(hit); return new Promise((r, j) => { const w = { f, r }; this.waiters.push(w); setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); j(new Error("timeout esperando mensagem")); }, ms || 8000); }); }
  waitT(t, ms) { return this.wait(m => m.t === t, ms); }
  async auth(kind, u, p, v) { this.send({ t: kind, u, p, v: v || "2" }); return this.wait(m => m.t === "auth" || (m.t === "err" && m.code === "version"), 8000).then(m => { this.msgs = this.msgs.filter(x => x !== m); return m; }); }
  close() { try { this.ws.close(); } catch (e) { } }
}
const summary = () => { console.log(fails ? "\n" + fails + " FALHA(S), " + passes + " ok" : "\nTodos os " + passes + " testes passaram"); return fails; };
module.exports = { ok, sleep, boot, Client, summary, WebSocket };
