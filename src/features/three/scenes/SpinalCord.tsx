import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE, Tube, emph } from './common';

type P = [number, number, number];

/** Butterfly-shaped grey matter (posterior horns up, anterior horns down). */
function butterfly() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.bezierCurveTo(0.1, 0.18, 0.18, 0.35, 0.28, 0.52); // right posterior horn
  s.bezierCurveTo(0.36, 0.56, 0.4, 0.48, 0.34, 0.36);
  s.bezierCurveTo(0.3, 0.2, 0.42, 0.08, 0.46, -0.08);
  s.bezierCurveTo(0.52, -0.3, 0.46, -0.48, 0.32, -0.5); // right anterior horn
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

const DORSAL_R: P[] = [[0.3, 0.5, 0], [0.75, 0.62, 0], [1.15, 0.35, 0], [1.45, 0, 0]];
const VENTRAL_R: P[] = [[0.35, -0.48, 0], [0.8, -0.5, 0], [1.15, -0.25, 0], [1.45, 0, 0]];
const NERVE_R: P[] = [[1.45, 0, 0], [1.9, -0.1, 0], [2.2, -0.25, 0]];
const mirror = (ps: P[]): P[] => ps.map(([x, y, z]) => [-x, y, z]);
const DORSAL_L = mirror(DORSAL_R);
const VENTRAL_L = mirror(VENTRAL_R);
const NERVE_L = mirror(NERVE_R);

export default function SpinalCord({ selected }: SceneProps) {
  const shape = useMemo(butterfly, []);
  const depth = 0.5;
  return (
    <group rotation={[-0.35, 0.45, 0]} scale={1.05}>
      {/* white matter: oval cord with a hole for the central canal */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 0.92]}>
        <cylinderGeometry args={[0.75, 0.75, depth, 48]} />
        <meshStandardMaterial {...emph(selected, 'white', PALETTE.white)} transparent opacity={selected && selected !== 'white' ? 0.22 : 0.6} />
      </mesh>
      <mesh position={[0, 0, -depth / 2 - 0.005]} scale={1.18}>
        <extrudeGeometry args={[shape, { depth: depth + 0.01, bevelEnabled: false, curveSegments: 20 }]} />
        <meshStandardMaterial {...emph(selected, 'grey', PALETTE.grey)} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.024, 0]}>
        <cylinderGeometry args={[0.055, 0.055, depth + 0.02, 20]} />
        <meshStandardMaterial {...emph(selected, 'canal', '#7fb3d6')} />
      </mesh>
      {[DORSAL_R, DORSAL_L].map((p, i) => (
        <Tube key={`d${i}`} points={p} radius={0.05} material={emph(selected, 'dorsal', PALETTE.blue)} />
      ))}
      {[VENTRAL_R, VENTRAL_L].map((p, i) => (
        <Tube key={`v${i}`} points={p} radius={0.05} material={emph(selected, 'ventral', PALETTE.rose)} />
      ))}
      {[NERVE_R, NERVE_L].map((p, i) => (
        <Tube key={`n${i}`} points={p} radius={0.075} material={emph(selected, ['dorsal', 'ventral'], PALETTE.nerve)} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 1.05, 0.48, 0]} scale={[1.3, 0.9, 0.9]}>
          <sphereGeometry args={[0.12, 20, 16]} />
          <meshStandardMaterial {...emph(selected, ['ganglion', 'dorsal'], PALETTE.amber)} />
        </mesh>
      ))}
    </group>
  );
}
