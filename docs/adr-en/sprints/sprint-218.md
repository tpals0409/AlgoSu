---
sprint: 218
title: "Quiz Validation (Code-Side Regression Safety Net)"
date: "2026-06-02"
status: completed
agents: [Oracle, Curator, Herald, Critic, Librarian]
related_adrs: ["sprint-215", "sprint-216", "sprint-217"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "identity", "quiz", "testing", "ci"]
tldr: "A safety-net sprint that validates and pins the CS quiz feature built across 215–217 (minigame core + 150 questions + logged-in record integration) from a code perspective rather than live. Because live behavior verification requires the ops identity_db migration:run + redeploy first (merge ≠ live), that is split out as ops carryover, and this sprint focuses on the regression safety net achievable on the code side. No new E2E infrastructure (Playwright) was introduced — the work extends the existing jest/RTL integration-test style. Curator re-reviewed all 150 question (5 categories × 30) explanations and found 0 factual errors, supplementing only 3 missing acceptedAnswers, and added content-lint rule 8 (post-normalization duplicate) and rule 9 (post-normalization empty string) as WARN-only. Herald pinned grade-scoring edge cases +8 (whitespace stripping, KO/EN mixing, full-width NFKC), play-flow integration +5 (guest/login branch covered in one file via a mutable mock flag), and an identity upsert boundary +1. 15 added tests total, 0 real bugs — every added test passes the existing 215–217 implementation exactly, confirming the grading logic, store, merge-up, best-effort fallback, and upsert higher-only behave as intended. 6 atomic commits. Verification: frontend tsc 0 / content-lint --strict exit 0 / 147 suites 1497 tests PASS, global lines 87.6%, branches 78.96% (gates cleared) / identity quiz-record 7 PASS, gateway 8 PASS. Both Critic rounds CLEAN. Start commit 4c8d3b7."
---
# Sprint 218 — Quiz Validation (Code-Side Regression Safety Net)

## Goal

- **Validate and pin** the CS quiz feature built across 215–217 (minigame core + 150 questions + logged-in record integration) **from a code perspective rather than live**.
- **Harden content accuracy, grading robustness, and the play flow into a regression safety net** so a later sprint touching that logic doesn't break it unguarded.
- **Split** live behavior verification and deployment into ops carryover (merge ≠ live). No new E2E infrastructure (Playwright).

## Background

[Sprint 215](./sprint-215.md), [216](./sprint-216.md), and [217](./sprint-217.md) focused on building the CS quiz feature, and the best records reached backend persistence per logged-in user ([identity_db](./sprint-217.md)). But two things remained.

- (a) **Live behavior verification** requires the ops `identity_db` `migration:run` + redeploy first (merge ≠ live, deploy is manual ops), so it cannot be verified directly in a code sprint.
- (b) **Some grading/play-flow boundaries** remained without a regression safety net, leaving them unguarded when a later sprint touches that logic.

So 218 focuses on the validation and safety net achievable on the code side. Live verification is tied to ops prerequisites, so it is split out as separate carryover ([[feedback-sprint-scoping]] — separating deploy-dependent work from code-side work).

## Decisions

### D0. Validation axis — strengthen the code-side regression safety net

Set the validation axis to **strengthening the code-side regression safety net**. Live behavior verification requires the ops `migration:run` + redeploy first, so it is split out as separate carryover. Rationale: merge ≠ live, and deploy is manual ops, so a code sprint cannot verify live directly. (User-confirmed)

### D1. E2E adoption — no Playwright; extend with jest/RTL integration tests

Do **not** introduce new browser E2E infrastructure (Playwright); extend the existing jest/RTL integration-test style. Rationale: new browser E2E infrastructure is itself a separate-sprint scope, and `page.test.tsx` integration tests can sufficiently cover the play flow (guest/login branch, merge-up, result screen). (User-confirmed)

### D2. Accept rule-8's 156 WARN in content lint (Oracle judgment)

**Accept the 156 WARNs** reported by content-lint rule 8 (`acceptedAnswers` duplicate after normalization) as-is. Rule 8 is WARN-only by design, so even under `--strict` it exits 0 (does not block CI), and the 156 are **visibility information** stemming from intentional notation pairs (`'이진 탐색'` + `'이진탐색'`, with/without space). To avoid a large content-churn risk, accept the current state and leave narrowing rule 8 to exact-string duplicates as optional follow-up carryover. (Oracle judgment)

## Implementation

Branch `test/sprint-218-quiz-validation`, start commit `4c8d3b7`, 6 atomic commits. Wave A (Curator content/lint) → Wave B·C·C-2 (Herald tests).

### Commits

| Hash | Content |
|------|---------|
| `d2f126b` | fix(frontend) — Curator: full re-review of all 150 question explanations (0 factual errors) + 3 `acceptedAnswers` supplements (ds-30 '순차표현' / os-02 '문맥전환' / os-20 '엘알유') |
| `4684c33` | chore(frontend) — Curator: add `check-quiz-content.mjs` rule 8 (post-normalization duplicate WARN) and rule 9 (post-normalization empty string WARN), both WARN-only (`--strict` exit 0) |
| `c7d368c` | chore(frontend) — Oracle: fix `normalizeAnswerJs` JSDoc Japanese→Korean (resolves Critic R1 Low observation) |
| `0c380c8` | test(frontend) — Herald: `grade.test.ts` +8 — pin whitespace stripping, KO/EN mixing, full-width NFKC, Hangul+digit regressions (19→27) |
| `9cb82d5` | test(frontend) — Herald: `page.test.tsx` +5 — guest/login branch integration tests via a mutable mock flag (6→11) |
| `4fe291b` | test(identity) — Herald: `quiz-record.service.spec.ts` +1 — boundary where `played_at` is not updated on a tie resubmission of upsertBest (6→7) |

### Wave A — Curator (content + lint)

- **Full re-review of all 150 question (5 categories × 30) explanations** (`d2f126b`): **0** factual errors. Supplemented only the missing `acceptedAnswers` — 3 of them: `ds-30` `'순차표현'` (the standard Korean notation for the array storage of a complete binary tree) / `os-02` `'문맥전환'` (a parallel phrasing of context switch) / `os-20` `'엘알유'` (the phonemic spelling of LRU, consistent with `ds-25`). Supplemented only the missing KO/EN/abbreviation entries without overfitting.
- **Add content-lint rules 8 & 9** (`4684c33`): rule 8 (WARN on `acceptedAnswers` duplicates after applying `normalizeAnswer`) and rule 9 (WARN on an empty string after normalization = never matches). Both **WARN-only** (`--strict` exit 0). Exports `normalizeAnswerJs` (a JS port of the `grade.ts` logic), `checkNormalizedDuplicates`, `checkEmptyNormalized`, `checkWarnOnlyRules`. Header comment updated 7→9. Rule 9 currently 0, rule 8 currently 156 (existing notation pairs, D2).

### Wave B — Herald (grading regression)

- **`grade.test.ts` +8** (`0c380c8`): strictly honoring the Sprint 216 lesson (no spamming of speculative cases), verified the **actual return** of the `normalizeAnswer` pipeline directly via `node -e`, then pinned **only the previously uncovered gaps**. Whitespace stripping (tab/newline/carriage return), KO/EN mixing (`'TCP 프로토콜'` → `'tcp프로토콜'`), full-width digit NFKC (`'２의보수'` · `'ＩＰｖ４'`), Hangul+digit (`'base64인코딩'`). 19→27 tests.

### Wave C — Herald (play-flow integration)

- **`page.test.tsx` +5** (`9cb82d5`): added the **auth branch** to an integration test that previously covered only the guest path. A mutable `mockIsAuthenticated` flag + mocking `@/lib/api/client` `fetchApi` + pre-seeding `createLocalStorageQuizStore`. Scenarios:
  1. **Replay best display** — perfect score → badge; tie replay → no badge (higher-only).
  2. **Authenticated apiStore completion** — server `POST` called, result correct.
  3. **merge-up idempotency** — 1 localStorage record → 1 `POST` on mount → still 1 on re-render (`ref` flag).
  4. **Per-difficulty record separation** — key `${category}::${difficulty}`, `DATA_STRUCTURE::ALL` present / `::EASY` absent.
  5. **No result-screen crash when the api-store network fully fails** (best-effort).
  - 6→11 tests.

### Wave C-2 — Herald (identity upsert boundary)

- **`quiz-record.service.spec.ts` +1** (`4fe291b`): the boundary where `played_at` is **not updated on a tie resubmission** of `upsertBest` (`WHERE best_score_percent < EXCLUDED` does not include equality). Fills the gap where the existing spec covered only lower scores. 6→7 tests.

### Oracle direct (resolving a Critic observation)

- **Fix `normalizeAnswerJs` JSDoc Japanese→Korean** (`c7d368c`): Critic R1 Low observation. No change to code behavior.

## Verification

Oracle direct re-confirmation:

**Frontend**

- `tsc --noEmit` → 0
- `check-quiz-content.mjs --strict` → **exit 0** (rules 1–7 pass, rules 8 & 9 WARN-only)
- `jest --coverage` → **147 suites · 1497 tests PASS / 0 fail**, global lines **87.6%** (gate 83) · branches **78.96%** (gate 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` 37.5kB (same as 217 — test-only, so the bundle is unchanged)
- `next lint` → 0 errors (only the existing `sonner`·`useAutoSave` warnings, unrelated to the quiz)

**Identity / Gateway**

- identity quiz-record **7 PASS** / gateway quiz-record **8 PASS**

## Lessons

1. **A validation sprint "lets the test verify current behavior first, then pins only the gaps"** — no spamming of speculative cases (re-confirming the Sprint 216 lesson). Herald checked the actual return of `normalizeAnswer` via `node -e` and added **only the uncovered gaps**, laying a regression safety net that meshes exactly with the grading pipeline's current behavior.
2. **A WARN-only lint rule surfaces risk without blocking intentional notation diversity** — rules 8 & 9 **surface** post-normalization duplicates/empty strings **but keep them separate from the hard gate**. Intentional notation pairs like with/without-space synonyms (`'이진 탐색'` + `'이진탐색'`) are not blocked, while accidental empty normalizations or exact duplicates are revealed.
3. **Abstraction boundaries make validation possible without live** — thanks to the `QuizRecordStore` interface (215) and the pure-function `grade` (215), the play flow and grading could be verified with unit/integration tests without a live deploy. An abstraction boundary also raises testability.
4. **Splitting validation/safety-net work from live-deploy dependence lets it proceed independently without waiting on deploy** — live behavior verification is tied to the ops `migration:run`, so it is split out as carryover, while the code-side regression safety net was completed independently as a mergeable unit.

## New Patterns

- **Mutable-mock-flag-based auth-branch integration test** — `let mockIsAuthenticated` + the global/nested `beforeEach` ordering covers both the guest and login paths **in one file without contamination**. Mocking `fetchApi` + pre-seeding `createLocalStorageQuizStore` integration-verifies the authenticated-user flow (server POST, merge-up idempotency, best-effort fallback) without live.

## Sprint 219+ Carryover

- **Run the ops `identity_db` `migration:run` (SP217 `quiz_records`) + server redeploy + live `/quiz` E2E verification** (user/ops, important): merge ≠ live. Apply `20260602000000-SP217-CreateQuizRecords` to the ops `identity_db`, then after redeploy play `/quiz` while logged in → confirm cross-device best sync, per-difficulty records, and merge-up behavior.
- **Narrow rule 8 to exact-string duplicates** (optional, D2): a follow-up that narrows the WARN to fully identical string duplicates, excluding intentional with/without-space synonym pairs.
- **Strengthen the api-store GET cache-hit assertion** (Critic P4): strengthen the GET cache-hit assertion in auth scenario 2.
- **GA4 data stream URL consistency + Enhanced Measurement history page_view OFF + production page_view UAT** (user, carried from Sprint 210/211/212)
- **Run the ops Sprint 196 `problem_db` migration** (user/ops)
- **Review harness `--full` CI scheduled-run automation** (carried from Sprint 209)

## Critic Cross-Review

**Curator R1 — CLEAN** (Codex gpt-5.5, `codex review --base 4c8d3b7`, codex-cli, session `019e868a-23c9-7b61-8e16-188caf469a80`)

- Critical / High / Medium / Low **0**.
- Observation [Low] `normalizeAnswerJs` JSDoc Japanese → resolved by `c7d368c`. [Info] confirmed the intent of rule 8's 156 WARN (D2).

**Herald R1 — CLEAN** (Codex gpt-5.5, `codex review --base c7d368c`, session `019e869e-8a0a-72c2-a036-4ddace7ea102`)

- Critical / High / Medium / Low **0**.
- Test-only; the mock design matches the page's execution flow exactly and the test-contamination-prevention structure is complete.
- P4 (non-blocking) — the GET cache-hit assertion in auth scenario 2 is not strengthened (carried over).

**Final — CLEAN**. Both rounds 0 Critical/High/Medium/Low; only the non-blocking P4 carried over.
