---
sprint: 216
title: "Broad Question Bank + Setter UX (3-Sprint Roadmap 2/3)"
date: "2026-06-02"
status: completed
agents: [Oracle, Curator, Architect, Librarian, Critic]
related_adrs: ["sprint-215"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "quiz", "content", "ci"]
tldr: "Roadmap step 2/3 of a 3-sprint plan that fills in content and diversifies the setter UX on top of the Sprint 215 quiz minigame core. Because 215 forward-declared the QuizCategory enum (NETWORK/OS/DATABASE), the i18n categories keys, the dynamic category rendering in QuizStart, the getRandomQuestions shuffle, and the difficulty field, 216 was completed with no new abstraction — only (1) filling in content, (2) exposing the already-laid difficulty as setter UX, (3) auto-validating content quality, and (4) shoring up a grading-normalization edge. The bank was expanded to 30 questions per category across 5 categories = 150 total (including a 12→30 even backfill for DS/ALGO), and a category + difficulty filter was added. A getQuestionsByFilter(category, difficulty) helper was introduced, and difficulty ('ALL' default) was added to the getRandomQuestions signature with rng pushed to the 4th argument to preserve test injection. The best-record key stays at category granularity (per-difficulty branching is a storage-schema change, deferred to 217). Because the bank grew, a check-quiz-content.mjs content lint (7 rules) was added and wired into the CI quality-frontend job, and grading normalization added .normalize('NFKC') at the front of the pipeline to fold only full-width characters. Zero backend; frontend-only. The Critic cross-review will run at the merge gate via codex review --base d431dcf."
---
# Sprint 216 — Broad Question Bank + Setter UX (3-Sprint Roadmap 2/3)

## Goal

- Fill in a **broad question bank** on top of the Sprint 215 minigame core — 30 questions per category across 5 categories = 150 total.
- Expose the `difficulty` field that 215 forward-declared as **setter UX (a difficulty filter)**.
- Because the bank grows, **gate content quality in code** — wire a schema/duplicate/omission lint into CI.
- Verify the **actual gap** in grading normalization, then shore it up minimally (no speculative additions).

## Background

[Sprint 215](./sprint-215.md) completed the core play loop of the CS quiz minigame and, with later sprints in mind, **forward-declared** the following:

- `NETWORK` / `OS` / `DATABASE` in the `QuizCategory` enum (content not yet loaded)
- i18n `categories` keys (all-category labels, ko/en)
- **Dynamic category rendering** in `QuizStart` (iterates the enum → added categories surface automatically)
- The `getRandomQuestions` shuffle logic
- A `difficulty` field on the question type (value present, UX not yet exposed)

So 216 is **not a sprint that invents new code**. On top of the already-laid skeleton, it does only this: (1) fill in content, (2) expose the existing `difficulty` as setter UX, (3) auto-validate the quality of the growing content, and (4) shore up grading-normalization edges. The backend record integration is deferred to Sprint 217 per the roadmap recorded in [[sprint-window]], and 216 is **frontend-only**.

Position in the 3-sprint roadmap ([[feedback-sprint-scoping]]):

- **Sprint 215**: frontend minigame core (short-answer grading + play loop + a PoC of two categories' 24 questions).
- **Sprint 216 (this sprint)**: a broad question bank (5 categories, 150 questions) + setter UX (difficulty filter) + content lint + grading-normalization shoring.
- **Sprint 217**: logged-in record integration (a QuizRecord entity + migration). Swap the `storage.ts` abstraction for a server API.

## Decisions

### D0. Content volume — 30 per category (150), even backfill across all categories

Expand to **30 questions per category, 150 total** across 5 categories (Data Structures / Algorithms / Network / Operating Systems / Database). The Data Structures and Algorithms categories, which held 12 each as a PoC in 215, are **evenly backfilled 12→30** so every category has the same depth. The user explicitly chose (a) 30/category, (b) an even backfill across all categories, and (c) adding a difficulty filter.

### D1. Difficulty filter — expose the forward-declared difficulty as setter UX

Expose the `difficulty` field that has existed in `types.ts` since 215 as setter UX.

- Introduce a `getQuestionsByFilter(category, difficulty)` helper (inheriting the existing `getQuestionsByCategory` pattern).
- Add `difficulty` (`'ALL'` default) to the `getRandomQuestions` signature, but **move `rng` to the 4th argument** to preserve the deterministic rng injection used by tests. Thanks to the `'ALL'` default, existing calls and tests are non-regressing.
- Add a difficulty `fieldset` to `QuizStart` (reusing the existing `aria-pressed` toggle pattern, **zero new ui** — preserving Palette authority).

### D2. best-record key — keep category granularity (no per-difficulty branching)

The best-record key stays at **category granularity** and does not branch per difficulty. A per-difficulty best entails a `storage` schema change, so **design it together with the Sprint 217 server integration**. 216 leaves `storage.ts` unchanged, honoring the 217-carryover boundary set in 215.

### D3. Content lint — add check-quiz-content.mjs + wire into CI

When the bank grows to 150 questions, manual review hits a clear limit. Add the quality auto-validation script `frontend/scripts/check-quiz-content.mjs` and wire it into the CI `quality-frontend` job.

- **Text-parsing approach** — `.ts` cannot be imported directly (avoiding a build dependency), so parse the data files as text using only node builtins.
- **7 rules** — ① duplicate id ② id naming ③ empty `acceptedAnswers` ④ missing ko/en ⑤ category enum match ⑥ allowed difficulty values ⑦ minimum 30 questions per category.
- On a `--strict` violation, `exit 1` makes it a CI hard gate.

### D4. Grading normalization — add only NFKC full-width folding (no speculative additions)

The current `normalizeAnswer` **already absorbs** hyphens/underscores/repeated whitespace (the regex strips characters other than Hangul/Latin/digits). So these get only a regression-pinning test, with the logic untouched. The actual gap is **full-width characters** — add `.normalize('NFKC')` at the **front** of the pipeline to fold full-width alphanumerics/symbols/whitespace (e.g. `ＳＱＬ` → `sql`). Automatic synonym mapping carries an overfitting risk and is not added; input variance is absorbed via the explicit `acceptedAnswers` array (inheriting the 215 decision).

## Implementation

Branch `feat/sprint-216-quiz-content-bank`, start commit `d431dcf`, 4 atomic commits. Frontend-only (zero backend).

### Data (`src/data/quiz/`)

- `data-structure.ts` / `algorithm.ts` — evenly backfilled 12 → **30 questions**
- `network.ts` / `os.ts` / `database.ts` — new categories, **30 questions** each
- `index.ts` — merge new categories + add `getQuestionsByFilter`

5 categories, **150 questions** total.

Per-category difficulty distribution:

| Category | Easy | Medium | Hard |
|----------|------|--------|------|
| Data Structures (DS) | 10 | 11 | 9 |
| Algorithms (ALGO) | 6 | 6 | 6 |
| Network (NET) | 12 | 13 | 5 |
| Operating Systems (OS) | 10 | 15 | 5 |
| Database (DB) | 9 | 13 | 8 |

> The distribution skew is unrelated to the lint's minimum count (30 per category); it is accepted as the natural distribution of CS fundamentals.

### Logic / UI

- `getQuestionsByFilter(category, difficulty)` helper (D1)
- `getRandomQuestions(category, count, difficulty='ALL', rng)` — added `difficulty` + moved `rng` to the 4th argument (D1)
- `QuizStart` difficulty `fieldset` (reusing the existing toggle pattern, zero new ui) + `page.tsx` filter passthrough + i18n keys

### Content lint / CI

- `frontend/scripts/check-quiz-content.mjs` — a 7-rule text parser, `exit 1` on `--strict` violation (D3)
- Added a lint step to the `.github/workflows/ci.yml` `quality-frontend` job

### Grading normalization

- Added `.normalize('NFKC')` at the front of the `grade.ts` `normalizeAnswer` pipeline + full-width/hyphen/underscore/repeated-whitespace regression tests (D4)

### Commits

| Hash | Content |
|------|---------|
| `1b3095a` | Wave A — 5 categories, 150 questions (DS/ALGO 12→30, new network/os/database 30 each) + index merge |
| `51230d9` | Wave B — difficulty filter UX (getQuestionsByFilter, QuizStart fieldset, page.tsx, i18n) + test updates |
| `680d4af` | Wave C — check-quiz-content.mjs content lint + ci.yml quality-frontend step |
| `7197d0b` | Wave D — grade.ts NFKC normalization + regression tests |
| `f2bdafd` | Critic R1 P2 fix — cap count options to the available pool (QuizStart) |

## Verification

Oracle direct verification (after the Critic R1 P2 fix):

- `tsc --noEmit` → 0
- `next lint` → 0 errors / 0 warnings
- `node frontend/scripts/check-quiz-content.mjs --strict` → **150 questions PASS (exit 0)**, 30 per category confirmed
- `jest --coverage` → **146 suites · 1474 tests PASS / 0 fail** (JEST EXIT 0, clears the thresholds), global lines **87.47%** · branches **78.9%** (clears the 83% / 71% gate)
- **The 5 quiz components, `grade`, `storage`, and the `data/quiz` index all at 100% coverage**
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` 36.9kB (up from 215's 12.4kB, reflecting the 150 questions)

## Lessons

1. **Forward declaration lowers the cost of later sprints** — because 215 laid the enum / i18n / dynamic rendering / `difficulty` field in advance, 216 was completed with only content fill + UX exposure (zero new abstraction). When splitting a roadmap, forward-declaring in an earlier sprint the skeleton that a later sprint will fill structurally lowers the downstream cost.
2. **Preserve test-injection arguments when extending a signature** — `difficulty` was added to `getRandomQuestions` while `rng` was pushed back, so the default (`'ALL'`) keeps existing calls and tests non-regressing. Arguments injected for deterministic tests (rng) should always keep the last position when a signature is extended.
3. **Verify normalization gaps before minimally shoring them up — do not guess** — hyphens/underscores/repeated whitespace are **already** absorbed by the existing regex, so only regression-pinning was added; only the actual gap (full-width characters) was shored up with `NFKC`. Confirming the pipeline's current behavior first, then filling only the missing cases minimally, prevents overfitting and redundant patching.
4. **When content grows, gate quality in code** — 150 questions exceed the limit of manual review. `check-quiz-content.mjs` enforces schema, duplicates, and omissions in CI, so future content additions cannot break integrity (regression-blocked).

## New Patterns

- **Content-quality lint gate pattern** — a static content bank that grows wires a schema/integrity validation script into CI to block regressions. Instead of importing `.ts` directly, it parses files as text with node builtins to avoid a build dependency, and `--strict` makes it a hard gate so a content addition that violates the schema/duplicate/omission/minimum-count rules is blocked in CI.

## Sprint 217+ Carryover

- **Sprint 217 — logged-in record integration** (planned): a `QuizRecord` entity + migration, likely an Identity expansion. Swap the `storage.ts` abstraction for a server API. **Per-difficulty best** is also designed here alongside the storage schema change (D2).
- **Server redeploy + live `/quiz` & SEO verification** (user/ops): merge ≠ live; after redeploy, play live `/quiz` + confirm domain consistency via `curl https://algo-su.com/sitemap.xml` / `robots.txt` <!-- doc-ref-lint: ignore -->
- **GA4 data stream URL consistency + Enhanced Measurement history page_view OFF + production page_view UAT** (user, carried from Sprint 210/211/212)
- **Run the ops Sprint 196 migration** (user/ops)
- **Review harness `--full` CI scheduled-run automation** (carried from Sprint 209)

## Critic Cross-Review

**R1 — 1 P2** (Codex, `codex review --base d431dcf`, codex-cli 0.130.0)

> With the difficulty filter, the strict content gate can pass even when a selectable category/difficulty pool cannot satisfy the smallest UI count, because it only checks per-category totals. E.g. `NETWORK` has only 4 `HARD` questions, so Network + Hard + 5 starts a 4-question quiz despite the user selecting 5. Enforce a per-category/per-difficulty minimum matching the UI options, or adjust/disable count choices for undersized pools.

- **Action**: Forcing 10 questions per `(category,difficulty)` would distort the difficulty distribution (HARD is naturally scarcer), so this was resolved on the **UX side** instead. Author fix `f2bdafd` — QuizStart computes the available pool size via `getQuestionsByFilter(category, difficulty).length` and caps the count options dynamically (`available>=10`→[5,10] / `5~9`→[5] / `<5`→single [available]). A derived clamp always passes a count ≤ available to `onStart`, and the start button has a defensive guard. 4 regression tests added, `QuizStart.tsx` stays at 100% coverage. Content, storage, and i18n unchanged.
- Critical / High **0**.

**R2 — CLEAN** (Codex, `codex review --base d431dcf`, re-review)

> The changes appear internally consistent: the new quiz categories and difficulty filter are wired through data, UI, tests, and CI content validation without an evident breaking issue.

- P0 / P1 / P2 / P3 **0**.

**Final — CLEAN**. No regression after the R1 P2 fix (`f2bdafd`).
