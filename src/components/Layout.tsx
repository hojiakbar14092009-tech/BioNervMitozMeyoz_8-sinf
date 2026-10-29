import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import type { BookId } from '../types';
import { books } from '../data/books';
import { topicPath, topicsByBook } from '../data/registry';
import { actions, useAppState } from '../lib/store';
import { stopAudio } from '../lib/audio';
import { useToast } from '../lib/toast';
import Intro, { BioMark } from './Intro';
import { OfflineStatus, UpdateBar } from '../features/pwa/PwaUI';

export function bookFromPath(path: string): BookId | null {
  if (path.startsWith(books.grade8.route)) return 'grade8';
  if (path.startsWith(books.grade10.route)) return 'grade10';
  return null;
}

function useEffectiveTheme() {
  const pref = useAppState((s) => s.theme);
  const [system, setSystem] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystem(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const theme = pref ?? (system ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14171f' : '#f4f2ee');
  }, [theme]);
  return theme;
}

export function TopicNav({ bookId, onNavigate }: { bookId: BookId; onNavigate?: () => void }) {
  const done = useAppState((s) => s.books[bookId].completedTopics);
  const book = books[bookId];
  const other = books[bookId === 'grade8' ? 'grade10' : 'grade8'];
  return (
    <nav aria-label={`${book.title} mavzulari`} className="topic-nav">
      <div className="nav-book">
        <Link to={book.route} onClick={onNavigate} className="nav-book-title">
          {book.title}
        </Link>
        <span className="muted small">{book.subtitle} · {book.scope}</span>
      </div>
      <ul>
        {topicsByBook[bookId].map((t) => {
          const isDone = done.includes(t.key);
          return (
            <li key={t.key}>
              <NavLink to={topicPath(t)} onClick={onNavigate} className={({ isActive }) => `nav-topic ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <span className={`status ${isDone ? 'done' : isActive ? 'cur' : ''}`} aria-label={isDone ? 'tugallangan' : isActive ? 'joriy' : 'boshlanmagan'}>
                      {isDone ? '✓' : isActive ? '●' : '○'}
                    </span>
                    <span className="nav-num">{t.number}</span>
                    <span className="nav-title">{t.shortTitle}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className="nav-foot">
        <Link to="/" onClick={onNavigate} className="btn btn-sm">📚 Kitoblar</Link>
        <Link to={other.route} onClick={onNavigate} className="btn btn-sm">{other.grade} bo‘limiga o‘tish →</Link>
        <Link to="/belgilanganlar" onClick={onNavigate} className="btn btn-sm">✎ Belgilanganlar</Link>
      </div>
    </nav>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const bookId = bookFromPath(pathname);
  const theme = useEffectiveTheme();
  const audio = useAppState((s) => s.audioEnabled);
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
    stopAudio();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const btn = menuBtn.current;
    drawer.current?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (prev ?? btn)?.focus();
    };
  }, [open]);

  return (
    <div className={`app ${bookId ? `in-book book-${bookId}` : ''}`}>
      <a href="#main" className="skip">Asosiy kontentga o‘tish</a>
      <header className="topbar">
        <div className="topbar-inner">
          {bookId && (
            <button ref={menuBtn} type="button" className="icon-btn menu-btn" aria-label="Mavzular menyusi" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
              <span className="burger" aria-hidden="true" />
            </button>
          )}
          <Link to="/" className="brand">
            <BioMark className="brand-svg" />
            <span>Biologiya</span>
          </Link>
          {bookId && (
            <Link to={books[bookId].route} className={`book-chip chip-${bookId}`}>
              {books[bookId].grade}
            </Link>
          )}
          <div className="topbar-actions">
            <OfflineStatus />
            <button type="button" className="icon-btn" aria-label={audio ? 'Ovozni o‘chirish' : 'Ovozni yoqish'} aria-pressed={audio} onClick={() => actions.setAudio(!audio)}>
              {audio ? '🔊' : '🔇'}
            </button>
            <button type="button" className="icon-btn" aria-label={theme === 'dark' ? 'Yorug‘ rejim' : 'Qorong‘i rejim'} onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      {bookId && open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <div id="drawer" ref={drawer} className="drawer" role="dialog" aria-modal="true" aria-label="Mavzular" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>Mavzular</strong>
              <button type="button" className="icon-btn" aria-label="Menyuni yopish" onClick={() => setOpen(false)}>✕</button>
            </div>
            <TopicNav bookId={bookId} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="shell">
        {bookId && (
          <aside className="sidebar">
            <TopicNav bookId={bookId} />
          </aside>
        )}
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <Toaster />
      <UpdateBar />
      <Intro />
      <ScrollRestoration />
      <footer className="site-foot muted small">
        Mazmun manbalari: «Biologiya (Odam va uning salomatligi)» 8-sinf darsligi va «Biologiya 10» (2022) darsligi.
      </footer>
    </div>
  );
}

function Toaster() {
  const t = useToast();
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {t && (
        <div className="toast" key={t.id}>
          <span>✓ {t.text}</span>
          {t.link && <Link to={t.link.to}>{t.link.label}</Link>}
        </div>
      )}
    </div>
  );
}
