import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import type { SceneConfig, SceneKey } from '../../types';
import { useReducedMotion } from '../../lib/hooks';
import SceneFallback from './Fallback';
import { SelectionContext, type Selection } from './scenes/common';
import { ModelLegend, StructureInfo, stagesOf } from './structures';

export interface SceneProps {
  scene: SceneConfig;
  stage: number;
  pulse: number;
  reduced: boolean;
  /** Process scenes report the currently active part (e.g. impulse position). */
  report?: (label: string | null) => void;
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

// Opening angle per model: the informative side faces the learner.
const CAMERA: Record<SceneKey, [number, number, number]> = {
  neuron: [0.2, 0.5, 4.6],
  reflexArc: [0.3, 0.7, 4.8],
  spinalCord: [0.9, 0.9, 3.6],
  brain: [-1.6, 0.55, 3.7],
  metabolism: [0, 0.4, 4.9],
  dna: [0.6, 0.3, 4.4],
  translation: [0, 0.5, 4.1],
  division: [0, 0, 4.1],
};
const FLOOR: Record<SceneKey, number> = { neuron: -1.25, reflexArc: -1.45, spinalCord: -1.0, brain: -1.45, metabolism: -1.85, dna: -1.8, translation: -1.2, division: -1.35 };

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

/** Signals once real frames have rendered (after shader compilation), so the stage never looks empty. */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 3) onReady();
  });
  return null;
}

function Studio({ floor }: { floor: number }) {
  return (
    <>
      <hemisphereLight args={['#fff6ee', '#5a5260', 0.5]} />
      <directionalLight position={[3, 4, 5]} intensity={1.15} color="#fff3e6" />
      <directionalLight position={[-4, 1, 2]} intensity={0.35} color="#dfe8ff" />
      <directionalLight position={[0, 3, -5]} intensity={0.75} />
      {/* Soft studio reflections generated locally once (no HDR download). */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.4} position={[0, 4, 2]} scale={[8, 3, 1]} color="#fff7ef" />
        <Lightformer intensity={0.5} position={[-5, 0, 0]} rotation-y={Math.PI / 2} scale={[6, 6, 1]} color="#e6ecff" />
        <Lightformer intensity={0.4} position={[5, -1, -2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} color="#ffe9dc" />
      </Environment>
      <ContactShadows position={[0, floor, 0]} opacity={0.32} scale={9} blur={2.6} far={3.5} resolution={256} color="#2a2430" />
    </>
  );
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
  const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(false);
  const narrow = window.innerWidth < 768;
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2));
  const stages = useMemo(() => stagesOf(scene), [scene]);
  const Scene = scenes[scene.key];
  const cam = CAMERA[scene.key].map((v) => v * (narrow ? 1.22 : 1)) as [number, number, number];

  const selection = useMemo<Selection>(
    () => ({
      selected,
      select: setSelected,
      colors: Object.fromEntries(scene.hotspots.map((h) => [h.id, h.color])),
      labels: Object.fromEntries(scene.hotspots.map((h) => [h.id, h.label])),
      anchors: !narrow,
    }),
    [selected, scene.hotspots, narrow],
  );

  // Mount the canvas only while near the viewport: one heavy WebGL context at a time, freed when scrolled away.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) setReady(false);
  }, [near]);

  const reset = () => {
    controls.current?.reset();
    setSelected(null);
    setAuto(false);
  };
  const st = stages?.[stage];
  const fallback = <SceneFallback scene={scene} stage={stage} />;

  return (
    <figure className="viewer" aria-labelledby={`vh-${scene.key}-${scene.title}`}>
      <header className="viewer-head">
        <p className="eyebrow">Interaktiv 3D model</p>
        <h2 id={`vh-${scene.key}-${scene.title}`}>{scene.title}</h2>
        <p className="viewer-what">
          <strong>Bu nima?</strong> {scene.what}
        </p>
      </header>

      <div ref={host} className="viewer-stage">
        {!webgl ? (
          fallback
        ) : near ? (
          <Boundary fallback={fallback}>
            <Suspense fallback={<div className="viewer-loading" role="status">3D model yuklanmoqda…</div>}>
              <Canvas dpr={dpr} camera={{ position: cam, fov: 40 }} gl={{ antialias: true, powerPreference: 'high-performance' }} aria-label={`${scene.title}: ${scene.what}`} role="img">
                <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(d + 0.25, window.devicePixelRatio || 1, 2))} />
                <FirstFrames onReady={() => setReady(true)} />
                <Studio floor={FLOOR[scene.key]} />
                <SelectionContext.Provider value={selection}>
                  <Scene scene={scene} stage={stage} pulse={pulse} reduced={reduced} report={setActive} />
                </SelectionContext.Provider>
                <OrbitControls ref={controls} enablePan={false} minDistance={2.2} maxDistance={9} autoRotate={auto && !reduced} autoRotateSpeed={0.5} enableDamping />
              </Canvas>
            </Suspense>
          </Boundary>
        ) : (
          <div className="viewer-loading">3D sahna</div>
        )}
        {webgl && near && !ready && (
          <div className="viewer-loading veil" role="status">
            3D model tayyorlanmoqda…
          </div>
        )}
        {st && (
          <div className="viewer-badge" aria-hidden="true">
            <span>{stage + 1} / {stages!.length}</span>
            {st.group && <strong>{st.group}</strong>}
            <span>{scene.mode === 'compare' ? '' : st.name}</span>
          </div>
        )}
        {scene.mode === 'compare' && (
          <>
            <span className="compare-tag left">MITOZ</span>
            <span className="compare-tag right">MEYOZ</span>
          </>
        )}
        {active && (
          <div className="viewer-badge bottom" aria-live="polite">
            Impuls: <strong>{active}</strong>
          </div>
        )}
      </div>

      <div className="viewer-controls" role="toolbar" aria-label="3D boshqaruv">
        <button type="button" className="btn btn-sm" onClick={reset}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          Boshlang‘ich holat
        </button>
        {!reduced && (
          <button type="button" className="btn btn-sm" aria-pressed={auto} onClick={() => setAuto(!auto)}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><ellipse cx="10" cy="10" rx="7" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M15 6.5l2 0.3-0.6 1.9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            {auto ? 'Aylanishni to‘xtatish' : 'Avto-aylanish'}
          </button>
        )}
        {scene.key === 'reflexArc' && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setPulse((p) => p + 1)}>
            ⚡ Impuls yuborish
          </button>
        )}
        <span className="muted small hint">Bir barmoq — aylantirish · ikki barmoq — yaqinlashtirish · qismni bosing — tanlash</span>
      </div>

      {stages && st && (
        <div className="stage-nav">
          <div className="stage-head">
            <button type="button" className="icon-btn" aria-label="Oldingi bosqich" disabled={stage === 0} onClick={() => setStage(stage - 1)}>←</button>
            <div className="stage-title" aria-live="polite">
              <span className="stage-count">{stage + 1}-bosqich / {stages.length}</span>
              {st.group && scene.mode !== 'compare' && <span className="stage-group">{st.group}</span>}
              <strong>{st.name}{st.formula ? ` · ${st.formula}` : ''}</strong>
            </div>
            <button type="button" className="icon-btn" aria-label="Keyingi bosqich" disabled={stage === stages.length - 1} onClick={() => setStage(stage + 1)}>→</button>
          </div>
          <p className="stage-text">{st.text}</p>
          <div className="stage-dots" role="tablist" aria-label="Bosqichlar">
            {stages.map((s, i) => (
              <button key={i} role="tab" aria-selected={i === stage} aria-label={`${i + 1}: ${s.group ? `${s.group} — ` : ''}${s.name}`} className={`sdot ${i === stage ? 'on' : ''}`} onClick={() => setStage(i)} />
            ))}
          </div>
        </div>
      )}

      <ModelLegend hotspots={scene.hotspots} selected={selected} onSelect={setSelected} />
      <StructureInfo hotspots={scene.hotspots} selected={selected} onClose={() => setSelected(null)} />
      <figcaption className="muted small">{scene.caption}</figcaption>
    </figure>
  );
}
