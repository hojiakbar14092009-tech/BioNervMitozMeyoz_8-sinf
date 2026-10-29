import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { InstancedSpheres, Membrane, Part, rand, useOrganic } from './common';

type P = [number, number, number];
const MITOS: { at: P; rot: P; s: number }[] = [
  { at: [0.75, -0.25, 0], rot: [0.3, 0.25, 0.15], s: 1 },
  { at: [-0.35, -0.95, 0.35], rot: [0.9, -0.4, 0.6], s: 0.72 },
  { at: [0.55, 0.85, -0.45], rot: [-0.4, 0.8, -0.3], s: 0.68 },
];
const MAIN = MITOS[0].at;

/** Volumetric mitochondrion: outer membrane (opens in section view) + folded inner membrane (cristae). */
function Mitochondrion({ at, rot, s, label }: { at: P; rot: P; s: number; label?: boolean }) {
  const outer = useOrganic(() => new THREE.CapsuleGeometry(0.3, 0.62, 16, 40), 0.012, 6, 3);
  const inner = useOrganic(() => new THREE.CapsuleGeometry(0.255, 0.56, 12, 32), 0.01, 7, 5);
  return (
    <group position={at} rotation={rot} scale={s}>
      <Part part="mitoxondriya" geometry={outer} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.62]} roughness={0.45} clip={label} anchor={label ? [0.35, 0.05, 0.2] : undefined} calloutDir={[50, -60]} />
      <Part part="mitoxondriya" geometry={inner} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.58]} color="#e9a56a" roughness={0.6} pickable={false} clip={label} />
      {/* cristae: inner-membrane folds across the matrix */}
      {[-0.42, -0.26, -0.1, 0.06, 0.22, 0.38].map((x, i) => (
        <Part key={x} part="mitoxondriya" position={[x, (i % 2 ? 1 : -1) * 0.03, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.15, 0.5]} color="#b8603f" pickable={false}>
          <torusGeometry args={[0.15, 0.026, 10, 28, Math.PI * 1.25]} />
        </Part>
      ))}
    </group>
  );
}

/** Ball-and-stick ring (6 carbons) for glucose; 3-carbon chain for its products. */
function Molecule({ ring, part }: { ring: boolean; part?: string }) {
  const atoms = useMemo(() => {
    const n = ring ? 6 : 3;
    return Array.from({ length: n }, (_, i): P => (ring ? [Math.cos((i / 6) * Math.PI * 2) * 0.12, Math.sin((i / 6) * Math.PI * 2) * 0.12, 0] : [(i - 1) * 0.11, (i % 2) * 0.05, 0]));
  }, [ring]);
  const oxy = useMemo(() => atoms.map((a, i): P => [a[0] * 1.7, a[1] * 1.7 + (ring ? 0 : 0.09), (i % 2 ? 0.05 : -0.05)]).filter((_, i) => i % 2 === 0), [atoms, ring]);
  return (
    <group>
      <InstancedSpheres part={part} color="#4a4f5c" points={atoms} radii={[0.042]} detail={2} />
      <InstancedSpheres part={part} color="#d9554f" points={oxy} radii={[0.036]} detail={2} />
      {atoms.map((a, i) => {
        const b = atoms[(i + 1) % atoms.length];
        if (!ring && i === atoms.length - 1) return null;
        const mid = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5);
        const dir = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return (
          <mesh key={i} position={mid} quaternion={q} raycast={() => null}>
            <cylinderGeometry args={[0.012, 0.012, dir.length(), 8]} />
            <meshStandardMaterial color="#cfd3dc" roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Small glowing particles drifting along the energy path (glycolysis → mitochondrion). */
function Flow({ active, reduced }: { active: boolean; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const path = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-1.1, 0.5, 0.25), new THREE.Vector3(-0.45, 0.2, 0.3), new THREE.Vector3(0.2, -0.05, 0.25), new THREE.Vector3(MAIN[0], MAIN[1], 0.15)]), []);
  const t = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.visible = active && !reduced;
    if (!m.visible) return;
    t.current += dt * 0.18;
    for (let i = 0; i < 14; i++) {
      const u = (t.current + i / 14) % 1;
      o.position.copy(path.getPointAt(u));
      o.position.y += Math.sin(u * 20 + i) * 0.02;
      o.scale.setScalar(0.02 + 0.012 * Math.sin(u * Math.PI));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 14]} raycast={() => null}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial color="#ffd27a" toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  );
}

export default function Metabolism({ stage, reduced }: SceneProps) {
  const glucose = useRef<THREE.Group>(null);
  const products = useRef<THREE.Group>(null);
  const t = useRef(0);
  const cell = useOrganic(() => new THREE.SphereGeometry(1.85, 72, 54), 0.035, 2.2, 5);
  const nucleus = useOrganic(() => new THREE.SphereGeometry(0.42, 48, 36), 0.02, 6, 2);
  const ring36 = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i): P => {
        const a = (i / 36) * Math.PI * 2;
        return [MAIN[0] + Math.cos(a) * 0.82, MAIN[1] + Math.sin(a) * 0.52, Math.sin(a * 3) * 0.16 + (rand(i, 2) - 0.5) * 0.1];
      }),
    [],
  );

  useEffect(() => {
    t.current = 0;
  }, [stage]);

  useFrame((_, dt) => {
    t.current = reduced ? 1 : Math.min(t.current + dt * 0.5, 1);
    const k = THREE.MathUtils.smoothstep(t.current, 0, 1);
    if (glucose.current) {
      glucose.current.visible = stage <= 1;
      glucose.current.position.set(-1.1 + (stage === 1 ? k * 0.45 : 0), 0.55 - (stage === 1 ? k * 0.3 : 0), 0.25);
      glucose.current.scale.setScalar(stage === 1 ? 1 - k * 0.5 : 1);
      glucose.current.rotation.z += reduced ? 0 : dt * 0.3;
    }
    if (products.current) {
      products.current.visible = stage >= 1;
      const to = stage >= 2 ? k : 0;
      products.current.position.set(-0.45 + to * 1.1, 0.12 - to * 0.32, 0.3 - to * 0.12);
      products.current.scale.setScalar(stage >= 2 ? 1 - k * 0.6 : 1);
    }
  });

  return (
    <group>
      {/* cell boundary enclosing the cytosol (not pickable so organelles stay tappable) */}
      <mesh geometry={cell} raycast={() => null}>
        <Membrane color="#8fb7c2" rim="#e3f4ff" opacity={0.07} strength={1.05} />
      </mesh>
      <Part part="sitozol" geometry={cell} opacity={0.035} pickable={false} anchor={[-1.25, 1.2, 0.6]} calloutDir={[-40, -50]} />
      <Part geometry={nucleus} position={[-1.0, -0.15, -0.55]} color="#8a72c4" opacity={0.85} roughness={0.5} pickable={false} />
      {MITOS.map((m, i) => (
        <Mitochondrion key={i} {...m} label={i === 0} />
      ))}

      {stage === 0 &&
        Array.from({ length: 5 }, (_, i) => (
          <group key={i} position={[-1.45 + i * 0.32, 1.0 - (i % 2) * 0.12, 0.35]} scale={0.6}>
            <Molecule ring part="glyukoza" />
          </group>
        ))}
      <group ref={glucose}>
        <Molecule ring part="glyukoza" />
        <Part part="glyukoza" opacity={0.001} pickable={false} anchor={[0, 0.22, 0]} calloutDir={[-50, -50]}>
          <sphereGeometry args={[0.01, 4, 4]} />
        </Part>
      </group>
      <group ref={products} visible={false}>
        {[-0.14, 0.14].map((y) => (
          <group key={y} position={[0, y, 0]} scale={0.8}>
            <Molecule ring={false} />
          </group>
        ))}
      </group>

      {stage >= 1 && <InstancedSpheres part="atf" points={[[-0.62, 0.42, 0.35], [-0.4, 0.46, 0.35]]} radii={[0.06]} emissiveBoost={0.35} anchor={[-0.62, 0.55, 0.35]} calloutDir={[-50, -50]} />}
      {stage === 2 && <InstancedSpheres part="atf" points={ring36} radii={[0.045]} emissiveBoost={0.35} />}
      <Flow active={stage >= 1} reduced={reduced} />
    </group>
  );
}
