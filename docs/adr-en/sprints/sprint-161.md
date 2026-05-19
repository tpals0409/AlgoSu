---
sprint: 161
title: "Human-Friendly ADR Detail Page UX — Hero + Decision Cards + Phase Strip Visualization"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-160", "sprint-158"]
related_memory: ["sprint-window"]
---
# Sprint 161 — Human-Friendly ADR Detail Page UX — Hero + Decision Cards + Phase Strip Visualization

## Goals

- Resolve text-density issues on the ADR detail page — zero above-fold information / decisions not scan-friendly / zero Phase flow visualization / no metrics
- Leverage rich metadata already produced by parser.ts (canonical sections / PR table / Impact) as visual elements in the detail view
- Execute only the P0 core out of a 3-sprint split (161~163): Hero summary + Decision cards + Phase strip

## Decisions

- **Parser metadata utilization pattern adopted**: Branch-render already-classified canonical sections + prTable in the detail view — no new data source required
- **TL;DR auto-extraction**: Frontmatter `tldr` takes priority / otherwise auto-extract the first list item from the "Goals" section (stripMarkdown applied)
- **Decision card parsing**: Regex extraction of `- **bold**: text` patterns from the decisions section → 2-column card grid
- **Phase strip based on PR table**: Implementation section prTable rows → Phase label / PR link / one-line description / Lines horizontal scroll cards
- **PR table column dynamic discovery**: Column structure varies per sprint → `findColIndex` candidate-keyword matching to dynamically determine Phase/Owner/Change/Lines positions
- **Palette pre-approval unnecessary (Oracle ruling)**: `components/adr/` domain components reuse existing tokens (`surface-muted`, `surface-elevated`, `border`, `brand`) → not `components/ui/` shared
- **3-sprint split**: 161 (P0 Hero/cards), 162 (P1 Mermaid activation), 163 (P2 PR table separation + callout boxes)

## Implementation (1 PR squash merge pending, 3 commits, origin/main `78e17c4` → `f79841e`)

| PR | Phase | Owner | Change | Lines |
|----|-------|-------|--------|-------|
| (PR not yet created — squash merge pending) | B | architect + critic | Hero + Decision cards + Phase strip + parser extensions + i18n | +432 −3 |

### Detailed Changes

1. **parser.ts** (+142): `extractTldr()` / `extractDecisionItems()` / `extractPhaseEntries()` — 3 extraction functions + helpers (stripMarkdown/findColIndex/safeCell/extractPrUrl). Critic R1 P2 resolution: Phase column guard (bogus card prevention) + Korean header (`변경`/`라인`/`담당`) support
2. **types.ts** (+20): `AdrDecision` / `AdrPhaseEntry` interfaces + `AdrMeta.tldr` / `AdrDoc.decisions` / `AdrDoc.phases`
3. **adr-hero.tsx** (+114): Hero area — TL;DR text + 4 metrics (Date/Impact/PR count/Lines). Critic R2 P2 resolution: comma-separated Lines normalization
4. **adr-decisions-grid.tsx** (+50): Decisions 2-column card grid
5. **adr-phase-strip.tsx** (+85): Phase horizontal scroll strip + PrLink component
6. **adr-detail-view.tsx** (+6): Hero → PhaseStrip → DecisionsGrid → prose order integration
7. **i18n.ts** (+18): 7 keys KR+EN (`heroTldr`/`heroPrCount`/`heroLines`/`heroDate`/`heroImpact`/`decisionsTitle`/`phaseStripTitle`)

## Verification

| Item | Result |
|------|--------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 pages static export success |
| Existing ADRs without frontmatter tldr | "Goals" section first list item auto-extraction fallback working |
| ADRs without decisions/implementation sections | null return → component not rendered (graceful) |
| Critic R1 (Codex gpt-5.5, session `019e3e8f-cd3f-7443-a10c-af523eef6e6d`) | P2 2 items (bogus Phase strip guard + Korean headers) → resolved |
| Critic R2 (Codex gpt-5.5, session `019e3e93-b9e2-7f40-b93e-58636638ddce`) | P2 1 item (comma Lines) → resolved, P3 1 item (escaped pipes) → deferred to Sprint 162 |
| doc-ref-lint | pending verification |

## Branch Discipline ✅ 29 sprints of consecutive compliance

- New branch `feat/sprint-161-adr-ux-hero-cards` + Squash merge pending
- 0 direct commits to main, 0 `--no-verify` uses

## New Patterns

1. **Parser metadata → detail view visualization pattern** — Branch-render canonical sections/prTable/impact created by the parser in the detail view. Data already exists; only visualization added
2. **TL;DR auto-extraction fallback pattern** — Frontmatter priority → Goals section first list item fallback. No modification needed for existing ADRs
3. **PR table column dynamic discovery pattern** — Column structure differs per ADR. Candidate-keyword matching for dynamic position determination (Korean/English mixed support)
4. **Phase column guard pattern** (Critic R1 P1 institutionalized) — Early return when Phase column absent. Bogus card prevention
5. **Critic R1 → R2 → R3 progressive convergence** — R1 P2 2 items → R2 P2 1 item + P3 1 item (deferred). Progressive convergence with P0/P1 at 0

## Lessons

1. **Rich data + poor visualization is frontend UX debt** — Parser produces canonical/prTable/impact but detail view renders only prose. Requires awareness of data layer vs UI layer separation
2. **Non-standardized PR table column structure causes parser complexity** — sprint-154/156/158/160 all have different column structures. findColIndex dynamic discovery is a pragmatic solution, but standardizing conventions is the root fix
3. **Comma-separated numbers require pre-normalization before regex** — `+14,939` → `/\+(\d+)/` captures only `14`. phase.lines.replace(/,/g, '') preprocessing is a mandatory pattern
4. **Palette pre-approval unnecessary ruling shortens lead time** — Domain components reuse existing tokens. Only components/ui/ shared components require Palette guide
5. **Codex gpt-5.5 cross-review 3 rounds as quality convergence tool** — R1 caught bogus cards + Korean headers, R2 caught comma Lines, R3 caught escaped pipes (deferred). 3 additional blind spots detected from the same model family

## Sprint 162 Carry-Over

- **Critic R3 P3 deferred**: escaped pipes in GFM table cells — `splitTableRow` existing function change regression risk
- Sprint 162 scope: Phase C Mermaid activation + existing ADR diagram additions
- Sprint 163 scope: Phase D PR table separation + lesson/carry-over callout boxes
- Existing carry-over items maintained (seeds #new1~#new7, #30/#31, #24/#26~#28, etc.)

## Related Documents

- [sprint-160.md](./sprint-160.md) — Previous sprint, Critic R1/R2 pattern inheritance
- [sprint-158.md](./sprint-158.md) — i18n bilingual obligation principle
