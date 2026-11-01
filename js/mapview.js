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
function draw(cv, id, D, me) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [bx0, by0, bx1, by1] = bbOf(id, D), k = Math.min(W / (bx1 - bx0), H / (by1 - by0)), ox = (W - (bx1 - bx0) * k) / 2, oy = (H - (by1 - by0) * k) / 2;
  const P = (x, y) => [ox + (x - bx0) * k, oy + (by1 - y) * k];
  const poly = (rs, fill, stroke, lw = 1) => { for (const pts of rings(rs)) { g.beginPath(); pts.forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } } };
  const line = (ls, col, wmul = 1, min = .8, dash) => { g.strokeStyle = col; g.lineCap = g.lineJoin = 'round'; g.setLineDash(dash || []); for (const l of ls || []) { const pts = l.p || l; g.lineWidth = Math.max(min, (l.w || 3) * k * wmul); g.beginPath(); pts.forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); } g.setLineDash([]); };
  const SEA = '#7fb6d6', GROUND = '#efe6d2';
  g.fillStyle = id === 'bukhang' || D.coast ? SEA : GROUND; g.fillRect(0, 0, W, H);
  if (id === 'bukhang') {
    poly(D.outerGround, '#e6dcc6'); poly(D.parkGround, GROUND); poly(D.park, null, 'rgba(90,120,80,.5)', 1); poly(D.canal, SEA); poly(D.green, '#bcd9a2');
    poly(D.buildings, '#c9bba6', 'rgba(0,0,0,.12)', .5); line(D.roads, '#ffffff', 1, 1); line(D.paths, '#f6d9a8', 1.2, 1); line(D.bridgeLines, '#b48a5a', 1.4, 1.2);
    // 연출: 유리 데크 연결 경사로(world.js GLASS_LINK, 월드 좌표 → 미터)
    const L = [-29, 68.6, -24.6, 71.6]; line([[[L[0] / S, -L[1] / S], [L[2] / S, -L[3] / S]]], '#e0553a', 0, 2.5, [4, 3]);
  } else {
    if (D.coast) poly(D.land, GROUND); else { g.fillStyle = GROUND; g.fillRect(0, 0, W, H); }
    // 고도 음영(실측 DEM): 북서쪽 빛
    const N = D.elev.n, E = D.elev.v, mn = Math.min(...E), mx = Math.max(...E), cw = (bx1 - bx0) / (N - 1), chh = (by1 - by0) / (N - 1);
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const e = E[j * N + i], dx = E[j * N + i + 1] - e, dy = E[(j + 1) * N + i] - e, sh = (-dx + dy) / Math.max(cw, 1) * 1.2, t = (e - mn) / Math.max(1, mx - mn);
      const [a, b] = P(bx0 + i * cw, by0 + (j + 1) * chh); g.fillStyle = sh > 0 ? `rgba(255,255,240,${Math.min(.35, sh * .5)})` : `rgba(70,60,40,${Math.min(.35, -sh * .5)})`; g.fillRect(a, b, cw * k + 1, chh * k + 1);
      g.fillStyle = `rgba(120,150,90,${t * .18})`; g.fillRect(a, b, cw * k + 1, chh * k + 1);
    }
    poly(D.beach, '#f3dfa8'); poly(D.green, 'rgba(150,200,120,.75)'); poly(D.wood, 'rgba(110,165,95,.75)'); poly(D.water, SEA); poly(D.plaza, 'rgba(230,220,200,.9)', 'rgba(0,0,0,.1)', .5);
    if (D.coast) { // 육지 바깥(바다) 다시 칠해 음영 덮기
      g.save(); g.beginPath(); g.rect(0, 0, W, H); for (const r of rings(D.land)) r.forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fillStyle = SEA; g.fill('evenodd'); g.restore();
    }
    line(D.roads, '#ffffff', 1, 1.2); line(D.paths, '#fbeed6', 1, .9); line(D.bridge, '#9aa3ad', 0, 2.5);
    poly(D.buildings, id === 'gamcheon' ? '#d9b9a6' : '#cdbfaa', 'rgba(0,0,0,.18)', .4);
    g.font = '600 11px system-ui,sans-serif'; g.textAlign = 'center';
    const seen = new Set(); for (const p of D.pois || []) { if (!p.n || seen.has(p.n)) continue; seen.add(p.n); const [a, b] = P(p.x, p.y); if (a < 0 || b < 0 || a > W || b > H) continue; g.fillStyle = '#5a3a20'; g.beginPath(); g.arc(a, b, 2.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeText(p.n, a, b - 5); g.fillText(p.n, a, b - 5); }
  }
  // 축척 막대(실측 미터)
  const m100 = 100 * k, sb = m100 < 40 ? 200 : 100; g.fillStyle = '#333'; g.fillRect(10, H - 14, sb * k, 3); g.font = '600 10px system-ui'; g.textAlign = 'left'; g.fillText(`${sb} m`, 10, H - 18);
  g.font = '700 12px system-ui'; g.fillText('N ↑', W - 34, 16);
  if (me) { // 내 위치·방향: 월드(x,z,rot) → 미터
    const [a, b] = P(me.x / S, -me.z / S), dx = Math.sin(me.rot), dy = Math.cos(me.rot); // 캔버스 아래 = 월드 +z
    g.save(); g.translate(a, b); g.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    g.fillStyle = 'rgba(240,122,42,.25)'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.fillStyle = '#f07a2a'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 12); g.lineTo(8, -7); g.lineTo(0, -3); g.lineTo(-8, -7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
export function initMapView({ maps, getCur, getMe }) {
  const btn = document.createElement('button'); btn.id = 'btnMap'; btn.title = '지도 보기'; btn.textContent = '🗺️';
  document.querySelector('.top-right').insertBefore(btn, document.querySelector('#btnSound'));
  const pan = document.createElement('div'); pan.id = 'mapView'; pan.className = 'glass panel mapview';
  pan.innerHTML = `<div class="mvh"><b>지도</b><button class="mvx" title="닫기">✕</button></div><div class="mvtabs">${maps.map(m => `<button data-id="${m.id}">${m.name}</button>`).join('')}</div><div class="mvwrap"><canvas></canvas><div class="mvlg"><span class="me">▲ 내 위치·방향</span></div></div><p class="mvnote"></p><p class="mvsrc">지도 © OpenStreetMap contributors (ODbL) · 고도 음영 Copernicus DEM(Open-Meteo)</p>`;
  document.body.appendChild(pan);
  const cv = pan.querySelector('canvas'); let tab = null, timer = 0;
  async function show(id) {
    tab = id; pan.querySelectorAll('.mvtabs button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const here = id === getCur(); pan.querySelector('.mvlg').style.display = here ? '' : 'none';
    pan.querySelector('.mvnote').textContent = (here ? '' : '다른 맵: 지도만 표시(내 위치 없음) · ') + NOTE[id];
    const D = await load(id); if (tab !== id) return; draw(cv, id, D, here ? getMe() : null);
  }
  const open = o => { pan.classList.toggle('open', o); clearInterval(timer); if (o) { show(getCur()); timer = setInterval(() => { if (tab === getCur()) show(tab); }, 500); } };
  btn.onclick = () => open(!pan.classList.contains('open'));
  pan.querySelector('.mvx').onclick = () => open(false);
  pan.querySelectorAll('.mvtabs button').forEach(b => b.onclick = () => show(b.dataset.id));
  addEventListener('resize', () => { if (pan.classList.contains('open')) show(tab); });
  return { open, show, get isOpen() { return pan.classList.contains('open'); } };
}
