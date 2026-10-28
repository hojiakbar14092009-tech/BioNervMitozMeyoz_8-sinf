import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookId } from '../types';
import { books } from '../data/books';
import { getTopic, topicLabel, topicPath } from '../data/registry';
import { actions, useAppState } from '../lib/store';

type Filter = 'all' | BookId;

export default function HighlightsPage() {
  const all = useAppState((s) => s.highlights);
  const [filter, setFilter] = useState<Filter>('all');
  const list = all.filter((h) => filter === 'all' || h.bookId === filter).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="page highlights-page">
      <h1>Belgilanganlar</h1>
      <div className="seg" role="group" aria-label="Filtr">
        {(['all', 'grade8', 'grade10'] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Hammasi' : books[f].grade} ({all.filter((h) => f === 'all' || h.bookId === f).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="muted">Hali belgilangan matn yo‘q. Mavzu matnidan parcha tanlang va «Belgilash» tugmasini bosing.</p>
      ) : (
        <ul className="hl-list">
          {list.map((h) => {
            const t = getTopic(h.topicKey);
            if (!t || t.bookId !== h.bookId) return null;
            return (
              <li key={h.id} className={`hl-item card-${h.bookId}`}>
                <blockquote>«{h.exactText}»</blockquote>
                <p className="small">
                  <strong>{books[h.bookId].grade}</strong> · {topicLabel(t)} {t.title}
                </p>
                <div className="row-actions">
                  <Link className="btn btn-sm" to={topicPath(t)}>Mavzuga o‘tish →</Link>
                  <button type="button" className="btn btn-sm" onClick={() => actions.removeHighlight(h.id)}>O‘chirish</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
