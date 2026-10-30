
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
