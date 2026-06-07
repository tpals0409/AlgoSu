---
sprint: 229
title: "Quiz 'ALL' Mode Loading UX Improvement (Progress Bar + Prefetch + Error Toast)"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-228", "sprint-227", "sprint-224"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "ux", "lazy-load", "i18n"]
tldr: "After Sprint 228's lazy-load conversion (route 84.8→13.6kB), the 'ALL' mode (default) loads 10 category chunks in parallel via Promise.all while showing only a static SkeletonCard (no progress indicator); on a dynamic import failure it returns to idle (SP228 P2) but with no user-visible feedback. This sprint improves the loading UX along 3 axes: ① add a sonner toast (toast.error) to the start() catch to surface dynamic import failure as user-visible feedback (Toaster already mounted, 0 new infra) ② add an onProgress(loaded,total) callback to getRandomQuestions as the 5th positional arg (rng stays 4th, backward compatible) so each chunk load updates page state, visualized in a new QuizLoading component (quiz-local, reuses Progress+SkeletonCard → 0 new tokens) progress bar ③ add a new prefetchQuestions(category) export (fire-and-forget, error swallowed) warmed on the QuizStart Start button hover/focus (dynamic import cache reuse → reduced perceived loading). Includes a total=0 division guard. jest 1649 PASS (+14), global lines 88.07%/branches 79.39%, route /[locale]/quiz 13.9kB (+0.3kB, no lazy-load regression). Frontend only, merge ≠ live."
---
# Sprint 229 — Quiz 'ALL' Mode Loading UX Improvement (Progress Bar + Prefetch + Error Toast)

## Goal

- After Sprint 228's per-category lazy-load conversion (`/[locale]/quiz` route 84.8 → 13.6kB), improve the 'ALL' mode (default) loading UX along **3 axes** (error feedback / progress indicator / prefetching).
- Handle it with 0 new design tokens + 0 new infra + 0 new `components/ui` (quiz-local only), without regressing Sprint 228's lazy-load (route Size).
- Frontend only — merge ≠ live (post-redeploy live verification carries over to the `quiz-ui-verification` runbook).

## Background

Sprint 228 converted question data to dynamic import via `CATEGORY_LOADERS` at start time, removing it from the initial bundle (route 84.8→13.6kB). However, the 'ALL' mode (default) loads 10 category chunks in parallel via `Promise.all`, during which the user sees **only a static `SkeletonCard`** (no progress indicator). Also, when a dynamic import fails, the Sprint 228 P2 fix returns to `idle`, but with **no user-visible feedback** (on stale chunk / offline / CDN failure it silently returns to the start screen).

Sprint 229 closes this loading UX gap along 3 axes.

## Decision

### D0. Confirmed Decisions (user)

- **Include all three axes** — error feedback + progress indicator + prefetching.
- **Loading UI = progress bar** — reuse the existing Radix `Progress`.
- **Prefetch trigger = Start button hover/focus.**

### D1. Error Feedback = sonner toast (Wave C)

- Add `toast.error(t('start.loadError'))` to the `start()` catch to reinforce Sprint 228 P2's `idle` return with **user-visible feedback**.
- sonner's `Toaster` is already mounted in `AppLayout`, so **0 new infra**.

### D2. Loading Progress = onProgress Callback + QuizLoading Progress Bar (Wave A·B·C)

- Add `onProgress(loaded, total)` to `getRandomQuestions` as the **5th positional optional arg** (`rng` stays 4th → **backward compatible**). Increment `loaded` in each chunk's `.then` and invoke the callback.
- `page.tsx` receives progress as `loadProgress` state and visualizes it in the new `QuizLoading` (quiz-local component — not `components/ui` → avoids the Palette trigger) progress bar.
- Reuses the existing `Progress` (Radix) + `SkeletonCard` → **0 new design tokens**.

### D3. Prefetching = prefetchQuestions fire-and-forget (Wave A·D)

- Add a new `prefetchQuestions(category)` export — **fire-and-forget** (result discarded, error swallowed).
- On the `QuizStart` Start button `onMouseEnter` / `onFocus`, warm the currently selected `category` chunk. Since dynamic imports are cached, the click reuses it → **reduced perceived loading**.
- The actual load failure is surfaced as a toast not in prefetch but in the main path `start()`'s `getRandomQuestions` (prefetch swallows the error → user-path feedback is guaranteed by D1).

### D4. total=0 Division Guard (Wave B)

- `QuizLoading` computes `total > 0 ? round(loaded / total * 100) : 0` to safely handle the division in the initial snapshot (total not yet set).

## Implementation

6 atomic commits total (start `834d07c`):

| Commit | Wave | Content |
|--------|------|---------|
| `eae614c` | A | `data/quiz/index.ts` — add `onProgress` 5th positional to `getRandomQuestions` + new `prefetchQuestions(category)` export (fire-and-forget) |
| `d34bb99` | B | new `components/quiz/QuizLoading.tsx` — `Progress` (Radix) + `aria-live` title + `SkeletonCard`, total=0 guard |
| `94eab78` | C | `page.tsx` — `loadProgress` state, `onProgress` wiring, `start()` catch `toast.error`, `SkeletonCard` → `QuizLoading` |
| `3608f64` | D | `QuizStart.tsx` — call `prefetchQuestions` on Start button hover/focus |
| `0ae0d87` | E | `messages/{ko,en}/quiz.json` — `start.loadError` + `loading` namespace (`title`/`progress`/`progressAria`) |
| `2c01053` | F | tests — `index` (onProgress ALL 0..10 · single 0..1 · prefetch reject swallow) · `page` (loading=QuizLoading progressbar · toast.error on reject regression) · `QuizLoading` new (6) · `QuizStart` (hover/focus/per-category prefetch spy) |

## Verification

- **tsc**: 0 errors (all files).
- **jest**: **1649 PASS / 0 FAIL** (Sprint 228 1635 → **+14**).
- **Global coverage**: lines **88.07%** / branches **79.39%** / statements **87.56%** / functions **85.23%** (gate 83/71/81/82 — pass).
- **next lint**: 0 errors.
- **next build**: "Compiled successfully". **`/[locale]/quiz` route Size 13.9kB** (vs Sprint 228 13.6kB, +0.3kB — question data still split into an off-route on-demand chunk, **no lazy-load regression**).
- **i18n**: ko/en 52 keys consistent.
- **ADR gates**: index count (sprint **167**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken

## Lessons

1. **Lazy-load async loads should expose progress in the 'loading' phase to improve perception** — exposing off-route data chunks as N/total via an `onProgress` callback lets users see the progress of the 'ALL' parallel load. The new component reuses the existing `Progress` + `SkeletonCard` combo for 0 tokens.
2. **Prefetching should be separated as fire-and-forget + error swallow, but the actual failure must be surfaced as a toast on the main path** — even if prefetch swallows the error, the user path (`getRandomQuestions`) must guarantee feedback. Separate the responsibility but don't drop the feedback.
3. **User feedback for dynamic import failure is only complete when made visible via a toast in addition to the idle return (SP228 P2)** — a silent idle return alone leaves the user unaware of what happened.
4. **A progress component requires a total=0 division guard** — if total is still 0 in the initial snapshot, `loaded/total` becomes NaN/Infinity, so a `total > 0` guard returns 0%.

New patterns:
- **Lazy-load progress + prefetch UX pattern** — add an `onProgress` callback to the data layer (backward-compatible positional) + a loading component that reuses the existing `Progress` + a hover/focus fire-and-forget prefetch.

## Sprint 230+ Carryover

- **(ops) Live `/quiz` verification after redeploy** — follow `docs/runbook/quiz-ui-verification.md` (221~227 UI/a11y/UX/question expansion + **228 loading skeleton + 229 progress bar/error toast**). Can be batched with the SP217 cutover frontend rollout.
- SP217 cutover / GA4 / Sprint 196 problem_db / harness --full cron — existing carryover retained.

## Critic Cross-Review

- **Tool**: Codex codex-cli (per-Wave Auto-Critic + final full-branch)

**Final full-branch Critic**: run separately by Oracle just before merge (full branch = authoritative review) — focusing on async progress callback consistency · prefetch error swallow · toast feedback · total=0 guard.

**Overall verdict**: ✅ Mergeable — jest 1649 PASS (+14), route Size 13.9kB (no lazy-load regression), coverage / i18n / ADR gates all pass.
