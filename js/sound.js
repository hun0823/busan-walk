// 배경 사운드: 잔잔한 음악 + 물소리. 전부 WebAudio로 실시간 직접 합성(외부 음원 파일 없음, 연출).
// 음악: 펜타토닉 피아노풍 음(사인+삼각, 약간 디튠) + 느린 패드, 생성 리버브(노이즈 임펄스 컨볼버)
// 시간대별 템포·밝기: 아침 72bpm 밝게 / 점심 80bpm / 저녁 60bpm 어둡게
const PHASE = { morning: { bpm: 72, lp: 3200, root: 60 }, noon: { bpm: 80, lp: 4200, root: 62 }, evening: { bpm: 60, lp: 1600, root: 57 } };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const PADS = [[0, 7, 16], [-3, 4, 12], [5, 12, 16], [-5, 7, 14]];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
export class BgSound {
  constructor() { this.ctx = null; this.started = false; this.muted = false; this.phase = 'morning'; this.near = 0; }
  init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    // 생성 리버브(약 4초 감쇠)
    const len = ctx.sampleRate * 4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = .55; this.rev.connect(rg).connect(this.master);
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 3000;
    this.music = ctx.createGain(); this.music.gain.value = .5; this.tone.connect(this.music); this.music.connect(this.master); this.music.connect(this.rev);
    // 물소리(브라운 노이즈 + 느린 LFO 필터)
    const wl = ctx.sampleRate * 4, wb = ctx.createBuffer(1, wl, ctx.sampleRate), wd = wb.getChannelData(0);
    let last = 0; for (let i = 0; i < wl; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; wd[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = wb; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .12; lg.gain.value = 300; lfo.connect(lg).connect(lp.frequency); lfo.start();
    this.water = ctx.createGain(); this.water.gain.value = .25; src.connect(lp).connect(this.water).connect(this.master); src.start();
    this.next = ctx.currentTime + .3; this.step = 0; this.bar = 0;
    this.timer = setInterval(() => this.schedule(), 200);
  }
  note(t, m, dur, vel, type = 'sine') {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    for (const [ty, det, v] of [[type, -4, .6], ['triangle', 5, .4]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz(m); o.detune.value = det; const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + dur + .05); }
    g.connect(this.tone);
  }
  pad(t, root, chord, dur) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const iv of chord) for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(root - 12 + iv); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + .1); }
    g.connect(this.tone);
  }
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = PHASE[this.phase] || PHASE.morning, beat = 60 / P.bpm;
    while (this.next < this.ctx.currentTime + 1.2) {
      const t = this.next;
      if (this.step % 8 === 0) this.pad(t, P.root, PADS[this.bar++ % PADS.length], beat * 8.5);
      if (Math.random() < (this.step % 2 ? .35 : .7)) this.note(t, P.root + PENTA[Math.floor(Math.random() * PENTA.length)], beat * 3, .09 + Math.random() * .04);
      this.next += beat; this.step++;
    }
  }
  start() { if (this.muted) return; if (!this.ctx) this.init(); this.ctx.resume(); this.started = true; this.fade(); }
  setMuted(m) { this.muted = m; if (!m) this.start(); else this.fade(); }
  fade() { if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : .18, this.ctx.currentTime, .8); }
  setPhase(p) { if (p === this.phase) return; this.phase = p; if (this.ctx) this.tone.frequency.setTargetAtTime((PHASE[p] || PHASE.morning).lp, this.ctx.currentTime, 2); }
  chime() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime + .05; [76, 79, 83, 88, 83].forEach((m, i) => this.note(t + i * .28, m, 1.6, .5)); } // v3.9 드론쇼 시작 부드러운 차임(직접 합성)
  setNear(v) { this.near = v; if (this.ctx) this.water.gain.setTargetAtTime(.12 + .6 * v, this.ctx.currentTime, 1); } // 수로 가까울수록 물소리 큼
  get status() { return { started: this.started, state: this.ctx?.state || 'none', muted: this.muted, phase: this.phase, near: this.near }; }
}
