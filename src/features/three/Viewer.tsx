import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import type { SceneConfig, SceneKey } from '../../types';
import { useReducedMotion } from '../../lib/hooks';
import SceneFallback from './Fallback';
import { SelectionContext, type Selection } from './scenes/common';
import { ModelLegend, StructureInfo, stagesOf } from './structures';
import { PRESETS, VIEWER, presetDirection, type PresetId } from './viewerConfig';

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

// Section planes keep the side where normal·p + c ≥ 0.
const SECTION: Partial<Record<SceneKey, THREE.Plane>> = {
  brain: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.04), // midline: removes the near (left) hemisphere
  metabolism: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), // opens the front half of each mitochondrion
};

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

type RigRequest = { kind: 'preset'; dir: [number, number, number]; n: number } | { kind: 'zoom'; factor: number; n: number } | null;

/** Smooth camera moves for presets and zoom buttons; any user drag cancels them. */
function CameraRig({ request, controls, min, max }: { request: RigRequest; controls: React.RefObject<OrbitImpl | null>; min: number; max: number }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!request || !c) return;
    const offset = camera.position.clone().sub(c.target);
    const dist = offset.length();
    if (request.kind === 'preset') goal.current = new THREE.Vector3(...request.dir).normalize().multiplyScalar(dist).add(c.target);
    else goal.current = offset.setLength(THREE.MathUtils.clamp(dist * request.factor, min, max)).add(c.target);
  }, [request, camera, controls, min, max]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (goal.current = null);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!goal.current || !c) return;
    // slerp-like move on the orbit so presets glide around the model instead of cutting through it
    const from = camera.position.clone().sub(c.target);
    const to = goal.current.clone().sub(c.target);
    const k = 1 - Math.exp(-dt * 5);
    const dir = from.clone().normalize().lerp(to.clone().normalize(), k).normalize();
    const len = THREE.MathUtils.lerp(from.length(), to.length(), k);
    camera.position.copy(dir.multiplyScalar(len).add(c.target));
    c.update();
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null;
  });
  return null;
}

function Studio({ floor }: { floor: number }) {
  return (
    <>
      <hemisphereLight args={['#fff6ee', '#4d4656', 0.5]} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#fff3e6" />
      <directionalLight position={[-4, 1, 2]} intensity={0.35} color="#dfe8ff" />
      <directionalLight position={[-1, 3, -5]} intensity={0.9} color="#f4ecff" />
      {/* Soft studio reflections generated locally once (no HDR download). */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.4} position={[0, 4, 2]} scale={[8, 3, 1]} color="#fff7ef" />
        <Lightformer intensity={0.5} position={[-5, 0, 0]} rotation-y={Math.PI / 2} scale={[6, 6, 1]} color="#e6ecff" />
        <Lightformer intensity={0.4} position={[5, -1, -2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} color="#ffe9dc" />
      </Environment>
      <ContactShadows position={[0, floor, 0]} opacity={0.32} scale={9} blur={2.6} far={3.5} resolution={256} color="#1f1a26" />
    </>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Viewer({ scene: base }: { scene: SceneConfig }) {
  const reduced = useReducedMotion();
  const [modeIdx, setModeIdx] = useState(0);
  const activeMode = base.modes?.[modeIdx];
  const scene = useMemo<SceneConfig>(
    () => (activeMode ? { ...base, mode: activeMode.id, title: activeMode.title, what: activeMode.what, hotspots: activeMode.hotspots } : base),
    [base, activeMode],
  );
  const cfg = VIEWER[scene.key];
  const figure = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<OrbitImpl>(null);
  const narrow = window.innerWidth < 768;
  const [near, setNear] = useState(false);
  const [webgl] = useState(hasWebGL);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [auto, setAuto] = useState(cfg.autoRotate && !reduced);
  const [interacting, setInteracting] = useState(false);
  const [labels, setLabels] = useState(!narrow);
  const [section, setSection] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rig, setRig] = useState<RigRequest>(null);
  const [full, setFull] = useState(false);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2));
  const stages = useMemo(() => stagesOf(scene), [scene]);
  const Scene = scenes[scene.key];
  const initial = useMemo(() => new THREE.Vector3(...cfg.initial).normalize().multiplyScalar(cfg.distance * (narrow ? 1.18 : 1)).add(new THREE.Vector3(...cfg.target)).toArray() as [number, number, number], [cfg, narrow]);
  const idle = useRef(0);

  const selection = useMemo<Selection>(
    () => ({
      selected,
      select: setSelected,
      colors: Object.fromEntries(scene.hotspots.map((h) => [h.id, h.color])),
      labels: Object.fromEntries(scene.hotspots.map((h) => [h.id, h.label])),
      anchors: !narrow,
      showLabels: labels,
      clipPlane: section ? (SECTION[scene.key] ?? null) : null,
    }),
    [selected, scene.hotspots, scene.key, narrow, labels, section],
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

  // Stage playback: steps through the timeline, stops at the end.
  useEffect(() => {
    if (!playing || !stages) return;
    if (stage >= stages.length - 1) return setPlaying(false);
    const t = window.setTimeout(() => setStage((s) => s + 1), reduced ? 3200 : 2600);
    return () => window.clearTimeout(t);
  }, [playing, stage, stages, reduced]);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === figure.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  useEffect(() => () => window.clearTimeout(idle.current), []);

  const reset = () => {
    controls.current?.reset();
    setSelected(null);
    setSection(false);
    setPlaying(false);
    setAuto(cfg.autoRotate && !reduced);
  };
  const preset = (id: PresetId) => setRig({ kind: 'preset', dir: presetDirection(cfg.front, id), n: Date.now() });
  const zoom = (factor: number) => setRig({ kind: 'zoom', factor, n: Date.now() });
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : figure.current?.requestFullscreen().catch(() => {}));

  const st = stages?.[stage];
  const fallback = <SceneFallback scene={scene} stage={stage} />;
  const rotating = auto && !reduced && !interacting && selected === null;
  const id = `vh-${scene.key}-${scene.title.replace(/\W+/g, '-')}`;

  return (
    <figure ref={figure} className={`viewer ${full ? 'is-full' : ''}`} aria-labelledby={id}>
      <header className="viewer-head">
        <p className="eyebrow">Interaktiv 3D model</p>
        <h2 id={id}>{scene.title}</h2>
        <p className="viewer-what">
          <strong>Bu nima?</strong> {scene.what}
        </p>
      </header>

      {base.modes && (
        <div className="seg mode-switch" role="tablist" aria-label="Model turi">
          {base.modes.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === modeIdx}
              className={i === modeIdx ? 'on' : ''}
              onClick={() => {
                setModeIdx(i);
                setStage(0);
                setSelected(null);
                setPlaying(false);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div ref={host} className="viewer-stage">
        {!webgl ? (
          fallback
        ) : near ? (
          <Boundary fallback={fallback}>
            <Suspense fallback={<div className="viewer-loading" role="status">3D model yuklanmoqda…</div>}>
              <Canvas
                dpr={dpr}
                camera={{ position: initial, fov: 38 }}
                gl={{ antialias: true, powerPreference: 'high-performance', localClippingEnabled: true }}
                onCreated={({ gl }) => (gl.localClippingEnabled = true)}
                aria-label={`${scene.title}: ${scene.what}`}
                role="img"
              >
                <FirstFrames onReady={() => setReady(true)} />
                <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(d + 0.25, window.devicePixelRatio || 1, 2))} />
                <Studio floor={cfg.floor} />
                <SelectionContext.Provider value={selection}>
                  <Scene scene={scene} stage={stage} pulse={pulse} reduced={reduced} report={setActive} />
                </SelectionContext.Provider>
                <OrbitControls
                  ref={controls}
                  target={cfg.target}
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.08}
                  rotateSpeed={0.75}
                  zoomSpeed={0.8}
                  minDistance={cfg.minDistance}
                  maxDistance={cfg.maxDistance}
                  minPolarAngle={cfg.minPolar}
                  maxPolarAngle={cfg.maxPolar}
                  autoRotate={rotating}
                  autoRotateSpeed={cfg.autoSpeed}
                  onStart={() => {
                    window.clearTimeout(idle.current);
                    setInteracting(true);
                  }}
                  onEnd={() => {
                    // resume auto-rotation after a quiet moment
                    idle.current = window.setTimeout(() => setInteracting(false), 6000);
                  }}
                />
                <CameraRig request={rig} controls={controls} min={cfg.minDistance} max={cfg.maxDistance} />
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
        <div className="zoom-pad" role="group" aria-label="Masshtab">
          <button type="button" className="icon-btn" aria-label="Yaqinlashtirish" onClick={() => zoom(0.78)}>
            <Icon d="M10 4v12M4 10h12" />
          </button>
          <button type="button" className="icon-btn" aria-label="Uzoqlashtirish" onClick={() => zoom(1.28)}>
            <Icon d="M4 10h12" />
          </button>
        </div>
      </div>

      <div className="viewer-controls" role="toolbar" aria-label="3D boshqaruv">
        <button type="button" className="btn btn-sm" onClick={reset}>
          <Icon d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" />
          Boshlang‘ich holat
        </button>
        {!reduced && (
          <button type="button" className="btn btn-sm" aria-pressed={auto} onClick={() => setAuto(!auto)}>
            <Icon d="M3 10a7 3.5 0 1 0 14 0a7 3.5 0 1 0 -14 0M15 6.5l2 .3-.6 1.9" />
            {auto ? 'Avto: yoqiq' : 'Avto-aylanish'}
          </button>
        )}
        <button type="button" className="btn btn-sm" aria-pressed={labels} onClick={() => setLabels(!labels)}>
          <Icon d="M3 5h9l4 5-4 5H3z" />
          Belgilar
        </button>
        {cfg.section && SECTION[scene.key] && (
          <button type="button" className="btn btn-sm" aria-pressed={section} onClick={() => setSection(!section)}>
            <Icon d="M4 16 16 4M4 4h12v12H4z" />
            {cfg.section}
          </button>
        )}
        {scene.key === 'reflexArc' && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setPulse((p) => p + 1)}>
            ⚡ Impuls yuborish
          </button>
        )}
        {stages && stages.length > 2 && (
          <button type="button" className="btn btn-sm" aria-pressed={playing} onClick={() => (playing ? setPlaying(false) : (stage >= stages.length - 1 && setStage(0), setPlaying(true)))}>
            <Icon d={playing ? 'M7 4v12M13 4v12' : 'M6 4l10 6-10 6z'} />
            {playing ? 'Pauza' : 'Jarayonni ijro etish'}
          </button>
        )}
        {document.fullscreenEnabled && (
          <button type="button" className="btn btn-sm" aria-pressed={full} onClick={toggleFull}>
            <Icon d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
            {full ? 'Chiqish' : 'To‘liq ekran'}
          </button>
        )}
      </div>
      <div className="preset-row" role="group" aria-label="Ko‘rinish burchagi">
        <span className="small muted">Ko‘rinish:</span>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="chip-btn preset" onClick={() => preset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted small hint">Bir barmoq — 360° aylantirish · ikki barmoq — yaqinlashtirish · qismni bosing — tanlash</p>

      {stages && st && (
        <div className="stage-nav">
          <div className="stage-head">
            <button type="button" className="icon-btn" aria-label="Oldingi bosqich" disabled={stage === 0} onClick={() => (setPlaying(false), setStage(stage - 1))}>←</button>
            <div className="stage-title" aria-live="polite">
              <span className="stage-count">{stage + 1}-bosqich / {stages.length}</span>
              {st.group && scene.mode !== 'compare' && <span className="stage-group">{st.group}</span>}
              <strong>{st.name}{st.formula ? ` · ${st.formula}` : ''}</strong>
            </div>
            <button type="button" className="icon-btn" aria-label="Keyingi bosqich" disabled={stage === stages.length - 1} onClick={() => (setPlaying(false), setStage(stage + 1))}>→</button>
          </div>
          <p className="stage-text">{st.text}</p>
          <div className="stage-dots" role="tablist" aria-label="Bosqichlar">
            {stages.map((s, i) => (
              <button key={i} role="tab" aria-selected={i === stage} aria-label={`${i + 1}: ${s.group ? `${s.group} — ` : ''}${s.name}`} className={`sdot ${i === stage ? 'on' : ''}`} onClick={() => (setPlaying(false), setStage(i))} />
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
