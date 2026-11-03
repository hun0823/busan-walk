// v3.9 추가 연출 — 광안리 해변·바다 페이드·광안대교 LED·드론쇼 / 황령산 봉수대·원경 야경 / 용궁사 전통 요소
// 모두 Three.js 기본 도형·캔버스·직접 작성 셰이더로 절차 생성(외부 이미지·모델·텍스처·코드 사용 안 함).
// 사실/연출 구분은 RESEARCH-v39.md·ASSETS.md 참고. 위치·크기·색·동작은 실제를 참고한 연출(정확한 재현 아님).
import * as THREE from 'three';
const S = 0.3;
const rngF = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------- 공용: 둥근 발광 점(Points) 셰이더 ----------
function glowPoints(n, { size = 1, atten = true, fog = false } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(new Float32Array(n).map((_, i) => (i * 0.61803) % 1), 1));
  const u = { uT: { value: 0 }, uA: { value: 1 }, uSize: { value: size }, uTw: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog,
    vertexShader: `attribute float seed; attribute vec3 color; varying vec3 vC; varying float vS; uniform float uT, uSize, uTw;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        float tw = 1. - uTw * (.5 + .5*sin(uT*(1.5+seed*3.) + seed*60.)); vS = tw;
        gl_PointSize = ${atten ? 'uSize * 300. / max(1., -mv.z)' : 'uSize'} * (0.7 + 0.6*tw); }`,
    fragmentShader: `varying vec3 vC; varying float vS; uniform float uA;
      void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; float a = smoothstep(.5, .0, r); a = a*a*(1.3) + smoothstep(.18,.0,r)*.6;
        gl_FragColor = vec4(vC * a * uA * (0.55 + 0.45*vS), 1.); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return { p, g, u, pos: g.attributes.position.array, col: g.attributes.color.array };
}

// ---------- 용궁사: 처마 끝이 올라간 우진각 기와지붕(연출) ----------
export function templeRoof(w, d, rh) {
  const NU = 18, NV = 18, pos = [], idx = [];
  const lw = Math.max(w, d), sw = Math.min(w, d), ridge = (lw - sw) / lw; // 용마루 길이 비율
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = i / NU * 2 - 1, v = j / NV * 2 - 1;
    const au = Math.abs(u), av = Math.abs(v);
    const su = Math.max(0, (au - ridge) / (1 - ridge)), m = Math.max(su, av);
    let y = rh * Math.pow(1 - m, 1.55);                 // 오목하게 휜 지붕면
    y += rh * .28 * Math.pow(au * av, 4);                // 추녀 끝 들림
    y += rh * .07 * Math.pow(Math.max(au, av), 6);       // 처마선 살짝 들림
    const x = u * lw / 2, z = v * sw / 2;
    pos.push(w >= d ? x : z, y, w >= d ? z : x);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  if (w < d) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } // x/z 교환 시 면 방향 보정(윗면 법선 +y)
  const top = new THREE.BufferGeometry(); top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setIndex(idx);
  const under = top.clone(); const ui = []; for (let k = 0; k < idx.length; k += 3) ui.push(idx[k], idx[k + 2], idx[k + 1]); under.setIndex(ui); under.translate(0, -.12, 0);
  return { top, under };
}

// =====================================================================
export function addV39(X) {
  const { id, D, C, group, W, B, rawH, isLand, painter, tc, tg, TK, groundTex, sea, bridge, bridgeMats, hash } = X;
  const ups = [], sets = []; const api = { setTime(c) { for (const f of sets) f(c); }, update(t, dt, cam) { for (const f of ups) f(t, dt, cam); }, droneStart: null, extras: {} };
  const TW = tc.width, TH = tc.height;

  // ---------------- 광안리 해변·바다 ----------------
  if (id === 'gwangalli' && D.coast) { const tmp = [], mkT = (w, h) => { const c = mk(w, h); tmp.push(c); return c; }; // v3.9c: 임시 캔버스는 다 쓰면 바로 해제(iPad Safari 캔버스 메모리 한도 대응)
    // (1) 지면 텍스처: 수중 모래 그라데이션 → 젖은 모래 띠 → 마른 모래 결·바람 물결무늬
    const seaM = mkT(TW, TH), sg = seaM.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, TW, TH); sg.globalCompositeOperation = 'destination-out'; painter(sg, TK).fill(D.land, '#000'); sg.globalCompositeOperation = 'source-over';
    const landM = mkT(TW, TH), lg = landM.getContext('2d'); painter(lg, TK).fill(D.land, '#000');
    const beachM = mkT(TW, TH), bg = beachM.getContext('2d'); painter(bg, TK).fill(D.beach, '#000');
    const layer = (src, blur, color, clip, mode = 'destination-in', alpha = 1) => { const c = mkT(TW, TH), g = c.getContext('2d'); g.filter = `blur(${blur}px)`; g.drawImage(src, 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, TW, TH); if (clip) { g.globalCompositeOperation = mode; g.drawImage(clip, 0, 0); } tg.globalAlpha = alpha; tg.drawImage(c, 0, 0); tg.globalAlpha = 1; };
    // 수중: 해안 가까이 모래빛 → 먼바다 청록
    layer(landM, 26 * TK / 4.87, '#c9b98d', landM, 'destination-out', .95);
    layer(landM, 10 * TK / 4.87, '#d8c79a', landM, 'destination-out', .9);
    // 마른 모래: 도로 쪽 밝게 → 물가 쪽 약간 짙게
    layer(seaM, 70, '#e6cf9c', beachM, 'destination-in', .75);
    // 결 노이즈·바람 물결 무늬(해변 안쪽만)
    { const c = mkT(TW, TH), g = c.getContext('2d'); const r = rngF(91);
      { const im = g.createImageData(TW, TH), d = im.data; // v3.9d: 모래 결 점을 ImageData로 한 번에(느린 기기에서 fillRect 37만 번 → 수십 ms)
        for (let k = 0, n = TW * TH / 9 | 0; k < n; k++) { const v = r(), al = v < .5 ? .08 + r() * .1 : .1 + r() * .14, i = ((r() * TH | 0) * TW + (r() * TW | 0)) * 4;
          if (v < .5) { d[i] = 120; d[i + 1] = 96; d[i + 2] = 60; } else { d[i] = 255; d[i + 1] = 250; d[i + 2] = 235; } d[i + 3] = al * 255; }
        g.putImageData(im, 0, 0); }
      g.lineWidth = 1; for (let k = 0; k < TW * TH / 900; k++) { const x = r() * TW, y = r() * TH, l = 6 + r() * 14; g.strokeStyle = `rgba(160,130,85,${.12 + r() * .12})`; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * .3, y - 2, x + l * .7, y + 2, x + l, y); g.stroke(); }
      for (let k = 0; k < 160; k++) { const x = r() * TW, y = r() * TH; g.fillStyle = `rgba(110,90,70,${.12 + r() * .15})`; g.beginPath(); g.ellipse(x, y, 2 + r() * 3, 1.2 + r() * 2, r() * 3, 0, 7); g.fill(); } // 발자국 자국 느낌(연출)
      g.globalCompositeOperation = 'destination-in'; g.drawImage(beachM, 0, 0); tg.drawImage(c, 0, 0); }
    // 젖은 모래 띠(물가 4~6단위) + 아주 젖은 가장자리
    layer(seaM, 22 * TK / 4.87, '#b99c6c', beachM, 'destination-in', .85);
    layer(seaM, 7 * TK / 4.87, '#a58a5e', beachM, 'destination-in', .7);
    { const c = mkT(TW, TH), g = c.getContext('2d'); g.filter = `blur(${3 * TK / 4.87}px)`; g.drawImage(seaM, 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, TW, TH); // 얇은 거품 자국
      g.globalCompositeOperation = 'destination-in'; g.drawImage(beachM, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(seaM, 0, 0); tg.globalAlpha = .55; tg.drawImage(c, 0, 0); tg.globalAlpha = 1; }
    groundTex.needsUpdate = true;
    for (const c of tmp) { c.width = c.height = 0; }
    api.extras.beachTex = true;
  }

  // ---------------- 바다: 해안 마스크 기반 얕은 물 투명 페이드 + 밀려오는 거품 ----------------
  if (sea && D.coast) {
    const MW = 1024, MH = Math.round(1024 * (B.z1 - B.z0) / (B.x1 - B.x0));
    const lc = mk(MW, MH), lg = lc.getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, MW, MH); painter(lg, MW / (B.x1 - B.x0)).fill(D.land, '#fff');
    const sc = mk(MW, MH), sgc = sc.getContext('2d'); const k = MW / (B.x1 - B.x0);
    sgc.fillStyle = '#000'; sgc.fillRect(0, 0, MW, MH); sgc.filter = `blur(${Math.round(14 * k)}px)`; sgc.drawImage(lc, 0, 0); sgc.filter = 'none'; sgc.globalAlpha = .55; sgc.filter = `blur(${Math.max(1, Math.round(2.5 * k))}px)`; sgc.drawImage(lc, 0, 0); sgc.filter = 'none'; sgc.globalAlpha = 1;
    // R: 넓은 흐림(얕은 정도) / G: 해안선 근처(거품 위치)
    lc.width = lc.height = 0; const shoreTex = new THREE.CanvasTexture(sc); shoreTex.colorSpace = THREE.NoColorSpace; shoreTex.minFilter = THREE.LinearFilter;
    const sm = sea.material; sm.transparent = true; sm.depthWrite = false; sea.renderOrder = 1;
    const su = { shoreTex: { value: shoreTex }, sb: { value: new THREE.Vector4(B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0) }, uT: { value: 0 }, uFoam: { value: 1 } };
    sm.onBeforeCompile = sh => { Object.assign(sh.uniforms, su);
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed,1.)).xyz;');
      sh.fragmentShader = 'varying vec3 vWp; uniform sampler2D shoreTex; uniform vec4 sb; uniform float uT, uFoam;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec2 suv = (vWp.xz - sb.xy) / sb.zw; float inb = step(0.,suv.x)*step(suv.x,1.)*step(0.,suv.y)*step(suv.y,1.);
        float s = texture2D(shoreTex, vec2(suv.x, 1.-suv.y)).r * inb;            // 0 먼바다 → 1 육지
        float shallow = smoothstep(.0, .45, s); diffuseColor.rgb = mix(diffuseColor.rgb, diffuse, shallow*.75);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.55,1.05,1.0) + vec3(.06,.16,.14), shallow*.8); // 얕은 곳 옥빛
        float n = sin(vWp.x*.21 + vWp.z*.13) * .5 + sin(vWp.x*.05 - vWp.z*.09 + 1.7)*.5;
        float ph = s*46. - uT*1.15 + n*1.4;
        float foam = pow(max(0., sin(ph)), 4.) * smoothstep(.12,.4,s) * (1.-smoothstep(.6,.72,s));
        float brk = smoothstep(.5,.6,s) * (1.-smoothstep(.66,.74,s)) * (.6 + .4*sin(vWp.x*.7 + uT*1.7 + n*3.));
        float f = clamp(foam*.85 + brk, 0., 1.) * uFoam;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.97,.99,1.), f);
        diffuseColor.a = mix(1., 0., smoothstep(.04, .64, s)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62,.78,.74), smoothstep(.35,.64,s)*.5); // v3.9g: 물가로 갈수록 완전히 투명 + 모래빛 옅은 물(연출) diffuseColor.a = max(diffuseColor.a, f*.9);`);
    };
    sm.needsUpdate = true;
    ups.push(t => { su.uT.value = t; });
    sets.push(c => { su.uFoam.value = .35 + .65 * Math.min(1, (c.sunVis ?? 1) + .25); });
  }

  // ---------------- 광안대교 LED(2024 교체 사실 참고, 패턴·색 변화는 연출) ----------------
  if (bridge && bridge.HALF) {
    const { mid, dir: [dx, dz], HALF, SIDE, deckBase, towerH, wHalf, deckY } = bridge; const nx = -dz, nz = dx;
    const at = (t, side, y) => new THREE.Vector3(mid[0] + dx * t + nx * side, y, mid[1] + dz * t + nz * side);
    const cabY = t => Math.abs(t) <= HALF ? deckBase + 2.5 + (towerH - deckBase - 2.5) * (t / HALF) ** 2 : towerH - (towerH - deckBase - 1) * Math.min(1, (Math.abs(t) - HALF) / SIDE);
    // 트러스 LED 줄(주경간 상판 양옆) — InstancedMesh
    const NT = 120, trussG = new THREE.BoxGeometry(.6, .6, 1);
    const trussM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); const truss = new THREE.InstancedMesh(trussG, trussM, NT * 4);
    const o3 = new THREE.Object3D(); let ti = 0; const trussT = [];
    for (const sd of [-1, 1]) for (const lv of [0, 1]) for (let k = 0; k < NT; k++) { const t = -HALF - SIDE * .6 + (2 * HALF + SIDE * 1.2) * (k + .5) / NT; const p = at(t, sd * (wHalf - .6), deckY(mid[0] + dx * t, mid[1] + dz * t) + (lv ? 2.9 : -.5)); o3.position.copy(p); o3.rotation.set(0, Math.atan2(dx, dz), 0); o3.scale.set(1, 1, (2 * HALF + SIDE * 1.2) / NT * .85); o3.updateMatrix(); truss.setMatrixAt(ti, o3.matrix); truss.setColorAt(ti, new THREE.Color(0)); trussT.push(t); ti++; }
    truss.frustumCulled = false; group.add(truss);
    // 행어 로프 LED(정점색 선)
    const hp = [], hc = [], hT = []; for (const sd of [-1, 1]) for (let k = 0; k <= 70; k++) { const t = -HALF - SIDE + (2 * HALF + 2 * SIDE) * k / 70; if (Math.abs(Math.abs(t) - HALF) < 2) continue; const yTop = cabY(t), yb = deckY(mid[0] + dx * t, mid[1] + dz * t) + 2.8; const a = at(t, sd * wHalf, yTop), b = at(t, sd * wHalf, yb); hp.push(a.x, a.y, a.z, b.x, b.y, b.z); hc.push(0, 0, 0, 0, 0, 0); hT.push(t, t); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
    const hangers = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); hangers.visible = false; group.add(hangers);
    // 주케이블 발광 점(4색 RGBW 변화)
    const NC = 260, cab = glowPoints(NC, { size: 4.5, atten: false }); const cabT = [];
    for (let k = 0; k < NC; k++) { const sd = k < NC / 2 ? -1 : 1, kk = k % (NC / 2); const t = -HALF - SIDE + (2 * HALF + 2 * SIDE) * kk / (NC / 2 - 1); const p = at(t, sd * wHalf, cabY(t) + .2); cab.pos.set([p.x, p.y, p.z], k * 3); cabT.push(t); }
    cab.g.attributes.position.needsUpdate = true; cab.p.visible = false; group.add(cab.p);
    // 주탑 투광(연출)
    const towerGlow = glowPoints(48, { size: 6, atten: false }); { let q = 0; for (const sg of [-1, 1]) for (const sd of [-1, 1]) for (let k = 0; k < 12; k++) { const p = at(sg * HALF, sd * wHalf, 4 + k * (towerH - 3) / 11); towerGlow.pos.set([p.x, p.y, p.z], q * 3); towerGlow.col.set([1, .92, .78], q * 3); q++; } }
    towerGlow.g.attributes.position.needsUpdate = towerGlow.g.attributes.color.needsUpdate = true; towerGlow.p.visible = false; group.add(towerGlow.p);
    // 무빙라이트 12대(빔) — 연출
    const beamG = new THREE.CylinderGeometry(.12, 2, 42, 10, 1, true); beamG.translate(0, 21, 0);
    const beamM = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beams = []; for (let k = 0; k < 12; k++) { const sg = k < 6 ? -1 : 1, j = k % 6; const t = sg * HALF + (j - 2.5) * 6; const b = new THREE.Mesh(beamG, beamM); b.position.copy(at(t, (j % 2 ? 1 : -1) * wHalf, deckY(mid[0] + dx * t, mid[1] + dz * t) + 3)); b.visible = false; group.add(b); beams.push(b); }
    // 수면 반사(세로 줄무늬 띠, 가산 혼합) — 연출
    const rc = mk(64, 256), rg = rc.getContext('2d'); { const r = rngF(5); for (let x = 0; x < 64; x++) { const a = .15 + r() * .6; const gr = rg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.5, `rgba(255,255,255,${a * .45})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); rg.fillStyle = gr; for (let y = 0; y < 256; y += 1 + r() * 3) rg.fillRect(x, y, 1, 1 + r() * 3); } }
    const bc = bridge.beach || mid; const toB = Math.sign((bc[0] - mid[0]) * nx + (bc[1] - mid[1]) * nz) || 1; const bDist = Math.abs((bc[0] - mid[0]) * nx + (bc[1] - mid[1]) * nz); const RW = Math.max(40, bDist * .8);
    const rTex = new THREE.CanvasTexture(rc); rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping; rTex.repeat.set(18, 1);
    const reflU = { map: { value: rTex }, uT: { value: 0 }, uA: { value: 0 }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() } };
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF + 2 * SIDE, RW), new THREE.ShaderMaterial({ uniforms: reflU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform sampler2D map; uniform float uT, uA; uniform vec3 c1, c2; varying vec2 vU;
        void main(){ vec2 u = vec2(vU.x*18., 1.-vU.y); u.x += sin(u.y*30. + uT*2.)*.02; u.y += uT*.05; float s = texture2D(map, u).r; float fall = pow(vU.y, 1.3);
          float edge = smoothstep(0.,.08,vU.x)*smoothstep(1.,.92,vU.x); vec3 c = mix(c1, c2, .5+.5*sin(vU.x*12. - uT*.6));
          gl_FragColor = vec4(c * s * fall * edge * uA, 1.); }` }));
    refl.rotation.x = -Math.PI / 2; refl.rotation.z = Math.atan2(dz, dx) * -1; // 띠의 길이 방향 = 교량 방향
    // 해변 쪽으로 펼쳐지도록 법선 방향 오프셋
    refl.geometry.rotateX(0); refl.position.set(mid[0] + nx * toB * RW / 2, -.28, mid[1] + nz * toB * RW / 2);
    // PlaneGeometry의 v=1(윗변)이 교량 쪽이 되도록 방향 보정
    { const tst = new THREE.Vector3(0, 1, 0).applyEuler(refl.rotation); if ((tst.x * nx + tst.z * nz) * toB > 0) refl.rotation.z += Math.PI; }
    refl.renderOrder = 2; refl.visible = false; group.add(refl);
    let night = 0; const tc = new THREE.Color(), tmp = new THREE.Color();
    const RGBW = [0xff3b5c, 0x37e27a, 0x3b7bff, 0xffffff].map(h => new THREE.Color(h));
    sets.push(c => { night = Math.max(0, Math.min(1, ((c.lamp ?? 0) - .6) / 1.6)); const on = night > .05; hangers.visible = cab.p.visible = towerGlow.p.visible = refl.visible = on; truss.visible = true; beams.forEach(b => b.visible = night > .5); });
    let acc = 0;
    ups.push((t, dt) => {
      reflU.uT.value = t; if (night <= .05) { if (acc !== -1) { for (let i = 0; i < truss.count; i++) truss.setColorAt(i, tmp.set(0x9aa6ae)); truss.instanceColor.needsUpdate = true; acc = -1; } return; }
      acc += dt; if (acc < 1 / 20 && acc >= 0) return; acc = 0;
      const mode = Math.floor(t / 24) % 4; // 24초마다 패턴 전환(연출)
      for (let i = 0; i < truss.count; i++) { const tt = trussT[i]; let h;
        if (mode === 0) h = (tt / 160 - t * .05) % 1; else if (mode === 1) h = .55 + .1 * Math.sin(tt * .05 + t); else if (mode === 2) h = Math.floor((tt + t * 25) / 18) % 10 / 10; else h = (.08 + .04 * Math.sin(tt * .03 - t * 1.4));
        tc.setHSL((h + 1) % 1, .9, .5 + .1 * Math.sin(tt * .2 + t * 3)); tc.multiplyScalar(.4 + .9 * night); truss.setColorAt(i, tc); }
      truss.instanceColor.needsUpdate = true;
      const ca = cab.col; const ci = Math.floor(t / 6) % 4, cn = (ci + 1) % 4, f = (t / 6) % 1;
      for (let k = 0; k < NC; k++) { const w = .5 + .5 * Math.sin(cabT[k] * .08 - t * 2.2); tmp.copy(RGBW[ci]).lerp(RGBW[cn], Math.min(1, Math.max(0, f * 2 - .5 + .3 * Math.sin(cabT[k] * .02)))).multiplyScalar((.5 + .5 * w) * night); ca[k * 3] = tmp.r; ca[k * 3 + 1] = tmp.g; ca[k * 3 + 2] = tmp.b; }
      cab.g.attributes.color.needsUpdate = true;
      const hcA = hg.attributes.color.array; for (let k = 0; k < hT.length; k += 2) { const tt = hT[k]; tc.setHSL(((tt / 90 + t * .04) % 1 + 1) % 1, .85, .55); const top = tc.clone().multiplyScalar(.9 * night), bot = tc.multiplyScalar(.35 * night); hcA.set([top.r, top.g, top.b, bot.r, bot.g, bot.b], k * 3); }
      hg.attributes.color.needsUpdate = true; towerGlow.u.uA.value = .6 * night; cab.u.uA.value = 1; cab.u.uT.value = t;
      beams.forEach((b, i) => { b.rotation.set(Math.sin(t * .5 + i) * .55, 0, Math.cos(t * .37 + i * 1.7) * .55); }); beamM.color.setHSL((t * .05) % 1, .5, .75);
      reflU.uA.value = 1.6 * night; reflU.c1.value.copy(RGBW[ci]).lerp(new THREE.Color(0x66ccff), .5); tc.setHSL((t * .04) % 1, .9, .55); reflU.c2.value.copy(tc);
    });
    api.extras.bridgeLED = { truss: truss.count, hangers: hT.length / 2, cable: NC, beams: beams.length };

    // ---------------- 드론쇼(연출): 해변과 대교 사이 바다 위 ----------------
    const ND = 600, dr = glowPoints(ND, { size: 1.5 }); dr.p.visible = false; group.add(dr.p);
    const cen = new THREE.Vector3(mid[0] + (bc[0] - mid[0]) * .42, 34, mid[1] + (bc[1] - mid[1]) * .42);
    const fx = new THREE.Vector3(bc[0] - cen.x, 0, bc[1] - cen.z).normalize(); const rx = new THREE.Vector3(fx.z, 0, -fx.x); // 해변을 향하는 평면
    const SW = 92, SH = 52;
    function sample(draw, cols) { const c = mk(220, 124), g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw(g); const px = g.getImageData(0, 0, 220, 124).data; const on = []; for (let y = 0; y < 124; y += 1) for (let x = 0; x < 220; x += 1) if (px[(y * 220 + x) * 4 + 3] > 128) on.push([x, y, px[(y * 220 + x) * 4], px[(y * 220 + x) * 4 + 1], px[(y * 220 + x) * 4 + 2]]);
      const r = rngF(on.length), out = []; for (let k = 0; k < ND; k++) { const q = on[Math.floor(r() * on.length)] || [110, 62, 255, 255, 255]; const u = (q[0] / 220 - .5) * SW + (r() - .5) * .3, v = (.5 - q[1] / 124) * SH + (r() - .5) * .3; const cc = cols ? cols(q, k) : [q[2] / 255, q[3] / 255, q[4] / 255]; out.push([u, v, cc]); } return out; }
    const heartP = (g, cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy + s * .35); g.bezierCurveTo(cx - s * 1.1, cy - s * .35, cx - s * .45, cy - s * 1.05, cx, cy - s * .45); g.bezierCurveTo(cx + s * .45, cy - s * 1.05, cx + s * 1.1, cy - s * .35, cx, cy + s * .35); };
    const SHAPES = [
      { n: '하트', f: sample(g => { g.lineWidth = 7; g.strokeStyle = '#ff4f8a'; heartP(g, 110, 70, 56); g.stroke(); g.fillStyle = 'rgba(255,140,180,1)'; heartP(g, 110, 70, 30); g.fill(); }) },
      { n: '고래', f: sample(g => { g.fillStyle = '#3fb6ff'; g.beginPath(); g.ellipse(100, 70, 62, 26, -.08, 0, 7); g.fill(); g.beginPath(); g.moveTo(155, 66); g.quadraticCurveTo(178, 52, 196, 30); g.lineTo(186, 62); g.lineTo(204, 80); g.quadraticCurveTo(180, 74, 158, 76); g.fill(); g.fillStyle = '#e8f7ff'; g.beginPath(); g.ellipse(92, 84, 46, 10, -.05, 0, 7); g.fill(); g.fillStyle = '#9fe0ff'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(70 + Math.sin(k) * 8, 38 - k * 3.2, 2.6, 0, 7); g.fill(); g.beginPath(); g.arc(70 + k * 2.6, 34 - k * 2.2, 2.2, 0, 7); g.fill(); } g.fillStyle = '#111'; g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(62, 66, 3.5, 0, 7); g.fill(); }) },
      { n: '광안대교', f: sample(g => { g.strokeStyle = '#7fd8ff'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(8, 92); g.lineTo(212, 92); g.stroke(); g.lineWidth = 5; for (const x of [62, 158]) { g.beginPath(); g.moveTo(x, 104); g.lineTo(x, 26); g.stroke(); } g.lineWidth = 3; g.strokeStyle = '#ffe36a'; g.beginPath(); g.moveTo(8, 70); g.quadraticCurveTo(35, 40, 62, 28); g.quadraticCurveTo(110, 110, 158, 28); g.quadraticCurveTo(185, 40, 212, 70); g.stroke(); g.lineWidth = 1.4; g.strokeStyle = '#c9a6ff'; for (let x = 70; x < 152; x += 7) { const y = 28 + (1 - ((x - 110) / 48) ** 2) * 0 + ((x - 110) / 48) ** 2 * 0; const yy = 28 + (82 - 28) * (1 - ((x - 110) / 48) ** 2) * .62; g.beginPath(); g.moveTo(x, yy); g.lineTo(x, 92); g.stroke(); } }) },
      { n: '별', f: sample(g => { g.fillStyle = '#ffd84a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 22 : 54; g.lineTo(110 + Math.cos(a) * r, 66 + Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = '#fff4c0'; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(30 + (k * 37) % 170, 12 + (k * 23) % 100, 1.8, 0, 7); g.fill(); } }) },
      { n: '강아지 발자국', f: sample(g => { g.fillStyle = '#ffb36b'; g.beginPath(); g.ellipse(110, 80, 30, 24, 0, 0, 7); g.fill(); for (const [x, y] of [[74, 46], [96, 30], [124, 30], [146, 46]]) { g.beginPath(); g.ellipse(x, y, 11, 14, 0, 0, 7); g.fill(); } }) },
      { n: 'BUSAN', f: sample(g => { g.fillStyle = '#ffffff'; g.font = '900 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUSAN', 110, 54); g.fillStyle = '#ff5f8f'; heartP(g, 110, 104, 13); g.fill(); }) },
    ];
    const grid = []; for (let k = 0; k < ND; k++) { const i = k % 30, j = Math.floor(k / 30); grid.push([(i / 29 - .5) * SW * .8, -SH * .5 - 30 + j * .01, [.6, .8, 1]]); } // 바다 위 대기(낮게)
    const gridUp = grid.map(([u, v], k) => [u, (Math.floor(k / 30) / 19 - .5) * SH * .8, [.75, .85, 1]]);
    const cur = new Float32Array(ND * 5); for (let k = 0; k < ND; k++) { cur[k * 5] = grid[k][0]; cur[k * 5 + 1] = grid[k][1]; }
    // 타임라인: 이륙(4s) → 격자(4s) → 모양마다 9s(전환 2.5s) → 착륙(5s)
    const SEQ = [grid, gridUp, ...SHAPES.map(s => s.f), gridUp, grid];
    const DUR = [0, 4, 6, ...SHAPES.map(() => 9), 5, 5]; const T0 = []; { let a = 0; for (const d of DUR) { a += d; T0.push(a); } }
    const TOTAL = T0[T0.length - 1];
    let showT = -1, manual = false, nightOK = false;
    const PERIOD = 300; // 시간 주기 연동 자동 반복(연출): 밤이면 5분마다 한 번
    api.droneStart = (at = 0) => { showT = Math.max(0, at); manual = true; window.dispatchEvent(new CustomEvent('bw-drone', { detail: { start: true } })); };
    api.droneInfo = () => ({ on: showT >= 0, t: showT, shape: shapeNow(), total: TOTAL, count: ND });
    const shapeNow = () => { if (showT < 0) return null; for (let i = 1; i < T0.length; i++) if (showT < T0[i]) return i >= 3 && i - 3 < SHAPES.length ? SHAPES[i - 3].n : i <= 2 ? '이륙' : '착륙'; return null; };
    sets.push(c => { nightOK = (c.lamp ?? 0) > 1.6; });
    let lastAuto = -1;
    ups.push((t, dt) => {
      const now = Date.now() / 1000, slot = Math.floor(now / PERIOD);
      if (!manual && nightOK && showT < 0 && now % PERIOD < 3 && slot !== lastAuto) { lastAuto = slot; showT = 0; window.dispatchEvent(new CustomEvent('bw-drone', { detail: { start: true, auto: true } })); }
      if (showT < 0) { dr.p.visible = false; return; }
      showT += dt; if (showT > TOTAL) { showT = -1; manual = false; dr.p.visible = false; return; }
      dr.p.visible = true; let i = 1; while (i < T0.length - 1 && showT >= T0[i]) i++;
      const A = SEQ[i - 1], Bq = SEQ[i], seg = DUR[i], lt = showT - T0[i - 1]; const tr = Math.min(1, lt / Math.min(seg, i >= 3 ? 2.5 : seg)); const e = tr * tr * (3 - 2 * tr);
      const P = dr.pos, Cc = dr.col; const fade = Math.min(1, showT / 2, (TOTAL - showT) / 2);
      for (let k = 0; k < ND; k++) { const a = A[k], b = Bq[k]; const dl = Math.min(1, Math.max(0, e * 1.3 - (k % 7) * .04)); const u = a[0] + (b[0] - a[0]) * dl, v = a[1] + (b[1] - a[1]) * dl + Math.sin(t * 1.3 + k) * .08;
        P[k * 3] = cen.x + rx.x * u; P[k * 3 + 1] = cen.y + v; P[k * 3 + 2] = cen.z + rx.z * u;
        const ca = a[2], cb = b[2]; for (let j = 0; j < 3; j++) Cc[k * 3 + j] = (ca[j] + (cb[j] - ca[j]) * dl) * fade * (1.1 + .25 * Math.sin(t * 4 + k * 1.7)); }
      dr.g.attributes.position.needsUpdate = dr.g.attributes.color.needsUpdate = true; dr.u.uT.value = t;
    });
    api.extras.drone = { count: ND, shapes: SHAPES.map(s => s.n), center: [cen.x, cen.y, cen.z] };
  }

  // ---------------- 황령산: 봉수대·송신탑·조명탑 + 원경 야경(연출) ----------------
  if (id === 'hwangnyeong') {
    const P = D.pois.find(p => p.n === '황령산 봉수대') || D.pois.find(p => p.k === 'peak'); const pk = D.pois.find(p => p.n === '황령산' && p.k === 'peak') || P;
    const [px, pz] = W([P.x, P.y]); const py = rawH(px, pz);
    const stone = new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 1, flatShading: true });
    // 봉수대(돌 원형 단 + 연조) — 실제 형태 참고 연출
    { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.2, 14), stone); base.position.y = .6; const chim = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.3, 2.2, 12), stone); chim.position.y = 2.2; const mouth = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .1, 12), new THREE.MeshStandardMaterial({ color: 0x2a2420, emissive: 0xff7a2a, emissiveIntensity: 0 })); mouth.position.y = 3.32;
      g.add(base, chim, mouth); const [bx, bz] = [px + 4, pz - 2]; g.position.set(bx, rawH(bx, bz) - .1, bz); group.add(g); sets.push(c => { mouth.material.emissiveIntensity = Math.max(0, (c.lamp ?? 0) - .5) * .6; }); }
    // 송신탑 3기 + 항공장애등(빨강 깜빡임) — KBS·MBC·KNN 송신소가 있다는 사실 참고, 위치·형태 연출
    const red = []; const towerM = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: .6, metalness: .3 }), towerR = new THREE.MeshStandardMaterial({ color: 0xd64b3c, roughness: .6 });
    [[-14, 10, 24], [-22, -6, 20], [12, 22, 17]].forEach(([ox, oz, h], i) => { const x = px + ox, z = pz + oz, y = rawH(x, z); const g = new THREE.Group();
      for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(.35 + (5 - k) * .12, .45 + (5 - k) * .12, h / 6, 4, 1, true), k % 2 ? towerR : towerM); seg.position.y = h / 12 + k * h / 6; g.add(seg); }
      const lt = new THREE.Mesh(new THREE.SphereGeometry(.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false })); lt.position.y = h + .3; g.add(lt); red.push(lt); g.position.set(x, y, z); group.add(g); });
    // 조명탑(시간·대기질에 따라 색이 바뀐다는 사실 참고 — 색 순환은 연출)
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 5, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3fa9ff, emissiveIntensity: 0, roughness: .4 }));
    { const x = px - 6, z = pz + 6; beacon.position.set(x, rawH(x, z) + 2.5, z); /* v3.9: 테스터가 본 '분홍 긴 막대' = 이 조명탑(색 순환). 굵기·높이를 줄여 정리 */ group.add(beacon); }
    // 전망 데크(동·남향 반원 목재 데크 + 난간, 2016 조성 사실 참고 — 형태 연출)
    { const deckM = new THREE.MeshStandardMaterial({ color: 0x9c7a55, roughness: .9 }); const railM = new THREE.MeshStandardMaterial({ color: 0x4d4a46, roughness: .5 });
      const cx = px + 7, cz = pz + 3, y = rawH(cx, cz) + .2; const deck = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, .35, 28, 1, false, Math.PI * .1, Math.PI * .95), deckM); deck.position.set(cx, y, cz); group.add(deck);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(6, .07, 6, 40, Math.PI * .95), railM); rail.rotation.set(Math.PI / 2, 0, -(Math.PI * .1) + Math.PI / 2); rail.position.set(cx, y + 1.1, cz); group.add(rail);
      for (let k = 0; k <= 16; k++) { const a = Math.PI * .1 + Math.PI * .95 * k / 16; const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.1, 5), railM); post.position.set(cx + Math.sin(a) * 6, y + .55, cz + Math.cos(a) * 6); group.add(post); } }
    // 원경 야경: 봉우리 기준 실제 방위·거리(km)를 압축해 배치. 동=+x, 북=-z
    const peakTop = rawH(px, pz) + 1.7; const KM = 1000 * S * .24; // 실거리 1km → 72단위(압축, 연출)
    const place = (e, n, hM = 0) => { const dKm = Math.hypot(e, n) || .01; const L = dKm * KM + 160; const ang = Math.atan(.427 / dKm); // 실제 내려다보는 각도 유지
      const k = L / dKm; return [px + e * k, peakTop - L * Math.tan(ang) + hM * (L / dKm) / 1000 * 1.0, pz - n * k]; };
    const isSea = (e, n) => { if (e > 3.2 && e < 5.2 && n < -1.9 && n > -4.6) return false; // 이기대·용호 반도
      const co = [[1.8, -9], [2.4, -4], [2.9, -1.6], [3.4, -.55], [4.5, -.35], [5.6, -.6], [6.8, -.55], [8.2, .1], [10, .6], [14, 1.5]];
      if (e < co[0][0]) return n < -6.6 && e > -1.5 && e < 1.8 && n < -6.6 - (1.8 - e) * 0; for (let i = 0; i < co.length - 1; i++) if (e >= co[i][0] && e < co[i + 1][0]) { const f = (e - co[i][0]) / (co[i + 1][0] - co[i][0]); return n < co[i][1] + (co[i + 1][1] - co[i][1]) * f; } return n < 1.5; };
    const pts = []; const r = rngF(427);
    const push = (e, n, hM, col, kind = 0) => { pts.push([...place(e, n, hM), col, kind]); };
    const warm = () => r() < .7 ? [1, .78 + r() * .15, .45 + r() * .2] : r() < .5 ? [1, 1, .92] : [.7, .85, 1];
    // 시가지 불빛 융단(가까운 곳 밀도 높게)
    for (let k = 0; k < 5200; k++) { const a = r() * Math.PI * 2, d = .9 + Math.pow(r(), .8) * 11; const e = Math.sin(a) * d, n = Math.cos(a) * d; if (isSea(e, n)) continue; if (Math.hypot(e + .2, n - 1.2) < .6) continue; if (r() < .25 && d < 2) continue; push(e, n, 0, warm()); }
    // 도로 불빛 줄(주요 간선 연출: 서면·연산·수영·광안·남구 방향)
    const roads = [[[-2.3, .2], [0, 2.4], [3, 2], [5.8, .6]], [[-2.3, .2], [-1, -2.5], [1.5, -5.5]], [[2.4, -4], [3.4, -.7], [4.8, .9], [8, 1]], [[-4, 3.5], [-2.3, .2], [-3, -4], [-1.5, -7]], [[0, 2.4], [-.5, 5.5]], [[3.2, -.5], [1.2, -1.8], [-1, -2.5]]];
    const roadSeg = []; for (const rd of roads) for (let i = 0; i < rd.length - 1; i++) { const [a, b] = [rd[i], rd[i + 1]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L * 60; s++) { const f = s / (L * 60); push(a[0] + (b[0] - a[0]) * f + (r() - .5) * .03, a[1] + (b[1] - a[1]) * f + (r() - .5) * .03, 0, r() < .5 ? [1, .85, .55] : [1, .35, .25], 1); } roadSeg.push([a, b]); }
    // 고층 빌딩 무리: 마린시티(동 5.8km), 해운대 엘시티(동 8km), 센텀(동북동), 서면(서 2.1km), 문현(남서) — 창 불빛 기둥
    const towers = (e0, n0, cnt, hMin, hMax, spread, tint) => { for (let k = 0; k < cnt; k++) { const e = e0 + (r() - .5) * spread, n = n0 + (r() - .5) * spread * .6; const h = hMin + r() * (hMax - hMin); for (let y = 0; y < h; y += 9) { if (r() < .25) continue; push(e + (r() - .5) * .02, n, y, tint ? tint() : warm(), 2); } push(e, n, h + 6, [1, .2, .15], 3); } };
    towers(5.85, -.1, 26, 120, 300, .7, () => r() < .5 ? [.85, .92, 1] : [1, .9, .7]); towers(8.1, .25, 6, 200, 410, .35, () => [.9, .95, 1]); towers(6.2, 1.4, 14, 80, 200, .8); towers(-2.1, .1, 22, 60, 170, 1.1); towers(-.3, -2.6, 6, 80, 200, .5); towers(1.2, 3.2, 12, 40, 120, 1.4);
    // 광안대교 원경(남서 용호동 ↔ 북동 센텀/우동): 주탑·케이블 LED 연출
    const BR0 = [2.85, -2.55], BR1 = [5.75, .25], bridgeIdx = pts.length; const BT0 = .43, BT1 = .63;
    for (let k = 0; k <= 220; k++) { const f = k / 220, e = BR0[0] + (BR1[0] - BR0[0]) * f, n = BR0[1] + (BR1[1] - BR0[1]) * f; push(e, n, 22, [1, 1, 1], 4);
      const cab = f < BT0 ? 32 + 58 * (f / BT0) ** 1.5 : f > BT1 ? 32 + 58 * ((1 - f) / (1 - BT1)) ** 1.5 : 30 + 60 * (((f - (BT0 + BT1) / 2) / ((BT1 - BT0) / 2)) ** 2); push(e, n, Math.max(24, cab), [1, 1, 1], 5); if (k % 3 === 0) push(e, n, Math.max(24, cab) * .5 + 11, [1, 1, 1], 6); }
    for (const f of [BT0, BT1]) for (let y = 0; y < 105; y += 6) push(BR0[0] + (BR1[0] - BR0[0]) * f, BR0[1] + (BR1[1] - BR0[1]) * f, y, [1, .95, .85], 2);
    // 부산항대교(남 약 7km, 영도 방향) — 주탑 2개 + 사장 케이블 흰 불빛
    { const A = [-1.9, -6.6], Bb = [.6, -7.6]; for (let k = 0; k <= 120; k++) { const f = k / 120; push(A[0] + (Bb[0] - A[0]) * f, A[1] + (Bb[1] - A[1]) * f, 60, [.75, .85, 1], 4); } for (const f of [.3, .7]) { const e = A[0] + (Bb[0] - A[0]) * f, n = A[1] + (Bb[1] - A[1]) * f; for (let y = 60; y < 190; y += 7) push(e, n, y, [.85, .9, 1], 2); for (let s = 0; s < 40; s++) { const g = (s % 20) / 20 * .25 * (s < 20 ? -1 : 1); push(e + (Bb[0] - A[0]) * g, n + (Bb[1] - A[1]) * g, 60 + 130 * (1 - Math.abs(g) / .25), [.8, .9, 1], 2); } } }
    // 바다 위 배 불빛 몇 개
    for (let k = 0; k < 18; k++) { const e = 3 + r() * 9, n = -2 - r() * 7; if (isSea(e, n)) push(e, n, 0, [1, .95, .7], 7); }
    const NV = pts.length, city = glowPoints(NV, { size: 3, atten: false }); city.u.uTw.value = .55;
    const kinds = new Float32Array(NV); pts.forEach(([x, y, z, c, kd], i) => { city.pos.set([x, y, z], i * 3); city.col.set(c, i * 3); kinds[i] = kd; });
    const baseCol = city.col.slice(); city.g.attributes.position.needsUpdate = city.g.attributes.color.needsUpdate = true; city.p.renderOrder = 3; city.p.visible = false; group.add(city.p);
    // 낮: 원경 도시 실루엣(안개 낀 희미한 블록) — 연출
    const dayG = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: .55, fog: false }), 420); { const o = new THREE.Object3D(); let q = 0; const add = (e, n, h, w) => { if (q >= 420) return; const [x, y, z] = place(e, n, 0); const s = (Math.hypot(e, n) * KM + 160) / Math.hypot(e, n) / 1000; o.position.set(x, y + h * s / 2, z); o.scale.set(w * s, h * s, w * s); o.rotation.y = r() * 3; o.updateMatrix(); dayG.setMatrixAt(q++, o.matrix); };
      for (let k = 0; k < 26; k++) add(5.85 + (r() - .5) * .7, -.1 + (r() - .5) * .4, 120 + r() * 180, 30); for (let k = 0; k < 6; k++) add(8.1 + (r() - .5) * .35, .25, 200 + r() * 210, 40); for (let k = 0; k < 300; k++) { const a = r() * 6.283, d = 1 + r() * 9, e = Math.sin(a) * d, n = Math.cos(a) * d; if (!isSea(e, n)) add(e, n, 15 + r() * 60, 40 + r() * 40); } dayG.count = q; }
    dayG.frustumCulled = false; group.add(dayG);
    let nightK = 0; sets.push(c => { nightK = Math.max(0, Math.min(1, ((c.lamp ?? 0) - .4) / 1.6)); city.p.visible = nightK > .03; city.u.uA.value = nightK; dayG.material.opacity = .5 * (1 - nightK); dayG.visible = nightK < .97; beacon.material.emissiveIntensity = .1 + nightK * .9; });
    let acc = 0; ups.push((t, dt) => { city.u.uT.value = t; for (const l of red) l.material.color.setRGB(Math.sin(t * 3) > 0 ? 1 : .25, .08, .05);
      beacon.material.emissive.setHSL(((t / 40) % 1), .8, .5);
      acc += dt; if (acc < .1 || !city.p.visible) return; acc = 0; const C2 = city.col; const bh = (t * .03) % 1, tmp = new THREE.Color();
      for (let i = 0; i < NV; i++) { const kd = kinds[i]; if (kd === 1) { const f = .5 + .5 * Math.sin(i * .9 - t * 3); C2[i * 3] = baseCol[i * 3] * f; C2[i * 3 + 1] = baseCol[i * 3 + 1] * f; C2[i * 3 + 2] = baseCol[i * 3 + 2] * f; }
        else if (kd >= 4 && kd <= 6 && i >= bridgeIdx && i < bridgeIdx + 663) { tmp.setHSL((bh + (i - bridgeIdx) / 663 * .6) % 1, .9, kd === 4 ? .75 : .6); C2.set([tmp.r, tmp.g, tmp.b], i * 3); }
        else if (kd === 3) { const on = Math.sin(t * 2.5 + i) > .3 ? 1 : .15; C2[i * 3] = on; C2[i * 3 + 1] = .15 * on; C2[i * 3 + 2] = .1 * on; } }
      city.g.attributes.color.needsUpdate = true; });
    api.extras.nightView = { points: NV, peak: [px, pz], km: KM };
  }

  // ---------------- 용궁사: 해수관음대불·12지신상·일주문·108계단 석등·석탑·연등·해안 바위·돌탑(연출) ----------------
  if (id === 'yonggungsa') {
    const poi = n => { const p = D.pois.find(p => p.n === n); return p ? W([p.x, p.y]) : null; };
    const granite = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: .95, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 1, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: .35, metalness: .7 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa9392b, roughness: .7 }), green = new THREE.MeshStandardMaterial({ color: 0x2f8a6a, roughness: .7 }), tile = new THREE.MeshStandardMaterial({ color: 0x4a5250, roughness: .8 });
    const add = (m, x, z, yOff = 0) => { m.position.set(x, rawH(x, z) + yOff, z); m.castShadow = true; group.add(m); return m; };
    // 해수관음대불(약 10m 단일 석재 — 사실. 형태는 단순화 연출): 연화대 + 옷자락 회전체 + 머리·보관·광배
    { const p = poi('해수관음상'); if (p) { const g = new THREE.Group(); const K = 1.25;
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * K, 2.6 * K, 1.4 * K, 8), granite); ped.position.y = .7 * K; g.add(ped);
        const lotus = new THREE.Mesh(new THREE.SphereGeometry(1.7 * K, 12, 6, 0, 6.283, Math.PI * .5, Math.PI * .5), granite); lotus.scale.y = .5; lotus.position.y = 1.9 * K; lotus.rotation.x = Math.PI; g.add(lotus);
        const prof = [[1.2, 0], [1.25, .5], [1.05, 2], [.95, 3.2], [1.05, 3.8], [.8, 4.3], [.42, 4.6], [0, 4.65]].map(([x, y]) => new THREE.Vector2(x * K, y * K));
        const robe = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), granite); robe.position.y = 2 * K; g.add(robe);
        const head = new THREE.Mesh(new THREE.SphereGeometry(.5 * K, 14, 10), granite); head.position.y = 7.1 * K; head.scale.set(1, 1.15, 1); g.add(head);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(.28 * K, .5 * K, .7 * K, 10), granite); crown.position.y = 7.8 * K; g.add(crown);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(1 * K, .09 * K, 6, 30), granite); halo.position.set(0, 7.1 * K, -.5 * K); g.add(halo);
        for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.2 * K, 1.6 * K, 4, 8), granite); arm.position.set(s * .75 * K, 5 * K, .35 * K); arm.rotation.set(-.5, 0, s * .2); g.add(arm); }
        const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.18, .05], [.22, .25], [.08, .5], [.12, .7]].map(([x, y]) => new THREE.Vector2(x * K, y * K)), 10), granite); vase.position.set(.75 * K, 4.4 * K, .7 * K); g.add(vase);
        // 바다 쪽을 바라봄
        let best = 0, bd = 1e9; for (let a = 0; a < 32; a++) for (let rr = 4; rr < 120; rr += 4) { const x = p[0] + Math.sin(a / 32 * 6.283) * rr, z = p[1] + Math.cos(a / 32 * 6.283) * rr; if (!isLand(x, z)) { if (rr < bd) { bd = rr; best = a / 32 * 6.283; } break; } }
        g.rotation.y = best; g.traverse(o => { o.castShadow = true; }); g.position.set(p[0], rawH(p[0], p[1]) - .1, p[1]); group.add(g); api.extras.gwaneum = { x: p[0], z: p[1], h: 8.3 * K }; } }
    // 12지신상(OSM 위치 그대로, 형태 연출): 받침 + 몸 + 동물 머리 느낌의 둥근 머리
    for (const p of D.pois.filter(p => /신상$/.test(p.n || ''))) { const [x, z] = W([p.x, p.y]); const g = new THREE.Group(); const b0 = new THREE.Mesh(new THREE.BoxGeometry(.9, .6, .9), dark); b0.position.y = .3; const body = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .9, 4, 8), granite); body.position.y = 1.25; const hd = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), granite); hd.scale.set(1, .9, 1.3); hd.position.set(0, 2.05, .08); g.add(b0, body, hd); g.position.set(x, rawH(x, z), z); g.rotation.y = hash(x, z) * 6; group.add(g); }
    // 득남불(포대화상 느낌 금빛 둥근 배 — 형태 연출)
    { const p = poi('득남불'); if (p) { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, .8, 10), dark); base.position.y = .4; const belly = new THREE.Mesh(new THREE.SphereGeometry(.9, 14, 10), gold); belly.position.y = 1.6; belly.scale.set(1, .95, .9); const hd = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8), gold); hd.position.y = 2.75; g.add(base, belly, hd); g.position.set(p[0], rawH(p[0], p[1]), p[1]); group.add(g); } }
    // 계단 경로: 석등 + 연등
    const steps = D.paths.filter(p => p.k === 'steps').map(p => p.p.map(W));
    const lanG = new THREE.Group(); const lampM = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffc46a, emissiveIntensity: 0 });
    const stoneLamp = (x, z) => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, 1, 6), granite); a.position.y = .5; const box = new THREE.Mesh(new THREE.BoxGeometry(.42, .38, .42), lampM); box.position.y = 1.2; const cap = new THREE.Mesh(new THREE.ConeGeometry(.42, .3, 4), granite); cap.position.y = 1.55; cap.rotation.y = Math.PI / 4; g.add(a, box, cap); g.position.set(x, rawH(x, z), z); lanG.add(g); };
    const ldPos = []; let stepLen = 0, nl = 0;
    for (const ln of steps) for (let i = 0; i < ln.length - 1; i++) { const [ax, az] = ln[i], [bx, bz] = ln[i + 1]; const L = Math.hypot(bx - ax, bz - az); stepLen += L; const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let s = 0; s < L; s += 3.2) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L; for (const sd of [-1, 1]) { stoneLamp(x + nx * 1.5 * sd, z + nz * 1.5 * sd); nl++; } } }
    group.add(lanG);
    // 연등 줄: 사찰 주변 보행로 위(머리 위 3m), 빨강·노랑·분홍·초록·주황
    const tc0 = poi('해동용궁사') || [0, 0]; const ways = D.paths.filter(p => p.k !== 'track').map(p => p.p.map(W));
    for (const ln of [...ways]) for (let i = 0; i < ln.length - 1; i++) { const [ax, az] = ln[i], [bx, bz] = ln[i + 1]; const L = Math.hypot(bx - ax, bz - az); for (let s = 0; s < L; s += .9) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L; if (Math.hypot(x - tc0[0], z - tc0[1]) > 26) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L; for (const sd of [-.9, 0, .9]) ldPos.push([x + nx * sd, z + nz * sd]); } }
    const ldN = Math.min(1400, ldPos.length); const ldG = new THREE.SphereGeometry(.15, 8, 6); ldG.scale(1, .9, 1);
    const ldM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .15, roughness: .6 });
    const lds = new THREE.InstancedMesh(ldG, ldM, Math.max(1, ldN)); { const o = new THREE.Object3D(), cc = new THREE.Color(); const LC = ['#e8413a', '#f7c531', '#f27bb0', '#46b06d', '#f08a2c', '#ffffff', '#5b8de8'];
      for (let k = 0; k < ldN; k++) { const [x, z] = ldPos[Math.floor(k * ldPos.length / ldN)]; o.position.set(x, rawH(x, z) + 3 + Math.sin(k * .7) * .12, z); o.updateMatrix(); lds.setMatrixAt(k, o.matrix); cc.set(LC[Math.floor(hash(k, 3) * LC.length)]); lds.setColorAt(k, cc); } }
    lds.count = ldN; group.add(lds);
    // 일주문: 108계단 위쪽 끝(사찰 반대쪽) — 기둥 4개 + 단청 띠 + 휜 지붕
    const gateAt = (x, z, ang) => { const g = new THREE.Group(); for (const s of [-1.8, -.6, .6, 1.8]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, 3.6, 10), red); c.position.set(s, 1.8, 0); g.add(c); }
      const band = new THREE.Mesh(new THREE.BoxGeometry(4.6, .5, .55), green); band.position.y = 3.75; g.add(band); const band2 = new THREE.Mesh(new THREE.BoxGeometry(4.4, .16, .6), red); band2.position.y = 3.45; g.add(band2);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, .55, .1), new THREE.MeshStandardMaterial({ color: 0x24324a })); sign.position.set(0, 3.3, .32); g.add(sign);
      const { top, under } = templeRoof(5.8, 1.8, 1.1); const rf = new THREE.Mesh(top, tile), ru = new THREE.Mesh(under, red); rf.position.y = ru.position.y = 4; g.add(rf, ru);
      g.position.set(x, rawH(x, z), z); g.rotation.y = ang; g.traverse(o => o.castShadow = true); group.add(g); return g; };
    let gatePos = null; { let far = null, fd = -1; for (const ln of steps) for (const end of [ln[0], ln[ln.length - 1]]) { const d = Math.hypot(end[0] - tc0[0], end[1] - tc0[1]); if (d > fd) { fd = d; far = { end, ln }; } }
      if (far) { const ln = far.ln, e = far.end, nb = ln[0] === e ? ln[1] : ln[ln.length - 2]; const ang = Math.atan2(nb[0] - e[0], nb[1] - e[1]); gatePos = [e[0] + Math.sin(ang) * -1.5, e[1] + Math.cos(ang) * -1.5]; gateAt(gatePos[0], gatePos[1], ang + Math.PI / 2 - Math.PI / 2); } }
    // 교통안전기원탑(7층, 12지신 부조 — 사실 / 위치는 12지신상 줄 끝 근처로 연출)
    { const zz = D.pois.filter(p => /신상$/.test(p.n || '')).map(p => W([p.x, p.y])); if (zz.length) { const e = zz.reduce((a, q) => Math.hypot(q[0] - tc0[0], q[1] - tc0[1]) > Math.hypot(a[0] - tc0[0], a[1] - tc0[1]) ? q : a); const x = e[0] - 2.5, z = e[1] - 1.5; const g = new THREE.Group(); let y = 0;
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 2.2), granite); b.position.y = .5; g.add(b); y = 1; for (let k = 0; k < 7; k++) { const w = 1.5 - k * .14; const body = new THREE.Mesh(new THREE.BoxGeometry(w * .7, .55, w * .7), granite); body.position.y = y + .27; const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, .16, w * 1.05), dark); roof.position.y = y + .62; g.add(body, roof); y += .72; }
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(.05, .1, 1.1, 6), gold); spire.position.y = y + .5; g.add(spire); g.position.set(x, rawH(x, z), z); g.traverse(o => o.castShadow = true); group.add(g); } }
    // 대웅보전 앞 사사자 3층 석탑 + 용문석교(연출 위치) + 해안 바위·돌탑
    const big = D.buildings.filter(b => b.p && b.p.length > 2).map(b => { let a = 0, cx = 0, cy = 0; for (let k = 0; k < b.p.length; k++) { const q = b.p[k], r = b.p[(k + 1) % b.p.length]; a += q[0] * r[1] - r[0] * q[1]; cx += q[0]; cy += q[1]; } return { a: Math.abs(a / 2), c: W([cx / b.p.length, cy / b.p.length]) }; }).sort((a, b) => b.a - a.a)[0];
    if (big) { let [x, z] = big.c; for (let k = 0; k < 20; k++) { const dx = tc0[0] - x, dz = tc0[1] - z; } // 건물 중심에서 바다 반대(앞마당) 쪽으로 6단위
      let fx = x + 7, fz = z; for (let a = 0; a < 16; a++) { const ox = x + Math.sin(a / 16 * 6.283) * 7, oz = z + Math.cos(a / 16 * 6.283) * 7; if (X.isWalkable(ox, oz)) { fx = ox; fz = oz; break; } }
      const g = new THREE.Group(); const b0 = new THREE.Mesh(new THREE.BoxGeometry(2, .5, 2), granite); b0.position.y = .25; g.add(b0); for (const [sx, sz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.35, .8, .45), granite); l.position.set(sx, .9, sz); g.add(l); } // 네 마리 사자 기둥
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, .2, 1.5), dark); deck.position.y = 1.4; g.add(deck); let y = 1.5; for (let k = 0; k < 3; k++) { const w = 1.1 - k * .2; const bd = new THREE.Mesh(new THREE.BoxGeometry(w * .7, .55, w * .7), granite); bd.position.y = y + .27; const rf = new THREE.Mesh(new THREE.BoxGeometry(w * 1.15, .15, w * 1.15), dark); rf.position.y = y + .62; g.add(bd, rf); y += .7; }
      g.position.set(fx, rawH(fx, fz), fz); g.traverse(o => o.castShadow = true); group.add(g); api.extras.pagoda = [fx, fz]; }
    // 해안 바위(육지 경계 따라 InstancedMesh)
    { const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x7d776e, roughness: 1, flatShading: true }), 900); const o = new THREE.Object3D(), cc = new THREE.Color(); let q = 0; const r = rngF(108);
      for (let k = 0; k < 60000 && q < 900; k++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); const L0 = isLand(x, z); if (!L0) continue; let edge = false; for (let a = 0; a < 6; a++) if (!isLand(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5)) { edge = true; break; } if (!edge || X.isWalkable(x, z)) continue;
        const s = .6 + r() * 1.8; o.position.set(x, rawH(x, z) - s * .3 - .6, z); o.rotation.set(r() * 3, r() * 3, r() * 3); o.scale.set(s * (1 + r() * .6), s * (.6 + r() * .5), s); o.updateMatrix(); rk.setMatrixAt(q, o.matrix); cc.setHSL(.08, .06 + r() * .06, .36 + r() * .16); rk.setColorAt(q, cc); q++; }
      rk.count = q; rk.castShadow = rk.receiveShadow = true; group.add(rk); api.extras.rocks = q;
      // 돌탑(작은 돌 쌓기) 24기 — 해안 쪽 바위 근처
      let ct = 0; for (let k = 0; k < 20000 && ct < 24; k++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (!isLand(x, z) || X.isWalkable(x, z)) continue; let near = false; for (let a = 0; a < 6; a++) if (!isLand(x + Math.cos(a) * 5, z + Math.sin(a) * 5)) near = true; if (!near || Math.hypot(x - tc0[0], z - tc0[1]) > 70) continue;
        const g = new THREE.Group(); let y = 0; for (let j = 0; j < 4 + Math.floor(r() * 4); j++) { const s = .32 - j * .03; const st = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 4), dark); st.scale.y = .55; st.position.set((r() - .5) * .05, y + s * .5, 0); y += s * .9; g.add(st); } g.position.set(x, rawH(x, z), z); group.add(g); ct++; } api.extras.cairns = ct; }
    sets.push(c => { const n = Math.max(0, (c.lamp ?? 0) - .4); lampM.emissiveIntensity = n * 1.3; ldM.emissiveIntensity = .15 + n * .9; });
    api.extras.temple = { stoneLamps: nl, lotus: ldN, stepLen: +stepLen.toFixed(1), gate: gatePos };
  }
  return api;
}
