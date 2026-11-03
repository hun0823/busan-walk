// v3.9l 꾸미기(가방): 모든 아이템은 Three.js 기본 도형으로 직접 만든 모델(외부 에셋 없음). 색·모양은 연출.
import * as THREE from 'three';
import { makeMat } from './mat.js?v=39v';
const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, metalness: 0 }, o));
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const lathe = (pts, m, seg = 40) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m);
// 슬롯별 선택지 [id, 이름, 이모지]. 0번은 '없음'
export const SLOTS = [
  { k: 'head', name: '모자·햇', items: [['cap', '야구 모자', '🧢'], ['straw', '밀짚모자', '👒'], ['bucket', '버킷햇', '🪣'], ['beanie', '비니', '🧶'], ['flower', '꽃 화관', '🌼']] },
  { k: 'eyes', name: '안경', items: [['glasses', '안경', '👓'], ['sun', '선글라스', '🕶️']] },
  { k: 'top', name: '옷', items: [['hoodie', '후드티', '🧥'], ['dress', '드레스', '👗']] },
  { k: 'back', name: '등', items: [['cape', '망토', '🦸'], ['bag', '미니 백팩', '🎒']] },
  { k: 'neck', name: '목', items: [['scarf', '목도리', '🧣']] },
  { k: 'dog', name: '강아지 모자', items: [['party', '고깔모자', '🥳'], ['dstraw', '미니 밀짚', '👒']] },
  { k: 'rest', name: '휴식 아이템 · 휴식하기 때 펼쳐요', items: [['mat', '돗자리(눕기)', '🧺'], ['chair', '캠핑의자', '🪑']] },
];
export const encode = o => SLOTS.map(s => { const i = s.items.findIndex(x => x[0] === o[s.k]); return (i + 1).toString(36); }).join('');
export const decode = c => { const o = {}; SLOTS.forEach((s, i) => { const n = parseInt((c || '')[i] || '0', 36) || 0; if (n && s.items[n - 1]) o[s.k] = s.items[n - 1][0]; }); return o; };

function build(id) {
  const g = new THREE.Group(), D = THREE.DoubleSide;
  if (id === 'cap') { const m = M(0x3a6fd8); const c = mesh(new THREE.SphereGeometry(.325, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 1.2); c.scale.z = .92; g.add(c); const b = mesh(new THREE.CylinderGeometry(.2, .2, .025, 24, 1, false, -Math.PI / 2, Math.PI), m, 0, 1.22, .26); b.scale.z = 1.1; g.add(b); g.add(mesh(new THREE.SphereGeometry(.03, 8, 6), M(0xffffff), 0, 1.52)); }
  if (id === 'straw' || id === 'dstraw') { const m = M(0xe8c878, { roughness: 1 }); g.add(mesh(new THREE.CylinderGeometry(.21, .25, .16, 24), m, 0, 1.42)); g.add(mesh(new THREE.CylinderGeometry(.52, .52, .02, 32), m, 0, 1.34)); g.add(mesh(new THREE.CylinderGeometry(.255, .255, .05, 24, 1, true), M(0xd8434a, { side: D }), 0, 1.37)); }
  if (id === 'bucket') { const m = M(0x7d8f5a); g.add(mesh(new THREE.CylinderGeometry(.22, .29, .2, 24), m, 0, 1.42)); g.add(mesh(new THREE.CylinderGeometry(.3, .44, .1, 28, 1, true), M(0x7d8f5a, { side: D }), 0, 1.29)); }
  if (id === 'beanie') { const m = M(0xe0644a, { roughness: 1 }); const c = mesh(new THREE.SphereGeometry(.335, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 1.17); c.scale.z = .93; g.add(c); const t = mesh(new THREE.TorusGeometry(.315, .04, 8, 32), M(0xf4ede0), 0, 1.18); t.rotation.x = Math.PI / 2; t.scale.y = .93; g.add(t); g.add(mesh(new THREE.SphereGeometry(.07, 12, 8), M(0xf4ede0), 0, 1.53)); }
  if (id === 'flower') { const t = mesh(new THREE.TorusGeometry(.27, .025, 8, 32), M(0x6aa84f), 0, 1.36); t.rotation.x = Math.PI / 2; t.scale.y = .9; g.add(t); const cs = [0xffd34d, 0xff8fb0, 0xffffff, 0xb89bff]; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(.045, 10, 8), M(cs[i % 4]), Math.sin(a) * .27, 1.37, Math.cos(a) * .27 * .9)); } }
  if (id === 'glasses' || id === 'sun') { const fr = M(id === 'sun' ? 0x1b1b1f : 0x5a341a, { roughness: .4 }); for (const s of [-1, 1]) { g.add(mesh(new THREE.TorusGeometry(.062, .007, 8, 28), fr, s * .1, 1.2, .303)); g.add(mesh(new THREE.CircleGeometry(.062, 28), id === 'sun' ? M(0x1c232e, { roughness: .1, metalness: .4, side: D }) : M(0xcfe8ff, { roughness: .05, transparent: true, opacity: .45, side: D, depthWrite: false }), s * .1, 1.2, .302)); } g.add(mesh(new THREE.TorusGeometry(.026, .007, 6, 12, Math.PI), fr, 0, 1.205, .305)); } // v3.9o: 가는 테 + 코 브릿지, 귀 다리 없음
  if (id === 'hoodie') { const m = M(0x8aa0c8, { roughness: 1 }); const sh = lathe([[0, .33], [.18, .35], [.29, .42], [.335, .55], [.33, .7], [.29, .83], [.22, .92], [.2, .96], [0, .97]], m); sh.scale.z = .92; sh.castShadow = true; g.add(sh); const h = mesh(new THREE.TorusGeometry(.2, .075, 10, 24, Math.PI * 1.2), m, 0, 1.06, -.1); h.rotation.set(-.3, 0, -Math.PI * .1); g.add(h); const pk = mesh(new THREE.BoxGeometry(.26, .1, .03), M(0x7a90b8), 0, .55, .31); g.add(pk); g.userData.sleeve = 0x8aa0c8; }
  if (id === 'dress') { const m = M(0xf08aa8, { side: D }); const sk = lathe([[.2, .92], [.27, .84], [.315, .72], [.33, .6], [.4, .45], [.5, .26]], m); sk.scale.z = .92; g.add(sk); const bd = mesh(new THREE.TorusGeometry(.315, .025, 8, 32), M(0xffffff), 0, .66); bd.rotation.x = Math.PI / 2; bd.scale.y = .92; g.add(bd); }
  if (id === 'cape') { const c = mesh(new THREE.CylinderGeometry(.24, .46, .62, 24, 1, true, Math.PI / 2 + .1, Math.PI - .2), M(0xc8323c, { side: D }), 0, .62, -.02); c.scale.z = .95; g.add(c); const t = mesh(new THREE.TorusGeometry(.215, .035, 8, 24), M(0xf2c14e), 0, .93); t.rotation.x = Math.PI / 2; g.add(t); }
  if (id === 'bag') { const m = M(0xf2a541); const b = mesh(new THREE.BoxGeometry(.34, .36, .16), m, 0, .66, -.36); g.add(b); g.add(mesh(new THREE.BoxGeometry(.24, .14, .05), M(0xd88a2c), 0, .58, -.45)); for (const s of [-1, 1]) { const st = mesh(new THREE.TorusGeometry(.18, .02, 6, 16, Math.PI), M(0x7a4a22), s * .14, .7, -.06); st.rotation.y = Math.PI / 2; g.add(st); } }
  if (id === 'scarf') { const m = M(0xf4c430, { roughness: 1 }); const t = mesh(new THREE.TorusGeometry(.215, .065, 10, 28), m, 0, .95); t.rotation.x = Math.PI / 2; g.add(t); const tl = mesh(new THREE.BoxGeometry(.11, .3, .04), m, .1, .78, .25); tl.rotation.z = .15; g.add(tl); }
  if (id === 'party') { const c = mesh(new THREE.ConeGeometry(.12, .3, 20), M(0x4fb3ff), 0, .36, -.02); c.rotation.z = .2; g.add(c); g.add(mesh(new THREE.SphereGeometry(.04, 10, 8), M(0xffd34d), -.03, .51, -.02)); }
  if (id === 'dstraw') { g.scale.setScalar(.55); g.position.y = -.56; }
  if (id === 'chair') { const fr = M(0x3d4046, { roughness: .5, metalness: .3 }), cl = M(0x2e8b6e, { side: D });
    const seat = mesh(new THREE.BoxGeometry(.52, .04, .46), cl, 0, .42); g.add(seat); const bk = mesh(new THREE.BoxGeometry(.52, .5, .04), cl, 0, .68, -.24); bk.rotation.x = -.18; g.add(bk);
    for (const s of [-1, 1]) { for (const d of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(.018, .018, .5, 8), fr, s * .27, .22, d * .17); l.rotation.x = d * .35; g.add(l); } g.add(mesh(new THREE.BoxGeometry(.05, .03, .44), fr, s * .29, .58, 0)); g.add(mesh(new THREE.CylinderGeometry(.03, .03, .07, 10), M(0xc0392b), s * .29, .62, .14)); } }
  if (id === 'mat') g.add(makeMat());
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
// 보호자·강아지에 착용 적용. ch = makeGuardian() 결과, dg = makeDog() 결과
export function applyOutfit(ch, dg, o) {
  for (const k of ['_ofG', '_ofS']) { (ch[k] || []).forEach(x => x.parent && x.parent.remove(x)); ch[k] = []; }
  if (dg) { (dg._of || []).forEach(x => x.parent && x.parent.remove(x)); dg._of = []; }
  for (const k of ['head', 'eyes', 'top', 'back', 'neck']) if (o[k]) { const g = build(o[k]); ch.body.add(g); ch._ofG.push(g); if (g.userData.sleeve) for (const a of ch.arms) { const s = mesh(new THREE.CapsuleGeometry(.088, .14, 6, 12), M(g.userData.sleeve, { roughness: 1 }), 0, -.13); a.add(s); ch._ofS.push(s); } }
  if (dg && o.dog) { const g = build(o.dog); if (o.dog === 'dstraw') g.position.y = .25 - 1.34 * .55; dg.headG.add(g); dg._of.push(g); }
}
// 휴식 때 바닥에 놓는 아이템(돗자리·캠핑의자)
export function makeGroundItem(id) { return build(id); }
