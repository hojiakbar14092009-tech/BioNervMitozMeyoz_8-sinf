import { beforeEach, describe, expect, it } from 'vitest';
import { actions, getState, migrate } from '../lib/store';

describe('progress & highlights storage', () => {
  beforeEach(() => {
    for (const h of getState().highlights) actions.removeHighlight(h.id);
  });

  it('keeps book progress separate', () => {
    actions.saveQuiz('grade8-39', { score: 9, total: 10, first: 8, retry: 1, revealed: 1, finishedAt: 1 });
    expect(getState().books.grade8.completedTopics).toContain('grade8-39');
    expect(getState().books.grade10.completedTopics).toHaveLength(0);
    actions.visit('grade10-2-8');
    expect(getState().lastBook).toBe('grade10');
    expect(getState().books.grade8.lastTopic).not.toBe('grade10-2-8');
  });

  it('stores highlights with book ids and rejects exact duplicates', () => {
    const base = { blockId: 'a-0', exactText: 'neyron', startOffset: 0, endOffset: 6, createdAt: 1 };
    actions.addHighlight({ ...base, id: 'h1', bookId: 'grade8', topicKey: 'grade8-39' });
    actions.addHighlight({ ...base, id: 'h2', bookId: 'grade8', topicKey: 'grade8-39' });
    actions.addHighlight({ ...base, id: 'h3', bookId: 'grade10', topicKey: 'grade10-2-8' });
    const hs = getState().highlights;
    expect(hs).toHaveLength(2);
    expect(hs.find((h) => h.topicKey === 'grade8-39')!.bookId).toBe('grade8');
    expect(hs.find((h) => h.topicKey === 'grade10-2-8')!.bookId).toBe('grade10');
  });

  it('migrates junk and drops cross-book mismatches', () => {
    expect(migrate(null).version).toBe(1);
    expect(migrate({ version: 99 }).highlights).toEqual([]);
    const m = migrate({
      version: 1,
      books: { grade8: { completedTopics: ['grade8-39', 'grade10-2-8'], quizResults: {}, lastTopic: 'grade10-2-8' }, grade10: {} },
      highlights: [{ id: 'x', bookId: 'grade10', topicKey: 'grade8-39' }],
    });
    expect(m.books.grade8.completedTopics).toEqual(['grade8-39']);
    expect(m.books.grade8.lastTopic).toBeNull();
    expect(m.highlights).toEqual([]);
  });
});
