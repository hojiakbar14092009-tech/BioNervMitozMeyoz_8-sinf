import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeVertices } from 'three-stdlib';
import type { SceneProps } from '../Viewer';
import { TRANSLATION_CODONS } from '../sequences';
import { InstancedSpheres, Part, rand } from './common';

const NT_COLOR: Record<string, string> = { A: '#d9554f', U: '#e2b74a', G: '#4fa56e', C: '#5779d6' };
const W = 0.42; // codon width (3 bases)
const TRNA_COLORS = ['#e2b74a', '#9b74d6', '#5fae78'];
const AMINO = ['#e0a85a', '#d9776e', '#9b74d6', '#5fae78', '#5b9fd0', '#d38fb8'];
type P = [number, number, number];

/**
 * Ribosomal subunit as one smooth surface: overlapping globular bumps (protein/RNA domains) on an
 * ellipsoid, with a carved groove — the tRNA cleft (large subunit) or the iRNK channel (small subunit).
 */
function subunitGeometry(size: [number, number, number], seed: number, carve: (x: number, y: number, z: number) => number, detail = 6) {
  // welded so normals are smooth (icosahedron output is non-indexed)
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const bumps = Array.from({ length: 46 }, (_, i) => {
    const u = rand(i, seed) * 2 - 1;
    const th = rand(i, seed + 1) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { d: new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)), w: 0.18 + rand(i, seed + 2) * 0.2, h: 0.07 + rand(i, seed + 3) * 0.11 };
  });
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    for (const b of bumps) r += b.h * Math.exp(-(v.distanceToSquared(b.d) / (b.w * b.w)));
    r += 0.012 * Math.sin(v.x * 23 + seed) * Math.sin(v.y * 19) * Math.sin(v.z * 21);
    const p = v.clone().multiplyScalar(r);
    p.set(p.x * size[0], p.y * size[1], p.z * size[2]);
    p.multiplyScalar(1 - carve(p.x, p.y, p.z));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function useSubunits() {
  const geos = useMemo(
    () => ({
      // large: cleft open toward the viewer above the iRNK where tRNAs sit
      big: subunitGeometry([1.0, 0.62, 0.7], 7, (x, y, z) => (z > 0 ? 0.62 * Math.exp(-((x / 0.55) ** 4)) * Math.exp(-(((y + 0.25) / 0.55) ** 2)) * Math.min(1, z / 0.45) : 0)),
      // small: shallow channel along x on top for the iRNK
      small: subunitGeometry([0.98, 0.32, 0.64], 3, (_x, y, z) => (y > 0 ? 0.2 * Math.exp(-((z / 0.18) ** 2)) * (y / 0.32) : 0)),
    }),
    [],
  );
  useEffect(
    () => () => {
      geos.big.dispose();
      geos.small.dispose();
    },
    [geos],
  );
  return geos;
}

function TRNA({ codon, color, amino, fading }: { codon: string; color: string; amino?: string; fading?: boolean }) {
  const body = useMemo(() => subunitGeometry([0.14, 0.26, 0.11], codon.charCodeAt(0) + codon.charCodeAt(2), () => 0, 4), [codon]);
  useEffect(() => () => body.dispose(), [body]);
  const anti = [...codon].map((b) => ({ A: 'U', U: 'A', G: 'C', C: 'G' })[b]!);
  return (
    <group>
      <Part part="trna" color={color} geometry={body} position={[0, 0.02, 0]} roughness={0.6} opacity={fading ? 0.55 : 1} anchor={fading ? undefined : [0.16, 0.12, 0]} calloutDir={[70, -40]} />
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
      <Part part="ribosome" geometry={sub.big} position={[0, 0.22, 0]} roughness={0.68} anchor={[-0.75, 0.55, 0.2]} calloutDir={[-50, -50]} />
      <Part part="ribosome" geometry={sub.small} color="#d99a4e" position={[0, -0.86, 0]} roughness={0.68} />

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
        <group position={[-W, 0.0, 0.42]}>
          <TRNA codon={TRANSLATION_CODONS[stage - 1].codon} color={TRNA_COLORS[(stage - 1) % 3]} fading />
        </group>
      )}
      {!isStop && cur && (
        <group ref={incoming} position={[0, 0, 0.42]}>
          <TRNA codon={cur.codon} color={TRNA_COLORS[stage % 3]} amino={AMINO[stage % AMINO.length]} />
        </group>
      )}

      <InstancedSpheres part="chain" colors={chain.map((_, i) => AMINO[i % AMINO.length])} points={chainPts} radii={[0.075]} anchor={chainPts[0] ? [chainPts[0][0] + 0.05, chainPts[0][1] + 0.05, chainPts[0][2]] : undefined} calloutDir={[60, -30]} />
    </group>
  );
}
