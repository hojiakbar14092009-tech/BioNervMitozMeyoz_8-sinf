import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { play } from '../../lib/audio';
import { mitosisFrames } from '../division/stages';
import { Panel } from './shared';

// Virtual onion root-tip preparation (Biologiya 10, pp.79–80; phase descriptions pp.73–74).
// Visual direction: reference 1 (stained lavender walls, pink granular cytoplasm, dark-violet chromatin).

export type Phase = 0 | 1 | 2 | 3 | 4; // interfaza, profaza, metafaza, anafaza, telofaza
const PHASE_NAMES = ['Interfaza', 'Profaza', 'Metafaza', 'Anafaza', 'Telofaza'] as const;

export interface Cell {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  skew: number;
  phase: Phase;
  seed: number;
}

const rnd = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const ROOT_LEN = 1500;
const HALF_W = 250;
/** Half-width of the root at depth y: straight sides, rounded cap at the tip. */
const halfWidth = (y: number) => (y < 1130 ? HALF_W : HALF_W * Math.sqrt(Math.max(0, 1 - ((y - 1130) / 370) ** 2)));

/** Cell files along the root: long cells in the elongation zone, short dividing cells in the meristem near the tip. */
export function makeRootTip(): Cell[] {
  const cells: Cell[] = [];
  const files = 9;
  const fw = (HALF_W * 2) / files;
  let id = 0;
  for (let j = 0; j < files; j++) {
    let y = 0;
    let k = 0;
    while (y < ROOT_LEN) {
      const meristem = y > 880 && y < 1330;
      const h = (meristem ? 40 : y < 880 ? 44 + (880 - y) * 0.07 : 38) * (0.88 + rnd(k, j + 1) * 0.24);
      const x = -HALF_W + j * fw + fw / 2 + Math.sin(y * 0.004 + j) * 4;
      if (Math.abs(x) + fw / 2 - 6 < halfWidth(y + h / 2)) {
        const r = rnd(k, j + 7);
        // the meristem holds most dividing cells; the elongation zone and cap are interphase
        const phase: Phase = !meristem ? 0 : r < 0.58 ? 0 : r < 0.72 ? 1 : r < 0.82 ? 2 : r < 0.9 ? 3 : 4;
        cells.push({ id: id++, x, y: y + h / 2, w: fw - 3 + (rnd(k, j + 3) - 0.5) * 4, h: h - 3, skew: (rnd(k, j + 5) - 0.5) * 4, phase, seed: id * 7 + 3 });
      }
      y += h;
      k++;
    }
  }
  return cells;
}

let grain: CanvasPattern | null = null;
/** Granular cytoplasm texture, built once. */
function grainPattern(ctx: CanvasRenderingContext2D) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efc6dc';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 520; i++) {
    const a = rnd(i, 3);
    g.fillStyle = a < 0.5 ? 'rgba(196,120,170,0.35)' : 'rgba(255,236,246,0.5)';
    g.beginPath();
    g.arc(rnd(i, 1) * 64, rnd(i, 2) * 64, 0.5 + a * 1.1, 0, Math.PI * 2);
    g.fill();
  }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

function cellPath(ctx: CanvasRenderingContext2D, c: Cell) {
  const { x, y, w, h, skew } = c;
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + r + skew, y - h / 2);
  ctx.lineTo(x + w / 2 - r + skew * 0.5, y - h / 2);
  ctx.quadraticCurveTo(x + w / 2 + skew * 0.5, y - h / 2, x + w / 2, y - h / 2 + r);
  ctx.lineTo(x + w / 2 - skew * 0.3, y + h / 2 - r);
  ctx.quadraticCurveTo(x + w / 2 - skew * 0.3, y + h / 2, x + w / 2 - r, y + h / 2);
  ctx.lineTo(x - w / 2 + r, y + h / 2);
  ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
  ctx.lineTo(x - w / 2 + skew, y - h / 2 + r);
  ctx.quadraticCurveTo(x - w / 2 + skew, y - h / 2, x - w / 2 + r + skew, y - h / 2);
  ctx.closePath();
}

function worm(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}

/** Draws one stained cell. Spindle axis runs along the root (vertical), so the metaphase plate is horizontal. */
export function drawCell(ctx: CanvasRenderingContext2D, c: Cell, detail: boolean, selected = false) {
  ctx.save();
  cellPath(ctx, c);
  ctx.fillStyle = grainPattern(ctx) ?? '#efc6dc';
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeStyle = selected ? '#3a7bd5' : '#a77fbf';
  ctx.stroke();
  const { x, y, w, h, seed } = c;
  const chrom = '#3d1556';
  if (!detail) {
    if (c.phase === 0 || c.phase === 1) {
      ctx.fillStyle = '#7a3f98';
      ctx.beginPath();
      ctx.arc(x, y, Math.min(w, h) * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#4a1d66';
      ctx.fillRect(x - w * 0.3, y - 2, w * 0.6, 4);
    }
    ctx.restore();
    return;
  }
  ctx.strokeStyle = chrom;
  const spindle = () => {
    ctx.strokeStyle = 'rgba(150,100,190,0.45)';
    ctx.lineWidth = 0.8;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.42);
      ctx.quadraticCurveTo(x + i * w * 0.09, y, x, y + h * 0.42);
      ctx.stroke();
    }
    ctx.strokeStyle = chrom;
  };
  if (c.phase === 0 || c.phase === 1) {
    const r = Math.min(w, h) * (c.phase === 1 ? 0.3 : 0.26);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, c.phase === 1 ? '#a86ac4' : '#9a5cb8');
    g.addColorStop(1, c.phase === 1 ? '#6b2f88' : '#5e2a7c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.92, rnd(seed, 1), 0, Math.PI * 2);
    ctx.fill();
    if (c.phase === 0) {
      // fine chromatin + nucleolus
      ctx.fillStyle = 'rgba(40,10,60,0.45)';
      for (let i = 0; i < 26; i++) {
        const a = rnd(seed + i, 2) * Math.PI * 2;
        const d = Math.sqrt(rnd(seed + i, 3)) * r * 0.85;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 + rnd(i, seed) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2e0d42';
      ctx.beginPath();
      ctx.arc(x + r * 0.25, y - r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // prophase: condensing, coiled chromosomes inside a fading nucleus
      for (let k = 0; k < 7; k++) {
        const pts: [number, number][] = Array.from({ length: 5 }, (_, i) => [x + (rnd(seed + k * 9 + i, 4) - 0.5) * r * 1.5, y + (rnd(seed + k * 9 + i, 5) - 0.5) * r * 1.5]);
        worm(ctx, pts, 2.2);
      }
    }
  } else if (c.phase === 2) {
    spindle();
    for (let k = 0; k < 8; k++) {
      const cx = x - w * 0.32 + (k / 7) * w * 0.64;
      worm(ctx, [[cx - 1, y - 6 - rnd(seed + k, 6) * 3], [cx + 1, y], [cx - 1, y + 6 + rnd(seed + k, 7) * 3]], 2.6);
    }
  } else if (c.phase === 3) {
    spindle();
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const cx = x - w * 0.28 + (k / 6) * w * 0.56;
        const cy = y + dir * h * 0.32;
        // V-shapes: arms trail toward the equator as chromatids are pulled to the pole
        worm(ctx, [[cx - 3, cy - dir * 6], [cx, cy], [cx + 3, cy - dir * 6]], 2.2);
      }
    }
  } else {
    // telophase: two compact daughter nuclei and the forming plant cell plate
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#4a1a66';
      ctx.beginPath();
      ctx.ellipse(x, y + dir * h * 0.26, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(167,127,191,0.9)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, y);
    ctx.lineTo(x + w * 0.42, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function PhaseThumb({ phase, size = 96 }: { phase: Phase; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4dcea';
    ctx.fillRect(0, 0, size, size);
    ctx.setTransform(dpr * 1.55, 0, 0, dpr * 1.55, 0, 0);
    drawCell(ctx, { id: 0, x: size / 3.1, y: size / 3.1, w: 52, h: 50, skew: 1, phase, seed: 11 + phase * 5 }, true);
  }, [phase, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

const OBJ = { low: 0.32, high: 1.35 } as const;

export default function Microscope() {
  const cells = useMemo(makeRootTip, []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const closeup = useRef<HTMLCanvasElement>(null);
  const view = useRef<{ cx: number; cy: number; zoom: number }>({ cx: 0, cy: 1090, zoom: OBJ.low });
  const anim = useRef(0);
  const [obj, setObj] = useState<'low' | 'high'>('low');
  const [sel, setSel] = useState<Cell | null>(null);
  const [guess, setGuess] = useState<Phase | null>(null);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState(false);

  const draw = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (cv.width !== W * dpr) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    const { cx, cy, zoom } = view.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#16111c';
    ctx.fillRect(0, 0, W, H);
    // eyepiece field
    const R = Math.min(W, H) / 2 - 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#f6e2ee';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    const detail = zoom > 0.75;
    const vx = W / 2 / zoom;
    const vy = H / 2 / zoom;
    for (const c of cells) {
      if (Math.abs(c.x - cx) > vx + 40 || Math.abs(c.y - cy) > vy + 40) continue;
      drawCell(ctx, c, detail, sel?.id === c.id);
    }
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, R * 0.7, W / 2, H / 2, R);
    v.addColorStop(0, 'rgba(22,17,28,0)');
    v.addColorStop(1, 'rgba(22,17,28,0.55)');
    ctx.fillStyle = v;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3346';
    ctx.lineWidth = 6;
    ctx.stroke();
  }, [cells, sel]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const animateTo = useCallback(
    (to: Partial<typeof view.current>) => {
      cancelAnimationFrame(anim.current);
      const from = { ...view.current };
      const goal = { ...from, ...to };
      const t0 = performance.now();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const step = (now: number) => {
        const k = reduce ? 1 : Math.min(1, (now - t0) / 450);
        const e = 1 - (1 - k) ** 3;
        view.current = { cx: from.cx + (goal.cx - from.cx) * e, cy: from.cy + (goal.cy - from.cy) * e, zoom: from.zoom + (goal.zoom - from.zoom) * e };
        drawRef.current();
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [],
  );

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (canvas.current) ro.observe(canvas.current);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // close-up of the selected cell
  useEffect(() => {
    const cv = closeup.current;
    if (!cv || !sel) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = cv.clientWidth;
    cv.width = cv.height = S * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f6e2ee';
    ctx.fillRect(0, 0, S, S);
    const z = (S * 0.62) / Math.max(sel.w, sel.h);
    ctx.translate(S / 2, S / 2);
    ctx.scale(z, z);
    ctx.translate(-sel.x, -sel.y);
    for (const c of cells) if (Math.abs(c.x - sel.x) < S / z && Math.abs(c.y - sel.y) < S / z) drawCell(ctx, c, true, c.id === sel.id);
  }, [sel, cells]);

  // pointer: drag to pan, pinch / wheel to zoom, tap to select (40× only)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) view.current.zoom = Math.min(3, Math.max(0.25, view.current.zoom * (d / pinch.current)));
      pinch.current = d;
    } else {
      moved.current += Math.abs(dx) + Math.abs(dy);
      view.current.cx -= dx / view.current.zoom;
      view.current.cy -= dy / view.current.zoom;
    }
    view.current.cx = Math.max(-HALF_W - 100, Math.min(HALF_W + 100, view.current.cx));
    view.current.cy = Math.max(0, Math.min(ROOT_LEN, view.current.cy));
    draw();
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = 0;
    if (moved.current > 6 || !canvas.current) return;
    const r = canvas.current.getBoundingClientRect();
    const { cx, cy, zoom } = view.current;
    const wx = cx + (e.clientX - r.left - r.width / 2) / zoom;
    const wy = cy + (e.clientY - r.top - r.height / 2) / zoom;
    const hit = cells.find((c) => Math.abs(c.x - wx) < c.w / 2 && Math.abs(c.y - wy) < c.h / 2);
    if (!hit) return;
    if (zoom < 0.75) {
      // at 10× a tap centres and switches to the high-power objective
      setObj('high');
      animateTo({ cx: hit.x, cy: hit.y, zoom: OBJ.high });
      return;
    }
    play('click');
    setSel(hit);
    setGuess(null);
    setReveal(false);
  };
  const onWheel = (e: React.WheelEvent) => {
    view.current.zoom = Math.min(3, Math.max(0.25, view.current.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    draw();
  };

  const switchObj = (o: 'low' | 'high') => {
    setObj(o);
    animateTo(o === 'low' ? { cx: 0, cy: 1090, zoom: OBJ.low } : { cx: sel?.x ?? 0, cy: sel?.y ?? 1100, zoom: OBJ.high });
  };
  const pickDividing = () => {
    const pool = cells.filter((c) => c.phase !== 0 && !found.has(c.id));
    const c = pool[Math.floor(Math.random() * pool.length)] ?? cells[0];
    setObj('high');
    setSel(c);
    setGuess(null);
    setReveal(false);
    animateTo({ cx: c.x, cy: c.y, zoom: OBJ.high });
  };

  const dividingTotal = cells.filter((c) => c.phase !== 0).length;
  const correct = sel && guess === sel.phase;

  return (
    <Panel title="Virtual mikroskop: piyoz ildizi uchi" note="Preparat tayyorlash bosqichlari va kuzatish tartibi — 79–80-betlar; faza belgilari — 73–74-betlar. Preparat dasturda chizilgan (sxematik-realistik).">
      <div className="mscope">
        <div className="seg" role="group" aria-label="Obyektiv">
          <button type="button" aria-pressed={obj === 'low'} className={obj === 'low' ? 'on' : ''} onClick={() => switchObj('low')}>Kichik obyektiv (10×)</button>
          <button type="button" aria-pressed={obj === 'high'} className={obj === 'high' ? 'on' : ''} onClick={() => switchObj('high')}>Katta obyektiv (40×)</button>
        </div>
        <canvas
          ref={canvas}
          className="mscope-canvas"
          role="img"
          aria-label={`Piyoz ildizi uchi preparati, ${obj === 'low' ? '10×' : '40×'} kattalashtirish. Hujayrani tanlash uchun bosing.`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        />
        <div className="row-actions">
          <button type="button" className="btn btn-sm" onClick={pickDividing}>Bo‘linayotgan hujayrani topish</button>
          <button type="button" className="btn btn-sm" onClick={() => switchObj(obj)}>Markazga qaytarish</button>
        </div>
        <p className="muted small">
          {obj === 'low' ? 'Kichik obyektivda tasvir topiladi: ildiz uchidagi bo‘linish zonasini bosing — katta obyektivga o‘tiladi.' : 'Barmoq bilan suring, ikki barmoq bilan kattalashtiring; hujayrani bosib tanlang.'}
        </p>
      </div>

      {sel && (
        <div className="mscope-info">
          <canvas ref={closeup} className="mscope-closeup" aria-hidden="true" />
          <div>
            <p className="eyebrow">Tanlangan hujayra · 40×</p>
            <p>Bu hujayra mitozning qaysi fazasida?</p>
            <div className="seg wrap" role="group" aria-label="Faza">
              {PHASE_NAMES.map((p, k) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={guess === k}
                  className={guess === k ? (k === sel.phase ? 'on ok' : 'on bad') : ''}
                  onClick={() => {
                    play('click');
                    setGuess(k as Phase);
                    if (k === sel.phase) setFound(new Set(found).add(sel.id));
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="fb-line" aria-live="polite">
              {guess !== null && (correct ? `✓ To‘g‘ri — ${PHASE_NAMES[sel.phase]}.` : '✕ Yana qarang: yadro bormi? xromosomalar ekvatordami yoki qutblardami?')}
            </p>
            {(correct || reveal) && <p className="stage-text">{mitosisFrames[sel.phase].text}</p>}
            {!correct && guess !== null && !reveal && (
              <button type="button" className="btn btn-sm" onClick={() => setReveal(true)}>Javobni ko‘rsatish</button>
            )}
          </div>
        </div>
      )}
      <p className="muted small">Aniqlangan bo‘linayotgan hujayralar: {[...found].filter((id) => cells[id].phase !== 0).length} / {dividingTotal}</p>

      <div className="phase-gallery" aria-label="Mitoz fazalari: mikroskopda ko‘rinishi">
        {PHASE_NAMES.map((p, k) => (
          <figure key={p}>
            <PhaseThumb phase={k as Phase} />
            <figcaption>{p}</figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  );
}
