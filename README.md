# Biologiya — 8 va 10-sinf interaktiv o‘quv platformasi

An interactive, mobile-first Biology learning app in Uzbek. It contains two separate textbook sections:

| Section | Source textbook | Scope | Route |
|---|---|---|---|
| **8-sinf Biologiya**: nerv sistemasi va oliy nerv faoliyati | *Biologiya (Odam va uning salomatligi)*, 8-sinf, O‘qituvchi, 2019 | 39–51-§ (pp. 122–156) | `/8-sinf/39` … `/8-sinf/51` |
| **10-sinf Biologiya**: hujayra metabolizmi, irsiy axborot, mitoz va meyoz | *Biologiya 10*, 2022 | 2.8–2.15 (pp. 60–81) | `/10-sinf/2-8` … `/10-sinf/2-15` |

Each lesson has textbook-based content with page references, a topic-specific visual identity, an interactive 3D scene or a practical interactive, an "Imtihon uchun muhim" section, and a quiz (8–10 questions, 3 attempts per question, recorded voice feedback). The app also has persistent highlights, per-book progress, and light and dark themes.

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run typecheck` | Run strict TypeScript checks (`tsc -b`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest: content, quiz, storage and science tests |
| `npm run validate` | Run content/quiz manifest validation only |
| `npm run build` | Typecheck, then build for production into `dist/` |
| `npm run preview` | Serve the production build |

In development the app also **fails loudly** if a manifest is invalid. Checked cases: a missing or duplicate topic, the wrong book, wrong order, a quiz pointing to the wrong topic, or a source page outside its lesson.

## Architecture

```
src/
  types.ts                 domain models (Book, Topic, Section, QuizQuestion, Highlight, AppState…)
  data/
    books.ts               explicit book configs (grade8 / grade10)
    grade8/topics.ts       8-sinf manifest (39–51), every section has a page number
    grade10/topics.ts      10-sinf manifest (2.8–2.15)
    quizzes/grade8.ts      130 questions; quizzes/grade10.ts — 80 questions
    registry.ts            key-based lookup, in-book prev/next, validation
    quizRegistry.ts        quiz lookup filtered by bookId AND topicKey (lazy chunk)
  features/
    quiz/                  attempt state machine (logic.ts) + UI
    highlights/            book-aware offset highlights
    three/                 Viewer (lazy scenes, viewport mounting, adaptive DPR, fallback) + scenes/
    division/              one mitosis/meiosis stage model → 3D scene, SVG, microscope, comparison
    interactives/          practical widgets (energy problems, codon builder, microscope…)
  lib/store.ts             versioned localStorage state (per-book progress)
  lib/audio.ts             single audio manager
  pages/                   Home, BookPage, TopicPage, HighlightsPage
```

Every lookup uses explicit keys such as `grade8-39` and `grade10-2-13`. There is no index-based mapping between books. Prev/next navigation never crosses books; at the end of a book the next action is a labelled book switch.

## Source PDF policy

Biological facts come **only** from the two textbooks. Each book's facts stay in its own manifest. The scanned 8-sinf PDF was read page by page. Text for the 10-sinf PDF was extracted with `pdftotext`. Known textbook inconsistencies are deliberately not used:

- the 2.9 problem 6 answer;
- the p.139 "shartli" wording for the newborn's first breath;
- the p.140 century reference.

## 3D

Scenes are procedural React Three Fiber components; no third-party models are downloaded or hotlinked. The scenes are: neuron, reflex arc, spinal cord section, brain (per-lesson region emphasis), cell energy flow, DNA, ribosome translation, and mitosis/meiosis. Each scene is lazy-loaded and is mounted only near the viewport. Device pixel ratio adapts to measured performance (mobile starts at 1.5 or less). If WebGL is unavailable or a scene fails, a schematic SVG with the same labels is shown instead. `prefers-reduced-motion` disables auto-rotation and decorative motion.

## Audio mapping

The supplied recordings were mapped by duration and by recording order. They were not mapped by filename.

| File | Duration | Meaning |
|---|---|---|
| `public/audio/wrong-attempt-1.wav` | 8.49 s | "…yana bir marotaba urinib ko‘r." |
| `public/audio/wrong-attempt-2.wav` | 4.83 s | "Bu ikkinchisi. O‘ylab javob ber…" |
| `public/audio/correct-answer.wav` | 1.29 s | "Molodets." |

The answer click is a quiet synthesized Web Audio tick. A third wrong answer reveals the correct answer silently, because no recording was supplied for it. No TTS is used; if a file is missing, the quiz still works silently.

## Build

```bash
npm run build
```

The output in `dist/` is a static SPA. When hosting, configure a fallback to `index.html` for client-side routes.
