---
sprint: 215
title: "CS Quiz Minigame Core (Frontend Short-Answer Game + PoC Content)"
date: "2026-06-01"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-105"]
related_memory: ["sprint-window", "feedback-commitlint-scope", "feedback-sprint-scoping"]
topics: ["frontend", "quiz", "i18n", "feature"]
tldr: "Added a CS-knowledge quiz to AlgoSu, but fixed its form as a lightweight, playable frontend minigame rather than a backend domain expansion where setters register/manage problems. Grading is short-answer (keyword input), not multiple-choice: normalizeAnswer (lowercase → replace non-Hangul/alphanumeric with space → trim → strip whitespace) and gradeAnswer (correct if, after normalization, any acceptedAnswers entry matches exactly) are implemented as pure functions, with acceptedAnswers held as an array of the answer plus synonyms (KR/EN/abbrev) to absorb input variance. Record persistence was abstracted via the QuizRecordStore interface + createLocalStorageQuizStore() implementation so Sprint 217 can swap it for server sync with no downtime. As a PoC, 24 questions across two categories (Data Structures, Algorithms) live in the src/data/quiz/ static bank, and an idle→playing→result state-machine game page was added at the /[locale]/quiz route (zero new ui components, preserving Palette authority). Zero backend; code changes are frontend-only. To avoid cramming game + grading + content + backend + migration into one sprint, the work was split into a 3-sprint roadmap: 215 (core) / 216 (question bank · setter UX) / 217 (logged-in record integration). One Critic (Codex) P2 finding (unguarded storage writeMap) was fixed and incorporated; final CLEAN."
---
# Sprint 215 — CS Quiz Minigame Core (Frontend Short-Answer Game + PoC Content)

## Goal

- Add a CS-knowledge quiz to AlgoSu as a new feature, but complete the core play loop as a **lightweight, playable minigame**.
- Implement a **short-answer (keyword input)** grading engine as pure functions, and absorb input variance (parentheses/whitespace/KR-EN/case) via a synonym array.
- Abstract record persistence behind an interface to prepare for the Sprint 217 server-sync swap.
- Split a large feature across a 3-sprint roadmap rather than cramming it into one sprint.

## Background

A request came in to add a CS-knowledge quiz to AlgoSu. The first thing to decide is its **form**. Whether to grow it into a backend domain feature (a problem-service expansion) where setters register/manage problems, or to build a lightweight, playable **minigame**, drastically changes the work scope. The user's core requirements point to the latter — short-answer (keyword input) grading rather than multiple-choice, logged-in record persistence, and a broad question bank.

Cramming all three requirements (game UX + grading engine + bulk content + a new backend + migration) into one sprint would bloat review/verification and contradict the lesson recorded in [[feedback-sprint-scoping]] — "split large transitions into a multi-sprint roadmap." So the work is split into a **3-sprint roadmap**.

- **Sprint 215 (this sprint)**: the frontend minigame **core** — short-answer grading engine + idle→playing→result play loop + a PoC of two categories' questions. Records in localStorage (temporary).
- **Sprint 216**: a broad question bank (all categories) + diversified setter UX + content lint + grading-accuracy improvements (partial/fuzzy matching).
- **Sprint 217**: logged-in record integration (a QuizRecord entity + migration, likely an Identity expansion). Swap localStorage → server API.

215 completes the core play loop **frontend-only**, with zero backend, keeping records in temporary localStorage.

## Decisions

### D0. Fix the minigame form — frontend static question bank, zero backend

Implement it as a **frontend static question bank** based on `src/data/quiz/`, not a problem/submission backend domain expansion. 215 has zero backend changes and no new service, entity, or migration. A minigame is overwhelmingly lighter than a managed setter system, and the core play loop can be completed and verified standalone.

### D1. Short-answer keyword grading — normalization + synonym array

The grading engine consists of two pure functions.

- `normalizeAnswer(input)` — lowercase → replace characters other than Hangul/Latin/digits with a space → trim → strip all whitespace. e.g. `"O(log n)!"` → `"ologn"`, `"이진 탐색"` → `"이진탐색"`.
- `gradeAnswer(input, acceptedAnswers)` — normalize both the input and acceptedAnswers, then mark correct if **any** entry matches exactly.

`acceptedAnswers` is held as an array of the answer keyword plus synonyms (KR/EN/abbrev) to absorb input variance (parentheses/whitespace/KR-EN/case). Partial/fuzzy matching (edit distance, etc.) is deferred to Sprint 216 — 215 secures sufficient core accuracy with exact match + synonyms.

### D2. 3-sprint split — each sprint independently mergeable/playable

Each sprint must be an independently mergeable and playable deliverable. At the 215 merge point, **two categories — Data Structures and Algorithms — are immediately playable**. Even with 216/217 incomplete, 215 is a working minigame on its own.

### D3. Abstract record persistence behind an interface

Define a `QuizRecordStore` interface (`getBest` / `saveResult` / `getAllBest`) and provide a `createLocalStorageQuizStore()` implementation in 215. The interface is separated so that Sprint 217 can swap **only the implementation** from localStorage → server sync. The storage key is `'algosu.quiz.records'`, with an SSR guard (blocking localStorage access during server render).

### D4. commitlint scope — use feat(frontend)

quiz is a frontend-internal feature, not a separate top-level directory scope, so use `feat(frontend)` / `test(frontend)` / `fix(frontend)` (no `quiz` added to scope-enum). scope-enum registration is only needed when creating a new top-level directory — see [[feedback-commitlint-scope]] and the dynamic scope-enum structure in [Sprint 105](./sprint-105.md).

## Implementation

Branch `feat/sprint-215-cs-quiz-minigame`, 8 atomic commits, 34 files (+2009 / −3). Frontend-only (zero backend).

### Data (`src/data/quiz/`)

- `types.ts` — question/category types, `LocalizedText` (ko/en)
- `data-structure.ts` — 12 Data Structures questions
- `algorithm.ts` — 12 Algorithms questions
- `index.ts` — `ALL_QUESTIONS` / `QUIZ_CATEGORIES` / `getQuestionsByCategory` / `getRandomQuestions`

A PoC of two categories, **24 questions** total.

### Logic (`src/lib/quiz/`)

- `grade.ts` — `normalizeAnswer` / `gradeAnswer` pure functions (D1)
- `storage.ts` — `QuizRecordStore` interface + localStorage implementation. **Both** `readMap` / `writeMap` are try-catch guarded (D3 + the Critic P2 fix incorporated).

### UI (`src/app/[locale]/quiz/`, `src/components/quiz/`)

- `page.tsx` (`'use client'`) — idle → playing → result state machine
- `layout.tsx` / `error.tsx` / `loading.tsx` — route boilerplate
- `QuizStart` / `QuizPlay` / `QuizQuestion` / `QuizFeedback` / `QuizResult` — game components. **Reuse existing ui components (zero new ui, preserving Palette authority)**. `useLocale` branches the ko/en `LocalizedText`.

### i18n / nav

- `messages/{ko,en}/quiz.json` (32 keys consistent) + `'quiz'` added to `i18n/request.ts` NAMESPACES + registered in `test-utils/i18n.tsx` DEFAULT_MESSAGES
- A quiz item in `AppLayout.tsx` NAV_ITEMS (Brain icon, `/quiz`) + `nav.quiz` in `messages/{ko,en}/layout.json`

### Commits

| Hash | Content |
|------|---------|
| `66e6b17` | data model (types + 24 questions + index) |
| `89b1f5f` | grading engine + store (grade/storage) |
| `0b2f157` | core unit tests |
| `d8a39d8` | i18n (quiz.json + NAMESPACES + test-utils) |
| `104750c` | 5 UI components |
| `d43a8be` | game page (state machine + route) |
| `8dc2d39` | nav item |
| `c289cb3` | Critic P2 fix — guard storage writeMap |

## Verification

Oracle direct verification (after the P2 fix):

- `tsc --noEmit` → 0
- `next lint` → 0 errors / 0 warnings (no quiz-related warnings)
- `test:coverage` → **146 suites · 1462 tests PASS**, global lines 87.43% · branches 78.84% (clears the 83% / 71% gate)
- **The 5 quiz components and `lib/quiz` (grade/storage) all at 100% coverage**
- `next build` → ✓ Compiled 6.6s, `ƒ /[locale]/quiz` route generated (12.4kB)
- The 24 CS questions passed Oracle's accuracy review

## Lessons

1. **A minigame can complete its core play loop on frontend static data, with no backend** — do not grow every new feature into a backend domain by default; fix the form first (minigame vs managed setter system). The form determines the work scope and the sprint split.
2. **Short-answer grading absorbs input variance via normalization + a synonym array** — flatten parentheses/whitespace/KR-EN/case with `normalizeAnswer`, and hold the answer as an `acceptedAnswers` array (answer + KR/EN/abbrev synonyms) rather than a single string, so user-input diversity is caught with exact match alone.
3. **Persistence must guard both reads and writes** — guarding only `readMap` and omitting `writeMap` lets `setItem` throw in some browser environments (Safari private mode / quota exceeded), dropping the completion flow into the route error boundary (Critic P2). Separate persistence failure from result display, and handle persistence best-effort.
4. **Implement a large frontend feature consistently via wave splitting (core logic → UI), verifying each wave** — stack atomic commits in the order data model → grading/storage logic → unit tests → i18n → UI → page → nav, verifying each layer independently.

## New Patterns

- **Record-persistence interface abstraction pattern** — separating a `Store` interface from its localStorage implementation enables a no-downtime swap to server sync later (preparing for Sprint 217). Because the call site (the game page) depends only on the interface, swapping the implementation in 217 to guest=localStorage · logged-in=server-merge requires no UI change.
- **Best-effort persistence pattern** — try-catch guard both reads and writes so that the core UX (result display) is preserved even in storage-constrained environments (private mode · quota exceeded). A failure in a secondary concern (record saving) does not break the main flow (play → result).

## Sprint 216+ Carryover

- **Sprint 216 — broad question bank** (planned): expand questions across all categories + content lint + diversified setting + grading-accuracy improvements (partial/fuzzy matching).
- **Sprint 217 — logged-in record integration** (planned): a QuizRecord entity + migration, likely an Identity expansion. Swap the `storage.ts` abstraction for a server API, guest=localStorage · logged-in=server-merge.
- **Server redeploy + live SEO verification** (user/ops): Sprint 212/213 deliverable. merge ≠ live; after redeploy confirm domain consistency via `curl https://algo-su.com/sitemap.xml` / `robots.txt` <!-- doc-ref-lint: ignore -->
- **GA4 data stream URL consistency + Enhanced Measurement history page_view OFF + production page_view UAT** (user, carried from Sprint 210/211/212)
- **Run the ops Sprint 196 migration** (user/ops)
- **Review harness `--full` CI scheduled-run automation** (carried from Sprint 209)

## Critic Cross-Review

**R1 — one P2** (Codex, `codex review --base 35fb77d`, codex-cli 0.130.0 / gpt-5.5, session `019e81c1-7834-78e0-b531-8be1d75dd74d`)

> storage.ts `writeMap()`'s `localStorage.setItem` is unguarded, so on Safari private mode / quota exceeded it throws → when `finish()` calls `saveResult` before transitioning to the result screen, the flow drops into the route error boundary.

- **Action**: author fix `c289cb3` — added a try-catch guard to `writeMap` + a regression test. Handled consistently with the `readMap` fallback pattern, keeping `storage.ts` at 100% coverage. Persistence is secondary to result display, so best-effort handling is appropriate.
- Critical / High **0**.

**Final — CLEAN**. No regression after the P2 fix.
