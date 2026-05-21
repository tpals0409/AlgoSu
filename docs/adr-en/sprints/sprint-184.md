---
sprint: 184
title: "ADR implementation H2 partial matcher + PR table header mis-detection block"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-183", "sprint-163"]
related_memory: ["sprint-window"]
---
# Sprint 184 — ADR implementation H2 partial matcher + PR table header mis-detection block

## Goal

- The blog ADR detail-view visualizes the implementation section's PR table as PhaseStrip cards (Sprint 163). However, `resolveCanonical` handled implementation only via **exact alias matching**, so headings with parenthetical/suffix content like `## 구현 (8 PR squash merge, ...)` / `## Implementation (single PR, ...)` were classified as `'other'`, and the PR tables of sprint-153~165 (KR + EN) didn't render as Phase cards — this recovers that gap (Sprint 163 carryover follow-up).
- After starting, browser verification surfaced a deeper **pre-existing vulnerability**: `parsePrTable`'s header detection mistook a **data row** containing the string "PR" for the header → applying the partial matcher made sprint-163 render garbage Phase cards. This is blocked together.

## Decision

### D1. Add an implementation tolerant-regex fallback to resolveCanonical

`resolveCanonical` (section-aliases.ts) does exact alias lookup after stripping a numbered prefix → only carryover/lessons had tolerant-regex fallbacks (`CARRYOVER_RE`/`LESSONS_RE`), and **implementation had no tolerant matcher**. So `구현` matched exactly, but `구현 (8 PR ...)` fell through to 'other'.

Added `IMPLEMENTATION_RE = /^(?:구현|implementation|execution)(?:\s|$|\()/i` and placed it as a fallback after carryover/lessons.

- Matches only when the keyword is immediately followed by **whitespace/end/`(`** → `구현체` (non-whitespace continuation) does not match (conservative).
- Exhaustive FP measurement: across the whole corpus (KR sprints + EN sprints + permanent ADRs), all **66 old→new canonical changes were `other → implementation`** — zero changes that steal an existing correct classification (carryover/lessons/verification etc.).
- Phase card generation is separately gated by a downstream guard (`extractPhaseEntries`) requiring a PR table + Phase column, so sections without a PR table (`구현 작업`, `구현 예정 위치`, etc.) produce no bogus cards even when classified as implementation.

### D2. Confine parsePrTable/stripPrTableLines header detection to "the line before the separator"

`parsePrTable`'s (parser.ts) header detection used `lines.findIndex(l => /\|/ && /pr/i)`, treating **any line containing "PR"** as the header. sprint-163's implementation table has the header `| Phase | 담당 | 변경 | 라인 |` (no PR column), but the data row `| A — PR 표 strip 기반 | ... |` contains "PR" → it was mistaken for the header, consuming A as header and B as separator, extracting C~R9 as garbage cards, and failing to strip the table.

Using the invariant that a GFM table header is **always the line immediately before the separator (`|---|`)**, the header detection now requires "the next line is a separator" (`isTableSeparatorRow` helper). This makes data-row mis-detection structurally impossible. `stripPrTableLines`, which had the same vulnerability, was aligned to the same rule (removed its separate separator-validation branch, sharing the helper).

A table without a PR column (sprint-163) fails header detection → returns `undefined` → gracefully kept as a raw table in prose (same as before the change, no regression).

## Implementation

### PR #321 (single work branch `fix/sprint-184-impl-h2-partial-matcher`, 1 commit → squash, 2 source files +36/-10)

- `5640326` fix — `IMPLEMENTATION_RE` + 1-line resolveCanonical fallback in section-aliases.ts; `isTableSeparatorRow` helper + parsePrTable/stripPrTableLines header detection hardening in parser.ts.

Core change (section-aliases.ts):
```ts
const IMPLEMENTATION_RE = /^(?:구현|implementation|execution)(?:\s|$|\()/i;
// resolveCanonical fallback:
if (IMPLEMENTATION_RE.test(stripped)) return 'implementation';
```

Core change (parser.ts):
```ts
const headerIdx = lines.findIndex(
  (l, i) =>
    /\|/.test(l) &&
    /pr|pull\s*request/i.test(l) &&
    i + 1 < lines.length &&
    isTableSeparatorRow(lines[i + 1]),
);
```

## Critic cycle

`codex review --base main`, 1 round.

- **R1**: **0 issues**, passed — "The changes tighten PR table detection to require a following GFM separator and extend implementation heading aliasing without introducing an evident regression. No actionable correctness issues were found in the diff." Mergeable.

## Verification

### Browser end-to-end (blog build → static server → actual DOM check)
- **sprint-157 (KR)**: `구현 Phase` PhaseStrip renders 10 cards (P1~UX addition, with PR links/owner/summary) + the implementation section's raw PR table stripped (only the Mermaid `작업 흐름` diagram remains) ✓
- **sprint-157 (EN)**: `Implementation Phases` 10 cards + table stripped ✓
- **sprint-163**: garbage cards (A/B missing, C~R9 mis-extracted) fully removed → no `구현 Phase` section generated, raw table kept gracefully ✓

### Document-level simulation (old vs new)
- 11 KR sprints (153/154/155/156/157/158/159/160/161/164/165) + 11 EN sprints = **22 ADRs newly gain Phase cards (0→N)**.
- Zero regressions across the whole corpus (no N→0/N→M changes), permanent ADRs unaffected (PR-column-less `구현 작업` etc. are graceful).

### Local
- `tsc --noEmit` 0 errors · `npm run build` 244 pages.
- ADR/blog gates 7, no regression: adr-conversion (fixtures 10/10) · doc-refs (329 files 0 broken) · en-coverage (131/131) · index-count (8/1/122) · i18n (max 2.19%<8%) · blog-crosscheck (0 violations) · adr-links (KR 1616 / EN 1614, 0 broken).

### CI
- Work PR #321 all checks green (including Build Blog — triggered by blog source change), mergeStateStatus CLEAN. The ADR PR is green via the `sprints/**` trigger.

## Result

- **Merge**: origin/main → `c38a54f` (PR #321 squash merge, work branch deleted).
- **Net change**: `blog/src/lib/adr/section-aliases.ts` (+16) + `blog/src/lib/adr/parser.ts` (+20/-10). No new files.
- ADR sprint-184 (KR+EN) + README sprint ADR count 122→123, range 62~184 (separate ADR PR).

## New patterns

- **A plan whose scope is redefined by browser verification**: started as a single "implementation H2 partial matcher" change, but the browser DOM check of the first build found that the partial matcher exposed sprint-163's pre-existing `parsePrTable` vulnerability (data-row header mis-detection), producing garbage cards → added `parsePrTable` hardening to scope. The static simulation ("a table with a PR column should render") differed from the actual render (garbage cards), and the actual DOM was the arbiter (inheriting Sprint 183's "browser is the arbiter").
- **Block heuristic mis-detection with a structural invariant**: the "any line containing PR = header" heuristic mis-identified a data row. Folding GFM's "the header is the line before the separator" invariant into the detection condition makes mis-detection "impossible by construction" rather than "luck" (inheriting Sprint 183's "confine the input with an exact pattern").

## Lessons

- **Widening a heuristic is safe only atop a downstream guard**: even with broad implementation classification, Phase cards require a PR table + Phase column, so PR-table-less sections like `구현 작업` are gracefully ignored. When broadening a classifier, judge "does misclassification lead to a visible defect?" by the presence of a downstream guard — if the guard blocks it, widening is safe.
- **A partial matcher awakens an adjacent vulnerability**: widening one module (the classifier) can activate a latent defect in a module consuming its output (parsePrTable) for the first time. sprint-163 was previously 'other', so parsePrTable was never even called; after the partial matcher it was called and the header mis-detection surfaced. A change's impact can appear not in the changed function but in its output's consumer, so both ends must be verified in the browser.

## Carry-over (Sprint 185+)

- **Optional**: H3-only PR table extraction — when a PR table sits under an H3 sub-section (e.g., `### PR 별 머지 commit`) as in sprint-135/143/146, that heading doesn't resolve to implementation, so it's out of this sprint's scope (a separate, higher-risk approach is needed). Kept as a Sprint 163 carryover remnant.
- **Optional**: relocate/remove `sprint-87-plan.md` (arose in Sprint 183, excluded from the loader but still in the directory).
- **Manual UAT by user**: inherit the Sprint 160~183 accumulated UAT (legacy Programmers SQL detail editor auto-selects sql, Programmers re-submission grading, EN-environment Grafana CB dashboard).
- Follow-ups: removing the coverage-gate skipped allowance (deferrable since actual skipped = 0), `(adr)` layout split, prom-client Case B~D automation, `.claude-tools/` Phase 2 actual deletion.
