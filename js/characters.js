// 캐릭터: 기본 도형만으로 직접 제작 (클레이 느낌 — 낮은 metalness, 높은 roughness)
import * as THREE from 'three';
const M = (c, r = .85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const shadow = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return o; };

// 보호자: 약 2.5등신, 얼굴 없는 갈색 둥근 곰돌이형 머리 + 크림색 후드
export function makeGuardian() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = M(0xe8b486), hood = M(0xf3e6cf), pants = M(0x6e4a32), dark = M(0x4a3020);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 24), skin); head.scale.set(1, .95, .95); head.position.y = 1.32;
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), dark); e.position.set(s * .3, 1.66, -.02); e.scale.z = .6; body.add(e); }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .32, 8, 20), hood); torso.position.y = .78; torso.scale.set(1.05, 1, .85);
  const hoodBack = new THREE.Mesh(new THREE.TorusGeometry(.26, .09, 10, 24), hood); hoodBack.position.set(0, 1.03, -.05); hoodBack.rotation.x = Math.PI / 2;
  body.add(head, torso, hoodBack);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .14, .48, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .22, 6, 12), pants); l.position.y = -.2; leg.add(l);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), M(0xe8d7bd)); shoe.scale.set(1, .6, 1.4); shoe.position.set(0, -.42, .04); leg.add(shoe);
    body.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * .36, .98, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .26, 6, 12), hood); a.position.y = -.2; arm.add(a);
    const h = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), skin); h.position.y = -.4; arm.add(h);
    arm.rotation.z = s * .18; body.add(arm); arms.push(arm);
  }
  // 목줄 손잡이(왼손)
  const hand = new THREE.Object3D(); hand.position.y = -.42; arms[0].add(hand);
  root.add(body); shadow(root);
  return { root, hand, animate(t, walk) {
    const s = walk ? Math.sin(t * 9) : 0;
    legs[0].rotation.x = s * .6; legs[1].rotation.x = -s * .6;
    arms[1].rotation.x = s * .5; arms[0].rotation.x = -.3 - s * .15;
    body.position.y = walk ? Math.abs(Math.cos(t * 9)) * .05 : Math.sin(t * 2) * .01;
  } };
}

// 강아지: 둥근 크림색 푸들 + 주황 스카프. 몽글몽글한 털은 작은 구를 모아 표현
export function makeDog() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = M(0xf6ead5, 1), nose = M(0x3a2a22, .5), scarf = M(0xf07a2a);
  const puff = (r, x, y, z, parent = body, n = 9) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), fur); g.add(core);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * .45, 10, 8), fur);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      p.position.setFromSphericalCoords(r * .78, ph, th); g.add(p);
    }
    parent.add(g); return g;
  };
  const torso = puff(.3, 0, .45, 0, body, 14); torso.scale.set(.9, .9, 1.15);
  const headG = new THREE.Group(); headG.position.set(0, .82, .28); body.add(headG);
  puff(.24, 0, 0, 0, headG, 10);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(.1, 14, 10), fur); snout.position.set(0, -.05, .2); headG.add(snout);
  const n = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), nose); n.position.set(0, -.02, .3); headG.add(n);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), nose); e.position.set(s * .09, .05, .2); headG.add(e);
    const ear = puff(.1, s * .22, -.06, 0, headG, 5); ear.scale.set(.8, 1.3, .8);
  }
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.17, .05, 10, 24), scarf); sc.rotation.x = Math.PI / 2 + .3; sc.position.set(0, .66, .2); body.add(sc);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(.08, .16, 10), scarf); knot.position.set(0, .56, .36); knot.rotation.x = Math.PI; body.add(knot);
  const collar = new THREE.Object3D(); collar.position.set(0, .68, .1); body.add(collar);
  const legs = [];
  for (const [x, z] of [[-.14, .2], [.14, .2], [-.14, -.2], [.14, -.2]]) {
    const leg = new THREE.Group(); leg.position.set(x, .3, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .16, 4, 10), fur); l.position.y = -.12; leg.add(l);
    puff(.07, 0, -.24, .01, leg, 4); body.add(leg); legs.push(leg);
  }
  const tail = puff(.1, 0, .62, -.36, body, 5);
  shadow(root);
  return { root, collar, animate(t, st) {
    const f = st === 'run' ? 16 : 11, a = st === 'run' ? .8 : st === 'walk' ? .5 : 0;
    const s = Math.sin(t * f);
    legs[0].rotation.x = s * a; legs[3].rotation.x = s * a; legs[1].rotation.x = -s * a; legs[2].rotation.x = -s * a;
    tail.position.x = Math.sin(t * (st === 'pet' || st === 'treat' ? 25 : 8)) * .06;
    body.position.y = a ? Math.abs(Math.cos(t * f)) * (st === 'run' ? .12 : .04) : 0;
    body.rotation.x = 0; headG.rotation.set(0, 0, 0);
    if (st === 'sit') { body.rotation.x = -.45; body.position.y = -.08; legs[2].rotation.x = legs[3].rotation.x = -1.2; }
    if (st === 'pet') { headG.rotation.z = Math.sin(t * 6) * .25; body.position.y = Math.abs(Math.sin(t * 8)) * .05; }
    if (st === 'treat') { body.position.y = Math.abs(Math.sin(t * 10)) * .25; headG.rotation.x = Math.sin(t * 20) * .15; }
    if (st === 'idle') headG.rotation.y = Math.sin(t * .8) * .3;
  } };
}
