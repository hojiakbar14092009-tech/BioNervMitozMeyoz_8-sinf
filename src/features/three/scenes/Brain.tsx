import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { Callout, Part, TaperTube, useSelection, type PartProps } from './common';

type Lobe = 'frontal' | 'parietal' | 'temporal' | 'occipital';
const LOBES: Lobe[] = ['frontal', 'parietal', 'temporal', 'occipital'];
// Reference sheet palette: coral frontal, blue parietal, green occipital, golden temporal — softened for long study.
const BASE: Record<Lobe, THREE.Color> = {
  frontal: new THREE.Color('#df7f74'),
  parietal: new THREE.Color('#6683d2'),
  temporal: new THREE.Color('#d8a95e'),
  occipital: new THREE.Color('#62a873'),
};
const NEUTRAL = new THREE.Color('#d9a49b'); // lessons that don't teach lobes keep a natural tissue tone
const HIGHLIGHT = new THREE.Color('#f4cf7e');
const DIM = new THREE.Color('#7d7787');
const SULCUS = new THREE.Color('#5e3c3c');
const INNER = ['medulla', 'pons', 'midbrain', 'diencephalon', 'corpus'];

// Front of the brain points to −x, top to +y; the left hemisphere faces +z.
// Boundaries follow the same curves as the grooves: slanted central sulcus, lateral sulcus, parieto-occipital.
function lobeOf(nx: number, ny: number): Lobe {
  if (nx < -0.2 + ny * 0.25 && ny > -0.12 + nx * 0.06) return 'frontal';
  if (nx > 0.62 - ny * 0.08) return 'occipital';
  if (ny < -0.12 + nx * 0.06) return nx < -0.35 ? 'frontal' : 'temporal';
  return 'parietal';
}

/** Depth of the major grooves that separate lobes (lateral, central, parieto-occipital). */
function sulcusDepth(nx: number, ny: number) {
  const lateral = nx > -0.35 && nx < 0.65 ? Math.exp(-(((ny + 0.12 - nx * 0.06) / 0.04) ** 2)) : 0;
  const central = ny > -0.12 ? Math.exp(-(((nx + 0.2 - ny * 0.25) / 0.035) ** 2)) : 0;
  const po = ny > -0.3 ? Math.exp(-(((nx - 0.62) / 0.03) ** 2)) : 0;
  return Math.max(lateral, central * 0.85, po * 0.75);
}

/** Domain-warped ridged folds: meandering gyri separated by narrow sulci, consistent all round the volume. */
function gyri(x: number, y: number, z: number) {
  const wx = x + 0.35 * Math.sin(y * 5.1 + z * 3.7);
  const wy = y + 0.35 * Math.sin(z * 4.3 + x * 4.9);
  const wz = z + 0.35 * Math.sin(x * 5.7 + y * 3.3);
  const a = Math.sin(wx * 10 + Math.sin(wy * 6) * 1.6) * Math.sin(wy * 11 + Math.cos(wz * 5) * 1.4) * Math.sin(wz * 9 + wx * 2);
  const ridge = 1 - Math.abs(a);
  return ridge * ridge;
}

function useHemisphere(side: 1 | -1) {
  return useMemo(() => {
    const g = new THREE.SphereGeometry(1, 200, 140);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const lobes: Lobe[] = [];
    const groove: number[] = [];
    const tint: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      lobes.push(lobeOf(v.x, v.y));
      const s = sulcusDepth(v.x, v.y);
      const f = gyri(v.x, v.y, v.z);
      groove.push(Math.max(s, (1 - f) * 0.35));
      tint.push(0.95 + 0.05 * Math.sin(v.x * 3.1 + v.z * 2.3) + 0.03 * Math.sin(v.y * 7.7 - v.x * 4.1));
      const flat = side * v.z < 0 ? 0.5 : 1; // medial surface flattened
      v.multiplyScalar(1 + f * 0.07 - 0.035 - s * 0.085);
      pos.setXYZ(i, v.x * 1.25, v.y * 0.92 * (v.y < 0 ? 0.78 : 1), v.z * 0.62 * flat);
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    return { geometry: g, lobes, groove, tint };
  }, [side]);
}

function Hemisphere({ side, hotspots, lobeColors }: { side: 1 | -1; hotspots: string[]; lobeColors: boolean }) {
  const { selected, select, clipPlane } = useSelection();
  const { geometry, lobes, groove, tint } = useHemisphere(side);
  const inner = selected !== null && INNER.includes(selected) && !clipPlane;
  const cut = side === 1 && clipPlane;
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const col = geometry.attributes.color as THREE.BufferAttribute;
    const lobeFocus = selected !== null && (LOBES.includes(selected as Lobe) || selected.endsWith('-left') || selected === 'hemispheres');
    const c = new THREE.Color();
    lobes.forEach((lobe, i) => {
      const base = lobeColors ? BASE[lobe] : NEUTRAL;
      const hit = selected === lobe || selected === 'hemispheres' || (side === 1 && selected === `${lobe}-left`);
      c.copy(hit ? HIGHLIGHT : lobeFocus || (selected && !inner) ? base.clone().lerp(DIM, 0.55) : base);
      c.lerp(SULCUS, groove[i] * 0.6).multiplyScalar(tint[i]);
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [selected, geometry, lobes, groove, tint, side, inner, lobeColors]);

  if (cut) return null;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8 || !e.face) return;
    e.stopPropagation();
    const lobe = lobes[e.face.a];
    const id = side === 1 && hotspots.includes(`${lobe}-left`) ? `${lobe}-left` : hotspots.includes(lobe) ? lobe : hotspots.includes('hemispheres') ? 'hemispheres' : null;
    if (id) select(selected === id ? null : id);
  };

  return (
    <mesh geometry={geometry} position={[0, 0.25, side * 0.36]} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <meshStandardMaterial
        key={inner ? 't' : 'o'}
        vertexColors
        roughness={0.66}
        envMapIntensity={0.9}
        transparent={inner}
        opacity={inner ? 0.16 : 1}
        depthWrite={!inner}
      />
      {selected === 'hemispheres' && <Outlines thickness={0.012} color="#f2d28c" />}
    </mesh>
  );
}

/** Cerebellum: fine parallel folia, as in the reference sheet. */
function useCerebellum() {
  const g = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.42, 96, 72);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // folia run as arcs around the cerebellar peduncles (front, toward the pons), not flat bands
      const arc = Math.hypot(v.x + 0.3, v.y + 0.04, v.z * 0.35);
      const folia = Math.sin(arc * 110 + Math.sin(v.z * 9) * 1.5);
      v.multiplyScalar(1 + folia * 0.016 - Math.abs(folia) * 0.01);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

type P = [number, number, number];
// Callout points on the left (near) hemisphere surface for vertex-coloured regions.
const LOBE_ANCHORS: Record<string, { at: P; dir: [number, number] }> = {
  frontal: { at: [-1.0, 0.6, 0.86], dir: [20, -62] },
  parietal: { at: [0.2, 1.05, 0.72], dir: [70, 18] },
  temporal: { at: [0.05, -0.3, 0.98], dir: [-80, 30] },
  occipital: { at: [1.2, 0.35, 0.74], dir: [-30, -70] },
  hemispheres: { at: [-0.3, 1.0, 0.7], dir: [-70, -40] },
  'frontal-left': { at: [-1.0, 0.6, 0.86], dir: [20, -62] },
  'occipital-left': { at: [1.2, 0.35, 0.74], dir: [-30, -70] },
};

function RegionCallouts({ ids }: { ids: string[] }) {
  const { selected, select, showLabels, anchors, labels, colors, clipPlane } = useSelection();
  return (
    <>
      {ids
        // anchors sit on the near hemisphere, which the section removes
        .filter((id) => LOBE_ANCHORS[id] && !clipPlane && (showLabels || (anchors && selected === id)))
        .map((id) => (
          <Html key={id} position={LOBE_ANCHORS[id].at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <Callout part={id} dir={LOBE_ANCHORS[id].dir} on={selected === id} label={labels[id]} color={colors[id]} select={select} />
          </Html>
        ))}
    </>
  );
}

const CORD: P[] = [[0.5, -1.15, 0], [0.56, -1.6, 0], [0.6, -2.15, 0]];
const ROOTS: P[][] = [-1, 1].flatMap((s) => [
  [[0.56, -1.7, 0], [0.62, -1.85, s * 0.18], [0.7, -2.05, s * 0.32]] as P[],
  [[0.59, -1.95, 0], [0.66, -2.1, s * 0.2], [0.74, -2.3, s * 0.34]] as P[],
]);

// Arch from the genu (front, curling down) over the body to the thicker splenium (back).
const CALLOSUM: P[] = [[-0.36, -0.06, 0], [-0.52, 0.12, 0], [-0.38, 0.33, 0], [0, 0.42, 0], [0.38, 0.36, 0], [0.55, 0.18, 0]];

/** Inner structure; in the section it is drawn as a solid half with a flat cut face instead of a hollow clipped shell. */
function Solid({ cut, anchor, calloutDir, ...props }: PartProps & { cut: boolean }) {
  if (!cut)
    return (
      <Part internal {...props} anchor={anchor} calloutDir={calloutDir}>
        <sphereGeometry args={[1, 32, 24]} />
      </Part>
    );
  return (
    <group position={props.position} rotation={props.rotation} scale={props.scale}>
      <Part internal {...props} position={undefined} rotation={undefined} scale={undefined} anchor={anchor} calloutDir={calloutDir}>
        <sphereGeometry args={[1, 32, 16, Math.PI, Math.PI]} />
      </Part>
      <Part internal {...props} position={undefined} rotation={undefined} scale={undefined} roughness={0.8}>
        <circleGeometry args={[1, 32]} />
      </Part>
    </group>
  );
}

export default function Brain({ scene }: SceneProps) {
  const ids = scene.hotspots.map((h) => h.id);
  const has = (id: string) => (ids.includes(id) ? id : undefined);
  const lobeColors = ids.some((id) => LOBES.includes(id as Lobe) || id.endsWith('-left'));
  const cerebellum = useCerebellum();
  const { clipPlane } = useSelection();

  return (
    <group rotation={[0.04, 0, 0]} position={[0, 0.35, 0]}>
      <Hemisphere side={1} hotspots={ids} lobeColors={lobeColors} />
      <Hemisphere side={-1} hotspots={ids} lobeColors={lobeColors} />
      <RegionCallouts ids={ids} />
      {/* corpus callosum: the C-shaped arch seen in a midline (sagittal) section */}
      <TaperTube internal part={has('corpus')} color="#efe3cf" points={CALLOSUM} r0={0.055} r1={0.075} anchor={[0, 0.48, 0]} calloutDir={[-70, -40]} />
      <Solid cut={!!clipPlane} part={has('diencephalon')} color="#c99089" position={[0.12, -0.12, 0]} scale={[0.29, 0.19, 0.22]} anchor={[0, 1.3, 1.3]} calloutDir={[-80, -30]} />
      <Solid cut={!!clipPlane} part={has('midbrain')} color="#d2b59a" position={[0.3, -0.42, 0]} rotation={[0, 0, -0.25]} scale={[0.16, 0.2, 0.15]} anchor={[1.4, 0.2, 1]} />
      <Solid cut={!!clipPlane} part={has('pons')} color="#d9b28a" position={[0.42, -0.72, 0.01]} scale={[0.24, 0.21, 0.22]} anchor={[1.3, 0, 1]} calloutDir={[70, 10]} />
      <Part part={has('medulla')} color="#e3cba7" position={[0.52, -1.08, 0]} rotation={[0, 0, -0.14]} anchor={[0.12, -0.05, 0.1]} calloutDir={[70, 30]}>
        <cylinderGeometry args={[0.15, 0.11, 0.5, 28]} />
      </Part>
      {/* spinal continuation with root fibres (passive, as in the reference) */}
      <TaperTube points={CORD} r0={0.11} r1={0.085} color="#eadbbd" />
      {ROOTS.map((r, i) => (
        <TaperTube key={i} points={r} r0={0.022} r1={0.012} color="#d8b04f" />
      ))}
      {(clipPlane ? [-1] : [1, -1]).map((s) => (
        <Part key={s} geometry={cerebellum} part={has('cerebellum')} color="#c98a92" position={[0.98, -0.62, s * 0.24]} scale={[0.86, 0.6, 0.72]} roughness={0.7} anchor={s === -1 ? [0.35, -0.2, -0.3] : undefined} calloutDir={[70, 20]} />
      ))}
    </group>
  );
}
