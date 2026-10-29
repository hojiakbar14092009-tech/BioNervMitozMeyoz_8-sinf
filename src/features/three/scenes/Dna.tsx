import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { complementDNA, transcribe } from '../sequences';
import { InstancedSpheres, Part, blobCluster } from './common';

// Reference 7 base colours: A red, T yellow, G green, C blue; U (RNA) violet.
const BASE_COLOR: Record<string, string> = { A: '#d9554f', T: '#e2b74a', G: '#4fa56e', C: '#5779d6', U: '#9b74d6' };
const TEMPLATE = 'ACGTGATACCGGTAACGTTA'; // starts with the book example A-C-G-T-G-A
const PARTNER = complementDNA(TEMPLATE);
const RNA = transcribe(TEMPLATE);
const N = TEMPLATE.length;
const R = 0.52;
const STEP = 0.17;
type P = [number, number, number];

const OPEN: Record<number, [number, number] | null> = { 0: null, 1: [N / 2, N], 2: [6, 15] };
const isOpen = (i: number, stage: number) => {
  const r = OPEN[stage];
  return !!r && i >= r[0] && i < r[1];
};

/** Sugar-phosphate backbone as a small atom cluster + a base rung pointing to the axis. */
function Nucleotide({ base, part, light }: { base: string; part: string; light?: boolean }) {
  const o = light ? 0.92 : 1;
  return (
    <group>
      <Part part={part} roughness={0.45} opacity={o}>
        <icosahedronGeometry args={[0.052, 2]} />
      </Part>
      <Part part={part} position={[0, 0.045, 0.03]} roughness={0.45} opacity={o}>
        <icosahedronGeometry args={[0.038, 1]} />
      </Part>
      <Part part={part} position={[0, -0.04, -0.03]} roughness={0.45} opacity={o}>
        <icosahedronGeometry args={[0.034, 1]} />
      </Part>
      <Part part={part} color={BASE_COLOR[base]} position={[R * 0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]} opacity={o} roughness={0.5}>
        <capsuleGeometry args={[0.034, R * 0.34, 4, 10]} />
      </Part>
    </group>
  );
}

function Pair({ i, stage, reduced, progress }: { i: number; stage: number; reduced: boolean; progress: React.RefObject<number> }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const newL = useRef<THREE.Group>(null);
  const newR = useRef<THREE.Group>(null);
  const k = useRef(0);
  const a = i * 0.62;
  const y = (i - N / 2) * STEP;
  const r = OPEN[stage];
  // position of this pair inside the opened region (0 = where the polymerase starts)
  const along = r ? (i - r[0]) / Math.max(1, r[1] - r[0] - 1) : 0;
  useFrame((_, dt) => {
    const target = isOpen(i, stage) ? 1 : 0;
    k.current = reduced ? target : THREE.MathUtils.damp(k.current, target, 3, dt);
    const o = k.current;
    const twist = a * (1 - o);
    const sep = R * 0.5 + o * 0.46;
    left.current?.position.set(-Math.cos(twist) * sep, y, -Math.sin(twist) * sep * (1 - o));
    left.current?.rotation.set(0, twist, 0);
    right.current?.position.set(Math.cos(twist) * sep, y, Math.sin(twist) * sep * (1 - o));
    right.current?.rotation.set(0, twist + Math.PI, 0);
    // new nucleotides appear only behind the travelling polymerase (direction of synthesis)
    const built = o > 0.6 && (progress.current ?? 1) >= along ? 1 : 0;
    for (const g of [newL.current, newR.current]) {
      if (!g) continue;
      const s = reduced ? built : THREE.MathUtils.damp(g.scale.x, built, 6, dt);
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
          <Nucleotide base={TEMPLATE[i]} part="matritsa" />
        </group>
      </group>
      <group ref={right}>
        <group position={[-R * 0.25, 0, 0]}>
          <Nucleotide base={PARTNER[i]} part="juft" />
        </group>
      </group>
      <group ref={newL} visible={false}>
        <group position={[R * 0.25, 0, 0]} rotation={[0, Math.PI, 0]}>
          <Nucleotide base={stage === 2 ? RNA[i] : PARTNER[i]} part="yangi" light />
        </group>
      </group>
      {stage === 1 && (
        <group ref={newR} visible={false}>
          <group position={[-R * 0.25, 0, 0]}>
            <Nucleotide base={TEMPLATE[i]} part="yangi" light />
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
  const blob = useMemo(() => blobCluster(110, [0.28, 0.3, 0.26], 0.06, 9), []);
  const r = OPEN[stage];

  useEffect(() => {
    progress.current = reduced ? 1 : 0;
  }, [stage, reduced]);

  useFrame((_, dt) => {
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
      {Array.from({ length: N }, (_, i) => (
        <Pair key={i} i={i} stage={stage} reduced={reduced} progress={progress} />
      ))}
      {r && (
        <group ref={poly} position={[-0.47, (r[0] - N / 2) * STEP, 0.05]}>
          <InstancedSpheres part="polimeraza" points={blob.pts as P[]} radii={blob.rad} anchor={[-0.3, 0.2, 0]} calloutDir={[-50, -40]} />
        </group>
      )}
    </group>
  );
}
