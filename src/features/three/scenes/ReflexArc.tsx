import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE, Part, TaperTube, curve, useSelection } from './common';
import { butterfly, cordOutline, muscleProfile } from './shapes';

type P = [number, number, number];
const CORD: P = [0, 0.45, -0.1];
const SENSORY: P[] = [[-2.0, -0.95, 0.05], [-1.6, -0.45, 0.1], [-1.05, 0.25, 0.05], [-0.62, 0.62, 0], [-0.22, 0.68, 0]];
const INTER: P[] = [[-0.22, 0.68, 0], [0, 0.48, 0.02], [0.2, 0.25, 0]];
const MOTOR: P[] = [[0.2, 0.25, 0], [0.75, 0.0, 0.05], [1.3, -0.5, 0.1], [1.62, -0.88, 0]];
const FULL = curve([...SENSORY, ...INTER.slice(1), ...MOTOR.slice(1)]);
// Progress windows along the arc → hotspot id.
const WINDOWS: [string, number, number][] = [
  ['receptor', 0, 0.08],
  ['sensory', 0.08, 0.44],
  ['inter', 0.44, 0.58],
  ['motor', 0.58, 0.9],
  ['effector', 0.9, 1.01],
];

export default function ReflexArc({ scene, pulse, reduced, report }: SceneProps) {
  const { select } = useSelection();
  const spark = useRef<THREE.Mesh>(null);
  const muscle = useRef<THREE.Group>(null);
  const prog = useRef(-1);
  const last = useRef<string | null>(null);
  const grey = useMemo(butterfly, []);
  const outline = useMemo(() => cordOutline(), []);
  const lathe = useMemo(muscleProfile, []);
  const label = (id: string) => scene.hotspots.find((h) => h.id === id)?.label ?? id;

  useEffect(() => {
    if (pulse > 0) prog.current = 0;
  }, [pulse]);
  useEffect(() => () => report?.(null), [report]);

  useFrame((_, dt) => {
    if (prog.current < 0) return;
    prog.current += dt * (reduced ? 0.45 : 0.32);
    const p = Math.min(prog.current, 1);
    const part = WINDOWS.find(([, a, b]) => p >= a && p < b)?.[0] ?? null;
    if (part !== last.current) {
      last.current = part;
      select(part); // the travelling impulse highlights each arc component in turn
      report?.(part ? `${label(part)} (${WINDOWS.findIndex((w) => w[0] === part) + 1}/5)` : null);
    }
    if (spark.current) {
      spark.current.visible = !reduced && p < 1;
      spark.current.position.copy(FULL.getPointAt(p));
    }
    if (muscle.current) {
      const k = p > 0.9 ? 1 - Math.sin(((p - 0.9) / 0.1) * Math.PI) * 0.16 : 1;
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
      {/* skin slab with the receptor */}
      <Part position={[-2.0, -1.12, 0]} pickable={false} color={PALETTE.skin} opacity={0.55} roughness={0.8}>
        <boxGeometry args={[1.1, 0.16, 0.8]} />
      </Part>
      <Part part="receptor" position={[-2.0, -0.98, 0.05]} anchor={[0, -0.28, 0]}>
        <icosahedronGeometry args={[0.1, 3]} />
      </Part>
      {/* spinal cord segment: white matter outline + butterfly grey matter */}
      <group position={CORD}>
        <Part part="inter" pickable={false} opacity={0.42} color="#ece4d6" position={[0, 0, -0.22]} scale={0.62}>
          <extrudeGeometry args={[outline, { depth: 0.44 / 0.62, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 32 }]} />
        </Part>
        <Part part="inter" position={[0, 0, -0.24]} scale={0.66} color="#9b8ea3" anchor={[0, 0.85, 0.4]}>
          <extrudeGeometry args={[grey, { depth: 0.48 / 0.66, bevelEnabled: false, curveSegments: 18 }]} />
        </Part>
      </group>
      {/* sensory neuron: cell body in the spinal ganglion beside the cord */}
      <TaperTube part="sensory" points={SENSORY} r0={0.032} r1={0.028} anchor={[-1.1, 0.48, 0.05]} />
      <Part part="sensory" position={[-1.05, 0.25, 0.05]} scale={[1.2, 1, 1]}>
        <sphereGeometry args={[0.1, 24, 18]} />
      </Part>
      <TaperTube part="inter" points={INTER} r0={0.03} r1={0.026} />
      <TaperTube part="motor" points={MOTOR} r0={0.034} r1={0.026} anchor={[0.95, 0.05, 0.05]} />
      <Part part="motor" position={[0.2, 0.25, 0]}>
        <icosahedronGeometry args={[0.07, 2]} />
      </Part>
      {/* effector: fusiform muscle */}
      <group ref={muscle} position={[1.85, -1.08, 0]} rotation={[0, 0, Math.PI / 2.6]}>
        <Part part="effector" anchor={[0.45, 0.2, 0]} roughness={0.7}>
          <latheGeometry args={[lathe, 36]} />
        </Part>
      </group>
      <mesh ref={spark} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshBasicMaterial color={PALETTE.glow} toneMapped={false} />
      </mesh>
    </group>
  );
}
