import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { emph } from './common';

type Lobe = 'frontal' | 'parietal' | 'temporal' | 'occipital';
const LOBE_COLOR: Record<Lobe, THREE.Color> = {
  frontal: new THREE.Color('#d7a098'),
  parietal: new THREE.Color('#d4ab98'),
  temporal: new THREE.Color('#cc9aa4'),
  occipital: new THREE.Color('#cfa0b4'),
};
const HIGHLIGHT = new THREE.Color('#f0c36a');
const DIM = new THREE.Color('#8f8796');
const INNER = ['medulla', 'pons', 'midbrain', 'diencephalon'];

// Front of the brain points to −x, top to +y; the left hemisphere faces the camera (+z).
function lobeOf(nx: number, ny: number): Lobe {
  if (nx < -0.2) return 'frontal';
  if (nx > 0.62) return 'occipital';
  if (ny < -0.12) return 'temporal';
  return 'parietal';
}

function useHemisphere(side: 1 | -1) {
  return useMemo(() => {
    const g = new THREE.SphereGeometry(1, 120, 80);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const lobes: Lobe[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      lobes.push(lobeOf(v.x, v.y));
      // gyri: low-amplitude folds so the cortex reads as cortex, not a ball
      const fold = Math.sin(v.x * 13 + Math.sin(v.y * 7) * 2) * Math.cos(v.y * 11 + v.z * 9) * 0.035;
      const flat = side * v.z < 0 ? 0.55 : 1; // medial side flattened
      v.multiplyScalar(1 + fold);
      pos.setXYZ(i, v.x * 1.25, v.y * 0.92 * (v.y < 0 ? 0.8 : 1), v.z * 0.62 * flat);
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    return { geometry: g, lobes };
  }, [side]);
}

function Hemisphere({ side, selected, transparent }: { side: 1 | -1; selected: string | null; transparent: boolean }) {
  const { geometry, lobes } = useHemisphere(side);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const col = geometry.attributes.color as THREE.BufferAttribute;
    const isLeft = side === 1;
    lobes.forEach((lobe, i) => {
      const hit =
        selected === lobe ||
        selected === 'hemispheres' ||
        (isLeft && (selected === `${lobe}-left`));
      const anyLobe = selected !== null && (['frontal', 'parietal', 'temporal', 'occipital', 'hemispheres'].includes(selected) || selected.endsWith('-left'));
      const c = hit ? HIGHLIGHT : anyLobe ? LOBE_COLOR[lobe].clone().lerp(DIM, 0.55) : LOBE_COLOR[lobe];
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [selected, geometry, lobes, side]);
  return (
    <mesh geometry={geometry} position={[0, 0.25, side * 0.36]}>
      <meshStandardMaterial vertexColors roughness={0.72} transparent={transparent} opacity={transparent ? 0.18 : 1} depthWrite={!transparent} />
    </mesh>
  );
}

export default function Brain({ selected }: SceneProps) {
  const inner = selected !== null && INNER.includes(selected);
  return (
    <group rotation={[0.05, -0.35, 0]} scale={0.95}>
      <Hemisphere side={1} selected={selected} transparent={inner} />
      <Hemisphere side={-1} selected={selected} transparent={inner} />
      {/* diencephalon (inside, under the hemispheres) */}
      <mesh position={[0.1, -0.15, 0]} scale={[1.2, 0.8, 0.9]}>
        <sphereGeometry args={[0.24, 28, 20]} />
        <meshStandardMaterial {...emph(selected, 'diencephalon', '#c58f8a')} />
      </mesh>
      {/* midbrain */}
      <mesh position={[0.32, -0.48, 0]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.17, 0.16, 0.3, 24]} />
        <meshStandardMaterial {...emph(selected, 'midbrain', '#b98aa0')} />
      </mesh>
      {/* pons */}
      <mesh position={[0.4, -0.72, 0.02]} scale={[0.9, 0.85, 1]}>
        <sphereGeometry args={[0.22, 28, 20]} />
        <meshStandardMaterial {...emph(selected, 'pons', '#c6a07c')} />
      </mesh>
      {/* medulla oblongata, continuing into the spinal cord */}
      <mesh position={[0.52, -1.05, 0]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.15, 0.1, 0.5, 24]} />
        <meshStandardMaterial {...emph(selected, 'medulla', '#9fb48a')} />
      </mesh>
      {/* cerebellum: two small hemispheres under the occipital lobes */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.95, -0.62, s * 0.24]} scale={[0.8, 0.55, 0.7]}>
          <sphereGeometry args={[0.42, 32, 24]} />
          <meshStandardMaterial {...emph(selected, 'cerebellum', '#8fa3c9')} />
        </mesh>
      ))}
      <mesh position={[0.95, -0.62, 0]} scale={[0.5, 0.45, 0.35]}>
        <sphereGeometry args={[0.42, 24, 16]} />
        <meshStandardMaterial {...emph(selected, 'cerebellum', '#8297bf')} />
      </mesh>
    </group>
  );
}
