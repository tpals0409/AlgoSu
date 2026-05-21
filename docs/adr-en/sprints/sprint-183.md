---
sprint: 183
title: "Restore ADR detail callout rendering — H3 normalization + plan slug collision block"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-182", "sprint-163", "sprint-162"]
related_memory: ["sprint-window"]
---
# Sprint 183 — Restore ADR detail callout rendering — H3 normalization + plan slug collision block

## Goal

- The blog ADR detail-view renders carryover/lessons sections as callout boxes (📋/💡) (Sprint 163). However, some older ADRs wrote carryover/lessons sections as **H3** instead of the standard H2, so the callouts didn't render — this recovers that gap.
- During initial exploration a deeper **pre-existing bug** surfaced: `sprint-87-plan.md` was being picked up by the ADR loader and collided with `sprint-87.md` on slug, so the `/adr/sprints/87/` route was contaminated with plan content. With user approval, this collision is also blocked.

## Decision

### D1. Normalize H3 carryover/lessons to H2 (data fix instead of parser change)

`collectCanonicalSectionMarkdown` (parser.ts) finds a canonical section only via `s.canonical === canonical && s.level === 2`. So if the carryover/lessons heading is H3, the callout doesn't render.

Rather than **adding H3 recognition to the parser**, the 3 old ADRs were normalized to H2. Rationale: of the 9 ADRs with "carryover/lessons keyword in an H3" found during exploration, **only 3 are genuine H3-only carryover/lessons sections** (sprint-86/87/139); the other 6 are **false positives** (decision titles under Decisions like `### D1: ...carryover`, incoming-carryover under context like `### Sprint N carryover`, lessons sub-items). Adding H3 recognition to the parser would mis-extract those 6 as wrong callouts (high FP risk), so data normalization is the accurate and safe fix (inheriting the sprint-162 precedent "resolve as a data-integrity issue, not a code defect").

- sprint-86/87: `### Carryover Items` / `### 이월 항목` → H2 (carryover)
- sprint-139: `### Lessons` / `### 교훈` → H2 (lessons)

### D2. Confine the sprint ADR loader to `sprint-NNN.md` (block plan slug collision)

`deriveSlug` (loader.ts) extracts the slug for sprint kind via `sprint-(\d+)`, while the loader scan included all `*.md`, so `sprint-87.md` and `sprint-87-plan.md` **both collided on slug `'87'`**. The plan file (later alphabetically) overwrote the `/adr/sprints/87/` route, serving plan content instead of the ADR body (the carryover/lessons sections were entirely missing).

The loader scan filter was made kind-aware: sprint ADRs are accepted only via `/^sprint-\d+\.md$/` (the `isAdrFile` helper). This structurally blocks non-ADR files like plans/drafts from leaking into ADR routes (also applies to future files).

## Implementation

### PR #319 (single work branch `fix/sprint-183-adr-h3-callout-and-plan-collision`, 1 commit → squash, 7 source files +18/-7)

- `462b8fb` fix — add `isAdrFile(filename, kind)` helper to `loader.ts` (replace scan filter `f.endsWith('.md') && f !== 'README.md'` → `isAdrFile(f, kind)`) + normalize sprint-86/87/139 KR+EN 6 headings H3→H2.

Core change (loader.ts):
```ts
function isAdrFile(filename: string, kind: AdrKind): boolean {
  if (!filename.endsWith('.md') || filename === 'README.md') return false;
  if (kind === 'sprint') return /^sprint-\d+\.md$/.test(filename);
  return true;
}
```

## Critic cycle

`codex review --base main`, 1 round.

- **R1** (session `019e485d`): **0 issues**, passed — "The loader change narrows sprint ADR discovery to canonical numeric sprint files and the documentation heading adjustments align with the parser's H2-based section extraction. I did not identify any introduced regressions or actionable bugs." Mergeable.

## Verification

### Browser end-to-end (blog build → static server → actual DOM check)
- **sprint-86**: both 📋 carryover and 💡 lessons callouts render ✓
- **sprint-87**: slug collision resolved — serves the real ADR ("Blog category system + Post 6 reframing", not the plan) + both 📋 carryover and 💡 lessons render ✓
- **sprint-139**: 📋 carryover renders ✓ / `## Lessons` content is prose (not a list) so it's not a callout target (the Sprint 163 R6 P2 "keep prose-only" design) and renders correctly as an H2 prose section ✓
- `/adr/sprints/87-plan/` route not generated, `/87/` serves the real ADR confirmed

### Local
- `tsc --noEmit` 0 errors (loader change).
- ADR/blog gates 6, no regression: adr-conversion (fixtures 10/10) · doc-refs (327 files 0 broken) · en-coverage (130/130) · index-count (8/1/121) · i18n (max 2.19%<8%) · blog-crosscheck.

### CI
- Work PR #319 all 38 checks green (including Build Blog — triggered by blog source change). The ADR PR is green via the `sprints/**` trigger.

## Result

- **Merge**: origin/main → `d6202bd` (PR #319 squash merge, work branch deleted).
- **Net change**: `blog/src/lib/adr/loader.ts` (+12/-1) + 6 old ADR headings H3→H2 (each +1/-1). No new files.
- ADR sprint-183 (KR+EN) + README sprint ADR count 121→122, range 62~183 (separate ADR PR).

## New patterns

- **A plan invalidated and redefined by exploration**: started treating "H3 callout not rendering" as a simple parser enhancement, but exploration found (1) only 3 genuine gaps with 6 FPs, making a parser enhancement risky → switched to data normalization, and (2) sprint-87's real cause was a deeper slug collision discovered via browser verification → scope redefinition (user-approved). The codebase's actual render state is the arbiter of the plan (inheriting Sprint 178's demonstrated lesson).
- **Confine identifier extraction with an exact file pattern**: a loose extraction like `sprint-(\d+)` collides variant files like `sprint-NNN-plan.md` onto the same identifier. Confining the input at the scan stage with a canonical pattern (`^sprint-\d+\.md$`) makes collisions "impossible by construction" rather than "luck of processing order".

## Lessons

- **Static grep alone can't adjudicate a render bug — the browser is the arbiter**: replicating the parser logic indicated sprint-87's callout "should render", yet the actual page was the plan body. HTML grep was unreliable (RSC escaping, class multiplicity), and what looked like a "stale" static build artifact was in fact the slug collision. Only after reading the actual DOM with `get_page_text` did the true cause (plan contamination) surface. Frontend changes require browser end-to-end verification.
- **The data-normalization vs code-enhancement decision turns on FP risk**: for the same symptom (H3 not rendering), a parser enhancement creates 6 FPs while data normalization fixes exactly the 3 genuine cases. Before broadening a heuristic (keyword matching), measure the actual match distribution to separate true from false.

## Carry-over (Sprint 184+)

- **Optional**: `sprint-87-plan.md` is now excluded from the loader but still remains as a non-ADR file in `docs/adr/sprints/` — consider relocating (e.g., to `docs/planning/`) or removing (separate, data cleanup).
- **Manual UAT by user**: inherit the Sprint 160~182 accumulated UAT (legacy Programmers SQL detail editor auto-selects sql, Programmers re-submission grading, EN-environment Grafana CB dashboard).
- Follow-ups: removing the coverage-gate skipped allowance (deferrable since actual skipped = 0), `(adr)` layout split, prom-client Case B~D automation, `.claude-tools/` Phase 2 actual deletion, Sprint 163 additions (H3-only PR table extraction + implementation H2 partial matcher).
