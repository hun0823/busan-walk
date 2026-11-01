// 잔잔한 물소리: WebAudio로 노이즈를 직접 합성 (외부 음원 없음)
export class WaterSound {
  constructor() { this.on = false; this.ctx = null; }
  init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // 브라운 노이즈
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = this.gain = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 300;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
    src.connect(lp).connect(g).connect(ctx.destination); src.start();
  }
  toggle() {
    if (!this.ctx) this.init();
    this.on = !this.on; this.ctx.resume();
    this.gain.gain.setTargetAtTime(this.on ? 0.35 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  }
}
