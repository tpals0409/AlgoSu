---
sprint: 144
title: Regression Blocking Automation — Sprint 143 Retrospective New Seeds SSOT/CI Strengthening
status: completed
period: 2026-05-08 (single day, 21 minutes)
start_commit: 738ff7d
end_commit: c27232c
prs:
  - https://github.com/tpals0409/AlgoSu/pull/205 (PR 1 — ServiceClient mock factory coverage CI verification)
  - https://github.com/tpals0409/AlgoSu/pull/206 (PR 2 — ai-analysis score weight SSOT single-source + recalculation TC auto-consistency)
related_sprints:
  - sprint-143 (carryover seeds bulk cleanup — new seeds A/B for this sprint identified in retrospective)
  - sprint-141 (carryover seeds bulk cleanup — retrospective seed → next sprint auto-linkage pattern prototype)
---

# Sprint 144 — Regression Blocking Automation

## Context

The following two regressions were directly experienced in Sprint 143 retrospective:

1. **PR #200 R1 P1**: When adding `ProblemServiceClient.getProblemInfo()`, mock factories in 3 specs were missing. Compilation passed (no method calls → no type errors) but runtime TypeError. **CI was green, and if Critic had not been invoked, it would have been merged**.
2. **PR #198 follow-up commit**: When changing ai-analysis correctness weight 30→40%, 3 weighted average TCs in `test_claude_client.py` (totalScore=68→70 / 64→66 / 62→65) required manual recalculation in a separate file. No SSOT for weights meant grep was mandatory to track dependent TCs on every distribution change.

Both cases relied on **human attention** (Critic / grep obligation) → structurally block with auto-detection/single-source.

This sprint prioritizes the **2 newly identified items from the retrospective** (seeds A, B) rather than the **3 items carried over from Sprint 143** (seeds #5, #7, #9). UAT seeds require user direct verification + seed #7 warrants a standalone PR → re-carried to Sprint 145.

### Processing Scope

| Seed | Location | Priority | Status |
|------|----------|---------|--------|
| A | submission ServiceClient mock factory CI verification | P1 | ✅ PR #205 |
| B | ai-analysis score weight SSOT single-source | P2 | ✅ PR #206 |

### Sprint 145 Carryover (Sprint 143 remaining 3 items)

- Seed #5: UAT — Programmers resubmission scoring pass confirmation (user direct)
- Seed #7: prometheus-rules / dashboard automatic verification CI (`promtool check rules` + grafana JSON cross-check)
- Seed #9: UAT — English environment calendar + production Grafana CB dashboard consistency (user direct)

## Decisions

### Seed A — Verification Location (CI script vs lint rule)

**CI script (adopted)**: Independent Node script (`scripts/check-mock-coverage.mjs`) + step added to `.github/workflows/ci.yml`.
- Advantage: No ESLint plugin authoring burden, auto-expandable by adding 1 item to `CHECKS` array when other ServiceClients are added. No AST parsing needed (union type regex is sufficient).
- Disadvantage: No immediate IDE feedback locally (verification only in CI).

**ESLint plugin (not adopted)**: Writing as a rule enables immediate IDE feedback, but plugin authoring/publishing/maintenance cost > verification value.

Verification target union type pattern: `^export type ProblemOp\s*=\s*(.+);$/m` → extract string literals then check for method existence in mock factories of each spec file.

### Seed B — Weight Single-Source Location (Python module vs JSON config)

**Python module constant (adopted)**: Define `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` dict in `prompt.py` + export `_format_weights_inline()` / `compute_total_score()` helpers.
- Advantage: Single import line, dynamic substitution of placeholders in `SYSTEM_PROMPT` / `SQL_SYSTEM_PROMPT` at module load time (auto-sync of parts where prompt body exposes weights as text).
- Disadvantage: No external operational visibility (code change required to modify distribution).

**JSON config (not adopted)**: Good operational visibility, but no deploy-free distribution change scenario + additional schema validation burden.

### New Test Class — `TestWeightsSSOTSync` (Regression Blocking Core)

Added to `test_prompt.py`:
- Verify that weight expressions appearing in prompt body match the `WEIGHTS` dict (block placeholder substitution omission).
- Verify that `compute_total_score(scores)` result matches manually weighted average (block helper self-regression).

3 weighted average TCs in `test_claude_client.py` changed from hardcoded scores (70/66/65) to `compute_total_score()` calls → **auto-consistent on weight changes**, grep tracking no longer needed.

## Change Summary

### PR #205 — Sprint 144 Seed A (squash merge `b957776`)

- New: `scripts/check-mock-coverage.mjs` (+110)
- Changed: `.github/workflows/ci.yml` (+3) — `node scripts/check-mock-coverage.mjs` step in Quality job
- Total: **2 files / +113 -0**
- Critic not invoked — simple CI infrastructure addition, low regression risk.

### PR #206 — Sprint 144 Seed B (squash merge `c27232c`)

- Changed: `services/ai-analysis/src/prompt.py` (+73 -35)
  - `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` dicts added
  - `_format_weights_inline(weights)` / `compute_total_score(scores, weights)` helpers added
  - `SYSTEM_PROMPT` / `SQL_SYSTEM_PROMPT` placeholders dynamically substituted at module load time
- Changed: `services/ai-analysis/src/claude_client.py` (+7 -8) — direct weighted average calculation → `compute_total_score()` call
- Changed: `services/ai-analysis/tests/test_claude_client.py` (+33 -6) — 3 weighted average TCs hardcoded → `compute_total_score()` calls
- New: `services/ai-analysis/tests/test_prompt.py` (+81) — `TestWeightsSSOTSync` + `TestComputeTotalScore`
- Total: **4 files / +194 -49**
- Critic not invoked — single-source refactoring, behavioral equivalence guaranteed by tests (totalScore result comparison).

## Verification

- 0 jest/pytest regressions
- All CI GREEN (Quality + Test all services + Coverage Gate + E2E)
- New tests: test_prompt.py 2 classes (regression blocking core)
- Merge interval: 21 minutes (13:41 KST → 14:02 KST)

## Patterns / Lessons

### New Patterns

1. **Retrospective seed immediate processing pattern** — Evolved from Sprint 141 prototype (carryover seeds bulk processing). Processing seeds identified in retrospective immediately at the start of the next sprint means (a) fresh context + (b) just directly experienced a regression case, so priority consensus is quick. Validated with single-day 21-minute merge.

2. **CI script vs ESLint plugin decision criteria** — When 1 line addition to `CHECKS` array is sufficient for other ServiceClient expansions → CI script. When AST analysis/cross-file refactoring tracking is needed → ESLint plugin. This sprint used union type → string literal regex, sufficient → CI script chosen.

3. **Python module constant SSOT + placeholder dynamic substitution** — In pattern where prompt body exposes weights as text (explicitly stating scoring criteria to LLM), auto-sync via dict → f-string substitution at module load time. Simpler than JSON config given no deploy-free distribution change scenario.

4. **Regression-blocking test class naming** — Like `TestWeightsSSOTSync`, explicitly names the defect being blocked. Future changers can immediately understand test intent (test name itself cites the retrospective case).

### Lessons

1. **Critic invocation omission = regression merge** — Sprint 143 PR #200 R1 P1 was caught by Critic, but if not invoked it would have merged with CI green. **Critic dependency → CI auto-detection transition** is the core value of this sprint's seed A. Going forward, "defect patterns frequently caught by Critic" should be identified as CI automation candidates.

2. **Hardcoded dependent TCs with grep tracking obligation = debt** — Sprint 143 PR #198 follow-up commit required finding weighted average TCs in a separate file via grep and manually recalculating on weight distribution change. This sprint converts to **calling verification functions** → grep obligation eliminated. The same pattern (hardcoded fixtures depending on SSOT changes) are all automation candidates.

3. **Retrospective → New seed → Next sprint immediate processing cycle** — If Sprint 141~143 resolved accumulated debt via "carryover seeds bulk cleanup," this sprint blocks debt accumulation itself via "retrospective seeds immediate processing." The two patterns are complementary.

## Branch Discipline

- ✅ New branch + PR + Squash merge — **10 consecutive sprints compliant** (since Sprint 134 violation)
- 0 direct commits to main

## ADR

- [sprint-144.md](sprint-144.md)
- Related: [sprint-143.md](sprint-143.md) — retrospective that identified this sprint's seeds
