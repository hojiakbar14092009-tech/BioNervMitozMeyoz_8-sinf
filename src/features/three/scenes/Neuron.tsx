import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE, Tube, curve, emph } from './common';

type P = [number, number, number];
// Dendrites branch from the soma (left); the axon runs right to the terminal branches.
const DENDRITES: P[][] = [
  [[-1.25, 0.05, 0], [-1.6, 0.45, 0.1], [-1.9, 0.9, 0.05]],
  [[-1.6, 0.45, 0.1], [-1.95, 0.4, 0.3]],
  [[-1.25, -0.05, 0], [-1.65, -0.4, -0.1], [-2.0, -0.75, -0.1]],
  [[-1.65, -0.4, -0.1], [-1.95, -0.3, -0.4]],
  [[-1.15, 0.15, 0.1], [-1.2, 0.7, 0.35], [-1.0, 1.1, 0.4]],
  [[-1.15, -0.15, -0.1], [-1.1, -0.75, -0.3], [-1.3, -1.05, -0.35]],
];
const AXON: P[] = [[-0.9, 0, 0], [0, 0.03, 0], [1.0, -0.02, 0], [1.7, 0, 0]];
const TERMINALS: P[][] = [
  [[1.7, 0, 0], [1.95, 0.25, 0.05], [2.1, 0.45, 0.1]],
  [[1.7, 0, 0], [2.0, 0.0, -0.1], [2.2, -0.05, -0.15]],
  [[1.7, 0, 0], [1.95, -0.3, 0.1], [2.05, -0.5, 0.15]],
];
const PATH = curve([[-1.9, 0.9, 0.05], [-1.6, 0.45, 0.1], [-1.15, 0, 0], [-0.9, 0, 0], [0, 0.03, 0], [1.0, -0.02, 0], [1.7, 0, 0], [2.0, 0.0, -0.1]]);
const MYELIN_X = [-0.55, -0.1, 0.35, 0.8, 1.25];

export default function Neuron({ selected, reduced }: SceneProps) {
  const spark = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!spark.current) return;
    if (reduced) {
      spark.current.visible = false;
      return;
    }
    t.current = (t.current + dt * 0.22) % 1;
    spark.current.position.copy(PATH.getPointAt(t.current));
  });
  return (
    <group position={[-0.05, 0, 0]} scale={0.95}>
      <mesh position={[-1.15, 0, 0]} scale={[1, 0.85, 0.85]}>
        <sphereGeometry args={[0.32, 32, 24]} />
        <meshStandardMaterial {...emph(selected, 'body', PALETTE.tissue)} />
      </mesh>
      <mesh position={[-1.15, 0.02, 0.18]}>
        <sphereGeometry args={[0.11, 20, 16]} />
        <meshStandardMaterial {...emph(selected, 'body', '#7b6aa8')} />
      </mesh>
      {DENDRITES.map((d, i) => (
        <Tube key={i} points={d} radius={0.035} material={emph(selected, 'dendrite', PALETTE.tissue)} />
      ))}
      <Tube points={AXON} radius={0.045} material={emph(selected, 'axon', PALETTE.tissueDeep)} />
      {MYELIN_X.map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.36, 24]} />
          <meshStandardMaterial {...emph(selected, 'myelin', PALETTE.myelin)} />
        </mesh>
      ))}
      {TERMINALS.map((d, i) => (
        <group key={i}>
          <Tube points={d} radius={0.03} material={emph(selected, 'terminal', PALETTE.tissueDeep)} />
          <mesh position={d[d.length - 1]}>
            <sphereGeometry args={[0.06, 16, 12]} />
            <meshStandardMaterial {...emph(selected, 'terminal', PALETTE.amber)} />
          </mesh>
        </group>
      ))}
      <mesh ref={spark}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color={PALETTE.glow} />
      </mesh>
    </group>
  );
}
