import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuizQuestion, Topic } from '../../types';
import { play, preloadVoices } from '../../lib/audio';
import { actions } from '../../lib/store';
import { MAX_ATTEMPTS, freshQ, isCorrect, outcome, shuffled, submit, summarize, type QState } from './logic';

const DIFF: Record<QuizQuestion['difficulty'], string> = { easy: 'Oson', medium: 'O‘rta', hard: 'Qiyin' };
const SEP = '\u0001';

function OrderInput({ q, state, onSubmit }: { q: Extract<QuizQuestion, { type: 'order' }>; state: QState; onSubmit: (a: string) => void }) {
  const [items, setItems] = useState(() => shuffled(q.items, q.id));
  const locked = state.status !== 'open';
  const shown = state.status === 'revealed' ? q.items : items;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    play('click');
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <div>
      <ol className="order-list">
        {shown.map((it, i) => (
          <li key={it} className={locked ? (state.status === 'correct' || state.status === 'revealed' ? 'is-correct' : '') : ''}>
            <span className="order-n">{i + 1}</span>
            <span className="order-text">{it}</span>
            {!locked && (
              <span className="order-btns">
                <button type="button" className="icon-btn" aria-label={`${it} — yuqoriga`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" className="icon-btn" aria-label={`${it} — pastga`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!locked && (
        <button type="button" className="btn btn-primary" onClick={() => onSubmit(items.join(SEP))}>
          Tartibni tekshirish
        </button>
      )}
    </div>
  );
}

export default function Quiz({ topic, questions, next }: { topic: Topic; questions: QuizQuestion[]; next?: { to: string; label: string } }) {
  const [round, setRound] = useState(0);
  const [states, setStates] = useState<QState[]>(() => questions.map(freshQ));
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const q = questions[index];
  const s = states[index];
  const mcqOrder = useMemo(() => questions.map((x) => (x.type === 'mcq' ? x.options.map((_, i) => i) : [])), [questions]);

  useEffect(preloadVoices, []);
  useEffect(() => {
    if (round || index) headRef.current?.focus();
  }, [index, round, done]);

  const answer = (a: string) => {
    if (q.type === 'mcq') play('click');
    const r = submit(s, a, isCorrect(q, a));
    if (!r) return;
    if (r.sound) play(r.sound);
    setStates((prev) => prev.map((x, i) => (i === index ? r.state : x)));
  };

  const finish = () => {
    actions.saveQuiz(topic.key, summarize(states));
    setDone(true);
  };

  const restart = () => {
    setStates(questions.map(freshQ));
    setIndex(0);
    setDone(false);
    setRound((r) => r + 1);
  };

  if (done) {
    const r = summarize(states);
    const pct = Math.round((r.score / r.total) * 100);
    const mistakes = questions.map((x, i) => ({ x, st: states[i] })).filter(({ st }) => outcome(st) !== 'first');
    return (
      <div className="quiz-result" aria-live="polite">
        <h3 ref={headRef} tabIndex={-1}>Natija: {r.score} / {r.total} <span className="muted">({pct}%)</span></h3>
        <div className="result-grid">
          <div><strong>{r.first}</strong><span>birinchi urinishda</span></div>
          <div><strong>{r.retry}</strong><span>qayta urinishda</span></div>
          <div><strong>{r.revealed}</strong><span>3 urinishdan so‘ng ko‘rsatildi</span></div>
        </div>
        <p className="muted">
          {pct >= 80 ? 'Ajoyib natija — mavzu yaxshi o‘zlashtirilgan.' : pct >= 50 ? 'Yaxshi asos. Quyidagi savollarni yana bir ko‘rib chiqing.' : 'Mavzuni yana bir o‘qib chiqib, testni qaytadan ishlang — har safar osonroq bo‘ladi.'}
        </p>
        {mistakes.length > 0 && (
          <details className="review" open={mistakes.length <= 4}>
            <summary>Xatolarni ko‘rib chiqish ({mistakes.length})</summary>
            <ul>
              {mistakes.map(({ x }) => (
                <li key={x.id}>
                  <p className="review-q">{x.prompt}</p>
                  <p>
                    <strong>To‘g‘ri javob: </strong>
                    {x.type === 'mcq' ? x.options[x.correct] : x.items.join(' → ')}
                  </p>
                  <p className="muted">{x.explanation}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={restart}>Testni qayta ishlash</button>
          <a className="btn" href="#mavzu-boshi">Mavzuga qaytish</a>
          {next && <Link className="btn" to={next.to}>{next.label} →</Link>}
        </div>
      </div>
    );
  }

  const locked = s.status !== 'open';
  const left = MAX_ATTEMPTS - s.attempts;

  return (
    <div className="quiz" key={round}>
      <div className="quiz-top">
        <span>Savol {index + 1} / {questions.length}</span>
        <span className={`chip diff-${q.difficulty}`}>{DIFF[q.difficulty]}</span>
        <div className="quiz-dots" aria-hidden="true">
          {states.map((st, i) => (
            <span key={i} className={`dot ${i === index ? 'cur' : ''} ${outcome(st) ?? ''}`} />
          ))}
        </div>
      </div>
      <h3 ref={headRef} tabIndex={-1} className="quiz-prompt">{q.prompt}</h3>
      {q.type === 'order' && <p className="muted small">Bandlarni ↑ ↓ tugmalari bilan to‘g‘ri tartibga keltiring.</p>}

      {q.type === 'mcq' ? (
        <div className="options" role="group" aria-label="Javob variantlari">
          {mcqOrder[index].map((oi, n) => {
            const tried = s.wrong.includes(String(oi));
            const correctShown = locked && oi === q.correct;
            const cls = correctShown ? 'is-correct' : tried ? 'is-wrong' : '';
            return (
              <button
                key={oi}
                type="button"
                className={`option ${cls}`}
                disabled={locked || tried}
                onClick={() => answer(String(oi))}
                aria-describedby={correctShown || tried ? `st-${q.id}-${oi}` : undefined}
              >
                <span className="opt-letter">{String.fromCharCode(65 + n)}</span>
                <span className="opt-text">{q.options[oi]}</span>
                {correctShown && <span id={`st-${q.id}-${oi}`} className="opt-state">✓ To‘g‘ri</span>}
                {tried && !correctShown && <span id={`st-${q.id}-${oi}`} className="opt-state">✕ Noto‘g‘ri</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <OrderInput key={`${q.id}-${round}`} q={q} state={s} onSubmit={answer} />
      )}

      <div className="feedback" aria-live="polite">
        {s.status === 'open' && s.attempts === 1 && <p className="fb fb-warn">Bu to‘g‘ri javob emas. Yana bir marta urinib ko‘ring — {left} ta urinish qoldi.</p>}
        {s.status === 'open' && s.attempts === 2 && <p className="fb fb-warn">Yana noto‘g‘ri. O‘ylab javob bering — oxirgi urinish.</p>}
        {s.status === 'correct' && (
          <div className="fb fb-ok">
            <p><strong>✓ To‘g‘ri!</strong> {q.explanation}</p>
          </div>
        )}
        {s.status === 'revealed' && (
          <div className="fb fb-reveal">
            <p><strong>To‘g‘ri javob:</strong> {q.type === 'mcq' ? q.options[q.correct] : q.items.join(' → ')}</p>
            <p>{q.explanation}</p>
            {q.type === 'mcq' && s.lastAnswer !== null && q.wrongExplanations?.[Number(s.lastAnswer)] && (
              <p className="muted">Siz tanlagan javob: {q.wrongExplanations[Number(s.lastAnswer)]}</p>
            )}
          </div>
        )}
      </div>

      <div className="row-actions">
        <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Oldingi</button>
        {index < questions.length - 1 ? (
          <button type="button" className="btn btn-primary" disabled={!locked} onClick={() => setIndex(index + 1)}>Keyingi savol →</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!states.every((x) => x.status !== 'open')} onClick={finish}>Natijani ko‘rish</button>
        )}
      </div>
    </div>
  );
}
