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

// 보호자: 키 약 1.5, 머리 지름 약 0.62(≈40%). 얼굴 없음, 둥근 귀 두 개, 크림 후드, 갈색 반바지, 크림 운동화.
export function makeGuardian() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = clay(0xd7a77c), ear = clay(0x6e4630), hood = clay(0xf1e4cc, { rim: .22 }), pants = clay(0x8a5a38), shoeM = clay(0xf3ead8, { rim: .18 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 40, 30), skin); head.scale.set(1, .97, .96); head.position.y = 1.17;
  body.add(head);
  for (const s of [-1, 1]) { // 귀: 머리 윗부분 바깥쪽
    const e = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), ear); e.position.set(s * .26, 1.42, -.01); e.scale.set(1, 1, .55); e.rotation.z = -s * .5; body.add(e);
  }
  // 후드 몸통: 넓고 둥글게
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.3, 32, 24), hood); torso.scale.set(1.05, 1.0, .82); torso.position.y = .66; body.add(torso);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(.26, .05, 20, 48), hood); hem.rotation.x = Math.PI / 2; hem.scale.set(1.1, .85, 1); hem.position.y = .43; body.add(hem);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.17, .075, 20, 48), hood); collar.rotation.x = Math.PI / 2; collar.position.y = .9; body.add(collar);
  // 뒷면 접힌 후드 주머니(뒤가 -z)
  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(.2, 40, 28), hood);
  hoodBack.scale.set(1.3, 1.0, .7); hoodBack.position.set(0, .88, -.2); body.add(hoodBack);
  // 후드: 매끈한 클레이 덩어리 하나로 단순화(주름·테두리 제거)
  // 앞 주머니 + 끈
  const pocket = new THREE.Mesh(new THREE.SphereGeometry(.16, 28, 16), clay(0xe9dabf)); pocket.scale.set(1.05, .42, .22); pocket.position.set(0, .57, .225); body.add(pocket);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .14), clay(0xd8c6a6)); st.position.set(s * .05, .82, .25); body.add(st); }
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .13, .4, 0);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .2, 18), pants); l.position.y = -.1; leg.add(l);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(.115, .035, 10, 22), pants); cuff.rotation.x = Math.PI / 2; cuff.position.y = -.2; leg.add(cuff); // 걷은 단
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .1, 12), skin); sock.position.y = -.26; leg.add(sock);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 14), shoeM); shoe.scale.set(1, .62, 1.45); shoe.position.set(0, -.33, .04); leg.add(shoe);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .03, 18), clay(0xd9ccb5)); sole.scale.z = 1.45; sole.position.set(0, -.385, .04); leg.add(sole);
    body.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * .3, .82, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .2, 8, 16), hood); a.position.y = -.15; arm.add(a);
    const cf = new THREE.Mesh(new THREE.TorusGeometry(.075, .03, 8, 18), hood); cf.rotation.x = Math.PI / 2; cf.position.y = -.3; arm.add(cf);
    const h = new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 12), skin); h.position.y = -.37; arm.add(h);
    arm.rotation.z = s * .28; body.add(arm); arms.push(arm);
  }
  const hand = new THREE.Object3D(); hand.position.y = -.39; arms[0].add(hand); // 왼손 목줄
  shadow(root);
  return { root, hand, animate(t, walk, sit) {
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
  const furOf = c => clay(new THREE.Color(c), { rough: B.fluff < .1 ? .7 : 1, rim: .32, bump: B.fluff > .1 ? furBump() : null, bumpScale: bs });
  const fur = furOf(B.color), fur2 = furOf(B.color2), headM = B.headCol ? fur2 : fur;
  const earM = B.earCol ? furOf(B.earCol) : B.headCol ? fur2 : fur, muzM = B.face || B.mask || B.headCol ? fur2 : fur, chestM = B.chest ? fur2 : fur;
  const dark = clay(0x2e221c, { rough: .45, rim: 0 }), eyeM = clay(new THREE.Color(B.eye), { rough: .4, rim: 0 }), scarf = clay(0xf07a2a, { rim: .15 });
  const LH = .2 * B.leg, dy = LH - .2, bz = B.body - 1; // 다리 길이만큼 몸을 올림, 몸 길이만큼 앞뒤로 늘림
  const torso = new THREE.Mesh(puffGeo(.27, 48, amp), fur); torso.scale.set(.95 * B.girth, .88 * B.girth, 1.15 * B.body); torso.position.set(0, .36 + dy, -.04); body.add(torso);
  if (B.saddle) { const sd = new THREE.Mesh(puffGeo(.24, 32, amp), furOf(B.color3)); sd.scale.set(.98 * B.girth, .5, 1.0 * B.body); sd.position.set(0, .5 + dy, -.08); body.add(sd); }
  const chest = new THREE.Mesh(puffGeo(.2, 36, amp), chestM); chest.scale.setScalar(B.girth); chest.position.set(0, .44 + dy, .14 + bz * .3); body.add(chest);
  if (B.ruff) { const rf = new THREE.Mesh(puffGeo(.25, 36, .07, 12), B.chest ? fur2 : fur); rf.scale.set(1.1 * B.girth, .8, .75); rf.position.set(0, .56 + dy, .1 + bz * .3); rf.scale.multiplyScalar(.8 + .25 * B.ruff); body.add(rf); }
  const headG = new THREE.Group(); headG.position.set(0, .7 + dy, .2 + bz * .32); headG.scale.setScalar(B.head); body.add(headG);
  const head = new THREE.Mesh(puffGeo(.26, 48, amp, 10), headM); head.scale.set(1, .95, .95); headG.add(head);
  if (B.face) { const face = new THREE.Mesh(puffGeo(.2, 32, amp, 10), fur2); face.scale.set(1.0, .7, .7); face.position.set(0, -.08, .1); headG.add(face); }
  if (B.eyePatch) for (const s of [-1, 1]) { const ep = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), fur2); ep.scale.set(1, 1, .5); ep.position.set(s * .1, .05, .2); headG.add(ep); }
  if (B.topknot) { const tk = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), clay(new THREE.Color(B.topknot))); tk.position.set(0, .27, .02); headG.add(tk); }
  const mz = B.muzzle;
  const muzzle = new THREE.Mesh(puffGeo(.1, 28, amp, 12), muzM); muzzle.scale.set(1.15 + (mz < .6 ? .35 : 0), .85, mz); muzzle.position.set(0, -.07, .2 + .03 * mz); headG.add(muzzle);
  const n = new THREE.Mesh(new THREE.SphereGeometry(.035, 14, 10), dark); n.scale.set(1.2, .9, .8); n.position.set(0, -.04, .21 + .11 * mz); headG.add(n);
  if (B.smile) { const m2 = new THREE.Mesh(new THREE.TorusGeometry(.04, .008, 6, 12, Math.PI), dark); m2.rotation.z = Math.PI; m2.position.set(0, -.1, .2 + .1 * mz); headG.add(m2); }
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(B.size < .8 ? .033 : .027, 12, 8), eyeM); e.position.set(s * .09, .03, .235); headG.add(e);
    const es = B.earSize; let ear;
    if (B.ear === 'drop') { ear = new THREE.Mesh(puffGeo(.11, 28, .02 + .05 * B.fluff, 11), earM); ear.scale.set(.7 * es, 1.35 * es, .85); ear.position.set(s * .25, -.06 - (es - 1) * .08, -.01); ear.rotation.z = s * .25; }
    else if (B.ear === 'erect' || B.ear === 'big') { const k = B.ear === 'big' ? 1.35 : 1; ear = new THREE.Mesh(new THREE.ConeGeometry(.09 * es * k, .2 * es * k, 4), earM); ear.scale.z = .45; ear.position.set(s * .15, .25 + .06 * es * k, -.02); ear.rotation.z = -s * (B.ear === 'big' ? .45 : .25); }
    else if (B.ear === 'bat') { ear = new THREE.Mesh(new THREE.SphereGeometry(.1 * es, 16, 12), earM); ear.scale.set(.75, 1.25, .35); ear.position.set(s * .17, .26, -.02); ear.rotation.z = -s * .35; }
    else if (B.ear === 'semi') { ear = new THREE.Group(); const lo = new THREE.Mesh(new THREE.ConeGeometry(.08, .12, 4), earM); lo.scale.z = .45; ear.add(lo); const tip = new THREE.Mesh(new THREE.ConeGeometry(.05, .09, 4), earM); tip.scale.z = .45; tip.position.set(0, .05, .04); tip.rotation.x = 1.6; ear.add(tip); ear.position.set(s * .16, .27, -.02); ear.rotation.z = -s * .3; }
    else { ear = new THREE.Mesh(new THREE.SphereGeometry(.07 * es, 12, 8), earM); ear.scale.set(1, .7, .35); ear.position.set(s * .2, .17, .08); ear.rotation.set(.6, 0, -s * .5); } // button
    headG.add(ear);
  }
  // 스카프 + 앞 리본 매듭 (모든 견종 공통)
  const scf = new THREE.Group(); scf.position.set(0, dy, bz * .3); scf.scale.setScalar(Math.max(1, B.girth * .95)); body.add(scf);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.17, .045, 12, 30), scarf); sc.rotation.x = Math.PI / 2 + .45; sc.position.set(0, .54, .12); scf.add(sc);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(.04, 14, 10), scarf); knot.position.set(0, .48, .29); scf.add(knot);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(.055, .12, 14), scarf); w.rotation.z = s * Math.PI / 2; w.scale.z = .5; w.position.set(s * .07, .48, .29); scf.add(w);
    const tl = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .08, 4, 8), scarf); tl.position.set(s * .03, .41, .3); tl.rotation.z = s * .4; scf.add(tl);
  }
  const collar = new THREE.Object3D(); collar.position.set(0, .56 + dy, .05 + bz * .3); body.add(collar);
  const legs = [], fz = .14 + bz * .28, rz = -.2 - bz * .3, lx = .13 * B.girth, pawM = B.face && B.chest && B.color !== B.color2 && B.id !== 'dachshund' ? fur2 : fur;
  for (const [x, z] of [[-lx, fz], [lx, fz], [-lx, rz], [lx, rz]]) {
    const leg = new THREE.Group(); leg.position.set(x, LH, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.075 * Math.min(1.1, B.girth), Math.max(.01, .06 + (LH - .2)), 6, 14), fur); l.position.y = -LH * .35; leg.add(l);
    const paw = new THREE.Mesh(puffGeo(.085, 24, amp, 12), pawM); paw.scale.set(1, .75, 1.15); paw.position.set(0, -LH + .05, .02); leg.add(paw);
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
  return { root, collar, breed: B, animate(t, st) {
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
