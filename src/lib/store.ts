import { useSyncExternalStore } from 'react';
import type { AppState, BookId, BookProgress, Highlight, QuizResult, ThemeMode, TopicKey } from '../types';

const KEY = 'bio-app-state';

const emptyBook = (): BookProgress => ({ completedTopics: [], quizResults: {}, lastTopic: null });

export const initialState = (): AppState => ({
  version: 1,
  books: { grade8: emptyBook(), grade10: emptyBook() },
  lastBook: null,
  theme: null,
  audioEnabled: true,
  highlights: [],
});

/** Accepts anything from storage; returns a valid v1 state (unknown/corrupt data → defaults). */
export function migrate(raw: unknown): AppState {
  const base = initialState();
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return base;
  const r = raw as Partial<AppState>;
  const book = (id: BookId): BookProgress => {
    const b = r.books?.[id];
    return {
      completedTopics: Array.isArray(b?.completedTopics) ? b.completedTopics.filter((k) => k.startsWith(`${id}-`)) : [],
      quizResults: b?.quizResults && typeof b.quizResults === 'object' ? b.quizResults : {},
      lastTopic: b?.lastTopic?.startsWith(`${id}-`) ? b.lastTopic : null,
    };
  };
  return {
    version: 1,
    books: { grade8: book('grade8'), grade10: book('grade10') },
    lastBook: r.lastBook === 'grade8' || r.lastBook === 'grade10' ? r.lastBook : null,
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : null,
    audioEnabled: r.audioEnabled !== false,
    highlights: Array.isArray(r.highlights) ? r.highlights.filter((h) => h && h.topicKey?.startsWith(`${h.bookId}-`)) : [],
  };
}

function load(): AppState {
  try {
    return migrate(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return initialState();
  }
}

let state = load();
const listeners = new Set<() => void>();

function set(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode): keep in memory only
  }
  listeners.forEach((l) => l());
}

export const getState = () => state;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

const bookOf = (key: TopicKey): BookId => (key.startsWith('grade10-') ? 'grade10' : 'grade8');

function updateBook(bookId: BookId, fn: (b: BookProgress) => BookProgress) {
  set({ ...state, books: { ...state.books, [bookId]: fn(state.books[bookId]) } });
}

export const actions = {
  visit(key: TopicKey) {
    const bookId = bookOf(key);
    if (state.books[bookId].lastTopic === key && state.lastBook === bookId) return;
    set({ ...state, lastBook: bookId, books: { ...state.books, [bookId]: { ...state.books[bookId], lastTopic: key } } });
  },
  saveQuiz(key: TopicKey, result: QuizResult) {
    updateBook(bookOf(key), (b) => ({
      ...b,
      quizResults: { ...b.quizResults, [key]: result },
      completedTopics: b.completedTopics.includes(key) ? b.completedTopics : [...b.completedTopics, key],
    }));
  },
  toggleComplete(key: TopicKey) {
    updateBook(bookOf(key), (b) => ({
      ...b,
      completedTopics: b.completedTopics.includes(key) ? b.completedTopics.filter((k) => k !== key) : [...b.completedTopics, key],
    }));
  },
  setTheme(theme: ThemeMode) {
    set({ ...state, theme });
  },
  setAudio(audioEnabled: boolean) {
    set({ ...state, audioEnabled });
  },
  addHighlight(h: Highlight) {
    const dup = state.highlights.some(
      (x) => x.topicKey === h.topicKey && x.blockId === h.blockId && x.startOffset === h.startOffset && x.endOffset === h.endOffset,
    );
    if (!dup) set({ ...state, highlights: [...state.highlights, h] });
  },
  removeHighlight(id: string) {
    set({ ...state, highlights: state.highlights.filter((h) => h.id !== id) });
  },
};
