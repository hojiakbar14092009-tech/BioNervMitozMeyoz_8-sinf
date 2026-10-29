import * as THREE from 'three';

/** Butterfly-shaped grey matter (posterior horns up, anterior horns down) — 66-rasm. */
export function butterfly() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.bezierCurveTo(0.1, 0.18, 0.18, 0.35, 0.28, 0.52);
  s.bezierCurveTo(0.36, 0.56, 0.4, 0.48, 0.34, 0.36);
  s.bezierCurveTo(0.3, 0.2, 0.42, 0.08, 0.46, -0.08);
  s.bezierCurveTo(0.52, -0.3, 0.46, -0.48, 0.32, -0.5);
  s.bezierCurveTo(0.2, -0.5, 0.12, -0.3, 0, -0.16);
  s.bezierCurveTo(-0.12, -0.3, -0.2, -0.5, -0.32, -0.5);
  s.bezierCurveTo(-0.46, -0.48, -0.52, -0.3, -0.46, -0.08);
  s.bezierCurveTo(-0.42, 0.08, -0.3, 0.2, -0.34, 0.36);
  s.bezierCurveTo(-0.4, 0.48, -0.36, 0.56, -0.28, 0.52);
  s.bezierCurveTo(-0.18, 0.35, -0.1, 0.18, 0, 0.12);
  const hole = new THREE.Path();
  hole.absarc(0, -0.02, 0.05, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** Oval cord outline with shallow anterior/posterior fissures. */
export function cordOutline(rx = 0.86, ry = 0.7) {
  const s = new THREE.Shape();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const notch = 1 - 0.09 * Math.exp(-((Math.cos(a) * 6) ** 2)); // fissures at top and bottom
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry * notch;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** Fusiform muscle belly with tendon ends (lathe profile). */
export function muscleProfile() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.035 + 0.27 * Math.pow(Math.sin(Math.PI * t), 1.4);
    pts.push(new THREE.Vector2(r, (t - 0.5) * 1.3));
  }
  return pts;
}
