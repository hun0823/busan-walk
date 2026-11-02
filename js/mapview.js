// 지도 뷰어(v3.9): 실지도를 그리지 않고, 게임 월드(world-gen/world.js가 만든 메시)를 정사영 탑뷰로 렌더한 이미지 + 게임 속 장소명 라벨 + 내 위치·방향
// 지도 뷰어(v3.8): data/<id>.json(OSM 실측, ODbL)과 고도(Copernicus DEM)로 위에서 본 지도를 캔버스에 직접 그림.
// 현재 맵만 내 위치·방향 화살표 표시. 다른 맵 탭은 지도만. 3D 월드를 불러오지 않음(데이터만 fetch).
const S = 0.3; // 월드 = 미터 × 0.3 (world.js·world-gen.js 와 동일), 월드 z = -y
const cache = {};
const NOTE = { // 연출(실제와 다름) 표시
  bukhang: '연출: 공원 보행로→유리 데크 연결 경사로(점선, OSM상 약 1.8m 틈을 메움) · 게임 속 나무·가로등 배치',
  gwangalli: '연출: 게임 속 나무·가로등 배치, 건물 높이 · 바다는 OSM 해안선 바깥',
  hwangnyeong: '연출: 게임 속 숲(나무 배치·밀도)은 실측 아님 · 등산로·봉수대 위치는 OSM',
  yonggungsa: '연출: 게임 속 나무 배치, 건물 높이·색 · 절 건물 윤곽은 OSM',
  gamcheon: '연출: 집 색깔(파스텔)·건물 높이·나무 배치 · 골목·건물 윤곽은 OSM',
};
const rings = (a, out = []) => { for (const r of a || []) { const p = r && (r.p || r.poly || r); if (!Array.isArray(p) || !p.length) continue; if (typeof p[0][0] === 'number') out.push(p); else rings(p, out); } return out; };
async function load(id) { return cache[id] ??= (await fetch(`data/${id}.json`)).json(); }
function bbOf(id, D) {
  if (D.bb) return D.bb;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; // 북항: 공원 영역 + 여유
  for (const poly of rings([...D.parkGround, ...D.park])) for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 80; return [x0 - m, y0 - m, x1 + m, y1 + m];
}
function draw(cv, id, D, me, top) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [bx0, by0, bx1, by1] = bbOf(id, D), k = Math.min(W / (bx1 - bx0), H / (by1 - by0)), ox = (W - (bx1 - bx0) * k) / 2, oy = (H - (by1 - by0) * k) / 2;
  const P = (x, y) => [ox + (x - bx0) * k, oy + (by1 - y) * k];
  g.fillStyle = '#3f8fb5'; g.fillRect(0, 0, W, H); // 게임 속 바다색
  if (top) { g.imageSmoothingQuality = 'high'; g.drawImage(top.img, ox, oy, (bx1 - bx0) * k, (by1 - by0) * k); } // 게임 월드 탑뷰 렌더(땅·물·길·건물·나무 메시 그대로)
  else { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 13px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('게임 맵 불러오는 중…', W / 2, H / 2); }
  // 이름 라벨: 게임 속 장소명(게임 월드에 세운 라벨과 같은 목록)
  g.font = '700 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const boxes = []; if (me) { const [ma, mb] = P(me.x / S, -me.z / S); boxes.push([ma, mb + 10, 30]); } const nLab = boxes.length + 2; // 라벨은 장소 이름 1~2개만, 겹치지 않게
  for (const p of (top && top.pois) || []) { if (boxes.length >= nLab) break; { const [a, b] = P(p.x / S, -p.z / S), tw = g.measureText(p.n).width + 12; if (a < 6 || b < 6 || a > W - 6 || b > H - 6 || boxes.some(q => Math.abs(q[0] - a) < (q[2] + tw) / 2 + 6 && Math.abs(q[1] - b) < 24)) continue; boxes.push([a, b, tw]); } const [a, b] = P(p.x / S, -p.z / S); if (a < 6 || b < 6 || a > W - 6 || b > H - 6) continue; const tw = g.measureText(p.n).width + 12;
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(a - tw / 2, b - 20, tw, 16, 8); g.fill(); g.fillStyle = '#1f3a4a'; g.fillText(p.n, a, b - 12);
    g.fillStyle = '#f07a2a'; g.beginPath(); g.arc(a, b, 3, 0, 7); g.fill(); }
  g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  // 축척 막대(실측 미터)
  const m100 = 100 * k, sb = m100 < 40 ? 200 : 100; g.fillStyle = '#fff'; g.fillRect(10, H - 14, sb * k, 3); g.font = '600 10px system-ui'; g.textAlign = 'left'; g.fillText(`${sb} m`, 10, H - 18);
  g.font = '700 12px system-ui'; g.fillText('N ↑', W - 34, 16);
  if (me) { // 내 위치·방향: 월드(x,z,rot) → 미터
    const [a, b] = P(me.x / S, -me.z / S), dx = Math.sin(me.rot), dy = Math.cos(me.rot); // 캔버스 아래 = 월드 +z
    g.save(); g.translate(a, b); g.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    g.fillStyle = 'rgba(240,122,42,.25)'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.fillStyle = '#f07a2a'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 12); g.lineTo(8, -7); g.lineTo(0, -3); g.lineTo(-8, -7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
export function initMapView({ renderTop, maps, getCur, getMe }) {
  const btn = document.createElement('button'); btn.id = 'btnMap'; btn.title = '지도 보기'; btn.textContent = '🗺️';
  document.querySelector('.top-right').insertBefore(btn, document.querySelector('#btnSound'));
  const pan = document.createElement('div'); pan.id = 'mapView'; pan.className = 'glass panel mapview';
  pan.innerHTML = `<div class="mvh"><b>게임 맵</b><button class="mvx" title="닫기">✕</button></div><div class="mvtabs">${maps.map(m => `<button data-id="${m.id}">${m.name}</button>`).join('')}</div><div class="mvwrap"><canvas></canvas><div class="mvlg"><span class="me">▲ 내 위치·방향</span></div></div><p class="mvnote"></p><p class="mvsrc">지도 © OpenStreetMap contributors (ODbL) · 고도 음영 Copernicus DEM(Open-Meteo)</p>`;
  document.body.appendChild(pan);
  const cv = pan.querySelector('canvas'); let tab = null, timer = 0;
  async function show(id) {
    tab = id; pan.querySelectorAll('.mvtabs button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const here = id === getCur(); pan.querySelector('.mvlg').style.display = here ? '' : 'none';
    pan.querySelector('.mvnote').textContent = (here ? '' : '다른 맵: 지도만 표시(내 위치 없음) · ') + NOTE[id];
    const D = await load(id); if (tab !== id) return; const [bx0, by0, bx1, by1] = bbOf(id, D);
    let top = null; try { top = renderTop ? await renderTop(id, { x0: bx0 * S, x1: bx1 * S, z0: -by1 * S, z1: -by0 * S }) : null; } catch (e) { console.warn('top view', e); }
    if (tab !== id) return; draw(cv, id, D, here ? getMe() : null, top);
  }
  const open = o => { pan.classList.toggle('open', o); clearInterval(timer); if (o) { show(getCur()); timer = setInterval(() => { if (tab === getCur()) show(tab); }, 500); } };
  btn.onclick = () => open(!pan.classList.contains('open'));
  pan.querySelector('.mvx').onclick = () => open(false);
  pan.querySelectorAll('.mvtabs button').forEach(b => b.onclick = () => show(b.dataset.id));
  addEventListener('resize', () => { if (pan.classList.contains('open')) show(tab); });
  return { open, show, get isOpen() { return pan.classList.contains('open'); } };
}
