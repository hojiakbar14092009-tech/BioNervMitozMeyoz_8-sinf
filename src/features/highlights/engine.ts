import type { Highlight } from '../../types';

/** A word in a lesson block: [start, end) character offsets into the block's text. */
export interface Token {
  start: number;
  end: number;
}

// Uzbek letters o‘/g‘ and loanwords use ‘ ’ ' ʻ ʼ `; hyphenated terms (sut-kislota) stay one word.
const JOINER = /[‘’'ʻʼ`-]/;
const WORD = /[\p{L}\p{N}]+(?:[‘’'ʻʼ`-][\p{L}\p{N}]+)*/gu;
const cache = new Map<string, Token[]>();

/** Unicode-aware word tokens (Intl.Segmenter where available, regex fallback). Memoised per text. */
export function tokenize(text: string): Token[] {
  const hit = cache.get(text);
  if (hit) return hit;
  let toks: Token[] = [];
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    for (const s of new Seg('uz', { granularity: 'word' }).segment(text)) {
      if (!s.isWordLike) continue;
      const t = { start: s.index, end: s.index + s.segment.length };
      const prev = toks[toks.length - 1];
      // the segmenter may split "o‘zgaradi" at the apostrophe or "sut-kislota" at the hyphen: rejoin
      if (prev && t.start === prev.end + 1 && JOINER.test(text[prev.end])) prev.end = t.end;
      else toks.push(t);
    }
  } else toks = [...text.matchAll(WORD)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
  cache.set(text, toks);
  return toks;
}

/** Index of the word at a character offset (a caret right after a word still counts), or -1. */
export function wordAt(text: string, offset: number) {
  const toks = tokenize(text);
  const inside = toks.findIndex((t) => offset >= t.start && offset < t.end);
  return inside >= 0 ? inside : toks.findIndex((t) => offset === t.end);
}

/** Indices of words overlapping [start, end). */
export function wordsIn(text: string, start: number, end: number) {
  return tokenize(text).flatMap((t, i) => (t.end > start && t.start < end ? [i] : []));
}

const CONTEXT = 24;
/** Consecutive word indices become one phrase (the text between them included); gaps stay separate segments. */
export function phrases(text: string, idx: number[]) {
  const toks = tokenize(text);
  const sorted = [...new Set(idx)].filter((i) => toks[i]).sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const i of sorted) {
    const run = runs[runs.length - 1];
    if (run && i === run[run.length - 1] + 1) run.push(i);
    else runs.push([i]);
  }
  return runs.map((run) => {
    const start = toks[run[0]].start;
    const end = toks[run[run.length - 1]].end;
    return { start, end, exactText: text.slice(start, end), prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) };
  });
}

/**
 * Where a saved highlight sits in the block now. Offsets first; if the text shifted, re-anchor by exact text,
 * choosing among repeated occurrences by prefix/suffix context, then by nearness to the old offset. Null = gone.
 */
export function resolveRange(text: string, h: Pick<Highlight, 'startOffset' | 'endOffset' | 'exactText' | 'prefix' | 'suffix'>) {
  if (text.slice(h.startOffset, h.endOffset) === h.exactText) return { start: h.startOffset, end: h.endOffset };
  const hits: number[] = [];
  for (let at = text.indexOf(h.exactText); at >= 0; at = text.indexOf(h.exactText, at + 1)) hits.push(at);
  if (!hits.length) return null;
  const score = (at: number) =>
    (h.prefix && text.slice(Math.max(0, at - h.prefix.length), at) === h.prefix ? 2 : 0) +
    (h.suffix && text.slice(at + h.exactText.length, at + h.exactText.length + h.suffix.length) === h.suffix ? 2 : 0) -
    Math.abs(at - h.startOffset) / (text.length + 1);
  const at = hits.reduce((best, x) => (score(x) > score(best) ? x : best));
  return { start: at, end: at + h.exactText.length };
}

export type Piece = { text: string; id?: string; draft?: boolean };
/**
 * Splits a block into plain / saved / draft pieces with no overlaps (saved wins), so marks never nest.
 * Overlapping saved ranges are merged into the earlier mark (each keeps its own record).
 */
export function segments(text: string, saved: { start: number; end: number; id: string }[], draft: Token[] = []) {
  const ranges = [
    ...saved.filter((r) => r.end > r.start && r.end <= text.length),
    ...draft.filter((d) => !saved.some((s) => d.start < s.end && d.end > s.start)).map((d) => ({ ...d, draft: true as const })),
  ].sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  let pos = 0;
  for (const r of ranges) {
    const start = Math.max(r.start, pos);
    if (start >= r.end || ('draft' in r && start > r.start)) continue;
    if (start > pos) out.push({ text: text.slice(pos, start) });
    out.push('draft' in r ? { text: text.slice(start, r.end), draft: true } : { text: text.slice(start, r.end), id: r.id });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
