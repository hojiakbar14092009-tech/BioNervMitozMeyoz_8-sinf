import { Link } from 'react-router-dom';
import type { BookId } from '../types';
import { books } from '../data/books';
import { topicLabel, topicPath, topicsByBook } from '../data/registry';
import { useAppState } from '../lib/store';
import { CellArt, NeuralArt } from './Home';
import BackButton from '../components/BackButton';

export default function BookPage({ bookId }: { bookId: BookId }) {
  const book = books[bookId];
  const p = useAppState((s) => s.books[bookId]);
  const topics = topicsByBook[bookId];
  const other = books[bookId === 'grade8' ? 'grade10' : 'grade8'];
  return (
    <div className={`page book-page card-${bookId}`}>
      <div className="page-top">
        <BackButton fallback="/" />
      </div>
      <header className="book-head">
        {bookId === 'grade8' ? <NeuralArt /> : <CellArt />}
        <div>
          <p className="eyebrow">{book.scope}</p>
          <h1>{book.title}</h1>
          <p className="lead">{book.subtitle}</p>
          <p className="muted small">{p.completedTopics.length} / {topics.length} mavzu tugallangan</p>
        </div>
      </header>
      <ol className="topic-grid">
        {topics.map((t) => {
          const done = p.completedTopics.includes(t.key);
          const r = p.quizResults[t.key];
          return (
            <li key={t.key} style={{ '--accent': t.theme.accent, '--accent-d': t.theme.accentDark } as React.CSSProperties}>
              <Link to={topicPath(t)} className="topic-card">
                <span className="topic-num">{topicLabel(t)}</span>
                <span className="topic-title">{t.title}</span>
                <span className="topic-meta">
                  {t.practical && <span className="chip">Amaliy</span>}
                  {done ? <span className="chip ok">✓ Tugallangan</span> : <span className="chip">○ Boshlanmagan</span>}
                  {r && <span className="chip">Test: {r.score}/{r.total}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="row-actions center">
        <Link to="/" className="btn">📚 Kitoblar</Link>
        <Link to={other.route} className="btn">{other.grade} bo‘limiga o‘tish →</Link>
      </div>
    </div>
  );
}
