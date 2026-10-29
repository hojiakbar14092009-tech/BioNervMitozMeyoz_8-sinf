import type { SceneKey } from '../../types';

type V3 = [number, number, number];

export interface ViewerConfig {
  /** Direction from the target toward the viewer for the "Old" (front) view. */
  front: V3;
  /** Opening view (normalised internally) and distance. */
  initial: V3;
  distance: number;
  target: V3;
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
  autoRotate: boolean;
  /** OrbitControls units: 2 ≈ one revolution per 30 s. */
  autoSpeed: number;
  /** Optional cut-away toggle label (scene implements it with a clipping plane). */
  section?: string;
  /** Half-width of the model seen from the opening view; the camera backs off until it fits the canvas. */
  span?: number;
  /** Half-height above/below the target that must stay in frame. */
  halfHeight?: number;
  floor: number;
}

const base = { target: [0, 0, 0] as V3, minPolar: 0.15, maxPolar: Math.PI - 0.15, autoRotate: false, autoSpeed: 1.8, minDistance: 2.2, maxDistance: 8.5 };

export const VIEWER: Record<SceneKey, ViewerConfig> = {
  neuron: { ...base, front: [0, 0, 1], initial: [0.05, 0.12, 1], distance: 4.6, span: 2.45, halfHeight: 1.55, maxDistance: 9.5, autoRotate: true, autoSpeed: 1.6, floor: -1.3 },
  reflexArc: { ...base, front: [0, 0, 1], initial: [0.1, 0.2, 1], distance: 4.9, span: 2.75, maxDistance: 10, floor: -1.5 },
  spinalCord: { ...base, front: [0, 0, 1], initial: [0.32, 0.3, 1], distance: 3.8, autoRotate: true, autoSpeed: 1.4, floor: -1.1 },
  brain: { ...base, target: [0.1, 0, 0], halfHeight: 1.55, span: 1.45, front: [-1, 0, 0], initial: [-0.32, 0.18, 1], distance: 4.4, autoRotate: true, autoSpeed: 1.5, section: 'Sagittal kesim', floor: -1.7 },
  metabolism: { ...base, span: 1.9, halfHeight: 1.9, maxDistance: 9, front: [0, 0, 1], initial: [0.15, 0.22, 1], distance: 5.1, autoRotate: true, autoSpeed: 1.2, section: 'Mitoxondriya kesimi', floor: -1.95 },
  dna: { ...base, halfHeight: 1.85, front: [0, 0, 1], initial: [0.2, 0.1, 1], distance: 4.5, floor: -1.9 },
  translation: { ...base, front: [0, 0, 1], initial: [0.08, 0.16, 1], distance: 4.2, floor: -1.3 },
  division: { ...base, front: [0, 0, 1], initial: [0.05, 0.12, 1], distance: 4.2, floor: -1.45 },
};

export type PresetId = 'old' | 'orqa' | 'chap' | 'ong' | 'yuqori' | 'chorak';
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'old', label: 'Old' },
  { id: 'orqa', label: 'Orqa' },
  { id: 'chap', label: 'Chap' },
  { id: 'ong', label: 'O‘ng' },
  { id: 'yuqori', label: 'Yuqori' },
  { id: 'chorak', label: '3/4' },
];

const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** View direction for a preset; "Chap" shows the model's left side (cross(up, front)). */
export function presetDirection(front: V3, id: PresetId): V3 {
  const f = norm(front);
  const left: V3 = norm([f[2], 0, -f[0]]); // up × front with up = +y
  switch (id) {
    case 'old':
      return f;
    case 'orqa':
      return [-f[0], -f[1], -f[2]];
    case 'chap':
      return left;
    case 'ong':
      return [-left[0], -left[1], -left[2]];
    case 'yuqori':
      return norm([f[0] * 0.05, 1, f[2] * 0.05]);
    case 'chorak':
      return norm([f[0] + left[0] * 0.8, 0.45, f[2] + left[2] * 0.8]);
  }
}
