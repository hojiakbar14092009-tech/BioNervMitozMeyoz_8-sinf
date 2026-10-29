import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { compareSteps, framesFor, meiosisFrames, mitosisFrames, type Chromatid, type Frame } from '../../division/stages';
import { Callout, Membrane, Part, rand, useSelection } from './common';

// Reference 3 (mitosis): violet/indigo chromatin. Reference 5 (meiosis): blue paternal, red maternal homologs.
const PALETTES = {
  mitosis: { p: '#6a63d6', m: '#9a63cf' },
  meiosis: { p: '#4d6fd0', m: '#cf5a5f' },
};
type Pal = (typeof PALETTES)['mitosis'];

const BEAD = 0.026;
const geoCache = new THREE.IcosahedronGeometry(1, 1);

/** Bead positions along a chromatid (local x), with a centromere waist and rounded tips. */
function chromatidBeads(len: number, seed: number) {
  const n = Math.max(6, Math.round(len / BEAD));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const waist = 1 - 0.32 * Math.exp(-(((t - 0.5) / 0.07) ** 2));
    const tip = Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) ** 0.25;
    const r = 0.05 * waist * (0.55 + 0.45 * tip);
    // slight coil so it reads as condensed chromatin, not a smooth rod
    return { x: (t - 0.5) * len, y: Math.sin(i * 1.9 + seed) * r * 0.25, z: Math.cos(i * 2.3 + seed) * r * 0.25, r: r * (0.9 + rand(i, seed) * 0.25), t };
  });
}

/** One chromatid as a single instanced draw; crossing-over segments blend colour in over time. */
function ChromatidBeads({ c, pal, reduced, anchor }: { c: Chromatid; pal: Pal; reduced: boolean; anchor?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const { selected, select, labels, anchors, showLabels } = useSelection();
  const beads = useMemo(() => chromatidBeads(c.len, c.id.charCodeAt(0) + c.id.charCodeAt(2)), [c.len, c.id]);
  const mix = useRef(c.tip ? 0 : 1);
  const on = selected === 'xromosoma';
  const dim = selected !== null && !on;
  const own = useMemo(() => new THREE.Color(pal[c.color]), [pal, c.color]);
  const other = useMemo(() => new THREE.Color(pal[c.tip ?? c.color]), [pal, c.tip, c.color]);

  // the far arm segment (t > 0.62) takes the homologue's colour as crossing-over progresses (w: 0…1)
  const paint = (m: THREE.InstancedMesh, w: number) => {
    const col = new THREE.Color();
    beads.forEach((b, i) => {
      const k = c.tip && b.t > 0.62 ? THREE.MathUtils.smoothstep(w, (b.t - 0.62) * 0.8, (b.t - 0.62) * 0.8 + 0.5) : 0;
      m.setColorAt(i, col.copy(own).lerp(other, k));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    beads.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.scale.setScalar(b.r);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    mix.current = reduced || !c.tip ? 1 : 0; // the exchange replays when crossing-over first appears
    paint(m, mix.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beads, own, other, c.tip, reduced]);

  useFrame((_, dt) => {
    const g = group.current;
    const m = mesh.current;
    if (!g || !m) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    g.position.x += (c.x - g.position.x) * k;
    g.position.y += (c.y - g.position.y) * k;
    g.position.z += ((c.z ?? 0) - g.position.z) * k;
    g.rotation.z += (c.rot - g.rotation.z) * k;
    g.scale.setScalar(g.scale.x + (c.scale - g.scale.x) * k);
    if (c.tip && mix.current < 1) {
      mix.current = Math.min(1, mix.current + dt * 0.6);
      paint(m, mix.current);
    }
  });

  return (
    <group ref={group} position={[c.x, c.y, c.z ?? 0]} rotation={[0, 0, c.rot]} scale={c.scale}>
      <instancedMesh
        ref={mesh}
        args={[geoCache, undefined, beads.length]}
        onClick={(e) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          select(on ? null : 'xromosoma');
        }}
      >
        <meshStandardMaterial key={dim ? 't' : 'o'} roughness={0.5} envMapIntensity={0.9} emissive={on ? '#b9a6ff' : '#000'} emissiveIntensity={on ? 0.22 : 0} transparent={dim} opacity={dim ? 0.4 : 1} />
      </instancedMesh>
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

function DivisionFrame({ f, pal, reduced, prefix = '' }: { f: Frame; pal: Pal; reduced: boolean; prefix?: string }) {
  const { selected, colors } = useSelection();
  const beads = useMemo(() => centromeres(f), [f]);
  const metaphase = f.id.startsWith('metafaza');
  const spindleOn = selected === 'urchuq';
  const spindleCol = spindleOn ? '#ffd98a' : (colors.urchuq ?? '#e3b35c');
  return (
    <group>
      {f.cells.map((cell, i) => (
        <group key={`${prefix}${f.id}-${i}`} position={[cell.x, cell.y, 0]}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[cell.r, 64, 48]} />
            <Membrane color="#a58ccf" rim="#f3e6ff" opacity={0.08} strength={1.1} />
          </mesh>
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
          const rays = Array.from({ length: 7 }, (_, j) => {
            const a = Math.atan2(away.y, away.x) + (j - 3) * 0.33;
            return [[px, py, 0], [px + Math.cos(a) * 0.2, py + Math.sin(a) * 0.2, (rand(j, k + i) - 0.5) * 0.2]] as [number, number, number][];
          });
          const fibres = f.chromatids
            .filter((c) => Math.hypot(c.x - cell.x, c.y - cell.y) < cell.r && c.scale > 0.6 && Math.hypot(c.x - px, c.y - py) <= Math.hypot(c.x - ox, c.y - oy) + 0.02)
            .map((c) => [[px, py, 0], [(px + c.x) / 2, (py + c.y) / 2, (c.z ?? 0) / 2], [c.x, c.y, c.z ?? 0]] as [number, number, number][]);
          return [...fibres, ...rays].map((pts, j) => (
            <Line key={`${prefix}${f.id}-${i}-${k}-${j}`} points={pts} color={spindleCol} lineWidth={spindleOn ? 1.8 : 1.1} transparent opacity={selected && !spindleOn ? 0.18 : 0.62} />
          ));
        }),
      )}
      {f.chromatids.map((c, i) => (
        <ChromatidBeads key={prefix + c.id} c={c} pal={pal} reduced={reduced} anchor={i === 0} />
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
