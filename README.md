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

Scenes are procedural React Three Fiber components; no third-party models are downloaded or hotlinked. The scenes are: neuron, reflex arc, spinal cord section, brain (per-lesson region emphasis), cell energy flow, DNA, ribosome translation, mitosis/meiosis, and a mitosis-vs-meiosis comparison (2.15).

**Identification layer.** Every scene declares, in its topic manifest:
- `what`: one sentence answering "Bu nima?";
- `hotspots`: each with a label, textbook text, source **page** and legend **colour**.

Validation fails if a label's page falls outside its lesson. Scenes render geometry through `Part` (`scenes/common.tsx`), which reads its colour from the same hotspot data as the legend. Tapping a structure selects it: the part gets a restrained emphasis and outline and the rest is subdued. The info card (`StructureInfo`) shows the name, explanation and page. On wide screens one anchored label follows the selected part; phones use the card instead of floating text. Process scenes (impulse, translation, mitosis, meiosis) share one stage timeline (`structures.tsx → stagesOf`) that drives the 3D state, the on-canvas badge (`2 / 9 · MEYOZ I`) and the explanation.

**Rendering.** The lighting is a soft key/fill/rim rig plus a locally generated studio environment (drei `Lightformer`, no HDR download) and contact shadows. Organic geometry comes from tapered tubes and displaced surfaces, with brain gyri and sulci and cerebellar folia. Each model opens with a camera preset; "Boshlang‘ich holat" restores the view and clears the selection.

**Performance.** Scenes are lazy-loaded and mounted only near the viewport, so one WebGL context is active at a time. Device pixel ratio adapts to measured performance (mobile starts at 1.5 or less). A veil shows until the first frames render. If WebGL is unavailable or a scene fails, a schematic SVG with the title, description and legend is shown instead. `prefers-reduced-motion` disables auto-rotation and decorative motion.

## Highlights

Highlights are created only by the learner: select text in a lesson block, then tap "Belgilash".
- **What can be highlighted:** only lesson text blocks (`data-hl-block`); quiz answers, navigation and 3D controls cannot be.
- **What is stored:** the record keeps the book id, topic key, block id, exact text and offsets. If the text shifts, the highlight re-anchors by its exact text.
- **Saved list:** each highlight appears in **Belgilanganlar** immediately, which offers search, grade and lesson filters, dates, deletion, and a link to the exact source (`/8-sinf/41#hl-…`). The link scrolls to the mark and briefly emphasises it.
- **Colours:** light and dark mode use separate tokens (`--hl-bg`, `--hl-edge`, `--hl-text`).

## Navigation

Every secondary page has a Back button (`components/BackButton.tsx`). It uses in-app history when it exists; otherwise it goes to the page's parent. `ScrollRestoration` keeps the reading position when returning.

| Route | Back goes to (no history) | Book context visible | Reach home |
|---|---|---|---|
| `/` | — (root) | — | — |
| `/8-sinf`, `/10-sinf` | `/` | header chip, card | Kitoblar, logo |
| `/8-sinf/:n`, `/10-sinf/:n` | that book's dashboard | chip, breadcrumb, menu | logo, menu, breadcrumb |
| `/belgilanganlar` | `/` | per item | logo, empty-state links |
| unknown route | `/` | — | button |

On the quiz results screen, "Mavzuga qaytish" scrolls back to the lesson top, and "Keyingi" goes to the next lesson in the same book.

## Opening animation

The opening animation is SVG + CSS, with no WebGL and no dependency. It runs about 2.5 s:
1. 16 points gather onto a cell membrane.
2. A chromosome forms inside the cell.
3. Neuron dendrites grow on one side, and on the other an axon drawn as a DNA double strand.
4. The title appears, and the overlay fades into the dashboard.

It plays once per browser session (`sessionStorage`) and has an "O‘tkazib yuborish" (skip) button. With reduced motion it becomes a short static fade. The same mark is the header logo.

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
