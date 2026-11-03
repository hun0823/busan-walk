// 맵 설정 기반 범용 월드 생성기 — 광안리·황령산·용궁사·감천문화마을 (v3.6)
// 데이터: data/<id>.json (tools/build_map.py, OpenStreetMap ODbL + Open-Meteo 고도(Copernicus DEM GLO-90))
// 좌표: 지도 원점 기준 로컬 미터(+x 동, +y 북) → 월드 X = x*S, Z = -y*S. 수평 축척 S=0.3(북항과 동일), 수직은 맵마다 압축(단순화 높이).
// 실측(데이터): 해안선/육지, 해변·녹지·숲·물·광장 면, 보행로·계단·도로, 건물 윤곽, 나무 점, 이름 있는 지점, 광안대로 교량 선형, 지형 고도(33×33 격자).
// 연출(데이터에 없음): 건물 높이(층수 없는 경우)·색, 감천 파스텔 색, 용궁사 전통 지붕 형태, 숲 나무 배치, 가로등, 광안대교 주탑·케이블 위치와 높이·조명, 하늘·별·달.
// 다른 서비스(산사 등)의 코드·모델은 사용하지 않음. 모두 Three.js 기본 도형·캔버스 절차 생성.
import * as THREE from 'three';
import { addV39, templeRoof } from './v39.js?v=39q';
import { addLoopDeck, addBeachDecor } from './v39g.js?v=39q';
const S = 0.3;

export const MAP_CFG = {
  gwangalli: { name: '광안리', vs: .25, base: 0, city: true, fogMul: 1.2,
    start: { beach: true }, face: 'bridge', goal: 'beachEnd',
    extraLabels: d => { const c = centroidBig(d.beach); return c ? [{ n: '광안리해수욕장', x: c[0], y: c[1] }] : []; },
    poiFilter: p => p.n && p.k === 'attraction', note: '광안대교 선형·해변·건물 윤곽은 OSM. 주탑·케이블 위치·높이·조명은 연출' },
  hwangnyeong: { name: '황령산', vs: .13, peak: { n: '황령산', r: 95, a: 38 }, forest: true, fogMul: 1.3,
    start: { poi: '황령산 봉수대', off: 26 }, face: 'poi:황령산 봉수대', see: 'poi:황령산 봉수대', goal: 'poi:사자봉 조망 지점',
    poiFilter: p => p.n && ['peak', 'viewpoint', 'temple'].includes(p.k), note: '등산로·봉우리·전망 지점은 OSM, 고도는 DEM(수직 0.13배 + 정상부 봉우리 강조(연출)). 숲 나무 배치는 연출' },
  yonggungsa: { name: '용궁사', vs: .2, base: 0, temple: true, fogMul: 1,
    start: { poi: '해동용궁사', off: 18 }, face: 'poi:해동용궁사', see: 'poi:해동용궁사', vantage: { poi: '해수관음상', dx: 22, dz: 32, look: '해동용궁사', fixed: true, cam: 8.5 }, goal: 'poi:해수관음상',
    poiFilter: p => p.n && ['temple', 'viewpoint'].includes(p.k) || ['해수관음상', '득남불'].includes(p.n), note: '해안선·계단·건물 윤곽은 OSM. 지붕 형태·색은 연출' },
  gamcheon: { name: '감천문화마을', vs: .14, pastel: true, forestWood: true, fogMul: 1.1,
    start: { poi: '감천문화마을', off: 6, vista: 55 }, face: 'downhill', goal: 'poi:어린왕자상', loop: { c: [-30, 16], toward: '어린왕자상', a: 27, b: 20 },
    poiFilter: p => p.n && ['attraction', 'artwork'].includes(p.k) && /[가-힣]/.test(p.n) && p.n !== '묘지위집', note: '골목·계단·건물 윤곽은 OSM. 집 색(파스텔)·층수는 연출' },
};

function centroidBig(mp) { let best = null, ba = 0; for (const poly of mp || []) { const r = poly[0]; let a = 0, cx = 0, cy = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; } if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } } return best; }
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

export async function buildGenWorld(id, scene) {
  const step = async t => { if (window.__step) window.__step(t); await new Promise(r => setTimeout(r, 16)); }; // v3.9d: 단계 표시 + 화면 갱신 기회
  await step('맵 데이터 받는 중');
  const occluders = []; // 카메라 가림 방지용(건물)
  let D; for (let k = 0; ; k++) { try { D = await (await fetch(`data/${id}.json`)).json(); break; } catch (e) { if (k >= 3) throw e; await new Promise(r => setTimeout(r, 400 * (k + 1))); } } // 느린 망 재시도
  const C = MAP_CFG[id];
  const group = new THREE.Group(); group.name = 'map-' + id; scene.add(group);
  const [bx0, by0, bx1, by1] = D.bb;
  const B = { x0: bx0 * S, x1: bx1 * S, z0: -by1 * S, z1: -by0 * S };
  const WX = B.x1 - B.x0, WZ = B.z1 - B.z0;
  const W = ([x, y]) => [x * S, -y * S];
  // v3.9g 감천 순환 산책 코스(연출): 마을 가운데를 두르는 닫힌 고리. 아랫길은 집들을 올려다보고, 윗길(어린왕자 조형 쪽)은 내려다봄.
  // 위치·모양은 게임용 연출(실제 산책로 아님). 코스 폭과 겹치는 집 윤곽 일부는 생략.
  let loopPts = null;
  if (C.loop) { const L = C.loop, tp = D.pois.find(p => p.n === L.toward); const [tx, tz] = tp ? W([tp.x, tp.y]) : [L.c[0], L.c[1] - 1];
    let ux = tx - L.c[0], uz = tz - L.c[1]; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; const vx = -uz, vz = ux;
    loopPts = []; for (let k = 0; k < 220; k++) { const a = k / 220 * Math.PI * 2, wob = 1 + .07 * Math.sin(a * 3 + 1) + .04 * Math.sin(a * 5);
      loopPts.push([L.c[0] + (ux * Math.cos(a) * L.a + vx * Math.sin(a) * L.b) * wob, L.c[1] + (uz * Math.cos(a) * L.a + vz * Math.sin(a) * L.b) * wob]); }
    const near = (x, z, r) => loopPts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < r * r);
    const inPoly = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, az] = W(r[i]), [bx, bz] = W(r[j]); if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c; };
    const n0 = D.buildings.length; D.buildings = D.buildings.filter(b => !(b.p.some(q => { const [x, z] = W(q); return near(x, z, 1.9); }) || loopPts.some(([x, z], i) => i % 4 === 0 && inPoly(b.p, x, z))));
    C._loopCut = n0 - D.buildings.length; C._loopApex = loopPts[0]; }
  const loopRaw = loopPts && [...loopPts, loopPts[0]].map(([x, z]) => [x / S, -z / S]);

  // ---- 지형 높이: 33×33 DEM 격자 Catmull-Rom 보간 → (고도 - 기준) × vs ----
  const N = D.elev.n, EV = D.elev.v;
  const eMin = Math.min(...EV), base = C.base ?? eMin;
  const ev = (i, j) => EV[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))];
  const cr = (p0, p1, p2, p3, t) => p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function elevM(mx, my) {
    const u = (mx - bx0) / (bx1 - bx0) * (N - 1), v = (my - by0) / (by1 - by0) * (N - 1);
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j; const r = [];
    for (let k = -1; k <= 2; k++) r.push(cr(ev(i - 1, j + k), ev(i, j + k), ev(i + 1, j + k), ev(i + 2, j + k), fu));
    return cr(r[0], r[1], r[2], r[3], fv);
  }
  const pk = C.peak ? D.pois.find(p => p.n === C.peak.n && p.k === 'peak') : null; // v3.9: 정상부를 봉우리답게(가우시안 융기, 연출)
  const bump = pk ? (mx, my) => C.peak.a * Math.exp(-((mx - pk.x) ** 2 + (my - pk.y) ** 2) / C.peak.r ** 2) : () => 0;
  const rawH = (x, z) => Math.max(D.coast ? .15 : 0, (elevM(x / S, -z / S) + bump(x / S, -z / S) - base) * C.vs);

  await step('걷기 영역 계산');
  // ---- 캔버스 래스터: 걷기(R px/단위), 육지 마스크 ----
  const R = 2, GW = Math.ceil(WX * R), GH = Math.ceil(WZ * R);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const painter = (g, k) => {
    const tp = ([x, y]) => [(x - bx0) * S * k, (by1 - y) * S * k];
    const path = rings => { g.beginPath(); for (const r of rings) { r.forEach((p, i) => { const [a, b] = tp(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); } };
    return {
      tp, fill(mp, col) { if (!mp) return; g.fillStyle = col; for (const poly of mp) { path(poly); g.fill('evenodd'); } },
      line(p, w, col, dash) { g.strokeStyle = col; g.lineWidth = w * k; g.lineCap = dash ? 'butt' : 'round'; g.lineJoin = 'round'; g.setLineDash(dash ? dash.map(d => d * k) : []); g.beginPath(); p.forEach((q, i) => { const [a, b] = tp(q); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); },
      poly(r, col) { g.fillStyle = col; path([r]); g.fill(); },
    };
  };
  const pw = p => Math.max(2.4, p.w * S * 1.1); // 보행 폭(월드 단위). 실제 폭보다 약간 넓게(조작 편의)
  // 육지
  const landC = mk(GW, GH), lg = landC.getContext('2d'), lp = painter(lg, R);
  if (D.coast) { lg.fillStyle = '#000'; lg.fillRect(0, 0, GW, GH); lp.fill(D.land, '#fff'); } else { lg.fillStyle = '#fff'; lg.fillRect(0, 0, GW, GH); }
  lp.fill(D.water, '#000');
  const landPx = lg.getImageData(0, 0, GW, GH).data;
  // 걷기 가능: 보행로·도로·광장·해변·녹지 ∩ 육지 − 건물 − 물
  const walkC = mk(GW, GH), wg = walkC.getContext('2d'), wp = painter(wg, R);
  wg.fillStyle = '#000'; wg.fillRect(0, 0, GW, GH);
  for (const m of [D.plaza, D.beach, D.green]) wp.fill(m, '#fff');
  for (const p of D.paths) wp.line(p.p, pw(p), '#fff');
  for (const p of D.roads) wp.line(p.p, p.w * S + 1.2, '#fff');
  if (loopRaw) wp.line(loopRaw, 2.6, '#fff');
  wg.globalCompositeOperation = 'destination-in'; wg.drawImage(landC, 0, 0); wg.globalCompositeOperation = 'source-over';
  for (const b of D.buildings) if (b.t !== 'roof') wp.poly(b.p, '#000');
  const walkPx = wg.getImageData(0, 0, GW, GH).data;
  const cell = (x, z) => { const i = Math.floor((x - B.x0) * R), j = Math.floor((z - B.z0) * R); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : (j * GW + i) * 4; };
  const isWalkable = (x, z) => { const c = cell(x, z); return c >= 0 && walkPx[c] > 127; };
  const isLand = (x, z) => { const c = cell(x, z); return c >= 0 && landPx[c] > 127; };
  const heightAt = (x, z) => rawH(x, z);

  await step('지면 그리는 중');
  // ---- 지면 텍스처(캔버스) ----
  const TK = Math.min(2048 / WX, 2048 / WZ), TW = Math.round(WX * TK), TH = Math.round(WZ * TK);
  const tc = mk(TW, TH), tg = tc.getContext('2d'), tpnt = painter(tg, TK);
  const baseCol = C.forest ? '#7d9e5c' : C.pastel ? '#d8cbb6' : C.temple ? '#b9b39a' : '#d6d0c4';
  tg.fillStyle = D.coast ? '#5aa9bf' : baseCol; tg.fillRect(0, 0, TW, TH);
  if (D.coast) tpnt.fill(D.land, baseCol);
  // 잔결 노이즈
  { const r0 = rng(7); for (let k = 0; k < TW * TH / 60; k++) { tg.fillStyle = `rgba(${r0() < .5 ? '0,0,0' : '255,255,255'},${.03 + r0() * .04})`; tg.fillRect(r0() * TW, r0() * TH, 2 + r0() * 3, 2 + r0() * 3); } }
  if (D.coast) { tg.globalCompositeOperation = 'destination-over'; tg.fillStyle = '#5aa9bf'; tg.fillRect(0, 0, TW, TH); tg.globalCompositeOperation = 'source-over'; }
  tpnt.fill(D.wood, '#5f8a4a'); tpnt.fill(D.green, '#8fbf6a'); tpnt.fill(D.plaza, '#e6dcc8'); tpnt.fill(D.beach, '#f1dfb0'); tpnt.fill(D.water, '#5fb7cc');
  for (const p of D.roads) { tpnt.line(p.p, p.w * S + .8, '#9a958e'); }
  for (const p of D.roads) tpnt.line(p.p, .25, '#f4f1e8', [2, 2.5]);
  for (const p of D.paths) tpnt.line(p.p, pw(p) + .5, C.forest ? '#a88d68' : '#cbbfa8');
  for (const p of D.paths) tpnt.line(p.p, pw(p), p.k === 'path' || p.k === 'track' ? (C.forest ? '#d2b98e' : '#e2d3b0') : '#efe6d4');
  if (loopRaw) { tpnt.line(loopRaw, 2.7, '#a98c66'); tpnt.line(loopRaw, 2.2, '#c9a87a'); } // v3.9g 순환 코스 나무 데크 색(연출)
  for (const p of D.paths.filter(p => p.k === 'steps')) tpnt.line(p.p, pw(p), '#8a7f70', [.25, .45]); // 계단 디딤 줄무늬
  const groundTex = new THREE.CanvasTexture(tc); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8;

  await step('지형 만드는 중');
  // ---- 지형 메시 ----
  const seg = Math.min(260, Math.round(WX / 1.6)), segZ = Math.round(seg * WZ / WX);
  const tgeo = new THREE.PlaneGeometry(WX, WZ, seg, segZ); tgeo.rotateX(-Math.PI / 2); tgeo.translate((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
  const tpos = tgeo.attributes.position;
  // 해안: 육지 마스크를 흐리게 해 물가로 완만히 내려가게
  let blurPx = null, blurW = null; if (D.coast) { const bc = mk(GW, GH), bg = bc.getContext('2d'); bg.filter = 'blur(3px)'; bg.drawImage(landC, 0, 0); blurPx = bg.getImageData(0, 0, GW, GH).data; bg.clearRect(0, 0, GW, GH); bg.filter = 'blur(22px)'; bg.drawImage(landC, 0, 0); blurW = bg.getImageData(0, 0, GW, GH).data; }
  for (let i = 0; i < tpos.count; i++) {
    const x = tpos.getX(i), z = tpos.getZ(i); let y = rawH(x, z);
    if (blurPx) { const c = cell(Math.min(B.x1 - .01, x), Math.min(B.z1 - .01, z)); const m = c >= 0 ? blurPx[c] / 255 : 0; const m2 = Math.min(1, m * 1.6); y = -3 + (y + 3) * m2; if (c >= 0 && landPx[c] < 128) { const mw = blurW[c] / 255; y = Math.max(y, Math.min(-.55, -3 + 2.6 * Math.min(1, mw * 2.4))); } } // v3.9 완만한 얕은 바닥(투명 물 아래 보이게)
    tpos.setY(i, y);
  }
  tgeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ map: groundTex, roughness: .95, metalness: 0 }));
  terrain.receiveShadow = true; group.add(terrain);
  // 맵 밖 바닥(가장자리 낭떠러지 감춤)
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: D.coast ? 0x2c6f8f : 0x6f8f55, roughness: 1 }));
  skirt.position.set((B.x0 + B.x1) / 2, D.coast ? -3.2 : Math.min(0, -1), (B.z0 + B.z1) / 2); group.add(skirt);
  if (!D.coast) { // 내륙 맵: 경계 밖으로 지형이 이어지는 느낌의 낮은 둔덕(연출)
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.hypot(WX, WZ) * .55, 2400, 48, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6d8c58, roughness: 1 }));
    ring.position.copy(skirt.position); ring.position.y = -0.5; group.add(ring); skirt.visible = false;
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), skirt.material); edge.position.copy(skirt.position); edge.position.y = -2; group.add(edge);
  }

  // ---- 바다 ----
  let sea = null, seaTex = null;
  if (D.coast) {
    const c = mk(256, 256), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); const r0 = rng(3);
    for (let k = 0; k < 220; k++) { g.strokeStyle = `rgba(150,190,215,${.25 + r0() * .3})`; g.lineWidth = 1 + r0() * 2; const x = r0() * 256, y = r0() * 256, l = 8 + r0() * 22; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke(); }
    seaTex = new THREE.CanvasTexture(c); seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(160, 160); seaTex.colorSpace = THREE.SRGBColorSpace;
    sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f8fb5, map: seaTex, roughness: .35, metalness: .05 }));
    sea.position.set((B.x0 + B.x1) / 2, -.35, (B.z0 + B.z1) / 2); group.add(sea);
  }

  await step('건물 세우는 중');
  // ---- 건물(병합 1메시, 정점색) ----
  const pos = [], nor = [], col = []; const tmpC = new THREE.Color(), roofC = new THREE.Color();
  const PAL = C.pastel ? ['#f6b3b8', '#ffd59a', '#a8d8f0', '#b8e2b0', '#f7e48f', '#c9b8ef', '#ff9e7a', '#8fd3d0', '#f4a6c9', '#ffcf8a']
    : C.temple ? ['#d9cdb1'] : ['#f2efe9', '#e7e1d6', '#d9dde2', '#efe7d8', '#c9d3dc', '#e9e4dc', '#f5f2ea', '#d6cfc2'];
  const ROOF = C.pastel ? ['#3d7fc4', '#5a9fd6', '#e0705a', '#4aa69a', '#f0f0f0'] : C.temple ? ['#4b5550'] : ['#b8bcc0', '#a9b0b5', '#c7c2b8', '#8f989e'];
  function pushGeo(geo, wallHex, roofHex, roofOnly) {
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal; tmpC.set(wallHex).convertSRGBToLinear(); roofC.set(roofHex).convertSRGBToLinear();
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const c = roofOnly || n.getY(i) > .6 ? roofC : tmpC; const sh = n.getY(i) < -.5 ? .6 : 1; col.push(c.r * sh, c.g * sh, c.b * sh); }
    g.dispose(); if (g !== geo) geo.dispose();
  }
  function obb(r) { // 최소 면적 외접 직사각형(볼록 껍질 변 기준)
    let best = null;
    for (let i = 0; i < r.length; i++) { const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length]; const a = Math.atan2(by - ay, bx - ax), c = Math.cos(a), s = Math.sin(a);
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const [x, y] of r) { const u = x * c + y * s, v = -x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const ar = (u1 - u0) * (v1 - v0); if (!best || ar < best.ar) best = { ar, a, w: u1 - u0, d: v1 - v0, cx: ((u0 + u1) / 2) * c - ((v0 + v1) / 2) * s, cy: ((u0 + u1) / 2) * s + ((v0 + v1) / 2) * c }; }
    return best;
  }
  let nb = 0;
  for (const b of D.buildings) {
    const r = b.p; if (r.length < 3) continue;
    let hmin = 1e9, hmax = -1e9; for (const q of r) { const [x, z] = W(q); const h = rawH(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
    const hh = hash(r[0][0], r[0][1]);
    let hm = b.h || (b.lv ? b.lv * 3.1 : null);
    if (!hm) hm = b.t === 'tent' ? 2.6 : b.t === 'roof' ? 4 : b.t === 'house' ? 6 : b.t === 'apartments' ? 30 + hh * 30 : C.pastel ? 5 + hh * 5 : C.temple ? 6 : C.city ? 7 + hh * hh * 22 : 6 + hh * 6;
    const H = hm * S * 1.25, y0 = hmin - .4, top = hmax + H;
    const wall = PAL[Math.floor(hh * 97) % PAL.length], roof = ROOF[Math.floor(hh * 53) % ROOF.length];
    if (C.temple && b.t !== 'tent') { // 전통 목조 건물 형태(연출): 몸체 + 기와 우진각 지붕
      const top = Math.min(hmax + H, y0 + .4 + H + 1.6); // v3.9: 비탈에서 벽이 과하게 높아져 지붕이 하늘을 덮던 문제 — 높이 상한
      const o = obb(r); if (!o) continue; const ang = -o.a; const [cx, cz] = W([o.cx, o.cy]); const w = o.w * S, d = o.d * S; const bodyH = top - y0 - 1.2;
      if (b.t !== 'roof') { const body = new THREE.BoxGeometry(w * .86, Math.max(1.2, bodyH), d * .86); body.rotateY(ang); body.translate(cx, y0 + Math.max(1.2, bodyH) / 2, cz); pushGeo(body, '#e3d6b8', '#e3d6b8'); // 벽
        const pil = new THREE.BoxGeometry(w * .9, .35, d * .9); pil.rotateY(ang); pil.translate(cx, y0 + Math.max(1.2, bodyH) - .2, cz); pushGeo(pil, '#8c3a2b', '#2f7a5c'); } // 붉은 기둥머리·초록 단청 띠(연출)
      if (b.t !== 'roof') { const bh = Math.max(1.2, bodyH); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) { if (sx === 0 && w < 4) continue; const pc = new THREE.CylinderGeometry(.16, .18, bh, 8); pc.translate(sx * w * .45, 0, sz * d * .45); pc.rotateY(ang); pc.translate(cx, y0 + bh / 2, cz); pushGeo(pc, '#9b3326', '#9b3326'); } // v3.9 붉은 기둥(연출)
        const st = new THREE.BoxGeometry(w * 1.05, .6, d * 1.05); st.rotateY(ang); st.translate(cx, y0 + .1, cz); pushGeo(st, '#a39d90', '#bdb6a8'); // 기단
        const db = new THREE.BoxGeometry(w * .93, .28, d * .93); db.rotateY(ang); db.translate(cx, y0 + bh - .55, cz); pushGeo(db, '#d0a23c', '#2f7a5c'); } // 단청 띠(황·녹, 연출)
      const rh = Math.min(3.2, Math.min(w, d) * .34 + .9); const { top: rt, under: ru } = templeRoof(w + Math.min(w * .28, 2.2), d + Math.min(d * .32, 2.4), rh); // v3.9: 처마가 휘어 올라간 기와지붕(연출) /* v3.9: 지붕 높이 상한(테스터: 하늘 덮던 검은 지붕) */
      for (const [gg, cc] of [[rt, '#a3ada9'], [ru, '#b8443a']]) { gg.rotateY(ang); gg.translate(cx, top - 1.25 + (b.t === 'roof' ? 1.2 : 0), cz); pushGeo(gg, cc, cc, true); }
      nb++; continue;
    }
    const shp = new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x * S, y * S)));
    const geo = new THREE.ExtrudeGeometry(shp, { depth: top - y0, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
    pushGeo(geo, b.t === 'tent' ? '#ffffff' : wall, b.t === 'tent' ? '#f2f2f2' : roof); nb++;
  }
  let bldMat = null;
  if (pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, emissive: 0xffc070, emissiveIntensity: 0 });
    const m = new THREE.Mesh(g, bldMat); m.userData.mapKind = 'bld'; m.castShadow = true; m.receiveShadow = true; group.add(m); 
  }

  await step('나무 심는 중');
  // ---- 나무: OSM 나무 점 + 숲/녹지 면 + (숲 맵) 빈 땅에 배치(연출) ----
  const treePts = D.trees.map(W); const r1 = rng(11);
  const woodC = mk(GW, GH), og = woodC.getContext('2d'), op = painter(og, R);
  og.fillStyle = C.forest ? '#fff' : '#000'; og.fillRect(0, 0, GW, GH); op.fill(D.wood, '#fff'); if (!C.forest) op.fill(D.green, '#888');
  for (const p of D.paths) op.line(p.p, pw(p) + 1.2, '#000'); for (const p of D.roads) op.line(p.p, p.w * S + 2, '#000'); op.fill(D.plaza, '#000'); op.fill(D.beach, '#000');
  for (const b of D.buildings) op.poly(b.p, '#000');
  const woodPx = og.getImageData(0, 0, GW, GH).data;
  const cap = C.forest ? 6500 : 2600, tries = C.forest ? 40000 : 30000;
  for (let k = 0; k < tries && treePts.length < cap; k++) { const x = B.x0 + r1() * WX, z = B.z0 + r1() * WZ; const c = cell(x, z); if (c < 0 || !isLand(x, z)) continue; const v = woodPx[c]; if (v > 200 || (v > 100 && r1() < .25)) treePts.push([x, z]); }
  { const bp = D.pois.find(p => p.n === '황령산 봉수대'); if (bp) { const [bx, bz] = W([bp.x, bp.y]); for (let i = treePts.length - 1; i >= 0; i--) if (Math.hypot(treePts[i][0] - bx, treePts[i][1] - bz) < 26) treePts.splice(i, 1); } } // v3.9: 정상 전망 트임(실제 봉수대 주변은 탁 트인 전망 공간)
  if (C.vantage) { const pw = n => { const p = D.pois.find(p => p.n === n); return p ? W([p.x, p.y]) : null; }; const p = pw(C.vantage.poi), q = pw(C.vantage.look); // v3.9: 시작 시점→법당 사이 시야 트임(나무만 비움)
    if (p && q) { const vx = p[0] + C.vantage.dx, vz = p[1] + C.vantage.dz, ex = q[0] - vx, ez = q[1] - vz, L2 = ex * ex + ez * ez;
      for (let i = treePts.length - 1; i >= 0; i--) { const [x, z] = treePts[i]; const t = Math.max(0, Math.min(1, ((x - vx) * ex + (z - vz) * ez) / L2)); const dd = Math.hypot(x - vx - ex * t, z - vz - ez * t); if (dd < 6 + t * 6 || Math.hypot(x - vx, z - vz) < 10) treePts.splice(i, 1); } } }
  const trunkG = new THREE.CylinderGeometry(.12, .18, 1.6, 6); trunkG.translate(0, .8, 0);
  const roundG = new THREE.IcosahedronGeometry(1, 1); const pineG = new THREE.ConeGeometry(1, 2.4, 7); pineG.translate(0, .6, 0);
  const nT = treePts.length, pineShare = C.forest ? .45 : C.temple ? .5 : .1;
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 1 }), nT);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const nP = treePts.filter((p, i) => hash(i, 3) < pineShare).length;
  const rounds = new THREE.InstancedMesh(roundG, leafMat, Math.max(1, nT - nP)), pines = new THREE.InstancedMesh(pineG, leafMat, Math.max(1, nP));
  rounds.userData.mapKind = pines.userData.mapKind = 'tree'; trunks.userData.mapKind = 'hide'; const o3 = new THREE.Object3D(), tc3 = new THREE.Color(); let ri = 0, pi = 0;
  treePts.forEach(([x, z], i) => { const y = rawH(x, z) - .1, s = .8 + hash(x, z) * .7;
    o3.position.set(x, y, z); o3.rotation.set(0, hash(z, x) * 6, 0); o3.scale.set(s, s * (1 + hash(i, 1) * .4), s); o3.updateMatrix(); trunks.setMatrixAt(i, o3.matrix);
    const pine = hash(i, 3) < pineShare; tc3.setHSL(pine ? .3 + hash(i, 5) * .04 : .22 + hash(i, 7) * .1, .45 + hash(i, 9) * .2, pine ? .26 + hash(i, 2) * .08 : .34 + hash(i, 4) * .12);
    o3.position.y = y + 1.4 * s + (pine ? .2 : .9 * s); const cs = s * (pine ? 1.15 : 1.25 + hash(i, 6) * .5); o3.scale.set(cs, cs * (pine ? 1.2 : .9), cs); o3.updateMatrix();
    if (pine) { pines.setMatrixAt(pi, o3.matrix); pines.setColorAt(pi++, tc3); } else { rounds.setMatrixAt(ri, o3.matrix); rounds.setColorAt(ri++, tc3); } });
  rounds.count = ri; pines.count = pi; for (const m of [trunks, rounds, pines]) { m.castShadow = true; m.frustumCulled = false; group.add(m); }

  // ---- 가로등(보행로·도로 따라 일정 간격, 연출) ----
  const lampPts = []; if (!C.forest) for (const p of [...D.roads, ...D.paths.filter(p => p.k !== 'path' && p.k !== 'track')]) { let acc = 9; for (let i = 0; i < p.p.length - 1 && lampPts.length < 420; i++) { const [ax, az] = W(p.p[i]), [bx, bz] = W(p.p[i + 1]); const L = Math.hypot(bx - ax, bz - az); while (acc < L) { const t = acc / L, side = (p.w * S) / 2 + .6, nx = -(bz - az) / L, nz = (bx - ax) / L; const x = ax + (bx - ax) * t + nx * side, z = az + (bz - az) * t + nz * side; if (isLand(x, z)) lampPts.push([x, z]); acc += 22; } acc -= L; } }
  const postG = new THREE.CylinderGeometry(.06, .08, 3.2, 6); postG.translate(0, 1.6, 0); const headG = new THREE.SphereGeometry(.22, 10, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd590, emissiveIntensity: .3 });
  const posts = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: .6 }), Math.max(1, lampPts.length)), heads = new THREE.InstancedMesh(headG, lampMat, Math.max(1, lampPts.length)); posts.userData.mapKind = heads.userData.mapKind = 'hide';
  lampPts.forEach(([x, z], i) => { const y = rawH(x, z); o3.rotation.set(0, 0, 0); o3.scale.set(1, 1, 1); o3.position.set(x, y, z); o3.updateMatrix(); posts.setMatrixAt(i, o3.matrix); o3.position.y = y + 3.25; o3.updateMatrix(); heads.setMatrixAt(i, o3.matrix); });
  const clearLampsNear = (x, z, r) => { let n = 0; const dx = Math.sin(r), dz = Math.cos(r); lampPts.forEach(([lx, lz], i) => { const a = (lx - x) * dx + (lz - z) * dz, l = Math.abs((lx - x) * dz - (lz - z) * dx); if (a > -9 && a < 7 && l < 5) { o3.position.set(0, -999, 0); o3.scale.set(0, 0, 0); o3.updateMatrix(); posts.setMatrixAt(i, o3.matrix); heads.setMatrixAt(i, o3.matrix); n++; } }); posts.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true; return n; }; // v3.9: 시작 화면 카메라 앞을 사선으로 가로지르는 가로등 정리
  posts.count = heads.count = lampPts.length; posts.frustumCulled = heads.frustumCulled = false; group.add(posts, heads);

  await step('장소 이름');
  // ---- 지점 라벨 ----
  const labels = [];
  function label(text, x, z, big) {
    const c = mk(512, 128), g = c.getContext('2d'); g.font = `700 ${big ? 54 : 44}px sans-serif`; const tw = Math.min(480, g.measureText(text).width + 56);
    g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath(); g.roundRect((512 - tw) / 2, 24, tw, 80, 40); g.fill(); g.fillStyle = '#1f3a4a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false, transparent: true })); sp.scale.set(big ? 26 : 18, (big ? 26 : 18) / 4, 1); sp.position.set(x, rawH(x, z) + (big ? 14 : 9), z); sp.renderOrder = 10; sp.userData.bw = big ? 26 : 18; group.add(sp); labels.push(sp); return sp;
  }
  const seen = new Set(), pois = [];
  for (const p of [...D.pois.filter(C.poiFilter), ...(C.extraLabels ? C.extraLabels(D) : [])]) { if (seen.has(p.n)) continue; seen.add(p.n); const [x, z] = W([p.x, p.y]); pois.push({ n: p.n, x, z }); label(p.n, x, z, p.n === '광안리해수욕장' || p.n === '감천문화마을' || p.n === '해동용궁사' || p.n === '황령산'); }
  // 전망 지점 표시(난간 둥근 데크, 연출)
  for (const p of D.pois.filter(p => p.k === 'viewpoint' || p.k === 'peak')) { const [x, z] = W([p.x, p.y]); const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, .3, 16), new THREE.MeshStandardMaterial({ color: 0xc8b48e, roughness: .9 })); deck.position.set(x, rawH(x, z) + .1, z); deck.receiveShadow = true; group.add(deck); }

  // ---- 광안대교(광안리): 선형은 OSM '광안대로' 교량 way, 구조 디테일은 연출 ----
  const bridgeMats = []; let bridgeInfo = null;
  if (D.bridge && D.bridge.length) {
    const lines = D.bridge.map(b => ({ layer: b.layer, p: b.p.map(W) })); const all = lines.flatMap(l => l.p);
    const bc = centroidBig(D.beach) || [0, 0]; const [bcx, bcz] = W(bc);
    let longest = lines.reduce((a, l) => { const L = l.p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - l.p[i - 1][0], q[1] - l.p[i - 1][1]) : 0, 0); return L > a.L ? { l, L } : a; }, { L: 0 }).l;
    // 해변 중심에서 가장 가까운 교량 점 = 주경간 중앙으로 가정(연출)
    let ci = 0, cd = 1e9; longest.p.forEach((q, i) => { const d = Math.hypot(q[0] - bcx, q[1] - bcz); if (d < cd) { cd = d; ci = i; } });
    const mid = longest.p[ci]; const nb2 = longest.p[Math.min(longest.p.length - 1, ci + 1)], pb = longest.p[Math.max(0, ci - 1)]; let dx = nb2[0] - pb[0], dz = nb2[1] - pb[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const deckBase = 9, towerH = 36, HALF = 250 * S; // 주경간 500m(공개 자료) → 축척 0.3. 주탑 높이·데크 높이는 연출
    const deckY = (x, z) => { const t = Math.abs((x - mid[0]) * dx + (z - mid[1]) * dz); return 3 + (deckBase - 3) * Math.max(0, Math.min(1, 1.25 - t / 600)); };
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: .6 }); const steel = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: .5, metalness: .2 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7fd8ff, emissiveIntensity: .2, roughness: .4 }); bridgeMats.push(ledMat);
    const dpos = [];
    for (const l of lines) for (let i = 0; i < l.p.length - 1; i++) { const [ax, az] = l.p[i], [bx, bz] = l.p[i + 1]; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / 12)); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1; dpos.push([x0, z0, x1, z1, l.layer]); } }
    const box = new THREE.BoxGeometry(1, 1, 1); const decks = new THREE.InstancedMesh(box, deckMat, dpos.length); const piers = new THREE.InstancedMesh(box, steel, dpos.length);
    dpos.forEach(([x0, z0, x1, z1, ly], i) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0); const y = deckY(cx, cz) + (ly >= 2 ? 2.4 : 0); o3.position.set(cx, y, cz); o3.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0); o3.scale.set(5, .9, L + .2); o3.updateMatrix(); decks.setMatrixAt(i, o3.matrix);
      const far = Math.abs((cx - mid[0]) * dx + (cz - mid[1]) * dz) > HALF + 2; o3.scale.set(far && i % 3 === 0 ? 1.4 : 0, y + 3, far && i % 3 === 0 ? 1.4 : 0); o3.position.y = (y - 3) / 2; o3.updateMatrix(); piers.setMatrixAt(i, o3.matrix); });
    group.add(decks, piers);
    const nx = -dz, nz = dx, wHalf = 3.2;
    for (const sgn of [-1, 1]) { const tx = mid[0] + dx * HALF * sgn, tz = mid[1] + dz * HALF * sgn; for (const sd of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, towerH + 4, 1.4), steel); leg.position.set(tx + nx * wHalf * sd, (towerH - 4) / 2, tz + nz * wHalf * sd); group.add(leg); }
      for (const hy of [deckBase - 2, towerH * .55, towerH - 1]) { const bm = new THREE.Mesh(new THREE.BoxGeometry(wHalf * 2 + 1.4, 1.2, 1.2), steel); bm.position.set(tx, hy, tz); bm.rotation.y = Math.atan2(nx, nz) + Math.PI / 2; group.add(bm); } }
    // 케이블: 주경간 포물선 + 측경간(연출)
    for (const sd of [-1, 1]) { const pts = []; const SIDE = 200 * S; for (let k = 0; k <= 60; k++) { const t = -HALF - SIDE + (2 * HALF + 2 * SIDE) * k / 60; let y; if (Math.abs(t) <= HALF) y = deckBase + 2.5 + (towerH - deckBase - 2.5) * (t / HALF) ** 2; else y = towerH - (towerH - deckBase - 1) * ((Math.abs(t) - HALF) / SIDE) ** 1.3; pts.push(new THREE.Vector3(mid[0] + dx * t + nx * wHalf * sd, y, mid[1] + dz * t + nz * wHalf * sd)); }
      const cab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, .22, 5), ledMat); group.add(cab);
      const hp = []; for (let k = 2; k < 58; k += 1) { const t = -HALF - SIDE + (2 * HALF + 2 * SIDE) * k / 60; if (Math.abs(Math.abs(t) - HALF) < 2) continue; const p0 = pts[k]; hp.push(p0.x, p0.y, p0.z, p0.x, deckY(p0.x, p0.z) + 2.8, p0.z); }
      const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); group.add(new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0xb8c4cc }))); }
    bridgeInfo = { mid, dir: [dx, dz], HALF, SIDE: 200 * S, deckBase, towerH, wHalf, deckY, beach: [bcx, bcz] };
  }

  await step('하늘');
  // ---- 하늘·별·달 (직접 작성 셰이더) ----
  const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunVis: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform float sunVis; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y,0.,1.); vec3 c = mix(bot, top, pow(h,.55)); float s = max(dot(d, normalize(sunDir)),0.); c += vec3(1.,.85,.6) * (pow(s,600.)*1.5 + pow(s,8.)*.15) * sunVis; gl_FragColor = vec4(c,1.); }' }));
  sky.renderOrder = -1; group.add(sky);
  const sp = []; const r2 = rng(5); for (let k = 0; k < 900; k++) { const a = r2() * Math.PI * 2, e = Math.asin(.08 + r2() * .92); sp.push(Math.cos(a) * Math.cos(e) * 1400, Math.sin(e) * 1400, Math.sin(a) * Math.cos(e) * 1400); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); group.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false, transparent: true })); group.add(moon);
  let starBase = 0, curT = null;
  function setTime(c) {
    v39?.setTime(c); curT = c; skyU.top.value.set(c.skyTop); skyU.bot.value.set(c.skyBot); skyU.sunDir.value.set(c.sunX, c.sunY, c.sunZ); skyU.sunVis.value = c.sunVis;
    starBase = c.starVis ?? 0; stars.visible = starBase > .02; const mv = c.moon ?? 0; moon.visible = mv > .02; moon.material.opacity = Math.min(1, mv * 1.2);
    lampMat.emissiveIntensity = c.lamp * 1.1; for (const m of bridgeMats) m.emissiveIntensity = .2 + c.lamp * 1.4;
    if (bldMat) bldMat.emissiveIntensity = Math.max(0, (c.city ?? 0) - .3) * .06; // 밤 창 불빛 느낌(연출, 아주 약하게)
    if (sea) { const sc = new THREE.Color(c.sea), hsl = {}; sc.getHSL(hsl); sc.setHSL(hsl.h, Math.max(hsl.s, .45), Math.max(hsl.l, .38)); sea.material.color.copy(sc); }
  }
  let ledH = 0;
  function update(t, dt, camera) {
    if (camera) { sky.position.copy(camera.position); stars.position.copy(camera.position); moon.position.copy(camera.position).add(new THREE.Vector3(-700, 520, -900)); }
    if (camera) for (const sp of labels) { // v3.9: 월드 라벨 크기 상한(거리 비례) + 너무 가까우면 숨김 + 화면 위로 벗어나면 숨김 → 화면을 거대하게 가리지 않음
      const d = camera.position.distanceTo(sp.position), w = Math.min(sp.userData.bw, d * .22); sp.scale.set(w, w / 4, 1);
      sp.material.opacity = Math.max(0, Math.min(1, (d - 10) / 12)); sp.visible = sp.material.opacity > .02; }
    v39?.update(t, dt, camera); if (seaTex) seaTex.offset.set(t * .004, t * .006);
    stars.material.opacity = starBase * (.8 + .2 * Math.sin(t * 2.3));
    if (bridgeMats.length && curT && curT.lamp > 1) { ledH = (t * .03) % 1; bridgeMats[0].emissive.setHSL(.5 + .2 * Math.sin(t * .2), .8, .55); } else if (bridgeMats.length) bridgeMats[0].emissive.set(0x7fd8ff);
  }
  await step('해변·야경 꾸미는 중');
  if (loopPts) addLoopDeck({ group, loopPts, rawH, C });
  const v39 = addV39({ id, D, C, group, W, B, rawH, isLand, isWalkable, painter, tc, tg, TK, groundTex, sea, bridge: bridgeInfo, bridgeMats, hash });
  if (id === 'gwangalli') addBeachDecor({ D, group, W, rawH, isWalkable, isLand, hash });
  const waterNear = (x, z) => { if (!D.coast) return 0; for (const [r, v] of [[3, .9], [10, .7], [22, .45], [40, .25]]) for (let a = 0; a < 8; a++) if (!isLand(x + Math.cos(a * .785) * r, z + Math.sin(a * .785) * r)) return v; return 0; };

  await step('시작 위치');
  // ---- 시작 지점·방향, 테스트 목표 ----
  function nearestWalk(x, z, maxR = 120) { if (isWalkable(x, z)) return [x, z]; for (let r = .5; r < maxR; r += .5) for (let a = 0; a < 32; a++) { const px = x + Math.cos(a / 32 * 6.283) * r, pz = z + Math.sin(a / 32 * 6.283) * r; if (isWalkable(px, pz)) return [px, pz]; } return [x, z]; }
  const poiW = n => { const p = D.pois.find(p => p.n === n); return p ? W([p.x, p.y]) : null; };
  let sx, sz;
  if (C.start.beach) { const c = centroidBig(D.beach); [sx, sz] = W(c); }
  else { const p = poiW(C.start.poi) || [0, 0]; [sx, sz] = p; }
  [sx, sz] = nearestWalk(sx, sz);
  if (C.start.off) { // POI에서 조금 떨어진 보행로(대상이 화면 앞에 보이도록)
    let best = null; for (let a = 0; a < 48; a++) for (const r of [C.start.off, C.start.off * 1.4, C.start.off * .7]) { const px = sx + Math.cos(a / 48 * 6.283) * r, pz = sz + Math.sin(a / 48 * 6.283) * r; if (isWalkable(px, pz) && isWalkable(px + .6, pz) && isWalkable(px, pz + .6)) { best = [px, pz]; break; } if (best) break; }
    if (best) { const tgt = [sx, sz]; [sx, sz] = best; C._tgt = tgt; }
  }
  let rot = 0; const faceTo = (tx, tz) => Math.atan2(tx - sx, tz - sz);
  if (C.face === 'bridge' && bridgeInfo) rot = faceTo(bridgeInfo.mid[0], bridgeInfo.mid[1]);
  else if (C.face.startsWith('poi:')) { const p = poiW(C.face.slice(4)); if (p) rot = faceTo(p[0], p[1]); }
  else if (C.face === 'sea') { let best = 0, bd = 1e9; for (let a = 0; a < 64; a++) for (let r = 4; r < 160; r += 4) { const px = sx + Math.sin(a / 64 * 6.283) * r, pz = sz + Math.cos(a / 64 * 6.283) * r; if (!isLand(px, pz)) { if (r < bd) { bd = r; best = a / 64 * 6.283; } break; } } rot = best; }
  else if (C.face === 'downhill') { let best = 0, bh = 1e9; for (let a = 0; a < 32; a++) { const h = rawH(sx + Math.sin(a / 32 * 6.283) * 40, sz + Math.cos(a / 32 * 6.283) * 40); if (h < bh) { bh = h; best = a / 32 * 6.283; } } rot = best; }
  if (C.start.vista) { // v3.7: 비탈 위 트인 곳에서 아래 마을(색색 지붕)을 내려다보는 시작점(연출용 시점 선택)
    let best = null, bs = -1e9; const ox = sx, oz = sz;
    for (let r = 0; r <= C.start.vista; r += 3) for (let a = 0; a < 24; a++) {
      const px = ox + Math.cos(a / 24 * 6.283) * r, pz = oz + Math.sin(a / 24 * 6.283) * r; if (!isWalkable(px, pz)) continue;
      let open = 0; for (let d = -6; d <= 8; d += 1) for (const o of [-1.2, 0, 1.2]) { /* 사방 트임 */ if (isWalkable(px + d * .7, pz + o) && isWalkable(px + o, pz + d * .7)) open++; }
      for (let b = 0; b < 16; b++) { const dx = Math.sin(b / 16 * 6.283), dz = Math.cos(b / 16 * 6.283);
        let clearAhead = true; for (let d = 1; d <= 7; d++) if (!isWalkable(px + dx * d, pz + dz * d)) { clearAhead = false; break; }
        if (!clearAhead) continue;
        const drop = rawH(px, pz) - rawH(px + dx * 45, pz + dz * 45);
        const sc = drop * 1.0 + open * 0.15 - r * 0.05; if (sc > bs) { bs = sc; best = [px, pz, Math.atan2(dx, dz)]; } }
    }
    if (best) { [sx, sz] = best; rot = best[2]; }
  }
  { // 카메라 뒤쪽(약 5단위)이 건물에 막히지 않도록 방향을 조금씩 돌려 확인
    const clear = r => { for (let d = 1; d <= 5.5; d += .5) for (const o of [-.6, 0, .6]) { const px = sx - Math.sin(r) * d + Math.cos(r) * o, pz = sz - Math.cos(r) * d - Math.sin(r) * o; if (!isWalkable(px, pz) && isLand(px, pz)) return false; } return true; };
    const turn = () => { if (clear(rot)) return true; for (let k = 1; k <= 16; k++) { const c = [rot + k * Math.PI / 16, rot - k * Math.PI / 16].find(clear); if (c !== undefined) { rot = c; return true; } } return false; };
    if (!turn()) { const ox = sx, oz = sz, r0 = rot; let ok = false; // 좁은 골목이면 주변의 트인 보행로로 이동
      for (let r = 3; r <= 45 && !ok; r += 3) for (let a = 0; a < 24 && !ok; a++) { const px = ox + Math.cos(a / 24 * 6.283) * r, pz = oz + Math.sin(a / 24 * 6.283) * r; if (!isWalkable(px, pz)) continue; sx = px; sz = pz; rot = r0; ok = turn(); }
      if (!ok) { sx = ox; sz = oz; rot = r0; } }
  }
  let goal = null;
  if (C.goal === 'beachEnd') { const c = centroidBig(D.beach); const ring = D.beach.reduce((a, p) => p[0].length > a.length ? p[0] : a, []); let far = null, fd = 0; for (const q of ring) { const d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (d > fd) { fd = d; far = q; } } const [gx, gz] = W([(far[0] + c[0]) / 2 * 1 + (far[0] - c[0]) * .3, (far[1] + c[1]) / 2 + (far[1] - c[1]) * .3]); goal = nearestWalk(gx, gz); }
  else if (C.goal.startsWith('poi:')) { const p = poiW(C.goal.slice(4)); if (p) goal = nearestWalk(p[0], p[1]); }
  const cxm = (B.x0 + B.x1) / 2, czm = (B.z0 + B.z1) / 2;
  const topView = { cx: cxm, cz: czm, span: Math.max(WZ, WX / 1.78) };
  const stats = { buildings: nb, trees: treePts.length, lamps: lampPts.length, labels: labels.length };
  function dispose() { group.traverse(o => { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { m.map?.dispose(); m.dispose(); } }); scene.remove(group); }
  let seeTarget = null; // v3.7: 시작 장면에서 보여줄 대상(맵 특징)
  if (C.see === 'bigbld') { const area = p => { let a = 0; for (let k = 0; k < p.length; k++) { const q = p[k], r = p[(k + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return Math.abs(a / 2); };
    const bs = D.buildings.filter(b => b.p && b.p.length > 2).sort((a, b) => area(b.p) - area(a.p)).slice(0, 4); if (bs.length) { let x = 0, y = 0, n = 0; for (const b of bs) for (const q of b.p) { x += q[0]; y += q[1]; n++; } seeTarget = W([x / n, y / n]); } }
  else if (C.see && C.see.startsWith('poi:')) seeTarget = poiW(C.see.slice(4));
  let fixedStart = false;
  if (C.vantage && C.vantage.fixed) { const p = poiW(C.vantage.poi), q = poiW(C.vantage.look); if (p && q) { [sx, sz] = nearestWalk(p[0] + C.vantage.dx, p[1] + C.vantage.dz); const g2 = poiW(C.vantage.poi); const mx = q[0] * .8 + g2[0] * .2 + 9, mz = q[1] * .8 + g2[1] * .2; void g2; rot = Math.atan2(mx - sx, mz - sz); fixedStart = true;
    { // v3.9 시작 화면 앞 바닷가 쪽 삼층석탑(연출: 위치는 구도용, 형태는 한국 석탑 일반형) — 코드로 만든 화강암 상자
      const [tx, tz] = nearestWalk(sx + Math.sin(rot) * 9 + Math.cos(rot) * 4.5, sz + Math.cos(rot) * 9 - Math.sin(rot) * 4.5); const gm = new THREE.MeshStandardMaterial({ color: 0xc9c3b6, roughness: .9 }); const tg2 = new THREE.Group(); let y = 0;
      const box = (w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), gm); m.position.y = y + h / 2; m.castShadow = true; tg2.add(m); y += h; };
      box(2.2, .35); box(1.8, .5); for (let k = 0; k < 3; k++) { box(1.1 - k * .18, .55 - k * .08); box(1.9 - k * .3, .16); }
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .7, 6), gm); fin.position.y = y + .35; tg2.add(fin);
      tg2.position.set(tx, rawH(tx, tz) - .05, tz); tg2.rotation.y = rot; group.add(tg2); } } } // v3.9: 바닷가 길에서 법당·대불·바다가 한 화면에 들어오는 지정 시점
  return { clearLampsNear, seeSea: !!C.vantage, seeTarget: fixedStart ? null : seeTarget, occluders, id, name: C.name, note: C.note, group, isWalkable, heightAt, isLand, waterNear, walkMeshes: [terrain], setTime, update, topPreview() {}, start: { x: sx, z: sz, rot, fixed: fixedStart, camDist: fixedStart ? C.vantage.cam : undefined }, goal, bounds: B, topView, pois, stats, fogMul: C.fogMul || 1, dispose, bridge: bridgeInfo, droneStart: v39.droneStart, droneInfo: v39.droneInfo, v39: v39.extras };
}
