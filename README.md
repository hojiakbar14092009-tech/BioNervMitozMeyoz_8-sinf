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
| `npx vite build --mode qa --outDir dist-qa` | Production-like build with the 3D QA hook (measurements only) |

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

Scenes are procedural React Three Fiber components; no third-party models are downloaded or hotlinked. The scenes are: neuron, reflex arc, spinal cord section, brain (per-lesson region emphasis), cell energy flow, DNA, ribosome translation, mitosis/meiosis, prokaryotic binary fission (2.12, "Prokariot" / "Eukariot" modes), and a mitosis-vs-meiosis comparison (2.15).

**Identification layer.** Every scene declares, in its topic manifest:
- `what`: one sentence answering "Bu nima?";
- `hotspots`: each with a label, textbook text, source **page** and legend **colour**.

Validation fails if a label's page falls outside its lesson. Scenes render geometry through `Part` (`scenes/common.tsx`), which reads its colour from the same hotspot data as the legend. Tapping a structure selects it: the part gets a restrained emphasis and outline and the rest is subdued. The info card (`StructureInfo`) shows the name, explanation and page. On wide screens one anchored label follows the selected part; phones use the card instead of floating text. Process scenes (impulse, translation, mitosis, meiosis) share one stage timeline (`structures.tsx → stagesOf`) that drives the 3D state, the on-canvas badge (`2 / 9 · MEYOZ I`) and the explanation.

**Rendering.** The lighting is a soft key/fill/rim rig plus a locally generated studio environment (drei `Lightformer`, no HDR download) and contact shadows. Organic geometry comes from tapered tubes and displaced surfaces, with brain gyri and sulci and cerebellar folia. Each model opens with a camera preset; "Boshlang‘ich holat" restores the view and clears the selection.

**Performance.** Scenes are lazy-loaded and mounted only near the viewport, so one WebGL context is active at a time. Device pixel ratio adapts to measured performance (mobile starts at 1.5 or less). A veil shows until the first frames render. If WebGL is unavailable or a scene fails, a schematic SVG with the title, description and legend is shown instead. `prefers-reduced-motion` disables auto-rotation and decorative motion.

### Reference images → models

The supplied visual references are stored in `docs/reference-images/` and mapped in `src/data/modelReferences.ts`. Each entry records the book, the lessons, the scene, and the visual traits taken from it. Content validation fails if a reference points to a lesson without that scene. The images guide look and composition only: every label still comes from the lesson PDF, so text in the images that the lesson doesn't teach (e.g. Krebs/NADH, "kiyazma") is not used.

| Reference | Lessons | Scene |
|---|---|---|
| `8-42-bosh-miya` | 8 · 42, 43, 47–50 | brain: colour-segmented lobes, striated cerebellum, spinal continuation, sagittal cut |
| `8-41-orqa-miya-kesimi` | 8 · 41 | spinal cord: cream white matter, inlaid grey matter, fanned root bundles, ganglia |
| `8-40-refleks-yoyi` | 8 · 40, 45 | reflex arc: layered skin, glowing sensory fibre, interneuron, red motor fibre, striated muscle |
| `10-2-8-energiya-oqimi` | 10 · 2.8 | cell energy: membrane, nucleus, mitochondria with cristae (section), glucose, ATP |
| `10-2-10-dnk` | 10 · 2.10 | DNA: continuous sugar-phosphate backbones, base rungs aimed at the axis, replication fork, travelling polymerase |
| `10-2-11-ribosoma` | 10 · 2.11 | ribosome: smooth organic subunits with a cleft, iRNK ladder, tRNAs, polypeptide |
| `10-2-12-mitoz`, `10-2-13-meyoz`, `10-2-15-mitoz-meyoz` | 10 · 2.12, 2.13, 2.15 | smooth volumetric chromatids with centromere waist, fine spindle and asters, gradual crossing-over colour exchange, synchronized comparison; 2.12 also has a dedicated bacterium (p. 73) |
| `10-2-14-virtual-mikroskop` | 10 · 2.14 | 2D canvas virtual microscope (stained onion root tip, 10×/40×) |

**Viewer controls** (`viewerConfig.ts`, per model):
- camera framing, distance and polar limits;
- view presets Old / Orqa / Chap / O‘ng / Yuqori / 3/4, with smooth orbit moves;
- auto-rotation of about 30 s per turn that pauses on touch or selection and resumes after 6 s;
- zoom pad, "Belgilar" labelled callouts, section toggle (brain sagittal cut, mitochondrion), stage playback, and fullscreen where the browser supports it.

The models are procedural: closed volumes built from tapered tubes, displaced surfaces and instanced clusters, with no external GLB files. They read correctly from every angle and download nothing extra. The brain sagittal cut removes the near hemisphere whole and draws inner structures as solid halves with flat cut faces, so no hollow shells show. The neuron grows a deterministic, tapering dendrite tree and a terminal arborization with boutons.

### QA (final pass)

A dev-only hook exposes `window.__bioQA`. It lives in `src/features/three/QaSheet.tsx` and is mounted by `npm run dev` and by `vite build --mode qa`, never in the production bundle. It provides:
- an 8-angle contact sheet (0°–315°);
- manual frame stepping;
- tap-target discovery by raycasting (`targets()`);
- screen extent and a camera read-out;
- a frame-cost bench.

- **360°:** every primary model was rendered at all 8 azimuths, plus free rotation: neuron, reflex arc, spinal cord, brain (§42 and the §47 lobe variant), brain sagittal section, cell energy, mitochondrion cutaway, DNA (helix, replication, transcription), ribosome (initiation and elongation), the 2.12 bacterium (all 5 steps), mitosis (all stages), meiosis (all 9 stages) and the 2.15 comparison.
- **Hotspots:** on every lesson with a 3D scene, each structure was located by raycast and clicked with real pointer events at 900×700 and 414×896. Each card was checked for label and page. Two exceptions: the spindle is selectable from the legend only (thin lines are not practical tap targets), and centromeres are small on phones (about 15×15 px), so the legend chip is the easier route.
- **Presets:** all 6 presets on 9 scenes at 900 and 414 px land, keep the whole model in frame, keep the current stage, and ease in and out.
- **Auto-rotation:** a full turn of the brain took 40 s, and callouts moved at most 6 px per frame. Rotation is scaled by frame time.
- **Responsive:** no horizontal page scroll at 320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024, 1024×768, 1366×768 or 1440×900. The microscope's phase gallery is an intentional horizontal strip.
- **Accessibility:**
  - Under reduced motion, auto-rotation is off and its control is hidden; the impulse and manual rotation still work.
  - Every viewer control has a name and a visible focus ring.
  - On-canvas callouts are pointer shortcuts (`tabIndex=-1`); the legend chips are the keyboard path.
  - A test covers the WebGL fallback, including the 2.12 bacterium schematic.
- **Reliability:** the production build went through 60 in-app navigations over 10 heavy routes. One canvas was alive at a time and there was no WebGL-context warning. Window and document listeners stayed constant at 8. Heap after forced GC went from 11.1 to 11.8 MB. The dev console was clean across 26 routes.

**Measured frame cost.** Each frame runs scene updates and the render, then waits for the GPU to finish. This is a cost proxy, not on-device FPS. Setup: production-like `qa` build, Playwright Chromium, 414×896 at 2× pixel ratio, Intel Iris Xe.

| Model | median ms | p95 ms | draws | triangles |
|---|---|---|---|---|
| Neuron | 3.6 | 6.3 | 19 | 27k |
| Reflex arc | 6.5 | 9.8 | 32 | 29k |
| Spinal cord | 7.4 | 11.5 | 25 | 57k |
| Brain | 7.2 | 14.0 | 15 | 148k |
| Cell energy | 6.9 | 11.4 | 47 | 60k |
| DNA (replication, strands opening) | 8.7 | 20.5 | 64 | 54k |
| Ribosome | 5.4 | 10.2 | 42 | 7k |
| Prokaryote | 5.7 | 9.3 | 6 | 25k |
| Mitosis (metaphase) | 5.6 | 8.2 | 6 | 25k |
| Meiosis (prophase I) | 9.6 | 16.4 | 48 | 26k |
| Mitosis vs meiosis | 11.6 | 18.6 | 95 | 52k |

Occasional single-frame spikes of 40–67 ms were seen. In that throttled window, the scene took 2.3–3.5 s to become ready after scrolling, including the lazy chunk. In an earlier pass, in the desktop app's visible browser pane, the brain ran at about 53 fps at 414×896.

Real-device performance on an iPhone 11 has not been measured.

## Highlights

Highlights are chosen by the learner; nothing is saved before **Belgilash** is pressed. The engine lives in `src/features/highlights/` and is shared by both books.
- **Choosing words.** Double-click a word on desktop, or double-tap it on a phone (two taps on the same word within 350 ms; a moving finger counts as scrolling, so the page scrolls normally). Each word is added to the selection, and words can come from several paragraphs. A second double-click removes a word. Dragging or keyboard text selection also works and is added to the same selection.
- **Action bar.** A bottom bar shows `N ta so‘z tanlandi · Bekor qilish · Belgilash`. It is portalled to `<body>` above the safe area. Its visibility comes from the selection state, not from the browser's text selection, so it does not vanish while words are selected (including during scrolling).
- **Saving.** One Belgilash saves the whole selection as one group. Consecutive words merge into a phrase; non-adjacent words stay separate segments, and the words between them are never highlighted. The selection clears only after storage accepts the write. On failure it stays, so the learner can retry. Leaving the lesson discards an unsaved selection.
- **Words.** Tokens come from `Intl.Segmenter`, with a Unicode regex fallback. O‘/g‘, apostrophes and hyphenated terms stay one word, and punctuation is never a word.
- **Stored record.** It keeps the book, topic, block, exact text, offsets, optional `prefix`/`suffix` context and a `groupId`. Repeated text is restored to the right occurrence by context. Highlights saved before this version have no group or context and still work as single items. Marks never nest. Double-clicking an already saved word offers its removal instead of duplicating it.
- **Saved list.** **Belgilanganlar** shows each group as one item (segments separated by “…”), with grade, lesson, date, search and filters. Deleting there or in the lesson updates both places, because there is one source of truth. **Mavzuga qaytish** scrolls to the exact mark and briefly emphasises it.
- **Colours.** Light and dark mode have separate tokens. Saved marks use honey/amber; words still being chosen use an outlined indigo tint.

## Installable app and offline use

The site is an installable PWA. After one online visit it keeps working without internet.

**Installing**
- **Android / Chrome / Edge, desktop or phone:** tap **Ilovani o‘rnatish** on the home page. It opens the browser's own install dialog, which only appears when the browser allows installation.
- **iPhone / iPad (Safari):** the same button opens a short guide. Tap **Ulashish**, then **Bosh ekranga qo‘shish**, then **Qo‘shish**. iOS has no automatic install prompt.
- The card hides once the app is installed or running standalone. **Keyinroq** hides it for 14 days.

**What works offline:** home, both books, every lesson text, quizzes (scoring, explanations, feedback audio), progress, highlights and Belgilanganlar, theme, all 3D models, the virtual microscope and the interactive exercises.

**How it is cached** (`pwa/sw.js`, generated per build by `vite.config.ts`):
- `offline-manifest.json` is built from the real production output, so there is no hand-written asset list.
- **Core** (about 2.4 MB) is precached when the service worker installs: app shell, every page and quiz chunk, the 3D framework, CSS, icons and quiz audio.
- **Offline pack** (about 90 KB): the lazily loaded 3D-scene and interactive chunks. **Offline uchun tayyorlash** downloads it with real per-group progress and supports cancel and retry. Files visited online are also cached.
- Navigation always returns the cached app shell of the same version, so a deep link such as `/8-sinf/42` opens offline. Content that was never saved shows a calm “Internet mavjud emas” message instead of a browser error.
- Audio byte-range requests are answered from the cache (206), as Safari requires for media.
- Only same-origin GET requests are cached; third-party requests are never stored.

**Updates and data:** each build has its own cache version.
- A new version installs in the background, and **Yangi versiya mavjud → Yangilash** activates it. The page never reloads in the middle of a lesson or quiz.
- Old caches are deleted after activation; unchanged offline-pack files are carried over.
- If the learner had prepared offline use, a changed or cleared pack is refilled automatically when online.
- Progress, highlights and settings live in `localStorage` and are never touched by cache cleanup. **Offline materiallarni o‘chirish** removes downloaded files only.

**First visit:** offline use starts after the app has been opened online once; a browser cannot download it without a connection.

**Tested** (production build, Playwright Chromium on Windows):
- Chrome reports no installability errors.
- The service worker precaches core, and the offline pack reaches “Offline foydalanishga tayyor”.
- With the network off: a hard load of a deep lesson route works, all 10 lesson 3D models render, DNA stages play, and the microscope works.
- A full quiz played all three recordings from cache and saved its score.
- Highlights work end to end: save, Belgilanganlar and return to the lesson.
- A cold start in a new tab works offline, and every route opens.
- Updating to a new version kept progress, highlights and theme.
- Online/offline flapping stays stable: one service-worker registration and one install card.
- After the caches were cleared, they were rebuilt.

**Not tested:**
- Installation was not completed in a real browser window.
- Real iPhone 11 device testing was not performed; the iOS guide was checked with an iPhone user agent only.

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
