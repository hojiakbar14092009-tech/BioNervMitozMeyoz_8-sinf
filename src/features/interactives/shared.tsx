import { useId, useMemo, useState, type ReactNode } from 'react';
import { play } from '../../lib/audio';
import { shuffled } from '../quiz/logic';

export function Panel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="interactive" aria-label={title}>
      <h3>{title}</h3>
      {children}
      {note && <p className="muted small">{note}</p>}
    </section>
  );
}

/** Tap the items in the correct order. */
export function TapOrder({ items, seed }: { items: string[]; seed: string }) {
  const pool = useMemo(() => shuffled(items, seed), [items, seed]);
  const [done, setDone] = useState<string[]>([]);
  const [miss, setMiss] = useState<string | null>(null);
  const tap = (it: string) => {
    play('click');
    if (it === items[done.length]) {
      setDone([...done, it]);
      setMiss(null);
    } else setMiss(it);
  };
  const complete = done.length === items.length;
  return (
    <div>
      <ol className="tap-done">
        {items.map((_, i) => (
          <li key={i} className={done[i] ? 'filled' : ''}>
            <span className="order-n">{i + 1}</span> {done[i] ?? '…'}
          </li>
        ))}
      </ol>
      {!complete && (
        <div className="tap-pool" role="group" aria-label="Variantlar">
          {pool
            .filter((it) => !done.includes(it))
            .map((it) => (
              <button key={it} type="button" className={`chip-btn ${miss === it ? 'shake' : ''}`} onClick={() => tap(it)}>
                {it}
              </button>
            ))}
        </div>
      )}
      <p className="fb-line" aria-live="polite">
        {complete ? '✓ To‘g‘ri tartib!' : miss ? `✕ «${miss}» hozir emas — avvalgi bosqichni o‘ylang.` : `${done.length + 1}-bosqichni tanlang.`}
      </p>
      {complete && (
        <button type="button" className="btn btn-sm" onClick={() => setDone([])}>
          Qaytadan
        </button>
      )}
    </div>
  );
}

/** Match each left item with its right pair: tap left, then right. */
export function Matcher({ pairs, seed, leftTitle, rightTitle }: { pairs: [string, string][]; seed: string; leftTitle: string; rightTitle: string }) {
  const rights = useMemo(() => shuffled([...new Set(pairs.map((p) => p[1]))], seed), [pairs, seed]);
  const [pick, setPick] = useState<number | null>(null);
  const [solved, setSolved] = useState<number[]>([]);
  const [msg, setMsg] = useState('Chap ustundan bandni tanlang.');
  const choose = (r: string) => {
    if (pick === null) return setMsg('Avval chap ustundan bandni tanlang.');
    play('click');
    if (pairs[pick][1] === r) {
      setSolved([...solved, pick]);
      setMsg(`✓ ${pairs[pick][0]} — ${r}`);
    } else setMsg(`✕ ${pairs[pick][0]} bunga mos emas. Yana urinib ko‘ring.`);
    setPick(null);
  };
  return (
    <div>
      <div className="matcher">
        <div>
          <p className="col-title">{leftTitle}</p>
          {pairs.map(([l], i) => (
            <button
              key={l}
              type="button"
              className={`match-item ${pick === i ? 'on' : ''} ${solved.includes(i) ? 'solved' : ''}`}
              disabled={solved.includes(i)}
              aria-pressed={pick === i}
              onClick={() => {
                play('click');
                setPick(i);
                setMsg(`«${l}» uchun o‘ng ustundan mosini tanlang.`);
              }}
            >
              {solved.includes(i) && '✓ '}
              {l}
              {solved.includes(i) && <span className="match-ans"> → {pairs[i][1]}</span>}
            </button>
          ))}
        </div>
        <div>
          <p className="col-title">{rightTitle}</p>
          {rights.map((r) => (
            <button key={r} type="button" className="match-item" onClick={() => choose(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <p className="fb-line" aria-live="polite">
        {solved.length === pairs.length ? '✓ Hammasi to‘g‘ri juftlandi!' : msg}
      </p>
    </div>
  );
}

export function NumberCheck({ label, answer, unit, tolerance = 0.01 }: { label: string; answer: number; unit?: string; tolerance?: number }) {
  const [v, setV] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const id = useId();
  return (
    <form
      className="numcheck"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(v.replace(',', '.'));
        setState(Math.abs(n - answer) <= Math.abs(answer) * tolerance + 1e-9 ? 'ok' : 'bad');
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="numcheck-row">
        <input id={id} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" />
        {unit && <span className="muted">{unit}</span>}
        <button type="submit" className="btn btn-sm">Tekshirish</button>
      </div>
      <p className="fb-line" aria-live="polite">
        {state === 'ok' && '✓ To‘g‘ri!'}
        {state === 'bad' && '✕ Hali emas — yechim qadamlarini ko‘rib chiqing.'}
      </p>
    </form>
  );
}
