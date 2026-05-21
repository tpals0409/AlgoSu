---
sprint: 190
title: "Carryover seed cleanup — relocate sprint-87-plan.md to docs/planning/"
date: "2026-05-21"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-189", "sprint-184", "sprint-183"]
related_memory: ["sprint-window"]
topics: ["operations"]
tldr: "After completing the 5-phase blog overhaul, clean up accumulated carryover seeds. With the user-confirmed scope, relocate the non-ADR plan document sprint-87-plan.md (KR+EN) to docs/planning/ and sync the ADR count gate (128→127) and the range text. Zero behavior change."
---
# Sprint 190 — Carryover seed cleanup (relocate sprint-87-plan.md to docs/planning/)

## Goal

- After completing the 5-phase blog portfolio overhaul (Sprint 185~189), clean up the carryover seeds accumulated through Sprint 189.
- Of the six carryover seed candidates, the user confirmed the scope as **`sprint-87-plan.md` relocate only**. This is data cleanup for a non-ADR plan document that lingered in the ADR directory — a pure file move + count gate sync with **zero behavior change**.

## Background

- In Sprint 183, `deriveSlug` (loader.ts) caused `sprint-87.md` and `sprint-87-plan.md` to **collide on slug `'87'`**, contaminating the `/adr/sprints/87/` route with plan content. At the time the loader scan was narrowed to accept only `sprint-NNN.md` to block this, but the plan file itself remained in `docs/adr/sprints/` (plus its EN counterpart).
- This file is a **planning document**, not an ADR (decision record); it does not follow the ADR spec and undermined ADR directory integrity (Sprint 183/184 carryover seed).

## Decisions

### D1. Relocate only + location (user-confirmed)

Before starting, investigation measured the effective value of each carryover seed and presented it to the user:

- **blog ADR parser H3 PR tables (sprint-135/143/146)**: None of the three has an "Implementation / 구현" section, and only sprint-135 (`PR | Wave | ...`) carries the Phase/Wave column required for PhaseStrip rendering. sprint-143 (`PR | branch | files | Critic`) and 146 (`PR | seed | location | result`) do not qualify → **effective scope is just sprint-135 (1 file)**. Extending the parser/section-aliases carries whole-corpus ADR regression risk → excluded.
- **`filterAdjacency` unresolved edge P2**: With 0 unresolved edges currently, there is no actual impact → low priority, excluded.
- **`sprint-87-plan.md` relocate**: A clear, well-defined data cleanup with low regression risk → **adopted alone**.

The relocate target is `docs/planning/`. Both the KR (`sprint-87-plan.md`) and EN (`sprint-87-plan.en.md`) plan files are moved together to keep `check-adr-en-coverage` KR/EN balanced.

### D2. Count gate sync + range text reconcile (Critic P3)

- `check-adr-index-count` counts all `sprints/*.md` (excluding README), so the relocate changes the sprint count **128→127**. Update both KR occurrences in `docs/adr/README.md` (ASCII tree line 18 + section header line 54). The EN README has no count declaration, so no change is needed.
- Critic (Codex) P3 finding: "127개, Sprint 62~189" is internally inconsistent with the count, since 62~189 is 128 numbers. The actual composition — within 62~189 the numbers **88·89·90·172 are missing** + **integrated single-shot notes 40·48·51** = 127. Reconcile the range text to `Sprint 62~189 일부 결번 + 통합 40·48·51`.

## Implementation

### Implementation commits (2 commits, PR #333 squash → `9be2c29`)

- `697232e` chore(docs) — relocate `sprint-87-plan.md` (KR+EN) from `docs/adr/sprints/`·`docs/adr-en/sprints/` → `docs/planning/` (tracked as git rename 100%) + README count 128→127 (2 places)
- `2978a35` docs(adr) — Critic P3 range text reconcile (note gaps + integration)

### Zero-impact rationale (verified exhaustively up front)

| Gate/system | Impact | Rationale |
|---|---|---|
| `check-adr-index-count` | sprint 128→127 | sync 2 KR occurrences in README |
| EN README | none | no count declaration |
| `check-adr-en-coverage` | 137→136 (balanced) | KR/EN plan moved together |
| `check-doc-refs` | none | code-span mentions stripped by `stripInlineCode`; bare-path requires a repo-path prefix |
| `check-adr-links` | none | 0 markdown links pointing to the plan file |
| blog loader/build | none | loader accepts only `sprint-NNN.md` → out of build scope (artifact unchanged) |

## Verification

- **6 gates green**: index-count 127/127 · en-coverage 136/136 · doc-refs 341 files 0 broken · adr-links 1900 links 0 broken · adr-conversion 12/12 fixtures (sprint=127) · blog build all routes statically prerendered.
- **Critic**: `codex review --base main` → Critical/High/Medium **0**, P3 1 finding (range text) → resolved by reconcile commit `2978a35`.
- **CI #333**: 38 pass / 0 fail (incl. Quality — docs).
- **Post-merge main check**: KR+EN plan landed in `docs/planning/`, 0 leftovers in ADR directories, index-count 127/127 matches.

## Lessons / Patterns

- ① **Up-front impact investigation is the core of safe data cleanup** — before the relocate, the impact points of 6 gates/systems (count · en-coverage · doc-refs · adr-links · loader) were **verified exhaustively with code evidence**, guaranteeing no regression in advance. In particular, doc-refs was confirmed at the regex level to naturally exclude code-span mentions via two mechanisms (`stripInlineCode` + bare-path prefix requirement).
- ② **Numbers are enforced by an SSOT gate, but prose text is separate** — `check-adr-index-count` validates only the count number, so a human-readable prose label like "Sprint 62~189" was a mismatch the gate could not catch after the relocate. Critic (Codex) cross-review caught this number≠prose sync gap (P3) → proving Critic's value even on a small data cleanup.
- ③ **Seed cleanup must prioritize selecting effective value** — the up-front investigation exposed the low effective value of the H3 PR table (1 effective file) and filterAdjacency P2 (0 occurrences), letting the user narrow the scope to relocate only. Rather than processing accumulated seeds all at once, it is more efficient to measure effectiveness/risk and select.

## Carryover

- blog ADR parser H3-only PR table extraction (effective scope sprint-135, 1 file — parser/section-aliases extension regression risk)
- `filterAdjacency` unresolved edge P2 (currently 0, no impact; inherits the original buildChart design)
- Accumulated UAT (user-driven): seed #5 Programmers re-submission grading / seed #9 English production Grafana CB dashboard ai-analysis visual consistency / Sprint 160~190 accumulated UAT
- Optional follow-ups: remove coverage-gate `skipped` allowance · post-merge pre-deploy gate · automate prom-client Case B~D checks · `.claude-tools/` Phase 2 actual deletion · `(adr)` layout split (KR+EN override) · doc-refs bare-path expansion
