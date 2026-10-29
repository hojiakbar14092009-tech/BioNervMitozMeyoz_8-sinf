import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { ThreeElements, ThreeEvent } from '@react-three/fiber';
import { Html, Outlines } from '@react-three/drei';
import * as THREE from 'three';

export const PALETTE = {
  skin: '#e9cdb9',
  tissue: '#cf9488',
  glow: '#ffe2a6',
  membrane: '#a9cdd0',
};

export interface Selection {
  selected: string | null;
  select: (id: string | null) => void;
  /** Legend colour per structure id — the same source the legend uses. */
  colors: Record<string, string>;
  labels: Record<string, string>;
  /** Anchored in-scene labels only on wide screens; phones use the info card. */
  anchors: boolean;
}

export const SelectionContext = createContext<Selection>({ selected: null, select: () => {}, colors: {}, labels: {}, anchors: false });
export const useSelection = () => useContext(SelectionContext);

type MeshProps = Omit<ThreeElements['mesh'], 'children'>;

export interface PartProps extends MeshProps {
  /** Structure id from the scene's hotspots; omit for passive (unlabelled) geometry. */
  part?: string;
  /** Overrides the legend colour (e.g. nucleotide bases, maternal/paternal chromatids). */
  color?: string;
  opacity?: number;
  roughness?: number;
  sheen?: number;
  /** Whether taps hit this mesh; enclosing shells set false so inner parts stay tappable. */
  pickable?: boolean;
  /** Local position for the desktop label when this part is selected. */
  anchor?: [number, number, number];
  children?: ReactNode;
}

const noRaycast = () => null;

/** A biological structure: soft PBR material (standard shader — fast to compile on phones), tap-to-select, restrained emphasis. */
export function Part({ part, color, opacity = 1, roughness = 0.62, sheen = 0.45, pickable = true, anchor, children, ...mesh }: PartProps) {
  const { selected, select, colors, labels, anchors } = useSelection();
  const c = color ?? (part ? colors[part] : undefined) ?? PALETTE.tissue;
  const on = !!part && selected === part;
  const dim = selected !== null && !on;
  const alpha = dim ? Math.min(opacity, 0.28) : opacity;
  const transparent = alpha < 1;
  const onClick = part
    ? (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 8) return; // a drag that rotated the model is not a tap
        e.stopPropagation();
        select(on ? null : part);
      }
    : undefined;
  return (
    <mesh
      {...mesh}
      raycast={pickable && part ? undefined : noRaycast}
      onClick={onClick}
      onPointerOver={part ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={part ? () => (document.body.style.cursor = '') : undefined}
    >
      {children}
      <meshStandardMaterial
        key={transparent ? 't' : 'o'}
        color={c}
        roughness={roughness + sheen * 0.08}
        metalness={0}
        envMapIntensity={0.85}
        emissive={on ? c : '#000000'}
        emissiveIntensity={on ? 0.28 : 0}
        transparent={transparent}
        opacity={alpha}
        depthWrite={!transparent}
      />
      {on && opacity === 1 && <Outlines thickness={0.012} color="#f2d28c" />}
      {on && anchor && anchors && (
        <Html position={anchor} center zIndexRange={[20, 0]} className="anchor-label" pointerEvents="none">
          {labels[part!]}
        </Html>
      )}
    </mesh>
  );
}

export const curve = (points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));

/** Tube whose radius tapers from r0 to r1 along the path — dendrites and axons narrow naturally. */
export function useTaperedTube(points: [number, number, number][], r0: number, r1: number, segments = 40) {
  const geo = useMemo(() => {
    const path = curve(points);
    const radial = 10;
    const g = new THREE.TubeGeometry(path, segments, 1, radial, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= segments; i++) {
      path.getPointAt(i / segments, p);
      const r = r0 + (r1 - r0) * Math.pow(i / segments, 0.8);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(p).multiplyScalar(r).add(p);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }, [points, r0, r1, segments]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

export function TaperTube({ points, r0, r1, ...part }: { points: [number, number, number][]; r0: number; r1: number } & PartProps) {
  const geo = useTaperedTube(points, r0, r1);
  return <Part {...part} geometry={geo} />;
}

/** Gentle low-frequency surface variation so cells and organs don't read as perfect primitives. */
export function useOrganic(make: () => THREE.BufferGeometry, amp: number, freq: number, seed = 1) {
  const geo = useMemo(() => {
    const g = make();
    g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      const d = Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 1.3 + seed * 2) * 0.6 + Math.sin(v.z * freq * 1.7 + v.x * 0.7 + seed * 3) * 0.4;
      v.addScaledVector(n, d * amp);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
    // `make` is a per-call-site factory; geometry depends only on the shaping params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amp, freq, seed]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}
