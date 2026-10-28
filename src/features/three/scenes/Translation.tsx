import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { TRANSLATION_CODONS } from '../sequences';
import { emph, M } from './common';

const NT_COLOR: Record<string, string> = { A: '#5f7fc8', U: '#9a7fd1', G: '#3f9d97', C: '#c97f95' };
const W = 0.42; // codon width
const AMINO_COLORS = ['#d8a24a', '#6fa3c9', '#c97f95', '#3f9d97', '#9a7fd1', '#b9776f'];

export default function Translation({ stage, selected, reduced }: SceneProps) {
  const mrna = useRef<THREE.Group>(null);
  const x = useRef(0);
  const isStop = TRANSLATION_CODONS[stage]?.amino === 'stop';
  const chain = TRANSLATION_CODONS.slice(0, isStop ? stage : stage + 1).filter((c) => c.amino !== 'stop');

  useFrame((_, dt) => {
    const target = -stage * W;
    x.current = reduced ? target : THREE.MathUtils.damp(x.current, target, 4, dt);
    if (mrna.current) mrna.current.position.x = x.current;
  });

  const cur = TRANSLATION_CODONS[stage];
  return (
    <group position={[0, -0.25, 0]}>
      {/* iRNK: codons slide through the ribosome */}
      <group ref={mrna}>
        {TRANSLATION_CODONS.map((c, i) => (
          <group key={i} position={[i * W, -0.55, 0]}>
            {[...c.codon].map((nt, j) => (
              <mesh key={j} position={[(j - 1) * 0.13, 0, 0]}>
                <boxGeometry args={[0.12, 0.16, 0.12]} />
                <M {...emph(selected, 'mrna', NT_COLOR[nt])} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* ribosome: small + large subunit, covering two codons */}
      <mesh position={[W * 0.5, -0.62, -0.05]} scale={[1.15, 0.45, 0.6]}>
        <sphereGeometry args={[0.5, 32, 20]} />
        <M {...emph(selected, 'ribosome', '#b9a3d6')} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[W * 0.5, -0.12, -0.05]} scale={[1.2, 0.75, 0.7]}>
        <sphereGeometry args={[0.55, 32, 20]} />
        <M {...emph(selected, 'ribosome', '#9d8bc4')} transparent opacity={0.42} depthWrite={false} />
      </mesh>

      {/* tRNA at the current codon */}
      {!isStop && cur && (
        <group position={[0, 0, 0.1]}>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.5, 12]} />
            <M {...emph(selected, 'trna', '#e0b36a')} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[0.12, 0.035, 10, 24]} />
            <M {...emph(selected, 'trna', '#e0b36a')} />
          </mesh>
        </group>
      )}

      {/* growing polypeptide */}
      <group position={[0, 0.32, 0.1]}>
        {chain.map((_c, i) => (
          <group key={i} position={[-(chain.length - 1 - i) * 0.2, (chain.length - 1 - i) * 0.06, 0]}>
            <mesh>
              <sphereGeometry args={[0.085, 18, 14]} />
              <M {...emph(selected, 'chain', AMINO_COLORS[i % AMINO_COLORS.length])} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
