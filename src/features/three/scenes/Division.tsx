import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { framesFor, type Chromatid } from '../../division/stages';

const COLOR = { p: '#5f7fc8', m: '#c97f95' };

function ChromatidMesh({ c, reduced }: { c: Chromatid; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const o = g.current;
    if (!o) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    o.position.x += (c.x - o.position.x) * k;
    o.position.y += (c.y - o.position.y) * k;
    o.rotation.z += (c.rot - o.rotation.z) * k;
    const s = o.scale.x + (c.scale - o.scale.x) * k;
    o.scale.setScalar(s);
  });
  const half = c.len / 2;
  return (
    <group ref={g} position={[c.x, c.y, 0]} rotation={[0, 0, c.rot]} scale={c.scale}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.05, c.len, 6, 16]} />
        <meshStandardMaterial color={COLOR[c.color]} roughness={0.45} />
      </mesh>
      {c.tip && (
        <mesh position={[half * 0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.053, c.len * 0.32, 6, 12]} />
          <meshStandardMaterial color={COLOR[c.tip]} roughness={0.45} />
        </mesh>
      )}
    </group>
  );
}

export default function Division({ scene, stage, reduced }: SceneProps) {
  const frames = framesFor(scene.mode === 'meiosis' ? 'meiosis' : 'mitosis');
  const f = frames[Math.min(stage, frames.length - 1)];
  const wide = f.cells.some((c) => Math.abs(c.x) > 0.8);
  return (
    <group scale={wide ? 0.85 : 1.25}>
      {f.cells.map((cell, i) => (
        <group key={`${f.id}-${i}`} position={[cell.x, cell.y, 0]}>
          <mesh>
            <sphereGeometry args={[cell.r, 48, 32]} />
            <meshStandardMaterial color="#9fc2c8" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {cell.nucleus > 0 && (
            <mesh>
              <sphereGeometry args={[cell.r * 0.5, 32, 24]} />
              <meshStandardMaterial color="#8a86b8" transparent opacity={0.22 * cell.nucleus} depthWrite={false} />
            </mesh>
          )}
          {cell.poles?.map(([px, py], k) => (
            <mesh key={k} position={[px - cell.x, py - cell.y, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.1, 10]} />
              <meshStandardMaterial color="#d8a24a" />
            </mesh>
          ))}
        </group>
      ))}
      {f.cells.map((cell, i) =>
        cell.poles?.map(([px, py], k) => {
          const [ox, oy] = cell.poles![1 - k];
          return f.chromatids
            .filter((c) => Math.hypot(c.x - cell.x, c.y - cell.y) < cell.r && c.scale > 0.6 && Math.hypot(c.x - px, c.y - py) <= Math.hypot(c.x - ox, c.y - oy) + 0.02)
            .map((c) => (
              <Line key={`${f.id}-${i}-${k}-${c.id}`} points={[[px, py, 0], [c.x, c.y, 0]]} color="#b8b3a2" lineWidth={1} transparent opacity={0.7} />
            ));
        }),
      )}
      {f.chromatids.map((c) => (
        <ChromatidMesh key={c.id} c={c} reduced={reduced} />
      ))}
    </group>
  );
}
