import { useMemo } from 'react';
import * as THREE from 'three';
import { Part, TaperTube, rand, useOrganic } from './common';
import { butterfly, cordOutline } from './shapes';

type P = [number, number, number];

/** A bundle of individual nerve fibres that fan out between two ends (reference: yellow root bundles). */
export function FiberBundle({ from, to, bend, count = 7, spread = 0.07, r = 0.016, part, color, seed = 1, emissiveBoost = 0, anchor, calloutDir }: {
  from: P;
  to: P;
  bend: P;
  count?: number;
  spread?: number;
  r?: number;
  part?: string;
  color?: string;
  seed?: number;
  emissiveBoost?: number;
  anchor?: P;
  calloutDir?: [number, number];
}) {
  const key = JSON.stringify([from, to, bend, count, spread, seed]); // inline array props: memo by value
  const paths = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const j = (k: number) => (rand(i, seed + k) - 0.5) * spread;
        // ends converge (bundle), middle fans out
        return [
          [from[0] + j(1) * 0.4, from[1] + j(2) * 0.4, from[2] + j(3) * 0.4],
          [bend[0] + j(4) * 1.6, bend[1] + j(5) * 1.6, bend[2] + j(6) * 1.6],
          [to[0] + j(7) * 0.5, to[1] + j(8) * 0.5, to[2] + j(9) * 0.5],
        ] as P[];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return (
    <>
      {paths.map((p, i) => (
        <TaperTube key={i} points={p} r0={r} r1={r * 0.85} part={part} color={color ?? (part ? undefined : '#e0b552')} emissiveBoost={emissiveBoost} anchor={i === 0 ? anchor : undefined} calloutDir={calloutDir} roughness={0.45} />
      ))}
    </>
  );
}

export function Ganglion({ at, part, scale = 1, anchor, calloutDir }: { at: P; part?: string; scale?: number; anchor?: P; calloutDir?: [number, number] }) {
  const geo = useOrganic(() => new THREE.SphereGeometry(0.13, 40, 28), 0.008, 9, 4);
  return <Part part={part} geometry={geo} position={at} scale={[1.45 * scale, 0.95 * scale, 1 * scale]} color={part ? undefined : "#d6a44a"} roughness={0.42} anchor={anchor} calloutDir={calloutDir} />;
}

/** Transverse spinal-cord segment: cream white matter, inlaid butterfly grey matter, central canal. */
export function CordSection({ depth = 1.1, ids = {}, scale = 1, anchors = false }: { depth?: number; ids?: { white?: string; grey?: string; canal?: string }; scale?: number; anchors?: boolean }) {
  const grey = useMemo(butterfly, []);
  const outline = useMemo(() => cordOutline(0.86, 0.7), []);
  return (
    <group scale={scale}>
      <Part part={ids.white} color={ids.white ? undefined : "#efe2c6"} roughness={0.7} position={[0, 0, -depth / 2]} anchor={anchors ? [-0.62, 0.5, depth] : undefined} calloutDir={[-30, -62]}>
        <extrudeGeometry args={[outline, { depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 4, curveSegments: 56 }]} />
      </Part>
      {/* grey matter inlaid flush with both cut faces so it reads from front and back */}
      <Part part={ids.grey} color={ids.grey ? undefined : "#9b7469"} roughness={0.75} position={[0, 0, -depth / 2 - 0.042]} scale={[1.18, 1.18, 1]} anchor={anchors ? [-0.3, 0.45, depth + 0.08] : undefined} calloutDir={[-60, -55]}>
        <extrudeGeometry args={[grey, { depth: depth + 0.084, bevelEnabled: false, curveSegments: 22 }]} />
      </Part>
      <Part part={ids.canal} color={ids.canal ? undefined : "#4e3358"} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.024, 0]} anchor={anchors ? [0, 0.3, 0] : undefined} calloutDir={[-70, 40]} roughness={0.3}>
        <cylinderGeometry args={[0.058, 0.058, depth + 0.1, 24]} />
      </Part>
    </group>
  );
}
