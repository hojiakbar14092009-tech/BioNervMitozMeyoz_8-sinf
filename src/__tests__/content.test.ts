import { describe, expect, it } from 'vitest';
import { books } from '../data/books';
import { getNeighbours, getTopicBySlug, topicPath, topicsByBook, validateContent } from '../data/registry';
import { getQuiz, validateQuizzes } from '../data/quizRegistry';
import { grade8Quizzes } from '../data/quizzes/grade8';
import { grade10Quizzes } from '../data/quizzes/grade10';

describe('content manifests', () => {
  it('pass full validation', () => {
    expect(validateContent()).toEqual([]);
    expect(validateQuizzes()).toEqual([]);
  });

  it('keep exact textbook order per book', () => {
    expect(topicsByBook.grade8.map((t) => t.number)).toEqual(['39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51']);
    expect(topicsByBook.grade10.map((t) => t.number)).toEqual(['2.8', '2.9', '2.10', '2.11', '2.12', '2.13', '2.14', '2.15']);
  });

  it('use grade-qualified routes only', () => {
    expect(topicPath(topicsByBook.grade8[0])).toBe('/8-sinf/39');
    expect(topicPath(topicsByBook.grade10[5])).toBe('/10-sinf/2-13');
    expect(getTopicBySlug('grade10', '39')).toBeUndefined();
    expect(getTopicBySlug('grade8', '2-8')).toBeUndefined();
  });

  it('never navigate across books with prev/next', () => {
    expect(getNeighbours(topicsByBook.grade8.at(-1)!).next).toBeUndefined();
    expect(getNeighbours(topicsByBook.grade10[0]).prev).toBeUndefined();
    for (const id of ['grade8', 'grade10'] as const)
      for (const t of topicsByBook[id]) {
        const { prev, next } = getNeighbours(t);
        if (prev) expect(prev.bookId).toBe(id);
        if (next) expect(next.bookId).toBe(id);
      }
  });

  it('give every lesson its own book-isolated quiz', () => {
    for (const id of ['grade8', 'grade10'] as const)
      for (const t of topicsByBook[id]) {
        const q = getQuiz(t);
        expect(q.length).toBeGreaterThanOrEqual(8);
        expect(q.every((x) => x.bookId === id && x.topicKey === t.key)).toBe(true);
      }
    expect(grade8Quizzes.every((q) => q.bookId === 'grade8')).toBe(true);
    expect(grade10Quizzes.every((q) => q.bookId === 'grade10')).toBe(true);
  });

  it('roughly follow the 40/40/20 difficulty mix', () => {
    const all = [...grade8Quizzes, ...grade10Quizzes];
    const share = (d: string) => all.filter((q) => q.difficulty === d).length / all.length;
    expect(share('easy')).toBeGreaterThan(0.3);
    expect(share('medium')).toBeGreaterThan(0.3);
    expect(share('hard')).toBeGreaterThan(0.15);
  });

  it('keep each topic theme distinct within its book', () => {
    for (const id of ['grade8', 'grade10'] as const) {
      const accents = topicsByBook[id].map((t) => `${t.theme.accent}/${t.theme.motif}`);
      expect(new Set(accents).size).toBe(accents.length);
    }
    expect(books.grade8.route).not.toBe(books.grade10.route);
  });
});
