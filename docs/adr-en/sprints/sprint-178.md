---
sprint: 178
title: "Recovering the problem category input UI (Sprint 151 unwired gap)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-177", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 178 — Recovering the problem category input UI

## Goal

- We started the plans carried over from Sprint 177 (leftover plan-template work · extra blog cross-check dimensions), but exploration revealed **both were dead ends**, so we pivoted.
  - Leftover plan-template work: already implemented in the PR template (`.github/pull_request_template.md`) and the script (`check-adr-index-count.mjs`) → no work left.
  - Extra blog cross-check dimension (reference-style links): **zero usage** across the entire blog, and frontmatter is uniform across all 20 posts → a defensive gate for an unused pattern, low value (low priority against the Sprint 177 lesson "deterministically verifiable + false-positive avoidance first").
- Instead we recovered the problem category input UI — a **clear functional gap** among the carried-over seeds. Standard cycle (single working branch + PR + Squash merge + Critic) preserved.

## Decisions

### D1. Not a simple UI addition but recovering a "half-implemented" functional gap (user-approved)

In Sprint 151, to support the SQL Kit, `ProblemCategory` (ALGORITHM/SQL) was laid down across the **backend entity·DTO·service·DB migration + frontend API types**, but the **path for the frontend create/edit forms to transmit `category` was missing**. The backend relies solely on input via `dto.category ?? ProblemCategory.ALGORITHM` (`problem.service.ts:67`), has no sourceUrl-based inference, and neither the search hook (`useProgrammersSearch`) nor `programmersApi` results carry category. As a result **every new/edited problem was saved as ALGORITHM**, with no way to register an SQL problem. This sprint recovers that unwired gap.

### D2. category is pure manual selection — difficulty's "disabled when search applied" pattern not applied

difficulty is filled by BOJ/Programmers search results, so it is `disabled` when a search is applied. category is not filled by search and has no auto-inference, so it stays an **always-active manual select** (`disabled={isSubmitting}` only) with a default of ALGORITHM. We do not blindly clone the search pattern but match the actual difference in data flow.

### D3. Reuse native `<select>` + i18n labels — no new components/ui

We reuse the native `<select>` + `selectClass` (`problem-form-utils.ts`) pattern used by difficulty/status as-is, avoiding new `components/ui/` components (Palette-guide avoidance, `_base.md` rule). Unlike difficulty (proper-noun constant labels) and status (legacy hardcoded Korean tech debt), category is new code, so labels go through **i18n (`problems.form.category.*`, ko/en)** to properly support the English locale too. The constant SSOT is `PROBLEM_CATEGORIES` (`constants.ts`), and Zod uses `z.enum(PROBLEM_CATEGORIES)` for type safety.

## Implementation

### PR #309 `20295e7` — problem create/edit category input UI (9 files +94/-2)

- `lib/constants.ts`: `PROBLEM_CATEGORIES` (SSOT tuple) + derived `ProblemCategory` type.
- `lib/schemas/problem.ts`: added `category: z.enum(PROBLEM_CATEGORIES)` to `problemCreateSchema`. `.default()` splits z.input/z.output types and conflicts with the RHF resolver, so a required enum is kept.
- `create/page.tsx`: `category: 'ALGORITHM'` in defaultValues/reset + category select + onSubmit `data.category` transmission.
- `edit/page.tsx`: `EditFormState.category` + `data.category ?? 'ALGORITHM'` prefill on load + select + diff-based transmission.
- `messages/{ko,en}/problems.json`: `categoryLabel` + `category.ALGORITHM/SQL`.
- Tests: create (render + default ALGORITHM), edit (prefill SQL), schema (valid/invalid enum), and `PROBLEM_CATEGORIES` added to the constants mock.

## Critic cycle

`codex review --base main`, 1 round (session `019e453e-d1bd-78b3-806b-224e3fb9e60a`): **0 findings** — "adds category support to create/edit forms, translations, constants, and schema validation without introducing a clear regression or breakage in the affected flows". Merge-ready.

## Verification

### Local
- `tsc --noEmit` passes.
- ESLint zero new warnings (only the existing platform-toggle inline styles as baseline).
- jest 1361 pass / 0 fail.
- Coverage gate: Lines 86.46% (≥83), Branches 77.49% (≥71), JEST_EXIT=0.

### CI
- PR #309 "CI — Test, Build & Push" `conclusion: success` (all jobs green).

## Result

- **Merge**: origin/main `06ebcc2` → `20295e7` (PR #309 squash merge, working branch deleted).
- **Net change**: frontend 9 files +94/-2 (constants/schema/create·edit page/i18n/tests).

## New patterns

- **Recovering a "half-implemented" functional gap**: even when the backend·types·DB are all in place for a feature, a single missing frontend transmission line can silently neutralize the whole feature (everything saved as default). A field existing in the API type does not guarantee it is actually transmitted — you must trace both ends of the data flow (form → DTO → service) to see the gap.
- **Check data-flow differences when reusing patterns**: reuse an adjacent field's (difficulty's) UI pattern, but branch on the parts where the data source differs (search auto-fill vs manual) such as the disabled condition, instead of cloning.

## Lessons

- **Exploration can invalidate the plan**: the two carried-over plans both turned out to be dead ends (already implemented / zero usage), surfaced by startup exploration → immediate re-direction. A plan is a hypothesis and the current state of the codebase is the judge.
- **A "simple UI addition" was actually a functional gap**: we started seeing the category UI as a simple select addition, but tracing onSubmit revealed the transmission path itself was absent → the real value of the work (resolving the inability to register SQL problems) emerged.

## Carryover (Sprint 179+)

- **User-driven UAT**: PR #309 category form submit → backend save / edit prefill / `/en` label rendering / Sprint 151 auto language selection wiring when SQL is chosen + Sprint 160–177 accumulation.
- Other follow-ups (inherited from sprint-177 §carryover): remove coverage-gate skipped allowance, post-merge pre-deploy gate, prom-client check automation, `.claude-tools/` Phase 2 deletion, `(adr)` layout split, Programmers URL auto category inference, backfill of existing SQL problem data, etc.
