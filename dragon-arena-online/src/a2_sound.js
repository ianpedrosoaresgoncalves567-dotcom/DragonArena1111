
/* ---------- Áudio procedural (Web Audio, sem arquivos externos) ---------- */
const Sound = {
  ctx: null, master: null, sfxG: null, musG: null, noiseBuf: null, muted: false, KEY: "dragonArena_mute",
  musicOn: false, timer: 0, step: 0, nextT: 0, last: {},
  init() {
    try { this.muted = localStorage.getItem(this.KEY) === "1"; } catch (e) { }
    const unlock = () => this.unlock();
    ["pointerdown", "keydown", "touchstart"].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
    this.updateBtn();
    $("muteBtn").addEventListener("click", () => { this.toggle(); $("muteBtn").blur(); });
  },
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .7; this.master.connect(this.ctx.destination);
        this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = .8; this.sfxG.connect(this.master);
        this.musG = this.ctx.createGain(); this.musG.gain.value = .22; this.musG.connect(this.master);
        const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        if (this.musicOn) this.startScheduler();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch (e) { this.ctx = null; }
  },
  toggle() {
    this.muted = !this.muted; try { localStorage.setItem(this.KEY, this.muted ? "1" : "0"); } catch (e) { }
    if (this.master) this.master.gain.value = this.muted ? 0 : .7; this.updateBtn();
  },
  updateBtn() { const b = $("muteBtn"); b.textContent = this.muted ? "🔇" : "🔊"; b.setAttribute("aria-label", this.muted ? "Ativar som" : "Silenciar"); b.title = this.muted ? "Ativar som (M)" : "Silenciar (M)"; },
  tone(f0, dur, type, vol, f1, delay, dest) {
    const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, freq, delay, type, f1, dest) {
    const c = this.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type || "bandpass"; fl.frequency.setValueAtTime(freq, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfxG); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  },
  play(name) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < .035) return; this.last[name] = now;
    try {
      switch (name) {
        case "click": this.tone(660, .06, "square", .12, 880); break;
        case "whoosh": this.noise(.11, .22, 1800, 0, "bandpass", 700); break;
        case "whooshH": this.noise(.18, .3, 1400, 0, "bandpass", 300); this.tone(180, .12, "sawtooth", .08, 90); break;
        case "hit": this.noise(.09, .45, 1200, 0, "lowpass", 300); this.tone(220, .08, "square", .2, 90); break;
        case "hitH": this.noise(.22, .6, 1600, 0, "lowpass", 200); this.tone(140, .2, "sawtooth", .28, 50); this.tone(80, .25, "sine", .35, 40); break;
        case "block": this.noise(.06, .35, 3000, 0, "highpass"); this.tone(520, .07, "triangle", .2, 380); break;
        case "parry": this.tone(1200, .12, "triangle", .22, 1800); this.tone(1800, .2, "sine", .18, 2400, .05); this.noise(.1, .25, 5000, 0, "highpass"); break;
        case "break": this.noise(.3, .5, 900, 0, "bandpass", 120); this.tone(300, .25, "sawtooth", .25, 60); break;
        case "jump": this.tone(300, .12, "square", .1, 600); break;
        case "dash": this.noise(.2, .3, 600, 0, "bandpass", 2600); break;
        case "blast": this.tone(900, .25, "sawtooth", .16, 220); this.noise(.18, .2, 2500, 0, "bandpass", 500); break;
        case "awaken": this.tone(110, .8, "sawtooth", .2, 440); this.tone(220, .8, "square", .08, 880); this.noise(.7, .22, 400, 0, "bandpass", 3000); break;
        case "pillar": this.noise(.6, .5, 500, 0, "lowpass", 100); this.tone(90, .5, "sawtooth", .3, 40); this.tone(300, .4, "square", .08, 700, .05); break;
        case "phase": this.tone(1500, .18, "sine", .2, 300); this.tone(300, .16, "sine", .2, 1500, .2); this.noise(.12, .15, 4000, 0, "highpass"); break;
        case "beamCharge": this.tone(150, .45, "sawtooth", .14, 900); this.tone(300, .45, "sine", .12, 1800); break;
        case "beam": this.noise(.5, .4, 3500, 0, "bandpass", 300); this.tone(1000, .5, "sawtooth", .22, 120); this.tone(60, .5, "sine", .4, 30); break;
        case "armor": this.tone(180, .3, "square", .18, 120); this.noise(.25, .3, 700, 0, "lowpass", 200); this.tone(360, .2, "triangle", .12, 200, .08); break;
        case "ko": this.noise(.7, .6, 1500, 0, "lowpass", 80); this.tone(200, .8, "sawtooth", .3, 35); this.tone(60, .9, "sine", .45, 28); break;
        case "fight": this.tone(440, .12, "square", .16); this.tone(660, .12, "square", .16, 0, .1); this.tone(880, .25, "square", .18, 0, .2); break;
        case "win": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .22, "square", .16, 0, i * .13)); this.tone(1046, .6, "triangle", .2, 0, .55); break;
        case "lose": [392, 349, 311, 262].forEach((f, i) => this.tone(f, .3, "triangle", .2, 0, i * .22)); break;
        case "champ": [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, .2, "square", .16, 0, i * .12)); this.tone(1568, .9, "triangle", .2, 0, .9); break;
      }
    } catch (e) { }
  },
  /* música: baixo + arpejo + bateria, em lá menor, com agendamento antecipado */
  music(on) {
    this.musicOn = on;
    if (!on) { clearInterval(this.timer); this.timer = 0; return; }
    if (this.ctx) this.startScheduler();
  },
  startScheduler() {
    if (this.timer) return; this.step = 0; this.nextT = this.ctx.currentTime + .1;
    this.timer = setInterval(() => this.schedule(), 60);
  },
  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 142 / 4;                                    // duração de uma semicolcheia
    const bass = [55, 55, 82.4, 55, 65.4, 65.4, 98, 65.4, 87.3, 87.3, 130.8, 87.3, 98, 98, 73.4, 98];
    const arp = [220, 261.6, 329.6, 261.6, 261.6, 329.6, 392, 329.6, 349.2, 440, 523.3, 440, 392, 493.9, 587.3, 493.9];
    while (this.nextT < this.ctx.currentTime + .25) {
      const s = this.step % 64, bar = Math.floor(s / 16), i = s % 16, d = this.nextT - this.ctx.currentTime;
      if (!this.muted) {
        const b = bass[(bar * 4 + (i >> 2)) % 16];
        if (i % 2 === 0) this.tone(b, spb * 1.7, "square", .35, 0, d, this.musG);
        if (i % 4 === 2 || bar % 2 === 1 && i % 2 === 1) this.tone(arp[(bar * 4 + (i >> 2)) % 16] * (i % 8 > 3 ? 2 : 1), spb * 1.2, "triangle", .5, 0, d, this.musG);
        if (i % 8 === 0) this.tone(130, .12, "sine", .7, 40, d, this.musG);
        if (i % 8 === 4) this.noise(.1, .35, 1800, d, "bandpass", 0, this.musG);
        if (i % 2 === 1) this.noise(.03, .12, 7000, d, "highpass", 0, this.musG);
      }
      this.nextT += spb; this.step++;
    }
  }
};
