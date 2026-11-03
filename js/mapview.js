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
export async function topRect(id) { const D = await load(id), [bx0, by0, bx1, by1] = bbOf(id, D); return { x0: bx0 * S, x1: bx1 * S, z0: -by1 * S, z1: -by0 * S }; }
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
// v3.9g: 렉 수정 — 열 때마다 3D 탑뷰를 다시 렌더(6x 스로틀 2.3초 블록)하던 것을, 미리 캡처한 인게임 탑뷰 이미지(data/top/<id>.webp)로 교체.
// 배경은 열 때·크기 바뀔 때 한 번만 그리고, 0.25초마다 내 위치 화살표만 덧그림. 현재 접속한 맵만 표시.
const topImg = {};
function loadTop(id, renderTop) {
  return topImg[id] ??= (async () => {
    try { const meta = await (await fetch(`data/top/${id}.json?v=39i`)).json(); const img = new Image(); img.decoding = 'async'; img.src = `data/top/${id}.webp?v=39i`; await img.decode(); return { img, pois: meta.pois || [] }; }
    catch (e) { console.warn('top image', e); const D = await load(id), [bx0, by0, bx1, by1] = bbOf(id, D); return renderTop ? renderTop(id, { x0: bx0 * S, x1: bx1 * S, z0: -by1 * S, z1: -by0 * S }) : null; }
  })();
}
export function initMapView({ renderTop, maps, getCur, getMe }) {
  const btn = document.createElement('button'); btn.id = 'btnMap'; btn.title = '지도 보기'; btn.textContent = '🗺️';
  document.querySelector('.top-right').insertBefore(btn, document.querySelector('#btnSound'));
  const pan = document.createElement('div'); pan.id = 'mapView'; pan.className = 'glass panel mapview';
  pan.innerHTML = `<div class="mvh"><b>게임 맵 · <span class="mvname"></span></b><button class="mvx" title="닫기">✕</button></div><div class="mvwrap"><canvas></canvas><div class="mvlg"><span class="me">▲ 내 위치·방향</span></div></div><p class="mvnote"></p>`;
  document.body.appendChild(pan);
  const cv = pan.querySelector('canvas'); let timer = 0, tok = 0, base = null, D = null, top = null, id = null;
  function paintBase() { // 배경(이미지·라벨·축척)을 오프스크린에 한 번
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr; base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height; base.clientWidth0 = W;
    const fake = { clientWidth: W, clientHeight: H, set width(v) {}, set height(v) {}, getContext: () => base.getContext('2d') };
    draw(fake, id, D, null, top);
  }
  function tick() { if (!base) return; const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(base, 0, 0); drawMe(g, getMe()); }
  function drawMe(g, me) {
    const dpr = cv.width / cv.clientWidth, W = cv.clientWidth, H = cv.clientHeight, [bx0, by0, bx1, by1] = bbOf(id, D), k = Math.min(W / (bx1 - bx0), H / (by1 - by0)), ox = (W - (bx1 - bx0) * k) / 2, oy = (H - (by1 - by0) * k) / 2;
    const a = ox + (me.x / S - bx0) * k, b = oy + (by1 + me.z / S) * k; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.save(); g.translate(a, b); g.rotate(Math.atan2(Math.cos(me.rot), Math.sin(me.rot)) - Math.PI / 2);
    g.fillStyle = 'rgba(240,122,42,.25)'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.fillStyle = '#f07a2a'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 12); g.lineTo(8, -7); g.lineTo(0, -3); g.lineTo(-8, -7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  async function show() {
    const my = ++tok; id = getCur(); const m = maps.find(x => x.id === id); pan.querySelector('.mvname').textContent = m ? m.name : id;
    pan.querySelector('.mvnote').textContent = NOTE[id] || ''; base = null;
    const g = cv.getContext('2d'); cv.width = cv.clientWidth; cv.height = cv.clientHeight; g.fillStyle = '#3f8fb5'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff'; g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillText('게임 맵 불러오는 중…', cv.width / 2, cv.height / 2);
    D = await load(id); top = await loadTop(id, renderTop); if (my !== tok || !pan.classList.contains('open')) return; paintBase(); tick();
  }
  const open = o => { pan.classList.toggle('open', o); clearInterval(timer); if (o) { show(); timer = setInterval(() => { if (id !== getCur()) show(); else tick(); }, 250); } };
  btn.onclick = () => open(!pan.classList.contains('open'));
  pan.querySelector('.mvx').onclick = () => open(false);
  addEventListener('resize', () => { if (pan.classList.contains('open') && D) { paintBase(); tick(); } });
  return { open, show, get isOpen() { return pan.classList.contains('open'); } };
}
