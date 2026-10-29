import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { HitProxy, Part, rand, taperedTube, useOrganic } from './common';
import { butterfly, cordOutline } from './shapes';

type P = [number, number, number];

/**
 * A bundle of individual nerve fibres (reference: yellow root bundles), merged into one mesh.
 * `fan` spreads the fibres along the cord (z) where they leave it, as rootlets that converge into the root.
 */
export function FiberBundle({ from, to, bend, count = 7, spread = 0.07, r = 0.016, fan = 0, part, color, seed = 1, emissiveBoost = 0, anchor, calloutDir }: {
  from: P;
  to: P;
  bend: P;
  count?: number;
  spread?: number;
  r?: number;
  fan?: number;
  part?: string;
  color?: string;
  seed?: number;
  emissiveBoost?: number;
  anchor?: P;
  calloutDir?: [number, number];
}) {
  const key = JSON.stringify([from, to, bend, count, spread, r, fan, seed]); // inline array props: memo by value
  const geo = useMemo(
    () => {
      const tubes = Array.from({ length: count }, (_, i) => {
        const j = (k: number) => (rand(i, seed + k) - 0.5) * spread;
        const along = count > 1 ? (i / (count - 1) - 0.5) * fan : 0;
        const w = r * (0.75 + rand(i, seed + 10) * 0.5); // fibres differ in thickness
        const pts: P[] = [
          [from[0] + j(1) * 0.4, from[1] + j(2) * 0.4, from[2] + j(3) * 0.4 + along],
          [bend[0] + j(4) * (fan ? 0.8 : 1.6), bend[1] + j(5) * (fan ? 0.8 : 1.6), bend[2] + j(6) * (fan ? 0.8 : 1.6) + along * 0.25],
          [to[0] + j(7) * 0.5, to[1] + j(8) * 0.5, to[2] + j(9) * 0.5],
        ];
        return taperedTube(pts, w, w * 0.8, 24, 8);
      });
      const merged = mergeBufferGeometries(tubes)!;
      tubes.forEach((t) => t.dispose());
      return merged;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <Part geometry={geo} part={part} color={color ?? (part ? undefined : '#e0b552')} emissiveBoost={emissiveBoost} anchor={anchor} calloutDir={calloutDir} roughness={0.45} />;
}

export function Ganglion({ at, part, scale = 1, anchor, calloutDir }: { at: P; part?: string; scale?: number; anchor?: P; calloutDir?: [number, number] }) {
  const geo = useOrganic(() => new THREE.SphereGeometry(0.13, 40, 28), 0.008, 9, 4);
  return <Part part={part} geometry={geo} position={at} scale={[1.45 * scale, 0.95 * scale, 1 * scale]} color={part ? undefined : "#d6a44a"} roughness={0.42} anchor={anchor} calloutDir={calloutDir} />;
}

/** Transverse spinal-cord segment: cream white matter, inlaid butterfly grey matter, central canal. */
export function CordSection({ depth = 1.1, ids = {}, scale = 1, anchors = false, natural = false }: { depth?: number; ids?: { white?: string; grey?: string; canal?: string }; scale?: number; anchors?: boolean; natural?: boolean }) {
  const grey = useMemo(butterfly, []);
  const outline = useMemo(() => cordOutline(0.86, 0.7), []);
  // `natural`: keep tissue colours even when the regions select another hotspot (reflex arc → "inter")
  return (
    <group scale={scale}>
      <Part part={ids.white} color={ids.white && !natural ? undefined : "#efe2c6"} roughness={0.7} position={[0, 0, -depth / 2]} anchor={anchors ? [-0.62, 0.5, depth] : undefined} calloutDir={[-30, -62]}>
        <extrudeGeometry args={[outline, { depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 4, curveSegments: 56 }]} />
      </Part>
      {/* grey matter inlaid flush with both cut faces so it reads from front and back */}
      <Part part={ids.grey} color={ids.grey && !natural ? undefined : "#9b7469"} roughness={0.75} position={[0, 0, -depth / 2 - 0.042]} scale={[1.18, 1.18, 1]} anchor={anchors ? [-0.3, 0.45, depth + 0.08] : undefined} calloutDir={[-60, -55]}>
        <extrudeGeometry args={[grey, { depth: depth + 0.084, bevelEnabled: false, curveSegments: 22 }]} />
      </Part>
      <HitProxy part={ids.canal} radius={0.11} length={depth + 0.2} position={[0, -0.024, 0]} />
      <Part part={ids.canal} color={ids.canal ? undefined : "#4e3358"} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.024, 0]} anchor={anchors ? [0, 0.3, 0] : undefined} calloutDir={[-70, 40]} roughness={0.3}>
        <cylinderGeometry args={[0.058, 0.058, depth + 0.1, 24]} />
      </Part>
    </group>
  );
}
