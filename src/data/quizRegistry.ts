import type { BookId, QuizQuestion, Topic } from '../types';
import { books } from './books';
import { getTopic, topicsByBook } from './registry';
import { grade8Quizzes } from './quizzes/grade8';
import { grade10Quizzes } from './quizzes/grade10';

// Kept out of the main bundle: only lesson pages import this module.
const quizzesByBook: Record<BookId, QuizQuestion[]> = { grade8: grade8Quizzes, grade10: grade10Quizzes };

/** Questions filtered by BOTH book and topic key — a grade8 topic can never receive grade10 questions. */
export function getQuiz(topic: Topic): QuizQuestion[] {
  return quizzesByBook[topic.bookId].filter((q) => q.topicKey === topic.key && q.bookId === topic.bookId);
}

export function validateQuizzes(): string[] {
  const errors: string[] = [];
  for (const bookId of Object.keys(books) as BookId[]) {
    for (const t of topicsByBook[bookId]) {
      const n = getQuiz(t).length;
      if (n < 8) errors.push(`${t.key}: only ${n} questions`);
    }
    for (const q of quizzesByBook[bookId]) {
      const t = getTopic(q.topicKey);
      if (!t || t.bookId !== q.bookId || q.bookId !== bookId) errors.push(`${q.id}: points to wrong topic/book`);
      if (!q.sourcePage || !q.explanation || !q.sourceConcept) errors.push(`${q.id}: missing source metadata`);
      if (t && (q.sourcePage < t.pages[0] - 4 || q.sourcePage > t.pages[1] + 1)) errors.push(`${q.id}: sourcePage ${q.sourcePage} outside ${t.key}`);
      if (q.type === 'mcq') {
        if (q.options.length < 3 || q.correct < 0 || q.correct >= q.options.length) errors.push(`${q.id}: invalid options`);
        if (new Set(q.options).size !== q.options.length) errors.push(`${q.id}: duplicate options`);
      } else if (q.items.length < 3 || new Set(q.items).size !== q.items.length) errors.push(`${q.id}: invalid order items`);
    }
  }
  const ids = [...grade8Quizzes, ...grade10Quizzes].map((q) => q.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate question ids');
  return errors;
}

if (import.meta.env.DEV) {
  const errors = validateQuizzes();
  if (errors.length) throw new Error(`Quiz validation failed:\n${errors.join('\n')}`);
}
