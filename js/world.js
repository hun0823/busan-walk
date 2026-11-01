// 북항 친수공원 월드 — 상상 구성(연출)
// 요소 목록(곡선 경관수로, 윤슬마당, 계단형 수로, 조망언덕 야생화, 잔디광장, 바닥분수,
// 유리 바닥 아치형 보도교, 팜파스, 옛 항만 셀룰러 블록 화분, 밤 경관조명, 먼 대교·섬 실루엣)은
// 디자이너 전달 자료 기준. 정확한 배치·형태·크기·간판 등은 실제와 무관한 '연출'이다.
import * as THREE from 'three';
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, ...o });

// ---- 레이아웃 함수(연출) ----
export const pathX = z => 3 + 2 * Math.sin(z * 0.025);          // 산책로 중심선
export const canalX = z => -7 + 2.5 * Math.sin(z * 0.035 + 1);   // 곡선 경관수로 중심선
const PATH_W = 4.2, CANAL_W = 5, Z0 = 25, Z1 = -135, XMIN = -34, XMAX = 26, SEA_X = -36;
const BRIDGE_Z = -50, STEP = { x: -24, z0: -100, z1: -82, w: 5 };
const HILL = { x: 17, z: -78, r: 11, h: 2.6 };
const PLAZA = { x: 14, z: -14, r: 7.5 }, FOUNTAIN = { x: -21, z: -22, r: 4 }, MADANG = { x: 16, z: -42 };
export function heightAt(x, z) {
  const d = Math.hypot(x - HILL.x, z - HILL.z) / HILL.r;
  let h = d < 1 ? HILL.h * (0.5 + 0.5 * Math.cos(d * Math.PI)) : 0;
  if (Math.abs(z - BRIDGE_Z) < 1.8 && Math.abs(x - canalX(z)) < CANAL_W / 2 + 1.5) h = Math.max(h, bridgeY(x, z));
  return h;
}
function bridgeY(x, z) { const u = (x - canalX(BRIDGE_Z)) / (CANAL_W / 2 + 1.5); return Math.max(0, 0.9 * (1 - u * u)); }
export function isWalkable(x, z) {
  if (x < XMIN || x > XMAX || z > Z0 || z < Z1) return false;
  const inCanal = Math.abs(x - canalX(z)) < CANAL_W / 2 + 0.3;
  if (inCanal && Math.abs(z - BRIDGE_Z) > 1.5) return false;
  if (Math.abs(x - STEP.x) < STEP.w / 2 + .3 && z > STEP.z0 && z < STEP.z1) return false;
  return true;
}

function ribbon(fn, w, z0, z1, y, seg = 160) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const z = z0 + (z1 - z0) * i / seg, cx = fn(z);
    pos.push(cx - w / 2, y, z, cx + w / 2, y, z); uv.push(0, i * (z0 - z1) / seg / w, 1, i * (z0 - z1) / seg / w);
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildWorld(scene) {
  const walkMeshes = [], lamps = [], emissives = { lamp: [], city: [], deco: [] };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // 하늘 돔 (그라디언트 + 해)
  const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunVis: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vp; void main(){ vp=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,bot,sunDir; uniform float sunVis; varying vec3 vp;
      void main(){ float h=clamp(vp.y*2.2,0.,1.); vec3 c=mix(bot,top,pow(h,.7));
      float s=max(dot(vp,normalize(sunDir)),0.); c+=sunVis*(vec3(1.,.8,.55)*pow(s,600.)*1.5+vec3(1.,.6,.4)*pow(s,8.)*.35);
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`
  }));
  scene.add(sky);
  // 별(밤)
  const starG = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().setFromSphericalCoords(550, Math.acos(rnd() * .9), rnd() * 6.28); sp.push(v.x, v.y, v.z); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, fog: false }));
  scene.add(stars);

  // 지면(잔디) — 조망언덕 높이 반영
  const gg = new THREE.PlaneGeometry(XMAX - SEA_X + 10, Z0 - Z1 + 30, 120, 160); gg.rotateX(-Math.PI / 2);
  gg.translate((XMAX + SEA_X) / 2 + 5, 0, (Z0 + Z1) / 2);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    let y = heightAt(x, z) * (Math.abs(z - BRIDGE_Z) < 2 ? 0 : 1) - 0.02;
    if (Math.abs(x - canalX(z)) < CANAL_W / 2 + .4) y = -0.7; // 수로 자리 파내기
    if (x < SEA_X - 0.5) y = -1.2;
    gp.setY(i, y);
  }
  gg.computeVertexNormals();
  const grassTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#7fae55'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = `hsl(${85 + rnd() * 25},${40 + rnd() * 20}%,${36 + rnd() * 18}%)`; c.fillRect(rnd() * w, rnd() * h, 2, 3); } }, [30, 40]);
  const ground = new THREE.Mesh(gg, M(0xffffff, { map: grassTex })); ground.receiveShadow = true; scene.add(ground); walkMeshes.push(ground);

  // 산책로(석재 포장)
  const paveTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#b48a78'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const off = (y % 2) * 32; c.fillStyle = `hsl(14,${18 + rnd() * 10}%,${54 + rnd() * 10}%)`; c.fillRect(x * 64 + off + 2, y * 32 + 2, 60, 28); }
  }, [2, 1]);
  const path = new THREE.Mesh(ribbon(pathX, PATH_W, Z0 + 5, Z1 - 10, 0.02), M(0xffffff, { map: paveTex, roughness: .9 })); path.receiveShadow = true; scene.add(path); walkMeshes.push(path);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(ribbon(z => pathX(z) + s * (PATH_W / 2 + .15), .3, Z0 + 5, Z1 - 10, 0.08), M(0x8a7268)); e.receiveShadow = true; scene.add(e); }

  // 곡선 경관수로 + 물
  const waterTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(255,255,255,${.3 + rnd() * .5})`; c.fillStyle = 'rgba(200,225,240,.5)'; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 16, 1.5, 0, 0, 6.28); c.fill(); } }, [1, 1]);
  const waterMat = M(0x4f9fb8, { roughness: .15, metalness: .1, map: waterTex, transparent: true, opacity: .92 });
  const canal = new THREE.Mesh(ribbon(canalX, CANAL_W, Z0 + 5, Z1 - 10, -0.25), waterMat); scene.add(canal);
  const canalBed = new THREE.Mesh(ribbon(canalX, CANAL_W, Z0 + 5, Z1 - 10, -0.6), M(0x3f6f80)); scene.add(canalBed);
  const curbMat = M(0xc9b8a6);
  const glowStrips = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(ribbon(z => canalX(z) + s * (CANAL_W / 2 + .2), .45, Z0 + 5, Z1 - 10, 0.12), curbMat); c.receiveShadow = true; scene.add(c);
    // 밤 경관조명: 수로 가장자리 발광 라인 (연출)
    const g = new THREE.Mesh(ribbon(z => canalX(z) + s * (CANAL_W / 2 - .05), .08, Z0 + 5, Z1 - 10, 0.0), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070 }));
    scene.add(g); emissives.deco.push(g.material);
  }

  // 바다 + 낮은 석재 난간
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M(0x4f9fb8, { roughness: .2, metalness: .1, map: waterTex.clone() }));
  sea.material.map.repeat.set(60, 60); sea.rotation.x = -Math.PI / 2; sea.position.set(SEA_X - 450, -0.8, -200); scene.add(sea);
  const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), sea.material); seaFar.rotation.x = -Math.PI / 2; seaFar.position.set(0, -0.8, Z1 - 260); scene.add(seaFar);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, Z0 - Z1 + 30), M(0xb9ab9c)); wall.position.set(SEA_X, -.3, (Z0 + Z1) / 2); wall.receiveShadow = true; scene.add(wall);
  const railGeo = new THREE.CapsuleGeometry(.25, 2.4, 4, 10); railGeo.rotateX(Math.PI / 2);
  const rails = new THREE.InstancedMesh(railGeo, M(0xd2c6b6), 60);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { mtx.makeTranslation(SEA_X + .1, .6, Z0 + 2 - i * 2.9); rails.setMatrixAt(i, mtx); } rails.castShadow = true; scene.add(rails);
  // 앞쪽 끝 바다 벽
  const wall2 = new THREE.Mesh(new THREE.BoxGeometry(XMAX - SEA_X + 10, 1.4, 1.2), M(0xb9ab9c)); wall2.position.set((XMAX + SEA_X) / 2 + 5, -.3, Z1 - 15); scene.add(wall2);

  // 유리 바닥 아치형 보도교 (형태는 연출)
  const bx = canalX(BRIDGE_Z), span = CANAL_W / 2 + 1.5;
  const bridge = new THREE.Group(); scene.add(bridge);
  const deckGeo = new THREE.PlaneGeometry(span * 2, 3, 24, 1); deckGeo.rotateX(-Math.PI / 2);
  const dp = deckGeo.attributes.position; for (let i = 0; i < dp.count; i++) dp.setY(i, bridgeY(dp.getX(i) + bx, BRIDGE_Z) + 0.03);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: .05, metalness: .1, transparent: true, opacity: .45, side: THREE.DoubleSide }));
  deck.position.set(bx, 0, BRIDGE_Z); bridge.add(deck); walkMeshes.push(deck);
  const archMat = M(0xe7dfd4);
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 20; i++) { const x = -span + 2 * span * i / 20; pts.push(new THREE.Vector3(x, bridgeY(x + bx, BRIDGE_Z), 0)); }
    const cur = new THREE.CatmullRomCurve3(pts);
    const beam = new THREE.Mesh(new THREE.TubeGeometry(cur, 30, .1, 8), archMat); beam.position.set(bx, 0, BRIDGE_Z + s * 1.5); bridge.add(beam);
    const hand = beam.clone(); hand.position.y = .9; hand.material = archMat; bridge.add(hand);
    for (let i = 0; i <= 8; i++) { const x = -span + 2 * span * i / 8; const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .9), archMat); p.position.set(bx + x, bridgeY(x + bx, BRIDGE_Z) + .45, BRIDGE_Z + s * 1.5); bridge.add(p); }
    const glow = new THREE.Mesh(new THREE.TubeGeometry(cur, 30, .04, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd9a0 })); glow.position.set(bx, .05, BRIDGE_Z + s * 1.45); bridge.add(glow); emissives.deco.push(glow.material);
  }
  bridge.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // 계단형 수로 (연출)
  const stepG = new THREE.Group(); scene.add(stepG);
  for (let i = 0; i < 6; i++) {
    const z = STEP.z1 - (i + .5) * (STEP.z1 - STEP.z0) / 6 * -1;
    const zz = STEP.z1 - (i + .5) * ((STEP.z1 - STEP.z0) / 6);
    const h = .2 + (5 - i) * .22;
    const box = new THREE.Mesh(new THREE.BoxGeometry(STEP.w + .6, h, 3.2), M(0xd8cbb8)); box.position.set(STEP.x, h / 2 - .1, zz); box.castShadow = box.receiveShadow = true; stepG.add(box);
    const w = new THREE.Mesh(new THREE.BoxGeometry(STEP.w - .3, .05, 2.8), waterMat); w.position.set(STEP.x, h - .08, zz); stepG.add(w);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(STEP.w - .3, .25), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: .7, emissive: 0x335566 })); fall.position.set(STEP.x, h - .2, zz + 1.42); stepG.add(fall);
  }

  // 잔디광장 (밝은 원형 잔디 + 둘레 포장)
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r, 48), M(0x93c565)); plaza.rotation.x = -Math.PI / 2; plaza.position.set(PLAZA.x, .01, PLAZA.z); plaza.receiveShadow = true; scene.add(plaza); walkMeshes.push(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA.r, PLAZA.r + 1.2, 48), M(0xc9a491)); ring.rotation.x = -Math.PI / 2; ring.position.set(PLAZA.x, .015, PLAZA.z); ring.receiveShadow = true; scene.add(ring); walkMeshes.push(ring);

  // 바닥분수 (물줄기 파티클, 연출)
  const fBase = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN.r, 40), M(0xbdb3a8, { roughness: .3 })); fBase.rotation.x = -Math.PI / 2; fBase.position.set(FOUNTAIN.x, .015, FOUNTAIN.z); fBase.receiveShadow = true; scene.add(fBase); walkMeshes.push(fBase);
  const jets = [];
  const jetGeo = new THREE.CapsuleGeometry(.06, .4, 4, 6), jetMat = new THREE.MeshStandardMaterial({ color: 0xe8f7ff, transparent: true, opacity: .75, emissive: 0x334455 });
  const jetMesh = new THREE.InstancedMesh(jetGeo, jetMat, 12 * 6); scene.add(jetMesh);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; jets.push({ x: FOUNTAIN.x + Math.cos(a) * 2.4, z: FOUNTAIN.z + Math.sin(a) * 2.4, ph: i * .5 }); }
  const fLights = new THREE.InstancedMesh(new THREE.CircleGeometry(.12, 12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x9fe0ff }), 12);
  jets.forEach((j, i) => { mtx.makeRotationX(-Math.PI / 2).setPosition(j.x, .03, j.z); fLights.setMatrixAt(i, mtx); }); scene.add(fLights); emissives.deco.push(fLights.material);

  // 윤슬마당: 나무 지붕 휴게 공간 (구조 형태는 연출)
  const wood = M(0xa8743f), woodD = M(0x7d5530);
  const mad = new THREE.Group(); mad.position.set(MADANG.x, 0, MADANG.z); scene.add(mad);
  const deckM = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, .25, 8), woodD); deckM.position.y = .12; mad.add(deckM);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .16, 2.8, 10), wood); p.position.set(Math.cos(a) * 3.6, 1.6, Math.sin(a) * 3.6); mad.add(p); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 1.6, 8), wood); roof.position.y = 3.7; mad.add(roof);
  const roofTop = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, .5, 8), woodD); roofTop.position.y = 4.6; mad.add(roofTop);
  for (const r of [0, Math.PI / 2]) { const bench = new THREE.Mesh(new THREE.BoxGeometry(3, .2, .7), wood); bench.position.set(0, .7, 0); bench.rotation.y = r; mad.add(bench); }
  const madLamp = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb860 })); madLamp.position.y = 2.7; mad.add(madLamp); emissives.lamp.push(madLamp.material);
  mad.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });

  // 조망언덕 야생화 (색은 연출)
  const flowerCols = [0xf29bb8, 0xffd36e, 0xc79ef2, 0xffffff, 0xf58a8a];
  const flowerGeo = new THREE.SphereGeometry(.12, 8, 6);
  flowerCols.forEach(col => {
    const fm = new THREE.InstancedMesh(flowerGeo, M(col, { roughness: .7 }), 140);
    for (let i = 0; i < 140; i++) {
      const a = rnd() * 6.28, r = Math.sqrt(rnd()) * HILL.r * .9, x = HILL.x + Math.cos(a) * r, z = HILL.z + Math.sin(a) * r;
      mtx.makeScale(1, .7, 1).setPosition(x, heightAt(x, z) + .15, z); fm.setMatrixAt(i, mtx);
    }
    scene.add(fm);
  });
  // 언덕 정상 목재 쉼터는 넣지 않음(자료에 없음) — 작은 벤치만 연출
  const hb = new THREE.Mesh(new THREE.BoxGeometry(2, .2, .6), wood); hb.position.set(HILL.x, HILL.h + .5, HILL.z); hb.castShadow = true; scene.add(hb);

  // 둥근 나무(장식, 연출)
  const trunkM = M(0x7a5a3a), leafM = M(0x5f9a4a);
  const treeSpots = [[22, 5], [24, -25], [8, -60], [23, -100], [-28, 8], [-30, -60], [-14, -110], [10, -120], [-28, -120]];
  for (const [x, z] of treeSpots) {
    const t = new THREE.Group(); t.position.set(x, heightAt(x, z), z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, 2, 8), trunkM); tr.position.y = 1; t.add(tr);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(1.4 - k * .25, 16, 12), leafM); l.position.set((rnd() - .5) * .8, 2.4 + k * .9, (rnd() - .5) * .8); t.add(l); }
    t.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(t);
  }

  // 산책로 옆 팜파스
  const plumeGeo = new THREE.SphereGeometry(.2, 12, 10).scale(1, 2.6, 1), stemGeo = new THREE.CylinderGeometry(.015, .02, 1.1, 4);
  const PN = 200, plumes = new THREE.InstancedMesh(plumeGeo, M(0xf1e2c2, { roughness: 1 }), PN), stems = new THREE.InstancedMesh(stemGeo, M(0x8a9a5a), PN);
  const plumeData = [];
  for (let i = 0; i < PN; i++) {
    const z = Z0 - rnd() * (Z0 - Z1), s = rnd() < .5 ? -1 : 1;
    const x = pathX(z) + s * (PATH_W / 2 + .7 + rnd() * 1.6);
    if (Math.abs(x - canalX(z)) < CANAL_W / 2 + .6) continue;
    plumeData.push({ i, x, z, lean: (rnd() - .5) * .5, ph: rnd() * 6, h: .9 + rnd() * .5 });
  }
  plumes.count = stems.count = plumeData.length; scene.add(plumes, stems);
  const q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  function updatePampas(t) {
    plumeData.forEach((p, k) => {
      const sway = p.lean + Math.sin(t * 1.3 + p.ph) * .08;
      q.setFromEuler(e3.set(0, 0, sway)); sc.set(1, p.h, 1);
      mtx.compose(pv.set(p.x, .55 * p.h, p.z), q, sc); stems.setMatrixAt(k, mtx);
      mtx.compose(pv.set(p.x - Math.sin(sway) * 1.1 * p.h, 1.2 * p.h, p.z), q, sc.set(1, 1, 1)); plumes.setMatrixAt(k, mtx);
    });
    plumes.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true;
  }
  updatePampas(0);

  // 옛 항만 셀룰러 블록 화분 (형태는 연출: 격자 구멍 있는 콘크리트 블록)
  const blockM = M(0xa8a29a, { roughness: .95 }), shrubM = M(0x6b9a52);
  for (let i = 0; i < 9; i++) {
    const z = Z0 - 8 - i * 16, x = canalX(z) + CANAL_W / 2 + 1.6;
    if (Math.abs(z - BRIDGE_Z) < 4) continue;
    const b = new THREE.Group(); b.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, 1.6), blockM); base.position.y = .4; b.add(base);
    for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) { const hole = new THREE.Mesh(new THREE.BoxGeometry(.6, .05, .6), M(0x5a4a3a)); hole.position.set(dx, .81, dz); b.add(hole);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), shrubM); sh.position.set(dx, 1.0, dz); b.add(sh); }
    b.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); scene.add(b);
  }

  // 가로등 (발광 머티리얼 다수 + 실제 라이트는 가까운 4개에만)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb860, emissiveIntensity: 1 }); emissives.lamp.push(lampMat);
  const poleM = M(0x4a3a30, { roughness: .6 });
  for (let z = Z0 - 4; z > Z1; z -= 11) {
    const x = pathX(z) + PATH_W / 2 + .9;
    const l = new THREE.Group(); l.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, .4, 12), poleM); base.position.y = .2; l.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 2.2, 10), poleM); pole.position.y = 1.4; l.add(pole);
    const lan = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .3, 6, 12), lampMat); lan.position.y = 2.7; l.add(lan);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.35, .25, 12), poleM); cap.position.y = 3.1; l.add(cap);
    l.traverse(o => { if (o.isMesh && o !== lan) o.castShadow = true; }); scene.add(l);
    lamps.push(new THREE.Vector3(x, 2.7, z));
  }
  const lights = []; for (let i = 0; i < 4; i++) { const p = new THREE.PointLight(0xffb860, 1, 14, 1.6); scene.add(p); lights.push(p); }

  // 먼 풍경 (연출): 대교 실루엣, 섬 실루엣, 도시 불빛
  const far = new THREE.Group(); far.position.set(-60, -0.8, Z1 - 170); scene.add(far);
  const silM = M(0x9aa6b8, { roughness: 1, fog: false });
  const deckB = new THREE.Mesh(new THREE.BoxGeometry(320, 2, 4), silM); deckB.position.set(30, 14, 0); far.add(deckB);
  const cableMat = new THREE.LineBasicMaterial({ color: 0xc0c8d4 });
  for (const tx of [-20, 80]) {
    for (const s of [-1.5, 1.5]) { const tw = new THREE.Mesh(new THREE.BoxGeometry(3, 55, 3), silM); tw.position.set(tx + s, 27, 0); far.add(tw); }
    for (let k = 1; k <= 8; k++) for (const d of [-1, 1]) {
      far.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx, 50 - k, 0), new THREE.Vector3(tx + d * k * 6, 15, 0)]), cableMat));
    }
  }
  for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(3, 14, 3), silM); p.position.set(-120 + i * 35, 7, 0); far.add(p); }
  const bLights = new THREE.InstancedMesh(new THREE.SphereGeometry(.7, 6, 4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd28a }), 60);
  for (let i = 0; i < 60; i++) { mtx.makeTranslation(-130 + i * 5.3, 15.5, 2.2); bLights.setMatrixAt(i, mtx); } far.add(bLights); emissives.city.push(bLights.material);
  const island = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12, 0, 6.28, 0, Math.PI / 2), M(0x5d7466, { roughness: 1, fog: false })); island.scale.set(1.4, .45, .6); island.position.set(-160, -1, -40); far.add(island);
  const island2 = island.clone(); island2.scale.set(.6, .3, .4); island2.position.set(-90, -1, -20); far.add(island2);
  // 도시 블록(형태 연출)
  const cityG = new THREE.Group(); cityG.position.set(60, -0.8, Z1 - 120); scene.add(cityG);
  const bm = M(0xa6aab8, { roughness: 1, fog: false });
  const winMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd9a0 }); emissives.city.push(winMat);
  for (let i = 0; i < 26; i++) {
    const h = 12 + rnd() * 40, x = (rnd() - .3) * 160, z = -rnd() * 60;
    const b = new THREE.Mesh(new THREE.BoxGeometry(8 + rnd() * 6, h, 8), bm); b.position.set(x, h / 2, z); cityG.add(b);
    const w = new THREE.InstancedMesh(new THREE.PlaneGeometry(.8, 1), winMat, 12);
    for (let k = 0; k < 12; k++) { mtx.makeTranslation((rnd() - .5) * 6, 3 + rnd() * (h - 5), 4.05); w.setMatrixAt(k, mtx); } w.position.set(x, 0, z); cityG.add(w);
  }

  // ---- 시간대 반영 ----
  let curT = null;
  function setTime(c) {
    curT = c;
    skyU.top.value.set(c.skyTop); skyU.bot.value.set(c.skyBot); skyU.sunDir.value.set(c.sunX, c.sunY, c.sunZ); skyU.sunVis.value = c.sunVis;
    stars.material.opacity = Math.max(0, 1 - c.sunVis) * (c.lamp > 2 ? 1 : .3);
    stars.visible = stars.material.opacity > .02;
    waterMat.color.set(c.water); sea.material.color.set(c.water);
    emissives.lamp.forEach(m => m.emissiveIntensity = c.lamp);
    emissives.deco.forEach(m => m.emissiveIntensity = Math.max(0, c.lamp - .6) * .8);
    emissives.city.forEach(m => m.emissiveIntensity = c.city);
    bm.color.set(c.sunVis > .5 ? 0x8a8fa8 : 0x2a3350); silM.color.set(c.sunVis > .5 ? 0xb0b4c4 : 0x3a4560);
    island.material.color.set(c.sunVis > .5 ? 0x4d6656 : 0x1c2a33);
  }
  const _v = new THREE.Vector3();
  function update(t, dt) {
    waterTex.offset.set(t * .02, t * .05); sea.material.map.offset.set(t * .01, t * .015);
    updatePampas(t);
    jets.forEach((j, i) => { for (let k = 0; k < 6; k++) { const ph = ((t * .9 + j.ph + k / 6) % 1); const h = Math.sin(ph * Math.PI) * 1.6; mtx.makeScale(1, .8, 1).setPosition(j.x, h, j.z); jetMesh.setMatrixAt(i * 6 + k, mtx); } });
    jetMesh.instanceMatrix.needsUpdate = true;
    // 가까운 가로등 4개에만 실제 라이트
    const cam = window.__camPos || _v.set(0, 0, 0);
    const sorted = lamps.slice().sort((a, b) => a.distanceToSquared(cam) - b.distanceToSquared(cam));
    lights.forEach((l, i) => { l.position.copy(sorted[i]); l.intensity = curT ? curT.lampLight * 4 : 4; });
  }
  return { walkMeshes, setTime, update };
}
