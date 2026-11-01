// 부산 산책 | 북항 친수공원 — 프로토타입
// 모든 모델/텍스처/사운드는 Three.js 기본 도형과 절차 생성으로 직접 제작. (외부 에셋 없음)
// 월드 배치는 실제 지도가 아니라 상상 구성(연출)이다. 요소 목록만 디자이너 전달 자료 기준.
import * as THREE from 'three';
import { buildWorld, isWalkable, heightAt, S as MAP_SCALE } from './world.js';
import { makeGuardian, makeDog } from './characters.js';
import { TIMES, applyTime } from './times.js';
import { WaterSound } from './sound.js';

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
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2500);

const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
scene.add(hemi, sun, sun.target);

setLoad(30);
const world = buildWorld(scene);
setLoad(70);

const guardian = makeGuardian(); scene.add(guardian.root);
const dog = makeDog(); scene.add(dog.root);
// 캐릭터 보조 라이트(약하게, 밤에도 칙칙하지 않게)
const charFill = new THREE.PointLight(0xffe2c0, 1.2, 6, 1.5); scene.add(charFill);
const start = new THREE.Vector3(world.start.x, 0, world.start.z); // 남서 입구 근처 보행로(OSM)
guardian.root.position.copy(start);
guardian.root.rotation.y = world.start.rot; // 북동쪽(수로 방향)
dog.root.position.set(start.x + Math.cos(world.start.rot) * -0.9, 0, start.z - Math.sin(world.start.rot) * -0.9);
dog.root.rotation.y = world.start.rot; // 시작 시 보호자와 같은 방향

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

// ---------- 시간대 ----------
const order = ['dusk', 'night', 'dawn'];
let timeIdx = 0;
let cur = JSON.parse(JSON.stringify(TIMES.dusk)), target = TIMES.dusk, blendT = 1, from = cur;
applyTime(cur, { scene, hemi, sun, renderer, world });
function setTime(key, instant) {
  from = JSON.parse(JSON.stringify(cur)); target = TIMES[key]; blendT = instant ? 0.999 : 0;
  $('#btnTime').textContent = TIMES[key].label;
}
$('#btnTime').onclick = () => { timeIdx = (timeIdx + 1) % 3; setTime(order[timeIdx]); };
function lerpTime(a, b, t) {
  const o = {};
  for (const k in b) {
    if (typeof b[k] === 'number') o[k] = a[k] + (b[k] - a[k]) * t;
    else if (typeof b[k] === 'string' && b[k][0] === '#') o[k] = '#' + new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t).getHexString();
    else o[k] = b[k];
  }
  return o;
}

// ---------- 카메라 ----------
const _q = new URLSearchParams(location.search);
let yaw = world.start.rot - Math.PI + +(_q.get('yaw') || 0), pitch = 0.3, dist = 4.2; // 캐릭터가 화면 높이 약 1/3 (디버그: ?yaw=3.14 앞모습)
const camTarget = new THREE.Vector3().copy(start);
const TOP = _q.get('view') === 'top'; if (TOP) document.body.classList.add('topview'); // 디버그: 위에서 본 지도 컷(북쪽이 화면 위)
function updateCamera(dt) {
  if (TOP) { world.topPreview(); hemi.color.set(0xffffff); hemi.groundColor.set(0x8a9a70); hemi.intensity = 2.2; sun.color.set(0xffffff); sun.intensity = 2.2; renderer.toneMappingExposure = 1.05; const cx = 100 * MAP_SCALE, cz = -90 * MAP_SCALE; camera.up.set(0, 0, -1); camera.position.set(cx, 720, cz + 0.01); camera.lookAt(cx, 0, cz); scene.fog.near = 1e5; scene.fog.far = 1e6; return; }
  camTarget.lerp(guardian.root.position, 1 - Math.exp(-dt * 6));
  const t = camTarget.clone(); t.y += 0.6;
  camera.position.set(
    t.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    t.y + Math.sin(pitch) * dist,
    t.z + Math.cos(yaw) * Math.cos(pitch) * dist);
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
});
function takePhoto() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = `busan-walk-${Date.now()}.png`; a.click();
  $('#flash').style.transition = 'none'; $('#flash').style.opacity = 1;
  requestAnimationFrame(() => { $('#flash').style.transition = 'opacity .5s'; $('#flash').style.opacity = 0; });
  say('찰칵! 예쁘게 나왔나요?');
}
const sound = new WaterSound();
$('#btnSound').onclick = () => { const on = sound.toggle(); $('#btnSound').textContent = on ? '🔊' : '🔇'; toast(on ? '잔잔한 물소리(직접 합성) 켜짐' : '소리 끔'); };
$('#btnSet').onclick = () => toast('설정은 준비 중이에요');
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
  if (blendT < 1) { blendT = Math.min(1, blendT + dt / 2.5); cur = lerpTime(from, target, blendT); applyTime(cur, { scene, hemi, sun, renderer, world }); }
  // 보호자 이동
  const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const kz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  let walking = false; const g = guardian.root;
  if (kx || kz) {
    moveTarget = null; marker.visible = false;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = r.multiplyScalar(kx).add(f.multiplyScalar(-kz)).normalize();
    walking = moveChar(g, dir, 4.5, dt); // 축척 0.4 월드에 맞춰 속도 상향
  } else if (moveTarget) {
    tmp.subVectors(moveTarget, g.position); tmp.y = 0;
    const d = tmp.length();
    if (d < 0.15) { moveTarget = null; marker.visible = false; }
    else { walking = moveChar(g, tmp.normalize(), 4.5, dt); if (!walking) { moveTarget = null; marker.visible = false; } }
  }
  guardian.animate(time, walking);
  marker.rotation.z += dt;
  // 강아지: 목줄 길이 안에서 보호자 옆을 따라감, 멀어지면 달려옴
  const dp = dog.root.position;
  const side = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y)).multiplyScalar(-0.9);
  dogTarget.copy(g.position).add(side).add(new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)).multiplyScalar(.3));
  tmp.subVectors(dogTarget, dp); tmp.y = 0;
  const dd = tmp.length(), gd = dp.distanceTo(g.position);
  let dogState = 'idle';
  if (dogAction === 'sit') dogState = 'sit';
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
    const b = $('#bubble'); b.style.left = (p.x * .5 + .5) * innerWidth + 'px'; b.style.top = (-p.y * .5 + .5) * innerHeight + 'px';
    if (bubbleT <= 0) b.classList.add('hidden');
  }
  renderer.render(scene, camera);
  window.__perf.frames++; window.__perf.total += performance.now() - t0;
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// 테스트/스크린샷용 훅
window.__game = { setTime: k => { timeIdx = order.indexOf(k); setTime(k, true); }, say, test: { setPos: (x, z, r) => { guardian.root.position.set(x, 0, z); dog.root.position.set(x + .8, 0, z + .8); if (r !== undefined) yaw = r; }, setYaw: v => { yaw = v; }, setCam: (y, p, d) => { yaw = y; pitch = p; dist = d; }, getCam: () => [yaw, pitch, dist], dog: dog.root, guardian: guardian.root, moveChar, isWalkable, heightAt, world } }; // test: tools/walktest.mjs 용

setLoad(100);
frame();
setTimeout(() => { $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 700); say('나 · 바다', 3); }, 400);
