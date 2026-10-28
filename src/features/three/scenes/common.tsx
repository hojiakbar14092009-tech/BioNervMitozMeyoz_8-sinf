import { useMemo } from 'react';
import * as THREE from 'three';

export const PALETTE = {
  tissue: '#d9a7a0',
  tissueDeep: '#b9776f',
  myelin: '#efe6cf',
  nerve: '#e2c27a',
  grey: '#9b8f9e',
  white: '#ece6dc',
  blue: '#5f7fc8',
  rose: '#c97f95',
  teal: '#3f9d97',
  amber: '#d8a24a',
  glow: '#ffd27a',
};

/** Material emphasis for the selected structure; others dim when something is selected. */
export function emph(selected: string | null, id: string | string[], base: string) {
  const ids = Array.isArray(id) ? id : [id];
  const on = selected !== null && ids.includes(selected);
  const dim = selected !== null && !on;
  return {
    color: base,
    emissive: on ? '#ffcf70' : '#000000',
    emissiveIntensity: on ? 0.45 : 0,
    transparent: dim,
    opacity: dim ? 0.28 : 1,
    roughness: 0.55,
    metalness: 0.02,
  };
}

export function Tube({ points, radius, material, segments = 48 }: { points: [number, number, number][]; radius: number; material: ReturnType<typeof emph>; segments?: number }) {
  const c = useMemo(() => curve(points), [points]);
  return (
    <mesh>
      <tubeGeometry args={[c, segments, radius, 10, false]} />
      <M {...material} />
    </mesh>
  );
}

export const curve = (points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));

/** Standard material that is rebuilt when transparency flips (three.js needs a recompile for that). */
export function M(props: ReturnType<typeof emph> & { depthWrite?: boolean; vertexColors?: boolean }) {
  return <meshStandardMaterial key={props.transparent ? 't' : 'o'} {...props} />;
}
