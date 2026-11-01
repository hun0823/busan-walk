// 시간대 프리셋 (값은 직접 조정한 연출). 순환: 아침 → 점심 → 저녁 (현실시간 20분 간격, Date.now() 기반이라 모든 접속자가 같은 위상)
const BASE = {
  morning: { label: '🌅 아침', skyTop: '#8fb6e0', skyBot: '#f8d6bc', fog: '#ecd9c8', fogNear: 70, fogFar: 380,
    hemiSky: '#dde4ff', hemiGround: '#6b6a55', hemiI: 1.7, sunCol: '#ffe0c0', sunI: 1.6, sunX: -60, sunY: 26, sunZ: -60,
    exposure: 1.0, lamp: 0.3, lampLight: 0.2, water: '#7fa7c0', canal: '#9ae8de', sea: '#4a82a6', glint: '#ffe8d0', city: 0.15, sunVis: 1, starVis: 0, moon: 0 },
  noon: { label: '☀️ 점심', skyTop: '#2f7fd8', skyBot: '#bfe2ff', fog: '#cfe4f5', fogNear: 90, fogFar: 460,
    hemiSky: '#e8f4ff', hemiGround: '#6a7a50', hemiI: 1.9, sunCol: '#fff6e6', sunI: 2.1, sunX: 20, sunY: 80, sunZ: -30,
    exposure: 1.0, lamp: 0.1, lampLight: 0, water: '#4fa8d0', canal: '#8eeadf', sea: '#2f78b0', glint: '#ffffff', city: 0, sunVis: .6, starVis: 0, moon: 0 },
  dusk: { label: '🌇 저녁', skyTop: '#3f7ea6', skyBot: '#ffb08a', fog: '#f0b49a', fogNear: 70, fogFar: 380,
    hemiSky: '#ffd7b8', hemiGround: '#55603a', hemiI: 1.5, sunCol: '#ffc090', sunI: 1.6, sunX: -40, sunY: 30, sunZ: -50,
    exposure: 0.95, lamp: 1.6, lampLight: 1.0, water: '#4f9fb8', canal: '#86e2d6', sea: '#2f5f8a', glint: '#ffd8a8', city: 0.6, sunVis: 1, starVis: 0.25, moon: 0.35 },
  night: { label: '🌇 저녁', skyTop: '#0c1838', skyBot: '#34477a', fog: '#1c2a52', fogNear: 40, fogFar: 260,
    hemiSky: '#6a7fc0', hemiGround: '#1a1f2a', hemiI: 0.65, sunCol: '#a8bcff', sunI: 0.5, sunX: 40, sunY: 50, sunZ: -40,
    exposure: 1.1, lamp: 2.6, lampLight: 3.0, water: '#1d3560', canal: '#3a9ab0', sea: '#132a50', glint: '#ffd9a0', city: 1.6, sunVis: 0, starVis: 1, moon: 1 },
};
export const PHASES = ['morning', 'noon', 'evening'];
export const PHASE_LABEL = { morning: '🌅 아침', noon: '☀️ 점심', evening: '🌇 저녁' };
export const PHASE_MS = 20 * 60 * 1000;
export function lerpPreset(a, b, t, Color) {
  const o = {};
  for (const k in b) {
    if (typeof b[k] === 'number') o[k] = (a[k] ?? b[k]) + (b[k] - (a[k] ?? b[k])) * t;
    else if (typeof b[k] === 'string' && b[k][0] === '#') o[k] = '#' + new Color(a[k]).lerp(new Color(b[k]), t).getHexString();
    else o[k] = b[k];
  }
  return o;
}
// 위상 계산: now(ms) → { phase, p(0..1 위상 내 진행) }
export function phaseAt(now) { const n = Math.floor(now / PHASE_MS); return { phase: PHASES[((n % 3) + 3) % 3], p: (now % PHASE_MS) / PHASE_MS }; }
// 위상 + 진행도 → 프리셋 값. 저녁은 진행될수록 밤 분위기(달·별 선명)로 흘러감.
export function presetFor(phase, p, Color) {
  if (phase === 'evening') { const k = Math.min(1, Math.max(0, (p - .1) / .7)); return lerpPreset(BASE.dusk, BASE.night, k * k * (3 - 2 * k), Color); }
  return BASE[phase];
}
export const TIMES = BASE;
export function applyTime(c, { scene, hemi, sun, renderer, world }) {
  scene.fog.color.set(c.fog); scene.fog.near = c.fogNear; scene.fog.far = c.fogFar;
  hemi.color.set(c.hemiSky); hemi.groundColor.set(c.hemiGround); hemi.intensity = c.hemiI;
  sun.color.set(c.sunCol); sun.intensity = c.sunI;
  renderer.toneMappingExposure = c.exposure;
  world.setTime(c);
}
