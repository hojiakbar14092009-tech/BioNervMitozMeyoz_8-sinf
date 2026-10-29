import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Membrane, Part, rand } from './common';

// Bacterial binary fission, Biologiya 10 p.73 (2.33-rasm): DNA replicates → copies separate →
// membrane grows inward → cytoplasm divides → two new bacteria.
// Per-stage targets: elongation, membrane pinch (0..1), daughter separation, DNA copy split.
const TARGET = [
  { elong: 0, pinch: 0, apart: 0, copy: 0, split: 0 },
  { elong: 0.08, pinch: 0, apart: 0, copy: 1, split: 0 },
  { elong: 0.32, pinch: 0, apart: 0, copy: 1, split: 1 },
  { elong: 0.42, pinch: 0.72, apart: 0, copy: 1, split: 1 },
  { elong: 0.42, pinch: 1, apart: 0.34, copy: 1, split: 1 },
];
const R = 0.42;
const L0 = 0.62; // half-length of the straight part

/** Each daughter exactly fills one half of the pinched mother cell (straight half-length, centre x), then they drift apart. */
export function daughterLayout(motherHalf: number, apart: number) {
  return { half: Math.max(0.05, (motherHalf + R) / 2 - R), x: (motherHalf + R) / 2 + apart * 0.5, cap: R };
}

/** Rod cell outline (lathe about x): rounded poles; `pinch` narrows the middle toward division. */
function rodProfile(half: number, pinch: number, cap = R) {
  const pts: THREE.Vector2[] = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * 2 - 1; // −1…1
    const x = s * (half + cap);
    const inCap = Math.max(0, Math.abs(x) - half);
    let r = Math.sqrt(Math.max(0, cap * cap - inCap * inCap));
    r *= 1 - pinch * 0.97 * Math.exp(-((x / 0.24) ** 2));
    pts.push(new THREE.Vector2(Math.max(r, i === 0 || i === n ? 0 : 0.004), x));
  }
  return pts;
}

/** Tangled nucleoid DNA thread as a closed coil. */
function useNucleoid(seed: number) {
  return useMemo(() => {
    const pts = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.22 + (rand(i, seed) - 0.5) * 0.18, Math.sin(a * 2) * 0.12 + (rand(i, seed + 1) - 0.5) * 0.12, Math.sin(a) * 0.16 + (rand(i, seed + 2) - 0.5) * 0.14);
    });
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 180, 0.017, 8, true);
    return g;
  }, [seed]);
}

function Cell({ half, pinch, x = 0 }: { half: number; pinch: number; x?: number }) {
  // rebuild only when the shape parameters change noticeably
  const key = `${half.toFixed(3)}|${pinch.toFixed(3)}`;
  const [outer, inner] = useMemo(() => {
    const o = new THREE.LatheGeometry(rodProfile(half, pinch), 48).rotateZ(-Math.PI / 2);
    const i = new THREE.LatheGeometry(rodProfile(half - 0.02, pinch, R - 0.04), 40).rotateZ(-Math.PI / 2);
    return [o, i];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      outer.dispose();
      inner.dispose();
    },
    [outer, inner],
  );
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={outer} raycast={() => null}>
        <Membrane color="#5fb3a3" rim="#e2fff8" opacity={0.12} strength={1.15} />
      </mesh>
      <Part part="membrana" geometry={outer} opacity={0.2} roughness={0.35} anchor={[-(half + R) * 0.55, R * 0.95, 0]} calloutDir={[-50, -50]} />
      <Part part="sitoplazma" geometry={inner} opacity={0.22} roughness={0.6} pickable={false} anchor={[(half + R) * 0.45, -R * 0.6, 0.2]} calloutDir={[50, 40]} />
    </group>
  );
}

export default function Binary({ stage, reduced }: { stage: number; reduced: boolean }) {
  const goal = TARGET[Math.min(stage, TARGET.length - 1)];
  const cur = useRef({ ...TARGET[0] });
  const [shape, setShape] = useState({ elong: 0, pinch: 0, apart: 0 });
  const dnaA = useRef<THREE.Group>(null);
  const dnaB = useRef<THREE.Group>(null);
  const coilA = useNucleoid(3);
  const coilB = useNucleoid(8);
  useEffect(
    () => () => {
      coilA.dispose();
      coilB.dispose();
    },
    [coilA, coilB],
  );

  useFrame((_, dt) => {
    const c = cur.current;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
    (Object.keys(c) as (keyof typeof c)[]).forEach((p) => (c[p] += (goal[p] - c[p]) * k));
    const half = L0 * (1 + c.elong);
    // DNA: second copy grows in (replication), then both move toward opposite halves
    const off = c.split * ((half + R) / 2) + c.apart * 0.5; // centre of each future daughter cell
    dnaA.current?.position.set(-off, 0, 0);
    dnaB.current?.position.set(off, 0, 0);
    dnaB.current?.scale.setScalar(Math.max(0.001, c.copy));
    if (dnaB.current) dnaB.current.visible = c.copy > 0.02;
    // only re-render the membrane geometry when it changed enough to be visible
    if (Math.abs(c.elong - shape.elong) > 0.01 || Math.abs(c.pinch - shape.pinch) > 0.01 || Math.abs(c.apart - shape.apart) > 0.01)
      setShape({ elong: c.elong, pinch: c.pinch, apart: c.apart });
  });

  const half = L0 * (1 + shape.elong);
  const separated = shape.pinch > 0.985;
  const { half: daughterHalf, x: daughterX } = daughterLayout(half, shape.apart);
  return (
    <group rotation={[0.15, 0, 0]}>
      {separated ? (
        // two daughter bacteria, each a complete rod
        <>
          <Cell half={daughterHalf} pinch={0} x={-daughterX} />
          <Cell half={daughterHalf} pinch={0} x={daughterX} />
        </>
      ) : (
        <Cell half={half} pinch={shape.pinch} />
      )}
      <group ref={dnaA}>
        <Part part="dnk" geometry={coilA} roughness={0.45} anchor={[0, 0.25, 0.1]} calloutDir={[-40, -60]} />
      </group>
      <group ref={dnaB} visible={false}>
        <Part part="dnk" geometry={coilB} roughness={0.45} />
      </group>
    </group>
  );
}
