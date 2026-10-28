import { describe, expect, it } from 'vitest';
import { freshQ, isCorrect, outcome, shuffled, submit, summarize } from '../features/quiz/logic';
import type { QuizQuestion } from '../types';

describe('quiz attempts', () => {
  it('correct on first try → locked, correct sound', () => {
    const r = submit(freshQ(), '1', true)!;
    expect(r.sound).toBe('correct');
    expect(r.state.status).toBe('correct');
    expect(outcome(r.state)).toBe('first');
    expect(submit(r.state, '2', false)).toBeNull();
  });

  it('wrong 1 → wrong1; wrong 2 → wrong2; neither reveals; wrong 3 → reveal (silent), no 4th try', () => {
    const a = submit(freshQ(), '0', false)!;
    expect(a.sound).toBe('wrong1');
    expect(a.state.status).toBe('open');
    const b = submit(a.state, '2', false)!;
    expect(b.sound).toBe('wrong2');
    expect(b.state.status).toBe('open');
    const c = submit(b.state, '3', false)!;
    expect(c.sound).toBeNull();
    expect(c.state.status).toBe('revealed');
    expect(submit(c.state, '1', true)).toBeNull();
  });

  it('correct after retry counts as retry', () => {
    const a = submit(freshQ(), '0', false)!;
    expect(outcome(submit(a.state, '1', true)!.state)).toBe('retry');
  });

  it('repeating the same wrong answer does not burn an attempt', () => {
    const a = submit(freshQ(), '0', false)!;
    expect(submit(a.state, '0', false)).toBeNull();
  });

  it('summarizes results', () => {
    const first = submit(freshQ(), '1', true)!.state;
    const retry = submit(submit(freshQ(), '0', false)!.state, '1', true)!.state;
    let rev = freshQ();
    for (const x of ['0', '2', '3']) rev = submit(rev, x, false)!.state;
    expect(summarize([first, retry, rev])).toMatchObject({ score: 2, total: 3, first: 1, retry: 1, revealed: 1 });
  });

  it('checks order answers and never starts shuffled lists solved', () => {
    const q: QuizQuestion = { id: 'x', bookId: 'grade8', topicKey: 'grade8-40', difficulty: 'easy', type: 'order', prompt: '', items: ['a', 'b', 'c'], explanation: '', sourcePage: 1, sourceConcept: '' };
    expect(isCorrect(q, ['a', 'b', 'c'].join('\u0001'))).toBe(true);
    expect(isCorrect(q, ['b', 'a', 'c'].join('\u0001'))).toBe(false);
    for (const seed of ['a', 'b', 'q1', 'g8-40-q09']) expect(shuffled(['a', 'b', 'c'], seed)).not.toEqual(['a', 'b', 'c']);
  });
});
