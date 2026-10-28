import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE, Tube, curve, emph, M } from './common';

type P = [number, number, number];
const SENSORY: P[] = [[-1.9, -1.0, 0], [-1.5, -0.4, 0.1], [-0.9, 0.2, 0.05], [-0.35, 0.45, 0]];
const INTER: P[] = [[-0.35, 0.45, 0], [0, 0.3, 0], [0.3, 0.05, 0]];
const MOTOR: P[] = [[0.3, 0.05, 0], [0.9, -0.2, 0.05], [1.4, -0.65, 0.1], [1.75, -0.95, 0]];
const FULL = curve([...SENSORY, ...INTER.slice(1), ...MOTOR.slice(1)]);
// Progress windows for each part of the arc.
const WINDOWS: [string, number, number][] = [
  ['receptor', 0, 0.08],
  ['sensory', 0.08, 0.42],
  ['inter', 0.42, 0.58],
  ['motor', 0.58, 0.92],
  ['effector', 0.92, 1.01],
];

export default function ReflexArc({ selected, pulse, reduced }: SceneProps) {
  const spark = useRef<THREE.Mesh>(null);
  const muscle = useRef<THREE.Mesh>(null);
  const prog = useRef(-1);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (pulse > 0) prog.current = 0;
  }, [pulse]);

  useFrame((_, dt) => {
    if (prog.current < 0) return;
    prog.current += dt * (reduced ? 0.5 : 0.35);
    const p = Math.min(prog.current, 1);
    const part = WINDOWS.find(([, a, b]) => p >= a && p < b)?.[0] ?? null;
    if (part !== active) setActive(part);
    if (spark.current) {
      spark.current.visible = !reduced && p < 1;
      spark.current.position.copy(FULL.getPointAt(p));
    }
    if (muscle.current) {
      const k = p > 0.92 ? 1 - Math.sin(((p - 0.92) / 0.08) * Math.PI) * 0.18 : 1;
      muscle.current.scale.set(k * 1.35, (1 / k) * 0.55, 0.55);
    }
    if (prog.current > 1.4) {
      prog.current = -1;
      setActive(null);
    }
  });

  const sel = active ?? selected;
  return (
    <group scale={0.9}>
      {/* spinal cord segment: white matter with grey core */}
      <mesh position={[0, 0.25, -0.15]}>
        <cylinderGeometry args={[0.62, 0.62, 0.5, 40]} />
        <M {...emph(sel, 'inter', PALETTE.white)} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.25, -0.15]}>
        <cylinderGeometry args={[0.3, 0.3, 0.52, 6]} />
        <M {...emph(sel, 'inter', PALETTE.grey)} />
      </mesh>
      <mesh position={[-1.9, -1.0, 0]}>
        <sphereGeometry args={[0.14, 20, 16]} />
        <M {...emph(sel, 'receptor', PALETTE.amber)} />
      </mesh>
      <mesh position={[-0.95, 0.22, 0.05]}>
        <sphereGeometry args={[0.1, 18, 14]} />
        <M {...emph(sel, 'sensory', PALETTE.blue)} />
      </mesh>
      <Tube points={SENSORY} radius={0.04} material={emph(sel, 'sensory', PALETTE.blue)} />
      <Tube points={INTER} radius={0.035} material={emph(sel, 'inter', PALETTE.teal)} />
      <Tube points={MOTOR} radius={0.04} material={emph(sel, 'motor', PALETTE.rose)} />
      <mesh ref={muscle} position={[1.95, -1.15, 0]} scale={[1.35, 0.55, 0.55]}>
        <sphereGeometry args={[0.32, 32, 20]} />
        <M {...emph(sel, 'effector', PALETTE.tissueDeep)} />
      </mesh>
      <mesh ref={spark} visible={false}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshBasicMaterial color={PALETTE.glow} />
      </mesh>
    </group>
  );
}
