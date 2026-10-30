"use strict";
/* =====================================================================
 *  Armazenamento de contas e sessões.
 *  - DATABASE_URL definido  -> PostgreSQL (recomendado em produção: dados permanentes)
 *  - caso contrário          -> arquivo JSON em DATA_DIR (bom para testes locais; no plano
 *    gratuito do Render o disco é apagado a cada deploy/reinício!)
 *  Interface (assíncrona): init, getUser, createUser, saveUser, top, getSession, setSession, delSession, count
 * ===================================================================== */
const fs = require("fs"), path = require("path");

class FileStorage {
  constructor(dir) { this.dir = dir; this.file = path.join(dir, "db.json"); this.users = new Map(); this.sessions = new Map(); this.timer = null; this.kind = "arquivo"; }
  async init() {
    fs.mkdirSync(this.dir, { recursive: true });
    try { const j = JSON.parse(fs.readFileSync(this.file, "utf8")); for (const u of j.users || []) this.users.set(u.username, u); for (const [k, v] of Object.entries(j.sessions || {})) this.sessions.set(k, v); }
    catch (e) { if (e.code !== "ENOENT") { try { fs.copyFileSync(this.file, this.file + ".corrompido-" + Date.now()); } catch (_) { } console.warn("[storage] db.json ilegível, copiado e recomeçando:", e.message); } }
  }
  flushSoon() { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; this.flushNow(); }, 400); this.timer.unref && this.timer.unref(); }
  flushNow() {
    const tmp = this.file + ".tmp"; const now = Date.now();
    for (const [k, v] of this.sessions) if (v.exp < now) this.sessions.delete(k);
    fs.writeFileSync(tmp, JSON.stringify({ users: [...this.users.values()], sessions: Object.fromEntries(this.sessions) })); fs.renameSync(tmp, this.file);
  }
  async getUser(name) { const u = this.users.get(name); return u ? JSON.parse(JSON.stringify(u)) : null; }
  async createUser(u) { if (this.users.has(u.username)) return false; this.users.set(u.username, JSON.parse(JSON.stringify(u))); this.flushSoon(); return true; }
  async saveUser(u) { this.users.set(u.username, JSON.parse(JSON.stringify(u))); this.flushSoon(); }
  async top(n) { return [...this.users.values()].filter(u => u.games > 0).sort((a, b) => b.rating - a.rating || a.createdAt - b.createdAt).slice(0, n).map(u => JSON.parse(JSON.stringify(u))); }
  async count() { return this.users.size; }
  async getSession(h) { const s = this.sessions.get(h); if (!s) return null; if (s.exp < Date.now()) { this.sessions.delete(h); return null; } return s; }
  async setSession(h, s) { this.sessions.set(h, s); this.flushSoon(); }
  async delSession(h) { this.sessions.delete(h); this.flushSoon(); }
  async close() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.flushNow(); }
}

class PgStorage {
  constructor(url) {
    let Pool; try { ({ Pool } = require("pg")); } catch (e) { throw new Error("DATABASE_URL definido, mas o pacote 'pg' não está instalado (npm install)."); }
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new Pool({ connectionString: url, ssl: local || process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false }, max: 5 }); this.kind = "postgres";
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, rating INTEGER NOT NULL DEFAULT 1000, games INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, data JSONB NOT NULL)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS users_rating_idx ON users (rating DESC)`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, username TEXT NOT NULL, exp BIGINT NOT NULL)`);
  }
  async getUser(name) { const r = await this.pool.query("SELECT data FROM users WHERE username=$1", [name]); return r.rows[0] ? r.rows[0].data : null; }
  async createUser(u) { const r = await this.pool.query("INSERT INTO users (username, rating, games, created_at, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [u.username, u.rating, u.games, u.createdAt, JSON.stringify(u)]); return r.rowCount === 1; }
  async saveUser(u) { await this.pool.query("UPDATE users SET rating=$2, games=$3, data=$4 WHERE username=$1", [u.username, u.rating, u.games, JSON.stringify(u)]); }
  async top(n) { const r = await this.pool.query("SELECT data FROM users WHERE games>0 ORDER BY rating DESC, created_at ASC LIMIT $1", [n]); return r.rows.map(x => x.data); }
  async count() { const r = await this.pool.query("SELECT COUNT(*)::int AS n FROM users"); return r.rows[0].n; }
  async getSession(h) { const r = await this.pool.query("SELECT username, exp FROM sessions WHERE hash=$1", [h]); const s = r.rows[0]; if (!s) return null; if (+s.exp < Date.now()) { await this.delSession(h); return null; } return { u: s.username, exp: +s.exp }; }
  async setSession(h, s) { await this.pool.query("INSERT INTO sessions (hash, username, exp) VALUES ($1,$2,$3) ON CONFLICT (hash) DO UPDATE SET exp=$3", [h, s.u, s.exp]); }
  async delSession(h) { await this.pool.query("DELETE FROM sessions WHERE hash=$1", [h]); }
  async close() { await this.pool.end(); }
}

function createStorage(opts) {
  opts = opts || {}; const url = opts.databaseUrl !== undefined ? opts.databaseUrl : process.env.DATABASE_URL;
  if (url) return new PgStorage(url);
  return new FileStorage(opts.dataDir || process.env.DATA_DIR || path.join(__dirname, "..", "data"));
}
module.exports = { createStorage, FileStorage, PgStorage };
