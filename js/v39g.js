// v3.9g 추가 연출 — 모두 Three.js 기본 도형·캔버스로 직접 만든 것(외부 이미지·모델·코드 없음).
// 물고기 모양, 광안리 조개·불가사리, 해변 펍·카페 꾸밈(간판·차양·테라스), '등킨드나스' 간판, 감천 순환 코스 데크·난간, 어린왕자 조형은 전부 연출(실제 위치·형태 재현 아님).
import * as THREE from 'three';
const rngF = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });

// 여러 지오메트리를 정점색과 함께 하나로(비인덱스)
function merge(parts) { const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal; const cc = typeof c === 'function' ? null : new THREE.Color(c);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const k = cc || c(p.getX(i), p.getY(i), p.getZ(i)); col.push(k.r, k.g, k.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }
const fin = (pts, depth = .06) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; };

// ---------- 물고기(연출): 옆으로 납작한 몸통 + 등지느러미 + 가슴지느러미 + 눈, 꼬리는 갈라진 지느러미 ----------
// 몸통 지오메트리는 인스턴스 스케일(.55,.7,1.1)이 곱해지므로 단위 공간에서 만든다. +z가 머리.
export function fishBodyGeo() {
  const body = new THREE.SphereGeometry(1, 16, 12); { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const t = z < 0 ? 1 + z * .45 : 1 - z * z * .12; p.setX(i, p.getX(i) * .62 * t); p.setY(i, p.getY(i) * (z < 0 ? 1 + z * .35 : 1)); } } // 꼬리 쪽으로 가늘게
  const belly = new THREE.Color(1.45, 1.48, 1.5), back = new THREE.Color(.72, .74, .8); // v3.9k: 은빛 배 더 밝게
  const bodyCol = (x, y) => new THREE.Color(1, 1, 1).lerp(y < 0 ? belly : back, Math.min(1, Math.abs(y) * 1.2));
  const dorsal = fin([[.4, 0], [-.05, .95], [-.6, .7], [-.8, 0]], .05); dorsal.rotateY(-Math.PI / 2); dorsal.translate(0, .78, 0);
  const pect = []; for (const sx of [-1, 1]) { const g = fin([[0, 0], [-.6, .26], [-.5, -.16]], .04); g.rotateX(Math.PI / 2); g.rotateY(sx * -Math.PI / 2 * .6); g.translate(sx * .55, -.25, .25); pect.push([g, 0xb8b8b8]); }
  const eyes = []; for (const sx of [-1, 1]) { const w = new THREE.SphereGeometry(.17, 10, 8); w.translate(sx * .5, .22, .62); eyes.push([w, 0xffffff]); const e = new THREE.SphereGeometry(.11, 10, 8); e.translate(sx * .58, .23, .66); eyes.push([e, 0x101014]); }
  return merge([[body, bodyCol], [dorsal, 0xb0b0b0], ...pect, ...eyes]);
}
// 꼬리: 몸통 끝(z=0)에서 -z로 갈라진 꼬리지느러미(세로 판)
export function fishTailGeo() { const g = fin([[0, .14], [-1.05, .95], [-.66, 0], [-1.05, -.95], [0, -.14]], .07); g.rotateY(-Math.PI / 2); return merge([[g, 0xd0d0d0]]); }

// ---------- 감천 순환 코스(연출): 나무 데크 + 난간 + 어린왕자 조형 ----------
export function addLoopDeck({ group, loopPts, rawH, C }) {
  const n = loopPts.length, W2 = 1.15, pos = [], idx = [];
  const at = k => loopPts[(k + n) % n];
  const side = k => { const [ax, az] = at(k - 1), [bx, bz] = at(k + 1); const l = Math.hypot(bx - ax, bz - az) || 1; return [-(bz - az) / l, (bx - ax) / l]; };
  for (let k = 0; k <= n; k++) { const [x, z] = at(k), [sx, sz] = side(k); for (const s of [-1, 1]) { const px = x + sx * W2 * s, pz = z + sz * W2 * s; pos.push(px, Math.max(rawH(px, pz), rawH(x, z)) + .05, pz); } if (k < n) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setIndex(idx); dg.computeVertexNormals();
  const deck = new THREE.Mesh(dg, M(0xb98f5e, { roughness: .9, side: THREE.DoubleSide })); deck.receiveShadow = true; group.add(deck);
  // 난간 기둥 + 손잡이(양옆)
  const postG = new THREE.BoxGeometry(.09, .9, .09); postG.translate(0, .45, 0); const NP = Math.floor(n / 2) * 2; const posts = new THREE.InstancedMesh(postG, M(0x7b5a3a), NP); const o = new THREE.Object3D(); let q = 0; const rails = [[], []];
  for (let k = 0; k < n; k++) { const [x, z] = at(k), [sx, sz] = side(k); for (const [j, s] of [[0, -1], [1, 1]]) { const px = x + sx * (W2 + .05) * s, pz = z + sz * (W2 + .05) * s, y = Math.max(rawH(px, pz), rawH(x, z)) + .05; rails[j].push(new THREE.Vector3(px, y + .88, pz)); if (k % 2 === 0 && q < NP) { o.position.set(px, y, pz); o.updateMatrix(); posts.setMatrixAt(q++, o.matrix); } } }
  posts.count = q; group.add(posts);
  const rm = M(0x8a6a48); for (const r of rails) { const c = new THREE.CatmullRomCurve3(r, true); group.add(new THREE.Mesh(new THREE.TubeGeometry(c, n * 2, .045, 5, true), rm)); }
  // 어린왕자 조형(연출): 고리의 '윗길' 꼭짓점 바깥쪽, 마을을 내려다보는 방향. 새로 만든 단순 도형 — 실제 조형물 재현 아님
  const [ax, az] = loopPts[0], [cx, cz] = C.loop.c; const ux = ax - cx, uz = az - cz, ul = Math.hypot(ux, uz); const px = ax + ux / ul * 2.1, pz = az + uz / ul * 2.1;
  const st = new THREE.Group(); const stone = M(0xb9b2a4, { roughness: .95 }), coat = M(0x3f7f6a), gold = M(0xf0c75a, { roughness: .5 }), skin = M(0xf2d7bf), scarf = M(0xf3e7a0);
  const add = (g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; st.add(me); return me; };
  add(new THREE.CylinderGeometry(.62, .7, .55, 20), stone, 0, .27, 0);                // 받침
  add(new THREE.ConeGeometry(.36, .95, 16), coat, 0, 1.02, 0);                          // 긴 코트
  add(new THREE.CylinderGeometry(.08, .08, .4, 8), coat, -.1, .62, 0); add(new THREE.CylinderGeometry(.08, .08, .4, 8), coat, .1, .62, 0); // 다리
  add(new THREE.SphereGeometry(.24, 16, 12), skin, 0, 1.62, 0);                          // 머리
  for (let k = 0; k < 7; k++) { const h = add(new THREE.ConeGeometry(.07, .2, 6), gold, Math.cos(k) * .13, 1.82, Math.sin(k) * .13); h.rotation.set(Math.sin(k) * .7, 0, -Math.cos(k) * .7); } // 삐죽한 금빛 머리
  const sc = add(new THREE.BoxGeometry(.5, .08, .1), scarf, .12, 1.38, -.05); sc.rotation.z = -.4; // 바람에 날리는 목도리
  st.position.set(px, rawH(px, pz), pz); st.rotation.y = Math.atan2(cx - px, cz - pz); group.add(st);
  C._statue = [px, pz]; window.__loop = { pts: loopPts, statue: [px, pz], cut: C._loopCut };
  return { statue: st };
}

// ---------- 광안리 해변(연출): 조개·불가사리 + 펍/카페 꾸밈 + '등킨드나스' ----------
function signTex(text, bg, fg, font = 'bold 64px sans-serif') { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, 496, 112); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function awningTex(a, b) { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 32); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function addBeachDecor({ D, group, W, rawH, isWalkable, isLand }) {
  const r = rngF(4242); const out = { shells: 0, stars: 0, shops: [] };
  const beachPolys = (D.beach || []).map(p => p[0].map(W)); if (!beachPolys.length) return out;
  const inPoly = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c; };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const ring of beachPolys) for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const spots = []; for (let t = 0; t < 6000 && spots.length < 260; t++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (!beachPolys.some(g => inPoly(g, x, z)) || !isLand(x, z)) continue; spots.push([x, z]); }
  // 조개: 납작한 반구 + 줄무늬 느낌(정점색), 불가사리: 다섯 갈래 별 판
  const shellG = new THREE.SphereGeometry(.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); shellG.scale(1, .35, .85);
  const starS = new THREE.Shape(); for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? .07 : .2; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; k ? starS.lineTo(px, py) : starS.moveTo(px, py); }
  const starG = new THREE.ExtrudeGeometry(starS, { depth: .04, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 1 }); starG.rotateX(-Math.PI / 2);
  const NS = Math.min(200, spots.length - 40), NT = Math.max(0, Math.min(40, spots.length - NS));
  const shells = new THREE.InstancedMesh(shellG, M(0xffffff, { roughness: .6 }), Math.max(1, NS)), stars = new THREE.InstancedMesh(starG, M(0xffffff, { roughness: .85 }), Math.max(1, NT));
  const o = new THREE.Object3D(), sc = [0xf6e9da, 0xf2cfc4, 0xe9dcc0, 0xffffff, 0xd9c2a5], tc = [0xf08a4b, 0xe46a4e, 0xf4a259];
  for (let i = 0; i < NS; i++) { const [x, z] = spots[i]; o.position.set(x, rawH(x, z) + .01, z); o.rotation.set(0, r() * 6.28, 0); o.scale.setScalar(.7 + r() * .7); o.updateMatrix(); shells.setMatrixAt(i, o.matrix); shells.setColorAt(i, new THREE.Color(sc[i % sc.length])); }
  for (let i = 0; i < NT; i++) { const [x, z] = spots[NS + i]; o.position.set(x, rawH(x, z) + .02, z); o.rotation.set(0, r() * 6.28, 0); o.scale.setScalar(.8 + r() * .6); o.updateMatrix(); stars.setMatrixAt(i, o.matrix); stars.setColorAt(i, new THREE.Color(tc[i % tc.length])); }
  shells.count = Math.max(0, NS); stars.count = NT; shells.receiveShadow = stars.receiveShadow = true; group.add(shells, stars); out.shells = NS; out.stars = NT;

  // 해변 쪽 건물 중 작은 것 몇 채: 해변 방향 벽에 간판·차양·테라스(펍/카페 연출)
  const ring = beachPolys.reduce((a, g) => g.length > a.length ? g : a, []);
  const nearBeach = (x, z) => { let bd = 1e9, bp = null; for (const [bx, bz] of ring) { const d = (bx - x) ** 2 + (bz - z) ** 2; if (d < bd) { bd = d; bp = [bx, bz]; } } return [Math.sqrt(bd), bp]; };
  const cand = []; for (const b of D.buildings) { if (!b.p || b.p.length < 3 || b.t === 'roof') continue; const pts = b.p.map(W); let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
    const [d, bp] = nearBeach(cx, cz); if (d > 22) continue; let rad = 0; for (const [x, z] of pts) rad = Math.max(rad, Math.hypot(x - cx, z - cz)); if (rad > 9 || rad < 2) continue; cand.push({ pts, cx, cz, d, bp, rad }); }
  cand.sort((a, b) => a.d - b.d); const pick = []; for (const c of cand) { if (pick.every(p => Math.hypot(p.cx - c.cx, p.cz - c.cz) > 9)) pick.push(c); if (pick.length >= 6) break; }
  const types = [{ k: 'cafe', name: '등킨드나스', bg: '#fff4e2', fg: '#d2572b', aw: ['#f08a4b', '#fff4e2'] }, { k: 'pub', name: 'PUB', bg: '#2b2018', fg: '#f5c46a', aw: ['#8b2d2d', '#2b2018'] }, { k: 'cafe', name: 'CAFE', bg: '#f4efe6', fg: '#3c6e57', aw: ['#3c6e57', '#f4efe6'] }, { k: 'pub', name: 'BEER', bg: '#1f2a36', fg: '#ffd27a', aw: ['#2f4f6f', '#e9e1cf'] }, { k: 'cafe', name: 'COFFEE', bg: '#fff', fg: '#7a4a2a', aw: ['#c9a27a', '#fff'] }, { k: 'pub', name: 'PUB', bg: '#3a1f1f', fg: '#ffcf8a', aw: ['#6b3a2a', '#e8d6b8'] }];
  const wood = M(0x6b4a2e), white = M(0xf2efe8), lightM = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  pick.forEach((c, i) => { const T = types[i % types.length];
    let nx = c.bp[0] - c.cx, nz = c.bp[1] - c.cz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; const tx = -nz, tz = nx;
    let front = 0, half = 0; for (const [x, z] of c.pts) { front = Math.max(front, (x - c.cx) * nx + (z - c.cz) * nz); half = Math.max(half, Math.abs((x - c.cx) * tx + (z - c.cz) * tz)); }
    const w = Math.min(6, half * 1.6), fx = c.cx + nx * (front + .05), fz = c.cz + nz * (front + .05), y0 = rawH(fx, fz), rot = Math.atan2(nx, nz);
    const g = new THREE.Group(); g.position.set(fx, y0, fz); g.rotation.y = rot; group.add(g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.2, w * .8), .8), new THREE.MeshStandardMaterial({ map: signTex(T.name, T.bg, T.fg), roughness: .7, emissive: 0xffffff, emissiveIntensity: .12, emissiveMap: null })); sign.position.set(0, 2.55, .06); g.add(sign);
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), new THREE.MeshStandardMaterial({ map: awningTex(...T.aw), side: THREE.DoubleSide, roughness: .8 })); aw.position.set(0, 1.95, .55); aw.rotation.x = -1.0; aw.castShadow = true; g.add(aw);
    const nT = Math.max(1, Math.min(3, Math.floor(w / 2))); for (let k = 0; k < nT; k++) { const lx = (k - (nT - 1) / 2) * 1.9, lz = 1.9; if (!isWalkable(fx + nx * lz + tx * lx, fz + nz * lz + tz * lx)) continue;
      const tb = new THREE.Group(); tb.position.set(lx, 0, lz); g.add(tb);
      if (T.k === 'pub') { const top = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .06, 14), wood); top.position.y = 1.05; tb.add(top); const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.05, 6), wood); leg.position.y = .52; tb.add(leg); const bar = new THREE.Mesh(new THREE.CylinderGeometry(.26, .3, .55, 12), M(0x8a5a32)); bar.position.set(.55, .27, 0); tb.add(bar); }
      else { const top = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .05, 14), white); top.position.y = .72; tb.add(top); const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .72, 6), white); leg.position.y = .36; tb.add(leg); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2, 6), white); pole.position.y = 1; tb.add(pole); const um = new THREE.Mesh(new THREE.ConeGeometry(.9, .35, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(T.aw[0]), roughness: .8 })); um.position.y = 2.05; tb.add(um); }
      for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(.32, .45, .32), T.k === 'pub' ? wood : white); ch.position.set(0, .22, s * .6); tb.add(ch); } }
    if (T.k === 'pub') for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 4), lightM); b.position.set((k / 8 - .5) * w, 2.12 - Math.sin(k / 8 * Math.PI) * .18, 1.25); g.add(b); } // 줄전구
    out.shops.push({ name: T.name, kind: T.k, x: +fx.toFixed(1), z: +fz.toFixed(1), rot }); });
  window.__beachDecor = out; return out;
}
