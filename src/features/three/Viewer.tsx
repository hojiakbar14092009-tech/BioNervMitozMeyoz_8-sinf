import { Component, Suspense, lazy, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import type { SceneConfig, SceneKey } from '../../types';
import { framesFor } from '../division/stages';
import { useReducedMotion } from '../../lib/hooks';
import SceneFallback from './Fallback';
import { TRANSLATION_CODONS } from './sequences';

export interface SceneProps {
  scene: SceneConfig;
  selected: string | null;
  stage: number;
  pulse: number;
  reduced: boolean;
}

const scenes: Record<SceneKey, React.LazyExoticComponent<ComponentType<SceneProps>>> = {
  neuron: lazy(() => import('./scenes/Neuron')),
  reflexArc: lazy(() => import('./scenes/ReflexArc')),
  spinalCord: lazy(() => import('./scenes/SpinalCord')),
  brain: lazy(() => import('./scenes/Brain')),
  metabolism: lazy(() => import('./scenes/Metabolism')),
  dna: lazy(() => import('./scenes/Dna')),
  translation: lazy(() => import('./scenes/Translation')),
  division: lazy(() => import('./scenes/Division')),
};

export function stagesOf(scene: SceneConfig): { names: string[]; texts: string[] } | null {
  if (scene.key === 'division' && (scene.mode === 'mitosis' || scene.mode === 'meiosis')) {
    const f = framesFor(scene.mode);
    return { names: f.map((x) => `${x.name} · ${x.formula}`), texts: f.map((x) => x.text) };
  }
  if (scene.key === 'dna')
    return {
      names: ['Qo‘sh spiral', 'Reduplikatsiya', 'Transkripsiya'],
      texts: [
        'DNK ikki komplementar zanjirdan iborat: A–T va G–C juftlashadi.',
        'Zanjirlar ajraladi; har biri matritsa bo‘lib, DNK-polimeraza erkin nukleotidlardan yangi komplementar zanjir quradi.',
        'DNKning bitta zanjiridan RNK-polimeraza yordamida iRNK sintezlanadi: A–U, G–C.',
      ],
    };
  if (scene.key === 'translation')
    return {
      names: TRANSLATION_CODONS.map((c, i) => `${i + 1}. ${c.codon}`),
      texts: TRANSLATION_CODONS.map((c, i) =>
        c.amino === 'stop'
          ? `${c.codon} — stop kodon: oqsil sintezi to‘xtaydi, ribosoma ikki subbirlikka ajraladi.`
          : i === 0
            ? `${c.codon} — start kodon. ${c.anticodon} antikodonli tRNK ${c.amino}ni olib keladi.`
            : `${c.codon} kodoniga ${c.anticodon} antikodonli tRNK ${c.amino}ni olib keladi; peptid bog‘i hosil bo‘ladi va iRNK bitta tripletga siljiydi.`,
      ),
    };
  if (scene.key === 'metabolism')
    return { names: scene.hotspots.map((h) => h.label), texts: scene.hotspots.map((h) => h.text) };
  return null;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('[3d] scene failed, showing fallback', e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Viewer({ scene }: { scene: SceneConfig }) {
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<OrbitImpl>(null);
  const [near, setNear] = useState(false);
  const [webgl] = useState(hasWebGL);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [auto, setAuto] = useState(false);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2));
  const stages = stagesOf(scene);
  const Scene = scenes[scene.key];
  const sel = scene.hotspots.find((h) => h.id === selected);

  // Mount the canvas only while near the viewport: one heavy WebGL context at a time, freed when scrolled away.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = <SceneFallback scene={scene} stage={stage} />;
  const changeStage = (i: number) => {
    setStage(i);
    if (scene.key === 'metabolism') setSelected(scene.hotspots[i]?.id ?? null);
  };

  return (
    <figure className="viewer">
      <div ref={host} className="viewer-stage">
        {!webgl ? (
          fallback
        ) : near ? (
          <Boundary fallback={fallback}>
            <Suspense fallback={<div className="viewer-loading" role="status">3D model yuklanmoqda…</div>}>
              <Canvas
                dpr={dpr}
                camera={{ position: [0, 0, 4.2], fov: 42 }}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                aria-label={scene.title}
                role="img"
              >
                <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(d + 0.25, window.devicePixelRatio || 1, 2))} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 4, 5]} intensity={1.15} />
                <directionalLight position={[-4, -2, -3]} intensity={0.35} />
                <Scene scene={scene} selected={selected} stage={stage} pulse={pulse} reduced={reduced} />
                <OrbitControls ref={controls} enablePan={false} minDistance={2.2} maxDistance={8} autoRotate={auto && !reduced} autoRotateSpeed={0.6} enableDamping />
              </Canvas>
            </Suspense>
          </Boundary>
        ) : (
          <div className="viewer-loading">3D sahna</div>
        )}
      </div>

      <div className="viewer-controls">
        <button type="button" className="btn btn-sm" onClick={() => controls.current?.reset()}>⟲ Joyiga qaytarish</button>
        {!reduced && (
          <button type="button" className="btn btn-sm" aria-pressed={auto} onClick={() => setAuto(!auto)}>
            {auto ? '⏸ Aylanishni to‘xtatish' : '↻ Avto-aylanish'}
          </button>
        )}
        {scene.key === 'reflexArc' && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setPulse((p) => p + 1)}>⚡ Impuls yuborish</button>
        )}
        <span className="muted small hint">Barmoq bilan aylantiring, ikki barmoq bilan yaqinlashtiring</span>
      </div>

      {stages && (
        <div className="stage-nav">
          <div className="stage-head">
            <button type="button" className="icon-btn" aria-label="Oldingi bosqich" disabled={stage === 0} onClick={() => changeStage(stage - 1)}>←</button>
            <strong aria-live="polite">{stages.names[stage]}</strong>
            <button type="button" className="icon-btn" aria-label="Keyingi bosqich" disabled={stage === stages.names.length - 1} onClick={() => changeStage(stage + 1)}>→</button>
          </div>
          <p className="stage-text">{stages.texts[stage]}</p>
          <div className="stage-dots" role="tablist" aria-label="Bosqichlar">
            {stages.names.map((n, i) => (
              <button key={n} role="tab" aria-selected={i === stage} aria-label={n} className={`sdot ${i === stage ? 'on' : ''}`} onClick={() => changeStage(i)} />
            ))}
          </div>
        </div>
      )}

      {scene.hotspots.length > 0 && scene.key !== 'metabolism' && (
        <div className="hotspots" role="group" aria-label="Tuzilmalar">
          {scene.hotspots.map((h) => (
            <button key={h.id} type="button" className={`chip-btn ${selected === h.id ? 'on' : ''}`} aria-pressed={selected === h.id} onClick={() => setSelected(selected === h.id ? null : h.id)}>
              {h.label}
            </button>
          ))}
        </div>
      )}
      {sel && scene.key !== 'metabolism' && (
        <p className="hotspot-text" aria-live="polite">
          <strong>{sel.label}:</strong> {sel.text}
        </p>
      )}
      <figcaption className="muted small">{scene.caption}</figcaption>
    </figure>
  );
}
