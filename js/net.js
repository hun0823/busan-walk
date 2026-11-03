// 서버 상태 표시 + 공용 서버 클라이언트. 연결은 로딩과 분리(비동기), 실패해도 혼자 플레이로 계속.
export const NetState = Object.freeze({ OFFLINE_SOLO: 'offline_solo', CONNECTING: 'connecting', ONLINE: 'online', ERROR: 'error' });
const VIEW = {
  offline_solo: { cls: 'off', text: () => '오프라인 · 맵 이동' },
  connecting: { cls: 'wait', text: () => '서버 · 연결 중…' },
  online: { cls: 'on', text: (n, no) => (typeof matchMedia === 'function' && matchMedia('(max-width:640px)').matches) ? `${no ? String(no).padStart(2, '0') + '서버 · ' : ''}${n}명` : `온라인 · ${no ? String(no).padStart(2, '0') + '번 서버 · ' : ''}${n}명` }, // v3.9q: 폰은 짧게
  error: { cls: 'err', text: () => '오프라인 · 연결 실패(혼자 플레이)' },
};
export function initNetStatus(el) {
  const state = { value: NetState.OFFLINE_SOLO, count: 1, no: 0 };
  return { state, set(v, count = 1, no = 0) { state.value = v; state.count = count; state.no = no; const w = VIEW[v]; el.className = 'srv ' + w.cls; el.querySelector('b').textContent = w.text(count, no); el.title = w.text(count, no); } };
}
export const ANIM = ['idle', 'walk', 'run', 'sit', 'pet', 'treat'];
export const SAY_TEXT = { hi: '안녕!', woof: '멍멍!', rest: '쉬는 중', photo: '찰칵!', treat: '간식 냠', pet: '쓰담쓰담', bye: '또 봐!', nice: '좋은 산책!' };
// cb: onStatus(state,n,no), onJoin(id,name,breed), onState(id,x,z,r,a,serverT), onLeave(id), onSay(id,k), onCounts(c), onReset(), onFix(x,z)
export class NetClient {
  constructor(url, opt, cb) { this.url = url; this.opt = opt; this.cb = cb; this.ws = null; this.retry = 1000; this.want = null; this.offset = 0; this.counts = null; this.closed = false; }
  connect(hello) {
    this.want = hello; if (!this.url) return this.cb.onStatus('offline_solo');
    clearTimeout(this._rt); try { this.ws && this.ws.close(); } catch {}
    this.cb.onStatus('connecting');
    let ws; try { ws = new WebSocket(this.url); } catch { return this._fail(); }
    this.ws = ws; const to = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch {} } }, this.opt.connectTimeoutMs);
    ws.onopen = () => { clearTimeout(to); ws.send(JSON.stringify({ t: 'hello', ...this.want })); this._ping(); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this._msg(m); };
    ws.onclose = () => { clearTimeout(to); if (this.ws !== ws) return; this.ws = null; this.online = false; this.cb.onReset(); this._fail(); };
    ws.onerror = () => {};
  }
  _fail() { this.cb.onStatus('error'); if (this.closed) return; this._rt = setTimeout(() => this.connect(this.want), this.retry); this.retry = Math.min(this.opt.retryMaxMs, this.retry * 2); }
  _ping() { const s = performance.now(); this._p0 = s; this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ t: 'ping', c: s })); }
  serverNow() { return Date.now() + this.offset; }
  _msg(m) {
    const cb = this.cb;
    if (m.t === 'welcome') { this.retry = 1000; this.online = true; this.id = m.id; this.no = m.no; this.n = m.n; this.offset = m.st - Date.now(); this.counts = m.counts; cb.onCounts(m.counts); cb.onStatus('online', m.n, m.no); }
    else if (m.t === 'p') { if (m.j) for (const [id, n, b] of m.j) cb.onJoin(id, n, b); for (const [id, x, z, r, a] of m.s) cb.onState(id, x, z, r, a); }
    else if (m.t === 'leave') cb.onLeave(m.id);
    else if (m.t === 'say') cb.onSay(m.id, m.k);
    else if (m.t === 'n') { this.n = m.n; this.counts = m.counts; cb.onCounts(m.counts); cb.onStatus('online', m.n, this.no); }
    else if (m.t === 'pong') { const rtt = performance.now() - m.c; this.rtt = rtt; this.offset = m.st + rtt / 2 - Date.now(); setTimeout(() => this._ping(), 10000); }
    else if (m.t === 'full') { if (m.next) { this.want = { ...this.want, no: m.next }; this.connect(this.want); cb.onFull?.(m); } else { this.closed = true; this.ws?.close(); cb.onStatus('error'); cb.onFull?.(m); } }
    else if (m.t === 'fix') cb.onFix?.(m.x, m.z);
  }
  send(o) { if (this.online && this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }
}
