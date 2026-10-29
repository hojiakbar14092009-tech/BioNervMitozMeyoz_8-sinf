import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
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
  /** Anchored in-scene label for the selected part (wide screens). */
  anchors: boolean;
  /** "Belgilar" mode: every structure shows its callout. */
  showLabels: boolean;
  /** Active cut-away plane (world space) for parts marked `clip`. */
  clipPlane: THREE.Plane | null;
}

export const SelectionContext = createContext<Selection>({ selected: null, select: () => {}, colors: {}, labels: {}, anchors: false, showLabels: false, clipPlane: null });
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
  /** Local position of this structure's callout point. One Part per structure should carry it. */
  anchor?: [number, number, number];
  /** Screen-space offset of the callout box from its point (px). */
  calloutDir?: [number, number];
  /** Cut by the section plane when the cut-away view is on. */
  clip?: boolean;
  /** Hidden inside the model: its callout appears only when cut open or selected. */
  internal?: boolean;
  emissiveBoost?: number;
  children?: ReactNode;
}

const noRaycast = () => null;

/** Callout: point marker + leader line + named box, as in the reference sheets. */
export function Callout({ part, dir, on, label, color, select }: { part: string; dir: [number, number]; on: boolean; label: string; color: string; select: (id: string | null) => void }) {
  const [dx, dy] = dir;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const box = useRef<HTMLButtonElement>(null);
  // keep the box inside the viewer as the model rotates; the leader line still marks the structure
  useEffect(() => {
    let raf = 0;
    let nx = 0;
    let ny = 0;
    const tick = () => {
      const el = box.current;
      const stage = el?.closest('.viewer-stage')?.getBoundingClientRect();
      if (el && stage) {
        const r = el.getBoundingClientRect();
        const pad = 6;
        const left = r.left - nx;
        const top = r.top - ny;
        // the right edge keeps clear of the zoom pad
        const tx = Math.max(0, stage.left + pad - left) - Math.max(0, left + r.width - (stage.right - 58));
        const ty = Math.max(0, stage.top + pad - top) - Math.max(0, top + r.height - (stage.bottom - pad));
        if (tx !== nx || ty !== ny) {
          nx = tx;
          ny = ty;
          el.style.setProperty('--nx', `${nx}px`);
          el.style.setProperty('--ny', `${ny}px`);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={`callout ${on ? 'on' : ''}`} style={{ '--c': color } as React.CSSProperties}>
      <span className="callout-dot" />
      <span className="callout-line" style={{ width: len, transform: `rotate(${ang}deg)` }} />
      <button
        ref={box}
        type="button"
        className="callout-box"
        style={{ transform: `translate(${dx}px, ${dy}px) translate(${dx < 0 ? '-100%' : '0'}, -50%) translate(var(--nx, 0px), var(--ny, 0px))` }}
        onClick={() => select(on ? null : part)}
      >
        {label}
      </button>
    </div>
  );
}

/** A biological structure: soft PBR material (standard shader — fast to compile on phones), tap-to-select, restrained emphasis. */
export function Part({ part, color, opacity = 1, roughness = 0.62, sheen = 0.45, pickable = true, anchor, calloutDir, clip, internal, emissiveBoost = 0, children, ...mesh }: PartProps) {
  const { selected, select, colors, labels, anchors, showLabels, clipPlane } = useSelection();
  const c = color ?? (part ? colors[part] : undefined) ?? PALETTE.tissue;
  const on = !!part && selected === part;
  const dim = selected !== null && !on;
  const alpha = dim ? Math.min(opacity, 0.4) : opacity;
  const transparent = alpha < 1;
  const planes = clip && clipPlane ? [clipPlane] : undefined;
  const onClick = part
    ? (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 8) return; // a drag that rotated the model is not a tap
        e.stopPropagation();
        select(on ? null : part);
      }
    : undefined;
  const dir = calloutDir ?? [anchor && anchor[0] < 0 ? -64 : 64, -34];
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
        key={`${transparent ? 't' : 'o'}${planes ? 'c' : ''}`}
        color={c}
        roughness={roughness + sheen * 0.08}
        metalness={0}
        envMapIntensity={0.85}
        emissive={on ? c : emissiveBoost ? c : '#000000'}
        emissiveIntensity={on ? 0.28 : emissiveBoost}
        transparent={transparent}
        opacity={alpha}
        depthWrite={!transparent}
        clippingPlanes={planes}
        side={planes ? THREE.DoubleSide : THREE.FrontSide}
      />
      {on && opacity === 1 && !planes && <Outlines thickness={0.012} color="#f2d28c" />}
      {part && anchor && ((showLabels && (!internal || clipPlane)) || (on && anchors)) && (
        <Html position={anchor} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Callout part={part} dir={dir} on={on} label={labels[part]} color={c} select={select} />
        </Html>
      )}
    </mesh>
  );
}

export const curve = (points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));

/** Tube whose radius tapers from r0 to r1 along the path — dendrites and axons narrow naturally. */
export function taperedTube(points: [number, number, number][], r0: number, r1: number, segments = 40, radial = 10) {
  const path = curve(points);
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
}

export function useTaperedTube(points: [number, number, number][], r0: number, r1: number, segments = 40) {
  const geo = useMemo(() => taperedTube(points, r0, r1, segments), [points, r0, r1, segments]);
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

/** Deterministic pseudo-random in [0,1) — models look identical on every load. */
export const rand = (i: number, s = 1) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface InstancedPartProps {
  part?: string;
  color?: string;
  /** Per-instance colours (overrides `color`). */
  colors?: string[];
  points: [number, number, number][];
  radii: number[];
  opacity?: number;
  roughness?: number;
  anchor?: [number, number, number];
  calloutDir?: [number, number];
  pickable?: boolean;
  emissiveBoost?: number;
  detail?: number;
}

/** Many small spheres as one draw call; selection behaves like Part. */
export function InstancedSpheres({ part, color, colors: perColors, points, radii, opacity = 1, roughness = 0.55, anchor, calloutDir, pickable = true, emissiveBoost = 0, detail = 1 }: InstancedPartProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { selected, select, colors, labels, anchors, showLabels } = useSelection();
  const c = color ?? (part ? colors[part] : undefined) ?? PALETTE.tissue;
  const on = !!part && selected === part;
  const dim = selected !== null && !on;
  const alpha = dim ? Math.min(opacity, 0.4) : opacity;
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, detail), [detail]);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    points.forEach((p, i) => {
      o.position.set(...p);
      o.scale.setScalar(radii[i % radii.length]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (perColors) m.setColorAt(i, col.set(perColors[i % perColors.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [points, radii, perColors]);
  const dir = calloutDir ?? [anchor && anchor[0] < 0 ? -64 : 64, -34];
  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[geo, undefined, points.length]}
        raycast={pickable && part ? undefined : noRaycast}
        onClick={
          part
            ? (e) => {
                if (e.delta > 8) return;
                e.stopPropagation();
                select(on ? null : part);
              }
            : undefined
        }
      >
        <meshStandardMaterial
          key={alpha < 1 ? 't' : 'o'}
          color={perColors ? '#ffffff' : c}
          roughness={roughness}
          envMapIntensity={0.85}
          emissive={on || emissiveBoost ? c : '#000000'}
          emissiveIntensity={on ? 0.25 : emissiveBoost}
          transparent={alpha < 1}
          opacity={alpha}
          depthWrite={alpha >= 1}
        />
      </instancedMesh>
      {part && anchor && (showLabels || (on && anchors)) && (
        <Html position={anchor} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Callout part={part} dir={dir} on={on} label={labels[part]} color={c} select={select} />
        </Html>
      )}
    </group>
  );
}

/** Beads along a path — the bumpy, volumetric look of chromatin and backbones in the references. */
export function beadPath(points: THREE.Vector3[], spacing: number, radius: (t: number) => number, jitter = 0.18, seed = 1) {
  const c = new THREE.CatmullRomCurve3(points);
  const n = Math.max(2, Math.round(c.getLength() / spacing));
  const pts: [number, number, number][] = [];
  const rad: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.getPointAt(t, p);
    const r = radius(t);
    pts.push([p.x + (rand(i, seed) - 0.5) * r * jitter, p.y + (rand(i, seed + 1) - 0.5) * r * jitter, p.z + (rand(i, seed + 2) - 0.5) * r * jitter]);
    rad.push(r * (0.85 + rand(i, seed + 3) * 0.3));
  }
  return { pts, rad };
}

/** Blob cluster filling an ellipsoid — molecular complexes (ribosome subunits, tRNA, polymerase). */
export function blobCluster(count: number, size: [number, number, number], r: number, seed = 1) {
  const pts: [number, number, number][] = [];
  const rad: number[] = [];
  for (let i = 0; i < count; i++) {
    // points biased toward the surface so the cluster reads as a lumpy solid
    const u = rand(i, seed) * 2 - 1;
    const th = rand(i, seed + 1) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const k = 0.72 + 0.28 * Math.cbrt(rand(i, seed + 2));
    pts.push([s * Math.cos(th) * size[0] * k, u * size[1] * k, s * Math.sin(th) * size[2] * k]);
    rad.push(r * (0.7 + rand(i, seed + 3) * 0.6));
  }
  return { pts, rad };
}

/** Rim-lit translucent membrane (fresnel): readable outline from every angle without hiding the interior. */
export function Membrane({ color = '#b6a6d8', rim = '#f1e7ff', strength = 1, opacity = 0.22, clip }: { color?: string; rim?: string; strength?: number; opacity?: number; clip?: boolean }) {
  const { clipPlane } = useSelection();
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uStrength: { value: strength }, uOpacity: { value: opacity } }),
    [color, rim, strength, opacity],
  );
  return (
    <shaderMaterial
      key={clip && clipPlane ? 'c' : 'n'}
      transparent
      depthWrite={false}
      side={THREE.DoubleSide}
      uniforms={uniforms}
      clipping={!!(clip && clipPlane)}
      clippingPlanes={clip && clipPlane ? [clipPlane] : undefined}
      vertexShader={`
        #include <clipping_planes_pars_vertex>
        varying vec3 vN; varying vec3 vV;
        void main(){
          #include <begin_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          #include <clipping_planes_vertex>
        }`}
      fragmentShader={`
        #include <clipping_planes_pars_fragment>
        uniform vec3 uColor; uniform vec3 uRim; uniform float uStrength; uniform float uOpacity;
        varying vec3 vN; varying vec3 vV;
        void main(){
          #include <clipping_planes_fragment>
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2) * uStrength;
          gl_FragColor = vec4(mix(uColor, uRim, f), clamp(uOpacity + f * 0.55, 0.0, 0.85));
        }`}
    />
  );
}
