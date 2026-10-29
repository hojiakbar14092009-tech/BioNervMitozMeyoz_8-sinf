import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { Part, useSelection } from './common';

type Lobe = 'frontal' | 'parietal' | 'temporal' | 'occipital';
const LOBES: Lobe[] = ['frontal', 'parietal', 'temporal', 'occipital'];
const BASE: Record<Lobe, THREE.Color> = {
  frontal: new THREE.Color('#d9a49b'),
  parietal: new THREE.Color('#d6ae9c'),
  temporal: new THREE.Color('#cf9ea7'),
  occipital: new THREE.Color('#d1a3b5'),
};
const HIGHLIGHT = new THREE.Color('#f0c879');
const DIM = new THREE.Color('#8f8796');
const SULCUS = new THREE.Color('#9c6f6c');
const INNER = ['medulla', 'pons', 'midbrain', 'diencephalon'];

// Front of the brain points to −x, top to +y; the left hemisphere faces the camera (+z).
function lobeOf(nx: number, ny: number): Lobe {
  if (nx < -0.2) return 'frontal';
  if (nx > 0.62) return 'occipital';
  if (ny < -0.12) return 'temporal';
  return 'parietal';
}

/** Depth of the major grooves that separate lobes (lateral, central, parieto-occipital). */
function sulcusDepth(nx: number, ny: number) {
  const lateral = nx > -0.35 && nx < 0.65 ? Math.exp(-(((ny + 0.12) / 0.045) ** 2)) : 0;
  const central = ny > -0.12 ? Math.exp(-(((nx + 0.2 - ny * 0.25) / 0.04) ** 2)) : 0;
  const po = ny > -0.3 ? Math.exp(-(((nx - 0.62) / 0.035) ** 2)) : 0;
  return Math.max(lateral, central * 0.8, po * 0.7);
}

function useHemisphere(side: 1 | -1) {
  return useMemo(() => {
    const g = new THREE.SphereGeometry(1, 160, 110);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const lobes: Lobe[] = [];
    const groove: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      lobes.push(lobeOf(v.x, v.y));
      const s = sulcusDepth(v.x, v.y);
      groove.push(s);
      // gyri: ridged, meandering folds (1 - |sin|) read as convolutions rather than noise
      const a = Math.sin(v.x * 15 + Math.sin(v.y * 7 + v.z * 4) * 2.2);
      const b = Math.sin(v.y * 17 + Math.cos(v.x * 6) * 1.8 + v.z * 5);
      const gyri = (1 - Math.abs(a * b)) * 0.055 - 0.027;
      const flat = side * v.z < 0 ? 0.5 : 1; // medial surface flattened
      v.multiplyScalar(1 + gyri - s * 0.06);
      pos.setXYZ(i, v.x * 1.25, v.y * 0.92 * (v.y < 0 ? 0.78 : 1), v.z * 0.62 * flat);
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    return { geometry: g, lobes, groove };
  }, [side]);
}

function Hemisphere({ side, hotspots }: { side: 1 | -1; hotspots: string[] }) {
  const { selected, select } = useSelection();
  const { geometry, lobes, groove } = useHemisphere(side);
  const inner = selected !== null && INNER.includes(selected);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const col = geometry.attributes.color as THREE.BufferAttribute;
    const lobeFocus = selected !== null && (LOBES.includes(selected as Lobe) || selected.endsWith('-left') || selected === 'hemispheres');
    const c = new THREE.Color();
    lobes.forEach((lobe, i) => {
      const hit = selected === lobe || selected === 'hemispheres' || (side === 1 && selected === `${lobe}-left`);
      c.copy(hit ? HIGHLIGHT : lobeFocus || (selected && !inner) ? BASE[lobe].clone().lerp(DIM, 0.5) : BASE[lobe]);
      c.lerp(SULCUS, groove[i] * 0.55); // grooves read darker
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [selected, geometry, lobes, groove, side, inner]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8 || !e.face) return;
    e.stopPropagation();
    const lobe = lobes[e.face.a];
    const id = side === 1 && hotspots.includes(`${lobe}-left`) ? `${lobe}-left` : hotspots.includes(lobe) ? lobe : hotspots.includes('hemispheres') ? 'hemispheres' : null;
    if (id) select(selected === id ? null : id);
  };

  return (
    <mesh geometry={geometry} position={[0, 0.25, side * 0.36]} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <meshStandardMaterial key={inner ? 't' : 'o'} vertexColors roughness={0.72} envMapIntensity={0.85} transparent={inner} opacity={inner ? 0.16 : 1} depthWrite={!inner} />
      {selected === 'hemispheres' && <Outlines thickness={0.012} color="#f2d28c" />}
    </mesh>
  );
}

/** Brainstem as one tapered column: midbrain → pons → medulla continuing into the spinal cord. */
const STEM: [number, number, number, string, string][] = [
  // [y, radius x, radius z, part id, colour]
  [-0.42, 0.17, 0.16, 'midbrain', '#b98aa0'],
  [-0.72, 0.23, 0.21, 'pons', '#c6a07c'],
  [-1.05, 0.14, 0.13, 'medulla', '#a9b98c'],
];

export default function Brain({ scene }: SceneProps) {
  const ids = scene.hotspots.map((h) => h.id);
  const has = (id: string) => ids.includes(id);
  const cerebellum = useMemo(() => {
    const g = new THREE.SphereGeometry(0.42, 64, 48);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + Math.sin(v.y * 70 + v.x * 6) * 0.018); // fine parallel folia
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => cerebellum.dispose(), [cerebellum]);

  return (
    <group rotation={[0.05, -0.3, 0]} position={[0, 0.15, 0]}>
      <Hemisphere side={1} hotspots={ids} />
      <Hemisphere side={-1} hotspots={ids} />
      <Part part={has('diencephalon') ? 'diencephalon' : undefined} color="#c58f8a" position={[0.1, -0.15, 0]} scale={[1.25, 0.8, 0.95]} anchor={[0, 0.35, 0.3]}>
        <icosahedronGeometry args={[0.24, 4]} />
      </Part>
      {STEM.map(([y, rx, rz, id, color], i) => (
        <Part key={id} part={has(id) ? id : undefined} color={color} position={[0.32 + i * 0.09, y, 0]} rotation={[0, 0, -0.22]} scale={[rx, i === 1 ? 0.2 : 0.24, rz]} anchor={[2.2, 0.2, 1.4]}>
          <sphereGeometry args={[1, 32, 24]} />
        </Part>
      ))}
      <Part part={has('medulla') ? 'medulla' : undefined} color="#a9b98c" position={[0.55, -1.32, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.11, 0.085, 0.4, 24]} />
      </Part>
      {[1, -1].map((s) => (
        <Part key={s} geometry={cerebellum} part={has('cerebellum') ? 'cerebellum' : undefined} color="#8fa3c9" position={[0.98, -0.6, s * 0.25]} scale={[0.85, 0.6, 0.72]} roughness={0.72} anchor={s === 1 ? [0.2, -0.7, 0.4] : undefined} />
      ))}
    </group>
  );
}
