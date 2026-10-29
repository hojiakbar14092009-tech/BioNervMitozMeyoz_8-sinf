export type BookId = 'grade8' | 'grade10';

/** Stable cross-book key, e.g. "grade8-39", "grade10-2-13". Never index-based. */
export type TopicKey = `${BookId}-${string}`;

export interface Book {
  id: BookId;
  title: string;
  grade: string;
  subtitle: string;
  scope: string;
  route: string; // "/8-sinf"
  source: string;
  numbering: string[]; // topic numbers in exact textbook order
  accent: string;
}

export type SceneKey =
  | 'neuron'
  | 'reflexArc'
  | 'spinalCord'
  | 'brain'
  | 'metabolism'
  | 'dna'
  | 'translation'
  | 'division';

/** A selectable biological structure in a 3D scene. Labels/texts must come from the lesson's pages. */
export interface Hotspot {
  id: string;
  label: string;
  text: string;
  page: number;
  /** Legend swatch; scenes read the same colour so legend and model always match. */
  color: string;
}

export interface SceneConfig {
  key: SceneKey;
  title: string;
  /** "Bu nima?" — one sentence naming what the model represents. */
  what: string;
  caption: string;
  /** Which brain regions / structures to emphasise, scene-specific ids. */
  focus?: string[];
  mode?: 'mitosis' | 'meiosis' | 'compare' | 'binary';
  /** Alternative models inside one viewer (2.12: Prokariot / Eukariot), each with its own identity and structures. */
  modes?: { id: 'binary' | 'mitosis'; label: string; title: string; what: string; hotspots: Hotspot[] }[];
  /** Explicit process stages (timeline); division/translation stages are derived from their data. */
  stages?: { name: string; text: string }[];
  hotspots: Hotspot[];
}

export type InteractiveKey =
  | 'impulseTimer'
  | 'reflexBuilder'
  | 'brainMap'
  | 'diseaseMatch'
  | 'conditioning'
  | 'sleepCycle'
  | 'temperament'
  | 'energyLedger'
  | 'energyProblems'
  | 'codonBuilder'
  | 'translationModel'
  | 'cellCycle'
  | 'meiosisJourney'
  | 'microscope'
  | 'eventMatch';

export type Section =
  | { kind: 'text'; id: string; heading: string; paras: string[]; bullets?: string[]; page: number }
  | { kind: 'steps'; id: string; heading: string; steps: { title: string; text: string }[]; page: number }
  | { kind: 'table'; id: string; heading: string; columns: string[]; rows: string[][]; page: number }
  | { kind: 'formula'; id: string; heading: string; items: { label: string; expr: string; note?: string }[]; page: number };

export interface Term {
  term: string;
  def: string;
}

export interface TopicTheme {
  accent: string; // light-mode accent
  accent2: string;
  accentDark: string; // dark-mode accent
  accent2Dark: string;
  motif: 'branch' | 'signal' | 'spine' | 'brain' | 'hemi' | 'health' | 'chain' | 'assoc' | 'mind' | 'emotion' | 'memory' | 'sleep' | 'balance'
    | 'flow' | 'calc' | 'helix' | 'codon' | 'split' | 'meiosis' | 'lens' | 'compare';
}

export interface Topic {
  key: TopicKey;
  bookId: BookId;
  number: string; // "39" | "2.8"
  slug: string; // "39" | "2-8"
  title: string; // exact PDF title
  shortTitle: string;
  pages: [number, number];
  practical?: boolean;
  theme: TopicTheme;
  intro: string;
  keyConcepts: string[];
  sections: Section[];
  terms: Term[];
  important: string[];
  summary: string;
  scene?: SceneConfig;
  interactive?: InteractiveKey;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

interface QuestionBase {
  id: string;
  bookId: BookId;
  topicKey: TopicKey;
  difficulty: Difficulty;
  prompt: string;
  explanation: string;
  sourcePage: number;
  sourceConcept: string;
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq';
  options: string[];
  correct: number;
  wrongExplanations?: Partial<Record<number, string>>;
}

export interface OrderQuestion extends QuestionBase {
  type: 'order';
  /** Items listed in the CORRECT order; UI shuffles them. */
  items: string[];
}

export type QuizQuestion = McqQuestion | OrderQuestion;

export type AnswerOutcome = 'first' | 'retry' | 'revealed';

export interface QuizResult {
  score: number;
  total: number;
  first: number;
  retry: number;
  revealed: number;
  finishedAt: number;
}

export interface Highlight {
  id: string;
  bookId: BookId;
  topicKey: TopicKey;
  blockId: string;
  exactText: string;
  startOffset: number;
  endOffset: number;
  createdAt: number;
  /** Segments saved together with one “Belgilash” share a group (older records have none: each is its own group). */
  groupId?: string;
  /** Text just before / after the segment, used to find the right occurrence if offsets drift. */
  prefix?: string;
  suffix?: string;
}

export interface BookProgress {
  completedTopics: TopicKey[];
  quizResults: Partial<Record<TopicKey, QuizResult>>;
  lastTopic: TopicKey | null;
}

export type ThemeMode = 'light' | 'dark';

export interface AppState {
  version: 1;
  books: Record<BookId, BookProgress>;
  lastBook: BookId | null;
  theme: ThemeMode | null;
  audioEnabled: boolean;
  highlights: Highlight[];
}

export type AudioKey = 'correct' | 'wrong1' | 'wrong2' | 'click';
