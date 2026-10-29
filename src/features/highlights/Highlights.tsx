import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Highlight, Topic } from '../../types';
import { actions, getState, useAppState } from '../../lib/store';
import { toast } from '../../lib/toast';
import { phrases, resolveRange, segments, tokenize, wordAt } from './engine';
import { draftActions, draftWords, getDraft, useDraftCount, useDraftKey } from './draft';

/** Saved highlights of one block, re-anchored to its current text. */
function savedIn(all: Highlight[], topic: Topic, blockId: string, text: string) {
  return all.flatMap((h) => {
    if (h.bookId !== topic.bookId || h.topicKey !== topic.key || h.blockId !== blockId) return [];
    const r = resolveRange(text, h);
    return r ? [{ ...r, id: h.id }] : [];
  });
}

/** A readable lesson text block: saved highlights (amber marks) and the unsaved word selection (outlined). */
export function HL({ topic, blockId, text, as: Tag = 'p' }: { topic: Topic; blockId: string; text: string; as?: 'p' | 'li' | 'span' }) {
  const hs = useAppState((s) => s.highlights);
  const draftKey = useDraftKey(topic.key, blockId);
  const pieces = useMemo(() => {
    const toks = tokenize(text);
    const draft = draftKey ? draftKey.split(',').map((i) => toks[+i]).filter(Boolean) : [];
    return segments(text, savedIn(hs, topic, blockId, text), draft);
  }, [hs, topic, blockId, text, draftKey]);
  return (
    <Tag data-hl-block={blockId}>
      {pieces.map((seg, i) =>
        seg.id ? (
          <mark key={i} id={`hl-${seg.id}`} data-hl-id={seg.id} className="hl" tabIndex={0} aria-label={`Belgilangan: ${seg.text}`}>
            {seg.text}
          </mark>
        ) : seg.draft ? (
          <span key={i} className="hl-draft">
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </Tag>
  );
}

/** Character offset of (node, offset) inside a block's text. */
function offsetWithin(block: Element, node: Node, offset: number) {
  const r = document.createRange();
  r.selectNodeContents(block);
  r.setEnd(node, offset);
  return r.toString().length;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

const POP_W = 150; // keep the action button fully on screen at 320px
const DOUBLE_TAP_MS = 350;
const TAP_SLOP = 10; // px a finger may drift between down and up and still count as a tap

/**
 * Wraps readable lesson text. Double-click (desktop) or double-tap (touch) on a word adds it to the unsaved
 * selection or removes it; on a saved highlight it offers removal instead of duplicating it.
 */
export function HighlightArea({ topic, children }: { topic: Topic; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [remove, setRemove] = useState<{ x: number; y: number; id: string } | null>(null);
  const lastTouch = useRef(0);
  const down = useRef<{ x: number; y: number } | null>(null);
  const tap = useRef<{ blockId: string; word: number; t: number } | null>(null);

  const place = (rect: DOMRect) => {
    const host = ref.current!.getBoundingClientRect();
    const half = POP_W / 2;
    const x = Math.min(Math.max(rect.left + rect.width / 2, host.left + half, half + 8), Math.min(host.right, window.innerWidth) - half - 8) - host.left;
    return { x, y: rect.bottom - host.top + 10 };
  };
  const openRemove = (m: Element) => setRemove({ ...place(m.getBoundingClientRect()), id: m.getAttribute('data-hl-id')! });

  /** The lesson word under a screen point, if any. */
  const hit = (x: number, y: number) => {
    const c = caretAt(x, y);
    const el = (c?.node.nodeType === Node.TEXT_NODE ? c.node.parentElement : (c?.node as Element | undefined))?.closest('[data-hl-block]');
    if (!c || !el || !ref.current?.contains(el)) return null;
    const text = el.textContent ?? '';
    const word = wordAt(text, offsetWithin(el, c.node, c.offset));
    return word < 0 ? null : { blockId: el.getAttribute('data-hl-block')!, text, word };
  };

  const pick = (h: { blockId: string; text: string; word: number }) => {
    const t = tokenize(h.text)[h.word];
    const saved = savedIn(getState().highlights, topic, h.blockId, h.text).find((s) => t.start < s.end && t.end > s.start);
    window.getSelection()?.removeAllRanges();
    if (saved) {
      const m = document.getElementById(`hl-${saved.id}`);
      if (m) openRemove(m);
      return;
    }
    setRemove(null);
    draftActions.toggle(topic.key, h.blockId, h.text, h.word);
  };

  return (
    <div
      ref={ref}
      className="hl-area"
      onMouseDown={(e) => {
        // a double-click should not paint the browser's own word selection on top of ours
        if (e.detail >= 2 && (e.target as HTMLElement).closest('[data-hl-block]')) e.preventDefault();
      }}
      onDoubleClick={(e) => {
        if (Date.now() - lastTouch.current < 800) return; // already handled as a double-tap
        const h = hit(e.clientX, e.clientY);
        if (h) pick(h);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') return;
        lastTouch.current = Date.now();
        const d = down.current;
        down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP) return (tap.current = null), undefined; // a scroll, not a tap
        const h = hit(e.clientX, e.clientY);
        if (!h) return (tap.current = null), undefined;
        const prev = tap.current;
        if (prev && prev.blockId === h.blockId && prev.word === h.word && Date.now() - prev.t < DOUBLE_TAP_MS) {
          tap.current = null;
          pick(h);
        } else tap.current = { blockId: h.blockId, word: h.word, t: Date.now() };
      }}
      onClick={(e) => {
        const m = (e.target as HTMLElement).closest('mark[data-hl-id]');
        if (m && ref.current) openRemove(m);
        else setRemove(null);
      }}
      onKeyDown={(e) => {
        const m = (e.target as HTMLElement).closest('mark[data-hl-id]');
        if (m && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openRemove(m);
        }
      }}
    >
      {children}
      {remove && (
        <button
          type="button"
          className="hl-pop btn"
          style={{ left: remove.x, top: remove.y }}
          onClick={(e) => {
            e.stopPropagation();
            actions.removeHighlight(remove.id);
            setRemove(null);
            toast('Belgi olib tashlandi');
          }}
        >
          Belgini o‘chirish
        </button>
      )}
    </div>
  );
}

/**
 * The action bar for the unsaved selection (one per lesson page, portalled to <body> so no card or 3D container
 * clips it). Visible exactly while words are selected. Also folds drag / keyboard text selections into the draft.
 */
export function HighlightBar({ topic }: { topic: Topic }) {
  const count = useDraftCount(topic.key);

  // leaving the lesson drops the unsaved selection; saved highlights are untouched
  useEffect(() => () => draftActions.clear(), [topic.key]);

  useEffect(() => {
    let collapsed = true;
    let anchor: [Node | null, number] = [null, 0];
    let t = 0;
    const read = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const blocks = [...document.querySelectorAll('.hl-area [data-hl-block]')].filter((b) => range.intersectsNode(b));
      if (!blocks.length) return;
      // a new selection (it collapsed in between, or it starts somewhere else): keep what the previous one chose;
      // extending the same selection only replaces the live part
      if (collapsed || sel.anchorNode !== anchor[0] || sel.anchorOffset !== anchor[1]) draftActions.commitNative();
      collapsed = false;
      anchor = [sel.anchorNode, sel.anchorOffset];
      const all = getState().highlights;
      draftActions.setNative(
        topic.key,
        blocks.map((b) => {
          const text = b.textContent ?? '';
          const blockId = b.getAttribute('data-hl-block')!;
          const saved = savedIn(all, topic, blockId, text);
          const toks = tokenize(text);
          return {
            blockId,
            text,
            start: b.contains(range.startContainer) ? offsetWithin(b, range.startContainer, range.startOffset) : 0,
            end: b.contains(range.endContainer) ? offsetWithin(b, range.endContainer, range.endOffset) : text.length,
            exclude: (w: number) => saved.some((s) => toks[w].start < s.end && toks[w].end > s.start),
          };
        }),
      );
    };
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) collapsed = true; // immediately, so a quick new drag is recognised as new
      window.clearTimeout(t);
      t = window.setTimeout(read, 120);
    };
    // when a drag or keyboard selection ends, take it at once: the next click may collapse it before the timer
    const flush = () => {
      window.clearTimeout(t);
      read();
    };
    document.addEventListener('selectionchange', onSel);
    document.addEventListener('pointerup', flush);
    document.addEventListener('keyup', flush);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('pointerup', flush);
      document.removeEventListener('keyup', flush);
      window.clearTimeout(t);
    };
  }, [topic]);

  const save = () => {
    const d = getDraft();
    if (d.topicKey !== topic.key) return;
    const order = [...document.querySelectorAll('[data-hl-block]')].map((b) => b.getAttribute('data-hl-block'));
    const now = Date.now();
    const groupId = `${topic.key}-${now.toString(36)}`;
    const records: Highlight[] = Object.entries(d.blocks)
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .flatMap(([blockId, b]) => phrases(b.text, draftWords(b)).map((p) => ({ blockId, ...p })))
      .map((p, i) => ({
        id: `${groupId}-${i}`,
        groupId,
        bookId: topic.bookId,
        topicKey: topic.key,
        blockId: p.blockId,
        exactText: p.exactText,
        startOffset: p.start,
        endOffset: p.end,
        prefix: p.prefix,
        suffix: p.suffix,
        createdAt: now,
      }));
    if (!records.length) return;
    // only clear the selection once storage has accepted it
    if (!actions.addHighlights(records)) return toast('Saqlab bo‘lmadi. Tanlov saqlanib qoldi — qayta urinib ko‘ring.');
    draftActions.clear();
    window.getSelection()?.removeAllRanges();
    toast('Belgilanganlarga saqlandi', { to: '/belgilanganlar', label: 'Ko‘rish' });
  };

  if (!count) return null;
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault(); // pressing must not collapse a native selection first
  return createPortal(
    <div className="hl-bar" role="region" aria-label="Tanlangan so‘zlar">
      <span className="hl-bar-count" aria-live="polite">
        {count} ta so‘z tanlandi
      </span>
      <div className="hl-bar-actions">
        <button
          type="button"
          className="btn"
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={() => {
            draftActions.clear();
            window.getSelection()?.removeAllRanges();
          }}
        >
          Bekor qilish
        </button>
        <button type="button" className="btn btn-primary" onPointerDown={keep} onMouseDown={keep} onClick={save}>
          ✎ Belgilash
        </button>
      </div>
    </div>,
    document.body,
  );
}
