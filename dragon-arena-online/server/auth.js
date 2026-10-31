"use strict";
const crypto = require("crypto");
const SESSION_MS = 30 * 24 * 3600e3;
const USER_RE = /^[a-z0-9_]{3,16}$/;

const normUser = u => (typeof u === "string" ? u.trim().toLowerCase() : "");
const validUser = u => USER_RE.test(u);
const validPass = p => typeof p === "string" && p.length >= 6 && p.length <= 72;

function scrypt(pass, salt) { return new Promise((res, rej) => crypto.scrypt(pass, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k))); }
async function hashPassword(pass) { const salt = crypto.randomBytes(16); const h = await scrypt(pass, salt); return { salt: salt.toString("hex"), hash: h.toString("hex") }; }
async function checkPassword(pass, rec) { const h = await scrypt(pass, Buffer.from(rec.salt, "hex")); const a = Buffer.from(rec.hash, "hex"); return a.length === h.length && crypto.timingSafeEqual(a, h); }
const newToken = () => crypto.randomBytes(32).toString("hex");
const tokenHash = t => crypto.createHash("sha256").update(String(t)).digest("hex");

/* limitador simples por chave (IP/usuário): no máximo `max` tentativas em `ms` */
class Limiter {
  constructor(max, ms) { this.max = max; this.ms = ms; this.m = new Map(); }
  hit(key) { const now = Date.now(); const a = (this.m.get(key) || []).filter(t => now - t < this.ms); a.push(now); this.m.set(key, a); if (this.m.size > 5000) this.sweep(now); return a.length <= this.max; }
  blocked(key) { const now = Date.now(); const a = (this.m.get(key) || []).filter(t => now - t < this.ms); return a.length >= this.max; }
  clear(key) { this.m.delete(key); }
  sweep(now) { for (const [k, a] of this.m) if (!a.some(t => now - t < this.ms)) this.m.delete(k); }
}
module.exports = { SESSION_MS, normUser, validUser, validPass, hashPassword, checkPassword, newToken, tokenHash, Limiter };
