import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE, Part, TaperTube, curve, useOrganic } from './common';

type P = [number, number, number];
// Soma on the left; dendrites branch outward and taper; the axon runs right (63-rasm layout).
const SOMA: P = [-1.25, 0, 0];
const DENDRITES: { pts: P[]; r0: number; r1: number }[] = [
  { pts: [[-1.4, 0.18, 0], [-1.7, 0.55, 0.12], [-1.95, 0.95, 0.1], [-2.05, 1.2, 0.05]], r0: 0.075, r1: 0.012 },
  { pts: [[-1.7, 0.55, 0.12], [-2.0, 0.6, 0.32], [-2.25, 0.55, 0.42]], r0: 0.035, r1: 0.01 },
  { pts: [[-1.95, 0.95, 0.1], [-1.8, 1.2, -0.1], [-1.75, 1.38, -0.2]], r0: 0.028, r1: 0.008 },
  { pts: [[-1.42, -0.15, 0], [-1.75, -0.5, -0.1], [-2.05, -0.85, -0.12], [-2.2, -1.05, -0.1]], r0: 0.07, r1: 0.012 },
  { pts: [[-1.75, -0.5, -0.1], [-2.08, -0.42, -0.38], [-2.32, -0.38, -0.5]], r0: 0.034, r1: 0.009 },
  { pts: [[-1.25, 0.24, 0.08], [-1.22, 0.7, 0.32], [-1.05, 1.1, 0.42], [-0.95, 1.3, 0.45]], r0: 0.06, r1: 0.01 },
  { pts: [[-1.22, 0.7, 0.32], [-1.42, 0.98, 0.55]], r0: 0.026, r1: 0.008 },
  { pts: [[-1.22, -0.24, -0.08], [-1.15, -0.72, -0.3], [-1.3, -1.05, -0.38]], r0: 0.058, r1: 0.01 },
  { pts: [[-1.3, 0.05, -0.25], [-1.55, 0.2, -0.65], [-1.7, 0.3, -0.95]], r0: 0.05, r1: 0.01 },
];
const HILLOCK: P[] = [[-1.0, 0.0, 0], [-0.82, 0.01, 0]];
const AXON: P[] = [[-0.85, 0.01, 0], [0, 0.04, 0.02], [0.9, -0.02, 0], [1.62, 0, 0]];
const TERMINALS: P[][] = [
  [[1.6, 0, 0], [1.85, 0.2, 0.06], [2.05, 0.42, 0.1]],
  [[1.6, 0, 0], [1.92, 0.02, -0.08], [2.18, -0.02, -0.14]],
  [[1.6, 0, 0], [1.85, -0.24, 0.08], [2.0, -0.48, 0.14]],
  [[1.85, 0.2, 0.06], [2.08, 0.18, 0.28]],
];
// Myelin segments separated by short uncovered gaps along the axon.
const MYELIN: P[] = [[-0.55, 0.025, 0.01], [-0.1, 0.035, 0.02], [0.35, 0.02, 0.01], [0.8, -0.01, 0], [1.25, -0.01, 0]];
const PATH = curve([[-2.05, 1.2, 0.05], [-1.7, 0.55, 0.12], [-1.25, 0, 0], [-0.85, 0.01, 0], [0, 0.04, 0.02], [0.9, -0.02, 0], [1.6, 0, 0], [1.92, 0.02, -0.08]]);

export default function Neuron({ reduced }: SceneProps) {
  const spark = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const soma = useOrganic(() => new THREE.IcosahedronGeometry(0.3, 4), 0.025, 7, 2);
  useFrame((_, dt) => {
    if (!spark.current) return;
    spark.current.visible = !reduced;
    if (reduced) return;
    t.current = (t.current + dt * 0.2) % 1;
    spark.current.position.copy(PATH.getPointAt(t.current));
  });
  return (
    <group position={[0.1, 0, 0]} rotation={[0.1, -0.15, 0]}>
      <Part part="body" geometry={soma} position={SOMA} scale={[1.05, 0.95, 0.85]} anchor={[0, 0.48, 0]} />
      {/* nucleus: visible but unlabelled (not taught in this lesson's figure) */}
      <Part position={[-1.25, 0.02, 0.17]} scale={0.85} pickable={false} color="#8e7fb6" roughness={0.5}>
        <sphereGeometry args={[0.11, 24, 18]} />
      </Part>
      {DENDRITES.map((d, i) => (
        <TaperTube key={i} part="dendrite" points={d.pts} r0={d.r0} r1={d.r1} anchor={i === 0 ? [-2.05, 1.35, 0.05] : undefined} />
      ))}
      <TaperTube part="axon" points={HILLOCK} r0={0.11} r1={0.045} />
      <TaperTube part="axon" points={AXON} r0={0.042} r1={0.036} anchor={[0.12, 0.3, 0]} />
      {MYELIN.map((p, i) => (
        <Part key={i} part="myelin" position={p} rotation={[0, 0, Math.PI / 2]} roughness={0.75} sheen={0.6} anchor={i === 2 ? [0.3, 0, 0] : undefined}>
          <capsuleGeometry args={[0.095, 0.25, 8, 20]} />
        </Part>
      ))}
      {TERMINALS.map((d, i) => (
        <group key={i}>
          <TaperTube part="terminal" points={d} r0={0.032} r1={0.022} anchor={i === 0 ? [2.05, 0.62, 0.1] : undefined} />
          <Part part="terminal" position={d[d.length - 1]} scale={[1.15, 1, 1]}>
            <sphereGeometry args={[0.055, 20, 14]} />
          </Part>
        </group>
      ))}
      <mesh ref={spark} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshBasicMaterial color={PALETTE.glow} toneMapped={false} />
      </mesh>
    </group>
  );
}
