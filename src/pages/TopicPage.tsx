import { lazy, Suspense, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { BookId, Section, Topic } from '../types';
import { books } from '../data/books';
import { getNeighbours, getTopicBySlug, topicLabel, topicPath } from '../data/registry';
import { getQuiz } from '../data/quizRegistry';
import { actions, useAppState } from '../lib/store';
import { HL, HighlightArea } from '../features/highlights/Highlights';
import Interactive from '../features/interactives';
import Quiz from '../features/quiz/Quiz';
import MotifArt from '../components/MotifArt';
import BackButton from '../components/BackButton';
import NotFound from './NotFound';

const Viewer = lazy(() => import('../features/three/Viewer'));

function SectionView({ s, topic }: { s: Section; topic: Topic }) {
  const id = (n: string | number) => `${s.id}-${n}`;
  return (
    <section className={`lesson-section kind-${s.kind}`} aria-labelledby={`h-${s.id}`}>
      <h2 id={`h-${s.id}`}>{s.heading}</h2>
      {s.kind === 'text' && (
        <>
          {s.paras.map((p, i) => (
            <HL key={i} topic={topic} blockId={id(i)} text={p} />
          ))}
          {s.bullets && (
            <ul className="bullets">
              {s.bullets.map((b, i) => (
                <HL key={i} as="li" topic={topic} blockId={id(`b${i}`)} text={b} />
              ))}
            </ul>
          )}
        </>
      )}
      {s.kind === 'steps' && (
        <ol className="steps">
          {s.steps.map((st, i) => (
            <li key={i}>
              <span className="step-n" aria-hidden="true">{i + 1}</span>
              <div>
                <strong>{st.title}</strong>
                <HL topic={topic} blockId={id(i)} text={st.text} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {s.kind === 'table' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {s.columns.map((c, i) => (
                  <th key={i} scope="col">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.kind === 'formula' && (
        <div className="formulas">
          {s.items.map((f) => (
            <div key={f.label} className="formula-card">
              <span className="eyebrow">{f.label}</span>
              <p className="formula-expr">{f.expr}</p>
              {f.note && <HL topic={topic} blockId={id(f.label)} text={f.note} />}
            </div>
          ))}
        </div>
      )}
      <p className="src">Darslik, {s.page}-bet</p>
    </section>
  );
}

export default function TopicPage({ bookId }: { bookId: BookId }) {
  const { slug = '' } = useParams();
  const topic = getTopicBySlug(bookId, slug);
  const done = useAppState((s) => (topic ? s.books[bookId].completedTopics.includes(topic.key) : false));

  const { hash } = useLocation();

  useEffect(() => {
    if (topic) actions.visit(topic.key);
  }, [topic]);

  // Arriving from Belgilanganlar: bring the exact highlight into view and briefly emphasise it.
  useEffect(() => {
    if (!hash.startsWith('#hl-')) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.add('hl-flash');
      window.setTimeout(() => el.classList.remove('hl-flash'), 1800);
    }, 150);
    return () => window.clearTimeout(t);
  }, [hash, topic?.key]);

  if (!topic) return <NotFound />;
  const book = books[bookId];
  const { prev, next } = getNeighbours(topic);
  const quiz = getQuiz(topic);
  const style = {
    '--accent': topic.theme.accent,
    '--accent-2': topic.theme.accent2,
    '--accent-d': topic.theme.accentDark,
    '--accent-2-d': topic.theme.accent2Dark,
  } as React.CSSProperties;
  const [first, ...rest] = topic.sections;

  return (
    <article className={`page topic motif-${topic.theme.motif}`} style={style} key={topic.key}>
      <div className="page-top">
        <BackButton fallback={book.route} />
      </div>
      <nav aria-label="Yo‘l" className="crumbs">
        <Link to="/">Kitoblar</Link> <span aria-hidden="true">/</span> <Link to={book.route}>{book.title}</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{topicLabel(topic)}</span>
      </nav>
      <header className="topic-hero" id="mavzu-boshi">
        <MotifArt motif={topic.theme.motif} />
        <p className="eyebrow">
          {book.grade} · {book.subtitle}
        </p>
        <p className="topic-number">{topicLabel(topic)}{topic.practical && <span className="chip">Amaliy mashg‘ulot</span>}</p>
        <h1>{topic.title}</h1>
        <p className="lead">{topic.intro}</p>
        <ul className="concepts" aria-label="Asosiy tushunchalar">
          {topic.keyConcepts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="muted small">Darslik, {topic.pages[0]}–{topic.pages[1]}-betlar · Matnni belgilash uchun uni tanlang.</p>
      </header>

      <HighlightArea topic={topic}>
        {first && <SectionView s={first} topic={topic} />}

        {topic.scene && (
          <section className="lesson-section scene-section" aria-label="Interaktiv 3D model">
            <Suspense fallback={<div className="viewer-loading">3D model yuklanmoqda…</div>}>
              <Viewer scene={topic.scene} />
            </Suspense>
          </section>
        )}

        {rest.map((s) => (
          <SectionView key={s.id} s={s} topic={topic} />
        ))}
      </HighlightArea>

      {topic.interactive && (
        <section className="lesson-section">
          <Interactive k={topic.interactive} />
        </section>
      )}

      <section className="lesson-section terms" aria-labelledby="h-terms">
        <h2 id="h-terms">Muhim atamalar</h2>
        <dl>
          {topic.terms.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <HighlightArea topic={topic}>
        <section className="lesson-section important" aria-labelledby="h-imp">
          <h2 id="h-imp">Imtihon uchun muhim</h2>
          <ul>
            {topic.important.map((x, i) => (
              <HL key={i} as="li" topic={topic} blockId={`imp-${i}`} text={x} />
            ))}
          </ul>
        </section>
        <section className="lesson-section summary" aria-labelledby="h-sum">
          <h2 id="h-sum">Xulosa</h2>
          <HL topic={topic} blockId="summary" text={topic.summary} />
        </section>
      </HighlightArea>

      <section className="lesson-section quiz-section" aria-labelledby="h-quiz">
        <h2 id="h-quiz">Mavzu bo‘yicha test</h2>
        <p className="muted small">Har bir savolga 3 tagacha urinish. Uchinchi xatodan so‘ng to‘g‘ri javob va izoh ko‘rsatiladi.</p>
        <Quiz key={topic.key} topic={topic} questions={quiz} next={next ? { to: topicPath(next), label: `Keyingi: ${topicLabel(next)}` } : undefined} />
      </section>

      <div className="complete-row">
        <button type="button" className={`btn ${done ? '' : 'btn-primary'}`} aria-pressed={done} onClick={() => actions.toggleComplete(topic.key)}>
          {done ? '✓ Tugallangan deb belgilangan' : 'Mavzuni tugallangan deb belgilash'}
        </button>
      </div>

      <nav className="pager" aria-label="Mavzular bo‘ylab">
        {prev ? (
          <Link to={topicPath(prev)} className="pager-link">
            <span className="muted small">← Oldingi</span>
            <span>{topicLabel(prev)} {prev.shortTitle}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={topicPath(next)} className="pager-link right">
            <span className="muted small">Keyingi →</span>
            <span>{topicLabel(next)} {next.shortTitle}</span>
          </Link>
        ) : (
          <Link to={books[bookId === 'grade8' ? 'grade10' : 'grade8'].route} className="pager-link right switch">
            <span className="muted small">{book.grade} yakunlandi</span>
            <span>{books[bookId === 'grade8' ? 'grade10' : 'grade8'].grade} bo‘limiga o‘tish →</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
