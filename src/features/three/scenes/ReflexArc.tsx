import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { SceneProps } from '../Viewer';
import { Part, TaperTube, curve, rand, useSelection } from './common';
import { CordSection, Ganglion } from './CordSection';
import { muscleProfile } from './shapes';

type P = [number, number, number];
const CORD: P = [0, 0.45, 0];
const SENSORY: P[] = [[-2.05, -0.74, 0.12], [-1.72, -0.22, 0.12], [-1.25, 0.42, 0.08], [-0.86, 0.78, 0.02], [-0.5, 0.86, 0.22], [-0.2, 0.78, 0.31]];
const INTER: P[] = [[-0.2, 0.78, 0.31], [0.0, 0.46, 0.33], [0.22, 0.12, 0.31]];
const MOTOR: P[] = [[0.22, 0.12, 0.31], [0.62, -0.1, 0.28], [1.18, -0.52, 0.18], [1.62, -0.86, 0.05]];
const ENDINGS: P[][] = [-1, 1].map((s) => [SENSORY[0], [-2.05 + s * 0.14, -0.84, 0.18], [-2.05 + s * 0.22, -0.9, 0.05]]);
const FULL = curve([...SENSORY, ...INTER.slice(1), ...MOTOR.slice(1)]);
// Progress windows along the arc → hotspot id (and impulse colour).
const WINDOWS: [string, number, number, string][] = [
  ['receptor', 0, 0.06, '#ffe08a'],
  ['sensory', 0.06, 0.5, '#ffd36b'],
  ['inter', 0.5, 0.62, '#d8b6ff'],
  ['motor', 0.62, 0.92, '#ff9a8a'],
  ['effector', 0.92, 1.01, '#ff9a8a'],
];

/** Fine cross-striations for skeletal muscle fibres (tiny procedural texture). */
function useStriations() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let y = 0; y < 64; y++) {
      const l = 205 + Math.round(Math.sin(y * 0.8) * 35);
      g.fillStyle = `rgb(${l},${Math.round(l * 0.55)},${Math.round(l * 0.52)})`;
      g.fillRect(0, y, 4, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Muscle() {
  const { selected, select } = useSelection();
  const lathe = useMemo(muscleProfile, []);
  const stripes = useStriations();
  const on = selected === 'effector';
  const dim = selected !== null && !on;
  const fibres = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: (rand(i, 3) - 0.5) * 0.24, z: (rand(i, 4) - 0.5) * 0.24, s: 0.42 + rand(i, 5) * 0.18 })), []);
  return (
    <group onClick={(e) => { if (e.delta > 8) return; e.stopPropagation(); select(on ? null : 'effector'); }}>
      {fibres.map((f, i) => (
        <mesh key={i} position={[f.x, 0, f.z]} scale={[f.s, 1, f.s]}>
          <latheGeometry args={[lathe, 24]} />
          <meshStandardMaterial key={dim ? 't' : 'o'} map={stripes} color="#e7a49b" roughness={0.55} emissive={on ? '#c85a4c' : '#000'} emissiveIntensity={on ? 0.3 : 0} transparent={dim} opacity={dim ? 0.3 : 1} />
        </mesh>
      ))}
    </group>
  );
}

function Skin() {
  const layers = useMemo(
    () => [
      { g: new RoundedBoxGeometry(1.25, 0.06, 0.95, 3, 0.03), y: -0.66, c: '#e9c5ad' }, // epidermis
      { g: new RoundedBoxGeometry(1.25, 0.24, 0.95, 3, 0.04), y: -0.81, c: '#dea193' }, // dermis
      { g: new RoundedBoxGeometry(1.25, 0.2, 0.95, 3, 0.05), y: -1.03, c: '#efd6a3' }, // subcutaneous fat
    ],
    [],
  );
  useEffect(() => () => layers.forEach((l) => l.g.dispose()), [layers]);
  return (
    <group position={[-2.0, 0, 0]}>
      {layers.map((l, i) => (
        <Part key={i} geometry={l.g} position={[0, l.y, 0]} color={l.c} roughness={0.8} pickable={false} />
      ))}
    </group>
  );
}

export default function ReflexArc({ scene, pulse, reduced, report }: SceneProps) {
  const { select } = useSelection();
  const spark = useRef<THREE.Mesh>(null);
  const sparkMat = useRef<THREE.MeshBasicMaterial>(null);
  const muscle = useRef<THREE.Group>(null);
  const prog = useRef(-1);
  const last = useRef<string | null>(null);
  const label = (id: string) => scene.hotspots.find((h) => h.id === id)?.label ?? id;

  useEffect(() => {
    if (pulse > 0) prog.current = 0;
  }, [pulse]);
  useEffect(() => () => report?.(null), [report]);

  useFrame((_, dt) => {
    if (prog.current < 0) return;
    prog.current += dt * (reduced ? 0.42 : 0.3);
    const p = Math.min(prog.current, 1);
    const w = WINDOWS.find(([, a, b]) => p >= a && p < b);
    const part = w?.[0] ?? null;
    if (part !== last.current) {
      last.current = part;
      select(part); // the travelling impulse highlights each arc component in turn
      report?.(part ? `${label(part)} (${WINDOWS.findIndex((x) => x[0] === part) + 1}/5)` : null);
    }
    if (spark.current) {
      spark.current.visible = !reduced && p < 1;
      spark.current.position.copy(FULL.getPointAt(p));
      if (w && sparkMat.current) sparkMat.current.color.set(w[3]);
    }
    if (muscle.current) {
      const k = p > 0.92 ? 1 - Math.sin(((p - 0.92) / 0.08) * Math.PI) * 0.16 : 1;
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
      <Skin />
      <Part part="receptor" position={SENSORY[0]} anchor={[0, 0.2, 0]} calloutDir={[-60, -40]} emissiveBoost={0.25}>
        <icosahedronGeometry args={[0.075, 3]} />
      </Part>
      {/* fine receptor endings in the dermis */}
      {ENDINGS.map((pts, i) => (
        <TaperTube key={i} part="receptor" points={pts} r0={0.012} r1={0.006} />
      ))}

      <group position={CORD}>
        <CordSection depth={0.9} scale={0.62} ids={{ white: 'inter', grey: 'inter' }} />
      </group>

      <TaperTube part="sensory" points={SENSORY} r0={0.034} r1={0.028} emissiveBoost={0.18} anchor={[-1.25, 0.5, 0.1]} calloutDir={[-60, -50]} />
      <Ganglion part="sensory" at={[-0.86, 0.78, 0.02]} scale={0.75} />
      <TaperTube part="inter" points={INTER} r0={0.026} r1={0.024} emissiveBoost={0.15} anchor={[0, 0.5, 0.34]} calloutDir={[60, -60]} />
      <Part part="inter" position={[0, 0.46, 0.33]}>
        <icosahedronGeometry args={[0.05, 2]} />
      </Part>
      <TaperTube part="motor" points={MOTOR} r0={0.034} r1={0.028} emissiveBoost={0.12} anchor={[0.9, -0.28, 0.25]} calloutDir={[50, 40]} />
      <Part part="motor" position={[0.22, 0.12, 0.31]}>
        <icosahedronGeometry args={[0.06, 2]} />
      </Part>

      <group ref={muscle} position={[2.02, -0.98, 0]} rotation={[0, 0, Math.PI / 2.5]}>
        <Muscle />
      </group>
      {/* effector callout point */}
      <Part part="effector" position={[2.02, -0.98, 0]} opacity={0.001} pickable={false} anchor={[0.1, 0.35, 0]} calloutDir={[30, -60]}>
        <sphereGeometry args={[0.01, 4, 4]} />
      </Part>

      <mesh ref={spark} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial ref={sparkMat} color="#ffe08a" toneMapped={false} />
      </mesh>
    </group>
  );
}
