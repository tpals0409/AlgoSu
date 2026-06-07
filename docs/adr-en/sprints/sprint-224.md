---
sprint: 224
title: "Quiz UX Deepening (radiogroup Upgrade + Per-Category Stats Visualization + Transition Motion)"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222", "sprint-223", "sprint-217"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "A frontend-only sprint deepening the UX of the CS quiz (/quiz) — already visually and a11y-canonical after Sprints 221–223 — across three independent waves. (Wave A) Upgrade QuizStart's three single-select groups (category, difficulty, count) from button+aria-pressed to the ARIA radiogroup pattern (role=radiogroup/radio + aria-checked + roving tabindex + Arrow/Home/End keys), extracting the shared pattern into a quiz-local helper PillRadioGroup, keeping existing active styles for zero visual change (Sprint 222 carryover). (Wave B) Add a 'Your Records' section (QuizStats) at the bottom of the start screen summarizing per-category best accuracy as accent-colored bars — page.tsx fetches store.getAllBest() on idle, aggregates via aggregateCategoryBests (pure function), passes a stats prop, auto-branches login=API/guest=local, and api-store gains in-flight dedup. (Wave C) Add only a .animate-fade-in-up utility reusing the existing fadeInUp keyframe for question/feedback transition entrances (0 new keyframes, respecting global reduced-motion). 0 new design tokens, 0 new components/ui, 2 new i18n keys (stats.title/scoreAria, ko+en). Critic 3 rounds (R1 P2×2, R2 P2×1 → R3 CLEAN): block prototype-inherited category keys + gate the stats GET behind merge-up completion (auth-only) to remove stale display and cache pollution. merge≠live (separate ops carryover)."
---
# Sprint 224 — Quiz UX Deepening

## Goal

- Deepen additional UX of the CS quiz (`/quiz`), whose visuals and accessibility were completed in Sprints 221–223.
- User-confirmed scope: **all three areas** — (A) radiogroup upgrade of category/difficulty pills, (B) per-category stats visualization, (C) transition motion deepening.
- Frontend-only — no data/schema/backend change. 0 new design tokens, 0 new `components/ui`. Regression tests included, coverage gate (83/71) maintained. `/quiz` is auth-gated, so live verification is a separate ops carryover (merge ≠ live).

## Background

Sprint 222 (D1) kept QuizStart's category/difficulty pills as `button` + `aria-pressed` and carried over the radiogroup upgrade to minimize regression risk. Sprint 223 canonicalized the shared progress wrapper's a11y gap. This sprint absorbs that carried-over item (radiogroup) and, at the user's request, also deepens stats visualization and motion.

## Decisions

### Wave A — radiogroup Upgrade

- **D-A1**: Upgrade the three single-select groups (category, difficulty, count) to the ARIA radiogroup pattern. Container `role="radiogroup"` + `aria-labelledby` (`useId` label link), each pill `role="radio"` + `aria-checked` (drop `aria-pressed`), **roving tabindex** (only the selected item `tabIndex=0`, rest `-1`), keyboard `←/→/↑/↓` wrapping move + select, `Home`/`End`.
- **D-A2**: Extract the pattern shared by the three groups into a quiz-**local** helper component `PillRadioGroup` (`components/quiz/`) — not under `components/ui/`, avoiding the Palette UI-guide trigger. Visual styles (accent/semantic) are injected by callers via `className`/`style` callbacks → **zero visual change**, 0 new tokens/keyframes.

### Wave B — Stats Visualization

- **D-B1**: A "Your Records" section (`QuizStats`, quiz-local) at the bottom of the start screen (idle) summarizing per-category best accuracy as accent-colored bars. Each bar has `role="progressbar"` (aria-valuenow/min/max) + per-category `aria-label`; accent color is an inline `var()` token.
- **D-B2**: Aggregation is a pure function `aggregateCategoryBests` (`lib/quiz/stats.ts`) — folds `getAllBest()`'s `${category}::${difficulty}` composite keys per category to the across-difficulty best score, sorts descending, ignores unknown/corrupt keys. `page.tsx` fetches on idle and passes a `stats` prop to `QuizStart` (login=API/guest=local auto-branch). Hidden when there are no records.
- **D-B3**: Add **in-flight dedup** to `api-store` `fetchAllBest` — even when the start-screen stats GET and `getBest` GET fire concurrently, the server request collapses to one.

### Wave C — Motion Deepening

- **D-C1**: Apply a subtle upward-slide entrance to question (`QuizQuestion`) / feedback (`QuizFeedback`) transitions. Add only a `.animate-fade-in-up` utility **reusing the existing `fadeInUp` keyframe** (0 new keyframes). The global `reduced-motion` media query disables motion, so it is accessibility-safe.

### Restraint

- 0 new design tokens · 0 new `components/ui` (all quiz-local) · 0 new keyframes · 2 new i18n keys (`stats.title`/`stats.scoreAria`, ko+en).

## Implementation

### Deliverables (by Wave)

6 atomic commits total (start `bdd989f`):

| Wave | Agent | Commit | Content |
|---|---|---|---|
| A | Herald | `303b874` | `PillRadioGroup` (new) + QuizStart 3-group radiogroup upgrade + QuizStart.test radio semantics/roving tabindex/arrow nav regressions (13→16) |
| A follow-up | Herald | `933cf9f` | `PillRadioGroup` `moveTo` focus optional-chaining null branch `istanbul ignore` (ref-always-attached convention) — branch 100% |
| B | Scribe | `25a4ea8` | `stats.ts` (pure aggregation) · `QuizStats` (new) · `api-store` in-flight dedup · `page.tsx` idle stats fetch · `QuizStart` stats prop · 2 i18n keys · tests (stats +6, QuizStats +6, api-store +1, page auth-path stats GET) |
| C | Herald | `5275bdd` | `globals.css` `.animate-fade-in-up` (reusing fadeInUp) · `QuizQuestion`/`QuizFeedback` transition motion |
| Critic R1 | Herald | `7b24be5` | [P2×2] `stats.ts` category-key check `in`→own-key (block prototype keys) + regression test / `page.tsx` gate stats GET behind merge-up completion |
| Critic R2 | Herald | `48a8a32` | [P2] redesign the stats gate to be **auth-only** (`isAuthenticated && !mergeUpDone`) — block early GET on guest→login transition (effect-snapshot-safe) |

### Change Details

- **`PillRadioGroup.tsx` (new, Wave A)**: Generic single-select pill group. `role=radiogroup`/`radio` + `aria-checked` + roving tabindex + Arrow/Home/End handling. Styles injected via caller callbacks.
- **`QuizStart.tsx` (Wave A·B)**: Three manual `<fieldset>` pills → three `PillRadioGroup` (zero visual change). Receives `stats` prop → renders `<QuizStats>`.
- **`stats.ts` (new, Wave B)**: `aggregateCategoryBests` — composite key → per-category best. own-key check blocks corrupt keys (Critic R1).
- **`QuizStats.tsx` (new, Wave B)**: Per-category accent bar summary. Returns `null` on empty array (parent hides).
- **`api-store.ts` (Wave B)**: `fetchAllBest` in-flight dedup (concurrent GETs collapse to one).
- **`page.tsx` (Wave B·Critic)**: idle stats fetch effect. Authenticated users fetch only after the merge-up completion (`mergeUpDone`) gate (Critic R1/R2) — guests skip the gate for transition safety.
- **Motion (Wave C)**: `.animate-fade-in-up` utility (globals.css) + `QuizQuestion`/`QuizFeedback` application.

## Verification

- **tsc**: 0 errors.
- **ESLint** (real `next lint` binary): **0 errors / 487 warnings** (Sprint 222 483 → +4, all `react/forbid-dom-props` — accent `var()` token inline styles, the same intended exception as the 459 existing instances like DifficultyBadge).
- **jest**: **1533 tests PASS** (Sprint 223 1514 → +19). quiz components/lib **100/100/100/100** (`PillRadioGroup`·`QuizStats`·`QuizStart`·`stats.ts`·`api-store`). Global lines **88.01%**/branches **79.31%** (gate 83/71).
- **next build**: ✓. `/[locale]/quiz` **40.2 kB** (Sprint 223 39.4 → +0.8 — QuizStats·PillRadioGroup·motion).
- **ADR gates**: index count (sprint **162**, --strict) / adr-en coverage (sprint-224 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **Upgrading single-select groups to radiogroup with a shared helper achieves zero visual change and minimal regression at once** — collapsing the three repeated patterns into `PillRadioGroup` implements a11y (roving tabindex, arrow keys) once while keeping the existing active tones via callback-injected styles. Placing it in the domain-local `components/quiz` (not `components/ui`) also avoids the Palette UI-guide trigger.
2. **Unvalidated storage keys must be whitelisted via own-key checks, not `in`** (Critic R1) — `categoryStr in META` also matches prototype-inherited keys (`toString`, `__proto__`), letting a corrupt localStorage key pass as a valid category and crash on meta dereference. Use `Object.prototype.hasOwnProperty.call` for own-keys only.
3. **Background sync (merge-up) and concurrent reads must be serialized with a gate to avoid stale display and cache pollution** (Critic R1) — if the stats GET runs in parallel with the merge-up POST, it reads pre-merge server state and an in-flight GET can repopulate the invalidated cache with a stale value. Gate stats fetching until merge-up completes.
4. **A React effect gate is a "snapshot" — a same-commit setState reset cannot block it** (Critic R2) — calling `setGate(false)` in the transition commit doesn't change the gate value the other effects of that commit already captured. The fix is not a reset but **designing the gate condition so guests never open it** — applying it only as `isAuthenticated && !mergeUpDone` keeps the gate closed (false) for guests, so it stays safe right after the transition.
5. **Concurrent cache reads collapse into one request via in-flight dedup** — if the start-screen stats GET and `getBest` GET fire concurrently on a cache miss, duplicate GETs occur. Sharing the in-flight promise in `fetchAllBest` converges concurrent callers to a single network request.

New patterns:
- **PillRadioGroup pattern** — a generic single-select pill group helper (radiogroup + roving tabindex + arrow keys; domain-local, style-callback injection).
- **merge-up gate (auth-only) pattern** — block reads until background sync completes, but apply the gate only to authenticated users to keep the transition snapshot-safe.

## Sprint 225+ Carryover

- **(ops) Live `/quiz` verification after redeploy** — visual/screen-reader check of the UI redesign (221), a11y (222/223), and **UX deepening (224: radiogroup keyboard nav, stats bars, transition motion)**. Handle in the same frontend rollout (merge ≠ live).
- **(ops) SP217 cutover** — per `sp217-quiz-records-cutover.md`, roll out identity → gateway → frontend + live `/quiz` E2E (6 items) (user/ops, important).
- GA4 admin (stream URL, history page_view OFF, production UAT) — user-direct.
- Ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- Harness check-up `--full` CI periodic automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

- **Tool**: Codex codex-cli 0.130.0, `codex review --base bdd989f -c model=gpt-5.5`
- **Rounds**: 3

**R1 — Critical/High 0 · [P2] 2 findings**:
- [P2] `stats.ts:44` — `categoryStr in QUIZ_CATEGORY_META` matches prototype-inherited keys (`toString::ALL`·`__proto__::ALL`) → corrupt key passes as valid category, risking `getQuizCategoryMeta` undefined dereference. → `7b24be5` replaced with own-key check + regression test.
- [P2] `page.tsx:113-114` — the authenticated stats GET runs in parallel with the merge-up POST → stale display and cache pollution. → `7b24be5` gated behind merge-up completion.

**R2 — original 2 P2 confirmed resolved · new [P2] 1 finding**:
- [P2] `page.tsx:83-85` — on guest→login transition the gate stays open, allowing an early GET. → `48a8a32` redesigned the gate as auth-only (`isAuthenticated && !mergeUpDone`) for transition snapshot safety.

**R3 — CLEAN** (0 P-findings): *"I did not identify any discrete, introduced issues that would break existing behavior or tests. The new stats aggregation/display and API in-flight deduplication appear consistent with the surrounding quiz storage flow."*

**Overall verdict**: ✅ Mergeable — over three rounds all 3 P2 findings (block prototype keys, merge-up gate, auth-only gate) were fixed, Critical/High 0, final CLEAN.
