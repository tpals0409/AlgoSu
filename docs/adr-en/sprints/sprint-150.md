# Sprint 150 — Carryover Seeds Cleanup (Seeds #16/#15/#14 Bundle Processing)

- **Period**: 2026-05-13 (single day)
- **Status**: Completed ✅
- **origin/main**: `d1fe387` → **`2f68402`** (3 PR squash merges)
- **start_commit**: `d1fe387`
- **end_commit**: `2f68402`
- **Merged PRs**: 3

## Goals

Resolve 3 automation candidates from Sprint 149 carryover (seeds #14/#15/#16) in a single sprint. Inherits Sprint 144~149's "single-day 2~3 PR bundle" pattern. Each seed separated into independent PR units for squash merge.

## Merged PRs

| PR | Seed | Commit | Change Scale | Critic |
|----|------|--------|-------------|--------|
| [#226](https://github.com/tpals0409/AlgoSu/pull/226) | #16 `.claude/commands` tracked policy | `c08f5e4` | 21 files / +1161 -4 | Not invoked (policy/docs) |
| [#227](https://github.com/tpals0409/AlgoSu/pull/227) | #15 extractInlineBlock 6-type YAML modifier | `dcd2502` | 1 file / +29 -2 | R1+R2 P2 resolved → **R3 clean** |
| [#228](https://github.com/tpals0409/AlgoSu/pull/228) | #14 problem context coverage strengthening | `2f68402` | 3 files / +228 -1 | R1 clean + R2 clean |

## Work Summary

### PR #226 (Seed #16) — `.claude/commands` Tracked Policy (`c08f5e4`)

**Background**: Sprint 147 retrospective revealed limitation that RUNBOOK cross-refs added to `.claude/commands/agents/{critic,architect}.md` cannot sync to other machines because they're gitignored.

**Changes**:
- `.gitignore`: Introduced `.claude/*` + `!.claude/commands/` negation pattern (commands tracked, `settings.local.json`/`scheduled_tasks.lock` untracked)
- `.claude/commands/` 18 files newly tracked (5 root commands + 13 agents)
- `docs/runbook-claude-commands.md` new 6 sections — tracked/untracked boundary policy, new registration obligation, security grep checklist, local/shared boundary decision criteria
- `CLAUDE.md` "Agent Workflow" section expanded
- `agents/` stale line removed (.gitignore L92 — directory doesn't exist)
- `.claude-tools/` explicitly untracked (Oracle dispatch tools, separate cleanup planned)

**Security verification**: grep of all 18 files — 14 matches all policy keyword text (0 actual secret values).

### PR #227 (Seed #15) — extractInlineBlock 6-Type YAML Modifier Recognition Unification (`dcd2502`)

**Background**: Sprint 148 PR #221 Critic R2 observation. `scripts/check-grafana-metrics.mjs:638` `extractInlineBlock()` recognizes only single `${key}: |` modifier, while the same file's `validateRuleExprLabels` (around L972) recognizes all 6 modifiers (`|`, `|-`, `|+`, `>`, `>-`, `>+`) — asymmetric. Currently no regression since all ConfigMaps use `|`, but future authors using `|-`/`>` would cause silent skip → dashboard verification itself would not operate.

**Changes (R1→R2→R3 incremental refinement)**:
- R1 (`8741aea`): `[|>][-+]?\s*$` regex + `escapeRegExpLiteral` helper — over-narrow (rejects inline comment + indentation indicator)
- R2 (`ce12c91`): `[|>](?:[-+]?[1-9]?|[1-9]?[-+]?)\s*(?:#.*)?$` — allows indentation indicator but conflicts with hardcoded 4-space body indent
- R3 (`09ec31b`): `[|>][-+]?\s*(?:#.*)?$` — intentionally rejects explicit indentation indicator + maintains inline comment. Policy explicitly documented (avoids silent skip)

**Verification matrix**:
- POSITIVE 9 types: 6 modifiers + 3 inline comment variants → EXTRACT ok
- INTENTIONAL REJECT 5 types: `|1`, `|2`, `|-2`, `|2-`, `|+3` → NULL ok (intentional)
- INVALID YAML 5 types: `|*`, `|abc`, `|--`, `||`, `|>` → NULL ok
- Baseline unchanged: 204 metrics / 32 strict / 15 wildcard / 124 labels / 41 panel pairs / 2 vars / 15 rule pairs / 0 violations

### PR #228 (Seed #14) — Problem Context Regression Blocking + Coverage Strengthening (`2f68402`)

**Background**: Regression blocking test absence for `submission.service.ts` L89~90 `problemTitle ?? ''` fallback policy decided in Sprint 143 Critic R2 P2. Additionally, CI Test Submission was being bypassed by paths filter SKIPPING, exposing debt where functions 95.53% threshold was being circumvented on main.

**Change steps**:
1. **`de08975`** (`submission.service.spec.ts` +72): 3 regression blocking tests for `?? ''` fallback
   - null title/description → stores `''` in entity
   - undefined title/description → stores `''` in entity
   - normal title/description → stores actual value in entity
2. **`f98ff19`** (`problem-service-client.spec.ts` +156 + `jest.config.ts` +1):
   - `getProblemInfo()` 5 cases (normal / userId not passed / CB throw fallback / Error resolve defense / config not set immediate fallback)
   - `_doGetProblemInfo()` 3 cases (200 normal / 200 missing empty string / 404 throw)
   - `jest.config.ts`: Added `!**/*.spec.ts` to `collectCoverageFrom` (policy clarification)

**Verification**:
- jest 354 tests passed (previous 346 + 8 new), success=true
- All thresholds passed
- `problem-service-client.ts` coverage: stmt 78.9 → 97.77 / br 72.7 → 93.93 / fns 83.3 → 100 / lines 78 → 98.8

## Critic Invocation (3 PRs × Rounds)

| PR | Round | Session ID | Result |
|----|-------|-----------|--------|
| #226 | — | — | Not invoked (policy/docs) |
| #227 | R1 | `019e1ebb-8a05-7543-ba4f-0ccfee5cb1cc` | P2 1 (anchored regex over-narrow) |
| #227 | R2 | `019e1ebe-45a2-7161-a603-9e303156fbec` | P2 1 (indentation indicator + body indent) |
| #227 | R3 | `019e1ec0-f336-74e3-926b-67d8559b7f4f` | **clean** ✅ |
| #228 | R1 | — | clean (focused regression tests) |
| #228 | R2 | — | clean (coverage strengthening + spec exclusion policy) |

## Verification Results

| PR | CI | Test Submission | mergeStateStatus |
|----|----|-----------------|------------------|
| #226 | 38 SUCCESS / 11 SKIPPED | n/a (paths SKIPPED) | CLEAN |
| #227 | 27 SUCCESS / 12 SKIPPED | n/a (paths SKIPPED) | CLEAN |
| #228 | 28 SUCCESS / 11 SKIPPED | **pass** (354 tests, threshold passed) | CLEAN |

## Branch Discipline

- **All 3 PRs: new branches + Squash merge** — **16 consecutive sprints compliant** (since Sprint 134 violation)
- 0 direct commits to main
- Branch names: `chore/sprint-150-claude-tracked`, `refactor/sprint-150-extract-inline-block-symmetric`, `test/sprint-150-problem-context-coverage`

## New Patterns

### 1. `.claude/commands/` Tracked SSOT Conversion

12 agent personas + 5 root command files converted to tracked via `.gitignore` negation pattern (`!.claude/commands/`). Sync possible across multiple machines/teammates. Local-only files (`settings.local.json`, `scheduled_tasks.lock`) remain untracked with `.claude/*`, making the boundary explicit.

### 2. Regression Blocking Core Cumulative Dimension Extension — 7th Dimension

Following Sprint 145~149 monitoring verification accumulation (metric → label → panel-title+variable → rule-label+dashboard-structure → regex-robustness), **submission service problem context fallback SSOT verification closed**. 4-layer cumulative verification:
- submission.entity (nullable)
- submission.service.ts L89~90 (`?? ''` fallback)
- worker.py L220~227 (null branch, Sprint 143)
- submission.service.spec.ts (regression blocking test, **this PR**)

### 3. Paths Filter Bypass Debt Exposure Mechanism

When CI Test Submission is SKIPPED by paths filter (`services/submission/**`), main's coverage threshold failures are bypassed. Actual execution occurs in PRs where submission/** changes are made, exposing failures → immediate strengthening obligation. This time `problem-service-client.ts`'s `getProblemInfo` function itself was not called in unit tests.

### 4. Critic 3-Round P2 Resolution → R3 Clean Pattern (PR #227)

- R1 over-narrow → R2 over-permissive (allows indentation indicator → body indent assumption breaks) → R3 accurate (intentional reject)
- R3 conclusion: "Explicit indentation indicator (`|1`/`|2`) is unused in production ConfigMaps → explicit reject avoids silent skip"
- Same pattern as Sprint 142 (5 rounds) / Sprint 148 (3 rounds) / Sprint 149 (4 rounds) — single condition incremental refinement

### 5. Seed Bundle Single Sprint Processing Effect

3 carryover seeds processed in a single day with 3 PRs — inherits Sprint 144 pattern (2 PRs / 21 minutes). Fresh context + co-exposure of incidental debt (coverage threshold) + immediate retrospective seed processing.

## Lessons

### 1. Paths Filter is a Double-Edged Sword — Accumulated Debt Bypass Risk

`detect-changes` paths filter is effective for reducing CI time, but **services with no changes can bypass coverage threshold failures**. Metrics passing on main may actually fail when executed. → Regular check (e.g., quarterly full CI run) or separate weekly job candidate identified.

### 2. Adding Specs Alone Cannot Strengthen Coverage

Adding 3 regression blocking tests to submission.service.spec.ts alone does not cover `problem-service-client.ts` production functions themselves. **The core of regression blocking is executing production branches**, so unit tests for production methods are needed beyond mock factory additions.

### 3. Single-Function Modifier Support Range Asymmetry is a Time Bomb

`extractInlineBlock` single modifier vs `validateRuleExprLabels` 6-modifier asymmetry was recognized in Sprint 148 but classified as gradual improvement candidate. Resolved in this PR 6 sprints later. **Silent skip risk accumulates from the recognition point**.

### 4. Defect Patterns Frequently Caught by Critic Are CI Automation Candidates

PR #227 R1+R2 P2 catches both follow patterns explicitly stated in RUNBOOK §2.4 prefix anchoring checklist. Sprint 149 PR #224 completed lint automation (`check-regex-robustness.mjs`). **Future same patterns blocked at lint stage before Critic invocation**.

### 5. Operational Policy Documentation is Key to Avoiding Silent Skip

YAML 1.2 spec allows `|1`/`|2` indentation indicators as valid, but they're unused in this codebase. R2 fix allowing them conflicted with hardcoded body indent. **R3 policy documentation (unsupported) + explicit NULL return when someone uses them in the future** → intentional safety net.

## Sprint 151 Carryover Seeds

### UAT User Direct (Outside Oracle's Scope)
- Seed #5: Programmers resubmission scoring pass confirmation (7 sprints accumulated)
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency

### Automation / Infrastructure
- No new carryover from this sprint: **0** (all 3 Sprint 149 automation candidates resolved)

### Candidates (Separate Decision Needed)
- `.claude-tools/` Oracle dispatch tool cleanup (explicitly untracked in PR #226, separate seed)
- CI paths filter bypass debt check automation (lesson #1 from this PR)
- prom-client default metric stale check (Sprint 145 seed #10)
