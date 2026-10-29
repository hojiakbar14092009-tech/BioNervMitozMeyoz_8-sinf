import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { TRANSLATION_CODONS } from '../sequences';
import { InstancedSpheres, Part, blobCluster } from './common';

const NT_COLOR: Record<string, string> = { A: '#d9554f', U: '#e2b74a', G: '#4fa56e', C: '#5779d6' };
const W = 0.42; // codon width (3 bases)
const TRNA_COLORS = ['#e2b74a', '#9b74d6', '#5fae78'];
const AMINO = ['#e0a85a', '#d9776e', '#9b74d6', '#5fae78', '#5b9fd0', '#d38fb8'];
type P = [number, number, number];

/** Large subunit as a lumpy molecular cluster with an open front cleft where tRNAs bind (reference 6). */
function useSubunits() {
  return useMemo(() => {
    const big = blobCluster(320, [1.05, 0.66, 0.72], 0.085, 7);
    const keep = big.pts.map((p) => !(p[2] > 0.18 && Math.abs(p[0]) < 0.42 && p[1] < 0.25));
    const small = blobCluster(200, [1.0, 0.33, 0.66], 0.075, 3);
    return {
      big: { pts: big.pts.filter((_, i) => keep[i]).map(([x, y, z]) => [x, y + 0.2, z] as P), rad: big.rad.filter((_, i) => keep[i]) },
      small: { pts: small.pts.map(([x, y, z]) => [x, y - 0.86, z] as P), rad: small.rad },
    };
  }, []);
}

function TRNA({ codon, color, amino, fading }: { codon: string; color: string; amino?: string; fading?: boolean }) {
  const body = useMemo(() => blobCluster(46, [0.13, 0.24, 0.1], 0.05, codon.charCodeAt(0) + codon.charCodeAt(2)), [codon]);
  const anti = [...codon].map((b) => ({ A: 'U', U: 'A', G: 'C', C: 'G' })[b]!);
  return (
    <group>
      <InstancedSpheres part="trna" color={color} points={body.pts.map(([x, y, z]) => [x, y + 0.02, z] as P)} radii={body.rad} opacity={fading ? 0.55 : 1} anchor={fading ? undefined : [0.16, 0.12, 0]} calloutDir={[70, -40]} />
      {/* anticodon: three bases pairing with the codon below */}
      {anti.map((b, j) => (
        <Part key={j} part="trna" color={NT_COLOR[b]} position={[(j - 1) * 0.13, -0.3, 0]} opacity={fading ? 0.55 : 1}>
          <cylinderGeometry args={[0.026, 0.026, 0.13, 10]} />
        </Part>
      ))}
      {!fading && (
        <Part position={[0, 0.34, 0]} color={amino}>
          <icosahedronGeometry args={[0.07, 2]} />
        </Part>
      )}
    </group>
  );
}

export default function Translation({ stage, reduced }: SceneProps) {
  const mrna = useRef<THREE.Group>(null);
  const incoming = useRef<THREE.Group>(null);
  const x = useRef(0);
  const drop = useRef(0);
  const sub = useSubunits();
  const cur = TRANSLATION_CODONS[stage];
  const isStop = cur?.amino === 'stop';
  const chain = TRANSLATION_CODONS.slice(0, isStop ? stage : stage + 1).filter((c) => c.amino !== 'stop');
  const backbone = useMemo(() => {
    const pts: P[] = [];
    const n = TRANSLATION_CODONS.length * 3;
    for (let i = 0; i <= n; i++) pts.push([i * (W / 3) - W / 3, -0.7, Math.sin(i * 0.5) * 0.02]);
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  }, []);
  const chainPts = useMemo(
    () =>
      chain.map((_, i) => {
        const k = chain.length - 1 - i; // newest bead sits at the exit tunnel
        return [-0.05 + Math.sin(k * 0.7) * 0.18 - k * 0.06, 0.62 + k * 0.17, 0.05 + Math.cos(k * 0.9) * 0.12] as P;
      }),
    [chain],
  );

  useEffect(() => {
    if (!reduced) drop.current = 0.4; // each new tRNA arrives from above and settles on its codon
  }, [stage, reduced]);

  useFrame((_, dt) => {
    const target = -stage * W;
    x.current = reduced ? target : THREE.MathUtils.damp(x.current, target, 4, dt);
    if (mrna.current) mrna.current.position.x = x.current;
    drop.current = reduced ? 0 : THREE.MathUtils.damp(drop.current, 0, 5, dt);
    if (incoming.current) incoming.current.position.y = drop.current;
  });

  return (
    <group position={[0, 0.05, 0]}>
      <InstancedSpheres part="ribosome" color="#5573cf" points={sub.big.pts} radii={sub.big.rad} anchor={[-0.75, 0.75, 0.2]} calloutDir={[-50, -50]} />
      <InstancedSpheres part="ribosome" color="#d99a4e" points={sub.small.pts} radii={sub.small.rad} />

      {/* iRNK ladder: backbone + one coloured base per nucleotide, sliding through the ribosome */}
      <group ref={mrna}>
        <mesh raycast={() => null}>
          <tubeGeometry args={[backbone, 160, 0.03, 8, false]} />
          <meshStandardMaterial color="#c8504c" roughness={0.45} />
        </mesh>
        {TRANSLATION_CODONS.flatMap((c, i) =>
          [...c.codon].map((nt, j) => (
            <Part key={`${i}-${j}`} part="mrna" color={NT_COLOR[nt]} position={[i * W + (j - 1) * (W / 3), -0.6, 0]} anchor={i === stage && j === 0 ? [0, -0.15, 0.1] : undefined} calloutDir={[-60, 40]}>
              <cylinderGeometry args={[0.028, 0.028, 0.16, 10]} />
            </Part>
          )),
        )}
      </group>

      {/* previous tRNA leaving (E side) and the current tRNA on its codon */}
      {stage > 0 && !isStop && (
        <group position={[-W, 0.0, 0.32]}>
          <TRNA codon={TRANSLATION_CODONS[stage - 1].codon} color={TRNA_COLORS[(stage - 1) % 3]} fading />
        </group>
      )}
      {!isStop && cur && (
        <group ref={incoming} position={[0, 0, 0.32]}>
          <TRNA codon={cur.codon} color={TRNA_COLORS[stage % 3]} amino={AMINO[stage % AMINO.length]} />
        </group>
      )}

      <InstancedSpheres part="chain" colors={chain.map((_, i) => AMINO[i % AMINO.length])} points={chainPts} radii={[0.075]} anchor={chainPts[0] ? [chainPts[0][0] + 0.05, chainPts[0][1] + 0.05, chainPts[0][2]] : undefined} calloutDir={[60, -30]} />
    </group>
  );
}
