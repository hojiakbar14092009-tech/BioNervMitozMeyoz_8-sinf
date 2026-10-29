import type { SceneConfig } from '../../types';
import DivisionSVG from '../division/DivisionSVG';
import { compareSteps, framesFor, meiosisFrames, mitosisFrames } from '../division/stages';
import { TRANSLATION_CODONS } from './sequences';

/** Lateral brain outline with lobes; front faces left. Shared by the 3D fallback and the brain-map interactive. */
export function BrainSVG({ active, onPick }: { active?: string | null; onPick?: (lobe: string) => void }) {
  const lobe = (id: string, d: string, label: string, lx: number, ly: number) => (
    <g key={id} className={`lobe ${active === id ? 'on' : ''}`} onClick={onPick ? () => onPick(id) : undefined} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} aria-label={label}
      onKeyDown={onPick ? (e) => (e.key === 'Enter' || e.key === ' ') && onPick(id) : undefined}>
      <path d={d} />
      <text x={lx} y={ly}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 400 290" className="brain-svg" role="img" aria-label="Bosh miya katta yarimsharlari bo‘laklari">
      {lobe('frontal', 'M60 170 C40 110 80 40 165 32 L180 33 C175 80 170 120 160 160 C130 170 95 175 60 170 Z', 'Peshana', 85, 110)}
      {lobe('parietal', 'M180 33 C240 30 290 50 305 95 C280 115 230 125 160 160 C170 120 175 80 180 33 Z', 'Tepa', 215, 85)}
      {lobe('occipital', 'M305 95 C335 120 345 160 330 190 C310 200 290 195 270 190 C265 160 270 130 305 95 Z', 'Ensa', 285, 160)}
      {lobe('temporal', 'M60 170 C95 175 130 170 160 160 C230 125 280 115 305 95 C270 130 265 160 270 190 C220 215 140 225 95 205 C75 195 63 185 60 170 Z', 'Chakka', 165, 195)}
      <ellipse cx="300" cy="225" rx="48" ry="28" className="cerebellum" />
      <text x="282" y="230" className="small-label">Miyacha</text>
      <path d="M235 215 C240 240 245 260 250 285" className="stem" />
    </svg>
  );
}

function Labels({ items }: { items: string[] }) {
  return (
    <ol className="fallback-legend">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  );
}

export default function SceneFallback({ scene, stage }: { scene: SceneConfig; stage: number }) {
  let art: React.ReactNode = null;
  switch (scene.key) {
    case 'division': {
      if (scene.mode === 'compare') {
        const c = compareSteps[Math.min(stage, compareSteps.length - 1)];
        art = (
          <div className="compare">
            <DivisionSVG frame={mitosisFrames[c.mi]} label={`Mitoz: ${mitosisFrames[c.mi].name}`} />
            <DivisionSVG frame={meiosisFrames[c.me]} label={`Meyoz: ${meiosisFrames[c.me].name}`} />
          </div>
        );
        break;
      }
      const f = framesFor(scene.mode === 'meiosis' ? 'meiosis' : 'mitosis');
      art = <DivisionSVG frame={f[Math.min(stage, f.length - 1)]} />;
      break;
    }
    case 'brain':
      art = <BrainSVG active={scene.hotspots[0]?.id} />;
      break;
    case 'neuron':
      art = (
        <svg viewBox="0 0 400 160" className="fallback-svg" role="img" aria-label="Neyron sxemasi">
          <g className="f-tissue">
            <path d="M40 30 L80 70 M30 80 L80 80 M40 130 L80 90 M95 40 L90 65" />
            <circle cx="95" cy="80" r="22" />
            <line x1="117" y1="80" x2="320" y2="80" />
            {[150, 190, 230, 270].map((x) => (
              <rect key={x} x={x} y="70" width="30" height="20" rx="10" className="f-myelin" />
            ))}
            <path d="M320 80 L350 55 M320 80 L355 80 M320 80 L350 105" />
          </g>
          <text x="70" y="125">Dendritlar</text>
          <text x="80" y="50">Tana</text>
          <text x="180" y="110">Akson + miyelin</text>
          <text x="330" y="125">Akson uchi</text>
        </svg>
      );
      break;
    case 'translation':
      art = (
        <p className="codon-row" aria-label="iRNK kodonlari">
          {TRANSLATION_CODONS.map((c, i) => (
            <span key={i} className={i === stage ? 'on' : ''}>
              {c.codon}
            </span>
          ))}
        </p>
      );
      break;
    default:
      art = null;
  }
  return (
    <div className="scene-fallback">
      <p className="small"><strong>{scene.title}.</strong> {scene.what}</p>
      {art}
      <Labels items={scene.hotspots.map((h) => `${h.label} — ${h.text}`)} />
      <p className="muted small">3D ko‘rinish bu qurilmada ochilmadi — sxematik tasvir ko‘rsatilmoqda.</p>
    </div>
  );
}
