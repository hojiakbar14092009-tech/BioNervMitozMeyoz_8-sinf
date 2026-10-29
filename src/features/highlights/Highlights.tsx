import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Highlight, Topic } from '../../types';
import { actions, useAppState } from '../../lib/store';
import { toast } from '../../lib/toast';

/** Splits text into plain/marked segments; overlapping ranges are merged (each keeps its own record). */
export function segments(text: string, ranges: { start: number; end: number; id: string }[]) {
  const sorted = [...ranges].filter((r) => r.end > r.start && r.end <= text.length).sort((a, b) => a.start - b.start);
  const out: { text: string; id?: string }[] = [];
  let pos = 0;
  for (const r of sorted) {
    const start = Math.max(r.start, pos);
    if (start >= r.end) continue;
    if (start > pos) out.push({ text: text.slice(pos, start) });
    out.push({ text: text.slice(start, r.end), id: r.id });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Offsets first; if the lesson text shifted, re-anchor by the saved exact text. Null = not in this block. */
export function resolveRange(text: string, h: Pick<Highlight, 'startOffset' | 'endOffset' | 'exactText'>) {
  if (text.slice(h.startOffset, h.endOffset) === h.exactText) return { start: h.startOffset, end: h.endOffset };
  const at = text.indexOf(h.exactText);
  return at >= 0 ? { start: at, end: at + h.exactText.length } : null;
}

export function HL({ topic, blockId, text, as: Tag = 'p' }: { topic: Topic; blockId: string; text: string; as?: 'p' | 'li' | 'span' }) {
  const hs = useAppState((s) => s.highlights);
  const mine = hs.flatMap((h) => {
    if (h.bookId !== topic.bookId || h.topicKey !== topic.key || h.blockId !== blockId) return [];
    const r = resolveRange(text, h);
    return r ? [{ ...r, id: h.id }] : [];
  });
  return (
    <Tag data-hl-block={blockId}>
      {segments(text, mine).map((seg, i) =>
        seg.id ? (
          <mark key={i} id={`hl-${seg.id}`} data-hl-id={seg.id} className="hl" tabIndex={0} aria-label={`Belgilangan: ${seg.text}`}>
            {seg.text}
          </mark>
        ) : (
          seg.text
        ),
      )}
    </Tag>
  );
}

function offsetWithin(block: Element, node: Node, offset: number) {
  const r = document.createRange();
  r.selectNodeContents(block);
  r.setEnd(node, offset);
  return r.toString().length;
}

const POP_W = 150; // keep the action button fully on screen at 320px

/** Wraps readable lesson text; shows “Belgilash” for a selection inside a single text block only. */
export function HighlightArea({ topic, children }: { topic: Topic; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ x: number; y: number; blockId: string; start: number; end: number; text: string } | null>(null);
  const [remove, setRemove] = useState<{ x: number; y: number; id: string } | null>(null);

  const place = (rect: DOMRect) => {
    const host = ref.current!.getBoundingClientRect();
    const half = POP_W / 2;
    const x = Math.min(Math.max(rect.left + rect.width / 2, host.left + half, half + 8), Math.min(host.right, window.innerWidth) - half - 8) - host.left;
    return { x, y: rect.bottom - host.top + 10 };
  };

  const read = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !ref.current) return setPending(null);
    const range = sel.getRangeAt(0);
    const a = range.startContainer.parentElement?.closest('[data-hl-block]');
    const b = range.endContainer.parentElement?.closest('[data-hl-block]');
    if (!a || a !== b || !ref.current.contains(a)) return setPending(null);
    const start = offsetWithin(a, range.startContainer, range.startOffset);
    const end = offsetWithin(a, range.endContainer, range.endOffset);
    const text = (a.textContent ?? '').slice(start, end);
    if (!text.trim()) return setPending(null);
    setRemove(null);
    setPending({ ...place(range.getBoundingClientRect()), blockId: a.getAttribute('data-hl-block')!, start, end, text });
  }, []);

  useEffect(() => {
    let t = 0;
    const onSel = () => {
      window.clearTimeout(t);
      t = window.setTimeout(read, 250); // mobile selection handles fire continuously
    };
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      window.clearTimeout(t);
    };
  }, [read]);

  const save = () => {
    if (!pending) return;
    actions.addHighlight({
      id: `${topic.key}-${Date.now().toString(36)}`,
      bookId: topic.bookId,
      topicKey: topic.key,
      blockId: pending.blockId,
      exactText: pending.text,
      startOffset: pending.start,
      endOffset: pending.end,
      createdAt: Date.now(),
    });
    window.getSelection()?.removeAllRanges();
    setPending(null);
    toast('Belgilanganlarga saqlandi', { to: '/belgilanganlar', label: 'Ko‘rish' });
  };

  const openRemove = (m: Element) => setRemove({ ...place(m.getBoundingClientRect()), id: m.getAttribute('data-hl-id')! });

  return (
    <div
      ref={ref}
      className="hl-area"
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
      {pending && (
        <button type="button" className="hl-pop btn btn-primary" style={{ left: pending.x, top: pending.y }} onMouseDown={(e) => e.preventDefault()} onClick={save}>
          ✎ Belgilash
        </button>
      )}
      {remove && !pending && (
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
