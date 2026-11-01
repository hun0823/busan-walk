// 서버 상태 표시. 현재 실제 서버·멀티플레이 없음 → OFFLINE_SOLO만 사용. 서버를 붙이면 set(state, count)만 호출하면 됨.
export const NetState = Object.freeze({ OFFLINE_SOLO: 'offline_solo', CONNECTING: 'connecting', ONLINE: 'online', ERROR: 'error' });
const VIEW = {
  offline_solo: { cls: 'off', text: () => '서버 · 혼자 플레이(오프라인)' },
  connecting: { cls: 'wait', text: () => '서버 · 연결 중…' },
  online: { cls: 'on', text: n => `서버 · 접속 ${n}명` },
  error: { cls: 'err', text: () => '서버 · 연결 실패' },
};
export function initNetStatus(el) {
  const state = { value: NetState.OFFLINE_SOLO, count: 1 };
  return { state, set(v, count = 1) { state.value = v; state.count = count; const w = VIEW[v]; el.className = 'srv ' + w.cls; el.querySelector('b').textContent = w.text(count); el.title = w.text(count); } };
}
