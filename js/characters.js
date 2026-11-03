// 캐릭터: 기본 도형 + 절차 텍스처(캔버스 노이즈)로 직접 제작. 외부 모델·텍스처 없음.
// 매트한 클레이 느낌: roughness 높게, metalness 0, 셰이더에 부드러운 림라이트(프레넬) 추가.
import * as THREE from 'three';

// 프레넬 림라이트를 더한 매트 재질
function clay(color, { rough = .92, rim = .28, rimColor = 0xfff1dc, bump = null, bumpScale = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  if (bump) { m.bumpMap = bump; m.bumpScale = bumpScale; }
  const rc = new THREE.Color(rimColor);
  m.onBeforeCompile = s => {
    s.uniforms.rimColor = { value: rc }; s.uniforms.rimStr = { value: rim };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimStr;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat fr = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.5);\ntotalEmissiveRadiance += rimColor * fr * rimStr;');
  };
  return m;
}
const shadow = o => { o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o; };

// 절차 털 범프 텍스처: 작은 둥근 컬(곱슬)을 촘촘히 찍은 캔버스
let furTex = null;
function furBump() {
  if (furTex) return furTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#777'; g.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 6;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill();
    }
  }
  furTex = new THREE.CanvasTexture(c); furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping; furTex.repeat.set(4, 3);
  return furTex;
}

// 둥근 삼각 귀(v3.8): 구를 위로 갈수록 좁혀 끝이 둥근 말랑한 귀
function earGeo(w, h, d = .45) {
  const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y + 1) / 2, k = 1 - .72 * t * t; p.setXYZ(i, x * w * k, y * h / 2, z * w * d * (1 - .4 * t)); }
  g.computeVertexNormals(); return g;
}
// 짧은 털용 부드러운 잔털 범프(작고 흐린 점)
let softTex = null;
function softBump() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { const x = rnd() * 256, y = rnd() * 256, l = 2 + rnd() * 3, a = rnd() * 7; g.strokeStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},.18)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  softTex = new THREE.CanvasTexture(c); softTex.wrapS = softTex.wrapT = THREE.RepeatWrapping; softTex.repeat.set(5, 4);
  return softTex;
}
// 몽글한 털 덩어리: 구의 정점을 부드러운 사인 노이즈로 살짝 부풀림(랜덤 작은 구 대신 하나의 연속 표면)
function puffGeo(r, seg = 48, amp = .045, freq = 9) {
  const geo = new THREE.SphereGeometry(r, seg, Math.round(seg * .75)), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * freq + 1.3) * Math.sin(v.y * freq + .7) * Math.sin(v.z * freq + 2.1);
    const k = 1 + amp * (.5 + .5 * n);
    p.setXYZ(i, v.x * r * k, v.y * r * k, v.z * r * k);
  }
  geo.computeVertexNormals(); return geo;
}

// 보호자(v3.8): 옷·귀 없음. 머리·몸이 이어진 매끈한 단색 클레이 인형(마스코트형), 얼굴 없음. 키 약 1.5.
export function makeGuardian() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const M = clay(0xf2dcc0, { rough: .85, rim: .3 }), skin = M;
  // 머리·목·몸을 하나의 회전체(Lathe)로: 이음새 없는 말랑한 한 덩어리
  const prof = [[0,.3],[.16,.32],[.27,.4],[.315,.55],[.31,.7],[.27,.83],[.2,.92],[.19,.96],[.25,1.0],[.3,1.08],[.315,1.18],[.29,1.32],[.2,1.43],[.09,1.48],[0,1.49]];
  const cr = new THREE.SplineCurve(prof.map(q => new THREE.Vector2(q[0], q[1]))), pts = cr.getPoints(60); pts[0].x = 0; pts[pts.length - 1].x = 0;
  const blob = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), M); blob.scale.z = .9; blob.geometry.computeVertexNormals(); body.add(blob);
  { // v3.9 최소한의 얼굴: 눈 두 개 + 하이라이트(귀·옷 없음 유지)
    const eyeM = clay(0x2e221c, { rough: .35, rim: 0 }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [-1, 1]) { const x = s * .1, y = 1.2, z = .9 * Math.sqrt(.315 * .315 - x * x) - .004;
      const e = new THREE.Mesh(new THREE.SphereGeometry(.034, 14, 10), eyeM); e.scale.set(1, 1.2, .5); e.position.set(x, y, z); body.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 6), hiM); h.position.set(x - .01, y + .014, z + .016); body.add(h); }
  }
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .12, .4, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .12, 8, 16), M); l.position.y = -.14; leg.add(l);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 14), M); foot.scale.set(1, .7, 1.3); foot.position.set(0, -.31, .03); leg.add(foot);
    body.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * .27, .84, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .2, 8, 16), M); a.position.y = -.16; arm.add(a);
    const h = new THREE.Mesh(new THREE.SphereGeometry(.08, 16, 12), skin); h.position.y = -.3; arm.add(h);
    arm.rotation.z = s * .28; body.add(arm); arms.push(arm);
  }
  const hand = new THREE.Object3D(); hand.position.y = -.34; arms[0].add(hand); // 왼손 목줄
  shadow(root);
  return { root, hand, body, arms, animate(t, walk, sit) {
    if (sit) { legs[0].rotation.x = legs[1].rotation.x = -1.45; arms[0].rotation.x = arms[1].rotation.x = -.35; body.position.y = -.36; body.rotation.z = 0; return; }
    const s = walk ? Math.sin(t * 9) : 0;
    legs[0].rotation.x = s * .55; legs[1].rotation.x = -s * .55;
    arms[1].rotation.x = s * .45; arms[0].rotation.x = -.3 - s * .12;
    body.position.y = walk ? Math.abs(Math.cos(t * 9)) * .04 : Math.sin(t * 2) * .008;
    body.rotation.z = walk ? Math.sin(t * 9) * .03 : 0;
  } };
}

// 강아지: 견종 파라미터(js/breeds.js)로 생성. 기본형은 크림색 몽글 털 + 처진 귀 + 주황 스카프(모든 견종 공통).
export function makeDog(breed = {}) {
  const B = Object.assign({ color: '#f4e6cc', color2: '#f4e6cc', ear: 'drop', earSize: 1, muzzle: 1, body: 1, leg: 1, head: 1, girth: 1, tail: 'plume', size: 1, fluff: 1, eye: '#2e221c' }, breed);
  const root = new THREE.Group(), body = new THREE.Group(), scaleG = new THREE.Group(); root.add(scaleG); scaleG.add(body); scaleG.scale.setScalar(B.size);
  const amp = .008 + .05 * B.fluff, bs = 2.2 * B.fluff;
  const furOf = c => clay(new THREE.Color(c), { rough: B.fluff < .1 ? .82 : 1, rim: .42, rimColor: 0xfff4e2, bump: B.fluff > .1 ? furBump() : softBump(), bumpScale: B.fluff > .1 ? bs : .9 }); // 짧은 털도 잔털 범프·림라이트
  const fur = furOf(B.color), fur2 = furOf(B.color2), headM = B.headCol ? fur2 : fur;
  const earM = B.earCol ? furOf(B.earCol) : B.headCol ? fur2 : fur, muzM = B.face || B.mask || B.headCol ? fur2 : fur, chestM = B.chest ? fur2 : fur;
  const dark = clay(0x2e221c, { rough: .45, rim: 0 }), eyeM = clay(new THREE.Color(B.eye), { rough: .12, rim: 0 }), earIn = clay(new THREE.Color(B.earIn || '#F2BFAE'), { rim: .1 }), scarf = clay(0xf07a2a, { rim: .15 });
  const LH = .2 * B.leg, dy = LH - .2, bz = B.body - 1; // 다리 길이만큼 몸을 올림, 몸 길이만큼 앞뒤로 늘림
  const torso = new THREE.Mesh(puffGeo(.27, 48, amp), fur); torso.scale.set(1.0 * B.girth, .95 * B.girth, 1.08 * B.body); torso.position.set(0, .37 + dy, -.04); body.add(torso);
  const neckB = new THREE.Mesh(puffGeo(.17, 32, amp), B.chest ? fur2 : fur); neckB.scale.set(1.05 * B.girth, 1.05, .95); neckB.position.set(0, .56 + dy, .06 + bz * .3); body.add(neckB); // 머리-몸을 잇는 말랑한 목(이음새 없는 실루엣)
  if (B.saddle) { const sd = new THREE.Mesh(puffGeo(.24, 32, amp), furOf(B.color3)); sd.scale.set(.98 * B.girth, .5, 1.0 * B.body); sd.position.set(0, .5 + dy, -.08); body.add(sd); }
  const chest = new THREE.Mesh(puffGeo(.2, 36, amp), chestM); chest.scale.setScalar(B.girth); chest.position.set(0, .44 + dy, .14 + bz * .3); body.add(chest);
  if (B.ruff) { const rf = new THREE.Mesh(puffGeo(.25, 36, .07, 12), B.chest ? fur2 : fur); rf.scale.set(1.1 * B.girth, .8, .75); rf.position.set(0, .56 + dy, .1 + bz * .3); rf.scale.multiplyScalar(.8 + .25 * B.ruff); body.add(rf); }
  const headG = new THREE.Group(); headG.position.set(0, .7 + dy, .2 + bz * .32); headG.scale.setScalar(B.head * 1.2); body.add(headG); // 시안처럼 큰 머리(치비 비율)
  const HR = .26, hx = HR, hy = HR * .95, hz = HR * .95, off = amp * HR * .9; // 머리 타원체 반경 + 털 요철만큼 띄움
  const onHead = (x, y, lift = 0) => new THREE.Vector3(x, y, hz * Math.sqrt(Math.max(0, 1 - (x / hx) ** 2 - (y / hy) ** 2)) + off + lift);
  const head = new THREE.Mesh(puffGeo(HR, 48, amp, 10), headM); head.scale.set(1, .95, .95); headG.add(head);
  if (B.face) { const face = new THREE.Mesh(puffGeo(.2, 32, amp, 10), fur2); face.scale.set(1.05, .7, .7); face.position.set(0, -.09, .1); headG.add(face); }
  for (const s of [-1, 1]) { const ck = new THREE.Mesh(puffGeo(.085, 20, amp * .7, 10), muzM); ck.scale.set(1.1, .85, .8); ck.position.copy(onHead(s * .12, -.085, -.06)); headG.add(ck); } // 통통한 볼(전 견종)
  if (B.cheeks) for (const s of [-1, 1]) { const ck = new THREE.Mesh(puffGeo(.09, 20, amp, 10), fur2); ck.scale.set(1, .8, .7); ck.position.copy(onHead(s * .13, -.07, -.07)); headG.add(ck); } // 시바 우라지로(볼 흰털)
  if (B.blaze) { const bl = new THREE.Mesh(puffGeo(.1, 20, amp * .5, 8), fur2); bl.scale.set(.45, 1.4, .5); bl.position.copy(onHead(0, .08, -.03)); headG.add(bl); } // 이마 흰 줄(비글·보더콜리)
  if (B.eyePatch) for (const s of [-1, 1]) { const ep = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), fur2); ep.scale.set(1, 1, .45); ep.position.copy(onHead(s * .1, .03, -.02)); headG.add(ep); }
  if (B.topknot) { const tk = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), clay(new THREE.Color(B.topknot))); tk.position.set(0, .29, .02); headG.add(tk); const tf = new THREE.Mesh(puffGeo(.06, 14, .1, 10), headM); tf.position.set(0, .33, 0); headG.add(tf); }
  const mz = B.muzzle, mzs = .72 + .3 * mz; // 주둥이 길이: 시안처럼 짧고 통통하게 압축
  const muzzle = new THREE.Mesh(puffGeo(.1, 28, amp * .6, 12), muzM); muzzle.scale.set(1.2 + (mz < .6 ? .35 : 0), .82, mzs); muzzle.position.set(0, -.075, .19 + .035 * mz); headG.add(muzzle);
  const mzFront = muzzle.position.z + .1 * mzs; // 주둥이 앞면 z
  // 코: 둥근 역삼각 느낌(납작 타원) + 광택 하이라이트
  const gloss = clay(0x221815, { rough: .22, rim: 0 }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const n = new THREE.Mesh(new THREE.SphereGeometry(.034, 16, 12), gloss); n.scale.set(1.25, .9, .85); n.position.set(0, -.035, mzFront - .012); headG.add(n);
  const nh = new THREE.Mesh(new THREE.SphereGeometry(.009, 8, 6), hiM); nh.position.set(-.014, -.024, mzFront + .018); headG.add(nh);
  // 입: 코 아래 짧은 세로선 + 'ω' 두 호
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(.006, .03, 3, 6), dark); lip.position.set(0, -.075, mzFront - .012); headG.add(lip);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(.024, .006, 6, 12, Math.PI), dark); w.rotation.z = Math.PI; w.position.set(s * .024, -.088, mzFront - .022); w.rotation.y = s * .35; headG.add(w); }
  if (B.smile) { const tg = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 8), clay(0xE8737A, { rough: .5, rim: 0 })); tg.scale.set(1, 1.2, .5); tg.position.set(0, -.12, mzFront - .035); headG.add(tg); }
  // 눈: 크고 반짝이는 검은 눈 + 흰 하이라이트 2개(시안의 반짝임)
  const eyeR = B.size < .85 ? .066 : .06; // v3.8: 큰 눈
  for (const s of [-1, 1]) {
    const ep = onHead(s * .12, .015, -.016);
    const e = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 12), eyeM); e.scale.set(1, 1.08, .6); e.position.copy(ep); e.lookAt(ep.clone().multiplyScalar(2)); headG.add(e);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(eyeR * .36, 10, 8), hiM); h1.position.set(ep.x - eyeR * .3, ep.y + eyeR * .38, ep.z + eyeR * .5); headG.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(eyeR * .17, 8, 6), hiM); h2.position.set(ep.x + eyeR * .3, ep.y - eyeR * .3, ep.z + eyeR * .5); headG.add(h2);
    if (B.brows) { const bw = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), furOf(B.brows)); bw.scale.set(1.2, .8, .45); bw.position.copy(onHead(s * .085, .11, -.004)); headG.add(bw); }
    const es = B.earSize; let ear, inner = null;
    if (B.ear === 'drop') { ear = new THREE.Mesh(puffGeo(.11, 28, .02 + .05 * B.fluff, 11), earM); ear.scale.set(.7 * es, 1.35 * es, .85); ear.position.set(s * .25, -.04 - (es - 1) * .08, -.01); ear.rotation.z = s * .22; }
    else if (B.ear === 'erect' || B.ear === 'big') { const k = B.ear === 'big' ? 1.35 : 1; ear = new THREE.Group(); const o = new THREE.Mesh(earGeo(.1 * es * k, .21 * es * k), earM); ear.add(o); inner = new THREE.Mesh(earGeo(.056 * es * k, .13 * es * k, .25), earIn); inner.position.set(0, -.015 * es * k, .022); ear.add(inner); ear.position.set(s * .15, .24 + .06 * es * k, -.02); ear.rotation.z = -s * (B.ear === 'big' ? .45 : .25); ear.rotation.x = -.12; }
    else if (B.ear === 'bat') { ear = new THREE.Group(); const o = new THREE.Mesh(new THREE.SphereGeometry(.1 * es, 16, 12), earM); o.scale.set(.75, 1.25, .35); ear.add(o); inner = new THREE.Mesh(new THREE.SphereGeometry(.07 * es, 14, 10), earIn); inner.scale.set(.7, 1.15, .2); inner.position.set(0, -.01, .02); ear.add(inner); ear.position.set(s * .17, .26, -.02); ear.rotation.z = -s * .35; }
    else if (B.ear === 'semi') { ear = new THREE.Group(); const lo = new THREE.Mesh(earGeo(.09, .14), earM); ear.add(lo); const tip = new THREE.Mesh(new THREE.ConeGeometry(.055, .09, 10), earM); tip.scale.z = .45; tip.position.set(0, .05, .045); tip.rotation.x = 1.7; ear.add(tip); ear.position.set(s * .16, .27, -.02); ear.rotation.z = -s * .3; }
    else { ear = new THREE.Mesh(new THREE.SphereGeometry(.07 * es, 12, 8), earM); ear.scale.set(1, .7, .35); ear.position.set(s * .2, .17, .08); ear.rotation.set(.6, 0, -s * .5); } // button
    headG.add(ear);
  }
  // 몽글몽글 털 뭉치: 볼·목·가슴 둘레에 작은 퍼프를 인스턴싱(드로우콜 1~2개)
  const clumps = (mat, pts, r, lo) => { const im = new THREE.InstancedMesh(lo ? new THREE.SphereGeometry(r, 8, 6) : puffGeo(r, 16, .12, 9), mat, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(); pts.forEach((p, i) => { sc3.setScalar(p[3] || 1); q.setFromEuler(new THREE.Euler(i, i * 2, 0)); m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, sc3); im.setMatrixAt(i, m4); }); im.castShadow = true; return im; };
  if (B.fluff >= .5 && !B.curls) {
    const hp = [], bp = []; let k = 0;
    for (let i = 0; i < 9; i++) { const a = -Math.PI * .95 + i * Math.PI * 1.9 / 8; hp.push([Math.cos(a) * .24, -.1 + Math.sin(a) * .05 - Math.abs(Math.cos(a)) * .02, .04 + Math.sin(a) * .02 - Math.abs(Math.sin(a)) * .04, .9 + .2 * ((k++ * 7) % 3) / 2]); }
    for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; bp.push([Math.sin(a) * .17 * B.girth, .5 + dy - Math.abs(a) * .05, .17 + bz * .3 + Math.cos(a) * .08, 1.1]); }
    headG.add(clumps(B.face ? fur2 : headM, hp, .06)); body.add(clumps(chestM, bp, .07));
  }
  if (B.curls) { // 푸들: 머리·귀·몸 전체를 작은 곱슬 구슬로 덮음(인스턴싱)
    const hp = [], bp = []; const fib = (n, f) => { for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), t = i * 2.39996; f(Math.cos(t) * r, y, Math.sin(t) * r); } };
    fib(240, (x, y, z) => { if (z > .5 && y < .25 && Math.abs(x) < .6) return; hp.push([x * .265, y * .25, z * .25, .8 + .4 * ((hp.length * 5) % 4) / 3]); });
    fib(320, (x, y, z) => bp.push([x * .27 * .95 * B.girth, .36 + dy + y * .27 * .88 * B.girth, -.04 + z * .27 * 1.15 * B.body, 1]));
    headG.add(clumps(fur, hp, .03, 1)); body.add(clumps(fur, bp, .033, 1)); // 저폴리 구슬(8×6)로 삼각형 예산 유지
  }
  // 스카프 + 앞 리본 매듭 (모든 견종 공통)
  const scf = new THREE.Group(); scf.position.set(0, dy - .01, bz * .3 + .05); scf.scale.setScalar(Math.max(1, B.girth * .95)); body.add(scf);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.19, .05, 12, 30), scarf); sc.rotation.x = Math.PI / 2 + .5; sc.position.set(0, .53, .14); scf.add(sc);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(.04, 14, 10), scarf); knot.position.set(0, .46, .33); knot.scale.setScalar(1.25); scf.add(knot);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(.055, .12, 14), scarf); w.rotation.z = s * Math.PI / 2; w.scale.z = .5; w.position.set(s * .08, .46, .33); w.scale.multiplyScalar(1.3); scf.add(w);
    const tl = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .08, 4, 8), scarf); tl.position.set(s * .035, .39, .34); tl.rotation.z = s * .4; scf.add(tl);
  }
  const bib = new THREE.Mesh(new THREE.ConeGeometry(.1, .15, 3), scarf); bib.rotation.set(-.4, 0, Math.PI); bib.scale.z = .35; bib.position.set(0, .4, .31); scf.add(bib);
  const collar = new THREE.Object3D(); collar.position.set(0, .56 + dy, .05 + bz * .3); body.add(collar);
  const legs = [], fz = .14 + bz * .28, rz = -.2 - bz * .3, lx = .13 * B.girth, pawM = B.pawCol ? furOf(B.pawCol) : B.face && B.chest && B.color !== B.color2 && B.id !== 'dachshund' ? fur2 : fur;
  for (const [x, z] of [[-lx, fz], [lx, fz], [-lx, rz], [lx, rz]]) {
    const leg = new THREE.Group(); leg.position.set(x, LH, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.09 * Math.min(1.1, B.girth), Math.max(.01, .06 + (LH - .2)), 6, 14), fur); l.position.y = -LH * .35; leg.add(l);
    const paw = new THREE.Mesh(puffGeo(.098, 24, amp, 12), pawM); paw.scale.set(1, .7, 1.12); paw.position.set(0, -LH + .05, .02); leg.add(paw);
    body.add(leg); legs.push(leg);
  }
  const tail = new THREE.Group(); tail.position.set(0, .5 + dy, -.36 - bz * .32); body.add(tail);
  const tipM = B.tailTip ? furOf(B.tailTip) : fur, T = B.tail;
  if (T === 'curl' || T === 'ring') { const t = new THREE.Mesh(new THREE.TorusGeometry(T === 'ring' ? .065 : .085, .04, 10, 20, T === 'ring' ? 6 : 4.6), fur); t.rotation.y = Math.PI / 2; t.position.y = .07; tail.add(t); const tp = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), tipM); tp.position.set(0, .14, T === 'ring' ? .0 : .04); tail.add(tp); }
  else if (T === 'straight' || T === 'otter' || T === 'sickle') { const th = T === 'otter' ? .06 : T === 'sickle' ? .025 : .035; const t = new THREE.Mesh(new THREE.CapsuleGeometry(th, .26, 6, 10), fur); t.rotation.x = T === 'otter' ? -2.2 : -.6; t.position.set(0, T === 'otter' ? -.05 : .1, -.08); tail.add(t); const tp = new THREE.Mesh(new THREE.SphereGeometry(th * 1.1, 8, 6), tipM); tp.position.set(0, T === 'otter' ? -.15 : .23, T === 'otter' ? -.17 : -.15); tail.add(tp); if (T === 'sickle') tp.position.z = -.05; }
  else if (T === 'down') { const t = new THREE.Mesh(puffGeo(.07, 20, .07, 10), fur); t.scale.set(.8, 2.2, .8); t.rotation.x = -.5; t.position.set(0, -.12, -.08); tail.add(t); const tp = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), tipM); tp.position.set(0, -.27, -.14); tail.add(tp); }
  else if (T === 'stub') { tail.add(new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), fur)); }
  else if (T === 'pom') { const st = new THREE.Mesh(new THREE.CapsuleGeometry(.03, .1, 4, 8), fur); st.rotation.x = -.5; st.position.set(0, .05, -.03); tail.add(st); const pm = new THREE.Mesh(puffGeo(.08, 20, .08, 12), fur); pm.position.set(0, .14, -.07); tail.add(pm); }
  else { const t = new THREE.Mesh(puffGeo(.1, 24, .08, 12), fur); t.scale.set(1, 1.1, 1.6); t.rotation.x = .9; t.position.set(0, .1, .02); tail.add(t); } // plume: 등 위 깃털
  shadow(root);
  return { root, collar, headG, breed: B, animate(t, st) {
    const f = st === 'run' ? 16 : 11, a = st === 'run' ? .7 : st === 'walk' ? .45 : 0;
    const s = Math.sin(t * f);
    legs[0].rotation.x = s * a; legs[3].rotation.x = s * a; legs[1].rotation.x = -s * a; legs[2].rotation.x = -s * a;
    tail.position.x = Math.sin(t * (st === 'pet' || st === 'treat' ? 25 : 8)) * .05;
    body.position.y = a ? Math.abs(Math.cos(t * f)) * (st === 'run' ? .1 : .03) : 0;
    body.rotation.x = 0; headG.rotation.set(0, 0, 0);
    if (st === 'sit') { body.rotation.x = -.4; body.position.y = -.04; legs[2].rotation.x = legs[3].rotation.x = -1.1; }
    if (st === 'pet') { headG.rotation.z = Math.sin(t * 6) * .22; body.position.y = Math.abs(Math.sin(t * 8)) * .04; }
    if (st === 'treat') { body.position.y = Math.abs(Math.sin(t * 10)) * .2; headG.rotation.x = Math.sin(t * 20) * .12; }
    if (st === 'idle') headG.rotation.y = Math.sin(t * .8) * .3;
  } };
}
