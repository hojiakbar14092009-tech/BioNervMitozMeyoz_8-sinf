import type { AnswerOutcome, AudioKey, QuizQuestion, QuizResult } from '../../types';

export const MAX_ATTEMPTS = 3;

export interface QState {
  attempts: number;
  status: 'open' | 'correct' | 'revealed';
  /** Wrong choices so far (mcq index or order signature), shown as "tried". */
  wrong: string[];
  lastAnswer: string | null;
}

export const freshQ = (): QState => ({ attempts: 0, status: 'open', wrong: [], lastAnswer: null });

export interface SubmitResult {
  state: QState;
  sound: AudioKey | null; // 3rd wrong has no recording assigned — reveal happens silently
}

/** One attempt. Locked questions ignore further submits. Wrong answers never reveal before the 3rd attempt. */
export function submit(s: QState, answer: string, correct: boolean): SubmitResult | null {
  if (s.status !== 'open') return null;
  if (!correct && s.wrong.includes(answer)) return null; // same wrong answer again doesn't burn an attempt
  const attempts = s.attempts + 1;
  if (correct) return { state: { ...s, attempts, status: 'correct', lastAnswer: answer }, sound: 'correct' };
  const wrong = [...s.wrong, answer];
  if (attempts >= MAX_ATTEMPTS) return { state: { attempts, status: 'revealed', wrong, lastAnswer: answer }, sound: null };
  return { state: { attempts, status: 'open', wrong, lastAnswer: answer }, sound: attempts === 1 ? 'wrong1' : 'wrong2' };
}

export function outcome(s: QState): AnswerOutcome | null {
  if (s.status === 'revealed') return 'revealed';
  if (s.status === 'correct') return s.attempts === 1 ? 'first' : 'retry';
  return null;
}

export function summarize(states: QState[]): QuizResult {
  const o = states.map(outcome);
  const first = o.filter((x) => x === 'first').length;
  const retry = o.filter((x) => x === 'retry').length;
  return { score: first + retry, total: states.length, first, retry, revealed: o.filter((x) => x === 'revealed').length, finishedAt: Date.now() };
}

export const isCorrect = (q: QuizQuestion, answer: string) =>
  q.type === 'mcq' ? Number(answer) === q.correct : answer === q.items.join('\u0001');

/** Deterministic shuffle so order questions never start already solved. */
export function shuffled<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const a = items.map((v, i) => ({ v, k: Math.sin(h + i * 97) }));
  a.sort((x, y) => x.k - y.k);
  const out = a.map((x) => x.v);
  if (out.every((v, i) => v === items[i]) && out.length > 1) out.push(out.shift() as T);
  return out;
}
