// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HL, HighlightArea, HighlightBar } from '../features/highlights/Highlights';
import { phrases, resolveRange, segments, tokenize, wordAt } from '../features/highlights/engine';
import { draftActions, draftCount } from '../features/highlights/draft';
import { actions, getState, migrate } from '../lib/store';
import { getTopic } from '../data/registry';
import HighlightsPage from '../pages/HighlightsPage';

const topic = getTopic('grade8-39')!;
const TEXT = 'Bosh miya nerv sistemasining markaziy qismidir.';
const OTHER = 'Nerv sistemasi organizmdagi barcha organlar faoliyatini boshqaradi.';

// jsdom has no layout: map a "point" to (block = clientY, character offset = clientX)
beforeAll(() => {
  // jsdom has no PointerEvent: a MouseEvent carrying pointerType is enough for the handlers
  window.PointerEvent ??= class extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  } as unknown as typeof PointerEvent;
  (document as Document & { caretRangeFromPoint: (x: number, y: number) => Range | null }).caretRangeFromPoint = (x, y) => {
    const block = document.querySelectorAll('[data-hl-block]')[y];
    if (!block) return null;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let left = x;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.textContent!.length;
      if (left <= len) {
        const r = document.createRange();
        r.setStart(n, left);
        return r;
      }
      left -= len;
    }
    return null;
  };
});
afterEach(() => {
  cleanup();
  act(() => draftActions.clear());
  actions.removeHighlights(getState().highlights.map((h) => h.id));
  vi.restoreAllMocks();
});

function Lesson({ router = true }: { router?: boolean }) {
  const body = (
    <>
      <HighlightArea topic={topic}>
        <HL topic={topic} blockId="t-0" text={TEXT} />
        <HL topic={topic} blockId="t-1" text={OTHER} />
      </HighlightArea>
      <HighlightBar topic={topic} />
    </>
  );
  return router ? <MemoryRouter>{body}</MemoryRouter> : body;
}
/** Double-click the word that starts at `word` in block `block`. */
const dbl = (word: string, block = 0) => {
  const text = block ? OTHER : TEXT;
  fireEvent.doubleClick(document.querySelectorAll('[data-hl-block]')[block], { clientX: text.indexOf(word) + 1, clientY: block });
};
const drafts = () => [...document.querySelectorAll('.hl-draft')].map((e) => e.textContent);
const belgilash = () => screen.queryByRole('button', { name: /Belgilash/ });

describe('multi-word highlight selection', () => {
  it('1–3: double-click adds a word and shows Belgilash; more words accumulate; again removes', () => {
    render(<Lesson />);
    expect(belgilash()).toBeNull();
    dbl('Bosh');
    expect(drafts()).toEqual(['Bosh']);
    expect(screen.getByText('1 ta so‘z tanlandi')).toBeTruthy();
    expect(belgilash()).toBeTruthy();
    dbl('miya');
    dbl('markaziy');
    dbl('organlar', 1); // another paragraph keeps the earlier words
    expect(drafts()).toEqual(['Bosh', 'miya', 'markaziy', 'organlar']);
    expect(screen.getByText('4 ta so‘z tanlandi')).toBeTruthy();
    dbl('miya');
    expect(drafts()).toEqual(['Bosh', 'markaziy', 'organlar']);
    // the bar is application state: a collapsed browser selection does not hide it
    window.getSelection()?.removeAllRanges();
    fireEvent(document, new Event('selectionchange'));
    expect(belgilash()).toBeTruthy();
  });

  it('4–6: Belgilash saves one batch — adjacent words merge, gaps stay separate — and Belgilanganlar updates', () => {
    render(<Lesson />);
    for (const w of ['Bosh', 'miya', 'markaziy']) dbl(w);
    dbl('Nerv', 1);
    dbl('organlar', 1);
    fireEvent.click(belgilash()!);
    expect(belgilash()).toBeNull();
    expect(drafts()).toEqual([]);
    const hs = getState().highlights;
    expect(hs.map((h) => h.exactText)).toEqual(['Bosh miya', 'markaziy', 'Nerv', 'organlar']);
    expect(new Set(hs.map((h) => h.groupId)).size).toBe(1);
    expect([...document.querySelectorAll('mark.hl')].map((m) => m.textContent)).toEqual(['Bosh miya', 'markaziy', 'Nerv', 'organlar']);
    cleanup();
    render(<MemoryRouter><HighlightsPage /></MemoryRouter>);
    expect(document.querySelectorAll('.hl-item')).toHaveLength(1); // one saved group …
    expect(document.querySelectorAll('.hl-item mark')).toHaveLength(4); // … with its four segments, not joined
    expect(screen.getByRole('link', { name: /Mavzuga qaytish/ }).getAttribute('href')).toBe(`/8-sinf/39#hl-${hs[0].id}`);
  });

  it('7–9: saved highlights survive a reload, render at the exact spot, and deleting on Belgilanganlar clears the lesson', () => {
    render(<Lesson />);
    dbl('sistemasining');
    fireEvent.click(belgilash()!);
    const persisted = migrate(JSON.parse(JSON.stringify(getState()))); // what a refresh reads back
    expect(persisted.highlights.map((h) => h.exactText)).toEqual(['sistemasining']);
    cleanup();
    render(
      <MemoryRouter>
        <Lesson router={false} />
        <HighlightsPage />
      </MemoryRouter>,
    );
    const id = getState().highlights[0].id;
    expect(document.getElementById(`hl-${id}`)?.textContent).toBe('sistemasining'); // return-to-source target
    fireEvent.click(screen.getByRole('button', { name: 'O‘chirish' }));
    expect(document.querySelector('mark.hl')).toBeNull();
  });

  it('a word inside a saved highlight is not selected again (no duplicate, no nested marks)', () => {
    render(<Lesson />);
    dbl('Bosh');
    dbl('miya');
    fireEvent.click(belgilash()!);
    dbl('miya');
    expect(draftCount()).toBe(0);
    expect(screen.getByRole('button', { name: 'Belgini o‘chirish' })).toBeTruthy();
    expect(document.querySelector('mark mark, mark .hl-draft')).toBeNull();
  });

  it('keeps the selection and reports an error when storage refuses the write', () => {
    render(<Lesson />);
    dbl('Bosh');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    fireEvent.click(belgilash()!);
    expect(getState().highlights).toEqual([]);
    expect(drafts()).toEqual(['Bosh']);
    expect(belgilash()).toBeTruthy();
  });

  it('leaving the lesson discards the unsaved selection, never saved highlights', () => {
    const { unmount } = render(<Lesson />);
    dbl('Bosh');
    actions.addHighlight({ id: 'keep', bookId: 'grade8', topicKey: 'grade8-39', blockId: 't-1', exactText: 'Nerv', startOffset: 0, endOffset: 4, createdAt: 1 });
    unmount();
    expect(draftCount()).toBe(0);
    expect(getState().highlights.map((h) => h.id)).toEqual(['keep']);
  });

  it('touch: two taps on the same word within the threshold select it; slow taps or a moving finger do not', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    render(<Lesson />);
    const block = document.querySelector('[data-hl-block]')!;
    const tap = (x: number, moveBy = 0) => {
      fireEvent.pointerDown(block, { pointerType: 'touch', clientX: x, clientY: 0 });
      fireEvent.pointerUp(block, { pointerType: 'touch', clientX: x + moveBy, clientY: 0 });
    };
    const at = TEXT.indexOf('nerv') + 1;
    tap(at);
    vi.setSystemTime(Date.now() + 600);
    tap(at);
    expect(drafts()).toEqual([]); // too slow
    vi.setSystemTime(Date.now() + 200);
    tap(at);
    expect(drafts()).toEqual(['nerv']);
    vi.setSystemTime(Date.now() + 1000);
    tap(at, 40); // a scroll gesture, not a tap
    vi.setSystemTime(Date.now() + 100);
    tap(at, 40);
    expect(drafts()).toEqual(['nerv']);
    vi.useRealTimers();
  });
});

describe('highlight engine', () => {
  it('tokenizes Uzbek words with o‘/g‘, apostrophes, hyphens and numbers; punctuation is not a word', () => {
    const t = 'U organlar ishini o‘zaro moslashtiradi; ta’sirlarini, sut-kislota va 2n2c — neyron, g‘oya.';
    const words = tokenize(t).map((k) => t.slice(k.start, k.end));
    expect(words).toEqual(['U', 'organlar', 'ishini', 'o‘zaro', 'moslashtiradi', 'ta’sirlarini', 'sut-kislota', 'va', '2n2c', 'neyron', 'g‘oya']);
    expect(t.slice(...Object.values(tokenize(t)[wordAt(t, t.indexOf('neyron,') + 6)]) as [number, number])).toBe('neyron');
    expect(wordAt(t, t.indexOf('—'))).toBe(-1);
  });

  it('merges consecutive words into phrases and keeps gaps (positions 1–3, 7–8, 12)', () => {
    const t = 'a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12';
    expect(phrases(t, [12, 2, 1, 8, 3, 7]).map((p) => p.exactText)).toEqual(['a1 a2 a3', 'a7 a8', 'a12']);
  });

  it('restores the exact occurrence of repeated text by its context, not the first match', () => {
    const t = 'Nerv sistemasi signal beradi; orqa miya nerv sistemasi bilan bog‘liq.';
    const second = t.lastIndexOf('nerv sistemasi');
    const saved = { startOffset: second, endOffset: second + 14, exactText: 'nerv sistemasi', prefix: 'orqa miya ', suffix: ' bilan' };
    expect(resolveRange(t, saved)).toEqual({ start: second, end: second + 14 });
    const shifted = 'Yangi gap. ' + t; // offsets drift: context still picks the second occurrence
    expect(resolveRange(shifted, saved)).toEqual({ start: second + 11, end: second + 25 });
  });

  it('never nests a draft word inside a saved mark', () => {
    const p = segments('abc def ghi', [{ start: 0, end: 7, id: 's' }], [{ start: 4, end: 7 }, { start: 8, end: 11 }]);
    expect(p).toEqual([{ text: 'abc def', id: 's' }, { text: ' ' }, { text: 'ghi', draft: true }]);
  });

  it('10: highlights saved before multi-word selection migrate unchanged and show as their own items', () => {
    const old = { id: 'old1', bookId: 'grade8' as const, topicKey: 'grade8-39' as const, blockId: 't-0', exactText: 'miya', startOffset: 5, endOffset: 9, createdAt: 5 };
    const state = migrate({ version: 1, books: {}, highlights: [old, { ...old, id: 'bad', exactText: 3 }] });
    expect(state.highlights).toEqual([old]);
    actions.addHighlight(old);
    render(<MemoryRouter><HighlightsPage /></MemoryRouter>);
    expect(document.querySelectorAll('.hl-item')).toHaveLength(1);
    expect(screen.getByText('miya')).toBeTruthy();
  });
});
