// 배경 사운드: 잔잔한 음악 + 물소리. 전부 WebAudio로 실시간 직접 합성(외부 음원 파일 없음, 연출).
// 음악: 펜타토닉 피아노풍 음(사인+삼각, 약간 디튠) + 느린 패드, 생성 리버브(노이즈 임펄스 컨볼버)
// 시간대별 템포·밝기: 아침 72bpm 밝게 / 점심 80bpm / 저녁 60bpm 어둡게
const PHASE = { morning: { bpm: 72, lp: 3200, root: 60 }, noon: { bpm: 80, lp: 4200, root: 62 }, evening: { bpm: 60, lp: 1600, root: 57 } };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const PADS = [[0, 7, 16], [-3, 4, 12], [5, 12, 16], [-5, 7, 14]];
// v3.9r: 맵별 곡(전부 직접 합성한 절차 생성 음악 — 외부 음원·다른 게임 음원 없음)
// scale: 음계(반음), bpm: 기본 템포, dens: 음 밀도, dur: 음 길이(박), oct: 옥타브 이동, wave: 음색, arp: 순서대로 오르내림, bass: 걷는 베이스
export const TRACKS = {
  bukhang: { name: '항구 산책', root: 60, bpm: 72, scale: [0, 2, 4, 7, 9, 12, 14, 16], dens: .7, dur: 3, wave: 'sine', pads: [[0, 7, 16], [-3, 4, 12], [5, 12, 16], [-5, 7, 14]] },
  gwangalli: { name: '바닷바람', root: 62, bpm: 84, scale: [0, 4, 6, 7, 11, 12, 16, 19], dens: .85, dur: 2, wave: 'triangle', arp: true, pads: [[0, 7, 11], [5, 9, 16], [-3, 4, 12], [2, 9, 14]] },
  hwangnyeong: { name: '산길 오르기', root: 57, bpm: 66, scale: [0, 2, 3, 7, 9, 10, 12, 14], dens: .5, dur: 4, wave: 'sine', vib: true, pads: [[0, 7, 15], [-2, 5, 14], [-4, 3, 12], [-5, 7, 14]] },
  yonggungsa: { name: '풍경 소리', root: 64, bpm: 54, scale: [0, 2, 5, 7, 9, 12, 14, 17], dens: .32, dur: 6, wave: 'sine', bell: true, pads: [[0, 7, 12], [5, 12, 17], [-5, 2, 12], [0, 5, 14]] },
  gamcheon: { name: '골목 오후', root: 60, bpm: 96, scale: [0, 2, 4, 5, 7, 9, 11, 12], dens: .6, dur: 1, wave: 'square', bass: [0, 7, 9, 5], pads: [[0, 4, 7], [-3, 4, 9], [5, 9, 12], [7, 11, 14]] },
};
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
export class BgSound {
  constructor() { this.ctx = null; this.started = false; this.muted = false; this.phase = 'morning'; this.near = 0; this.track = 'bukhang'; this.preview = ''; this.playing = 'bukhang'; }
  init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    // 생성 리버브(약 4초 감쇠)
    const len = ctx.sampleRate * 4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = .55; this.rev.connect(rg).connect(this.master);
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 3000;
    this.music = ctx.createGain(); this.music.gain.value = .8; /* v3.9r: 배경음악 조금 크게(.5→.8) */ this.tone.connect(this.music); this.music.connect(this.master); this.music.connect(this.rev);
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
  note(t, m, dur, vel, type = 'sine', ex = {}) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    for (const [ty, det, v] of [[type, -4, .6], ['triangle', 5, .4]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz(m); o.detune.value = det; if (ex.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = 9; l.connect(lg).connect(o.detune); l.start(t); l.stop(t + dur + .1); } if (ex.bell && ty === 'triangle') o.frequency.value = hz(m) * 2.76; const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + dur + .05); }
    g.connect(this.tone);
  }
  pad(t, root, chord, dur) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const iv of chord) for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(root - 12 + iv); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + .1); }
    g.connect(this.tone);
  }
  get want() { return this.preview || this.track; }
  get cur() { return TRACKS[this.playing || this.want] || TRACKS.bukhang; }
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = PHASE[this.phase] || PHASE.morning, T = this.cur, beat = 60 / (T.bpm * P.bpm / 72), r0 = T.root + (P.root - 60) * .5 | 0;
    while (this.next < this.ctx.currentTime + 1.2) {
      const t = this.next, sc = T.scale;
      if (this.step % 8 === 0) this.pad(t, r0, T.pads[this.bar++ % T.pads.length], beat * 8.5);
      if (T.bass && this.step % 2 === 0) this.note(t, r0 - 24 + T.bass[(this.step / 2 | 0) % T.bass.length] + (T.pads[(this.bar - 1 + 4) % 4][0] | 0), beat * 1.6, .07, 'sine');
      if (Math.random() < (this.step % 2 ? T.dens * .5 : T.dens)) {
        const k = T.arp ? [0, 2, 4, 5, 7, 5, 4, 2][this.step % 8] : Math.floor(Math.random() * sc.length);
        this.note(t + (T.bass ? 0 : Math.random() * .03), r0 + sc[k] + (T.bell ? 12 : 0), beat * T.dur, (T.wave === 'square' ? .035 : .09) + Math.random() * .04, T.wave, { vib: T.vib, bell: T.bell });
      }
      this.next += beat; this.step++;
    }
  }
  // 맵 이동·미리듣기: 음악만 약 1.2초 줄였다가 새 곡으로 다시 올림(크로스페이드)
  setTrack(id) { if (TRACKS[id]) { this.track = id; this._apply(); } }
  setPreview(id) { this.preview = TRACKS[id] ? id : ''; this._apply(); }
  _apply() {
    if (!this.ctx) { this.playing = this.want; return; }
    if (this.want === this.playing) return;
    const c = this.ctx.currentTime; this.music.gain.cancelScheduledValues(c); this.music.gain.setTargetAtTime(0, c, .3);
    clearTimeout(this._swT);
    this._swT = setTimeout(() => { this.playing = this.want; this.step = 0; this.bar = 0; const n = this.ctx.currentTime; this.music.gain.cancelScheduledValues(n); this.music.gain.setTargetAtTime(.8, n, .45); }, 1200);
  }
  // v3.9u: 사용자 동작 안에서 호출 — 컨텍스트 생성·resume + 무음 버퍼 1개 재생(iOS 잠금 해제), 가능하면 무음 스위치 영향 줄이기(Safari 17+ audioSession)
  unlock() {
    if (this.muted) return;
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
    if (!this.ctx) this.init();
    const c = this.ctx; if (c.state !== 'running') c.resume?.().catch(() => {});
    if (!this._blip) { try { const b = c.createBuffer(1, 1, c.sampleRate), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); this._blip = true; } catch {} }
    this.started = true; this.fade();
  }
  start() { if (this.muted) return; if (!this.ctx) this.init(); this.ctx.resume(); this.started = true; this.fade(); }
  setMuted(m) { this.muted = m; if (!m) this.start(); else this.fade(); }
  fade() { if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : .18, this.ctx.currentTime, .8); }
  setPhase(p) { if (p === this.phase) return; this.phase = p; if (this.ctx) this.tone.frequency.setTargetAtTime((PHASE[p] || PHASE.morning).lp, this.ctx.currentTime, 2); }
  chime() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime + .05; [76, 79, 83, 88, 83].forEach((m, i) => this.note(t + i * .28, m, 1.6, .5)); } // v3.9 드론쇼 시작 부드러운 차임(직접 합성)
  setNear(v) { this.near = v; if (this.ctx) this.water.gain.setTargetAtTime(.12 + .6 * v, this.ctx.currentTime, 1); } // 수로 가까울수록 물소리 큼
  get status() { return { started: this.started, state: this.ctx?.state || 'none', muted: this.muted, phase: this.phase, near: this.near, track: this.track, preview: this.preview, playing: this.playing, music: this.music ? +this.music.gain.value.toFixed(2) : null }; }
}
