import type { BookId, Topic, TopicKey } from '../types';
import { books } from './books';
import { grade8Topics } from './grade8/topics';
import { grade10Topics } from './grade10/topics';
import { modelReferences } from './modelReferences';

export const topicsByBook: Record<BookId, Topic[]> = { grade8: grade8Topics, grade10: grade10Topics };

const topicIndex = new Map<TopicKey, Topic>([...grade8Topics, ...grade10Topics].map((t) => [t.key, t]));

export const getTopic = (key: TopicKey) => topicIndex.get(key);

export function getTopicBySlug(bookId: BookId, slug: string): Topic | undefined {
  return topicsByBook[bookId].find((t) => t.slug === slug);
}

/** Prev/next stay inside one book: 51 has no next, 2.8 has no previous. */
export function getNeighbours(topic: Topic): { prev?: Topic; next?: Topic } {
  const list = topicsByBook[topic.bookId];
  const i = list.findIndex((t) => t.key === topic.key);
  return { prev: list[i - 1], next: list[i + 1] };
}

export const topicPath = (t: Topic) => `${books[t.bookId].route}/${t.slug}`;

export function validateContent(): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  const seenRoutes = new Set<string>();
  for (const bookId of Object.keys(books) as BookId[]) {
    const book = books[bookId];
    const list = topicsByBook[bookId];
    if (list.map((t) => t.number).join('|') !== book.numbering.join('|')) errors.push(`${bookId}: topic order mismatch`);
    for (const t of list) {
      if (t.bookId !== bookId) errors.push(`${t.key}: wrong book`);
      if (t.key !== `${bookId}-${t.number.replace('.', '-')}`) errors.push(`${t.key}: key does not match number`);
      if (t.slug !== t.number.replace('.', '-')) errors.push(`${t.key}: slug mismatch`);
      if (seenKeys.has(t.key)) errors.push(`${t.key}: duplicate key`);
      seenKeys.add(t.key);
      const route = topicPath(t);
      if (seenRoutes.has(route)) errors.push(`${route}: duplicate route`);
      seenRoutes.add(route);
      if (!t.sections.length || !t.important.length || !t.summary) errors.push(`${t.key}: missing content`);
      if (!/^#[0-9a-f]{6}$/i.test(t.theme.accent) || !/^#[0-9a-f]{6}$/i.test(t.theme.accentDark)) errors.push(`${t.key}: invalid theme`);
      for (const h of [...(t.scene?.hotspots ?? []), ...(t.scene?.modes?.flatMap((m) => m.hotspots) ?? [])]) {
        if (h.page < t.pages[0] - 4 || h.page > t.pages[1]) errors.push();
        if (!/^#[0-9a-f]{6}$/i.test(h.color)) errors.push();
      }
      if (t.scene && !t.scene.what) errors.push();
      for (const h of t.scene?.hotspots ?? []) {
        if (h.page < t.pages[0] - 4 || h.page > t.pages[1]) errors.push(`${t.key}/${h.id}: label page ${h.page} outside lesson`);
        if (!/^#[0-9a-f]{6}$/i.test(h.color)) errors.push(`${t.key}/${h.id}: invalid legend colour`);
      }
      if (t.scene && !t.scene.what) errors.push(`${t.key}: 3D scene has no description`);
      for (const s of t.sections) {
        if (s.page < t.pages[0] - 4 || s.page > t.pages[1]) errors.push(`${t.key}/${s.id}: page ${s.page} outside lesson`);
      }
    }
  }
  for (const ref of modelReferences) {
    for (const key of ref.topicKeys) {
      const t = getTopic(key);
      if (!t || t.bookId !== ref.bookId) errors.push(`${ref.referenceFile}: wrong book/topic ${key}`);
      else if (ref.scene === 'microscope' ? t.interactive !== 'microscope' : t.scene?.key !== ref.scene || (ref.mode && t.scene.mode !== ref.mode))
        errors.push(`${ref.referenceFile}: mapped to ${key} but that lesson has no ${ref.scene}${ref.mode ? `/${ref.mode}` : ''} model`);
    }
  }
  return errors;
}

if (import.meta.env.DEV) {
  const errors = validateContent();
  if (errors.length) throw new Error(`Content validation failed:\n${errors.join('\n')}`);
}

/** Display number with book convention: "39-§" for 8-sinf, "2.13" for 10-sinf. */
export const topicLabel = (t: Topic) => (t.bookId === 'grade8' ? `${t.number}-§` : t.number);
