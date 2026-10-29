import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { complementDNA, transcribe } from '../sequences';
import { Part } from './common';

const BASE_COLOR: Record<string, string> = { A: '#5f7fc8', T: '#d3a04f', G: '#3f9d97', C: '#c47f93', U: '#9a7fd1' };
const TEMPLATE = 'ACGTGATACCGGTAACGTTA'; // starts with the book example A-C-G-T-G-A
const PARTNER = complementDNA(TEMPLATE);
const RNA = transcribe(TEMPLATE);
const N = TEMPLATE.length;
const R = 0.52;
const STEP = 0.17;

const opened = (i: number, stage: number) => (stage === 1 ? i >= N / 2 : stage === 2 ? i >= 6 && i < 15 : false);

/** Sugar-phosphate bead + base slab pointing toward the helix axis. */
function Nucleotide({ base, part, light }: { base: string; part: string; light?: boolean }) {
  return (
    <group>
      <Part part={part} roughness={0.5} opacity={light ? 0.9 : 1}>
        <icosahedronGeometry args={[0.058, 2]} />
      </Part>
      <Part part={part} color={BASE_COLOR[base]} position={[R * 0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]} opacity={light ? 0.9 : 1}>
        <capsuleGeometry args={[0.032, R * 0.36, 4, 10]} />
      </Part>
    </group>
  );
}

function Pair({ i, stage, reduced }: { i: number; stage: number; reduced: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const newL = useRef<THREE.Group>(null);
  const newR = useRef<THREE.Group>(null);
  const k = useRef(0);
  const a = i * 0.62;
  const y = (i - N / 2) * STEP;
  useFrame((_, dt) => {
    const target = opened(i, stage) ? 1 : 0;
    k.current = reduced ? target : THREE.MathUtils.damp(k.current, target, 3, dt);
    const o = k.current;
    const twist = a * (1 - o);
    const sep = R * 0.5 + o * 0.46;
    left.current?.position.set(-Math.cos(twist) * sep, y, -Math.sin(twist) * sep * (1 - o));
    left.current?.rotation.set(0, twist, 0);
    right.current?.position.set(Math.cos(twist) * sep, y, Math.sin(twist) * sep * (1 - o));
    right.current?.rotation.set(0, twist + Math.PI, 0);
    // newly built nucleotides pair with the separated strands
    const show = Math.max(0, (o - 0.6) / 0.4);
    for (const g of [newL.current, newR.current]) {
      if (!g) continue;
      g.visible = show > 0.01;
      g.scale.setScalar(show);
    }
    newL.current?.position.set(-sep + R * 0.5, y, 0);
    newR.current?.position.set(sep - R * 0.5, y, 0);
  });
  return (
    <>
      <group ref={left}>
        <group position={[-R * 0.25, 0, 0]}>
          <Nucleotide base={TEMPLATE[i]} part="matritsa" />
        </group>
      </group>
      <group ref={right}>
        <group position={[-R * 0.25, 0, 0]}>
          <Nucleotide base={PARTNER[i]} part="juft" />
        </group>
      </group>
      {/* replication: new partner for the template; transcription: iRNK nucleotide (A–U, G–C) */}
      <group ref={newL} visible={false}>
        <group position={[R * 0.25, 0, 0]} rotation={[0, Math.PI, 0]}>
          <Nucleotide base={stage === 2 ? RNA[i] : PARTNER[i]} part="yangi" light />
        </group>
      </group>
      {stage === 1 && (
        <group ref={newR} visible={false}>
          <group position={[-R * 0.25, 0, 0]}>
            <Nucleotide base={TEMPLATE[i]} part="yangi" light />
          </group>
        </group>
      )}
    </>
  );
}

export default function Dna({ stage, reduced }: SceneProps) {
  const root = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (root.current && !reduced && stage === 0) root.current.rotation.y += dt * 0.12;
  });
  return (
    <group ref={root} rotation={[0, 0, 0.1]}>
      {Array.from({ length: N }, (_, i) => (
        <Pair key={i} i={i} stage={stage} reduced={reduced} />
      ))}
    </group>
  );
}
