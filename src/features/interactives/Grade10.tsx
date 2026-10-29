import { useState } from 'react';
import { play } from '../../lib/audio';
import { GENETIC_CODE, anticodon, codons, complementDNA, transcribe } from '../three/sequences';
import { PROBLEMS, energy } from './energy';
import { Matcher, NumberCheck, Panel } from './shared';

const fmt = (n: number) => n.toLocaleString('uz-UZ');

// 2.8 — pp.61–62
export function EnergyLedger() {
  const [n, setN] = useState(1);
  const [aerobic, setAerobic] = useState(true);
  const e = energy(n, aerobic);
  const max = energy(n, true).glycolysis.total + energy(n, true).aerobic.total;
  const bar = (v: number, cls: string, label: string) => v > 0 && <span className={`seg-bar ${cls}`} style={{ width: `${(v / max) * 100}%` }} title={label} />;
  return (
    <Panel title="Energiya hisobi" note="Qiymatlar 1 glyukoza uchun darslikdan (62-bet); n glyukoza uchun ko‘paytiriladi.">
      <div className="sliders">
        <label>
          Glyukoza molekulalari: <strong>{n}</strong>
          <input type="range" min={1} max={10} value={n} onChange={(ev) => setN(Number(ev.target.value))} />
        </label>
        <div className="seg" role="group" aria-label="Kislorod">
          <button type="button" aria-pressed={aerobic} className={aerobic ? 'on' : ''} onClick={() => setAerobic(true)}>Kislorod bor (aerob)</button>
          <button type="button" aria-pressed={!aerobic} className={!aerobic ? 'on' : ''} onClick={() => setAerobic(false)}>Kislorod yetishmaydi</button>
        </div>
      </div>
      <div className="energy-bar" aria-hidden="true">
        {bar(e.glycolysis.atpKJ, 'atp', 'Glikoliz: ATF')}
        {bar(e.glycolysis.heat, 'heat', 'Glikoliz: issiqlik')}
        {bar(e.aerobic.atpKJ, 'atp2', 'Aerob: ATF')}
        {bar(e.aerobic.heat, 'heat2', 'Aerob: issiqlik')}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Bosqich</th><th>Jami, kJ</th><th>ATFda, kJ</th><th>Issiqlik, kJ</th><th>ATF</th></tr>
          </thead>
          <tbody>
            <tr><td>Tayyorgarlik</td><td>—</td><td>0</td><td>to‘liq</td><td>0</td></tr>
            <tr><td>Glikoliz (sitozol)</td><td>{fmt(e.glycolysis.total)}</td><td>{fmt(e.glycolysis.atpKJ)}</td><td>{fmt(e.glycolysis.heat)}</td><td>{e.glycolysis.atp}</td></tr>
            <tr><td>Kislorodli (mitoxondriya)</td><td>{fmt(e.aerobic.total)}</td><td>{fmt(e.aerobic.atpKJ)}</td><td>{fmt(e.aerobic.heat)}</td><td>{e.aerobic.atp}</td></tr>
            <tr className="total"><td>Jami</td><td>{fmt(e.glycolysis.total + e.aerobic.total)}</td><td>{fmt(e.atpKJ)}</td><td>{fmt(e.heat)}</td><td>{e.atp}</td></tr>
          </tbody>
        </table>
      </div>
      {!aerobic && <p className="fb-line">Kislorod yetishmasa faqat glikoliz o‘tadi: sut kislota to‘planadi va muskullar charchaydi (62-bet).</p>}
    </Panel>
  );
}

// 2.9 — p.64
export function EnergyProblems() {
  const [open, setOpen] = useState<Record<number, number>>({});
  return (
    <Panel title="Masalalarni yeching" note="Masalalar darslikning 64-betidan. Avval o‘zingiz yeching, so‘ng qadamlarni oching.">
      <ol className="problems">
        {PROBLEMS.map((p) => {
          const shown = open[p.n] ?? 0;
          return (
            <li key={p.n} className="problem">
              <p><strong>{p.n}-masala.</strong> {p.text}</p>
              <NumberCheck label="Javobingiz:" answer={p.answer} unit={p.unit} />
              <ol className="steps-reveal">
                {p.steps.slice(0, shown).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {shown < p.steps.length ? (
                <button type="button" className="btn btn-sm" onClick={() => setOpen({ ...open, [p.n]: shown + 1 })}>
                  {shown ? 'Keyingi qadam' : 'Yechim qadamini ko‘rsatish'}
                </button>
              ) : (
                <p className="fb-line">Javob: <strong>{fmt(p.answer)} {p.unit}</strong></p>
              )}
              {p.note && <p className="muted small">{p.note}</p>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

// 2.10 — pp.65–69
export function CodonBuilder() {
  const [dna, setDna] = useState('GTCATGGATAGTCCTAAT');
  const clean = dna.toUpperCase().replace(/[^ACGT]/g, '');
  const rna = transcribe(clean);
  const cs = codons(rna);
  const full = cs.filter((c) => c.length === 3);
  const aminos = [];
  for (const c of full) {
    const a = GENETIC_CODE[c];
    if (a === 'stop') break;
    aminos.push(a);
  }
  return (
    <Panel title="DNK → iRNK → oqsil" note="Default ketma-ketlik — darslikdagi «Tahlil» topshirig‘i (69-bet). Kiritilgan zanjir matritsa sifatida transkripsiyalanadi: A→U, T→A, G→C, C→G.">
      <label className="field">
        DNK matritsa zanjiri
        <input value={dna} onChange={(e) => setDna(e.target.value)} spellCheck={false} autoCapitalize="characters" className="mono" maxLength={60} />
      </label>
      {clean !== dna.toUpperCase() && <p className="fb-line">Faqat A, T, G, C harflari hisobga olinadi.</p>}
      <div className="seq-rows">
        <div><span className="muted">DNK</span><code>{codons(clean).join(' ')}</code></div>
        <div><span className="muted">iRNK</span><code>{cs.join(' ')}</code></div>
        <div><span className="muted">tRNK</span><code>{full.map(anticodon).join(' ')}</code></div>
      </div>
      <div className="amino-chain">
        {full.map((c, i) => (
          <span key={i} className={`amino ${GENETIC_CODE[c] === 'stop' ? 'stop' : ''}`}>
            <small>{c}</small>
            {GENETIC_CODE[c]}
          </span>
        ))}
      </div>
      <p className="big-result">
        Nukleotidlar: {clean.length} · kodonlar: {full.length} · oqsildagi aminokislotalar: <strong>{aminos.length}</strong>
      </p>
    </Panel>
  );
}

// 2.11 — p.71 table (DNK 1-zanjir as template, consistent with the book's transcription example)
const CHAIN1 = 'ATG TAT GAA GAT CCT CGT GTT CCA GGA'.split(' ');
export function TranslationModel() {
  const [vals, setVals] = useState<string[]>(() => CHAIN1.map(() => ''));
  const [checked, setChecked] = useState(false);
  const answers = CHAIN1.map(transcribe);
  const ok = vals.map((v, i) => v.toUpperCase() === answers[i]);
  return (
    <Panel title="Jadvalni to‘ldiring: iRNK kodonlari" note="DNK 1-zanjiri darslikdan (71-bet). 1-zanjir matritsa sifatida olinadi — darslikdagi transkripsiya misoli kabi (A-C-G-T-G-A → U-G-C-A-C-U).">
      <div className="table-wrap">
        <table className="codon-table">
          <tbody>
            <tr><th>DNK 1-zanjir</th>{CHAIN1.map((t, i) => <td key={i} className="mono">{t}</td>)}</tr>
            <tr><th>DNK 2-zanjir</th>{CHAIN1.map((t, i) => <td key={i} className="mono muted">{checked ? complementDNA(t) : '···'}</td>)}</tr>
            <tr>
              <th>iRNK</th>
              {CHAIN1.map((t, i) => (
                <td key={i}>
                  <input
                    aria-label={`${i + 1}-kodon (DNK ${t})`}
                    className={`mono codon-in ${checked ? (ok[i] ? 'ok' : 'bad') : ''}`}
                    value={vals[i]}
                    maxLength={3}
                    autoCapitalize="characters"
                    onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value.toUpperCase() : v)))}
                  />
                </td>
              ))}
            </tr>
            {checked && (
              <>
                <tr><th>tRNK</th>{answers.map((c, i) => <td key={i} className="mono">{anticodon(c)}</td>)}</tr>
                <tr><th>Aminokislota</th>{answers.map((c, i) => <td key={i}>{GENETIC_CODE[c]}</td>)}</tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => { play('click'); setChecked(true); }}>Tekshirish</button>
        <button type="button" className="btn btn-sm" onClick={() => { setVals(answers); setChecked(true); }}>Javoblarni ko‘rsatish</button>
      </div>
      {checked && <p className="fb-line" aria-live="polite">{ok.filter(Boolean).length} / {CHAIN1.length} kodon to‘g‘ri. {ok.every(Boolean) ? '✓ A’lo!' : 'Qizil kataklarni A–U, G–C qoidasi bilan tekshiring.'}</p>}
    </Panel>
  );
}

// 2.12 — p.74 «Qo‘llash» + «Sintez»
export function CellCycle() {
  const [d, setD] = useState(38);
  const n = d / 2;
  const rows: [string, number, number][] = [
    ['G1 davr', d, d],
    ['S va G2 davr', d, 2 * d],
    ['Profaza', d, 2 * d],
    ['Metafaza', d, 2 * d],
    ['Anafaza', 2 * d, 2 * d],
    ['Telofaza (har bir hujayra)', d, d],
  ];
  return (
    <Panel title="Xromosoma va DNK soni" note="Formulalar darslikdan (73–74-betlar). n — xromosomalar soni, c — DNK soni.">
      <Matcher
        seed="g10-212"
        leftTitle="Bosqich"
        rightTitle="Formula"
        pairs={[
          ['G1 davr', '2n2c'],
          ['Sintez davri', '2n4c'],
          ['G2 davr', '2n4c'],
          ['Profaza', '2n4c'],
          ['Metafaza', '2n4c'],
          ['Anafaza', '4n4c'],
          ['Telofaza', '2n2c'],
        ]}
      />
      <label className="select-row">
        Diploid to‘plam 2n =
        <input type="number" min={2} max={200} step={2} value={d} onChange={(e) => setD(Math.max(2, Math.round(Number(e.target.value) / 2) * 2 || 2))} className="mono short" />
        <span className="muted">(darslik: 38)</span>
      </label>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Bosqich</th><th>Xromosomalar</th><th>DNK</th></tr></thead>
          <tbody>
            {rows.map(([name, chr, dnaN]) => (
              <tr key={name}><td>{name}</td><td>{chr}</td><td>{dnaN}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">n = {n}: 2n2c → {d} xromosoma, {d} DNK; 2n4c → {d} xromosoma, {2 * d} DNK; 4n4c → {2 * d} xromosoma, {2 * d} DNK.</p>
    </Panel>
  );
}

// 2.13 — p.78 «Tahlil»
const MEIOSIS_ITEMS: [string, 'I' | 'II' | 'both'][] = [
  ['Tetrada hosil bo‘ladi', 'I'],
  ['Krossingover sodir bo‘ladi', 'I'],
  ['Ekvatorda gomologik xromosomalar joylashadi', 'I'],
  ['Gomologik xromosomalar qutblarga tarqaladi', 'I'],
  ['Xromatida mustaqil xromosomaga aylanadi', 'II'],
  ['To‘rtta gaploid hujayra shakllanadi', 'II'],
  ['Yadro qobig‘i eriydi', 'both'],
  ['Urchuq iplari sentromeraga birikadi', 'both'],
];
const GROUP: Record<'I' | 'II' | 'both', string> = { I: 'Reduksion (meyoz I)', II: 'Ekvatsion (meyoz II)', both: 'Ikkalasida' };

export function MeiosisJourney() {
  const [ans, setAns] = useState<Record<number, 'I' | 'II' | 'both'>>({});
  const score = MEIOSIS_ITEMS.filter(([, g], i) => ans[i] === g).length;
  return (
    <Panel title="Qaysi bo‘linishga tegishli?" note="Darslikdagi «Tahlil» topshirig‘i asosida (78-bet); javoblar 76–77-betlardagi faza tavsiflaridan.">
      <ul className="classify">
        {MEIOSIS_ITEMS.map(([text, g], i) => (
          <li key={text}>
            <span>{text}</span>
            <span className="seg seg-sm" role="group" aria-label={text}>
              {(['I', 'II', 'both'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={ans[i] === k}
                  className={ans[i] === k ? (k === g ? 'on ok' : 'on bad') : ''}
                  disabled={ans[i] === g}
                  onClick={() => { play('click'); setAns({ ...ans, [i]: k }); }}
                >
                  {k === 'both' ? 'Ikkalasi' : `Meyoz ${k}`}
                </button>
              ))}
            </span>
            {ans[i] !== undefined && <span className="state">{ans[i] === g ? `✓ ${GROUP[g]}` : '✕ qayta o‘ylang'}</span>}
          </li>
        ))}
      </ul>
      <p className="fb-line" aria-live="polite">{score} / {MEIOSIS_ITEMS.length} to‘g‘ri</p>
    </Panel>
  );
}

// 2.15 — p.81 task 3: match events to cell-cycle stages (answers from pp.73–76).
export function EventMatch() {
  return (
    <Panel title="Hodisalarni bosqichlar bilan moslang" note="Darslikdagi 3-topshiriq (81-bet). Javoblar 2.12–2.13-mavzulardagi faza tavsiflaridan (73–76-betlar).">
      <Matcher
        seed="g10-215"
        leftTitle="Hodisa"
        rightTitle="Bosqich"
        pairs={[
          ['DNK replikatsiyasi', 'Sintez davri'],
          ['Tubulin oqsilining sintezlanishi', 'Sintezdan keyingi davr'],
          ['Xromosomalarning spirallashuvi', 'Profaza'],
          ['Sentriolaning qutblarga tarqalishi', 'Profaza'],
          ['Xromosomalarning ekvatorda joylashuvi', 'Metafaza'],
          ['4n4c', 'Anafaza'],
          ['Yadro membranasi va yadrochaning paydo bo‘lishi', 'Telofaza'],
          ['Gomologik xromosomalar konyugatsiyasi', 'Profaza I'],
        ]}
      />
    </Panel>
  );
}
