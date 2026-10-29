import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { compareSteps, framesFor, meiosisFrames, mitosisFrames, type Chromatid, type Frame } from '../../division/stages';
import { Callout, Membrane, Part, rand, useSelection } from './common';
import Binary from './Binary';

// Reference 3 (mitosis): violet/indigo chromatin. Reference 5 (meiosis): blue paternal, red maternal homologs.
const PALETTES = {
  mitosis: { p: '#6a63d6', m: '#9a63cf' },
  meiosis: { p: '#4d6fd0', m: '#cf5a5f' },
};
type Pal = (typeof PALETTES)['mitosis'];

const RADIAL = 20;
const ALONG = 48;

/**
 * Smooth volumetric chromatid along local x: closed surface (radius → 0 at the tips), a waist at the
 * centromere, and low-amplitude relief so it reads as condensed chromatin rather than a rod or bead chain.
 * Vertex attribute `t` (0…1 along the arm) drives the crossing-over colour blend.
 */
function chromatidGeometry(len: number, seed: number) {
  const pos: number[] = [];
  const ts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= ALONG; i++) {
    const t = i / ALONG;
    const waist = 1 - 0.34 * Math.exp(-(((t - 0.5) / 0.065) ** 2));
    const tip = Math.sin(Math.PI * t) ** 0.42;
    const r0 = 0.052 * waist * tip;
    const x = (t - 0.5) * len;
    for (let j = 0; j <= RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      const relief = 1 + 0.07 * Math.sin(t * 46 + a * 3 + seed) + 0.04 * Math.sin(t * 91 - a * 5 + seed * 2);
      const r = r0 * relief;
      pos.push(x, Math.cos(a) * r, Math.sin(a) * r);
      ts.push(t);
    }
  }
  for (let i = 0; i < ALONG; i++)
    for (let j = 0; j < RADIAL; j++) {
      const a = i * (RADIAL + 1) + j;
      const b = a + RADIAL + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.userData.t = ts;
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** One chromatid; crossing-over blends the far arm (t > 0.62) toward the homologue's colour over time. */
function ChromatidMesh({ c, pal, reduced, anchor }: { c: Chromatid; pal: Pal; reduced: boolean; anchor?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { selected, select, labels, anchors, showLabels } = useSelection();
  const geo = useMemo(() => chromatidGeometry(c.len, c.id.charCodeAt(0) + c.id.charCodeAt(2) * 3), [c.len, c.id]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mix = useRef(c.tip ? 0 : 1);
  const on = selected === 'xromosoma';
  const dim = selected !== null && !on;
  const own = useMemo(() => new THREE.Color(pal[c.color]), [pal, c.color]);
  const other = useMemo(() => new THREE.Color(pal[c.tip ?? c.color]), [pal, c.tip, c.color]);

  const paint = (w: number) => {
    const col = geo.attributes.color as THREE.BufferAttribute;
    const t = geo.userData.t as number[];
    const tmp = new THREE.Color();
    for (let i = 0; i < t.length; i++) {
      // exchange front travels outward from the crossing region toward the tip
      const k = c.tip && t[i] > 0.6 ? THREE.MathUtils.smoothstep(w, (t[i] - 0.6) * 1.1, (t[i] - 0.6) * 1.1 + 0.35) : 0;
      tmp.copy(own).lerp(other, k);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  };

  useLayoutEffect(() => {
    mix.current = reduced || !c.tip ? 1 : 0; // the exchange replays when crossing-over first appears
    paint(mix.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, own, other, c.tip, reduced]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    g.position.x += (c.x - g.position.x) * k;
    g.position.y += (c.y - g.position.y) * k;
    g.position.z += ((c.z ?? 0) - g.position.z) * k;
    g.rotation.z += (c.rot - g.rotation.z) * k;
    g.scale.setScalar(g.scale.x + (c.scale - g.scale.x) * k);
    if (c.tip && mix.current < 1) {
      mix.current = Math.min(1, mix.current + dt * 0.5);
      paint(mix.current);
    }
  });

  return (
    <group ref={group} position={[c.x, c.y, c.z ?? 0]} rotation={[0, 0, c.rot]} scale={c.scale}>
      <mesh
        geometry={geo}
        onClick={(e) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          select(on ? null : 'xromosoma');
        }}
      >
        <meshStandardMaterial key={dim ? 't' : 'o'} vertexColors roughness={0.55} envMapIntensity={0.9} emissive={on ? '#b9a6ff' : '#000'} emissiveIntensity={on ? 0.22 : 0} transparent={dim} opacity={dim ? 0.4 : 1} />
      </mesh>
      {anchor && (showLabels || (on && anchors)) && (
        <Html position={[0, 0.06, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Callout part="xromosoma" dir={[-70, -50]} on={on} label={labels.xromosoma} color={pal.p} select={select} />
        </Html>
      )}
    </group>
  );
}

function Tween({ x, y, z = 0, reduced, children }: { x: number; y: number; z?: number; reduced: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const o = g.current;
    if (!o) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    o.position.x += (x - o.position.x) * k;
    o.position.y += (y - o.position.y) * k;
    o.position.z += (z - o.position.z) * k;
  });
  return (
    <group ref={g} position={[x, y, z]}>
      {children}
    </group>
  );
}

/** Sister chromatids lying side by side are joined at the centromere. */
function centromeres(f: Frame) {
  const out: { id: string; x: number; y: number; z: number }[] = [];
  const byChr = new Map<string, Chromatid[]>();
  for (const c of f.chromatids) byChr.set(c.id.slice(0, 2), [...(byChr.get(c.id.slice(0, 2)) ?? []), c]);
  for (const [id, [a, b]] of byChr)
    if (a && b && a.scale > 0.6 && b.scale > 0.6 && Math.hypot(a.x - b.x, a.y - b.y) < 0.13) out.push({ id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: a.z ?? 0 });
  return out;
}

/** Centriole pair (two short perpendicular cylinders) inside a soft centrosome. */
function Centrosome({ at, anchor }: { at: [number, number, number]; anchor: boolean }) {
  return (
    <group position={at}>
      <Part part="sentriola" rotation={[0, 0, Math.PI / 2]} anchor={anchor ? [0, 0.12, 0] : undefined} calloutDir={[50, -50]} roughness={0.4}>
        <cylinderGeometry args={[0.022, 0.022, 0.085, 12]} />
      </Part>
      <Part part="sentriola" rotation={[Math.PI / 2, 0, 0]} roughness={0.4}>
        <cylinderGeometry args={[0.022, 0.022, 0.085, 12]} />
      </Part>
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshBasicMaterial color="#f2c46f" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Small passive cytoplasm inclusions so the cell interior reads as living cytoplasm. */
function Inclusions({ r, seed }: { r: number; seed: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = rand(i, seed) * Math.PI * 2;
        const e = rand(i, seed + 1) * Math.PI - Math.PI / 2;
        const d = r * (0.66 + rand(i, seed + 2) * 0.22);
        return { p: [Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d * 0.8, Math.sin(a) * Math.cos(e) * d] as [number, number, number], rot: rand(i, seed + 3) * 3, s: 0.6 + rand(i, seed + 4) * 0.6 };
      }),
    [r, seed],
  );
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} position={it.p} rotation={[it.rot, it.rot * 0.7, 0]} scale={it.s} raycast={() => null}>
          <capsuleGeometry args={[0.03, 0.07, 4, 10]} />
          <meshStandardMaterial color={i % 2 ? '#d98a74' : '#c99ac9'} roughness={0.6} transparent opacity={0.75} />
        </mesh>
      ))}
    </>
  );
}

type CellLike = { x: number; y: number; r: number };
/** Index pairs of cells whose spheres intersect (a cell that is still dividing). */
export const fusedPairs = (cells: CellLike[]) =>
  cells.flatMap((a, i) =>
    cells
      .slice(i + 1)
      .map((_, k) => [i, i + 1 + k] as [number, number])
      .filter(([, j]) => Math.hypot(cells[j].x - a.x, cells[j].y - a.y) < a.r + cells[j].r - 1e-3),
  );

/** One membrane around two overlapping cells: the union of both spheres, creased by a cleavage furrow. */
function Furrow({ a, b }: { a: CellLike; b: CellLike }) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const geo = useMemo(() => {
    const n = 96;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= n; i++) {
      const s = -a.r + ((d + b.r + a.r) * i) / n;
      const r = Math.max(Math.sqrt(Math.max(0, a.r * a.r - s * s)), Math.sqrt(Math.max(0, b.r * b.r - (s - d) ** 2)));
      pts.push(new THREE.Vector2(i === 0 || i === n ? 0 : Math.max(r, 0.002), s));
    }
    return new THREE.LatheGeometry(pts, 64);
  }, [a.r, b.r, d]);
  useEffect(() => () => geo.dispose(), [geo]);
  // the lathe axis (+y) is turned to point from a to b
  const ang = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
  return (
    <mesh geometry={geo} position={[a.x, a.y, 0]} rotation={[0, 0, ang]} raycast={() => null}>
      <Membrane color="#a58ccf" rim="#f3e6ff" opacity={0.08} strength={1.1} />
    </mesh>
  );
}

function DivisionFrame({ f, pal, reduced, prefix = '' }: { f: Frame; pal: Pal; reduced: boolean; prefix?: string }) {
  const { selected } = useSelection();
  const beads = useMemo(() => centromeres(f), [f]);
  const metaphase = f.id.startsWith('metafaza');
  const spindleOn = selected === 'urchuq';
  const spindleCol = spindleOn ? '#f4d58e' : '#d8c79c';
  const pairs = useMemo(() => fusedPairs(f.cells), [f]);
  const fused = new Set(pairs.flat());
  return (
    <group>
      {pairs.map(([i, j]) => (
        <Furrow key={`${prefix}${f.id}-f${i}${j}`} a={f.cells[i]} b={f.cells[j]} />
      ))}
      {f.cells.map((cell, i) => (
        <group key={`${prefix}${f.id}-${i}`} position={[cell.x, cell.y, 0]}>
          {!fused.has(i) && (
            <mesh raycast={() => null}>
              <sphereGeometry args={[cell.r, 64, 48]} />
              <Membrane color="#a58ccf" rim="#f3e6ff" opacity={0.08} strength={1.1} />
            </mesh>
          )}
          <Inclusions r={cell.r} seed={i * 13 + f.id.length} />
          {cell.nucleus > 0 && (
            <Part part="yadro" opacity={0.12 + 0.18 * cell.nucleus} roughness={0.3} anchor={i === 0 ? [-cell.r * 0.35, cell.r * 0.4, 0] : undefined} calloutDir={[-60, -40]}>
              <icosahedronGeometry args={[cell.r * 0.5, 4]} />
            </Part>
          )}
          {cell.poles?.map(([px, py], k) => (
            <Centrosome key={k} at={[px - cell.x, py - cell.y, 0]} anchor={i === 0 && k === 1} />
          ))}
          {metaphase && cell.poles && (
            <Part part="ekvator" pickable={false} opacity={0.14} rotation={Math.abs(cell.poles[0][0] - cell.poles[1][0]) > 0.1 ? [0, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]} anchor={i === 0 ? [0, -cell.r * 0.7, 0] : undefined} calloutDir={[60, 40]}>
              <circleGeometry args={[cell.r * 0.86, 48]} />
            </Part>
          )}
        </group>
      ))}
      {/* spindle: kinetochore fibres to chromatids + short astral rays from each pole */}
      {f.cells.map((cell, i) =>
        cell.poles?.map(([px, py], k) => {
          const [ox, oy] = cell.poles![1 - k];
          const away = new THREE.Vector2(px - ox, py - oy).normalize();
          const rays = Array.from({ length: 5 }, (_, j) => {
            const a = Math.atan2(away.y, away.x) + (j - 2) * 0.4;
            return [[px, py, 0], [px + Math.cos(a) * 0.15, py + Math.sin(a) * 0.15, (rand(j, k + i) - 0.5) * 0.2]] as [number, number, number][];
          });
          const fibres = f.chromatids
            .filter((c) => Math.hypot(c.x - cell.x, c.y - cell.y) < cell.r && c.scale > 0.6 && Math.hypot(c.x - px, c.y - py) <= Math.hypot(c.x - ox, c.y - oy) + 0.02)
            .map((c) => [[px, py, 0], [(px + c.x) / 2, (py + c.y) / 2, (c.z ?? 0) / 2], [c.x, c.y, c.z ?? 0]] as [number, number, number][]);
          return [...fibres, ...rays].map((pts, j) => (
            <Line key={`${prefix}${f.id}-${i}-${k}-${j}`} points={pts} color={spindleCol} lineWidth={spindleOn ? 1.6 : 0.9} transparent opacity={selected && !spindleOn ? 0.15 : 0.5} />
          ));
        }),
      )}
      {f.chromatids.map((c, i) => (
        <ChromatidMesh key={prefix + c.id} c={c} pal={pal} reduced={reduced} anchor={i === 0} />
      ))}
      {beads.map((b, i) => (
        <Tween key={prefix + 'cm' + b.id} x={b.x} y={b.y} z={b.z} reduced={reduced}>
          <Part part="sentromera" roughness={0.35} anchor={i === 0 ? [0, -0.06, 0] : undefined} calloutDir={[50, 50]}>
            <icosahedronGeometry args={[0.036, 2]} />
          </Part>
        </Tween>
      ))}
    </group>
  );
}

const fitScale = (f: Frame, wide: number, single: number) => (f.cells.some((c) => Math.abs(c.x) > 0.8) ? wide : single);

export default function Division({ scene, stage, reduced }: SceneProps) {
  if (scene.mode === 'binary') return <Binary stage={stage} reduced={reduced} />;
  if (scene.mode === 'compare') {
    const s = compareSteps[Math.min(stage, compareSteps.length - 1)];
    const mi = mitosisFrames[s.mi];
    const me = meiosisFrames[s.me];
    return (
      <group>
        <group position={[-1.08, 0, 0]} scale={fitScale(mi, 0.48, 0.66)}>
          <DivisionFrame f={mi} pal={PALETTES.mitosis} reduced={reduced} prefix="mi-" />
        </group>
        <group position={[1.08, 0, 0]} scale={fitScale(me, 0.48, 0.66)}>
          <DivisionFrame f={me} pal={PALETTES.meiosis} reduced={reduced} prefix="me-" />
        </group>
      </group>
    );
  }
  const mode = scene.mode === 'meiosis' ? 'meiosis' : 'mitosis';
  const frames = framesFor(mode);
  const f = frames[Math.min(stage, frames.length - 1)];
  return (
    <group scale={fitScale(f, 0.88, 1.22)}>
      <DivisionFrame f={f} pal={PALETTES[mode]} reduced={reduced} />
    </group>
  );
}
