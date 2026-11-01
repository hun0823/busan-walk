// 돗자리: 둥근 사각형 판 + 캔버스로 그린 체크·줄무늬 텍스처(직접 제작). 원점 = 매트 중심, 폭(x) 1.8 × 깊이(z) 1.3
import * as THREE from 'three';
export function makeMat() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#f6efe0'; g.fillRect(0, 0, 256, 192);
  g.fillStyle = 'rgba(214,86,72,.55)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 16, 192);
  g.fillStyle = 'rgba(214,86,72,.45)'; for (let y = 0; y < 192; y += 32) g.fillRect(0, y, 256, 16);
  g.strokeStyle = '#2f6fa8'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 172);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const w = 1.8, d = 1.3, r = .18, sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -d / 2); sh.lineTo(w / 2 - r, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); sh.lineTo(w / 2, d / 2 - r); sh.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  sh.lineTo(-w / 2 + r, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); sh.lineTo(-w / 2, -d / 2 + r); sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: .025, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getZ(i) / d + .5);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .95 })); m.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(m); return grp;
}
