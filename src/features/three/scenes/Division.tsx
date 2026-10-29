import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { compareSteps, framesFor, meiosisFrames, mitosisFrames, type Chromatid, type Frame } from '../../division/stages';
import { Part, useSelection } from './common';

const COLOR = { p: '#6f86c9', m: '#c9839a' };

/** Chromatid with a slight waist at its centromere, lying along local x. */
function chromatidProfile(len: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const end = Math.sin(Math.PI * t) ** 0.35; // rounded tips
    const waist = 1 - 0.28 * Math.exp(-(((t - 0.5) / 0.08) ** 2));
    pts.push(new THREE.Vector2(0.052 * end * waist + 0.001, (t - 0.5) * len));
  }
  return new THREE.LatheGeometry(pts, 14).rotateZ(Math.PI / 2);
}
// Shared, tiny, module-lifetime geometries (two chromosome lengths + crossing-over tip).
const SHAPES = new Map<number, THREE.LatheGeometry>();
const shapeFor = (len: number) => {
  if (!SHAPES.has(len)) SHAPES.set(len, chromatidProfile(len));
  return SHAPES.get(len)!;
};

function Tween({ x, y, rot = 0, scale = 1, reduced, children }: { x: number; y: number; rot?: number; scale?: number; reduced: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const o = g.current;
    if (!o) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    o.position.x += (x - o.position.x) * k;
    o.position.y += (y - o.position.y) * k;
    o.rotation.z += (rot - o.rotation.z) * k;
    o.scale.setScalar(o.scale.x + (scale - o.scale.x) * k);
  });
  return (
    <group ref={g} position={[x, y, 0]} rotation={[0, 0, rot]} scale={scale}>
      {children}
    </group>
  );
}

function ChromatidMesh({ c, reduced, anchor }: { c: Chromatid; reduced: boolean; anchor?: boolean }) {
  return (
    <Tween x={c.x} y={c.y} rot={c.rot} scale={c.scale} reduced={reduced}>
      <Part part="xromosoma" color={COLOR[c.color]} geometry={shapeFor(c.len)} roughness={0.5} sheen={0.55} anchor={anchor ? [0, 0.25, 0] : undefined} />
      {c.tip && (
        <Part part="xromosoma" color={COLOR[c.tip]} position={[c.len * 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.054, c.len * 0.26, 6, 12]} />
        </Part>
      )}
    </Tween>
  );
}

/** Sister chromatids lying side by side are joined at the centromere. */
function centromeres(f: Frame) {
  const out: { id: string; x: number; y: number }[] = [];
  const byChr = new Map<string, Chromatid[]>();
  for (const c of f.chromatids) byChr.set(c.id.slice(0, 2), [...(byChr.get(c.id.slice(0, 2)) ?? []), c]);
  for (const [id, [a, b]] of byChr)
    if (a && b && a.scale > 0.6 && b.scale > 0.6 && Math.hypot(a.x - b.x, a.y - b.y) < 0.13) out.push({ id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return out;
}

function DivisionFrame({ f, reduced, prefix = '' }: { f: Frame; reduced: boolean; prefix?: string }) {
  const { selected, colors } = useSelection();
  const beads = useMemo(() => centromeres(f), [f]);
  const metaphase = f.id.startsWith('metafaza');
  const spindleOn = selected === 'urchuq';
  return (
    <group>
      {f.cells.map((cell, i) => (
        <group key={`${f.id}-${i}`} position={[cell.x, cell.y, 0]}>
          <Part pickable={false} opacity={0.13} roughness={0.25} color="#a9cdd0">
            <sphereGeometry args={[cell.r, 48, 32]} />
          </Part>
          {cell.nucleus > 0 && (
            <Part part="yadro" opacity={0.18 + 0.2 * cell.nucleus} anchor={i === 0 ? [0, cell.r * 0.55, 0] : undefined}>
              <icosahedronGeometry args={[cell.r * 0.5, 4]} />
            </Part>
          )}
          {cell.poles?.map(([px, py], k) => (
            <Part key={k} part="sentriola" position={[px - cell.x, py - cell.y, 0]} rotation={[Math.PI / 4, 0, Math.PI / 4]} anchor={i === 0 && k === 0 ? [0, 0.18, 0] : undefined}>
              <cylinderGeometry args={[0.028, 0.028, 0.11, 12]} />
            </Part>
          ))}
          {metaphase && cell.poles && (
            <Part part="ekvator" pickable={false} opacity={0.22} rotation={Math.abs(cell.poles[0][0] - cell.poles[1][0]) > 0.1 ? [0, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]} anchor={i === 0 ? [0, 0, cell.r * 0.9] : undefined}>
              <circleGeometry args={[cell.r * 0.86, 48]} />
            </Part>
          )}
        </group>
      ))}
      {f.cells.map((cell, i) =>
        cell.poles?.map(([px, py], k) => {
          const [ox, oy] = cell.poles![1 - k];
          return f.chromatids
            .filter((c) => Math.hypot(c.x - cell.x, c.y - cell.y) < cell.r && c.scale > 0.6 && Math.hypot(c.x - px, c.y - py) <= Math.hypot(c.x - ox, c.y - oy) + 0.02)
            .map((c) => (
              <Line
                key={`${prefix}${f.id}-${i}-${k}-${c.id}`}
                points={[[px, py, 0], [c.x, c.y, 0]]}
                color={spindleOn ? '#e7c56f' : colors.urchuq ?? '#a9a392'}
                lineWidth={spindleOn ? 2 : 1}
                transparent
                opacity={selected && !spindleOn ? 0.2 : 0.75}
              />
            ));
        }),
      )}
      {f.chromatids.map((c, i) => (
        <ChromatidMesh key={prefix + c.id} c={c} reduced={reduced} anchor={i === 0} />
      ))}
      {beads.map((b, i) => (
        <Tween key={prefix + 'cm' + b.id} x={b.x} y={b.y} reduced={reduced}>
          <Part part="sentromera" anchor={i === 0 ? [0, -0.15, 0] : undefined}>
            <icosahedronGeometry args={[0.045, 2]} />
          </Part>
        </Tween>
      ))}
    </group>
  );
}

const fitScale = (f: Frame, wide: number, single: number) => (f.cells.some((c) => Math.abs(c.x) > 0.8) ? wide : single);

export default function Division({ scene, stage, reduced }: SceneProps) {
  if (scene.mode === 'compare') {
    const s = compareSteps[Math.min(stage, compareSteps.length - 1)];
    const mi = mitosisFrames[s.mi];
    const me = meiosisFrames[s.me];
    return (
      <group>
        <group position={[-1.08, 0, 0]} scale={fitScale(mi, 0.48, 0.66)}>
          <DivisionFrame f={mi} reduced={reduced} prefix="mi-" />
        </group>
        <group position={[1.08, 0, 0]} scale={fitScale(me, 0.48, 0.66)}>
          <DivisionFrame f={me} reduced={reduced} prefix="me-" />
        </group>
      </group>
    );
  }
  const frames = framesFor(scene.mode === 'meiosis' ? 'meiosis' : 'mitosis');
  const f = frames[Math.min(stage, frames.length - 1)];
  return (
    <group scale={fitScale(f, 0.88, 1.22)}>
      <DivisionFrame f={f} reduced={reduced} />
    </group>
  );
}
