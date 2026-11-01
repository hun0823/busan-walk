// 시간대 프리셋 (값은 시안 분위기를 참고해 직접 조정)
export const TIMES = {
  dawn: { label: '🌅 새벽', skyTop: '#9fb4d8', skyBot: '#f6c9b0', fog: '#e9cdbf', fogNear: 45, fogFar: 230,
    hemiSky: '#cfd8ff', hemiGround: '#6b6a55', hemiI: 1.5, sunCol: '#ffd2b0', sunI: 1.3, sunX: -60, sunY: 22, sunZ: -60,
    exposure: 1.0, lamp: 0.4, lampLight: 0.3, water: '#7f9fb8', city: 0.2, sunVis: 1 },
  dusk: { label: '🌇 저녁', skyTop: '#3f7ea6', skyBot: '#ffb08a', fog: '#f0b49a', fogNear: 50, fogFar: 260,
    hemiSky: '#ffd7b8', hemiGround: '#55603a', hemiI: 1.5, sunCol: '#ffc090', sunI: 1.6, sunX: -40, sunY: 30, sunZ: -50,
    exposure: 0.95, lamp: 1.2, lampLight: 1.0, water: '#4f9fb8', city: 0.6, sunVis: 1 },
  night: { label: '🌙 밤', skyTop: '#08122e', skyBot: '#2a3d6e', fog: '#16234a', fogNear: 20, fogFar: 160,
    hemiSky: '#5a6fb0', hemiGround: '#1a1f2a', hemiI: 0.55, sunCol: '#9fb4ff', sunI: 0.45, sunX: 40, sunY: 50, sunZ: -40,
    exposure: 1.1, lamp: 2.6, lampLight: 3.0, water: '#1d3560', city: 1.6, sunVis: 0 },
};
export function applyTime(c, { scene, hemi, sun, renderer, world }) {
  scene.fog.color.set(c.fog); scene.fog.near = c.fogNear; scene.fog.far = c.fogFar;
  hemi.color.set(c.hemiSky); hemi.groundColor.set(c.hemiGround); hemi.intensity = c.hemiI;
  sun.color.set(c.sunCol); sun.intensity = c.sunI;
  renderer.toneMappingExposure = c.exposure;
  world.setTime(c);
}
