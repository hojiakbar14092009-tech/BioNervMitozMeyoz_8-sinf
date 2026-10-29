import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries, mergeVertices } from 'three-stdlib';
import type { SceneProps } from '../Viewer';
import { PALETTE, Part, TaperTube, rand, taperedTube } from './common';

type P = [number, number, number];
// Soma on the left; dendrites branch outward and taper; the axon runs right (63-rasm layout).
const SOMA: P = [-1.25, 0, 0];
const SOMA_R = 0.28;
const HILLOCK: P[] = [[-1.0, 0.0, 0], [-0.82, 0.01, 0]];
const AXON: P[] = [[-0.85, 0.01, 0], [0, 0.04, 0.02], [0.9, -0.02, 0], [1.62, 0, 0]];
// Myelin segments separated by short uncovered gaps along the axon.
const MYELIN: P[] = [[-0.55, 0.025, 0.01], [-0.1, 0.035, 0.02], [0.35, 0.02, 0.01], [0.8, -0.01, 0], [1.25, -0.01, 0]];
// Primary dendrite directions from the soma, and how many times each one forks.
const PRIMARY: { dir: P; len: number; r: number; depth: number }[] = [
  { dir: [-0.8, 1.15, 0.05], len: 0.55, r: 0.08, depth: 3 },
  { dir: [-0.9, -1.0, -0.1], len: 0.52, r: 0.075, depth: 3 },
  { dir: [0.05, 1, 0.4], len: 0.45, r: 0.065, depth: 2 },
  { dir: [0.1, -1, -0.4], len: 0.42, r: 0.062, depth: 2 },
  { dir: [-0.45, 0.25, -1], len: 0.44, r: 0.058, depth: 2 },
  { dir: [-1, 0.05, 0.6], len: 0.4, r: 0.055, depth: 2 },
];

interface Branch {
  pts: P[];
  r0: number;
  r1: number;
  parent: number;
}

/** Deterministic branching: each segment bends gently, then forks into two thinner, shorter children. */
function grow(out: Branch[], start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number, seed: number, parent = -1) {
  let n = seed;
  const next = () => rand(n++, 7);
  const d = dir.clone().normalize();
  const p = start.clone();
  const pts: P[] = [p.toArray() as P];
  for (let k = 0; k < 3; k++) {
    const jitter = new THREE.Vector3(next() - 0.5, next() - 0.5, next() - 0.5);
    jitter.addScaledVector(d, -jitter.dot(d)); // bend sideways only
    d.addScaledVector(jitter, 0.5).normalize();
    p.addScaledVector(d, len / 3);
    pts.push(p.toArray() as P);
  }
  const r1 = depth > 0 ? r * 0.64 : Math.max(0.007, r * 0.3);
  const me = out.push({ pts, r0: r, r1, parent }) - 1;
  if (depth === 0) return;
  for (let c = 0; c < 2; c++) {
    const axis = new THREE.Vector3(next() - 0.5, next() - 0.5, next() - 0.5).cross(d).normalize();
    const angle = (c === 0 ? 1 : -1) * (0.38 + next() * 0.32);
    grow(out, p, d.clone().applyAxisAngle(axis, angle), len * (0.68 + next() * 0.12), r1, depth - 1, seed * 3 + c * 101 + depth * 17, me);
  }
}

/** Soma surface pulled out into cones where the dendrites and the axon hillock leave it. */
function somaGeometry(roots: THREE.Vector3[]) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(SOMA_R, 5).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const u = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    u.copy(v).normalize();
    let s = 1 + 0.035 * Math.sin(u.x * 7 + 1) * Math.cos(u.y * 9 + 2);
    for (const r of roots) s += 0.42 * Math.max(0, u.dot(r)) ** 10;
    v.copy(u).multiplyScalar(SOMA_R * s);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function useNeuron() {
  const built = useMemo(() => {
    const soma = new THREE.Vector3(...SOMA);
    const dendrites: Branch[] = [];
    PRIMARY.forEach((b, i) => {
      const dir = new THREE.Vector3(...b.dir).normalize();
      grow(dendrites, soma.clone().addScaledVector(dir, SOMA_R * 1.05), dir, b.len, b.r, b.depth, 11 + i * 37);
    });
    // terminal arborization: the axon end splits into fine branches ending in boutons
    const terminals: Branch[] = [];
    for (const [i, dir] of ([[1, 0.55, 0.1], [1, -0.05, -0.25], [1, -0.6, 0.15]] as P[]).entries())
      grow(terminals, new THREE.Vector3(...AXON[AXON.length - 1]), new THREE.Vector3(...dir), 0.36, 0.026, 1, 5 + i * 29);
    const roots = [...PRIMARY.map((b) => new THREE.Vector3(...b.dir).normalize()), new THREE.Vector3(1, 0, 0)];
    const tubes = (list: Branch[], seg: number) => {
      const parts = list.map((b) => taperedTube(b.pts, b.r0, b.r1, seg, 8));
      const merged = mergeBufferGeometries(parts)!;
      parts.forEach((g) => g.dispose());
      return merged;
    };
    // impulse path: tip of the first dendrite → soma → axon → first terminal
    const chain: P[] = [];
    for (let b = dendrites.findIndex((_, i) => !dendrites.some((c) => c.parent === i)); b >= 0; b = dendrites[b].parent) {
      const pts = dendrites[b].pts.slice().reverse();
      chain.push(...(chain.length ? pts.slice(1) : pts));
    }
    const path = new THREE.CatmullRomCurve3([...chain, SOMA, ...AXON, ...terminals[0].pts.slice(1)].map((p) => new THREE.Vector3(...p)));
    return {
      soma: somaGeometry(roots),
      dendrites: tubes(dendrites, 14),
      terminals: tubes(terminals, 12),
      boutons: terminals.filter((_, i) => !terminals.some((c) => c.parent === i)).map((b) => b.pts[b.pts.length - 1]),
      tip: dendrites[0].pts[3],
      path,
    };
  }, []);
  useEffect(
    () => () => {
      built.soma.dispose();
      built.dendrites.dispose();
      built.terminals.dispose();
    },
    [built],
  );
  return built;
}

export default function Neuron({ reduced }: SceneProps) {
  const spark = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const n = useNeuron();
  useFrame((_, dt) => {
    if (!spark.current) return;
    spark.current.visible = !reduced;
    if (reduced) return;
    t.current = (t.current + dt * 0.2) % 1;
    spark.current.position.copy(n.path.getPointAt(t.current));
  });
  return (
    <group position={[0.1, 0, 0]} rotation={[0.1, -0.15, 0]}>
      <Part part="body" geometry={n.soma} position={SOMA} anchor={[0, 0.45, 0]} />
      {/* nucleus: visible but unlabelled (not taught in this lesson's figure) */}
      <Part position={[-1.25, 0.02, 0.15]} scale={0.85} pickable={false} color="#8e7fb6" roughness={0.5}>
        <sphereGeometry args={[0.11, 24, 18]} />
      </Part>
      <Part part="dendrite" geometry={n.dendrites} anchor={n.tip} />
      <TaperTube part="axon" points={HILLOCK} r0={0.12} r1={0.045} />
      <TaperTube part="axon" points={AXON} r0={0.042} r1={0.03} anchor={[0.12, 0.3, 0]} />
      {MYELIN.map((p, i) => (
        <Part key={i} part="myelin" position={p} rotation={[0, 0, Math.PI / 2]} roughness={0.75} sheen={0.6} anchor={i === 2 ? [0.3, 0, 0] : undefined}>
          <capsuleGeometry args={[0.095, 0.25, 8, 20]} />
        </Part>
      ))}
      <Part part="terminal" geometry={n.terminals} anchor={n.boutons[0]} />
      {n.boutons.map((p, i) => (
        <Part key={i} part="terminal" position={p}>
          <sphereGeometry args={[0.04, 16, 12]} />
        </Part>
      ))}
      <mesh ref={spark} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshBasicMaterial color={PALETTE.glow} toneMapped={false} />
      </mesh>
    </group>
  );
}
