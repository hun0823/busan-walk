// 맵 레지스트리 + 걷기/높이 함수 파사드(현재 맵으로 교체되는 live binding)
import * as THREE from 'three';
import { buildWorld, isWalkable as bkWalk, heightAt as bkHeight } from './world.js?v=39d';
import { buildGenWorld } from './world-gen.js?v=39d';
export const MAPS = [
  { id: 'bukhang', name: '북항 친수공원', sub: '01', desc: '수로·다리·유리 데크' },
  { id: 'gwangalli', name: '광안리', sub: '02', desc: '해변 · 광안대교' },
  { id: 'hwangnyeong', name: '황령산', sub: '03', desc: '등산로 · 봉수대 전망' },
  { id: 'yonggungsa', name: '용궁사', sub: '04', desc: '바닷가 절 · 계단' },
  { id: 'gamcheon', name: '감천문화마을', sub: '05', desc: '계단식 골목 · 색색 집' },
];
export const mapById = id => MAPS.find(m => m.id === id);
export let isWalkable = bkWalk, heightAt = bkHeight;
const cache = {};
export async function getWorld(id, scene) {
  if (cache[id]) return cache[id];
  let w;
  if (id === 'bukhang') { const g = new THREE.Group(); g.name = 'map-bukhang'; scene.add(g); w = buildWorld(g); Object.assign(w, { id, name: '북항 친수공원', group: g, isWalkable: bkWalk, heightAt: bkHeight, fogMul: 1, topView: { cx: 100 * .3, cz: -90 * .3, span: 0 } }); }
  else w = await buildGenWorld(id, scene);
  w.group.visible = false;
  const _st = t => window.__step && window.__step(t);
  _st('가림 물체'); w.occluders = collectOccluders(w); // v3.7: 모든 맵 카메라 장애물 보정
  _st('시작 방향'); if (id !== 'gwangalli') fixStartRot(w); _st('가로등 정리');
  if (w.clearLampsNear && id !== 'gwangalli') w.start.lampsCleared = w.clearLampsNear(w.start.x, w.start.z, w.start.rot);
  return cache[id] = w;
}
export function setActive(w) { for (const k in cache) cache[k].group.visible = cache[k] === w; isWalkable = w.isWalkable; heightAt = w.heightAt; }

// 카메라 가림 판정용 메시: 세로로 솟은 물체(건물·가로등·나무·기둥). 지면·바다·하늘처럼 넓고 납작한 것은 제외
function collectOccluders(w) {
  const skip = new Set(w.walkMeshes || []); const out = []; const box = new THREE.Box3(), sz = new THREE.Vector3();
  w.group.updateMatrixWorld(true);
  w.group.traverse(o => {
    if (!o.isMesh || skip.has(o) || o.isSprite || !o.geometry) return;
    const m = o.material; if (m && (m.transparent && m.opacity < .5 || m.side === THREE.BackSide)) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); box.copy(g.boundingBox).getSize(sz);
    if (o.isInstancedMesh) { if (!o.count) return; const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(); o.getMatrixAt(0, m4); sc.setFromMatrixScale(m4); if (sz.y * sc.y * o.matrixWorld.elements[5] > 1.2) out.push(o); return; }
    box.copy(g.boundingBox).applyMatrix4(o.matrixWorld).getSize(sz);
    if (sz.y < 1.2 && !(g.type === 'SphereGeometry' && sz.y > .3)) return; // 납작한 것(지면·데크·물). 가로등 갓(구)은 포함
    if (sz.x > 600 || sz.z > 600) return; // 하늘·바다 등 아주 큰 것
    out.push(o);
  });
  return out;
}

// 시작 방향 보정: 카메라(뒤 7.2단위, 약간 위)와 캐릭터 사이, 그리고 앞쪽 시야 8단위에 가로등·나무·건물이 없도록 원래 방향에서 가장 가까운 각도를 고름
const START_PRE = { // tools 없이 데스크톱 크롬에서 기존 탐색으로 구한 결과(v3.9 데이터 기준)
  bukhang: { rot0: 1.3, x: -60.9, z: 97.5, rot: 0.12190275490382763, sc: 0.75 },
  hwangnyeong: { rot0: -0.6543401862819767, x: 23.61968491737253, z: -60.74424227783534, rot: -0.5888922696153108, sc: 0, see: true },
  gamcheon: { rot0: 0.3926875, x: -68.71441262676286, z: 64.54277662511427, rot: 0.3926875, sc: 0 },
};
function fixStartRot(w) {
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(); const s = w.start;
  const score = (x, z, r, fine) => { let n = 0; const h0 = w.heightAt(x, z), lx = Math.cos(r), lz = -Math.sin(r);
    const offs = []; for (let q = -1.2; q <= 1.21; q += fine ? .15 : .4) offs.push(q);
    for (const off of offs) for (const oy of [.5, 1.3]) { o.set(x + lx * off, h0 + oy, z + lz * off);
      for (const [len, sgn, py, yo] of [[7.6, -1, .36, 0], [7.6, -1, .2, 0], [4, 1, .05, 0], [3.5, 1, .05, .45], [3.5, 1, .05, -.45]]) { if (sgn > 0 && Math.abs(off) > .5) continue; const rr = r + yo; d.set(Math.sin(rr) * sgn * Math.cos(py), Math.sin(py), Math.cos(rr) * sgn * Math.cos(py)); rc.set(o, d); rc.near = .2; rc.far = len; if (rc.intersectObjects(w.occluders, false).length) n++; } }
    for (const yo of [-.7, 0, .7]) for (const dd of [3, 6]) { const px = x + Math.sin(r + yo) * dd, pz = z + Math.cos(r + yo) * dd; if (w.heightAt(px, pz) - h0 > dd * .55) n += 2; }
    for (let dd = 1; dd <= 7.5; dd += 1.5) { const px = x - Math.sin(r) * dd, pz = z - Math.cos(r) * dd; if (!w.isWalkable(px, pz)) n += .5; } // 카메라 뒤가 막힌 골목이면 감점
    return n; };
  const bestRot = (x, z, fine, steps) => { let best = s.rot, bn = 1e9; for (let k = 0; k <= steps; k++) for (const sg of k ? [1, -1] : [1]) { const r = s.rot + sg * k * Math.PI / steps, n = score(x, z, r, fine) + k / steps * 2; if (n < bn) { bn = n; best = r; } } return [best, bn]; };
  s.rot0 = s.rot; if (s.fixed) return;
  // v3.9d: 시작 지점 탐색(레이캐스트 수천 번)은 느린 기기(iPad)에서 수십 초~수 분 걸려 로딩이 멈춘 것처럼 보였음 → 같은 데이터면 미리 계산한 값 사용
  const pc = START_PRE[w.id]; if (pc && Math.abs(pc.rot0 - s.rot0) < 1e-6 && w.isWalkable(pc.x, pc.z)) { s.x = pc.x; s.z = pc.z; s.rot = pc.rot; s.startScore = pc.sc; if (pc.see) s.see = true; s.pre = true; return; }
  if (w.seeTarget) { // 대상(절·봉수대)이 보이는 자리: 대상까지 시선이 나무에 막히지 않고 12~40단위 떨어진 보행로
    const [tx, tz] = w.seeTarget; let bp = null, bs = 1e9;
    const sightHits = (x, z) => { const h0 = w.heightAt(x, z) + 1.6; o.set(x, h0, z); const L = Math.hypot(tx - x, tz - z); d.set(tx - x, (w.heightAt(tx, tz) + 3) - h0, tz - z).normalize(); rc.set(o, d); rc.near = 1; rc.far = Math.max(1, L - 4); return rc.intersectObjects(w.occluders, false).length; };
    for (let rr = w.seeSea ? 22 : 10; rr <= (w.seeSea ? 54 : 42); rr += 4) for (let a = 0; a < 32; a++) { const x = tx + Math.cos(a / 32 * 6.283) * rr, z = tz + Math.sin(a / 32 * 6.283) * rr; if (!w.isWalkable(x, z) || !w.isWalkable(x + .6, z) || !w.isWalkable(x, z + .6)) continue;
      let r0 = Math.atan2(tx - x, tz - z); let sc = sightHits(x, z) * 3 + score(x, z, r0, false) + Math.abs(rr - 22) * .05;
      if (w.seeSea) { // v3.9 용궁사: 대상 뒤·옆으로 바다가 함께 보이는 자리(바닷가 사찰 구도) + 가까운 큰 지붕 회피
        let sea = 0; for (let fa = -.5; fa <= .51; fa += .125) for (let fd = 15; fd <= 90; fd += 15) if (!w.isLand(x + Math.sin(r0 + fa) * fd, z + Math.cos(r0 + fa) * fd)) sea++;
        sc += sightHits(x, z) * 3 + Math.abs(rr - 32) * .03 - sea * .3; } if (sc < bs) { bs = sc; bp = [x, z, r0]; } }
    if (bp) { s.x = bp[0]; s.z = bp[1]; s.rot = bp[2]; s.startScore = +bs.toFixed(2); s.see = true; return; }
  }
  let [r, n] = bestRot(s.x, s.z, true, 24);
  if (n > 2 && w.id !== 'bukhang') { // 원래 자리 근처(25단위 안)에서 더 트인 보행로를 찾음
    let bp = null, bnn = n;
    for (let rr = 4; rr <= 24; rr += 5) for (let a = 0; a < 16; a++) { const x = s.x + Math.cos(a / 16 * 6.283) * rr, z = s.z + Math.sin(a / 16 * 6.283) * rr; if (!w.isWalkable(x, z)) continue; const [r2, n2] = bestRot(x, z, false, 8); const nn = n2 + rr * .06; if (nn < bnn) { bnn = nn; bp = [x, z]; } }
    if (bp) { s.x = bp[0]; s.z = bp[1]; [r, n] = bestRot(s.x, s.z, true, 24); }
  }
  s.rot = r; s.startScore = +n.toFixed(2);
}
