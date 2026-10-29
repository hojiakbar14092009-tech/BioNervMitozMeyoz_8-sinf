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
    // records saved before multi-word selection have no groupId/prefix/suffix: they stay valid as single-segment groups
    highlights: Array.isArray(r.highlights)
      ? r.highlights.filter((h) => h && h.topicKey?.startsWith(`${h.bookId}-`) && typeof h.exactText === 'string' && Number.isFinite(h.startOffset) && Number.isFinite(h.endOffset))
      : [],
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
    return actions.addHighlights([h]);
  },
  /**
   * Saves one “Belgilash” batch in a single write. Returns false — and changes nothing — if storage refuses
   * the write, so the caller can keep the learner's selection and offer a retry.
   */
  addHighlights(list: Highlight[]) {
    const same = (a: Highlight, b: Highlight) => a.topicKey === b.topicKey && a.blockId === b.blockId && a.startOffset === b.startOffset && a.endOffset === b.endOffset;
    const fresh = list.filter((h, i) => !state.highlights.some((x) => same(x, h)) && list.findIndex((y) => same(y, h)) === i);
    if (!fresh.length) return true;
    const next = { ...state, highlights: [...state.highlights, ...fresh] };
    let storage: Storage | undefined;
    try {
      storage = globalThis.localStorage;
    } catch {
      // access itself blocked: like the rest of the app, keep in memory
    }
    try {
      storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      return false; // storage exists but refused the write (e.g. quota full)
    }
    state = next;
    listeners.forEach((l) => l());
    return true;
  },
  removeHighlight(id: string) {
    actions.removeHighlights([id]);
  },
  removeHighlights(ids: string[]) {
    set({ ...state, highlights: state.highlights.filter((h) => !ids.includes(h.id)) });
  },
};
