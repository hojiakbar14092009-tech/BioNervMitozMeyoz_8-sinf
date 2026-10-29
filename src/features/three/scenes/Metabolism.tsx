import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { Part, useOrganic } from './common';

const MITO = new THREE.Vector3(0.78, -0.2, 0);
// 36 ATP on a ring around the mitochondrion (aerobic stage); 2 ATP in the cytosol (glycolysis).
const RING = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  return [MITO.x + Math.cos(a) * 0.82, MITO.y + Math.sin(a) * 0.52, Math.sin(a * 3) * 0.14] as [number, number, number];
});

function Mitochondrion() {
  const outer = useOrganic(() => new THREE.CapsuleGeometry(0.32, 0.62, 16, 32), 0.012, 6, 3);
  return (
    <group position={MITO} rotation={[0.3, 0.25, 0.12]}>
      <Part part="mitoxondriya" geometry={outer} scale={[1, 0.56, 0.56]} rotation={[0, 0, Math.PI / 2]} opacity={0.58} roughness={0.55} anchor={[0, 0.75, 0]} />
      {/* inner membrane folds (cristae) — passive detail */}
      {[-0.4, -0.22, -0.04, 0.14, 0.32].map((x) => (
        <Part key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 0.45]} color="#a8603e" pickable={false}>
          <torusGeometry args={[0.13, 0.022, 10, 28, Math.PI * 1.2]} />
        </Part>
      ))}
    </group>
  );
}

export default function Metabolism({ stage, reduced }: SceneProps) {
  const glucose = useRef<THREE.Group>(null);
  const lactate = useRef<THREE.Group>(null);
  const t = useRef(0);
  const cell = useOrganic(() => new THREE.SphereGeometry(1.85, 64, 48), 0.03, 2.2, 5);

  useEffect(() => {
    t.current = 0;
  }, [stage]);

  useFrame((_, dt) => {
    t.current = reduced ? 1 : Math.min(t.current + dt * 0.5, 1);
    const k = THREE.MathUtils.smoothstep(t.current, 0, 1);
    if (glucose.current) {
      glucose.current.visible = stage <= 1;
      glucose.current.position.set(-1.0 + (stage === 1 ? k * 0.55 : 0), 0.55 - (stage === 1 ? k * 0.4 : 0), 0.1);
      glucose.current.scale.setScalar(stage === 1 ? 1 - k * 0.6 : 1);
    }
    if (lactate.current) {
      lactate.current.visible = stage >= 1;
      const to = stage >= 2 ? k : 0;
      lactate.current.position.set(-0.4 + to * 0.95, -0.05 - to * 0.12, 0.1);
      lactate.current.scale.setScalar(stage >= 2 ? 1 - k * 0.7 : 1);
    }
  });

  return (
    <group>
      {/* cell membrane enclosing the cytosol: not pickable so inner organelles remain tappable */}
      <Part part="sitozol" geometry={cell} opacity={0.14} roughness={0.3} pickable={false} anchor={[-1.2, 1.5, 0.4]} />
      <Part position={[-1.05, -0.35, -0.45]} color="#8f88b8" opacity={0.65} pickable={false}>
        <icosahedronGeometry args={[0.4, 4]} />
      </Part>
      <Mitochondrion />

      {/* stage 0: chain of monomers released — energy lost as heat */}
      {stage === 0 &&
        Array.from({ length: 6 }, (_, i) => (
          <Part key={i} part="glyukoza" position={[-1.55 + i * 0.17, 1.05 - (i % 2) * 0.06, 0.2]}>
            <dodecahedronGeometry args={[0.065, 0]} />
          </Part>
        ))}
      <group ref={glucose}>
        <Part part="glyukoza" anchor={[0, 0.3, 0]}>
          <dodecahedronGeometry args={[0.12, 0]} />
        </Part>
      </group>
      <group ref={lactate} visible={false}>
        {[-0.1, 0.1].map((y) => (
          <Part key={y} position={[0, y, 0]} color="#6fa3c9">
            <octahedronGeometry args={[0.075, 0]} />
          </Part>
        ))}
      </group>
      {stage >= 1 &&
        [0, 1].map((i) => (
          <Part key={i} part="atf" position={[-0.62 + i * 0.22, 0.4, 0.2]} anchor={i === 0 ? [0, 0.22, 0] : undefined}>
            <icosahedronGeometry args={[0.06, 2]} />
          </Part>
        ))}
      {stage === 2 &&
        RING.map((p, i) => (
          <Part key={i} part="atf" position={p}>
            <icosahedronGeometry args={[0.042, 1]} />
          </Part>
        ))}
    </group>
  );
}
