import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneProps } from '../Viewer';
import { complementDNA, transcribe } from '../sequences';

const BASE_COLOR: Record<string, string> = { A: '#5f7fc8', T: '#d8a24a', G: '#3f9d97', C: '#c97f95', U: '#9a7fd1' };
const TEMPLATE = 'ACGTGATACCGGTAACGTTA'; // starts with the book example A-C-G-T-G-A
const PARTNER = complementDNA(TEMPLATE);
const RNA = transcribe(TEMPLATE);
const N = TEMPLATE.length;
const R = 0.5;
const STEP = 0.16;

function opened(i: number, stage: number) {
  if (stage === 1) return i >= N / 2; // replication fork in the upper half
  if (stage === 2) return i >= 6 && i < 15; // transcription bubble
  return false;
}

function Nucleotide({ base, light }: { base: string; light?: boolean }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshStandardMaterial color={light ? '#cfd6e6' : '#e8e2d6'} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, R * 0.95, 8]} />
        <meshStandardMaterial color={BASE_COLOR[base]} transparent={light} opacity={light ? 0.85 : 1} />
      </mesh>
    </group>
  );
}

function Pair({ i, stage, reduced }: { i: number; stage: number; reduced: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const extra = useRef<THREE.Group>(null);
  const k = useRef(0);
  const a = i * 0.62;
  const y = (i - N / 2) * STEP;
  useFrame((_, dt) => {
    const target = opened(i, stage) ? 1 : 0;
    k.current = reduced ? target : THREE.MathUtils.damp(k.current, target, 3, dt);
    const o = k.current;
    const twist = a * (1 - o);
    const sep = R * 0.5 + o * 0.42;
    // half-rung groups face the axis; when opened they untwist and move apart
    if (left.current) {
      left.current.position.set(Math.cos(twist) * -sep, y, Math.sin(twist) * -sep * (1 - o));
      left.current.rotation.set(0, twist, 0);
    }
    if (right.current) {
      right.current.position.set(Math.cos(twist) * sep, y, Math.sin(twist) * sep * (1 - o));
      right.current.rotation.set(0, twist + Math.PI, 0);
    }
    if (extra.current) {
      extra.current.visible = o > 0.6;
      extra.current.scale.setScalar(Math.max(0, (o - 0.6) / 0.4));
    }
  });
  const newOnLeft = stage === 1 ? PARTNER[i] : RNA[i];
  return (
    <>
      <group ref={left}>
        <group position={[-R * 0.25, 0, 0]}>
          <Nucleotide base={TEMPLATE[i]} />
        </group>
      </group>
      <group ref={right}>
        <group position={[-R * 0.25, 0, 0]}>
          <Nucleotide base={PARTNER[i]} />
        </group>
      </group>
      {/* newly built strand: DNA partners (replication) or iRNK (transcription) pairing with the template */}
      <group ref={extra} visible={false} position={[-R * 0.5 - 0.42 + R * 0.5, y, 0]}>
        <group position={[R * 0.25, 0, 0]} rotation={[0, Math.PI, 0]}>
          <Nucleotide base={newOnLeft} light />
        </group>
      </group>
      {stage === 1 && <ReplicaRight i={i} y={y} reduced={reduced} />}
    </>
  );
}

/** In replication the second parental strand also gets a new partner. */
function ReplicaRight({ i, y, reduced }: { i: number; y: number; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  const k = useRef(0);
  useFrame((_, dt) => {
    const target = opened(i, 1) ? 1 : 0;
    k.current = reduced ? target : THREE.MathUtils.damp(k.current, target, 3, dt);
    if (g.current) {
      g.current.visible = k.current > 0.6;
      g.current.scale.setScalar(Math.max(0, (k.current - 0.6) / 0.4));
    }
  });
  return (
    <group ref={g} visible={false} position={[0.42 - R * 0.25 + 0.0, y, 0]}>
      <group position={[-R * 0.25, 0, 0]}>
        <Nucleotide base={TEMPLATE[i]} light />
      </group>
    </group>
  );
}

export default function Dna({ stage, reduced }: SceneProps) {
  const root = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (root.current && !reduced && stage === 0) root.current.rotation.y += dt * 0.15;
  });
  return (
    <group ref={root} rotation={[0, 0, 0.12]} scale={1.05}>
      {Array.from({ length: N }, (_, i) => (
        <Pair key={i} i={i} stage={stage} reduced={reduced} />
      ))}
    </group>
  );
}
