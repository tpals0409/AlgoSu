---
sprint: 180
title: "Auto-propagation of category from Programmers search results"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-178", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 180 — Auto-propagation of category from Programmers search results

## Goal

- Sprint 178 laid down the category (ALGORITHM/SQL) input UI for problems all the way from the backend entity through the frontend types and DB migration, but **the final step — auto-propagating the category from a Programmers search result into the form — was missing**. As a result, even when a user searched for a SQL problem, the form never filled in the category and always saved it with the ALGORITHM default — a "half-implemented" gap (registering SQL problems was effectively impossible).
- Of three candidates (remove the coverage-gate skipped allowance / split the `(adr)` layout / Programmers category auto-inference) examined during startup exploration, the first two were rejected as "not a gap — zero actually-skipped tests" and "split necessity unclear" respectively, and **only category auto-inference was confirmed as a clear gap** — the backend already returns the category in the search response, but only the frontend single-fetch type `ProgrammersProblemInfo` was missing the category field, breaking the propagation chain.

## Decisions

### D1. Mirror category on difficulty's auto-inference pattern

Just as difficulty was already auto-filled through the search hooks, the search hooks now also fill in category. `useProgrammersSearch` fills in the search result's category, while `useBojSearch` always fills in ALGORITHM (solved.ac/BOJ have no SQL concept). This connects both ends of the data flow (search response → form state → DTO) and completes the "half-implemented" chain.

### D2. `ProblemFormState.category` as a loose `string` + a single bridge cast + a shared-helper SSOT

`ProblemFormState.category` is kept as a loose `string`, consistent with the difficulty/sourcePlatform convention. In the create form, RHF (react-hook-form) is the real form state, and the `setFormAndSync` proxy connects the search hooks (`ProblemFormState`) to RHF. However, RHF's `category` is the strict type `z.enum(['ALGORITHM','SQL'])`, so exactly one `as ProblemCategory` cast is required at the bridge. The SQL-decision logic was extracted into a **dual-check that looks at both category and the 'SQL' tag** — the shared helper `isProgrammersSqlProblem` — unifying the SSOT with `AddProblemModal`'s existing local `isSqlProblem` (so that even when a legacy entry is defaulted to category='algorithm', SQL can still be identified by tag).

### D3. Reversal from category-select disable to an editable smart default (Critic-driven)

The initial implementation followed the difficulty mirroring verbatim and disabled the category select when a search was applied. But Critic R2 caught a bug: **RHF submits a disabled registered field as undefined → required `z.enum` validation fails → the create form cannot be submitted at all (silent fail)**. difficulty was `.optional()`, so disabled→undefined was safe; category was required, so it could not be mirrored as-is. → category was switched from disable to an **editable smart default** (the search fills it but the user can correct it — consistent with Sprint 178's "manual selection" intent). At the same time, the proxy sync's `next.category !== prev.category` guard caused a stale bug (P2) where a manual SQL selection made before the search persisted even after a non-SQL search was applied, so category alone was changed to **always setValue** on sync.

## Implementation

### PR #313 — auto-propagation of category from Programmers search results (15 files +280/-21, 3 commits)

- `7fb7aac` feat — base structure for category propagation (types·hooks·form·tests).
- `f6b66ca` fix (Critic R1 P2) — extract the SQL-tag dual-check shared helper `isProgrammersSqlProblem` + delegate to it.
- `b49db22` fix (Critic R2 P1+P2) — remove category-select disable + always sync on search apply.

Key files:
- `lib/api/external.ts`: add the category field to `ProgrammersProblemInfo` + the `isProgrammersSqlProblem` shared helper.
- `lib/api/index.ts`: barrel re-export.
- `lib/problem-form-utils.ts`: add category (`string`) to `ProblemFormState`.
- `hooks/useProgrammersSearch.ts`·`hooks/useBojSearch.ts`: fill category (Programmers = result category, BOJ = always ALGORITHM, reset also ALGORITHM).
- `app/[locale]/problems/create/page.tsx`·`app/[locale]/problems/[id]/edit/page.tsx`: propagate category in proxy·sync·reset·createAnother, remove disable + always sync.
- `components/ui/AddProblemModal.tsx`: delegate the local `isSqlProblem` to the shared helper (DRY single source).

## Critic cycle

`codex review --base main`, 3 rounds.

- **R1** (session `019e4679-3e43-74d3-91b2-8e1858fea23b`): **P2** — `useProgrammersSearch` checked only category and thus misclassified legacy SQL problems (defaulted to category='algorithm' but carrying 'SQL' in their tags) + the disabled select left the user unable to correct it. → resolved with the category-or-'SQL'-tag dual-check shared helper.
- **R2**: **P1** — the category-select disable made the RHF required enum undefined and blocked create submission (silent fail) + **P2** — the `setFormAndSync` proxy left a stale category value. → resolved by removing the disable + always syncing category. (In the process, it also emerged that the zodResolver mock violated the RHF contract `{values, errors}`, meaning **the tests had never actually exercised the submit path**, so the mock was corrected.)
- **R3**: **0 findings** — merge-ready.

## Verification

### Local
- `tsc --noEmit` 0 errors.
- `next lint` 0 errors / 0 warnings.
- jest 132 suites · 1368 tests all pass (1361→1368).
- Coverage: Lines 86.9% (≥83), Branches 78.23% (≥71), JEST_EXIT=0.

### CI
- PR #313 39 checks green.

## Result

- **Merge**: origin/main `4867592` → `15fd56f` (PR #313 squash merge, working branch deleted).
- **Net change**: 15 files +280/-21, 3 commits.

## New patterns

- **"Half-implemented" feature gap (Sprint 178 inheritance, demonstrated)**: even when the backend·types·DB are all in place, a single missing line of frontend propagation silently neutralises the feature (everything saved with the default). A field existing in the API type ≠ actual propagation, so both ends of the data flow (form → DTO → service) must be traced.
- **The mirroring trap — differing validation-schema constraints**: a field's UI pattern (difficulty's "disable on search apply") must not be copied verbatim onto another field (category). difficulty was `z.optional` and category was required `z.enum`, so the RHF behaviour "disabled registered → undefined" was safe only for one of them. Before copying a UI pattern, verify that the two fields' validation-schema constraints are identical.
- **Shared-helper SSOT**: when the same decision logic (SQL classification) appears in two or more places, extract it into a single source. Misclassification from legacy-data defaults can then be prevented in one spot.

## Lessons

- **The value of cross-review, demonstrated**: Critic (Codex cross-validation) caught a **framework-contract violation** (RHF disabled→undefined conflicting with a required enum) that the same model family had missed. Furthermore, the fact that "the tests had never actually exercised the core submit path" (the mock violated the RHF contract) also surfaced, reaffirming that we must question whether regression tests actually cover the golden path.
- **Bidirectional FN detection**: R1 (missing tag fallback) and R2 (disable blocking submission + proxy stale) were all false-negative bugs with real user impact — paths where category went unfilled despite a search, or filled but blocked from submission, or where a prior selection wrongly persisted.

## Carryover (Sprint 181+)

- **User-driven UAT**: confirm that searching a Programmers SQL problem in create/edit auto-reflects category as SQL / edit prefill / `/en` label + Sprint 178–179 accumulated UAT inheritance.
- Follow-ups: remove the coverage-gate skipped allowance (deferrable — zero actually-skipped tests), split the `(adr)` layout, backfill existing SQL problem data (legacy with category unset).
- Note: this sprint **resolves search-based category auto-inference** — the URL-direct-input path does not exist in create, so it is N/A.
