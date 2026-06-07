---
sprint: 228
title: "Quiz Per-Category Question Lazy-Load Bundle Optimization"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-227", "sprint-224", "sprint-215"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "performance", "bundle-optimization", "ci", "codegen"]
tldr: "After Sprint 227 expanded the quiz to 350 questions (10 categories), the /[locale]/quiz route bundle grew from 40.2 to 84.8kB; this sprint converts to per-category dynamic import (lazy-load) to remove question data from the initial bundle. Root cause was the eager static ALL_QUESTIONS aggregation in index.ts — we removed that aggregation from the client barrel, supplied the synchronous counts via build-time codegen (question-counts.ts) guarded twice (CI freshness gate + real-data comparison test), made getRandomQuestions async (single category = 1 chunk, 'ALL' = Promise.all of 10 chunks), extracted shuffle to shuffle.ts (DRY), and isolated the eager synchronous API into all.ts (test-only). Loading UI reuses the existing SkeletonCard (0 new components). Result: route Size 84.8kB→13.6kB (−71.2kB, −84%). jest 1634 PASS (+79), global lines 88.0%/branches 79.4%. Frontend only + CI/codegen, merge ≠ live."
---
# Sprint 228 — Quiz Per-Category Question Lazy-Load Bundle Optimization

## Goal

- After Sprint 227 expanded the quiz to 350 questions (10 categories), the `/[locale]/quiz` route bundle grew from **40.2 to 84.8kB**; convert to per-category **dynamic import (lazy-load)** to remove question data from the initial bundle.
- Supply the per-category counts that the synchronous UI needs (to decide the question-count option) as lightweight metadata with no data load, while blocking drift/inaccuracy via **build-time codegen + dual guards**.
- Frontend only + CI/codegen — merge ≠ live (post-redeploy live verification carries over to the `quiz-ui-verification` runbook).

## Background

Sprint 227 expanded the CS quiz (`/quiz`) from 150 to 350 questions (10 categories) and recorded Lesson ⑤: "client-bundle question data scales linearly with pool size," leaving per-category lazy-load as a carry-over seed.

The root cause was the **eager static `ALL_QUESTIONS` aggregation** in `index.ts` (the client barrel). The barrel statically imported and aggregated all 10 category question modules (~270KB raw), so importing even a single thing from the barrel dragged the entire category dataset into the bundle. The prerequisite for code splitting is removing this eager aggregation from the client barrel.

Sprint 228 closes this gap.

## Decision

### D0. Confirmed Decisions (user)

- **Count supply = build-time codegen**: auto-generate `question-counts.ts` (no manual maintenance) and block drift with a CI freshness gate.
- **Loading UI = reuse existing SkeletonCard**: 0 new components.

### D1. Remove Eager Aggregation + Split the Data Layer (Wave A)

- **Root-cause fix**: remove the eager `ALL_QUESTIONS` aggregation from `index.ts` (the client barrel).
- **Dynamic loaders**: define `CATEGORY_LOADERS` (category → dynamic `import()` map) in `loaders.ts`.
- **Extract pure util (DRY)**: `shuffle` is a data-agnostic pure function, so extract it to `shuffle.ts` and share it between `index.ts` and `all.ts`.
- **Isolate the eager synchronous API**: move `ALL_QUESTIONS` / `getQuestionsByCategory` / `getQuestionsByFilter` (which need synchronous eager access) into `all.ts` (test/server-only). They are not imported on any client runtime path.

### D2. Synchronous Count Supply via Codegen (Wave A)

- `QuizStart` needs **synchronous counts** to decide the question-count option (5/10) (new categories have only 6 HARD questions < 10, so the option must be decided dynamically).
- To supply only the counts without loading the data, generate `question-counts.ts` via **build-time codegen** (`gen-quiz-counts.mjs`). The codegen reuses the text parser from `check-quiz-content.mjs` to extract per-category × per-difficulty counts.
- `counts.ts`'s `getAvailableCount` supplies counts from the generated `QUESTION_COUNTS` (no data load).

### D3. Make getRandomQuestions Async (Wave A)

- Convert `getRandomQuestions` to async:
  - **Single category**: dynamically load only that category's chunk.
  - **'ALL'**: `Promise.all` to load all 10 category chunks in parallel, then aggregate.
- Static `QUIZ_CATEGORIES` is derived from `Object.keys(QUESTION_COUNTS)` (lightweight metadata), not from the data.

### D4. Dual Guards (Wave A·D)

Block the risk of data (source) and counts (codegen artifact) drifting apart with two layers:

1. **CI freshness gate**: re-run `gen-quiz-counts.mjs` then `git diff --exit-code` to block artifact drift (fails if source changed but codegen wasn't re-run).
2. **Real-data comparison test**: `counts.test` compares the per-category × per-difficulty aggregation of the real data (`ALL_QUESTIONS`, via `all.ts`) against `QUESTION_COUNTS`.

### D5. UI Async Conversion (Wave B)

- `QuizStart`: supply counts via `getAvailableCount` (synchronous, no data load).
- `page.tsx`: make `start()` async + add a `'loading'` Phase + show the existing `SkeletonCard` (void wrapper). **0 new components.**

## Implementation

6 atomic commits total (start `30ff82b`):

| Commit | Agent | Content |
|--------|-------|---------|
| `faaf0c0` | Herald | Wave A — add `shuffle.ts` · `loaders.ts` (`CATEGORY_LOADERS` dynamic import map) · `all.ts` (eager, test-only) |
| `3eecbeb` | Herald | Wave A — add `gen-quiz-counts.mjs` (codegen, reuses check-quiz-content.mjs text parser) · `question-counts.ts` (artifact) |
| `59bf50a` | Herald | Wave A — `index.ts` barrel lazy-load refactor (remove eager, async `getRandomQuestions`, static `QUIZ_CATEGORIES=Object.keys(QUESTION_COUNTS)`) · `counts.ts` (`getAvailableCount`) |
| `03dbb86` | Scribe | Wave B — `QuizStart` `getAvailableCount` conversion · `page.tsx` async `start()` + `'loading'` Phase + `SkeletonCard` (void wrapper) |
| `fc6f3b7` | Herald | Wave C — 6 test files: `data-integrity` · `index` tests `../all` import + async conversion, `counts.test` (guard ②) · `loaders.test` new |
| `1874b92` | Librarian | Wave D — `ci.yml` codegen freshness gate · `package.json` `gen:quiz-counts` script |

## Verification

- **codegen idempotency**: YES (byte-identical across 2 runs). `question-counts`: original 5 categories 16/17/17=50, new 5 categories 7/7/6=20, total **350**.
- **tsc**: 0 errors (all files).
- **jest**: **1634 PASS / 0 FAIL** (Sprint 227 1555 → **+79**).
- **Global coverage**: lines **88.0%** / branches **79.4%** (gate 83/71 — pass).
- **next build**: "Compiled successfully". **`/[locale]/quiz` route Size 84.8kB → 13.6kB (−71.2kB, −84%)** — question data split into a separate on-demand chunk (confirmed in build output). First Load JS 308kB.
- **check-quiz-content --strict**: pass (0 regressions). CI freshness gate exits 0 locally.
- **ADR gates**: index count (sprint **166**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken

## Lessons

1. **An eager-aggregating barrel is the root obstacle to lazy-load** — if the client barrel statically imports and aggregates the data, importing even one thing drags the entire dataset into the bundle. Removing the data's static import from the barrel is the prerequisite for code splitting.
2. **Synchronous UI dependencies (counts) should be supplied as lightweight metadata separate from the data, but guard the drift** — splitting counts into a codegen artifact lets the synchronous UI render without loading the data. But source↔artifact drift/inaccuracy must be blocked with **dual guards (CI freshness gate + real-data comparison test)**.
3. **Route Size is the key tracking metric** — the build output confirmed data moved to an off-route on-demand chunk (84.8→13.6kB). Not "bundle size" but "route Size" is the objective indicator of lazy-load success.
4. **Auto-Critic's isolated review can BLOCK on "later-Wave not reflected" in multi-Wave work** — Auto-Critic reviews only a single commit set in isolation, so it does not know about later-Wave plans. The Wave A BLOCK (C1 page await · C2 QuizStart getAvailableCount · C3 test import) was all later-Wave B/C planned work, already resolved in `03dbb86`/`fc6f3b7`. **The final full-branch review is authoritative.**
5. **Async conversion needs 0 new components via a 'loading' phase + reusing the existing SkeletonCard** — the loading state from data async-ification can be absorbed by a dedicated phase + reuse of the existing skeleton, requiring no new UI component.

New patterns:
- **Lazy-load data layer pattern** — the client barrel exposes only lightweight metadata (counts) + dynamic loaders, while the eager aggregation is isolated in a separate test-only module (`all.ts`).
- **Codegen + dual-guard pattern** — a build-time artifact (`question-counts.ts`) + CI freshness gate (re-run gen + git diff) + real-data comparison test guarantee source↔artifact consistency.

## Sprint 229+ Carryover

- **(ops) Live `/quiz` verification after redeploy** — follow `docs/runbook/quiz-ui-verification.md` (221~227 UI/a11y/UX/question expansion + **228 loading skeleton**). Can be batched with the SP217 cutover frontend rollout.
- SP217 cutover / GA4 / Sprint 196 problem_db / harness --full cron — existing carryover retained.

## Critic Cross-Review

- **Tool**: Codex codex-cli (auto-queued Auto-Critic + per-Wave + final full-branch)

**Auto-Critic (per-Wave isolated review)**:
- **Wave A**: isolated review BLOCK verdict — C1 (page await) · C2 (QuizStart getAvailableCount) · C3 (test import). But all were later-Wave B/C planned work, already resolved in `03dbb86`/`fc6f3b7`. (Auto-Critic reviews only a single commit set in isolation, so it does not know about later Waves — Lesson ④.)
- **Wave C**: R1 CLEAN (0 P-findings) — *"limited to tests, consistent with async loading architecture."*
- **Wave D-1**: R1 CLEAN (0 P-findings) — *"freshness gate design is sound, idempotency guaranteed."*

**Final full-branch Critic**: run separately by Oracle just before merge (full branch = authoritative review).

**Overall verdict**: ✅ Mergeable — per-Wave BLOCKs were all later-Wave planned work and resolved; Wave C/D CLEAN. jest 1634 PASS + route Size −84% verified; coverage and ADR gates all pass.
