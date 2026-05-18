---
sprint: 149
title: Regex Robustness Lint Rule Automation — Sprint 145~148 P2 4 Accumulated Cases Resolved (Seed #17)
status: completed
period: 2026-05-13 (single day)
start_commit: 60d2ede
end_commit: d1fe387
prs:
  - https://github.com/tpals0409/AlgoSu/pull/224 (PR #1 — scripts/check-regex-robustness.mjs new + CI integration, seed #17, Critic R1+R2+R3 P2 3 resolved → R4 clean)
  - https://github.com/tpals0409/AlgoSu/pull/225 (PR #2 — RUNBOOK §5 matrix + §6 ADR + §7 FAQ + §8 new, Critic not invoked)
related_sprints:
  - sprint-148 (5th regression blocking dimension — rule-label + dashboard-structure + RUNBOOK documentation — direct predecessor to this sprint's automation)
  - sprint-147 (panel title + variable usage verification + `|` precedence P2)
  - sprint-146 (quantifier inner brace P2 + Critic 3 rounds)
  - sprint-145 (character class P2 + SSOT assumption verification + regression blocking automation prototype)
  - sprint-142 (Critic 5-round pattern prototype — this sprint achieves clean in 4 rounds)
---

# Sprint 149 — Regex Robustness Lint Rule Automation (Seed #17)

## Goals & Background

**Regex robustness P2 caught by Critic R1/R2 in 4 consecutive sprints** during Sprint 145~148:

| Sprint | PR | P2 Defect | Classification |
|--------|----|----------|----------------|
| 145 | #208 | `[a-z_]+` digit missing → `2xx` metric no match | Character class consistency |
| 146 | #209 | `{2}` quantifier breaks `[^{}]*` selector | Quantifier inner brace |
| 147 | #218 | `\|` precedence ungrouped → `success_rate` global match | `\|` operator precedence |
| 147 | #219 | `${var:format}` format suffix optional missing | Prefix anchoring |

Sprint 148 documented the RUNBOOK `docs/runbook-regex-robustness.md` 260 lines 4-type checklist but relies on human attention. This sprint **auto-blocks** the RUNBOOK §2.1~2.4 checklist with a **static verification script**.

**Regression blocking cumulative dimension extension — 6th dimension**:
- Sprint 145: metric name consistency (entry point prototype)
- Sprint 146: label consistency (Grafana label collector)
- Sprint 147: panel title + variable usage
- Sprint 148: rule label + dashboard structure (datasource/empty/duplicate id)
- **Sprint 149: regex robustness static verification (4 rule types)**

## PR-by-PR Summary

### PR #224 — `scripts/check-regex-robustness.mjs` New + CI Integration (Seed #17)

- **Change**: `scripts/check-regex-robustness.mjs` new (337→357 lines, Critic accumulated +20) + `.github/workflows/ci.yml` paths filter + step (total 3 commits squashed)
- **4 Rule Implementation (RUNBOOK §2.1~2.4 1:1 mapping)**:
  - **Rule 1 (§2.1)**: Detect depth-0 `|` alternative separation where alternative has no anchor (`\b`/`^`/`\$`/`${`/`\{`/`(`/`(?:`)
  - **Rule 2 (§2.2)**: In `metricNamePattern`/`metricPattern`/`__name__` context (current line): alpha-only character class alone or combined with non-adjacent digit class — Prometheus spec `[a-zA-Z_][a-zA-Z0-9_]*` adjacent combination + second class alphanumeric requirement
  - **Rule 3 (§2.3)**: File-level `[^{}]*` selector wrapper + `{N}` quantifier simultaneously present + `normalizeExprForSelectorParse`/`__QUANTIFIER__`/`__GRAFANA_VAR__` helpers absent
  - **Rule 4-A (§2.4)**: Grafana variable extraction `\$\{(...)\}` missing `(?::[^}]*)?` format suffix optional capture (except `name:` JS template literal skip)
  - **Rule 4-B (§2.4)**: Wildcard `.+` pattern in metric context missing `^algosu_`/`^`/`\b` prefix anchor
- **Self-verification (`runRegressionFixtures()`)**: Sprint 145~148 P2 4 defect patterns analyzed as inline fixtures. Exit 2 self-test failure if not detected.
- **Exemption mechanism**: End-of-line `// regex-lint: allow-rule-N` or `// regex-lint: allow-rule-1,2` comments.
- **TARGET_FILES**: `scripts/check-grafana-metrics.mjs`, `check-prometheus-rules.mjs`, `check-mock-coverage.mjs`, `check-coverage.mjs` (excluding self).
- **CI integration**: `quality-monitoring` job step + add new script to `detect-changes` monitoring paths filter (omitted on first push → immediate fix commit).

#### Critic 4 Rounds P2 Resolution

| Round | Session ID | P2 Defect | Fix |
|-------|-----------|---------|-----|
| **R1** | `019e1e74-a309-7483-808a-2075849856a0` | `pattern.match()[0]` checks only first character class → valid Prometheus pattern `/[a-zA-Z_][a-zA-Z0-9_]*/`'s leading class `[a-zA-Z_]` has no digit → false positive | Collect all alpha-only classes + OK if any one contains digit |
| **R2** | `019e1e8c-e198-7d81-8453-4ae9232d00ad` | R1 fix exempts unrelated digit classes → non-adjacent patterns like `/algosu_[a-z_]+_status_[0-9]{3}/` with `_status_` token in between also OK (false negative) | Enforce Prometheus spec adjacent combination — digit class must be adjacent with only quantifier (`*`/`+`/`?`) between first alpha class |
| **R3** | `019e1e91-6780-77c0-a548-da72c4bec77b` | R2 fix also exempts digit-only adjacent class `[0-9]` → `/algosu_[a-z_]+[0-9]{3}/` style also OK even with alpha-only metric name part (false negative) | Only OK when subsequent class is **alphanumeric** (contains both alpha + digit) — exactly matches Prometheus spec `[a-zA-Z0-9_]` |
| **R4** | `019e1e94-829a-7541-8462-eb44e26eb6bf` | **Clean pass** ✅ — Codex: *"narrows Rule-2's exemption so digit-only adjacent classes are no longer treated as valid Prometheus metric-name continuations. I did not find a discrete introduced bug."* | — |

- **Verification matrix (after R3 fix)**:
  - baseline 4 scripts → exit 0 ✅
  - `/algosu_[a-z_]+[0-9]{3}/` (R3 P2 regression) → exit 1 ✅ detected
  - `/[a-zA-Z_][a-zA-Z0-9_]*/` (Prometheus spec) → exit 0 ✅ no FP
  - `/algosu_[a-z_]+_status_[0-9]{3}/` (R2 P2 regression) → exit 1 ✅ detected
  - `/[a-z_]+/` (Sprint 145 P2 regression) → exit 1 ✅ detected
  - `runRegressionFixtures()` 4 fixture self-test → OK ✅

- **CI**: 38 SUCCESS / SKIPPED, mergeStateStatus CLEAN

### PR #225 — RUNBOOK §5 Matrix + §6 ADR + §7 FAQ + §8 New (docs-only)

- **Change**: `docs/runbook-regex-robustness.md` +50 -3 (260 → 307 lines)
- **§5 Responsibility Matrix**: New "Regex Robustness Static Verification" row + 2 SSOT extension obligations added (TARGET_FILES update / Rule 2 context regex review)
- **§6 ADR Records**: Added `sprint-148` + `sprint-149` references
- **§7 FAQ Update**: "Automation in the future?" → "How was it automated?" (explicitly states introduction complete + rationale for choosing independent Node script over ESLint custom rule)
- **§8 New**: Lint rule ↔ checklist mapping — Each Rule 1~4: detection conditions + violation examples + regression seeds + exemption mechanism + self-verification
- **Critic**: Not invoked (docs-only)
- **CI**: 27 SUCCESS, mergeStateStatus CLEAN

## Decisions

### D-149-1: Independent Node Script Instead of ESLint Custom Plugin

**Options reviewed**:
- Option A: ESLint custom plugin (`eslint-plugin-regex-robustness`)
- Option B: Independent Node script (`scripts/check-regex-robustness.mjs`)
- Option C: Hybrid

**Adopted**: Option B

**Rationale**:
1. **Lint scope consistency**: Verification targets are 4 `scripts/check-*.mjs` files. Currently `scripts/` directory is outside ESLint scope (only NestJS per service / Next.js frontend are linted). Plugin adoption would require new lint environment for `scripts/`.
2. **Inheriting Sprint 145~148 single entry point cumulative dimension pattern**: All monitoring verification dimensions accumulated in `quality-monitoring` CI job. This sprint also integrates by adding a step to the same job.
3. **Self-verification freedom**: Can write `runRegressionFixtures()` function inline within script. Plugin requires separate test infrastructure.
4. **Avoiding AST dependency**: Line-based regex extraction is sufficient for the 4 script patterns (0 multi-line regex observed). Plugin forces ESTree AST dependency.

**Alternatives not adopted**:
- Option A: All 4 burdens above. False positive explosion risk if `scripts/` lint is activated.
- Option C: Excessive. Option B satisfies all requirements.

### D-149-2: Rule 2 "Prometheus Spec Adjacent Combination" Definition Refined to Alphanumeric Continuation

**Background**: R1~R3 P2 were all incremental refinements of Rule 2 detection boundary. Clean in 4th round (R4).

**Final definition**:
- Safe: First alpha-only class **immediately adjacent** (only quantifiers `*`/`+`/`?` allowed between) + second class is **alphanumeric** (contains both alpha and digit)
- Violation:
  - First alpha-only class alone (no subsequent class)
  - First alpha-only class + non-adjacent (literal token like `_status_` between)
  - First alpha-only class + adjacent digit-only class `[0-9]`

**Rationale**: In Prometheus metric name spec `[a-zA-Z_][a-zA-Z0-9_]*`, the **second** of the two character classes is alphanumeric (alpha + digit + underscore). Digit-only `[0-9]` is not a spec match but a separate pattern (status code suffix, etc.).

### D-149-3: Obligation to Simultaneously Update detect-changes Paths Filter When Adding New Monitoring Scripts

**Trigger**: On first push (commit `f748f0b`), `scripts/check-regex-robustness.mjs` not included in paths filter → `Quality — monitoring` SKIPPED → actual lint not run in CI (core regression blocking invalidated). Resolved with immediate fix commit.

**Policy**: When adding new `scripts/check-*.mjs`, simultaneously register in `.github/workflows/ci.yml` `detect-changes` job's `monitoring` paths filter. Documented in RUNBOOK §5 SSOT extension obligations.

## New Patterns

### P1: Critic 4 Rounds P2 Resolution → R4 Clean Threshold Reached

Intermediate between Sprint 142 (5 rounds) / Sprint 148 (3 rounds) patterns. Didn't clean in R3 but went to R4, where it cleared with "no discrete introduced bug."

**Key observation**: Each fix performs **only a single condition change** while refining — definitional corner cases of the previous fix discovered in the next round → resolved by single condition addition. All 4 rounds totaled only +47 -10 code changes (Rule 2 function single function).

**R3 → R4 Clean Threshold Sufficient Signal**:
1. Single condition addition (`&& /[a-zA-Z]/.test(next[0])`)
2. All definitional corner cases handled (alpha-only / digit-only / alphanumeric all cases)
3. Codex explicit: "no discrete introduced bug"

### P2: Regression Blocking Core 6-Dimension Automation Complete (Sprint 145~149 5 Sprints Accumulated)

Sprint 145 metric → Sprint 146 label → Sprint 147 panel-title+variable → Sprint 148 rule-label+dashboard-structure → **Sprint 149 regex-robustness**

This sprint automates **the robustness of monitoring verification scripts themselves** rather than monitoring changes. Meta-level regression blocking. Static verification conversion of RUNBOOK 4-type checklist.

### P3: Single Entry Point vs New Entry Point Decision Criteria

Sprint 145~148 all **accumulated in a single script `scripts/check-grafana-metrics.mjs`**. This sprint adopts **new script `check-regex-robustness.mjs`**.

**New entry point adoption conditions**:
- Verification target is different domain from existing SSOT (existing: metric definition match / this: verification scripts themselves robustness)
- No reuse with existing functions (regex literal extraction / rule-based checks etc.)
- 1:1 mapping with RUNBOOK checklist is cleaner

**Single entry point accumulation adoption conditions** (Sprint 145~148 pattern):
- Verification target is the same domain as existing SSOT (dashboard consistency)
- Reuse of existing functions possible (label collector / variable collector etc.)
- Baseline counters make cumulative visibility

### P4: Self-Verification (`runRegressionFixtures()`) Pattern

Script analyzes Sprint 145~148 P2 4 defect patterns as inline fixtures in itself at startup. Exit 2 (self-test failure) if not detected.

**Effects**:
1. Automatic baseline integrity protection — each run verifies fixes don't break fixture detection
2. Explicit preservation of regression seeds in code — defect patterns visible without needing to reference ADR
3. Two separate CI failure modes — exit 1 (policy violation) vs exit 2 (self-test failure)

## Lessons

### L-149-1: R1 Fix → R2 P2 → R3 P2 Pattern Reconfirmed — Simultaneous Corner Case Examination Obligation

Pattern already documented in Sprint 147~148 ADR, reproduced over 3 consecutive rounds in this sprint. Each round's fix handled only one corner of the definition domain while exposing another corner case.

**Rule 2 context evolution**:
- Before R1 fix: Only first character class checked (over-narrow)
- After R1 fix: OK if any alpha class has digit (over-broad)
- After R2 fix: Adjacency enforced (over-broad — digit-only adjacent)
- After R3 fix: Alphanumeric continuation enforced (accurate)

**Improvement action**: When fixing, simultaneously examine corner cases in the **opposite direction** (over-exemption / under-exemption) from the fix target — self-review checklist combined with RUNBOOK §3 fixture verification.

### L-149-2: Paths Filter for New Verification Script Addition Requires SSOT Extension Obligation — RUNBOOK Documentation Needed

First push paths filter omission found in this sprint. **Regression blocking automation being invalid if not run in CI**. Documented in RUNBOOK §5 SSOT extension obligations.

### L-149-3: Line-Based Regex Extraction Sufficient for 4 Scripts

Without ESTree AST dependency, line-based regex extraction (`/(?:=\s*|[|(,;:[\s]\s*)\/((?:[^/\\\n]|\\.)+)\/[gimsuy]*/g`) extracts all regex literals in 4 scripts with no false negatives. Only need to add JSDoc block comment `/** */` processing + single line `//` skip.

**Limitation**: `new RegExp('pattern')` form / multi-line regex are false negatives. 0 observed in these 4 scripts — acknowledges line-based analysis limitations when used in the future.

### L-149-4: Self-Verification Fixtures Serve as Fix Regression Safety Net

All 4 fixtures in `runRegressionFixtures()` passed through R1~R3 fixes. Automatically guarantees fixes can't break regression seed detection — **independent safety net from Critic R1~R3 review**.

## Carryover Seeds (Sprint 150)

0 new carryover from this sprint. Sprint 148 remaining seeds carried as-is:

- **UAT User Direct** (Outside Oracle's scope):
  - Seed #5: Programmers resubmission scoring pass confirmation (6 sprints accumulated)
  - Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency

- **Automation / Infrastructure** (Oracle work targets):
  - Seed #14: ai-analysis problem context follow-up (frontend leveraging / submission schema / saga payload)
  - Seed #15: `extractInlineBlock()` asymmetric processing (currently no regression, gradual improvement candidate)
  - Seed #16: `.claude/` gitignore policy review — `.claude/commands/` tracked conversion

## Branch Discipline

**15 consecutive sprints compliant** ✅:
- PR #224: `feat/sprint-149-regex-robustness-lint` (new branch) → Squash merge → branch deleted
- PR #225: `docs/sprint-149-runbook-section-8` (new branch) → Squash merge → branch deleted
- 0 direct commits to main (since Sprint 134 violation)

## Verification

| Verification Item | Result |
|------------------|--------|
| PR #224 CI | 38 SUCCESS / SKIPPED, CLEAN ✅ |
| PR #225 CI | 27 SUCCESS, CLEAN ✅ |
| baseline `node scripts/check-regex-robustness.mjs` | exit 0 ✅ |
| `runRegressionFixtures()` 4 Sprint P2 fixtures | all detected ✅ |
| 4-type regression scenario injection | all exit 1 ✅ |
| Valid Prometheus spec injection | exit 0 (no FP) ✅ |
| Critic 4 rounds P2 resolution | R1→R2→R3 fix → R4 clean ✅ |
| Branch discipline | both PRs new branches + Squash merge ✅ |

## References

- PR #224: https://github.com/tpals0409/AlgoSu/pull/224
- PR #225: https://github.com/tpals0409/AlgoSu/pull/225
- Codex session IDs:
  - R1: `019e1e74-a309-7483-808a-2075849856a0`
  - R2: `019e1e8c-e198-7d81-8453-4ae9232d00ad`
  - R3: `019e1e91-6780-77c0-a548-da72c4bec77b`
  - R4: `019e1e94-829a-7541-8462-eb44e26eb6bf`
- Related document: `docs/runbook-regex-robustness.md` §8 (lint rule ↔ checklist mapping)
- Previous ADR: `docs/adr/sprints/sprint-148.md`
