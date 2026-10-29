import { useSyncExternalStore } from 'react';
import { wordsIn } from './engine';

/**
 * The learner's unsaved selection (never persisted). Words picked by double-click / double-tap accumulate in
 * `picked`; `native` mirrors the latest drag / keyboard text selection so adjusting its handles replaces it,
 * and it is folded into `picked` as soon as a new selection starts. The action bar shows whenever the union is
 * non-empty, independent of the browser's selection.
 */
export interface DraftBlock {
  text: string;
  picked: number[];
  native: number[];
}
interface Draft {
  topicKey: string | null;
  blocks: Record<string, DraftBlock>;
}

let draft: Draft = { topicKey: null, blocks: {} };
const listeners = new Set<() => void>();
const emit = (next: Draft) => {
  draft = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const union = (b: DraftBlock) => [...new Set([...b.picked, ...b.native])].sort((x, y) => x - y);
const forTopic = (topicKey: string) => (draft.topicKey === topicKey ? draft.blocks : {});

export const draftWords = (b: DraftBlock) => union(b);
export const getDraft = () => draft;
export const draftCount = () => Object.values(draft.blocks).reduce((n, b) => n + union(b).length, 0);

export const draftActions = {
  /** Double-click / double-tap: add the word, or remove it if it is already selected. */
  toggle(topicKey: string, blockId: string, text: string, word: number) {
    const blocks = { ...forTopic(topicKey) };
    const b = blocks[blockId] ?? { text, picked: [], native: [] };
    const on = b.picked.includes(word) || b.native.includes(word);
    blocks[blockId] = on
      ? { text, picked: b.picked.filter((w) => w !== word), native: b.native.filter((w) => w !== word) }
      : { text, picked: [...b.picked, word], native: b.native };
    emit({ topicKey, blocks });
  },
  /** Mirror the live native selection (per block character range); words already picked stay picked. */
  setNative(topicKey: string, ranges: { blockId: string; text: string; start: number; end: number; exclude: (w: number) => boolean }[]) {
    const blocks: Record<string, DraftBlock> = {};
    for (const [id, b] of Object.entries(forTopic(topicKey))) blocks[id] = { ...b, native: [] };
    for (const r of ranges) {
      const b = blocks[r.blockId] ?? { text: r.text, picked: [], native: [] };
      blocks[r.blockId] = { ...b, text: r.text, native: wordsIn(r.text, r.start, r.end).filter((w) => !r.exclude(w)) };
    }
    emit({ topicKey, blocks });
  },
  /** A new native selection is starting: keep what the previous one selected. */
  commitNative() {
    const blocks: Record<string, DraftBlock> = {};
    for (const [id, b] of Object.entries(draft.blocks)) blocks[id] = { text: b.text, picked: union(b), native: [] };
    emit({ ...draft, blocks });
  },
  clear() {
    if (draft.topicKey !== null || Object.keys(draft.blocks).length) emit({ topicKey: null, blocks: {} });
  },
};

/** Selected word indices for one block, as a stable string (blocks re-render only when their own words change). */
export function useDraftKey(topicKey: string, blockId: string) {
  return useSyncExternalStore(subscribe, () => {
    const b = draft.topicKey === topicKey ? draft.blocks[blockId] : undefined;
    return b ? union(b).join(',') : '';
  });
}

export function useDraftCount(topicKey: string) {
  return useSyncExternalStore(subscribe, () => (draft.topicKey === topicKey ? draftCount() : 0));
}
