import { useMemo } from 'react';
import { Part, TaperTube } from './common';
import { butterfly, cordOutline } from './shapes';

type P = [number, number, number];
const DORSAL_R: P[] = [[0.3, 0.52, 0], [0.7, 0.66, 0.02], [1.08, 0.5, 0.02], [1.42, 0.05, 0]];
const VENTRAL_R: P[] = [[0.34, -0.5, 0], [0.78, -0.54, 0.02], [1.15, -0.3, 0.02], [1.42, 0.05, 0]];
const NERVE_R: P[] = [[1.42, 0.05, 0], [1.85, -0.08, 0], [2.2, -0.3, 0]];
const mirror = (ps: P[]): P[] => ps.map(([x, y, z]) => [-x, y, z]);
const DORSAL_L = mirror(DORSAL_R);
const VENTRAL_L = mirror(VENTRAL_R);
const NERVE_L = mirror(NERVE_R);
const DEPTH = 0.5;

export default function SpinalCord() {
  const grey = useMemo(butterfly, []);
  const outline = useMemo(() => cordOutline(0.86, 0.7), []);
  return (
    <group rotation={[-0.32, 0.42, 0]}>
      {/* white matter: oval segment; not pickable so the inner grey matter stays tappable */}
      <Part part="white" opacity={0.62} roughness={0.8} position={[0, 0, -DEPTH / 2]} pickable={false} anchor={[0.72, 0.62, DEPTH]}>
        <extrudeGeometry args={[outline, { depth: DEPTH, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 48 }]} />
      </Part>
      {/* thin pickable rim so white matter can still be tapped at the edge */}
      <Part part="white" opacity={0.01} position={[0, 0, DEPTH / 2 + 0.035]}>
        <ringGeometry args={[0.62, 0.84, 48]} />
      </Part>
      <Part part="grey" position={[0, 0, -DEPTH / 2 - 0.01]} scale={1.18} roughness={0.7} anchor={[0, 0.55, DEPTH]}>
        <extrudeGeometry args={[grey, { depth: (DEPTH + 0.06) / 1.18, bevelEnabled: false, curveSegments: 20 }]} />
      </Part>
      <Part part="canal" rotation={[Math.PI / 2, 0, 0]} position={[0, -0.024, 0.02]} anchor={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.055, 0.055, DEPTH + 0.1, 24]} />
      </Part>
      <TaperTube part="dorsal" points={DORSAL_R} r0={0.055} r1={0.045} anchor={[0.75, 0.86, 0]} />
      <TaperTube part="dorsal" points={DORSAL_L} r0={0.055} r1={0.045} />
      <TaperTube part="ventral" points={VENTRAL_R} r0={0.055} r1={0.045} anchor={[0.8, -0.78, 0]} />
      <TaperTube part="ventral" points={VENTRAL_L} r0={0.055} r1={0.045} />
      {/* roots join beside the vertebral column into the mixed spinal nerve */}
      <TaperTube points={NERVE_R} r0={0.085} r1={0.06} color="#d8be86" />
      <TaperTube points={NERVE_L} r0={0.085} r1={0.06} color="#d8be86" />
      {[1, -1].map((s) => (
        <Part key={s} part="ganglion" position={[s * 1.05, 0.54, 0.02]} scale={[1.35, 0.9, 0.9]} anchor={s === 1 ? [0.1, 0.25, 0] : undefined}>
          <icosahedronGeometry args={[0.12, 3]} />
        </Part>
      ))}
    </group>
  );
}
