// 북항 친수공원 월드 — OpenStreetMap 실측 데이터 기반 (data/bukhang.json, tools/build_world.py 로 생성)
// Map data © OpenStreetMap contributors (ODbL 1.0)
// 좌표: 공원 중심(35.108897N, 129.044595E) 기준 로컬 미터(+x 동, +y 북) → 월드 X = x*S, Z = -y*S (북쪽 = -Z)
// 스케일 S = 0.3 : 실제 약 1,300m × 640m 공원을 약 390 × 192 월드 단위로 줄임(캐릭터는 실물 크기 유지). 상대 배치·모양은 데이터 그대로.
// 데이터: 공원 경계·경관수로·보행로·잔디·다리 윤곽·도로·건물 윤곽·해안선(육지 판정)·일부 나무 점.
// 연출(데이터에 없음): 건물 높이·색, 다리 높이·난간 디테일, 나무 대부분, 가로등, 팜파스, 먼 대교·섬 실루엣, 수로, 물고기·상어·항만 크레인·정박선 경관조명, 지형 평탄.
import * as THREE from 'three';
export const S = 0.3;
const DATA = await (await fetch('data/bukhang.json')).json();
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, ...o });
const V2 = ([x, y]) => new THREE.Vector2(x * S, y * S);
const W = ([x, y]) => [x * S, -y * S]; // 월드 X,Z

// ---- 걷기 가능 영역: 캔버스 래스터(R px / 월드 단위). R=walk, G=다리 ----
const parkPts = DATA.park[0][0].map(W);
const B = { x0: Math.min(...parkPts.map(p => p[0])) - 6, x1: Math.max(...parkPts.map(p => p[0])) + 6, z0: Math.min(...parkPts.map(p => p[1])) - 6, z1: Math.max(...parkPts.map(p => p[1])) + 6 };
const R = 2, GW = Math.ceil((B.x1 - B.x0) * R), GH = Math.ceil((B.z1 - B.z0) * R);
// 시작 지점 앞 바다 시야를 가리던 OSM 건물 way 1431516584 '부산항 북항마리나'(building=yes, leisure=marina, 높이 데이터 없음).
// 건물 덩어리 대신 낮은 반투명 유리 데크(연출)로 바꾸고 아래에 물·물고기를 둠. 윤곽만 OSM.
const GLASS_IDX = DATA.buildings.findIndex(b => b.p.some(([x, y]) => Math.abs(x - .5) < .6 && Math.abs(y + 336.5) < .6));
const GLASS_POLY = GLASS_IDX >= 0 ? DATA.buildings[GLASS_IDX].p : [];
export const GLASS_LINK = [-29, 68.6, -24.6, 71.6]; // 공원 보행로 → 유리 데크 연결 경사로(월드 좌표, 연출: OSM상 1.8m 틈을 메움)
const grid = (() => {
  const c = document.createElement('canvas'); c.width = GW; c.height = GH; const g = c.getContext('2d');
  const tp = p => { const [x, z] = W(p); return [(x - B.x0) * R, (z - B.z0) * R]; };
  const fillRings = (rings, col) => { g.fillStyle = col; g.beginPath(); for (const r of rings) { r.forEach((p, i) => { const [a, b] = tp(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); } g.fill('evenodd'); };
  for (const p of DATA.park) fillRings(p, '#f00');
  for (const p of DATA.canal) fillRings(p, '#000'); // 수로는 걸을 수 없음
  g.strokeStyle = '#000'; g.lineWidth = 1.0 * R; for (const p of DATA.canal) for (const r of p) { g.beginPath(); r.forEach((q, i) => { const [a, b] = tp(q); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.stroke(); } // 수로 가장자리(래스터 오차) 여유
  for (const b of DATA.bridges) fillRings([b.poly], '#ff0'); // 다리로만 건넘
  g.strokeStyle = '#ff0'; g.lineCap = 'round';
  for (const b of DATA.bridgeLines) { g.lineWidth = (b.w * S + .8) * R; g.beginPath(); b.p.forEach((p, i) => { const [a, bb] = tp(p); i ? g.lineTo(a, bb) : g.moveTo(a, bb); }); g.stroke(); }
  // 바다·공원 밖은 막음: 공원 경계 밖 다리 픽셀 제거
  g.globalCompositeOperation = 'destination-in'; for (const p of DATA.park) fillRings(p, '#fff');
  g.globalCompositeOperation = 'source-over'; fillRings([GLASS_POLY], '#f0f');
  if (GLASS_POLY.length) { g.strokeStyle = '#f00'; g.lineWidth = 3 * R; g.lineCap = 'round'; g.beginPath(); g.moveTo((GLASS_LINK[0] - B.x0) * R, (GLASS_LINK[1] - B.z0) * R); g.lineTo((GLASS_LINK[2] - B.x0) * R, (GLASS_LINK[3] - B.z0) * R); g.stroke(); fillRings([GLASS_POLY], '#f0f'); } // 공원↔데크 연결 경사로(연출) // 유리 데크(북항마리나 자리, 연출): 걷기 가능(R) + 유리(B)
  return g.getImageData(0, 0, GW, GH).data;
})();
function cell(x, z) { const i = Math.floor((x - B.x0) * R), j = Math.floor((z - B.z0) * R); if (i < 0 || j < 0 || i >= GW || j >= GH) return -1; return (j * GW + i) * 4; }
export function isWalkable(x, z) { const k = cell(x, z); return k >= 0 && grid[k] > 128 && grid[k + 3] > 128; }
const onBridge = (x, z) => { const k = cell(x, z); return k >= 0 && grid[k + 1] > 128 && grid[k + 3] > 128; };
export const BRIDGE_H = 0.3;
const onGlass = (x, z) => { const k = cell(x, z); return k >= 0 && grid[k + 2] > 128 && grid[k + 3] > 128 && grid[k + 1] < 128; };
export const GLASS_H = 0.35;
export function heightAt(x, z) { return onBridge(x, z) ? BRIDGE_H : onGlass(x, z) ? GLASS_H : 0; }
export { onGlass };

// ---- 기하 도우미 ----
function shapes(polys) { return polys.map(([o, ...holes]) => { const s = new THREE.Shape(o.map(V2)); holes.forEach(h => s.holes.push(new THREE.Path(h.map(V2)))); return s; }); }
function flat(polys, y) { const g = new THREE.ShapeGeometry(shapes(polys)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }
// 폴리라인들을 하나의 리본 지오메트리로(세그먼트 사각형 + 관절 원판)
function ribbons(list, y, uvScale = .25) {
  const pos = [], uv = [], idx = [];
  const push = (x, z, u, v) => { pos.push(x, y, z); uv.push(u, v); return pos.length / 3 - 1; };
  for (const { p, w } of list) {
    const hw = w / 2; let acc = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = W(p[i]), [bx, bz] = W(p[i + 1]); const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 1e-3) continue;
      const nx = -dz / L * hw, nz = dx / L * hw;
      const a = push(ax + nx, az + nz, 0, acc * uvScale), b = push(ax - nx, az - nz, 1, acc * uvScale);
      acc += L; const c = push(bx + nx, bz + nz, 0, acc * uvScale), d = push(bx - nx, bz - nz, 1, acc * uvScale);
      idx.push(a, c, b, b, c, d); // 위(+Y)를 향하도록
      // 관절 채움(8각 원판)
      const ctr = push(bx, bz, .5, acc * uvScale);
      for (let k = 0; k < 8; k++) { const t0 = k / 8 * 6.283, t1 = (k + 1) / 8 * 6.283; const e = push(bx + Math.cos(t0) * hw, bz + Math.sin(t0) * hw, .5 + Math.cos(t0) * .5, (acc + Math.sin(t0) * hw) * uvScale), f = push(bx + Math.cos(t1) * hw, bz + Math.sin(t1) * hw, .5 + Math.cos(t1) * .5, (acc + Math.sin(t1) * hw) * uvScale); idx.push(ctr, f, e); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function label(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.78)'; g.beginPath(); g.roundRect(8, 16, 496, 96, 48); g.fill();
  g.fillStyle = '#3a3330'; g.textAlign = 'center'; g.font = 'bold 44px sans-serif'; g.fillText(text, 256, sub ? 64 : 80);
  if (sub) { g.font = '26px sans-serif'; g.fillStyle = '#7a6a60'; g.fillText(sub, 256, 98); }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(8, 2, 1); sp.renderOrder = 10; return sp;
}

// 시작 위치: 남서 입구(다리 ① 부근, 실측 약 (-215,-345)m) 가장 가까운 보행로 위 점
let START_ROT = 1.3;
function findStart() {
  const tx = -215 * S, tz = 345 * S; let best = null;
  for (const { p } of DATA.paths) for (const q of p) { const [x, z] = W(q); const d = Math.hypot(x - tx, z - tz); if (isWalkable(x, z) && !onBridge(x, z) && (!best || d < best.d)) best = { x, z, d }; }
  return { x: best.x, z: best.z, rot: START_ROT }; // 북항대교가 화면 한쪽에 보이는 방향
}

export const __test = { onBridge: (x, z) => onBridge(x, z) };
export function buildWorld(scene) {
  const walkMeshes = [], lamps = [], emissives = { lamp: [], city: [], deco: [] };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mtx = new THREE.Matrix4();

  // 하늘 돔 (그라디언트 + 해) — 카메라를 따라감
  const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunVis: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vp; void main(){ vp=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,bot,sunDir; uniform float sunVis; varying vec3 vp;
      void main(){ float h=clamp(vp.y*2.2,0.,1.); vec3 c=mix(bot,top,pow(h,.7));
      float s=max(dot(vp,normalize(sunDir)),0.); c+=sunVis*(vec3(1.,.8,.55)*pow(s,600.)*1.5+vec3(1.,.6,.4)*pow(s,3.)*.75+vec3(1.,.45,.3)*pow(1.-abs(vp.y),6.)*.25*sunVis);
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder = -1; scene.add(sky);
  const starG = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().setFromSphericalCoords(850, Math.acos(rnd() * .9), rnd() * 6.28); sp.push(v.x, v.y, v.z); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, fog: false }));
  sky.add(stars);
  // 별 2층(깜빡임 위상 다름) + 달(구체 + 캔버스 글로우) — 직접 제작
  const starG2 = new THREE.BufferGeometry(), sp2 = [];
  for (let i = 0; i < 350; i++) { const v = new THREE.Vector3().setFromSphericalCoords(845, Math.acos(rnd() * .92), rnd() * 6.28); sp2.push(v.x, v.y, v.z); }
  starG2.setAttribute('position', new THREE.Float32BufferAttribute(sp2, 3));
  const stars2 = new THREE.Points(starG2, new THREE.PointsMaterial({ color: 0xfff4dc, size: 2.2, sizeAttenuation: false, transparent: true, fog: false })); sky.add(stars2);
  const moon = new THREE.Group(); moon.position.setFromSphericalCoords(780, 1.27, 1.6); sky.add(moon);
  const moonM = new THREE.MeshBasicMaterial({ color: 0xf6f0d8, transparent: true, fog: false });
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), moonM));
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; { const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,248,220,.9)'); gr.addColorStop(.35, 'rgba(255,240,200,.25)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128); }
  const glowM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const moonGlow = new THREE.Sprite(glowM); moonGlow.scale.setScalar(140); moon.add(moonGlow);
  let starBase = 0;

  // 바다 (해안선 밖 = 육지 폴리곤 밖)
  const waterTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(200,225,240,.5)'; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 16, 1.5, 0, 0, 6.28); c.fill(); } }, [1, 1]);
  const seaTex = waterTex.clone(); seaTex.repeat.set(120, 120);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), M(0x24406a, { roughness: .25, metalness: .1, map: seaTex }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.9; scene.add(sea);

  // 공원 밖 육지(도시 바닥) + 안벽
  const urbanTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ddd5ca'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = `hsl(32,${6 + rnd() * 6}%,${79 + rnd() * 7}%)`; c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(150,135,120,${rnd() * .12})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); } }, [1, 1]);
  const paveMatO = M(0xffffff, { map: urbanTex, roughness: .95 });
  const outerG = flat(DATA.outerGround, -0.02); planarUV(outerG, .08);
  const outer = new THREE.Mesh(outerG, paveMatO); outer.receiveShadow = true; scene.add(outer); walkMeshes.push(outer);

  // 공원 바닥(잔디)
  const grassTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#97ad6c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const g2 = c.createRadialGradient(0, 0, 0, 0, 0, 1); const x = rnd() * w, y = rnd() * h, r = 15 + rnd() * 35; c.fillStyle = `hsla(${70 + rnd() * 30},${22 + rnd() * 12}%,${36 + rnd() * 14}%,.35)`; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill(); } // 얼룩(색 변화)
    for (let i = 0; i < 2600; i++) { c.strokeStyle = `hsl(${72 + rnd() * 30},${22 + rnd() * 16}%,${34 + rnd() * 26}%)`; c.lineWidth = 1; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - .5) * 3, y - 2 - rnd() * 4); c.stroke(); } // 풀잎
    for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h; c.fillStyle = `hsl(${95 + rnd() * 15},${26 + rnd() * 10}%,${42 + rnd() * 10}%)`; for (let k = 0; k < 3; k++) { const a = k * 2.094 + rnd(); c.beginPath(); c.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 2.2, 0, 6.28); c.fill(); } } // 클로버
  }, [1, 1]);
  const parkG = flat(DATA.parkGround, 0); planarUV(parkG, .12);
  const park = new THREE.Mesh(parkG, M(0xe4e6c8, { map: grassTex })); park.receiveShadow = true; scene.add(park); walkMeshes.push(park);
  // OSM 잔디 블록(더 밝은 잔디)
  const greenG = flat(DATA.green, 0.015); planarUV(greenG, .12);
  const green = new THREE.Mesh(greenG, M(0xf0ecd0, { map: grassTex, polygonOffset: true, polygonOffsetFactor: -1 })); green.receiveShadow = true; scene.add(green);
  // 측벽: 육지 가장자리를 아래로 내린 벽(해안 안벽·수로 벽)
  const wallMat = M(0xb9ab9c, { side: THREE.DoubleSide });
  const edgeRings = [...DATA.parkGround, ...DATA.outerGround].flat();
  scene.add(new THREE.Mesh(walls(edgeRings, 0, -1.0), wallMat));

  // 도로(회색) — 폭은 도로 등급별 추정값
  const walkSide = new THREE.Mesh(ribbons(DATA.roads.map(r => ({ p: r.p, w: r.w * S + 2.4 })), 0.012), M(0xcbbfb2, { roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 })); walkSide.receiveShadow = true; scene.add(walkSide); // 보도(약하게)
  const laneTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#9a9796'; c.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(80,80,80,${rnd() * .15})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
    c.fillStyle = 'rgba(240,235,220,.45)'; c.fillRect(31, 0, 2, 128); c.fillStyle = 'rgba(240,235,220,.35)'; c.fillRect(3, 0, 1.5, h); c.fillRect(w - 4.5, 0, 1.5, h); });
  const roadMat = M(0xffffff, { map: laneTex, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 });
  const road = new THREE.Mesh(ribbons(DATA.roads.map(r => ({ p: r.p, w: r.w * S })), 0.02, .05), roadMat); road.receiveShadow = true; scene.add(road);

  // 보행로(석재 포장) — 실측 선형, 폭은 등급별 추정
  const paveTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#9c7a68'; c.fillRect(0, 0, w, h); // 줄눈
    for (let y = 0; y < 16; y++) for (let x = -1; x < 9; x++) { const off = (y % 2) * 16; c.fillStyle = `hsl(${12 + rnd() * 10},${30 + rnd() * 14}%,${52 + rnd() * 12}%)`; c.fillRect(x * 32 + off + 1.5, y * 16 + 1.5, 29, 13); }
    for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(60,40,30,${rnd() * .12})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }, [1, 1]);
  const pathList = DATA.paths.filter(p => !p.b).map(p => ({ p: p.p, w: Math.max(2.2, p.w * S) }));
  const pcurb = new THREE.Mesh(ribbons(pathList.map(p => ({ p: p.p, w: p.w + .45 })), 0.05), M(0xe2d8ca, { roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 })); pcurb.receiveShadow = true; scene.add(pcurb); // 화강석 연석
  const paths = new THREE.Mesh(ribbons(pathList, 0.065, .25), M(0xffffff, { map: paveTex, roughness: .9, polygonOffset: true, polygonOffsetFactor: -3 }));
  paths.receiveShadow = true; scene.add(paths); walkMeshes.push(paths);

  // 경관수로(실측 폴리곤)
  const canalBed = flat(DATA.canal, -0.6); scene.add(new THREE.Mesh(canalBed, M(0xc9dcc0, { roughness: 1 }))); // 얕은 바닥(밝은 모래·돌)
  const waterMat = M(0x6fd3c8, { roughness: .45, metalness: 0, map: waterTex, transparent: true, opacity: .55, emissive: 0x1d5e5a, emissiveIntensity: .6, depthWrite: false });
  const canalG = flat(DATA.canal, -0.28); planarUV(canalG, .15);
  scene.add(new THREE.Mesh(canalG, waterMat));
  // 윤슬(물결 반짝임): 가산 혼합 반짝 점 텍스처를 흘림
  const glintTex = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 120; i++) { const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 3; const gr = c.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, r * 3, r, 0, 0, 6.28); c.fill(); } });
  glintTex.colorSpace = THREE.NoColorSpace;
  const glintMat = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8, color: 0xffe6c0 });
  const glintG = flat(DATA.canal, -0.26); planarUV(glintG, .22); scene.add(new THREE.Mesh(glintG, glintMat));
  // 수로 테두리 + 밤 경관조명 라인(연출)
  const canalRings = DATA.canal.flat();
  const stoneTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#9a948a'; c.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) { c.fillStyle = `hsl(35,${6 + rnd() * 6}%,${70 + rnd() * 12}%)`; c.fillRect(2, y * 32 + 2, w - 4, 28); } });
  const curb = new THREE.Mesh(ribbons(canalRings.map(r => ({ p: [...r, r[0]], w: 1.1 })), 0.08, .12), M(0xffffff, { map: stoneTex, roughness: .8 })); curb.receiveShadow = true; scene.add(curb); // 돌 연석
  // 얕은 경사(돌 계단식 가장자리, 물 아래로 내려감)
  const slope = []; for (const r of canalRings) for (let i = 0; i < r.length; i++) { const [ax, az] = W(r[i]), [bx, bz] = W(r[(i + 1) % r.length]); const L = Math.hypot(bx - ax, bz - az); if (L < .01) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (const sg of [1, -1]) { const o = 1.6 * sg; slope.push(ax, .02, az, bx, .02, bz, ax + nx * o, -.45, az + nz * o, bx, .02, bz, bx + nx * o, -.45, bz + nz * o, ax + nx * o, -.45, az + nz * o); } }
  const slG = new THREE.BufferGeometry(); slG.setAttribute('position', new THREE.Float32BufferAttribute(slope, 3)); slG.computeVertexNormals();
  scene.add(new THREE.Mesh(slG, M(0xa8a196, { side: THREE.DoubleSide, roughness: .9 })));
  const glow = new THREE.Mesh(ribbons(canalRings.map(r => ({ p: [...r, r[0]], w: .12 })), 0.09), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffc070 }));
  scene.add(glow); emissives.deco.push(glow.material);
  // 수로 라벨(위치 확실)
  const cl = DATA.canalLine[0], mid = W(cl[Math.floor(cl.length * .35)]);
  const canalLbl = label('경관수로', 'OSM 실측 위치'); canalLbl.position.set(mid[0], 4, mid[1]); scene.add(canalLbl);
  const hillLbl = label('조망언덕 · 야생화단지', '위치 추정(연출)'); const hp = W([230, 280]); hillLbl.position.set(hp[0], 5, hp[1]); scene.add(hillLbl);

  // 다리: 윤곽은 OSM, 높이·난간은 연출
  const bridgeMat = M(0xe7dfd4, { roughness: .7 });
  const bpolys = DATA.bridges.map(b => [b.poly]);
  const bG = new THREE.ExtrudeGeometry(shapes(bpolys), { depth: .25, bevelEnabled: false }); bG.rotateX(-Math.PI / 2); bG.translate(0, BRIDGE_H - .25, 0);
  const bMesh = new THREE.Mesh(bG, bridgeMat); bMesh.castShadow = bMesh.receiveShadow = true; scene.add(bMesh); walkMeshes.push(bMesh);
  const blG = ribbons(DATA.bridgeLines.map(b => ({ p: b.p, w: Math.max(1.6, b.w * S) })), BRIDGE_H + .02);
  const bl = new THREE.Mesh(blG, bridgeMat); bl.receiveShadow = true; scene.add(bl); walkMeshes.push(bl);
  const bpaveTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#d9cbb6'; c.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { c.fillStyle = `hsl(${30 + rnd() * 10},${18 + rnd() * 10}%,${72 + rnd() * 10}%)`; c.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); } }, [1, 1]);
  bridgeMat.map = bpaveTex; planarUV(bG, .45); planarUV(blG, .45);

  // 건물: 윤곽 OSM, 높이·색은 연출(높이 데이터 없음) — 높이 구간별 4개 메쉬로 병합
  const buckets = [[], [], [], []];
  for (const [bi, b] of DATA.buildings.entries()) { if (bi === GLASS_IDX) continue;
    const xs = b.p.map(p => p[0]), ys = b.p.map(p => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    const k = area < 700 ? 0 : area < 3000 ? 1 : area < 12000 ? 2 : 3;
    buckets[k].push([b.p]);
  }
  const bh = [4, 7, 11, 15].map(h => h * S), bcol = [0xdcd0c2, 0xd4cabf, 0xccc5be, 0xc6c1bc]; // 높이 연출(낮게, 배경 톤)
  const bMats = [];
  buckets.forEach((list, k) => {
    if (!list.length) return;
    const g = new THREE.ExtrudeGeometry(shapes(list), { depth: bh[k], bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = M(bcol[k], { roughness: .95 }); bMats.push(m);
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  });
  // 창문 불빛(연출): 큰 건물 상부 발광 띠
  const winMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd9a0 }); emissives.city.push(winMat);
  const winG = new THREE.ExtrudeGeometry(shapes([...buckets[2], ...buckets[3]]), { depth: .5, bevelEnabled: false }); winG.rotateX(-Math.PI / 2); winG.scale(1.002, 1, 1.002); winG.translate(0, bh[2] * .55, 0);
  scene.add(new THREE.Mesh(winG, winMat));

  // 유리 데크(연출): OSM 북항마리나 윤곽 위에 낮은 반투명 유리 바닥 + 아래 물·물고기
  const glassFish = { update() {} };
  if (GLASS_POLY.length) {
    const gpoly = [[GLASS_POLY]];
    { const [ax, az, bx, bz] = GLASS_LINK, L = Math.hypot(bx - ax, bz - az) + 1.5; const rp = new THREE.Mesh(new THREE.BoxGeometry(3, .12, L), M(0xd9c7a8, { roughness: .8 })); rp.position.set((ax + bx) / 2, .17, (az + bz) / 2); rp.rotation.y = Math.atan2(bx - ax, bz - az); rp.receiveShadow = true; scene.add(rp); } // 연결 경사로(연출)
    const wM = M(0x2f86a8, { roughness: .2, emissive: 0x0c3a50, emissiveIntensity: .6 });
    const wMesh = new THREE.Mesh(flat(gpoly, .04), wM); scene.add(wMesh);
    const capM = new THREE.MeshStandardMaterial({ color: 0xcff0f6, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false });
    const rimM = M(0xc9c2b6, { roughness: .9 });
    const gG = new THREE.ExtrudeGeometry(shapes(gpoly), { depth: GLASS_H, bevelEnabled: false }); gG.rotateX(-Math.PI / 2);
    const gMesh = new THREE.Mesh(gG, [capM, rimM]); gMesh.renderOrder = 2; scene.add(gMesh);
    // 유리 패널 이음새: 3 간격 격자를 폴리곤 안쪽만
    const xs = GLASS_POLY.map(p => p[0] * S), zs = GLASS_POLY.map(p => -p[1] * S), pts = [];
    const inside = (x, z) => { let c = false; for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) if ((zs[i] > z) !== (zs[j] > z) && x < (xs[j] - xs[i]) * (z - zs[i]) / (zs[j] - zs[i]) + xs[i]) c = !c; return c; };
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    for (let x = x0; x < x1; x += 3) for (let z = z0; z < z1; z += .5) if (inside(x, z) && inside(x, z + .5)) pts.push(x, GLASS_H + .005, z, x, GLASS_H + .005, z + .5);
    for (let z = z0; z < z1; z += 3) for (let x = x0; x < x1; x += .5) if (inside(x, z) && inside(x + .5, z)) pts.push(x, GLASS_H + .005, z, x + .5, GLASS_H + .005, z);
    const seamG = new THREE.BufferGeometry(); seamG.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(seamG, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35 })));
    // 물고기: 데크 아래(물 위 0.08~0.25)를 천천히 맴돔
    const NF = 70, gf = [];
    for (let i = 0; i < NF * 20 && gf.length < NF; i++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0); if (inside(x, z)) gf.push({ x, z, r: .6 + rnd() * 1.6, w: (.3 + rnd() * .5) * (rnd() < .5 ? -1 : 1), ph: rnd() * 6.28, y: .1 + rnd() * .14, s: .1 + rnd() * .08 }); }
    const fb = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M(0xffffff, { roughness: .5 }), gf.length);
    const cols = [0xff9a3c, 0xffc06a, 0xf3e6c8, 0xe8705a, 0x8fd0e0];
    gf.forEach((f, i) => fb.setColorAt(i, new THREE.Color(cols[i % cols.length]))); scene.add(fb);
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    glassFish.update = t => { gf.forEach((f, i) => { const a = f.ph + t * f.w; ps.set(f.x + Math.cos(a) * f.r, f.y + Math.sin(t * 2 + f.ph) * .015, f.z + Math.sin(a) * f.r); q.setFromAxisAngle(up, -a + (f.w > 0 ? 0 : Math.PI)); sc.set(f.s * .55, f.s * .5, f.s * 1.4); mtx.compose(ps, q, sc); fb.setMatrixAt(i, mtx); }); fb.instanceMatrix.needsUpdate = true; };
  }

  // 나무: OSM 나무 점 + 보행로를 따라 연출 배치
  const treePts = DATA.trees.map(W);
  const lampPts = [], shrubPts = [];
  for (const { p, w } of DATA.paths.filter(p => !p.b && p.w >= 3)) {
    let acc = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = W(p[i]), [bx, bz] = W(p[i + 1]); const L = Math.hypot(bx - ax, bz - az); if (L < .01) continue;
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let d = (14 - acc % 14); d < L; d += 14) { const tree = rnd() < .38;
        const t = d / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, s = rnd() < .5 ? -1 : 1, off = w * S / 2 + 1.4 + rnd() * 1.5;
        const tx = x + nx * s * off, tz = z + nz * s * off;
        if (isWalkable(tx, tz) && !onBridge(tx, tz)) (tree ? treePts : shrubPts).push([tx, tz]);
        const lx = x - nx * s * (w * S / 2 + .7), lz = z - nz * s * (w * S / 2 + .7);
        if (rnd() < .6 && isWalkable(lx, lz) && !onBridge(lx, lz)) lampPts.push([lx, lz]);
      }
      acc += L;
    }
  }
  const NT = Math.min(treePts.length, 180); // 나무 수 축소(연출)
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .26, 2, 8).translate(0, 1, 0), M(0x7a5a3a), NT);
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 14, 10), M(0xffffff, { roughness: .95 }), NT * 2);
  const leafCols = [0x6f8f55, 0x86985c, 0x5d7d52, 0x9aa268].map(c => new THREE.Color(c));
  for (let i = 0; i < NT; i++) {
    const [x, z] = treePts[i], s = .5 + rnd() * 1.0; const lc = leafCols[Math.floor(rnd() * 4)]; leaves.setColorAt(i * 2, lc); leaves.setColorAt(i * 2 + 1, lc);
    mtx.makeScale(s, s, s).setPosition(x, 0, z); trunks.setMatrixAt(i, mtx);
    mtx.makeScale(s, s * .9, s).setPosition(x, 2.6 * s, z); leaves.setMatrixAt(i * 2, mtx);
    mtx.makeScale(s * .7, s * .65, s * .7).setPosition(x + .3, 3.8 * s, z - .2); leaves.setMatrixAt(i * 2 + 1, mtx);
  }
  trunks.castShadow = leaves.castShadow = true; scene.add(trunks, leaves);
  // 낮은 관목(연출)
  const NS = Math.min(shrubPts.length, 400);
  const shrubs = new THREE.InstancedMesh(new THREE.SphereGeometry(.7, 12, 8), M(0xffffff, { roughness: 1 }), NS);
  for (let i = 0; i < NS; i++) { const [x, z] = shrubPts[i], s = .6 + rnd() * .7; mtx.makeScale(s * 1.3, s * .6, s).setPosition(x, .2 * s, z); shrubs.setMatrixAt(i, mtx); shrubs.setColorAt(i, leafCols[Math.floor(rnd() * 4)].clone().multiplyScalar(.85)); }
  shrubs.castShadow = true; scene.add(shrubs);
  // 얇은 풀 포기(연출): 잔디가 평평해 보이지 않게 — 삼각 잎 3장 묶음을 흩뿌림
  const bladeG = new THREE.BufferGeometry(); { const v = []; for (let k = 0; k < 3; k++) { const a = k * 2.1, ca = Math.cos(a) * .06, sa = Math.sin(a) * .06, tx = Math.cos(a + .6) * .08, tz = Math.sin(a + .6) * .08; v.push(-ca, 0, -sa, ca, 0, sa, tx, .28 + k * .04, tz); } bladeG.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); bladeG.computeVertexNormals(); }
  const bladePts = []; { const pr = DATA.parkGround.map(p => p[0].map(W)); const xs = parkPts.map(p => p[0]), zs = parkPts.map(p => p[1]); for (let i = 0; i < 40000 && bladePts.length < 9000; i++) { const x = B.x0 + rnd() * (B.x1 - B.x0), z = B.z0 + rnd() * (B.z1 - B.z0); if (isWalkable(x, z) && !onBridge(x, z) && pr.some(r => inRing(r, x, z))) bladePts.push([x, z]); } }
  const blades = new THREE.InstancedMesh(bladeG, M(0x7d9a52, { side: THREE.DoubleSide, roughness: 1 }), bladePts.length);
  bladePts.forEach(([x, z], i) => { const s2 = .7 + rnd() * .8; mtx.makeRotationY(rnd() * 6.28).scale(new THREE.Vector3(s2, s2, s2)).setPosition(x, 0, z); blades.setMatrixAt(i, mtx); blades.setColorAt(i, new THREE.Color().setHSL(.22 + rnd() * .06, .3, .3 + rnd() * .15)); });
  scene.add(blades);
  // 야생화(연출): OSM 잔디 원 구역 안에 점점이
  const flowerPts = [], fcols = [0xf2c6d8, 0xfff0b8, 0xd9c6f0, 0xffffff, 0xf6b49a].map(c => new THREE.Color(c));
  for (const poly of DATA.green) { const ring = poly[0].map(W); const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const n = Math.min(500, (x1 - x0) * (z1 - z0) * .08); for (let i = 0; i < n; i++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0); if (inRing(ring, x, z) && isWalkable(x, z)) flowerPts.push([x, z]); } }
  const NF = Math.min(flowerPts.length, 4000);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), NF);
  for (let i = 0; i < NF; i++) { const [x, z] = flowerPts[i]; mtx.makeTranslation(x, .12 + rnd() * .1, z); flowers.setMatrixAt(i, mtx); flowers.setColorAt(i, fcols[Math.floor(rnd() * 5)]); }
  scene.add(flowers);

  // 팜파스(공식 자료의 경관 요소, 정확한 위치는 연출): 산책로 옆 군락. 부드러운 깃털 이삭(가는 방추형 + 반투명)
  const plumeProfile = []; for (let i = 0; i <= 12; i++) { const t = i / 12; plumeProfile.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, .8)) * .16 * (1 - t * .3), t * 1.1)); }
  const plumeGeo = new THREE.LatheGeometry(plumeProfile, 10); plumeGeo.translate(0, -.1, 0);
  const stemGeo = new THREE.CylinderGeometry(.008, .012, 1, 4).translate(0, .5, 0);
  const tuftGeo = new THREE.ConeGeometry(.35, .7, 7, 1, true).translate(0, .35, 0);
  const plumeData = [], tuftPts = [];
  for (const { p, w } of DATA.paths.filter(p => !p.b && p.w >= 3)) for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = W(p[i]), [bx, bz] = W(p[i + 1]); const L = Math.hypot(bx - ax, bz - az); if (L < .01) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = rnd() * 6; d < L; d += 5 + rnd() * 6) { if (rnd() > .45) continue; const sg = rnd() < .5 ? -1 : 1, off = Math.max(2.2, w * S) / 2 + .8 + rnd() * .8;
      const cx = ax + (bx - ax) * d / L + nx * sg * off, cz = az + (bz - az) * d / L + nz * sg * off; if (!isWalkable(cx, cz) || onBridge(cx, cz)) continue;
      tuftPts.push([cx, cz]); for (let k = 0; k < 5; k++) plumeData.push({ x: cx + (rnd() - .5) * .5, z: cz + (rnd() - .5) * .5, lean: (rnd() - .5) * .5, ph: rnd() * 6, h: 1 + rnd() * .5 }); }
  }
  plumeData.length = Math.min(plumeData.length, 2500); tuftPts.length = Math.min(tuftPts.length, 500);
  const plumes = new THREE.InstancedMesh(plumeGeo, new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 1, transparent: true, opacity: .85, emissive: 0x3a2a18 }), plumeData.length), stems = new THREE.InstancedMesh(stemGeo, M(0xb8a878), plumeData.length);
  const tufts = new THREE.InstancedMesh(tuftGeo, M(0x8f9468, { side: THREE.DoubleSide }), tuftPts.length);
  tuftPts.forEach(([x, z], i) => { mtx.makeScale(1, .8 + rnd() * .5, 1).setPosition(x, 0, z); tufts.setMatrixAt(i, mtx); });
  scene.add(plumes, stems, tufts);
  const q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  function updatePampas(t) {
    plumeData.forEach((p, k) => {
      const sway = p.lean * .4 + Math.sin(t * 1.3 + p.ph) * .07;
      q.setFromEuler(e3.set(0, p.ph, sway)); sc.set(1, p.h * 1.2, 1);
      mtx.compose(pv.set(p.x, 0, p.z), q, sc); stems.setMatrixAt(k, mtx);
      mtx.compose(pv.set(p.x - Math.sin(sway) * 1.2 * p.h * Math.cos(p.ph), 1.15 * p.h, p.z + Math.sin(sway) * 1.2 * p.h * Math.sin(p.ph)), q, sc.set(1, 1, 1)); plumes.setMatrixAt(k, mtx);
    });
    plumes.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true;
  }
  updatePampas(0);

  // 가로등(연출: OSM에 가로등 태그 없음) — 인스턴스 + 가까운 4개만 실제 라이트
  const NL = Math.min(lampPts.length, 300);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb860, emissiveIntensity: 1 }); emissives.lamp.push(lampMat);
  const poleM = M(0x4a3a30, { roughness: .6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .12, 2.6, 8).translate(0, 1.3, 0), poleM, NL);
  const lans = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.22, .3, 6, 12).translate(0, 2.75, 0), lampMat, NL);
  const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(.35, .25, 12).translate(0, 3.15, 0), poleM, NL);
  for (let i = 0; i < NL; i++) { const [x, z] = lampPts[i]; mtx.makeTranslation(x, 0, z); poles.setMatrixAt(i, mtx); lans.setMatrixAt(i, mtx); caps.setMatrixAt(i, mtx); lamps.push(new THREE.Vector3(x, 2.75, z)); }
  poles.castShadow = caps.castShadow = true; scene.add(poles, lans, caps);
  const haloTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,160,1)'); g.addColorStop(.3, 'rgba(255,190,110,.45)'); g.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const haloG = new THREE.BufferGeometry(); haloG.setAttribute('position', new THREE.Float32BufferAttribute(lamps.flatMap(v => [v.x, v.y, v.z]), 3));
  const haloMat = new THREE.PointsMaterial({ map: haloTex, size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .6 });
  scene.add(new THREE.Points(haloG, haloMat));
  // 가로등 아래 바닥 빛 웅덩이
  const poolMat = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .35 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), poolMat, NL);
  for (let i = 0; i < NL; i++) { mtx.makeTranslation(lamps[i].x, .1, lamps[i].z); pools.setMatrixAt(i, mtx); } scene.add(pools);
  const lights = []; for (let i = 0; i < 4; i++) { const p = new THREE.PointLight(0xffb860, 1, 14, 1.6); scene.add(p); lights.push(p); }

  // 먼 풍경(연출): 부산항대교 방향(남동쪽 바다)과 영도 방향(남쪽) 실루엣 — 위치·형태 모두 연출
  // 부산항대교(북항대교): 실제로는 북항 입구(영도 방향)를 가로지르는 사장교. 방향은 대략 실제(남동쪽 바다, 영도↔동구 방향), 거리·크기·형태 치수는 모두 연출
  const far = new THREE.Group(); far.position.set(470, -0.9, 400); far.rotation.y = .74; scene.add(far);
  const silM = M(0x9aa6b8, { roughness: 1, fog: false });
  const deckB = new THREE.Mesh(new THREE.BoxGeometry(560, 3.2, 9), silM); deckB.position.set(0, 26, 0); far.add(deckB);
  const deckL = new THREE.Mesh(new THREE.BoxGeometry(560, 1.2, 9.4), M(0x7d889a, { roughness: 1, fog: false })); deckL.position.set(0, 24, 0); far.add(deckL);
  for (const ax of [-250, -200, 200, 250]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 25, 4), silM); pier.position.set(ax, 12.5, 0); far.add(pier); }
  const cableMat = new THREE.LineBasicMaterial({ color: 0xc0c8d4, fog: false }), cablePts = [];
  for (const tx of [-90, 90]) {
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 110, 4), silM); leg.position.set(tx, 55, s * 9); leg.rotation.x = -s * .08; far.add(leg); } // 역Y형 주탑(형태 연출)
    const top = new THREE.Mesh(new THREE.BoxGeometry(5, 26, 5), silM); top.position.set(tx, 118, 0); far.add(top);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 22), silM); beam.position.set(tx, 30, 0); far.add(beam);
    for (let k = 1; k <= 12; k++) for (const d of [-1, 1]) for (const s of [-1, 1]) cablePts.push(new THREE.Vector3(tx, 128 - k * 1.8, s * .5), new THREE.Vector3(tx + d * k * 6.8, 27.5, s * 4.3));
  }
  far.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts), cableMat));
  const bLights = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd28a, fog: false }), 140);
  for (let i = 0; i < 140; i++) { mtx.makeTranslation(-278 + (i >> 1) * 8, 28.2, (i & 1) ? 4.6 : -4.6); bLights.setMatrixAt(i, mtx); } far.add(bLights); emissives.city.push(bLights.material);
  const redM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff3b2f, fog: false }); emissives.city.push(redM);
  for (const tx of [-90, 90]) { const rl = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), redM); rl.position.set(tx, 132, 0); far.add(rl); }
  const island = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12, 0, 6.28, 0, Math.PI / 2), M(0x5d7466, { roughness: 1, fog: false })); island.scale.set(2.2, .5, .8); island.position.set(80, -1, 650); scene.add(island);

  // ---- 시간대 반영 ----
  let curT = null;
  function setTime(c) {
    curT = c;
    skyU.top.value.set(c.skyTop); skyU.bot.value.set(c.skyBot); skyU.sunDir.value.set(c.sunX, c.sunY, c.sunZ); skyU.sunVis.value = c.sunVis;
    starBase = c.starVis ?? Math.max(0, 1 - c.sunVis) * (c.lamp > 2 ? 1 : .3); stars.visible = stars2.visible = starBase > .02;
    const mv = c.moon ?? 0; moon.visible = mv > .02; moonM.opacity = Math.min(1, mv * 1.2); glowM.opacity = mv * .8;
    waterMat.color.set(c.canal); { const cc = new THREE.Color(c.canal), hsl = {}; cc.getHSL(hsl); cc.setHSL(hsl.h, Math.max(hsl.s, .5), Math.max(hsl.l, .62)); waterMat.color.copy(cc); waterMat.emissive.copy(cc).multiplyScalar(.42); waterMat.emissiveIntensity = 1; } // 수로 전용 밝기 하한(시간대와 무관하게 밝은 청록 반투명) sea.material.color.set(c.sea); glintMat.color.set(c.glint); haloMat.opacity = Math.min(1, c.lamp * .45); poolMat.opacity = Math.min(.6, c.lamp * .22);
    emissives.lamp.forEach(m => m.emissiveIntensity = c.lamp);
    emissives.deco.forEach(m => m.emissiveIntensity = Math.max(0, c.lamp - .6) * .8);
    emissives.city.forEach(m => m.emissiveIntensity = c.city);
    const night = c.sunVis < .5;
    bMats.forEach((m, k) => m.color.set(night ? [0x4a4f66, 0x40465e, 0x363d58, 0x2e3550][k] || 0x3a4058 : bcol[k] ?? bcol[3]));
    silM.color.set(night ? 0x46506c : 0xa9b0c2); cableMat.color.set(c.lamp > 1 ? 0xf2e6c8 : 0xc0c8d4); island.material.color.set(night ? 0x1c2a33 : 0x4d6656);
  }
  const _v = new THREE.Vector3();
  function update(t, dt, camera, gp) {
    updateFish(t, dt, gp); glassFish.update(t);
    waterTex.offset.set(t * .02, t * .05); glintTex.offset.set(Math.sin(t * .3) * .05, t * .03); glintMat.opacity = .55 + Math.sin(t * 2.1) * .15; seaTex.offset.set(t * .01, t * .015);
    if (camera) { sky.position.copy(camera.position); }
    stars.material.opacity = starBase * (.85 + .15 * Math.sin(t * 2.3)); stars2.material.opacity = starBase * (.75 + .25 * Math.sin(t * 3.1 + 1.7));
    updatePampas(t);
    const cam = window.__camPos || _v.set(0, 0, 0);
    const sorted = lamps.slice().sort((a, b) => a.distanceToSquared(cam) - b.distanceToSquared(cam));
    lights.forEach((l, i) => { if (sorted[i]) l.position.copy(sorted[i]); l.intensity = curT ? curT.lampLight * 4 : 4; });
  }

  // ===== 물고기·상어·항만(모두 연출: 데이터에 없음, 직접 만든 단순 도형) =====
  sea.material.transparent = true; sea.material.opacity = .8; sea.material.depthWrite = false; sea.renderOrder = 1;
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), M(0x1d4a5e, { roughness: 1 })); deep.rotation.x = -Math.PI / 2; deep.position.y = -3.2; scene.add(deep);
  const clW = DATA.canalLine[0].map(W); const clLen = [0]; for (let i = 1; i < clW.length; i++) clLen.push(clLen[i - 1] + Math.hypot(clW[i][0] - clW[i - 1][0], clW[i][1] - clW[i - 1][1]));
  const clAt = d => { const L = clLen[clLen.length - 1]; d = Math.max(0, Math.min(L, d)); let i = 1; while (i < clLen.length - 1 && clLen[i] < d) i++; const a = clW[i - 1], b = clW[i], f = (d - clLen[i - 1]) / Math.max(1e-6, clLen[i] - clLen[i - 1]); const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1; return [a[0] + tx * f, a[1] + tz * f, tx / tl, tz / tl]; };
  const inCanal = (x, z) => DATA.canal.some(p => inRing(p[0].map(W), x, z));
  const landRings = [...DATA.parkGround, ...DATA.outerGround].map(p => p[0].map(W));
  const isSea = (x, z) => !landRings.some(r => inRing(r, x, z));
  // 물고기: 몸통(둥근 구) + 꼬리(납작 원뿔) 두 InstancedMesh
  const fishBodyG = new THREE.SphereGeometry(1, 10, 8); const fishTailG = new THREE.ConeGeometry(.55, .7, 4); fishTailG.rotateX(-Math.PI / 2); fishTailG.translate(0, 0, -.35); fishTailG.scale(.25, 1, 1);
  const fishCols = [0xff9a3c, 0xf3e6c8, 0x8fa7b8, 0xffc06a, 0xe8705a];
  const fish = [];
  for (let i = 0, tries = 0; fish.filter(f => f.canal).length < 60 && tries < 600; tries++) { const d = rnd() * clLen[clLen.length - 1], off = (rnd() - .5) * 2.2; const [x, z, tx, tz] = clAt(d); const fx = x - tz * off, fz = z + tx * off; if (!inCanal(fx, fz)) continue; fish.push({ canal: true, d0: d, off, span: 3 + rnd() * 5, sp: .25 + rnd() * .3, ph: rnd() * 6.28, sz: .16 + rnd() * .06, y: -.44 + rnd() * .06 }); }
  for (let k = 0, tries = 0; fish.length < 100 && tries < 400; tries++) { const x = B.x0 + rnd() * (B.x1 - B.x0 + 120) - 60, z = B.z0 + rnd() * (B.z1 - B.z0 + 120) - 60; if (!isSea(x, z) || !isSea(x + 6, z) || !isSea(x - 6, z) || !isSea(x, z + 6) || !isSea(x, z - 6)) continue; for (let j = 0; j < 8 && fish.length < 100; j++) fish.push({ canal: false, cx: x + (rnd() - .5) * 3, cz: z + (rnd() - .5) * 3, r: 3 + rnd() * 1.5, sp: .25 + rnd() * .1, ph: k * 2 + j * .35, sz: .32 + rnd() * .1, y: -1.35 - rnd() * .4 }); k++; }
  const fishBody = new THREE.InstancedMesh(fishBodyG, M(0xffffff, { roughness: .5 }), fish.length), fishTail = new THREE.InstancedMesh(fishTailG, M(0xffffff, { roughness: .6 }), fish.length);
  fish.forEach((f, i) => { const c = new THREE.Color(fishCols[i % fishCols.length]).offsetHSL(0, 0, (rnd() - .5) * .08); fishBody.setColorAt(i, c); fishTail.setColorAt(i, c.clone().multiplyScalar(.85)); f.ax = 0; f.az = 0; });
  fishBody.frustumCulled = fishTail.frustumCulled = false; scene.add(fishBody, fishTail);
  const _o = new THREE.Object3D(), _t = new THREE.Object3D();
  // 상어(수로 1마리, 귀여운 둥근 형태)
  const shark = new THREE.Group(); { const top = M(0x7f9fb8, { roughness: .5 }), bel = M(0xf4f1ea, { roughness: .6 }), eye = M(0x1d1d24, { roughness: .3 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), top); b1.scale.set(.32, .26, .7); shark.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bel); b2.scale.set(.27, .17, .6); b2.position.set(0, -.08, .05); shark.add(b2);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), eye); e.position.set(sx * .22, .06, .42); shark.add(e); const pf = new THREE.Mesh(new THREE.ConeGeometry(.12, .34, 4), top); pf.scale.set(1, 1, .3); pf.rotation.set(0, 0, sx * 2.1); pf.position.set(sx * .3, -.08, .12); shark.add(pf); }
    const df = new THREE.Mesh(new THREE.ConeGeometry(.13, .32, 6), top); df.scale.set(.35, 1, 1); df.rotation.x = -.35; df.position.set(0, .32, -.02); shark.add(df);
    const tail = new THREE.Group(); tail.position.set(0, 0, -.62); shark.add(tail); for (const sy of [1, -1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(.14, .42, 6), top); t.scale.set(.3, 1, 1); t.rotation.x = sy * -2.3; t.position.set(0, sy * .13, -.12); tail.add(t); } shark.userData.tail = tail; }
  shark.scale.setScalar(1.1); scene.add(shark); const sharkD0 = clLen[clLen.length - 1] * .3;
  function updateFish(t, dt, gp) {
    fish.forEach((f, i) => { let x, z, hx, hz;
      if (f.canal) { const u = Math.sin(t * f.sp / f.span * 2 + f.ph); const [cx, cz, tx, tz] = clAt(f.d0 + u * f.span); const dir = Math.cos(t * f.sp / f.span * 2 + f.ph) >= 0 ? 1 : -1; x = cx - tz * f.off; z = cz + tx * f.off; hx = tx * dir; hz = tz * dir; }
      else { const a = f.ph + t * f.sp; x = f.cx + Math.cos(a) * f.r; z = f.cz + Math.sin(a) * f.r; hx = -Math.sin(a); hz = Math.cos(a); }
      if (gp) { const dx = x + f.ax - gp.x, dz = z + f.az - gp.z, dd = Math.hypot(dx, dz); const want = dd < 2.5 ? 1.6 : 0; f.ax += ((want ? dx / dd * want : 0) - f.ax) * Math.min(1, dt * 3); f.az += ((want ? dz / dd * want : 0) - f.az) * Math.min(1, dt * 3); } // 가까이 오면 살짝 피함
      if (f.canal && (f.ax || f.az) && !inCanalFast(x + f.ax, z + f.az)) { f.ax *= .5; f.az *= .5; }
      _o.position.set(x + f.ax, f.y + Math.sin(t * 2 + i) * .02, z + f.az); _o.rotation.set(0, Math.atan2(hx, hz), 0); _o.scale.set(f.sz * .55, f.sz * .7, f.sz * 1.1); _o.updateMatrix(); fishBody.setMatrixAt(i, _o.matrix);
      _t.position.set(0, 0, -.9); _t.rotation.set(0, Math.sin(t * 9 + i) * .5, 0); _t.scale.set(1 / .55 * .55, 1, 1); _t.updateMatrix(); fishTail.setMatrixAt(i, _o.matrix.clone().multiply(_t.matrix)); });
    fishBody.instanceMatrix.needsUpdate = fishTail.instanceMatrix.needsUpdate = true;
    const u = Math.sin(t * .05); const dir = Math.cos(t * .05) >= 0 ? 1 : -1; const [sx, sz, tx, tz] = clAt(sharkD0 + u * 20); const so = Math.sin(t * .4) * .6;
    shark.position.set(sx - tz * so, -.43 + Math.sin(t * 1.3) * .02, sz + tx * so); shark.rotation.y = Math.atan2(tx * dir, tz * dir) + Math.sin(t * 2) * .06; shark.userData.tail.rotation.y = Math.sin(t * 4) * .45;
    if (shark.userData.hold) { const h = shark.userData.hold; shark.position.x = h[0]; shark.position.z = h[1]; shark.rotation.y = h[2] + Math.sin(t * 2) * .06; } // 촬영용 고정(테스트 훅)
  }
  const canalGrid = new Map(); const inCanalFast = (x, z) => { const k = Math.round(x * 2) + ',' + Math.round(z * 2); let v = canalGrid.get(k); if (v === undefined) { v = inCanal(x, z); canalGrid.set(k, v); } return v; };

  // ===== 다리 디테일(연출): 윤곽은 OSM, 난간·연석·조명·아치는 연출. 수로에 면한 가장자리에만 난간(진입부는 열어 둠) =====
  { const postP = [], railRuns = [], lampP = [], arches = [];
    const inPoly = (r, x, z) => inRing(r, x, z);
    for (const b of DATA.bridges) { const r = b.poly.map(W); let run = null; const runs = [];
      for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < .01) continue; const tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L, nx = -tz, nz = tx;
        for (let d = 0; d <= L; d += .6) { const x = a[0] + tx * d, z = a[1] + tz * d; const s1 = inPoly(r, x + nx * .5, z + nz * .5); const ox = s1 ? -nx : nx, oz = s1 ? -nz : nz;
          const water = inCanalFast(x + ox * 1.0, z + oz * 1.0) && inCanalFast(x + ox * 2.2, z + oz * 2.2);
          const px = x - ox * .18, pz = z - oz * .18;
          if (water) { if (!run) { run = []; runs.push(run); } run.push([px, pz]); } else run = null; } }
      for (const rn of runs) { if (rn.length < 3) continue; railRuns.push(rn); rn.forEach((q, k) => { if (k % 2 === 0) postP.push(q); if (k % 10 === 5) lampP.push(q); }); }
      const longR = runs.filter(rn => rn.length >= 6).sort((a, c) => c.length - a.length).slice(0, 2); const xs = r.map(q => q[0]), zs = r.map(q => q[1]);
      const minW = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); if (longR.length && minW < 14) arches.push(...longR); }
    const postG = new THREE.CylinderGeometry(.05, .06, .9, 6); postG.translate(0, BRIDGE_H + .45, 0);
    const posts = new THREE.InstancedMesh(postG, M(0x8a8f96, { roughness: .4, metalness: .5 }), postP.length);
    postP.forEach(([x, z], i) => { mtx.makeTranslation(x, 0, z); posts.setMatrixAt(i, mtx); }); scene.add(posts);
    const tubes = (runs, y, rad, mat) => runs.forEach(rn => { if (rn.length < 2) return; const curve = new THREE.CatmullRomCurve3(rn.map(([x, z]) => new THREE.Vector3(x, typeof y === 'function' ? y(x, z) : y, z))); scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, rn.length * 2), rad, 6, false), mat)); });
    const handM = M(0xb07a4a, { roughness: .6 }); tubes(railRuns, BRIDGE_H + .92, .055, handM); // 나무 손잡이
    tubes(railRuns, BRIDGE_H + .45, .025, M(0x9aa0a8, { metalness: .5, roughness: .4 })); // 중간 가로대
    scene.add(new THREE.Mesh(ribbons(railRuns.map(rn => ({ p: rn.map(([x, z]) => [x / S, -z / S]), w: .28 })), BRIDGE_H + .1), M(0xbdb3a4, { roughness: .9 }))); // 연석
    const lampM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd89a }); emissives.lamp.push(lampM);
    const bl2 = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 8, 6), lampM, lampP.length); lampP.forEach(([x, z], i) => { mtx.makeTranslation(x, BRIDGE_H + 1.0, z); bl2.setMatrixAt(i, mtx); }); scene.add(bl2);
    const archM = M(0xe9e4dc, { roughness: .5 });
    arches.forEach(rn => { const n = rn.length - 1; const pts = rn.map(([x, z], k) => new THREE.Vector3(x, -.55 + (BRIDGE_H - .05 + .55) * Math.sin(Math.PI * k / n), z)); scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, .09, 8, false), archM));
      for (let k = 2; k < n - 1; k += 2) { const p = pts[k]; const h = BRIDGE_H - .25 - p.y; if (h < .08) continue; const sp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, h, 5), archM); sp.position.set(p.x, p.y + h / 2, p.z); scene.add(sp); } }); }
  // 항만(연출): OSM 해안선 근처의 바다쪽 긴 안벽에 크레인·정박선 배치
  const harbor = new THREE.Group(); scene.add(harbor); { const quays = [];
    const pc = [(B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2];
    const OG = DATA.outerGround.flatMap(p => p[0].map(W)), gx0 = Math.min(...OG.map(p => p[0])), gx1 = Math.max(...OG.map(p => p[0])), gz0 = Math.min(...OG.map(p => p[1])), gz1 = Math.max(...OG.map(p => p[1]));
    const nearCut = (x, z) => x - gx0 < 12 || gx1 - x < 12 || z - gz0 < 12 || gz1 - z < 12; // 지도 잘린 가장자리(OSM 범위 경계)는 실제 안벽 아님
    for (const r of DATA.outerGround.map(p => p[0].map(W))) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 22 || nearCut(a[0], a[1]) || nearCut(b[0], b[1])) continue; const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      for (const sg of [1, -1]) { const nx = -tz * sg, nz = tx * sg; if (isSea(mx + nx * 8, mz + nz * 8) && isSea(mx + nx * 20, mz + nz * 20) && !isSea(mx - nx * 4, mz - nz * 4) && Math.hypot(mx - pc[0], mz - pc[1]) > 52) quays.push({ mx, mz, tx, tz, nx, nz, L }); } }
    quays.sort((a, b) => b.L - a.L); const used = [];
    const red = M(0xd8483a, { roughness: .7 }), wht = M(0xeeeeea, { roughness: .7 }), dark = M(0x3a4048, { roughness: .8 }), cont = [0x3a78c8, 0xd86a3a, 0x4aa86a, 0xe8c04a, 0xb84a5a].map(c => M(c, { roughness: .8 }));
    const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    let nc = 0, ns = 0;
    for (const q of quays) { if (used.some(u => Math.hypot(u[0] - q.mx, u[1] - q.mz) < 34)) continue; used.push([q.mx, q.mz]);
      const g = new THREE.Group(); g.position.set(q.mx, 0, q.mz); g.rotation.y = Math.atan2(q.nx, q.nz); g.scale.setScalar(.8); harbor.add(g); // 로컬 +Z = 바다 쪽
      for (const off of nc < 5 ? [-7, 7] : []) { const c = new THREE.Group(); c.position.x = off; g.add(c); for (const lx of [-2.2, 2.2]) for (const lz of [-3, 3]) box(.6, 12, .6, (lz > 0) ? red : wht, lx, 6, lz - 2, c); box(5.4, 1.4, 1, red, 0, 12.4, 1.5, c); box(1.2, 1.2, 22, red, 0, 13.6, 5, c); box(1.6, 1.4, 1.8, wht, 0, 12.2, 9, c); box(.4, 6, .1, dark, 0, 9.6, 12, c); nc++; }
      if (ns < 4) { const sh = new THREE.Group(); sh.position.set(0, -.6, 6.5); sh.rotation.y = Math.PI / 2; g.add(sh); const len = 26; box(len, 2.4, 6, dark, 0, 0, 0, sh); box(len - 1, .5, 6.1, red, 0, -.9, 0, sh); const bow = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2.4, 3, 1), dark); bow.rotation.y = Math.PI / 6; bow.scale.set(.9, 1, 1); bow.position.set(len / 2, 0, 0); sh.add(bow);
        box(4, 4, 5, wht, -len / 2 + 3, 3.2, 0, sh); box(1.2, 2.5, 1.2, red, -len / 2 + 2, 6, 0, sh); for (let k = 0; k < 6; k++) for (let h = 0; h < 2; h++) if (rnd() > .25) box(2.6, 1.2, 4.6, cont[Math.floor(rnd() * 5)], -len / 2 + 7.5 + k * 2.8, 1.8 + h * 1.25, 0, sh); ns++; }
      if (nc >= 6 && ns >= 4) break; }
    harbor.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
  // 탑뷰 프리뷰(?view=top 전용): 낮 밝기 색 + 보행로를 폭 있는 밝은 띠로(실제 폭보다 넓게 그린 지도 표현)
  let topLayer = null;
  function topPreview() {
    if (topLayer) return; topLayer = true;
    park.material.color.set(0xf4ffc0); green.material.color.set(0xf8ffc8); grassTex.image.getContext('2d').globalCompositeOperation = 'source-over';
    sea.material.color.set(0x3d8fa8); waterMat.color.set(0x9df0e6); waterMat.opacity = .8;
    const band = new THREE.Mesh(ribbons(DATA.paths.filter(p => !p.b).map(p => ({ p: p.p, w: Math.max(3.6, p.w * S * 1.6) })), 0.07), new THREE.MeshBasicMaterial({ color: 0xf5ead8, polygonOffset: true, polygonOffsetFactor: -4 }));
    scene.add(band); blades.visible = false;
  }
  // 수로 근접도 0~1 (배경 물소리 볼륨용): 반경 링 샘플
  const waterNear = (x, z) => { if (inCanalFast(x, z)) return 1; for (const [r, v] of [[2, .9], [5, .7], [9, .45], [14, .25]]) for (let a = 0; a < 8; a++) if (inCanalFast(x + Math.cos(a * .785) * r, z + Math.sin(a * .785) * r)) return v; return 0; };
  return { waterNear, walkMeshes, setTime, update, topPreview, fx: { shark, harbor, fish }, start: findStart(), bounds: B, labels: [canalLbl, hillLbl] };
}

function inRing(r, x, z) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
// 평면 UV(월드 XZ 기준)
function planarUV(g, k) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * k; uv[i * 2 + 1] = p.getZ(i) * k; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// 링 가장자리를 따라 수직 벽(y0→y1)
function walls(rings, y0, y1) {
  const pos = [];
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const [ax, az] = W(r[i]), [bx, bz] = W(r[(i + 1) % r.length]);
    pos.push(ax, y0, az, bx, y0, bz, ax, y1, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
