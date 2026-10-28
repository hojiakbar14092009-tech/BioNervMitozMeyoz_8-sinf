import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { PALETTE } from './common';

const MITO = new THREE.Vector3(0.75, -0.15, 0);
// 36 ATP placed on a ring around the mitochondrion; 2 ATP from glycolysis in the cytosol.
const RING = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  return new THREE.Vector3(MITO.x + Math.cos(a) * 0.78, MITO.y + Math.sin(a) * 0.5, Math.sin(a * 3) * 0.12);
});

function Mitochondrion({ active }: { active: boolean }) {
  return (
    <group position={MITO} rotation={[0.3, 0.2, 0.15]}>
      <mesh scale={[1, 0.55, 0.55]}>
        <capsuleGeometry args={[0.32, 0.55, 12, 32]} />
        <meshStandardMaterial color={active ? '#e3a35f' : '#c98f6a'} transparent opacity={0.55} roughness={0.5} />
      </mesh>
      {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.5]}>
          <torusGeometry args={[0.13, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#a8603e" />
        </mesh>
      ))}
    </group>
  );
}

export default function Metabolism({ stage, reduced }: SceneProps) {
  const glucose = useRef<THREE.Mesh>(null);
  const lactate = useRef<THREE.Group>(null);
  const t = useRef(0);
  const polymer = useMemo(() => Array.from({ length: 6 }, (_, i) => new THREE.Vector3(-1.75 + i * 0.16, 0.85 - (i % 2) * 0.05, 0)), []);

  useFrame((_, dt) => {
    t.current = reduced ? 1 : Math.min(t.current + dt * 0.5, 1);
    const k = THREE.MathUtils.smoothstep(t.current, 0, 1);
    if (glucose.current) glucose.current.position.set(-1.1 + k * 0.6 * (stage >= 1 ? 1 : 0), 0.45 - k * 0.35 * (stage >= 1 ? 1 : 0), 0);
    if (lactate.current) {
      lactate.current.visible = stage >= 1;
      const to = stage >= 2 ? k : 0;
      lactate.current.position.set(-0.35 + to * 0.85, -0.05 - to * 0.05, 0);
    }
  });

  // reset the tween whenever the stage changes
  useEffect(() => {
    t.current = 0;
  }, [stage]);

  return (
    <group scale={0.95}>
      {/* cell membrane */}
      <mesh>
        <sphereGeometry args={[1.85, 48, 32]} />
        <meshStandardMaterial color="#9fc9c4" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-1.1, -0.2, -0.3]}>
        <sphereGeometry args={[0.38, 32, 24]} />
        <meshStandardMaterial color="#8a86b8" transparent opacity={0.6} />
      </mesh>
      <Mitochondrion active={stage === 2} />

      {/* stage 0: polysaccharide chain split into monomers outside the cell, energy lost as heat */}
      {stage === 0 &&
        polymer.map((p, i) => (
          <mesh key={i} position={[p.x - 0.3 + i * 0.07, p.y + 0.45, 0]}>
            <icosahedronGeometry args={[0.065, 0]} />
            <meshStandardMaterial color={PALETTE.teal} />
          </mesh>
        ))}

      {/* glucose → 2 lactic acid (+2 ATP) in the cytosol */}
      {stage >= 1 && (
        <mesh ref={glucose} visible={stage === 1}>
          <icosahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial color={PALETTE.teal} />
        </mesh>
      )}
      <group ref={lactate} visible={false}>
        {[-0.1, 0.1].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <octahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial color="#6fa3c9" />
          </mesh>
        ))}
      </group>
      {stage >= 1 &&
        [0, 1].map((i) => (
          <mesh key={i} position={[-0.6 + i * 0.22, 0.42, 0.1]}>
            <sphereGeometry args={[0.065, 16, 12]} />
            <meshStandardMaterial color={PALETTE.amber} emissive={PALETTE.amber} emissiveIntensity={0.35} />
          </mesh>
        ))}
      {stage === 2 &&
        RING.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <meshStandardMaterial color={PALETTE.amber} emissive={PALETTE.amber} emissiveIntensity={0.35} />
          </mesh>
        ))}
    </group>
  );
}
