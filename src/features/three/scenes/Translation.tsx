import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { TRANSLATION_CODONS } from '../sequences';
import { Part, useOrganic } from './common';

const NT_COLOR: Record<string, string> = { A: '#5f7fc8', U: '#9a7fd1', G: '#3f9d97', C: '#c47f93' };
const W = 0.42; // codon width
const AMINO = ['#d3a04f', '#6fa3c9', '#c47f93', '#3f9d97', '#9a7fd1', '#b0736b'];

/** tRNA as a cloverleaf: acceptor end on top (amino acid), anticodon loop at the bottom (2.30-rasm). */
function TRNA({ amino }: { amino: string }) {
  return (
    <group>
      <Part part="trna" position={[0, -0.12, 0]} anchor={[0.28, 0.1, 0]}>
        <capsuleGeometry args={[0.045, 0.34, 6, 12]} />
      </Part>
      {[-0.15, 0.15].map((x, i) => (
        <Part key={x} part="trna" position={[x, 0.02, 0]} rotation={[0, 0, i ? -0.5 : 0.5]}>
          <torusGeometry args={[0.065, 0.026, 10, 22]} />
        </Part>
      ))}
      <Part part="trna" position={[0, -0.36, 0]}>
        <torusGeometry args={[0.07, 0.028, 10, 22]} />
      </Part>
      <Part part="trna" position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.035, 0.12, 4, 10]} />
      </Part>
      <Part position={[0, 0.3, 0]} color={amino}>
        <icosahedronGeometry args={[0.075, 2]} />
      </Part>
    </group>
  );
}

export default function Translation({ stage, reduced }: SceneProps) {
  const mrna = useRef<THREE.Group>(null);
  const trna = useRef<THREE.Group>(null);
  const x = useRef(0);
  const drop = useRef(0);
  const small = useOrganic(() => new THREE.SphereGeometry(0.5, 48, 32), 0.02, 5, 1);
  const large = useOrganic(() => new THREE.SphereGeometry(0.55, 48, 32), 0.025, 4, 4);
  const cur = TRANSLATION_CODONS[stage];
  const isStop = cur?.amino === 'stop';
  const chain = TRANSLATION_CODONS.slice(0, isStop ? stage : stage + 1).filter((c) => c.amino !== 'stop');

  useEffect(() => {
    if (!reduced) drop.current = 0.35; // each new tRNA arrives from above and settles on its codon
  }, [stage, reduced]);

  useFrame((_, dt) => {
    const target = -stage * W;
    x.current = reduced ? target : THREE.MathUtils.damp(x.current, target, 4, dt);
    if (mrna.current) mrna.current.position.x = x.current;
    drop.current = reduced ? 0 : THREE.MathUtils.damp(drop.current, 0, 5, dt);
    if (trna.current) trna.current.position.y = drop.current;
  });

  return (
    <group position={[0, -0.15, 0]}>
      <group ref={mrna}>
        {TRANSLATION_CODONS.map((c, i) => (
          <group key={i} position={[i * W, -0.58, 0]}>
            {[...c.codon].map((nt, j) => (
              <Part key={j} part="mrna" color={NT_COLOR[nt]} position={[(j - 1) * 0.13, 0, 0]} anchor={i === stage && j === 1 ? [0, -0.25, 0] : undefined}>
                <boxGeometry args={[0.115, 0.15, 0.115]} />
              </Part>
            ))}
          </group>
        ))}
      </group>

      {/* ribosome: small + large subunit, covering two codons */}
      <Part part="ribosome" geometry={small} position={[W * 0.5, -0.66, -0.05]} scale={[1.18, 0.42, 0.62]} opacity={0.5} anchor={[0.9, -0.2, 0]} />
      <Part part="ribosome" geometry={large} position={[W * 0.5, -0.12, -0.05]} scale={[1.22, 0.76, 0.72]} opacity={0.4} pickable={false} />

      {!isStop && cur && (
        <group ref={trna} position={[0, 0, 0.12]}>
          <TRNA amino={AMINO[stage % AMINO.length]} />
        </group>
      )}

      <group position={[-0.05, 0.42, 0.12]}>
        {chain.map((_c, i) => (
          <Part
            key={i}
            part="chain"
            color={AMINO[i % AMINO.length]}
            position={[-(chain.length - 1 - i) * 0.19, Math.sin(i * 1.3) * 0.05 + (chain.length - 1 - i) * 0.05, 0]}
            anchor={i === chain.length - 1 ? [0, 0.22, 0] : undefined}
          >
            <icosahedronGeometry args={[0.078, 2]} />
          </Part>
        ))}
      </group>
    </group>
  );
}
