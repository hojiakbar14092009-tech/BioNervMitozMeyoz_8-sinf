import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Topic } from '../../types';
import { actions, useAppState } from '../../lib/store';

/** Splits text into plain/marked segments; overlapping ranges are merged. */
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

export function HL({ topic, blockId, text, as: Tag = 'p' }: { topic: Topic; blockId: string; text: string; as?: 'p' | 'li' | 'span' }) {
  const hs = useAppState((s) => s.highlights);
  const mine = hs
    .filter((h) => h.bookId === topic.bookId && h.topicKey === topic.key && h.blockId === blockId && h.exactText === text.slice(h.startOffset, h.endOffset))
    .map((h) => ({ start: h.startOffset, end: h.endOffset, id: h.id }));
  return (
    <Tag data-hl-block={blockId}>
      {segments(text, mine).map((seg, i) =>
        seg.id ? (
          <mark key={i} data-hl-id={seg.id} className="hl">
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

/** Wraps lesson content; shows a “Belgilash” action for a selection inside one text block. */
export function HighlightArea({ topic, children }: { topic: Topic; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ x: number; y: number; blockId: string; start: number; end: number; text: string } | null>(null);
  const [remove, setRemove] = useState<{ x: number; y: number; id: string } | null>(null);

  const read = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !ref.current) return setPending(null);
    const range = sel.getRangeAt(0);
    const a = (range.startContainer.parentElement ?? null)?.closest('[data-hl-block]');
    const b = (range.endContainer.parentElement ?? null)?.closest('[data-hl-block]');
    if (!a || a !== b || !ref.current.contains(a)) return setPending(null);
    const start = offsetWithin(a, range.startContainer, range.startOffset);
    const end = offsetWithin(a, range.endContainer, range.endOffset);
    const full = a.textContent ?? '';
    const text = full.slice(start, end);
    if (!text.trim()) return setPending(null);
    const rect = range.getBoundingClientRect();
    const host = ref.current.getBoundingClientRect();
    setPending({ x: rect.left + rect.width / 2 - host.left, y: rect.bottom - host.top + 8, blockId: a.getAttribute('data-hl-block')!, start, end, text });
  }, []);

  useEffect(() => {
    let t = 0;
    const onSel = () => {
      window.clearTimeout(t);
      t = window.setTimeout(read, 250); // debounce — mobile selection handles fire continuously
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
  };

  const onClick = (e: React.MouseEvent) => {
    const m = (e.target as HTMLElement).closest('mark[data-hl-id]');
    if (!m || !ref.current) return setRemove(null);
    const r = m.getBoundingClientRect();
    const host = ref.current.getBoundingClientRect();
    setRemove({ x: r.left + r.width / 2 - host.left, y: r.bottom - host.top + 8, id: m.getAttribute('data-hl-id')! });
  };

  return (
    <div ref={ref} className="hl-area" onClick={onClick}>
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
          }}
        >
          Belgini o‘chirish
        </button>
      )}
    </div>
  );
}
