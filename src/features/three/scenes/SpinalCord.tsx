import { CordSection, FiberBundle, Ganglion } from './CordSection';

type P = [number, number, number];
const SEGMENTS = [0.28, -0.32]; // two root levels along the segment so it reads as part of a cord from every side

/** Reference 2: transverse section with fanned root bundles, ganglia and mixed spinal nerves on both sides. */
export default function SpinalCord() {
  return (
    <group rotation={[-0.08, 0, 0]}>
      <CordSection depth={1.15} ids={{ white: 'white', grey: 'grey', canal: 'canal' }} anchors />
      {SEGMENTS.flatMap((z, k) =>
        [1, -1].map((s) => {
          const at = (x: number, y: number): P => [s * x, y, z];
          const first = k === 0 && s === 1;
          return (
            <group key={`${z}${s}`}>
              <FiberBundle part="dorsal" from={at(0.42, 0.5)} bend={at(0.78, 0.66)} to={at(1.05, 0.55)} seed={11 + k * 7 + s} anchor={first ? at(0.78, 0.7) : undefined} calloutDir={[-12, -74]} />
              <Ganglion part="ganglion" at={at(1.16, 0.53)} anchor={first ? [0.05, 0.16, 0] : undefined} calloutDir={[58, -8]} />
              <FiberBundle part="dorsal" from={at(1.27, 0.5)} bend={at(1.42, 0.3)} to={at(1.55, 0.05)} seed={21 + k * 7 + s} />
              <FiberBundle part="ventral" from={at(0.46, -0.48)} bend={at(0.95, -0.42)} to={at(1.55, 0.02)} seed={31 + k * 7 + s} anchor={first ? at(0.95, -0.46) : undefined} />
              {/* mixed spinal nerve beyond the junction */}
              <FiberBundle from={at(1.55, 0.03)} bend={at(1.95, -0.08)} to={at(2.35, -0.3)} count={9} spread={0.06} r={0.018} seed={41 + k * 7 + s} color="#dcae4c" />
            </group>
          );
        }),
      )}
    </group>
  );
}
