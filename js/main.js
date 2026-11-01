// 부산 산책 | 북항 친수공원 — 프로토타입
// 모든 모델/텍스처/사운드는 Three.js 기본 도형과 절차 생성으로 직접 제작. (외부 에셋 없음)
// 월드 배치는 실제 지도가 아니라 상상 구성(연출)이다. 요소 목록만 디자이너 전달 자료 기준.
import * as THREE from 'three';
import { S as MAP_SCALE } from './world.js';
import { MAPS, mapById, getWorld, setActive, isWalkable, heightAt } from './maps.js';
import { makeGuardian, makeDog } from './characters.js';
import { initMapView } from './mapview.js';
import { TIMES, PHASES, PHASE_LABEL, phaseAt, presetFor, lerpPreset, applyTime } from './times.js';
import { BREEDS, breedById, DEFAULT_BREED } from './breeds.js';
import { NetState, initNetStatus } from './net.js';
import { makeMat } from './mat.js';
import { BgSound } from './sound.js';

const $ = s => document.querySelector(s);
const setLoad = p => { $('#loadbar').style.width = p + '%'; };
setLoad(10);

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

setLoad(30);
const _q0m = new URLSearchParams(location.search);
const LSm = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let curMap = mapById(_q0m.get('map')) ? _q0m.get('map') : mapById(LSm.get('bw.map')) ? LSm.get('bw.map') : 'bukhang';
let world = await getWorld(curMap, scene); setActive(world);
const savedPos = id => { const v = (LSm.get('bw.pos.' + id) || '').split(',').map(Number); return v.length === 3 && v.every(Number.isFinite) ? { x: v[0], z: v[1], rot: v[2] } : null; };
const sound = new BgSound(); // 배경음(직접 합성) — 첫 터치/클릭 후 시작, 음소거는 localStorage bw.mute
let nearAcc = 0;
setLoad(70);

const guardian = makeGuardian(); scene.add(guardian.root);
// 강아지 이름·견종: localStorage 저장
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let dogName = LS.get('bw.dogName') || '바다', breedId = LS.get('bw.breed') || DEFAULT_BREED;
let dog = makeDog(breedById(breedId)); scene.add(dog.root);
function swapDog(id) { const old = dog; dog = makeDog(breedById(id)); dog.root.position.copy(old.root.position); dog.root.rotation.y = old.root.rotation.y; scene.remove(old.root); scene.add(dog.root); breedId = id; }
// 캐릭터 보조 라이트(약하게, 밤에도 칙칙하지 않게)
const charFill = new THREE.PointLight(0xffe2c0, 1.2, 6, 1.5); scene.add(charFill);
const _sp0 = (!_q0m.has('fresh') && savedPos(curMap) && world.isWalkable(savedPos(curMap).x, savedPos(curMap).z)) ? savedPos(curMap) : world.start;
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
let yaw = _sp0.rot - Math.PI + +(_q.get('yaw') || 0), pitch = PORTRAIT() ? 0.36 : 0.3, dist = PORTRAIT() ? 7.2 : 4.6; // 캐릭터가 화면 높이 약 1/3 (디버그: ?yaw=3.14 앞모습)
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
    if (pinchD) dist = THREE.MathUtils.clamp(dist * pinchD / d, 2.6, 12);
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
cv.addEventListener('wheel', e => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, 12); }, { passive: false });

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
let bubbleT = 0;
function say(msg, sec = 2) { $('#bubble').textContent = msg; $('#bubble').classList.remove('hidden'); bubbleT = sec; }
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
document.querySelectorAll('.bottom-bar button').forEach(b => b.onclick = () => {
  const a = b.dataset.act;
  if (a === 'pet') { dogAction = 'pet'; actionT = 1.6; say('헤헤, 좋아요!'); spawnHearts('❤', 0xffffff); }
  if (a === 'treat') { dogAction = 'treat'; actionT = 1.6; say('냠냠! 맛있다멍'); spawnHearts('✨', 0xffffff); }
  if (a === 'sit') { dogAction = 'sit'; actionT = 3; say('앉았어요!'); }
  if (a === 'photo') takePhoto();
  if (a === 'rest') rest.on ? stopRest() : startRest();
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
$('#btnSound').onclick = () => { const m = !sound.muted; sound.setMuted(m); LS.set('bw.mute', m ? '1' : '0'); $('#btnSound').textContent = m ? '🔇' : '🔊'; toast(m ? '소리 끔' : '배경음·물소리(직접 합성) 켜짐'); };
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
  rest.on = true; rest.t = 0; rest.rot = spot.r; mat.visible = true; mat.position.set(spot.x, heightAt(spot.x, spot.z) + .01, spot.z); mat.rotation.y = spot.r;
  const sx = Math.cos(spot.r), sz = -Math.sin(spot.r);
  g.position.set(spot.x + sx * .35, heightAt(spot.x, spot.z) + .03, spot.z + sz * .35); g.rotation.y = spot.r;
  rest.dogSpot.set(spot.x - sx * .4, heightAt(spot.x, spot.z) + .03, spot.z - sz * .4);
  moveTarget = null; marker.visible = false; say(`${dogName}랑 잠깐 쉬어요`, 2.5);
}
function stopRest() { if (!rest.on) return; rest.on = false; rest.folding = 1; }
function updateRest(dt) {
  if (rest.on) { rest.t = Math.min(1, rest.t + dt / .5); mat.scale.set(rest.t, 1, .3 + .7 * rest.t); }
  else if (rest.folding > 0) { rest.folding = Math.max(0, rest.folding - dt / .4); mat.scale.set(rest.folding, 1, .3 + .7 * rest.folding); if (!rest.folding) mat.visible = false; }
}

// ---------- 설정 · 정보 · 강아지 모달 ----------
function openPanel(id) { document.querySelectorAll('.panel').forEach(p => p.classList.toggle('open', p.id === id)); }
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
    el.innerHTML = `<i style="background:linear-gradient(135deg,${b.color} 55%,${b.color2} 55%)"></i><b>${b.name}</b><small>${{ drop: '처진 귀', erect: '쫑긋 귀', big: '큰 귀', semi: '반 선 귀', button: '단추 귀', bat: '박쥐 귀' }[b.ear]} · ${(b.size||1) >= 1.1 ? '큰 개' : (b.size||1) <= .9 ? '작은 개' : '중간'}</small>`;
    el.onclick = () => { pickBreed = b.id; list.querySelectorAll('.breed').forEach(x => x.classList.toggle('on', x === el)); swapDog(b.id); };
    list.appendChild(el);
  }
  openPanel('dogModal');
}
$('#dogOk').onclick = () => {
  dogName = ($('#dogName').value.trim() || '바다').slice(0, 8); LS.set('bw.dogName', dogName); LS.set('bw.breed', pickBreed); if (pickBreed !== breedId) swapDog(pickBreed);
  openPanel(null); say(`나 · ${dogName}`, 3);
};

// ---------- 서버 상태(현재 서버 없음: 오프라인 혼자 플레이로 정직하게 표시) ----------
const net = initNetStatus($('#srv'));
net.set(NetState.OFFLINE_SOLO);

// ---------- 관리자 모드(숨김) ----------
// 주의: 클라이언트 코드라 진짜 보안이 아님. 누구나 소스를 보면 켤 수 있음. 시간 표시를 바꾸는 것도 그 사용자 화면에만 적용됨.
const ADMIN_CODE = '2100';
let admin = _q0.get('admin') === '1', titleTaps = 0, titleT = 0;
$('#title').addEventListener('click', () => { const n = performance.now(); titleTaps = n - titleT < 900 ? titleTaps + 1 : 1; titleT = n; if (titleTaps >= 5) { titleTaps = 0; const c = prompt('관리자 코드'); if (c === ADMIN_CODE) { admin = true; showAdmin(); } } });
function showAdmin() { $('#adminPanel').classList.add('open'); }
if (admin) showAdmin();
document.querySelectorAll('#adminPanel [data-ph]').forEach(b => b.onclick = () => setTime(b.dataset.ph === 'auto' ? null : b.dataset.ph));
$('#admPause').onclick = () => { if (clock.paused) { clock.offset = clock.pausedAt - Date.now(); clock.paused = false; } else { clock.pausedAt = nowMs(); clock.paused = true; } };
$('#admClose').onclick = () => $('#adminPanel').classList.remove('open');
let admAcc = 0;
function updateAdmin() {
  if (!$('#adminPanel').classList.contains('open') || (admAcc = (admAcc + 1) % 15)) return;
  const p = phaseAt(nowMs()), left = Math.ceil((1 - p.p) * 20);
  $('#admState').textContent = `현재: ${PHASE_LABEL[ph.phase]}${clock.override ? ' (고정)' : ''} · 자동 위상 ${PHASE_LABEL[p.phase]} ${Math.round(p.p * 100)}% · 다음까지 약 ${left}분 · ${clock.paused ? '일시정지' : '순환 중'}`;
  $('#admPause').textContent = clock.paused ? '자동 순환 재개' : '자동 순환 일시정지';
}
$('#btnExit').onclick = () => toast('프로토타입이라 나가기는 아직 없어요');

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
  guardian.animate(time, walking, rest.on);
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
  dog.animate(time, dogState);
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
    const p = dog.root.position.clone(); p.y += 1.25; p.project(camera);
    const b = $('#bubble'); const bw = b.offsetWidth || 0; b.style.left = Math.min(innerWidth - bw / 2 - 8, Math.max(bw / 2 + 8, (p.x * .5 + .5) * innerWidth)) + 'px'; b.style.top = (-p.y * .5 + .5) * innerHeight + 'px';
    if (bubbleT <= 0) b.classList.add('hidden');
  }
  renderer.render(scene, camera);
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
async function switchMap(id) {
  if (switching || id === curMap || !mapById(id)) { closeMapMenu(); return false; }
  switching = true; closeMapMenu(); savePos();
  const fade = $('#mapFade'); fade.querySelector('b').textContent = mapById(id).name; fade.querySelector('small').textContent = '맵 불러오는 중…'; fade.classList.add('on');
  await new Promise(r => setTimeout(r, 380)); // 페이드 인
  try {
    if (rest.on) stopRest();
    const w = await getWorld(id, scene);
    world = w; curMap = id; setActive(w); LSm.set('bw.map', id); setTitle();
    const sp = savedPos(id); const s0 = sp && w.isWalkable(sp.x, sp.z) ? sp : w.start;
    guardian.root.position.set(s0.x, heightAt(s0.x, s0.z), s0.z); guardian.root.rotation.y = s0.rot;
    dog.root.position.set(s0.x - Math.sin(s0.rot) * .9, heightAt(s0.x, s0.z), s0.z - Math.cos(s0.rot) * .9); dog.root.rotation.y = s0.rot;
    camTarget.copy(guardian.root.position); yaw = s0.rot - Math.PI; moveTarget = null; if (marker) marker.visible = false;
    applyTime(cur, { scene, hemi, sun, renderer, world }); // 시간 위상·사운드는 그대로 이어짐
    sound.setNear(world.waterNear(s0.x, s0.z));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    toast(`${mapById(id).name}에 도착했어요`);
  } catch (e) { console.warn('맵 이동 실패', e); fade.querySelector('small').textContent = '불러오기 실패'; await new Promise(r => setTimeout(r, 900)); }
  fade.classList.remove('on'); switching = false; return true;
}
const mapMenu = $('#mapMenu');
function renderMapMenu() { mapMenu.querySelector('.list').innerHTML = MAPS.map(m => `<button data-map="${m.id}" class="${m.id === curMap ? 'cur' : ''}"><span class="no">${m.sub}</span><span class="nm">${m.name}<small>${m.desc}</small></span>${m.id === curMap ? '<em>현재</em>' : ''}</button>`).join(''); }
function openMapMenu() { renderMapMenu(); mapMenu.classList.add('open'); }
function closeMapMenu() { mapMenu.classList.remove('open'); }
$('#srv').addEventListener('click', e => { e.stopPropagation(); mapMenu.classList.contains('open') ? closeMapMenu() : openMapMenu(); });
mapMenu.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-map]'); if (b) switchMap(b.dataset.map); });
mapMenu.addEventListener('pointerdown', e => e.stopPropagation());
addEventListener('pointerdown', e => { if (mapMenu.classList.contains('open') && !e.target.closest('#mapMenu,#srv')) closeMapMenu(); });
const mapView = initMapView({ maps: MAPS, getCur: () => curMap, getMe: () => ({ x: guardian.root.position.x, z: guardian.root.position.z, rot: guardian.root.rotation.y }) });
window.__game = { mapView, openMapMenu, switchMap,  sound, breedsGrid, lineup, setTime: k => setTime(k, true), say, startRest, stopRest, openDogModal, swapDog, get rest() { return rest.on; }, test: { setPos: (x, z, r) => { guardian.root.position.set(x, heightAt(x, z), z); dog.root.position.set(x + .8, heightAt(x + .8, z + .8), z + .8); if (r !== undefined) yaw = r; }, setYaw: v => { yaw = v; }, setCam: (y, p, d) => { yaw = y; pitch = p; dist = d; }, getCam: () => [yaw, pitch, dist], get dog() { return dog.root; }, guardian: guardian.root, moveChar, get isWalkable() { return isWalkable; }, get heightAt() { return heightAt; }, get world() { return world; }, switchMap: id => switchMap(id), get map() { return curMap; } } }; // test: tools/walktest.mjs 용

setLoad(100);
frame();
setTimeout(() => { $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 700); say(`나 · ${dogName}`, 3); if (!LS.get('bw.breed') && !_q0.has('nomodal')) openDogModal(); }, 400);
