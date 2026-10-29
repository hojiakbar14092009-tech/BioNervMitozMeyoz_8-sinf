import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { complementDNA, transcribe } from '../sequences';
import { InstancedSpheres, Part, blobCluster, useSelection } from './common';

// Reference 7 base colours: A red, T yellow, G green, C blue; U (RNA) violet.
const BASE_COLOR: Record<string, string> = { A: '#d9554f', T: '#e2b74a', G: '#4fa56e', C: '#5779d6', U: '#9b74d6' };
const TEMPLATE = 'ACGTGATACCGGTAACGTTA'; // starts with the book example A-C-G-T-G-A
const PARTNER = complementDNA(TEMPLATE);
const RNA = transcribe(TEMPLATE);
const N = TEMPLATE.length;
const R = 0.52;
const STEP = 0.17;
const TURN = 0.62; // radians per base pair
type P = [number, number, number];

const OPEN: Record<number, [number, number] | null> = { 0: null, 1: [N / 2, N], 2: [6, 15] };
const isOpen = (i: number, stage: number) => {
  const r = OPEN[stage];
  return !!r && i >= r[0] && i < r[1];
};

/** Backbone attachment point of strand `side` (−1 template, +1 partner) for pair i at openness o. */
function backbonePoint(i: number, o: number, side: -1 | 1, out: THREE.Vector3) {
  const tw = i * TURN * (1 - o);
  const sep = R * 0.5 + o * 0.46;
  const y = (i - N / 2) * STEP;
  const cx = side * Math.cos(tw) * sep;
  const cz = side * Math.sin(tw) * sep * (1 - o);
  // the pair group's local +x points at the axis; the backbone sits R·0.25 outward from its origin
  return out.set(cx + side * R * 0.25 * Math.cos(tw), y, cz + side * R * 0.25 * Math.sin(tw));
}

/** Continuous sugar-phosphate ribbon; rebuilt only while the strands are moving. */
function Backbone({ side, open, part }: { side: -1 | 1; open: React.RefObject<Float32Array>; part: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { selected, select, colors } = useSelection();
  const last = useRef('');
  const on = selected === part;
  const dim = selected !== null && !on;
  useFrame(() => {
    const m = mesh.current;
    const k = open.current;
    if (!m || !k) return;
    const sig = Array.from(k, (v) => v.toFixed(3)).join(',');
    if (sig === last.current) return;
    last.current = sig;
    const pts = Array.from({ length: N }, (_, i) => backbonePoint(i, k[i], side, new THREE.Vector3()));
    const old = m.geometry;
    m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 8, 0.05, 10, false);
    old.dispose();
  });
  useEffect(() => () => mesh.current?.geometry.dispose(), []);
  return (
    <mesh
      ref={mesh}
      userData={{ part }}
      onClick={(e) => {
        if (e.delta > 8) return;
        e.stopPropagation();
        select(on ? null : part);
      }}
    >
      <bufferGeometry />
      <meshStandardMaterial key={dim ? 't' : 'o'} color={colors[part]} roughness={0.42} envMapIntensity={0.9} emissive={on ? colors[part] : '#000'} emissiveIntensity={on ? 0.25 : 0} transparent={dim} opacity={dim ? 0.4 : 1} />
    </mesh>
  );
}

/** Base rung pointing toward the helix axis (+ a small phosphate node on newly built nucleotides). */
function Rung({ base, part, node }: { base: string; part: string; node?: boolean }) {
  return (
    <group>
      {node && (
        <Part part={part} roughness={0.45} opacity={0.92}>
          <icosahedronGeometry args={[0.048, 2]} />
        </Part>
      )}
      <Part part={part} color={BASE_COLOR[base]} position={[R * 0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]} roughness={0.5} opacity={node ? 0.92 : 1}>
        <capsuleGeometry args={[0.034, R * 0.36, 4, 12]} />
      </Part>
    </group>
  );
}

function Pair({ i, stage, open, progress }: { i: number; stage: number; open: React.RefObject<Float32Array>; progress: React.RefObject<number> }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const newL = useRef<THREE.Group>(null);
  const newR = useRef<THREE.Group>(null);
  const y = (i - N / 2) * STEP;
  const r = OPEN[stage];
  const along = r ? (i - r[0]) / Math.max(1, r[1] - r[0] - 1) : 0;
  useFrame((_, dt) => {
    const o = open.current?.[i] ?? 0;
    const tw = i * TURN * (1 - o);
    const sep = R * 0.5 + o * 0.46;
    left.current?.position.set(-Math.cos(tw) * sep, y, -Math.sin(tw) * sep * (1 - o));
    left.current?.rotation.set(0, -tw, 0);
    right.current?.position.set(Math.cos(tw) * sep, y, Math.sin(tw) * sep * (1 - o));
    right.current?.rotation.set(0, Math.PI - tw, 0);
    // new nucleotides grow in only behind the travelling polymerase (direction of synthesis)
    const built = o > 0.6 && (progress.current ?? 1) >= along ? 1 : 0;
    for (const g of [newL.current, newR.current]) {
      if (!g) continue;
      const s = THREE.MathUtils.damp(g.scale.x, built, 6, dt);
      g.scale.setScalar(Math.max(s, 0.0001));
      g.visible = s > 0.02;
    }
    newL.current?.position.set(-sep + R * 0.5, y, 0);
    newR.current?.position.set(sep - R * 0.5, y, 0);
  });
  return (
    <>
      <group ref={left}>
        <group position={[-R * 0.25, 0, 0]}>
          <Rung base={TEMPLATE[i]} part="matritsa" />
        </group>
      </group>
      <group ref={right}>
        <group position={[-R * 0.25, 0, 0]}>
          <Rung base={PARTNER[i]} part="juft" />
        </group>
      </group>
      <group ref={newL} visible={false}>
        <group position={[R * 0.25, 0, 0]} rotation={[0, Math.PI, 0]}>
          <Rung base={stage === 2 ? RNA[i] : PARTNER[i]} part="yangi" node />
        </group>
      </group>
      {stage === 1 && (
        <group ref={newR} visible={false}>
          <group position={[-R * 0.25, 0, 0]}>
            <Rung base={TEMPLATE[i]} part="yangi" node />
          </group>
        </group>
      )}
    </>
  );
}

export default function Dna({ stage, reduced }: SceneProps) {
  const root = useRef<THREE.Group>(null);
  const poly = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const open = useRef(new Float32Array(N));
  const blob = useMemo(() => blobCluster(140, [0.28, 0.3, 0.26], 0.058, 9), []);
  const r = OPEN[stage];

  useEffect(() => {
    progress.current = reduced ? 1 : 0;
  }, [stage, reduced]);

  useFrame((_, dt) => {
    const k = open.current;
    for (let i = 0; i < N; i++) {
      const target = isOpen(i, stage) ? 1 : 0;
      k[i] = reduced ? target : Math.abs(target - k[i]) < 0.001 ? target : THREE.MathUtils.damp(k[i], target, 3, dt);
    }
    if (root.current && !reduced && stage === 0) root.current.rotation.y += dt * 0.12;
    if (root.current && stage !== 0) root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, 0, 3, dt);
    progress.current = Math.min(1, (progress.current ?? 0) + dt * 0.16); // ~6 s along the opened region
    if (poly.current && r) {
      const from = (r[0] - N / 2) * STEP;
      const to = (r[1] - 1 - N / 2) * STEP;
      poly.current.position.y = THREE.MathUtils.lerp(from, to, progress.current);
    }
  });

  return (
    <group ref={root} rotation={[0, 0, 0.1]}>
      <Backbone side={-1} open={open} part="matritsa" />
      <Backbone side={1} open={open} part="juft" />
      {Array.from({ length: N }, (_, i) => (
        <Pair key={i} i={i} stage={stage} open={open} progress={progress} />
      ))}
      {r && (
        <group ref={poly} position={[-0.47, (r[0] - N / 2) * STEP, 0.05]}>
          <InstancedSpheres part="polimeraza" points={blob.pts as P[]} radii={blob.rad} anchor={[-0.3, 0.2, 0]} calloutDir={[-50, -40]} detail={2} />
        </group>
      )}
    </group>
  );
}
