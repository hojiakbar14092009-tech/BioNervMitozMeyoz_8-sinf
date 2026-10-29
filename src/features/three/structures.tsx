import type { Hotspot, SceneConfig } from '../../types';
import { compareSteps, framesFor, groupOf, meiosisFrames, mitosisFrames } from '../division/stages';
import { TRANSLATION_CODONS } from './sequences';

export interface Stage {
  name: string;
  text: string;
  /** Explicit header, e.g. "Meyoz I" — stages are never distinguished by colour alone. */
  group?: string;
  formula?: string;
}

/** The single timeline that drives both the 3D state and the explanation text. */
export function stagesOf(scene: SceneConfig): Stage[] | null {
  if (scene.key === 'division' && scene.mode === 'compare')
    return compareSteps.map((s) => ({
      name: `${mitosisFrames[s.mi].name} ↔ ${meiosisFrames[s.me].name}`,
      text: s.note,
      group: `Mitoz: ${mitosisFrames[s.mi].name} · ${groupOf('meiosis', s.me)}: ${meiosisFrames[s.me].name}`,
    }));
  const mode = scene.mode;
  if (scene.key === 'division' && (mode === 'mitosis' || mode === 'meiosis')) {
    return framesFor(mode).map((f, i) => ({ name: f.name, text: f.text, group: groupOf(mode, i), formula: f.formula }));
  }
  if (scene.key === 'translation')
    return TRANSLATION_CODONS.map((c, i) => ({
      name: `${c.codon} → ${c.amino === 'stop' ? 'stop' : c.amino}`,
      group: i === 0 ? 'Boshlanish' : c.amino === 'stop' ? 'Tugash' : 'Zanjir uzayishi',
      text:
        c.amino === 'stop'
          ? `${c.codon} — stop kodon: oqsil sintezi to‘xtaydi, ribosoma ikki subbirlikka ajraladi.`
          : i === 0
            ? `${c.codon} — start kodon. ${c.anticodon} antikodonli tRNK ${c.amino}ni olib keladi.`
            : `${c.codon} kodoniga ${c.anticodon} antikodonli tRNK ${c.amino}ni olib keladi; peptid bog‘i hosil bo‘ladi va iRNK bitta tripletga siljiydi.`,
    }));
  return scene.stages ?? null;
}

export function ModelLegend({ hotspots, selected, onSelect }: { hotspots: Hotspot[]; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <div className="legend-block">
      <p className="legend-title">Model qismlari</p>
      <div className="hotspots" role="group" aria-label="Model qismlari">
        {hotspots.map((h) => (
          <button key={h.id} type="button" className={`chip-btn legend-chip ${selected === h.id ? 'on' : ''}`} aria-pressed={selected === h.id} onClick={() => onSelect(selected === h.id ? null : h.id)}>
            <span className="swatch" style={{ background: h.color }} aria-hidden="true" />
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Information card for the selected structure — the phone-friendly alternative to floating labels. */
export function StructureInfo({ hotspots, selected, onClose }: { hotspots: Hotspot[]; selected: string | null; onClose: () => void }) {
  const h = hotspots.find((x) => x.id === selected);
  if (!h)
    return (
      <p className="structure-info empty" aria-live="polite">
        Modeldagi qismni bosing yoki ro‘yxatdan tanlang — uning nomi va darslikdagi izohi shu yerda chiqadi.
      </p>
    );
  return (
    <div className="structure-info" aria-live="polite" role="region" aria-label={`Tanlangan qism: ${h.label}`}>
      <div className="si-head">
        <span className="swatch" style={{ background: h.color }} aria-hidden="true" />
        <strong>{h.label}</strong>
        <button type="button" className="icon-btn si-close" aria-label="Tanlovni bekor qilish" onClick={onClose}>
          ✕
        </button>
      </div>
      <p>{h.text}</p>
      <p className="src">Darslik, {h.page}-bet</p>
    </div>
  );
}
