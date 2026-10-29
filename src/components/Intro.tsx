import { useEffect, useState } from 'react';
import { introMode, markSeen, readSeen } from '../lib/intro';

// 16 points that settle onto the cell membrane (r = 46 around the mark centre).
const POINTS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const far = 70 + ((i * 37) % 40);
  return {
    x: 120 + Math.cos(a) * 46,
    y: 92 + Math.sin(a) * 46,
    dx: Math.cos(a + 0.9) * far,
    dy: Math.sin(a + 0.9) * far,
    delay: (i % 8) * 45,
  };
});

/** Biological identity mark: neuron dendrites → cell with chromosome → axon drawn as a DNA double strand. */
export function BioMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={`bio-mark ${className}`} aria-hidden="true">
      <g className="m-dendrites">
        <path d="M74 92 C62 86 54 74 44 62" />
        <path d="M62 86 C52 86 44 92 34 96" />
        <path d="M75 101 C64 110 56 120 46 130" />
        <path d="M54 74 C48 70 44 62 42 54" />
      </g>
      <circle className="m-cell" cx="120" cy="92" r="46" />
      <g className="m-chromo">
        <rect x="104" y="88" width="32" height="8" rx="4" transform="rotate(-38 120 92)" className="m-p" />
        <rect x="104" y="88" width="32" height="8" rx="4" transform="rotate(38 120 92)" className="m-m" />
        <circle cx="120" cy="92" r="3.2" className="m-centro" />
      </g>
      <g className="m-helix">
        <path d="M166 92 C176 80 186 80 196 92 S216 104 226 92" />
        <path d="M166 92 C176 104 186 104 196 92 S216 80 226 92" />
        <path className="m-rung" d="M181 85 V99 M211 85 V99" />
      </g>
    </svg>
  );
}

export default function Intro() {
  const [mode] = useState(() => introMode(readSeen(), window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>(mode === 'none' ? 'gone' : 'show');

  useEffect(() => {
    if (mode === 'none') return;
    markSeen();
    const total = mode === 'full' ? 2500 : 900;
    const a = window.setTimeout(() => setPhase('leave'), total);
    const b = window.setTimeout(() => setPhase('gone'), total + 450);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [mode]);

  if (phase === 'gone') return null;
  const skip = () => {
    setPhase('leave');
    window.setTimeout(() => setPhase('gone'), 300);
  };
  return (
    <div className={`intro intro-${mode} ${phase === 'leave' ? 'leaving' : ''}`} role="presentation">
      <div className="intro-stage">
        <svg viewBox="0 0 240 200" className="intro-points" aria-hidden="true">
          {POINTS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.4" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}ms` } as React.CSSProperties} />
          ))}
        </svg>
        <BioMark className="intro-mark" />
        <div className="intro-title">
          <strong>Biologiya</strong>
          <span>8-sinf · 10-sinf — interaktiv darslik</span>
        </div>
      </div>
      <button type="button" className="intro-skip" onClick={skip}>
        O‘tkazib yuborish
      </button>
    </div>
  );
}
