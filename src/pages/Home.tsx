import { Link } from 'react-router-dom';
import type { BookId } from '../types';
import { bookList, books } from '../data/books';
import { getTopic, topicLabel, topicPath, topicsByBook } from '../data/registry';
import { useAppState } from '../lib/store';
import { InstallCard, OfflinePanel } from '../features/pwa/PwaUI';

export function NeuralArt() {
  return (
    <svg viewBox="0 0 220 120" className="book-art" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <path d="M30 60 C55 58 70 40 92 38 M30 60 C52 66 66 84 90 88 M92 38 C100 24 112 18 124 16 M90 88 C102 98 110 104 122 106" className="a1" />
        <circle cx="30" cy="60" r="11" className="f1" />
        <path d="M41 60 L180 60" className="a2" />
        {[70, 100, 130, 160].map((x) => (
          <rect key={x} x={x - 11} y="55" width="22" height="10" rx="5" className="f2" />
        ))}
        <path d="M180 60 L200 44 M180 60 L204 60 M180 60 L200 76" className="a1" />
      </g>
    </svg>
  );
}

export function CellArt() {
  return (
    <svg viewBox="0 0 220 120" className="book-art" aria-hidden="true">
      <circle cx="70" cy="60" r="42" className="c-cell" />
      <circle cx="150" cy="60" r="42" className="c-cell" />
      {[0, 1].map((k) => (
        <g key={k} transform={`translate(${70 + k * 80} 60)`}>
          <rect x="-16" y="-14" width="32" height="7" rx="3.5" className="c-p" />
          <rect x="-11" y="-3" width="22" height="7" rx="3.5" className="c-m" />
          <rect x="-16" y="8" width="32" height="7" rx="3.5" className="c-m" />
        </g>
      ))}
    </svg>
  );
}

function BookCard({ id }: { id: BookId }) {
  const book = books[id];
  const progress = useAppState((s) => s.books[id]);
  const topics = topicsByBook[id];
  const done = progress.completedTopics.length;
  const pct = Math.round((done / topics.length) * 100);
  const last = progress.lastTopic ? getTopic(progress.lastTopic) : undefined;
  const next = last ?? topics.find((t) => !progress.completedTopics.includes(t.key)) ?? topics[0];
  return (
    <article className={`book-card card-${id}`}>
      {id === 'grade8' ? <NeuralArt /> : <CellArt />}
      <p className="eyebrow">{book.scope}</p>
      <h2>{book.title}</h2>
      <p className="muted">{book.subtitle}</p>
      <div className="progress-row">
        <span className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
        <span className="small">{done} / {topics.length} mavzu</span>
      </div>
      <div className="row-actions">
        <Link className="btn btn-primary" to={topicPath(next)}>
          {last ? 'Davom etish' : 'Boshlash'}: {topicLabel(next)}
        </Link>
        <Link className="btn" to={book.route}>Mavzular ro‘yxati</Link>
      </div>
    </article>
  );
}

export default function Home() {
  const lastBook = useAppState((s) => s.lastBook);
  const lastKey = useAppState((s) => (s.lastBook ? s.books[s.lastBook].lastTopic : null));
  const last = lastKey ? getTopic(lastKey) : undefined;
  return (
    <div className="page home">
      <header className="home-head">
        <h1>Biologiya: ikki darslik, bitta o‘quv maskani</h1>
        <p className="lead">Darslikni tanlang. Har bir bo‘lim o‘z mavzulari, testlari va natijalari bilan alohida yuritiladi.</p>
      </header>
      {last && lastBook && (
        <Link to={topicPath(last)} className="continue">
          <span className="eyebrow">Oxirgi mashg‘ulot</span>
          <span>
            <strong>{books[lastBook].grade}</strong> · {topicLabel(last)} {last.title}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <InstallCard />
      <div className="book-grid">
        {bookList.map((b) => (
          <BookCard key={b.id} id={b.id} />
        ))}
      </div>
      <OfflinePanel />
      <p className="muted small center">
        <Link to="/belgilanganlar">✎ Belgilangan matnlar</Link>
      </p>
    </div>
  );
}
