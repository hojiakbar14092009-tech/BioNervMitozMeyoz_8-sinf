import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookId, TopicKey } from '../types';
import { books } from '../data/books';
import { getTopic, topicLabel, topicPath } from '../data/registry';
import { actions, useAppState } from '../lib/store';
import { toast } from '../lib/toast';
import BackButton from '../components/BackButton';

type Filter = 'all' | BookId;

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function HighlightsPage() {
  const all = useAppState((s) => s.highlights);
  const [filter, setFilter] = useState<Filter>('all');
  const [topic, setTopic] = useState<TopicKey | ''>('');
  const [query, setQuery] = useState('');
  const inBook = all.filter((h) => filter === 'all' || h.bookId === filter);
  const topics = [...new Set(inBook.map((h) => h.topicKey))].map((k) => getTopic(k)).filter((t) => t !== undefined);
  const q = query.trim().toLocaleLowerCase('uz');
  const list = inBook
    .filter((h) => (!topic || h.topicKey === topic) && (!q || h.exactText.toLocaleLowerCase('uz').includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="page highlights-page">
      <div className="page-top">
        <BackButton fallback="/" />
      </div>
      <h1>Belgilanganlar</h1>
      <p className="lead">Dars matnidan o‘zingiz tanlab belgilagan so‘z va gaplar.</p>

      {all.length > 0 && (
        <div className="hl-tools">
          <div className="seg" role="group" aria-label="Sinf bo‘yicha filtr">
            {(['all', 'grade8', 'grade10'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'on' : ''} onClick={() => { setFilter(f); setTopic(''); }}>
                {f === 'all' ? 'Barchasi' : books[f].grade} ({all.filter((h) => f === 'all' || h.bookId === f).length})
              </button>
            ))}
          </div>
          <div className="hl-filters">
            <label className="field">
              <span className="small muted">Qidirish</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Belgilangan matndan qidiring…" />
            </label>
            {topics.length > 1 && (
              <label className="field">
                <span className="small muted">Mavzu</span>
                <select value={topic} onChange={(e) => setTopic(e.target.value as TopicKey | '')}>
                  <option value="">Barcha mavzular</option>
                  {topics.map((t) => (
                    <option key={t.key} value={t.key}>
                      {books[t.bookId].grade} · {topicLabel(t)} {t.shortTitle}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <div className="empty-state">
          <p><strong>Hali hech narsa belgilanmagan.</strong></p>
          <p className="muted">Dars matnidan muhim so‘z yoki gapni tanlang va «Belgilash» tugmasini bosing — u shu yerda avtomatik paydo bo‘ladi.</p>
          <div className="row-actions">
            <Link className="btn btn-primary" to={books.grade8.route}>8-sinf darslari</Link>
            <Link className="btn" to={books.grade10.route}>10-sinf darslari</Link>
          </div>
        </div>
      ) : list.length === 0 ? (
        <p className="muted" aria-live="polite">Bu filtr bo‘yicha belgilangan matn topilmadi.</p>
      ) : (
        <ul className="hl-list" aria-live="polite">
          {list.map((h) => {
            const t = getTopic(h.topicKey);
            if (!t || t.bookId !== h.bookId) return null;
            return (
              <li key={h.id} className={`hl-item card-${h.bookId}`}>
                <p className="hl-meta small">
                  <strong>{books[h.bookId].grade} · {topicLabel(t)}</strong> <span className="muted">· {fmtDate(h.createdAt)}</span>
                </p>
                <p className="hl-topic">{t.title}</p>
                <blockquote>
                  <mark className="hl">{h.exactText}</mark>
                </blockquote>
                <div className="row-actions">
                  <Link className="btn btn-sm" to={`${topicPath(t)}#hl-${h.id}`}>Mavzuga qaytish →</Link>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      actions.removeHighlight(h.id);
                      toast('Belgi olib tashlandi');
                    }}
                  >
                    O‘chirish
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
