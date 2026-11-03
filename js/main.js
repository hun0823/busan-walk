// 부산 산책 | 북항 친수공원 — 프로토타입
// 모든 모델/텍스처/사운드는 Three.js 기본 도형과 절차 생성으로 직접 제작. (외부 에셋 없음)
// 월드 배치는 실제 지도가 아니라 상상 구성(연출)이다. 요소 목록만 디자이너 전달 자료 기준.
import * as THREE from 'three';
import { S as MAP_SCALE } from './world.js?v=39r';
import { MAPS, mapById, getWorld, setActive, isWalkable, heightAt } from './maps.js?v=39r';
import { makeGuardian, makeDog } from './characters.js?v=39r';
import { initMapView } from './mapview.js?v=39r';
import { TIMES, PHASES, PHASE_LABEL, phaseAt, presetFor, lerpPreset, applyTime } from './times.js?v=39r';
import { BREEDS, breedById, DEFAULT_BREED } from './breeds.js?v=39r';
import { NetState, initNetStatus, NetClient, ANIM, SAY_TEXT } from './net.js?v=39r';
import { SERVER_URL, NET } from './config.js?v=39r';
import { makeMat } from './mat.js?v=39r';
import { SLOTS, encode, decode, applyOutfit, makeGroundItem } from './outfit.js?v=39r';
import { BgSound, TRACKS } from './sound.js?v=39r';

const $ = s => document.querySelector(s);
const setLoad = (p, t) => { $('#loadbar').style.width = p + '%'; if (t && window.__step) window.__step(t); };
setLoad(10, '화면 준비 중');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 40, 220);
const camFov = () => innerWidth / innerHeight < 0.8 ? 62 : 50;
const camera = new THREE.PerspectiveCamera(camFov(), innerWidth / innerHeight, 0.1, 2500);

const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
scene.add(hemi, sun, sun.target);

setLoad(30, '맵 불러오는 중');
const _q0m = new URLSearchParams(location.search);
const LSm = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let curMap = mapById(_q0m.get('map')) ? _q0m.get('map') : mapById(LSm.get('bw.map')) ? LSm.get('bw.map') : 'bukhang';
if (_q0m.has('reset')) { try { for (const k of Object.keys(localStorage)) if (k === 'bw.map' || k.startsWith('bw.pos.')) localStorage.removeItem(k); } catch {} curMap = mapById(_q0m.get('map')) ? _q0m.get('map') : 'bukhang'; } // v3.9d: ?reset=1 저장 맵·위치 초기화
const _withTO = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(ms / 1000 + '초 안에 맵을 만들지 못함')), ms))]);
let world; try { world = await _withTO(getWorld(curMap, scene), curMap === 'bukhang' ? 60000 : 15000); } catch (e) { // v3.9c: 맵 생성 실패 시 로딩 화면에 짧게 알리고 북항으로 진입
  console.warn('map load failed', curMap, e); window.__loadErr && window.__loadErr('맵 불러오기 실패(' + curMap + '): ' + (e && e.message || e) + ' · 북항으로 들어갑니다', true);
  LSm.set('bw.map', 'bukhang'); curMap = 'bukhang'; world = await getWorld(curMap, scene); }
setActive(world);
const savedPos = id => { const v = (LSm.get('bw.pos.' + id) || '').split(',').map(Number); return v.length === 3 && v.every(Number.isFinite) ? { x: v[0], z: v[1], rot: v[2] } : null; };
const sound = new BgSound(); // 배경음(직접 합성) — 첫 터치/클릭 후 시작, 음소거는 localStorage bw.mute
let nearAcc = 0;
setLoad(70, '캐릭터·소리 준비 중');

const guardian = makeGuardian(); scene.add(guardian.root);
// 강아지 이름·견종: localStorage 저장
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let dogName = LS.get('bw.dogName') || '바다', breedId = LS.get('bw.breed') || DEFAULT_BREED;
let dog = makeDog(breedById(breedId)); scene.add(dog.root);
function swapDog(id) { const old = dog; dog = makeDog(breedById(id)); dog.root.position.copy(old.root.position); dog.root.rotation.y = old.root.rotation.y; scene.remove(old.root); scene.add(dog.root); breedId = id; applyOutfit(guardian, dog, outfit); }
// 캐릭터 보조 라이트(약하게, 밤에도 칙칙하지 않게)
const charFill = new THREE.PointLight(0xffe2c0, 1.2, 6, 1.5); scene.add(charFill);
// v3.9j: 시작점에서 걸어서 닿는 영역(4방향 BFS, 0.3m 격자)을 한 번 계산해 캐시 → 무작위 시작/저장 위치가 건물 사이 고립 구역이면 버림
const reachOf = w => { if (w._reach) return w._reach; const b = w.start, h = .3, R = 260, N = Math.ceil(2 * R / h), M = new Uint8Array(N * N), W = w.isWalkable;
  const ix = (x, z) => { const i = Math.round((x - b.x + R) / h), j = Math.round((z - b.z + R) / h); return i < 0 || j < 0 || i >= N || j >= N ? -1 : i * N + j; };
  const k0 = ix(b.x, b.z); if (W(b.x, b.z)) { const q = [k0]; M[k0] = 1; while (q.length) { const k = q.pop(), i = (k / N) | 0, j = k % N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= N || c >= N) continue; const kk = a * N + c; if (M[kk]) continue; if (!W(b.x - R + a * h, b.z - R + c * h)) { M[kk] = 2; continue; } M[kk] = 1; q.push(kk); } } }
  return (w._reach = (x, z) => { const k = ix(x, z); return k >= 0 && M[k] === 1; }); };
const randStart = w => { const b = w.start; const ok = reachOf(w); for (let i = 0; i < 24; i++) { const r = 3 + Math.random() * 3, t = Math.random() * 6.2832, x = b.x + Math.sin(t) * r, z = b.z + Math.cos(t) * r; if (w.isWalkable(x, z) && ok(x, z) && w.isWalkable(x - Math.sin(b.rot) * 0.9, z - Math.cos(b.rot) * 0.9)) return { x, z, rot: b.rot }; } return b; }; // v3.9f: 시작점 반경 3~6m 무작위(겹침 방지), 저장 위치 우선
const _sp0 = (!_q0m.has('fresh') && savedPos(curMap) && world.isWalkable(savedPos(curMap).x, savedPos(curMap).z) && reachOf(world)(savedPos(curMap).x, savedPos(curMap).z)) ? savedPos(curMap) : randStart(world);
const start = new THREE.Vector3(_sp0.x, heightAt(_sp0.x, _sp0.z), _sp0.z); // 남서 입구 근처 보행로(OSM)
guardian.root.position.copy(start);
guardian.root.rotation.y = _sp0.rot; // 북동쪽(수로 방향)
dog.root.position.set(start.x - Math.sin(_sp0.rot) * 0.9, start.y, start.z - Math.cos(_sp0.rot) * 0.9);
dog.root.rotation.y = _sp0.rot; // 시작 시 보호자와 같은 방향

// 목줄
const leashMat = new THREE.MeshStandardMaterial({ color: 0x6b3d22, roughness: .7 });
let leashMesh = null;
const LEASH = 2.2;
function updateLeash() {
  const a = guardian.hand.getWorldPosition(new THREE.Vector3());
  const b = dog.collar.getWorldPosition(new THREE.Vector3());
  const d = a.distanceTo(b);
  const sag = Math.max(0.05, (LEASH - d) * 0.45);
  const m = a.clone().lerp(b, .5); m.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, m, b);
  if (leashMesh) { leashMesh.geometry.dispose(); scene.remove(leashMesh); }
  leashMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 5), leashMat);
  scene.add(leashMesh);
}

// ---------- 시간대: 현실시간 20분마다 아침→점심→저녁 (Date.now() 기반, 모든 접속자 동일) ----------
const _q0 = new URLSearchParams(location.search);
const clock = { offset: +(_q0.get('tshift') || 0), override: null, paused: false, pausedAt: 0 }; // tshift: 디버그용 ms 이동
const nowMs = () => clock.paused ? clock.pausedAt : Date.now() + clock.offset;
function curPhase() { if (clock.override) return { phase: clock.override, p: clock.override === 'evening' ? .95 : .5 }; return phaseAt(nowMs()); }
let ph = curPhase(), cur = presetFor(ph.phase, ph.p, THREE.Color), from = cur, blendT = 1, lastPhase = ph.phase, applyAcc = 0;
const BLEND_S = 6; // 위상 전환 블렌딩(초)
applyTime(cur, { scene, hemi, sun, renderer, world });
function tickTime(dt) {
  ph = curPhase();
  if (ph.phase !== lastPhase) { from = cur; blendT = 0; lastPhase = ph.phase; }
  const want = presetFor(ph.phase, ph.p, THREE.Color);
  applyAcc += dt;
  if (blendT < 1) { blendT = Math.min(1, blendT + dt / BLEND_S); const k = blendT * blendT * (3 - 2 * blendT); cur = lerpPreset(from, want, k, THREE.Color); applyTime(cur, { scene, hemi, sun, renderer, world }); }
  else if (applyAcc > .5) { applyAcc = 0; cur = want; applyTime(cur, { scene, hemi, sun, renderer, world }); } // 저녁 안에서 서서히 밤으로
  sound.setPhase(ph.phase); nearAcc += dt; if (nearAcc > .5) { nearAcc = 0; const p = guardian.root.position; sound.setNear(world.waterNear(p.x, p.z)); }
  const lbl = PHASE_LABEL[ph.phase]; if ($('#timeLbl').textContent !== lbl) $('#timeLbl').textContent = lbl;
}
function setTime(key, instant) { // 관리자/테스트: 'morning'|'noon'|'evening'|null(자동)
  clock.override = key; from = cur; blendT = instant ? .999 : 0; lastPhase = curPhase().phase;
}

// ---------- 카메라 ----------
const _q = new URLSearchParams(location.search);
const PORTRAIT = () => innerWidth / innerHeight < 0.8; // v3.7: 세로 화면은 더 멀리·넓게
let yaw = _sp0.rot - Math.PI + +(_q.get('yaw') || 0), pitch = PORTRAIT() ? 0.36 : 0.3, dist = PORTRAIT() ? 7.2 : 4.6; if (_sp0.camDist) { dist = Math.max(dist, _sp0.camDist * (PORTRAIT() ? 1.25 : 1)); pitch = PORTRAIT() ? .2 : .14; } // v3.9: 지정 시점 맵(용궁사)은 조금 뒤에서 // 캐릭터가 화면 높이 약 1/3 (디버그: ?yaw=3.14 앞모습)
const camTarget = new THREE.Vector3().copy(start);
const _cray = new THREE.Raycaster(), _cdir = new THREE.Vector3(); let camDS = dist, camPS = pitch;
const TOP = _q.get('view') === 'top'; if (TOP) document.body.classList.add('topview'); // 디버그: 위에서 본 지도 컷(북쪽이 화면 위)
function updateCamera(dt) {
  if (TOP) { world.topPreview(); hemi.color.set(0xffffff); hemi.groundColor.set(0x8a9a70); hemi.intensity = 2.2; sun.color.set(0xffffff); sun.intensity = 2.2; renderer.toneMappingExposure = 1.05; const tv = world.topView || {}, cx = tv.cx ?? 100 * MAP_SCALE, cz = tv.cz ?? -90 * MAP_SCALE, th = tv.span ? tv.span / 2 / Math.tan(25 * Math.PI / 180) * 1.02 + 60 : 560; camera.up.set(0, 0, -1); camera.position.set(cx, th, cz + 0.01); camera.far = Math.max(2500, th + 200); camera.updateProjectionMatrix(); camera.lookAt(cx, 0, cz); scene.fog.near = 1e5; scene.fog.far = 1e6; return; }
  camTarget.lerp(guardian.root.position, 1 - Math.exp(-dt * 6));
  const t = camTarget.clone(); t.y += 0.6;
  // v3.7 카메라 보정: 장애물(건물·가로등·나무)이 가리면 앞으로 당기되 최소 거리 2.2를 지키고, 모자라면 위로 올려 넘겨봄. 지면 아래로 들어가지 않게.
  let cd = dist, pe = pitch;
  if (world.occluders && world.occluders.length) {
    for (let k = 0; k < 4; k++) {
      _cdir.set(Math.sin(yaw) * Math.cos(pe), Math.sin(pe), Math.cos(yaw) * Math.cos(pe)); _cray.set(t, _cdir); _cray.near = 0.35; _cray.far = dist;
      const h = _cray.intersectObjects(world.occluders, false)[0];
      if (!h) { cd = dist; break; }
      cd = h.distance - 0.35; if (cd >= 2.2) break;
      cd = 2.2; pe = Math.min(1.25, pe + 0.3);
    }
  }
  camDS += (cd - camDS) * (cd < camDS ? 1 : 1 - Math.exp(-dt * 3)); camPS += (pe - camPS) * (1 - Math.exp(-dt * 8));
  cd = Math.max(2.2, camDS); pe = camPS;
  camera.position.set(
    t.x + Math.sin(yaw) * Math.cos(pe) * cd,
    t.y + Math.sin(pe) * cd,
    t.z + Math.cos(yaw) * Math.cos(pe) * cd);
  const gy = heightAt(camera.position.x, camera.position.z) + 0.5; if (camera.position.y < gy) camera.position.y = gy;
  camera.lookAt(t.x, t.y + 0.35, t.z);
}

// ---------- 입력 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let moveTarget = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(.25, .35, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

const pointers = new Map(); let dragMoved = 0, pinchD = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    p.x = e.clientX; p.y = e.clientY;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD) dist = THREE.MathUtils.clamp(dist * pinchD / d, 2.6, 15);
    pinchD = d; dragMoved = 99; return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  yaw -= dx * 0.006; pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, 0.08, 1.2);
  p.x = e.clientX; p.y = e.clientY;
});
const up = e => {
  if (pointers.size === 1 && dragMoved < 8) clickGround(e.clientX, e.clientY);
  pointers.delete(e.pointerId); if (pointers.size < 2) pinchD = 0;
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, 15); }, { passive: false });

function clickGround(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(world.walkMeshes, false)[0];
  if (!hit) return;
  const p = hit.point;
  if (!isWalkable(p.x, p.z)) { toast('그쪽은 갈 수 없어요'); return; }
  moveTarget = new THREE.Vector3(p.x, 0, p.z);
  marker.position.set(p.x, p.y + 0.03, p.z); marker.visible = true;
}
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });

// ---------- UI ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 1800); }
let bubbleT = 0, bubbleOn = 'dog';
function say(msg, sec = 2, on = 'dog') { bubbleOn = on; $('#bubble').textContent = msg; $('#bubble').classList.remove('hidden'); bubbleT = sec; }
let dogAction = null, actionT = 0;
const hearts = [];
function spawnHearts(char, color) {
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const c = s.getContext('2d'); c.font = '48px sans-serif'; c.textAlign = 'center'; c.fillText(char, 32, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(s), transparent: true, color }));
    sp.scale.setScalar(.35); sp.position.copy(dog.root.position).add(new THREE.Vector3((Math.random() - .5) * .6, 1, (Math.random() - .5) * .6));
    sp.userData = { life: 1.4, vy: .6 + Math.random() * .5 }; scene.add(sp); hearts.push(sp);
  }
}
let lastHi = -1e9;
document.querySelectorAll('.bottom-bar button').forEach(b => b.onclick = () => {
  const a = b.dataset.act;
  if (a === 'pet') { dogAction = 'pet'; actionT = 1.6; say('헤헤, 좋아요!'); spawnHearts('❤', 0xffffff); }
  if (a === 'treat') { dogAction = 'treat'; actionT = 1.6; say('냠냠! 맛있다멍'); spawnHearts('✨', 0xffffff); }
  if (a === 'sit') { dogAction = 'sit'; actionT = 3; say('앉았어요!'); }
  if (a === 'photo') takePhoto();
  if (a === 'rest') rest.on ? stopRest() : startRest();
  if (a === 'hi') { const n = performance.now(); if (n - lastHi < 2500) return; lastHi = n; say('안녕! 👋', 2.5, 'me'); } // v3.9g 인사하기: 내 머리 위 말풍선 + 서버 프리셋 'hi'(2.5초 쿨다운 동일)
  if (SAY_OF[a]) netc.send({ t: 'say', k: SAY_OF[a] });
});
function takePhoto() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = `busan-walk-${Date.now()}.png`; a.click();
  $('#flash').style.transition = 'none'; $('#flash').style.opacity = 1;
  requestAnimationFrame(() => { $('#flash').style.transition = 'opacity .5s'; $('#flash').style.opacity = 0; });
  say('찰칵! 예쁘게 나왔나요?');
}
sound.muted = LS.get('bw.mute') === '1'; $('#btnSound').textContent = sound.muted ? '🔇' : '🔊';
addEventListener('pointerdown', () => sound.start(), { once: true, capture: true }); addEventListener('keydown', () => sound.start(), { once: true });
$('#btnSound').onclick = () => { const m = !sound.muted; sound.setMuted(m); LS.set('bw.mute', m ? '1' : '0'); $('#btnSound').textContent = m ? '🔇' : '🔊'; renderBgm(); };
// v3.9r: 맵별 배경음악 목록(미리듣기) — 문구 없이 목록만
sound.setTrack(curMap);
function renderBgm() {
  const pv = sound.preview, mapT = sound.track;
  $('#bgmList').innerHTML = Object.entries(TRACKS).map(([id, t]) => `<button class="bgmi${(pv || mapT) === id ? ' on' : ''}" data-t="${id}"><span>${(pv || mapT) === id && !sound.muted ? '♪' : '▶'}</span> ${t.name}<small>${mapById(id)?.name || ''}${id === mapT ? ' · 이 맵' : ''}</small></button>`).join('');
}
$('#bgmList').onclick = e => { const b = e.target.closest('button[data-t]'); if (!b) return; const id = b.dataset.t;
  if (sound.muted) { sound.setMuted(false); LS.set('bw.mute', '0'); $('#btnSound').textContent = '🔊'; } else sound.start();
  sound.setPreview(id === sound.track ? '' : id); renderBgm(); };
$('#btnBgm').onclick = () => { renderBgm(); openPanel('bgmPanel'); };
window.__bgm = () => sound.status;
// ---------- 휴식하기: 캐릭터 앞 평지에 돗자리(직접 제작)를 펴고 함께 앉음 ----------
const mat = makeMat(); mat.visible = false; scene.add(mat);
const rest = { on: false, t: 0, rot: 0, dogSpot: new THREE.Vector3(), folding: 0 };
function matFits(x, z, r) { // 돗자리(1.8×1.3) 네 모서리+가장자리 중점이 모두 걷기 가능 영역
  const c = Math.cos(r), s2 = Math.sin(r);
  for (const [u, v] of [[-.95, -.7], [.95, -.7], [-.95, .7], [.95, .7], [0, -.7], [0, .7], [-.95, 0], [.95, 0], [0, 0]]) { const px = x + u * c + v * s2, pz = z - u * s2 + v * c; if (!isWalkable(px, pz)) return false; }
  return true;
}
function startRest() {
  const g = guardian.root; let spot = null;
  for (const d of [1.3, 1.7, 2.2, 0.9, 2.8]) { for (const da of [0, .35, -.35, .7, -.7, 1.2, -1.2]) { const r = g.rotation.y + da, x = g.position.x + Math.sin(r) * d, z = g.position.z + Math.cos(r) * d; if (matFits(x, z, r)) { spot = { x, z, r }; break; } } if (spot) break; }
  if (!spot) { toast('여기는 돗자리를 펼 평평한 자리가 없어요'); return; }
  rest.kind = outfit.rest || ''; rest.on = true; rest.t = 0; rest.rot = spot.r; mat.visible = rest.kind !== 'chair'; mat.position.set(spot.x, heightAt(spot.x, spot.z) + .01, spot.z); mat.rotation.y = spot.r;
  const sx = Math.cos(spot.r), sz = -Math.sin(spot.r);
  g.position.set(spot.x + sx * .35, heightAt(spot.x, spot.z) + .03, spot.z + sz * .35); g.rotation.y = spot.r;
  rest.dogSpot.set(spot.x - sx * .4, heightAt(spot.x, spot.z) + .03, spot.z - sz * .4);
  const fx = Math.sin(spot.r), fz = Math.cos(spot.r); // v3.9m: 선택한 휴식 아이템별 자리·모션(돗자리=눕기+강아지 엎드리기, 의자=의자에 앉기)
  if (rest.kind === 'mat') { g.position.set(spot.x + sx * .85, heightAt(spot.x, spot.z) + .03, spot.z + sz * .85); rest.dogSpot.set(spot.x + fx * .45, heightAt(spot.x, spot.z) + .03, spot.z + fz * .45); }
  if (rest.kind === 'chair') { chairObj.visible = true; chairObj.scale.setScalar(1); chairObj.position.set(g.position.x, heightAt(g.position.x, g.position.z) + .01, g.position.z); chairObj.rotation.y = spot.r; }
  moveTarget = null; marker.visible = false; say(`${dogName}랑 잠깐 쉬어요`, 2.5);
}
function stopRest() { if (!rest.on) return;  rest.on = false; rest.folding = 1; }
function updateRest(dt) {
  if (rest.on) { rest.t = Math.min(1, rest.t + dt / .5); mat.scale.set(rest.t, 1, .3 + .7 * rest.t); chairObj.scale.setScalar(Math.max(.01, rest.t)); }
  else if (rest.folding > 0) { rest.folding = Math.max(0, rest.folding - dt / .4); mat.scale.set(rest.folding, 1, .3 + .7 * rest.folding); chairObj.scale.setScalar(Math.max(.01, rest.folding)); if (!rest.folding) { mat.visible = false; chairObj.visible = false; } }
}

// ---------- v3.9l 가방(꾸미기): 착용 상태는 localStorage(bw.outfit) ----------
let outfit = {}; try { outfit = JSON.parse(LS.get('bw.outfit') || '{}') || {}; } catch (e) { outfit = {}; }
if (outfit.chair || outfit.mat) { outfit.rest = outfit.chair ? 'chair' : 'mat'; delete outfit.chair; delete outfit.mat; } // v3.9l → v3.9m: 휴식 아이템 한 칸으로
let _ofT = 0;
function setOutfit(k, v) { if (v) outfit[k] = v; else delete outfit[k]; LS.set('bw.outfit', JSON.stringify(outfit)); applyOutfit(guardian, dog, outfit); renderBag(); clearTimeout(_ofT); if (_srvUrl) _ofT = setTimeout(() => netc.connect(helloMsg()), 900); }
function renderBag() { $('#bagList').innerHTML = SLOTS.map(s => `<div class="bslot"><h5>${s.name}</h5><div class="bitems"><button data-k="${s.k}" data-v="" class="${outfit[s.k] ? '' : 'on'}">✕ 없음</button>${s.items.map(([id, nm, em]) => `<button data-k="${s.k}" data-v="${id}" class="${outfit[s.k] === id ? 'on' : ''}"><span>${em}</span>${nm}</button>`).join('')}</div></div>`).join(''); }
$('#bagList').onclick = e => { const b = e.target.closest('button[data-k]'); if (b) setOutfit(b.dataset.k, b.dataset.v); };
$('#bagOff').onclick = () => { outfit = {}; setOutfit('x', ''); };
$('#btnBag').onclick = () => { renderBag(); openPanel($('#bagPanel').classList.contains('open') ? null : 'bagPanel'); };
applyOutfit(guardian, dog, outfit);
const chairObj = makeGroundItem('chair'); chairObj.visible = false; scene.add(chairObj);

// ---------- 설정 · 정보 · 강아지 모달 ----------
function openPanel(id) { document.querySelectorAll('.panel').forEach(p => p.classList.toggle('open', p.id === id)); if (id !== 'bgmPanel' && sound.preview) sound.setPreview(''); }
document.querySelectorAll('.panel [data-close]').forEach(b => b.onclick = () => openPanel(null));
$('#btnSet').onclick = () => openPanel($('#setPanel').classList.contains('open') ? null : 'setPanel');
$('#btnInfo').onclick = () => openPanel('infoPanel');
$('#btnDog').onclick = () => openDogModal();
let pickBreed = breedId;
function openDogModal() {
  pickBreed = breedId; $('#dogName').value = dogName;
  const list = $('#breedList'); list.innerHTML = '';
  for (const b of BREEDS) {
    const el = document.createElement('button'); el.className = 'breed' + (b.id === pickBreed ? ' on' : ''); el.dataset.id = b.id;
    el.innerHTML = `<i style="background:linear-gradient(135deg,${b.color} 55%,${b.color2} 55%)"><img src="assets/breeds/${b.id}.webp?v=39r" alt="" loading="eager" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('em'),{textContent:'🐶'}))"></i><b>${b.name}</b><small>${{ drop: '처진 귀', erect: '쫑긋 귀', big: '큰 귀', semi: '반 선 귀', button: '단추 귀', bat: '박쥐 귀' }[b.ear]} · ${(b.size||1) >= 1.1 ? '큰 개' : (b.size||1) <= .9 ? '작은 개' : '중간'}</small>`;
    el.onclick = () => { pickBreed = b.id; setPrev(b); list.querySelectorAll('.breed').forEach(x => x.classList.toggle('on', x === el)); swapDog(b.id); };
    list.appendChild(el);
  }
  setPrev(BREEDS.find(b => b.id === pickBreed) || BREEDS[0]); openPanel('dogModal');
}
function setPrev(b) { const p = $('#dogPrev'); p.querySelector('img').src = `assets/breeds/${b.id}.webp?v=39r`; p.querySelector('b').textContent = b.name; } // v3.9g: 선택 강아지 미리보기(미리 캡처한 인게임 모델 이미지)
$('#dogOk').onclick = () => {
  dogName = ($('#dogName').value.trim() || '바다').slice(0, 8); LS.set('bw.dogName', dogName); LS.set('bw.breed', pickBreed); if (pickBreed !== breedId) swapDog(pickBreed); if (_srvUrl) netc.connect(helloMsg());
  openPanel(null); say(`나 · ${dogName}`, 3);
};

// ---------- 서버 상태(현재 서버 없음: 오프라인 혼자 플레이로 정직하게 표시) ----------
const net = initNetStatus($('#srv'));
net.set(NetState.OFFLINE_SOLO);
// ---------- 공용 서버(v3.9e): 주소가 없으면 혼자 플레이. 연결은 로딩과 분리(비동기, 3초 타임아웃), 실패해도 게임 계속 ----------
const _srvUrl = (_q0m.get('server') || SERVER_URL || '').trim();
const isPhone = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const MAX_DETAIL = isPhone ? NET.maxDetailPhone : NET.maxDetailDesktop;
const others = new Map(); // id → {name,breed,dog,buf:[[t,x,z,r,a]],label,sayT}
const labelLayer = document.createElement('div'); labelLayer.id = 'otherLabels'; document.body.appendChild(labelLayer);
const INTERP_MS = 150; // 보간 지연
const dotGeo = new THREE.CircleGeometry(.35, 12).rotateX(-Math.PI / 2); // 멀리 있는(상세 표시 안 하는) 유저는 바닥 점으로 단순화
function removeOther(id) { const o = others.get(id); if (!o) return; if (o.dog) scene.remove(o.dog.root); if (o.gd) scene.remove(o.gd.root); if (o.rItem) scene.remove(o.rItem); scene.remove(o.dot); o.label.remove(); o.bub?.remove(); others.delete(id); }
let mapCounts = null;
const netc = new NetClient(_srvUrl, NET, {
  onStatus: (st, n, no) => net.set(st === 'online' ? NetState.ONLINE : st === 'connecting' ? NetState.CONNECTING : st === 'error' ? NetState.ERROR : NetState.OFFLINE_SOLO, n || 1, no),
  onJoin: (id, name, breed0) => { if (others.has(id)) return; const [breed, oc] = String(breed0 || '').split('-o'); const b = BREEDS.some(x => x.id === breed) ? breed : DEFAULT_BREED;
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: breedById(b).color, transparent: true, opacity: .8 })); dot.visible = false; scene.add(dot);
    const label = document.createElement('div'); label.className = 'olabel'; label.textContent = name; labelLayer.appendChild(label);
    others.set(id, { name, breed: b, outfit: decode(oc), dog: null, dot, buf: [], label, sayT: 0 }); },
  onState: (id, x, z, r, a) => { const o = others.get(id); if (!o) return; o.buf.push([performance.now(), x, z, r, a]); if (o.buf.length > 8) o.buf.shift(); },
  onLeave: removeOther,
  onSay: (id, k) => { const o = others.get(id); if (o && SAY_TEXT[k]) { if (!o.bub) { o.bub = document.createElement('div'); o.bub.className = 'bubble obub'; labelLayer.appendChild(o.bub); } o.bub.textContent = SAY_TEXT[k]; if (k === 'rest') o.restSay = true; o.bub.style.display = ''; o.sayT = 2.5; } }, // v3.9i: 상대 인사 = 진짜 말풍선(서버 프리셋, 쿨다운은 서버 2.5초)
  onCounts: c => { mapCounts = c; if (mapMenu.classList.contains('open')) renderMapMenu(); },
  onReset: () => { for (const id of [...others.keys()]) removeOther(id); },
  onFix: (x, z) => { dog.root.position.set(x, heightAt(x, z), z); },
  onFull: m => toast(m.next ? `서버 ${String(m.no).padStart(2, '0')}이 가득 차서 ${String(m.next).padStart(2, '0')}번으로 들어가요` : '이 맵의 모든 서버가 가득 찼어요 · 혼자 플레이'),
});
const helloMsg = () => ({ map: curMap, name: dogName, breed: `${breedId}-o${encode(outfit)}`.slice(0, 24), x: +dog.root.position.x.toFixed(1), z: +dog.root.position.z.toFixed(1), r: dog.root.rotation.y });
let sendAcc = 0; const _gv = new THREE.Vector3();
function netFrame(dt, dogState) {
  if (!netc.online) { if (others.size) netc.cb.onReset(); return; }
  if ((sendAcc += dt) >= 1 / NET.sendHz) { sendAcc = 0; const p = dog.root.position; netc.send({ t: 's', x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: +dog.root.rotation.y.toFixed(2), a: Math.max(0, ANIM.indexOf(dogState)) }); }
  const now = performance.now() - INTERP_MS, me = dog.root.position;
  const arr = [...others.values()].filter(o => o.buf.length); for (const o of arr) { const l = o.buf[o.buf.length - 1]; o.d2 = (l[1] - me.x) ** 2 + (l[2] - me.z) ** 2; }
  arr.sort((a, b) => a.d2 - b.d2);
  arr.forEach((o, i) => {
    const b = o.buf; let k = b.length - 1; while (k > 0 && b[k - 1][0] > now) k--; // now 를 감싸는 두 표본으로 보간
    const p0 = b[Math.max(0, k - 1)], p1 = b[k], u = p1[0] === p0[0] ? 1 : Math.min(1, Math.max(0, (now - p0[0]) / (p1[0] - p0[0])));
    const x = p0[1] + (p1[1] - p0[1]) * u, z = p0[2] + (p1[2] - p0[2]) * u; let dr = p1[3] - p0[3]; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); const r = p0[3] + dr * u;
    const detail = i < MAX_DETAIL;
    if (detail && !o.dog) { o.dog = makeDog(breedById(o.breed)); scene.add(o.dog.root); }
    if (detail && !o.gd) { o.gd = makeGuardian(); scene.add(o.gd.root); o.gp = null; applyOutfit(o.gd, o.dog, o.outfit || {}); } // v3.9l: 상대 착용(hello의 breed 뒤 '-o코드'로 전달, 서버 변경 없음) // v3.9k: 상대 보호자도 표시(서버는 강아지 위치만 보냄 → 보호자 위치는 강아지 앞 0.9m로 추정, 연출)
    if (!detail && o.gd) { scene.remove(o.gd.root); o.gd = null; }
    if (!detail && o.dog) { scene.remove(o.dog.root); o.dog = null; } // 상세 한도 밖: 모델 제거하고 점으로
    const y = heightAt(x, z);
    const st0 = ANIM[p1[4]] || 'idle'; if (st0 !== 'sit') o.sitAt = 0; else if (!o.sitAt) o.sitAt = performance.now(); o.sitT = o.sitAt ? (performance.now() - o.sitAt) / 1000 : 0; if (st0 !== 'sit') o.restSay = false;
    const resting = st0 === 'sit' && (o.restSay || o.sitT > 4), rk = resting ? ((o.outfit && o.outfit.rest) || 'def') : ''; // v3.9m: 상대 휴식 = sit + ('rest' 말풍선 또는 4초 넘게 앉음). 아이템은 착용 코드
    if (o.dog) { o.dog.root.position.set(x, y, z); o.dog.root.rotation.y = r; o.dog.animate(time, st0, rk === 'mat'); }
    if (o.gd) { const st = ANIM[p1[4]] || 'idle', mv = st === 'walk' || st === 'run'; let gx = x + Math.sin(r) * .9, gz = z + Math.cos(r) * .9; if (!isWalkable(gx, gz)) { gx = x + Math.cos(r) * .7; gz = z - Math.sin(r) * .7; if (!isWalkable(gx, gz)) { gx = x; gz = z; } }
      if (!o.gp) o.gp = new THREE.Vector3(gx, 0, gz); else if (mv || o.gp.distanceTo(_gv.set(x, 0, z)) > 2.2) o.gp.lerp(_gv.set(gx, 0, gz), Math.min(1, dt * 5));
      if (rk) { const sx = Math.cos(r), sz = -Math.sin(r), fx = Math.sin(r), fz = Math.cos(r); // 내 쪽 startRest 배치를 강아지 위치에서 거꾸로 계산
        const cx = rk === 'mat' ? x - fx * .45 : x + sx * .4, cz = rk === 'mat' ? z - fz * .45 : z + sz * .4;
        o.gp.set(rk === 'mat' ? cx + sx * .85 : cx + sx * .35, 0, rk === 'mat' ? cz + sz * .85 : cz + sz * .35);
        const want = rk === 'chair' ? 'chair' : 'mat'; if (o.rItem && o.rItem.userData.k !== want) { scene.remove(o.rItem); o.rItem = null; }
        if (!o.rItem) { o.rItem = want === 'chair' ? makeGroundItem('chair') : makeMat(); o.rItem.userData.k = want; scene.add(o.rItem); }
        if (want === 'chair') o.rItem.position.set(o.gp.x, heightAt(o.gp.x, o.gp.z) + .01, o.gp.z); else o.rItem.position.set(cx, heightAt(cx, cz) + .01, cz); o.rItem.rotation.y = r; }
      else if (o.rItem) { scene.remove(o.rItem); o.rItem = null; }
      o.gd.root.position.set(o.gp.x, heightAt(o.gp.x, o.gp.z) + (rk ? .03 : 0), o.gp.z); o.gd.root.rotation.y = r; o.gd.animate(time, mv, !!rk, rk === 'mat' ? 'lie' : rk === 'chair' ? 'chair' : ''); }
    o.dot.visible = !detail; if (!detail) o.dot.position.set(x, y + .05, z);
    if (!o.gd && o.rItem) { scene.remove(o.rItem); o.rItem = null; }
    if (o.sayT > 0 && (o.sayT -= dt) <= 0 && o.bub) o.bub.style.display = 'none';
    if (detail && o.d2 < 900) { _lp.set(x, y + 1.05, z).project(camera); const on = _lp.z < 1; o.label.style.display = on ? '' : 'none'; if (on) o.label.style.transform = `translate(${(_lp.x * .5 + .5) * innerWidth}px,${(-_lp.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;  if (o.bub && o.sayT > 0) { _lp.set(x, y + 1.55, z).project(camera); o.bub.style.display = _lp.z < 1 ? '' : 'none'; o.bub.style.left = (_lp.x * .5 + .5) * innerWidth + 'px'; o.bub.style.top = (-_lp.y * .5 + .5) * innerHeight + 'px'; } }
    else { o.label.style.display = 'none'; if (o.bub) o.bub.style.display = 'none'; }
  });
}
const _lp = new THREE.Vector3();
setTimeout(() => netc.connect(helloMsg()), 0); // 로딩과 분리
const SAY_OF = { hi: 'hi', pet: 'pet', treat: 'treat', photo: 'photo', rest: 'rest', sit: 'woof' };
window.__net = { netc, others, get detail() { return MAX_DETAIL; } };

// ---------- 관리자 모드(숨김) ----------
// 주의: 클라이언트 코드라 진짜 보안이 아님. 누구나 소스를 보면 켤 수 있음. 시간 표시를 바꾸는 것도 그 사용자 화면에만 적용됨.
const ADMIN_CODE = '2100';
let admin = _q0.get('admin') === '1', titleTaps = 0, titleT = 0;
$('#title').addEventListener('click', () => { const n = performance.now(); titleTaps = n - titleT < 900 ? titleTaps + 1 : 1; titleT = n; if (titleTaps >= 5) { titleTaps = 0; const c = prompt('관리자 코드'); if (c === ADMIN_CODE) { admin = true; showAdmin(); } } });
function showAdmin() { $('#adminPanel').classList.add('open'); }
if (admin) showAdmin();
document.querySelectorAll('#adminPanel [data-ph]').forEach(b => b.onclick = () => setTime(b.dataset.ph === 'auto' ? null : b.dataset.ph));
$('#admDrone').onclick = () => { if (curMap !== 'gwangalli') { toast('드론쇼는 광안리 맵에서 볼 수 있어요'); return; } if (!clock.override && curPhase().phase !== 'evening') setTime('evening'); world.droneStart?.(); }; // v3.9
addEventListener('bw-drone', () => { sound.chime?.(); toast('🛸 광안리 드론쇼 (연출) — 실제는 매주 토요일 밤'); });
$('#admPause').onclick = () => { if (clock.paused) { clock.offset = clock.pausedAt - Date.now(); clock.paused = false; } else { clock.pausedAt = nowMs(); clock.paused = true; } };
$('#admClose').onclick = () => $('#adminPanel').classList.remove('open');
let admAcc = 0;
function updateAdmin() {
  if (!$('#adminPanel').classList.contains('open') || (admAcc = (admAcc + 1) % 15)) return;
  const p = phaseAt(nowMs()), left = Math.ceil((1 - p.p) * 20);
  $('#admState').textContent = `현재: ${PHASE_LABEL[ph.phase]}${clock.override ? ' (고정)' : ''} · 자동 위상 ${PHASE_LABEL[p.phase]} ${Math.round(p.p * 100)}% · 다음까지 약 ${left}분 · ${clock.paused ? '일시정지' : '순환 중'}`;
  $('#admPause').textContent = clock.paused ? '자동 순환 재개' : '자동 순환 일시정지';
}
// v3.9n: ✕(나가기) 제거 — 원래 안내 토스트만 띄우던 버튼이라 옮길 기능 없음

// ---------- 루프 ----------
let lastT = performance.now(), time = 0;
const tmp = new THREE.Vector3();
let dogTarget = new THREE.Vector3(), dogIdle = 0;
window.__perf = { frames: 0, total: 0 };
function moveChar(obj, dir, speed, dt) {
  const nx = obj.position.x + dir.x * speed * dt, nz = obj.position.z + dir.z * speed * dt;
  let moved = false;
  if (isWalkable(nx, nz)) { obj.position.x = nx; obj.position.z = nz; moved = true; }
  else if (isWalkable(nx, obj.position.z)) { obj.position.x = nx; moved = true; }
  else if (isWalkable(obj.position.x, nz)) { obj.position.z = nz; moved = true; }
  const ang = Math.atan2(dir.x, dir.z);
  let d = ang - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * Math.min(1, dt * 10);
  obj.position.y = heightAt(obj.position.x, obj.position.z);
  return moved;
}
function frame() {
  const t0 = performance.now();
  const now = performance.now(), dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; time += dt;
  // 시간대 보간
  tickTime(dt); updateAdmin();
  // 보호자 이동
  const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const kz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  let walking = false; const g = guardian.root;
  if (rest.on && (kx || kz || moveTarget)) stopRest();
  updateRest(dt);
  if (kx || kz) {
    moveTarget = null; marker.visible = false;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = r.multiplyScalar(kx).add(f.multiplyScalar(-kz)).normalize();
    walking = moveChar(g, dir, 4.0, dt); // 축척 0.3 월드에 맞춘 속도
  } else if (moveTarget) {
    tmp.subVectors(moveTarget, g.position); tmp.y = 0;
    const d = tmp.length();
    if (d < 0.15) { moveTarget = null; marker.visible = false; }
    else { walking = moveChar(g, tmp.normalize(), 4.0, dt); if (!walking) { moveTarget = null; marker.visible = false; } }
  }
  guardian.animate(time, walking, rest.on, rest.on && rest.kind === 'mat' ? 'lie' : rest.on && rest.kind === 'chair' ? 'chair' : '');
  marker.rotation.z += dt;
  // 강아지: 목줄 길이 안에서 보호자 옆을 따라감, 멀어지면 달려옴
  const dp = dog.root.position;
  const side = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y)).multiplyScalar(-0.9);
  dogTarget.copy(g.position).add(side).add(new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)).multiplyScalar(.3));
  tmp.subVectors(dogTarget, dp); tmp.y = 0;
  const dd = tmp.length(), gd = dp.distanceTo(g.position);
  let dogState = 'idle';
  if (rest.on) { dogState = 'sit'; dp.lerp(rest.dogSpot, Math.min(1, dt * 4)); let dr = rest.rot - dog.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); dog.root.rotation.y += dr * Math.min(1, dt * 6); }
  else if (dogAction === 'sit') dogState = 'sit';
  else if (dd > 0.35) {
    const run = gd > LEASH * 0.85;
    dogState = run ? 'run' : 'walk';
    moveChar(dog.root, tmp.normalize(), run ? 7 : 4.6, dt);
    if (gd > LEASH) { // 목줄 한계: 강제로 끌려옴
      tmp.subVectors(dp, g.position).setLength(LEASH); dp.copy(g.position).add(tmp);
    }
  } else { dogIdle += dt; // 서 있을 때는 보호자와 같은 방향을 봄
    let dr = g.rotation.y - dog.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); dog.root.rotation.y += dr * Math.min(1, dt * 10); }
  if (dogAction && dogAction !== 'sit') dogState = dogAction;
  if (actionT > 0) { actionT -= dt; if (actionT <= 0) dogAction = null; }
  if (dogState === 'sit' && walking) { dogAction = null; }
  dog.animate(time, dogState, rest.on && rest.kind === 'mat');
  netFrame(dt, dogState);
  for (const d of breedsGrid) if (d.root.visible) d.animate(time, "idle");
  updateLeash();
  // 효과
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i]; h.userData.life -= dt; h.position.y += h.userData.vy * dt; h.material.opacity = Math.min(1, h.userData.life);
    if (h.userData.life <= 0) { scene.remove(h); hearts.splice(i, 1); }
  }
  window.__camPos = g.position;
  world.update(time, dt, camera, guardian.root.position);
  // 그림자 카메라를 캐릭터 주변으로
  sun.target.position.copy(g.position);
  sun.position.copy(g.position).add(new THREE.Vector3(cur.sunX, cur.sunY, cur.sunZ).normalize().multiplyScalar(60));
  charFill.position.copy(camera.position).lerp(g.position, .5); charFill.position.y += 1.2;
  updateCamera(dt);
  // 말풍선 위치
  if (bubbleT > 0) {
    bubbleT -= dt;
    const p = bubbleOn === 'me' ? guardian.root.position.clone().setY(guardian.root.position.y + 1.65) : dog.root.position.clone().setY(dog.root.position.y + 1.25); p.project(camera);
    const b = $('#bubble'); const bw = b.offsetWidth || 0; b.style.left = Math.min(innerWidth - bw / 2 - 8, Math.max(bw / 2 + 8, (p.x * .5 + .5) * innerWidth)) + 'px'; b.style.top = (-p.y * .5 + .5) * innerHeight + 'px';
    if (bubbleT <= 0) b.classList.add('hidden');
  }
  if (!window.__game?.mapView?.isOpen) renderer.render(scene, camera); // v3.9g: 지도 열림 중엔 3D 렌더 생략(위치·네트워크 갱신은 계속)
  window.__perf.frames++; window.__perf.total += performance.now() - t0;
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.fov = camFov(); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// 테스트/스크린샷용 훅
// 디버그: ?breeds=grid → 시작 위치 앞에 20종을 줄지어 세움(스크린샷용, 연출)
const breedsGrid = [];
if (new URLSearchParams(location.search).get('breeds') === 'grid') {
  const p0 = guardian.root.position;
  BREEDS.forEach((b, i) => { const d = makeDog(b); const c = i % 5, r = Math.floor(i / 5); d.root.position.set(p0.x + (c - 2) * 1.5, heightAt(p0.x, p0.z), p0.z - 3 - r * 1.7); d.root.rotation.y = 0; scene.add(d.root); breedsGrid.push(d); });
}
function lineup(n0 = 0, n = 20, cols = 5, gap = 1.3, fwd = 4) { // 카메라 앞에 견종을 격자로 배치
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new THREE.Vector3(-f.z, 0, f.x);
  const p0 = guardian.root.position; breedsGrid.forEach(d => d.root.visible = false);
  breedsGrid.slice(n0, n0 + n).forEach((d, i) => { const c = i % cols, row = Math.floor(i / cols); const p = p0.clone().addScaledVector(f, fwd + row * 1.6).addScaledVector(r, (c - (cols - 1) / 2) * gap); d.root.position.set(p.x, heightAt(p.x, p.z), p.z); d.root.rotation.y = Math.atan2(-f.x, -f.z); d.root.visible = true; });
}

// ---------- 맵 이동(같은 클라이언트 안에서 월드만 교체. 서버 이동 아님 — 오프라인) ----------
const setTitle = () => { const m = mapById(curMap); $('#title').innerHTML = `<span class="brand">부산 산책</span><span class="sep"></span><b class="mapnm">${m.name} ${m.sub}</b>`; document.title = `부산 산책 | ${m.name}`; };
setTitle(); LSm.set('bw.map', curMap);
const savePos = () => { const p = guardian.root.position; LSm.set('bw.pos.' + curMap, `${p.x.toFixed(2)},${p.z.toFixed(2)},${guardian.root.rotation.y.toFixed(3)}`); };
setInterval(savePos, 2000); addEventListener('pagehide', savePos);
let switching = false;
const GO_NAME = { bukhang: '북항친수공원', gwangalli: '광안리', hwangnyeong: '황령산', yonggungsa: '용궁사', gamcheon: '감천문화마을' }; // v3.9j 맵 이동 문구
async function switchMap(id) {
  if (switching || id === curMap || !mapById(id)) { closeMapMenu(); return false; }
  switching = true; closeMapMenu(); savePos();
  const fade = $('#mapFade'); fade.querySelector('b').textContent = mapById(id).name; fade.querySelector('.go').textContent = (GO_NAME[id] || mapById(id).name) + ' 가는 중'; fade.querySelector('small').textContent = '맵 불러오는 중…'; fade.classList.add('on');
  await new Promise(r => setTimeout(r, 380)); // 페이드 인
  try {
    if (rest.on) stopRest();
    const w = await getWorld(id, scene);
    world = w; curMap = id; setActive(w); LSm.set('bw.map', id); setTitle();
    const sp = savedPos(id); const s0 = sp && w.isWalkable(sp.x, sp.z) && reachOf(w)(sp.x, sp.z) ? sp : randStart(w);
    guardian.root.position.set(s0.x, heightAt(s0.x, s0.z), s0.z); guardian.root.rotation.y = s0.rot;
    dog.root.position.set(s0.x - Math.sin(s0.rot) * .9, heightAt(s0.x, s0.z), s0.z - Math.cos(s0.rot) * .9); dog.root.rotation.y = s0.rot;
    camTarget.copy(guardian.root.position); yaw = s0.rot - Math.PI; moveTarget = null; if (marker) marker.visible = false;
    applyTime(cur, { scene, hemi, sun, renderer, world }); // 시간 위상·사운드는 그대로 이어짐
    sound.setNear(world.waterNear(s0.x, s0.z)); sound.preview = ''; sound.setTrack(id); // v3.9r 맵별 곡 크로스페이드
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    toast(`${mapById(id).name}에 도착했어요`); netc.closed = false; netc.cb.onReset(); netc.connect(helloMsg());
  } catch (e) { console.warn('맵 이동 실패', e); fade.querySelector('small').textContent = '불러오기 실패'; await new Promise(r => setTimeout(r, 900)); }
  fade.classList.remove('on'); switching = false; return true;
}
const mapMenu = $('#mapMenu');
function renderMapMenu() { mapMenu.querySelector('.list').innerHTML = MAPS.map(m => `<button data-map="${m.id}" class="${m.id === curMap ? 'cur' : ''}"><span class="no">${m.sub}</span><span class="nm">${m.name}<small>${m.desc}</small></span>${mapCounts ? `<i class="cnt">${mapCounts[m.id] || 0}명</i>` : ''}${m.id === curMap ? '<em>현재</em>' : ''}</button>`).join(''); }
function openMapMenu() { renderMapMenu(); mapMenu.classList.add('open'); }
function closeMapMenu() { mapMenu.classList.remove('open'); }
$('#title').addEventListener('click', e => { e.stopPropagation(); mapMenu.classList.contains('open') ? closeMapMenu() : openMapMenu(); }); // v3.9g: 상단 맵 이름 눌러도 맵 선택
$('#srv').addEventListener('click', e => { e.stopPropagation(); mapMenu.classList.contains('open') ? closeMapMenu() : openMapMenu(); });
mapMenu.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-map]'); if (b) switchMap(b.dataset.map); });
mapMenu.addEventListener('pointerdown', e => e.stopPropagation());
addEventListener('pointerdown', e => { if (mapMenu.classList.contains('open') && !e.target.closest('#mapMenu,#srv,#title')) closeMapMenu(); });
// v3.9 지도 뷰어용 탑뷰: 실제 지도 대신 '게임 월드 그 자체'(땅·물·길·건물·나무 메시)를 정사영 카메라로 위에서 한 번 렌더해 맵별 캐시
// v3.9k: 지도 탑뷰에서 시작점에서 걸어서 닿는 곳은 그대로(밝게), 못 가는 땅(건물·막힌 곳)은 살짝 어둡게. 물(파란 화소)은 그대로
function shadeReach(w, g, cw, ch, R) {
  const ok = reachOf(w), im = g.getImageData(0, 0, cw, ch), d = im.data, sx = (R.x1 - R.x0) / cw, sz = (R.z1 - R.z0) / ch;
  for (let py = 0; py < ch; py++) { const z = R.z0 + (py + .5) * sz; for (let px = 0; px < cw; px++) { const i = (py * cw + px) * 4; if (d[i + 2] > d[i] + 25 && d[i + 2] > d[i + 1]) continue; if (ok(R.x0 + (px + .5) * sx, z)) continue; d[i] *= .7; d[i + 1] *= .7; d[i + 2] *= .74; } }
  g.putImageData(im, 0, 0);
}
function shadeTop(id, img, R) { if (id !== curMap || !world) return img; const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); shadeReach(world, g, c.width, c.height, R); return c; }
const _topCache = {};
async function renderTop(id, R) { // R: 월드 좌표 사각형 {x0,x1,z0,z1}
  const key = id + ':' + [R.x0, R.x1, R.z0, R.z1].map(v => v.toFixed(1)).join(','); if (_topCache[key]) return _topCache[key];
  const w = await getWorld(id, scene); const PX = 1024, aspect = (R.x1 - R.x0) / (R.z1 - R.z0), cw = aspect >= 1 ? PX : Math.round(PX * aspect), ch = aspect >= 1 ? Math.round(PX / aspect) : PX;
  const cam = new THREE.OrthographicCamera(R.x0, R.x1, -R.z0, -R.z1, 1, 3000); // up = -z(북쪽이 위)
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2; cam.position.set(0, 1500, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  cam.left = R.x0; cam.right = R.x1; cam.top = -R.z0; cam.bottom = -R.z1; cam.updateProjectionMatrix(); void cx; void cz;
  const vis = []; scene.children.forEach(o => { vis.push([o, o.visible]); o.visible = o === w.group || o.isLight; });
  // v3.9b 단순화: 라벨·별·하늘·가로등·줄기 숨김, 건물은 한 가지 연한 톤, 나무는 따로 렌더해 연녹색 면으로
  const hidden = [], swapped = [], trees = [], BLD = new THREE.MeshBasicMaterial({ color: 0xe8e1d4 }), WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
  w.group.traverse(o => { if (!o.visible) return; const k = o.userData.mapKind;
    if (o.isSprite || o.isPoints || o.isLine || k === 'hide' || (o.material && o.material.side === THREE.BackSide)) { hidden.push(o); o.visible = false; }
    else if (k === 'tree') { trees.push(o); o.visible = false; }
    else if (k === 'bld') { swapped.push([o, o.material]); o.material = BLD; } });
  const keep = { hc: hemi.color.getHex(), hg: hemi.groundColor.getHex(), hi: hemi.intensity, sc: sun.color.getHex(), si: sun.intensity, ex: renderer.toneMappingExposure, fn: scene.fog && scene.fog.near, ff: scene.fog && scene.fog.far, bg: scene.background, sh: renderer.shadowMap.enabled };
  hemi.color.set(0xffffff); hemi.groundColor.set(0xffffff); hemi.intensity = 2.4; sun.intensity = 0.6; renderer.toneMappingExposure = 1.05; if (scene.fog) { scene.fog.near = 1e5; scene.fog.far = 1e6; } scene.background = new THREE.Color(0x3f8fb5);
  const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(cw, ch, false);
  renderer.render(scene, cam); const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.filter = 'blur(' + (cw / 420).toFixed(1) + 'px)'; g.drawImage(renderer.domElement, 0, 0, cw, ch); g.filter = 'none'; // 땅 텍스처 잔점 흐림(단순화)
  if (trees.length) { // 나무만 흰색으로 검은 바탕에 렌더 → 흐림+문턱으로 덩어리 면 마스크
    const mats = []; w.group.traverse(o => { if (o.isMesh && o.visible) { mats.push(o); o.visible = false; } }); trees.forEach(t => { t.visible = true; swapped.push([t, t.material]); t.material = WHITE; });
    scene.background = new THREE.Color(0x000000); renderer.render(scene, cam);
    const m = document.createElement('canvas'); m.width = cw; m.height = ch; const mg = m.getContext('2d'); mg.filter = 'blur(' + Math.max(6, cw / 70) + 'px)'; mg.drawImage(renderer.domElement, 0, 0, cw, ch);
    const md = mg.getImageData(0, 0, cw, ch).data, im = g.getImageData(0, 0, cw, ch), d = im.data;
    for (let i = 0; i < md.length; i += 4) if (md[i] > 45) { d[i] = 0xc4; d[i + 1] = 0xe0; d[i + 2] = 0xab; }
    g.putImageData(im, 0, 0); mats.forEach(o => o.visible = true); trees.forEach(t => t.visible = false);
  }
  shadeReach(w, g, cw, ch, R);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false);
  hemi.color.setHex(keep.hc); hemi.groundColor.setHex(keep.hg); hemi.intensity = keep.hi; sun.color.setHex(keep.sc); sun.intensity = keep.si; renderer.toneMappingExposure = keep.ex; if (scene.fog) { scene.fog.near = keep.fn; scene.fog.far = keep.ff; } scene.background = keep.bg;
  for (const [o, mt] of swapped) o.material = mt; for (const o of trees) o.visible = true;
  for (const [o, v] of vis) o.visible = v; for (const o of hidden) o.visible = true;
  return _topCache[key] = { img: c, pois: w.pois || [] };
}
// v3.9g: 견종 미리보기 이미지 생성(도구용) — assets/breeds/<id>.webp 로 미리 캡처해 두고 게임은 이미지만 씀
function renderDogThumb(id, px = 256) {
  const b = BREEDS.find(x => x.id === id); const sc = new THREE.Scene(); const d = makeDog(b); d.root.rotation.y = -0.6; sc.add(d.root);
  sc.add(new THREE.HemisphereLight(0xffffff, 0xcbbca8, 2.2)); const L = new THREE.DirectionalLight(0xffffff, 1.6); L.position.set(2, 4, 3); sc.add(L);
  d.animate && d.animate(0, 'idle'); const bx = new THREE.Box3().setFromObject(d.root), c = bx.getCenter(new THREE.Vector3()), r = bx.getSize(new THREE.Vector3()).length() * .62;
  const cam = new THREE.PerspectiveCamera(30, 1, .01, 100); cam.position.set(c.x + r * .35, c.y + r * .9, c.z + r * 1.9); cam.lookAt(c);
  const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), bg = scene.background; renderer.setPixelRatio(1); renderer.setSize(px, px, false); renderer.setClearColor(0x000000, 0);
  renderer.render(sc, cam); const cv = document.createElement('canvas'); cv.width = cv.height = px; cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false); void bg; return cv.toDataURL('image/webp', .85);
}
const mapView = initMapView({ renderTop, shadeTop, maps: MAPS, getCur: () => curMap, getMe: () => ({ x: guardian.root.position.x, z: guardian.root.position.z, rot: guardian.root.rotation.y }) });
window.__game = { setOutfit, get outfit() { return outfit; }, renderTop, renderDogThumb, BREEDS, mapView, openMapMenu, switchMap,  sound, breedsGrid, lineup, setTime: k => setTime(k, true), say, startRest, stopRest, openDogModal, swapDog, get rest() { return rest.on; }, test: { setPos: (x, z, r) => { guardian.root.position.set(x, heightAt(x, z), z); dog.root.position.set(x + .8, heightAt(x + .8, z + .8), z + .8); if (r !== undefined) yaw = r; }, setYaw: v => { yaw = v; }, setCam: (y, p, d) => { yaw = y; pitch = p; dist = d; }, getCam: () => [yaw, pitch, dist], get dog() { return dog.root; }, guardian: guardian.root, moveChar, get isWalkable() { return isWalkable; }, get heightAt() { return heightAt; }, get world() { return world; }, reachOf, randStart, switchMap: id => switchMap(id), get map() { return curMap; }, get others() { return others; } } }; // test: tools/walktest.mjs 용

setLoad(100, '들어가는 중');
frame();
setTimeout(() => { $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 700); say(`나 · ${dogName}`, 3); if (!LS.get('bw.breed') && !_q0.has('nomodal')) openDogModal(); }, 400);
