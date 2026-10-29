import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import type { SceneProps } from '../Viewer';
import { HitProxy, Part, curve, rand, taperedTube, useOrganic, useSelection } from './common';
import { CordSection, Ganglion } from './CordSection';
import { muscleProfile } from './shapes';

type P = [number, number, number];
const CORD: P = [0, 0.45, 0];
const SENSORY: P[] = [[-2.05, -0.74, 0.12], [-1.72, -0.22, 0.12], [-1.25, 0.42, 0.08], [-0.86, 0.78, 0.02], [-0.5, 0.86, 0.22], [-0.2, 0.78, 0.31]];
const INTER: P[] = [[-0.2, 0.78, 0.31], [-0.05, 0.6, 0.34], [0.0, 0.46, 0.33], [0.12, 0.28, 0.33], [0.22, 0.12, 0.31]];
const MUSCLE: P = [2.02, -0.98, 0];
const AXIS = new THREE.Vector3(-Math.sin(Math.PI / 2.5), Math.cos(Math.PI / 2.5), 0); // muscle long axis
const UP = new THREE.Vector3(Math.cos(Math.PI / 2.5), Math.sin(Math.PI / 2.5), 0); // toward its upper surface
const onMuscle = (s: number, h: number, z = 0): P => new THREE.Vector3(...MUSCLE).addScaledVector(AXIS, s).addScaledVector(UP, h).setZ(z).toArray() as P;
const MOTOR: P[] = [[0.22, 0.12, 0.31], [0.62, -0.1, 0.28], [1.18, -0.52, 0.18], [1.62, -0.86, 0.05], onMuscle(0.12, 0.2, 0.02)];
// motor end plates spread over the muscle surface
const PLATES: P[] = [onMuscle(0.3, 0.17, 0.08), onMuscle(0.05, 0.2, -0.06), onMuscle(-0.22, 0.17, 0.05)];
const FULL = curve([...SENSORY, ...INTER.slice(1), ...MOTOR.slice(1)]);
// Progress windows along the arc → hotspot id (and impulse colour).
const WINDOWS: [string, number, number, string][] = [
  ['receptor', 0, 0.06, '#ffe08a'],
  ['sensory', 0.06, 0.5, '#ffd36b'],
  ['inter', 0.5, 0.62, '#d8b6ff'],
  ['motor', 0.62, 0.92, '#ff9a8a'],
  ['effector', 0.92, 1.01, '#ff9a8a'],
];
const TRAIL = 6;

/**
 * A nerve as several fibres twisting gently around a shared path; `fanStart`/`fanEnd` spread the
 * fibres where they branch out. One merged mesh.
 */
function nerveGeometry(points: P[], count: number, spread: number, r: number, seed: number, fanStart = 0, fanEnd = 0) {
  const path = curve(points);
  const N = 48;
  const { normals, binormals } = path.computeFrenetFrames(N, false);
  const tubes = Array.from({ length: count }, (_, k) => {
    const a0 = (k / count) * Math.PI * 2 + rand(k, seed) * 0.8;
    const d = spread * (0.45 + rand(k, seed + 1) * 0.55);
    const pts: P[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const env = 1 + fanStart * (1 - t) ** 4 + fanEnd * t ** 4;
      const a = a0 + t * Math.PI * 1.4;
      const p = path.getPointAt(t).addScaledVector(normals[i], Math.cos(a) * d * env).addScaledVector(binormals[i], Math.sin(a) * d * env);
      pts.push(p.toArray() as P);
    }
    const w = r * (0.7 + rand(k, seed + 2) * 0.6);
    return taperedTube(pts, w, w * 0.75, N, 7);
  });
  const g = mergeBufferGeometries(tubes)!;
  tubes.forEach((t) => t.dispose());
  return g;
}

/** Short tapered side branches (dendrites, receptor endings, motor terminals) merged into one mesh. */
function branchGeometry(list: { pts: P[]; r: number }[]) {
  const tubes = list.map((b) => taperedTube(b.pts, b.r, b.r * 0.35, 16, 6));
  const g = mergeBufferGeometries(tubes)!;
  tubes.forEach((t) => t.dispose());
  return g;
}

const spray = (from: P, dirs: P[], r: number) =>
  dirs.map((d) => ({ pts: [from, [from[0] + d[0] * 0.6, from[1] + d[1] * 0.6, from[2] + d[2]], [from[0] + d[0], from[1] + d[1], from[2] + d[2] * 1.5]] as P[], r }));

function useGeometries() {
  const g = useMemo(() => {
    const [rx, ry, rz] = SENSORY[0];
    return {
      sensory: nerveGeometry(SENSORY, 4, 0.03, 0.014, 3, 1.6, 0.2),
      motor: nerveGeometry(MOTOR.slice(0, 4), 4, 0.03, 0.014, 9, 0.2, 0.6),
      inter: branchGeometry([{ pts: INTER, r: 0.02 }]),
      // free receptor endings climbing toward the epidermis
      endings: branchGeometry(
        [-1, 0, 1].flatMap((s, i) => [
          { pts: [[rx, ry, rz], [rx + s * 0.1, ry + 0.04, rz + 0.05], [rx + s * 0.18, ry + 0.08, rz + 0.02 * i]] as P[], r: 0.011 },
          { pts: [[rx + s * 0.1, ry + 0.04, rz + 0.05], [rx + s * 0.13, ry + 0.07, rz + 0.12]] as P[], r: 0.007 },
        ]),
      ),
      dendrites: branchGeometry(spray(INTER[2], [[-0.12, 0.08, 0.04], [0.12, 0.06, -0.02], [0.02, -0.12, 0.03], [-0.1, -0.08, -0.03]], 0.012)),
      motorDendrites: branchGeometry(spray(MOTOR[0], [[-0.13, -0.04, 0.02], [0.03, 0.13, 0.02], [-0.06, -0.12, -0.02]], 0.014)),
      terminals: branchGeometry(PLATES.map((p) => ({ pts: [MOTOR[3], MOTOR[4], p] as P[], r: 0.013 }))),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** Fine cross-striations for skeletal muscle fibres (tiny procedural texture). */
function useStriations() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let y = 0; y < 64; y++) {
      const l = 205 + Math.round(Math.sin(y * 0.8) * 35);
      g.fillStyle = `rgb(${l},${Math.round(l * 0.55)},${Math.round(l * 0.52)})`;
      g.fillRect(0, y, 4, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Muscle() {
  const { selected, select } = useSelection();
  const lathe = useMemo(muscleProfile, []);
  const stripes = useStriations();
  const on = selected === 'effector';
  const dim = selected !== null && !on;
  const fibres = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: (rand(i, 3) - 0.5) * 0.24, z: (rand(i, 4) - 0.5) * 0.24, s: 0.42 + rand(i, 5) * 0.18 })), []);
  return (
    <group onClick={(e) => { if (e.delta > 8) return; e.stopPropagation(); select(on ? null : 'effector'); }}>
      {fibres.map((f, i) => (
        <mesh key={i} position={[f.x, 0, f.z]} scale={[f.s, 1, f.s]} userData={{ part: 'effector' }}>
          <latheGeometry args={[lathe, 24]} />
          <meshStandardMaterial key={dim ? 't' : 'o'} map={stripes} color="#e7a49b" roughness={0.55} emissive={on ? '#c85a4c' : '#000'} emissiveIntensity={on ? 0.3 : 0} transparent={dim} opacity={dim ? 0.3 : 1} />
        </mesh>
      ))}
    </group>
  );
}

const SKIN_R = 3; // the skin patch is a piece of a curved body surface
/** Annular sector (curved slab) between two radii, extruded through z with softly rounded edges. */
function skinLayer(r0: number, r1: number, depth: number, span = 0.22) {
  const s = new THREE.Shape();
  const n = 40;
  const at = (r: number, i: number): [number, number] => {
    const a = Math.PI / 2 - span + (2 * span * i) / n;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  s.moveTo(...at(r1, 0));
  for (let i = 1; i <= n; i++) s.lineTo(...at(r1, i));
  for (let i = n; i >= 0; i--) s.lineTo(...at(r0, i));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, -SKIN_R, -depth / 2);
  return g;
}

function Skin() {
  // inner layers are slightly shorter in depth so the cut faces step back (no coplanar overlap)
  const layers = useMemo(
    () => [
      { g: skinLayer(SKIN_R - 0.055, SKIN_R, 0.95), c: '#ecc9b2' }, // epidermis
      { g: skinLayer(SKIN_R - 0.3, SKIN_R - 0.055, 0.93), c: '#dea193' }, // dermis
      { g: skinLayer(SKIN_R - 0.5, SKIN_R - 0.3, 0.91), c: '#efd6a3' }, // subcutaneous fat
    ],
    [],
  );
  useEffect(() => () => layers.forEach((l) => l.g.dispose()), [layers]);
  return (
    <group position={[-2.0, -0.63, 0]}>
      {layers.map((l, i) => (
        <Part key={i} geometry={l.g} color={l.c} roughness={i === 0 ? 0.62 : 0.8} sheen={i === 0 ? 0.6 : 0.3} pickable={false} />
      ))}
    </group>
  );
}

const blob = (r: number) => () => new THREE.IcosahedronGeometry(r, 3);

export default function ReflexArc({ scene, pulse, reduced, report }: SceneProps) {
  const { select } = useSelection();
  const geo = useGeometries();
  const corpuscle = useOrganic(blob(0.07), 0.006, 14, 2);
  const interSoma = useOrganic(blob(0.055), 0.006, 12, 5);
  const motorSoma = useOrganic(blob(0.07), 0.007, 11, 8);
  const trail = useRef<THREE.Mesh[]>([]);
  const muscle = useRef<THREE.Group>(null);
  const prog = useRef(-1);
  const last = useRef<string | null>(null);
  const colour = useRef(new THREE.Color(WINDOWS[0][3]));
  const goal = useMemo(() => new THREE.Color(), []);
  const label = (id: string) => scene.hotspots.find((h) => h.id === id)?.label ?? id;

  useEffect(() => {
    if (pulse > 0) {
      prog.current = 0;
      colour.current.set(WINDOWS[0][3]);
    }
  }, [pulse]);
  useEffect(() => () => report?.(null), [report]);

  useFrame((_, delta) => {
    if (prog.current < 0) return;
    const dt = Math.min(delta, 0.1); // a stalled frame (background tab) must not make the impulse jump ahead
    prog.current += dt * (reduced ? 0.42 : 0.3);
    const p = Math.min(prog.current, 1);
    const w = WINDOWS.find(([, a, b]) => p >= a && p < b);
    const part = w?.[0] ?? null;
    if (part !== last.current) {
      last.current = part;
      select(part); // the travelling impulse highlights each arc component in turn
      report?.(part ? `${label(part)} (${WINDOWS.findIndex((x) => x[0] === part) + 1}/5)` : null);
    }
    // colour glides between segments instead of switching
    if (w) colour.current.lerp(goal.set(w[3]), reduced ? 1 : 1 - Math.exp(-dt * 6));
    trail.current.forEach((m, i) => {
      const q = p - i * 0.012;
      m.visible = !reduced && p < 1 && q >= 0;
      if (!m.visible) return;
      m.position.copy(FULL.getPointAt(q));
      (m.material as THREE.MeshBasicMaterial).color.copy(colour.current);
    });
    if (muscle.current) {
      const k = p > 0.92 ? 1 - Math.sin(((p - 0.92) / 0.08) * Math.PI) * 0.16 : 1;
      muscle.current.scale.set(1 / k, k, 1 / k);
    }
    if (prog.current > 1.5) {
      prog.current = -1;
      last.current = null;
      select(null);
      report?.(null);
    }
  });

  return (
    <group position={[0, -0.05, 0]}>
      <Skin />
      <Part part="receptor" geometry={corpuscle} position={SENSORY[0]} scale={[1.25, 0.75, 0.8]} anchor={[0, 0.2, 0]} calloutDir={[-60, -40]} emissiveBoost={0.25} />
      <Part part="receptor" geometry={geo.endings} />
      <HitProxy part="receptor" radius={0.17} position={SENSORY[0]} />

      <group position={CORD}>
        <CordSection depth={0.9} scale={0.62} ids={{ white: 'inter', grey: 'inter' }} natural />
      </group>

      <Part part="sensory" geometry={geo.sensory} emissiveBoost={0.18} anchor={[-1.25, 0.5, 0.1]} calloutDir={[-60, -50]} roughness={0.45} />
      <Ganglion part="sensory" at={[-0.86, 0.78, 0.02]} scale={0.75} />
      <Part part="inter" geometry={geo.inter} emissiveBoost={0.15} anchor={[0, 0.55, 0.36]} calloutDir={[60, -60]} />
      <Part part="inter" geometry={interSoma} position={INTER[2]} scale={[1, 1.1, 0.8]} />
      <Part part="inter" geometry={geo.dendrites} />
      <Part part="motor" geometry={geo.motor} emissiveBoost={0.12} anchor={[0.9, -0.28, 0.25]} calloutDir={[70, -70]} roughness={0.45} />
      <Part part="motor" geometry={motorSoma} position={MOTOR[0]} scale={[1.1, 0.95, 0.8]} />
      <Part part="motor" geometry={geo.motorDendrites} />
      <Part part="motor" geometry={geo.terminals} />
      {PLATES.map((p, i) => (
        <Part key={i} part="motor" position={p} scale={[1.4, 0.5, 1.2]}>
          <sphereGeometry args={[0.03, 14, 10]} />
        </Part>
      ))}

      <group ref={muscle} position={MUSCLE} rotation={[0, 0, Math.PI / 2.5]}>
        <Muscle />
      </group>
      {/* effector callout point */}
      <Part part="effector" position={MUSCLE} opacity={0.001} pickable={false} anchor={[0.1, 0.35, 0]} calloutDir={[30, -60]}>
        <sphereGeometry args={[0.01, 4, 4]} />
      </Part>

      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh key={i} ref={(m) => void (m && (trail.current[i] = m))} visible={false} raycast={() => null} scale={1 - i * 0.13}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshBasicMaterial color="#ffe08a" toneMapped={false} transparent opacity={1 - i * 0.15} />
        </mesh>
      ))}
    </group>
  );
}
