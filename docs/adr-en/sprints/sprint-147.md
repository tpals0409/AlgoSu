---
sprint: 147
title: Sprint 146 Regression Blocking Follow-up Extension — Panel Title + Variable Usage Verification
status: completed
period: 2026-05-12 (single day)
start_commit: 7fca904
end_commit: 9d303ac
prs:
  - https://github.com/tpals0409/AlgoSu/pull/217 (PR #3 — Sprint 144~146 ADR bulk housekeeping, Critic not invoked)
  - https://github.com/tpals0409/AlgoSu/pull/218 (PR #1 — Panel title ↔ metric consistency verification, Critic R1+R2 P2 3 resolved)
  - https://github.com/tpals0409/AlgoSu/pull/219 (PR #2 — Dashboard unused variable detection, Critic R1+R2 P2 1 resolved)
related_sprints:
  - sprint-146 (regression blocking automation — direct extension target of Grafana metric/label verification entry point)
  - sprint-145 (Prometheus Rules + Grafana Dashboard verification infrastructure — cumulative dimension extension basis)
  - sprint-144 (regression blocking automation — "Critic-caught pattern → CI automation candidate" prototype)
  - sprint-141 (group split PR pattern — directly applied in this sprint's 3 PRs)
  - sprint-142 (Critic multiple round pattern prototype)
---

# Sprint 147 — Sprint 146 Regression Blocking Follow-up Extension — Panel Title + Variable Usage Verification

## Context

Sprint 146 extended `scripts/check-grafana-metrics.mjs` to 553 lines and built infrastructure for automatically verifying **metric name + label name** consistency against service code SSOT in dashboard exprs (PR #209). This sprint inherits the Sprint 146 pattern of **accumulating verification dimensions** at the same entry point to:

1. **Panel title ↔ metric consistency**: Pre-block regressions where expr is not updated when panel name is refactored (e.g., detecting "Circuit Breaker State" panel kept + expr changed to `algosu_*_http_requests_total`)
2. **Unused dashboard variable detection**: Pre-block orphaned variables created when variables are defined then expr is deleted
3. **ADR housekeeping**: Bulk merge of Sprint 144~146 untracked ADR debt accumulated in git tree

The 2 carryover seeds (seed #5 UAT Programmers / seed #9 UAT visual consistency) are **essentially user environment-dependent** and outside Oracle's scope — accumulated carryover from Sprint 143~147. As per Sprint 146's "UAT → automated verification structure conversion" pattern, regression seed blocking nets were added this sprint as well.

3 PR split pattern (Sprint 141 group split directly applied) with squash merge completion.

## Decisions

### 1) Scope Decision (B+ADR housekeeping = Plan C)
- User selection: Plan C (Panel title + Variable usage + ADR housekeeping)
- Plan D candidate (+ Recording rule label verification) has 0 current defects + low ROI → deferred to Sprint 148+ seed

### 2) Panel Title ↔ Metric Matching Algorithm = Keyword Whitelist
- User selection: explicit keyword dictionary (`PANEL_TITLE_KEYWORD_MAP`) based matching
- Alternatives (Substring lax / Panel-level annotation) have false positive risk or large migration cost
- **Obligation to explicitly extend this SSOT when adding new panels** — documented in JSDoc comments

### 3) Plan's "scribe" Mapping → Actual "architect" Re-routing
- Initial plan delegated PR #1/#2 to scribe, but Scribe immediately declined ("only responsible for documents/memory/skills, code writing prohibited")
- Re-routing: `scripts/check-grafana-metrics.mjs` is a CI pipeline + Grafana monitoring domain → **Architect** (`architect.md`'s "GitHub Actions CI pipeline + Prometheus/Grafana" responsibility)
- **Decision**: Agent mappings in plans must be cross-checked with domain manuals. In future plan stages, explicitly verify responsibility scope in `.claude/commands/agents/{name}.md`.

### 4) Critic Invocation Policy
- PR #1: Auto-Critic 2 rounds (R1 + R2 effectively forced after re-commit) — regex matching + new SSOT introduction justifies multiple rounds (Sprint 146 learning)
- PR #2: Plan initially stated "Critic not invoked" but Auto-Critic automatically queued → P2 1 caught. Immediately fixed + Auto-Critic R2 clean pass
- PR #3: 0 code changes → Critic not invoked (same Sprint 141 policy)

### 5) DIRTY mergeStateStatus Simultaneous Resolution Policy (New)
- PR #2 (PR #219) had `mergeStateStatus: DIRTY` on first push (PR #218 merge updated main → branch stale)
- **Decision**: Bundle Critic R1 P2 fix and main rebase in **single dispatch** to shorten cycle time. force-with-lease push to update PR.

## Patterns

### Cumulative Regression Blocking Core Dimension Extension (Sprint 145~146 Pattern Inherited)
- Cumulative verification dimensions at single entry point `check-grafana-metrics.mjs`:
  - Sprint 145: metric name (service code ↔ dashboard expr)
  - Sprint 146: label name (TS labelNames + Python labelnames ↔ dashboard expr labels)
  - **Sprint 147: panel title + dashboard variable**
- Result: 553 lines (Sprint 146 end) → 741 lines (seed #1) → 823 lines (seed #2). 0 CI job additions (`quality-monitoring` job unchanged).

### Plan Assumption Broken Immediate Report + Re-routing
- Sprint 146's "report takes priority when plan assumption breaks during exploration" principle applied at **Scribe domain rejection** timing. Immediately re-route to architect decision → 0 merge cycle impact.
- Generalization: When an agent rejects work (`status: failed` reply to inbox), Oracle chooses among (a) domain re-routing (b) work scope adjustment (c) user decision. This sprint chose (a).

### Critic Multiple Rounds R2 Forced → R3 Non-invocation Threshold
- Sprint 146 pattern ("R2 forced invocation, R3 only if P2 remains") applied to PR #1
- R2 Codex verdict: "no discrete regression introduced" → R3 not invoked (R3 clean threshold = "no discrete introduced bug")
- **Threshold explicitly stated**: R3 not invoked when R2 result simultaneously satisfies "no newly introduced defects + all existing defects resolved"

### Regex Robustness P2 Pattern Accumulation (Sprint 145 → 147)
- Sprint 145 P2: dashboard regex `__name__=~` selector entirely masked → false negative
- Sprint 146 P2: `5[0-9]{2}` quantifier breaks selector wrapper regex
- **Sprint 147 P2-2**: `/algosu:[a-z_:]*availability|success_rate/` operator precedence causes `success_rate` to match standalone without prefix → future false negative
- **Common pattern**: 4 items to check every time writing PromQL/dashboard regex: (a) `|` precedence (b) character class consistency (c) quantifier processing (d) prefix anchoring. Accumulated seeds → Sprint 148+ "regex robustness lint rule" consideration possible.

### Verification Outside Target Panels Silent Skip Policy + JSDoc Explicit Documentation
- Panels not registered in `PANEL_TITLE_KEYWORD_MAP` are silently skipped by `matchedKeywords.length === 0` condition
- This policy's pitfall: SLO dashboard "Claude API Request Rate" panel actually references `algosu_*` metrics, but if keyword not registered it falls outside verification scope → **Critic R1 immediately caught + 'request rate' added as fix**
- **Obligation to explicitly extend this SSOT when adding new panels** documented in JSDoc (operational documentation)

### Grafana Format Syntax Recognition Regex (PR #2 P2)
- Grafana multi-value variables are injected into panel exprs as `${service:regex}` / `${name:pipe}` / `${name:csv}` format
- Added `(?::[^}]*)?` optional capture to `extractVariableReferences()` regex to recognize colon + format specifier part
- Pre-blocks false positives when introduced in future (currently unused across 3 dashboards)

## Lessons

### 1. Plan Agent Mappings Must Be Cross-Checked with Domain
- This sprint's plan delegated PR #1/#2 to "scribe" but Scribe has code writing explicitly prohibited in its domain
- Future plans: must check `## Role & Core Responsibilities` + `## Prohibited Actions` sections in `.claude/commands/agents/{name}.md`
- Regression blocking: cite 1 line from agent domain manual during plan writing

### 2. Auto-Critic Automatically Queues Regardless of Plan's "Critic Not Invoked" Statement
- PR #2 plan stated "Critic not invoked" but `oracle-auto-critic.sh` auto-triggers when a code-changing agent commits (Sprint 117~ policy in `_base.md`)
- Result: 1 P2 caught + immediately resolved → beneficial for regression blocking core
- **Lesson**: Plan's Critic invocation policy only affects "whether to manually add R2." Auto-Critic is the default applied to all code-changing work.

### 3. DIRTY Merge State Only Means Simple Base Mismatch
- PR #219 DIRTY is because branch is stale (PR #218 merge result not reflected), though base itself tracks main
- gh API shows `baseRefOid: be76c43` (latest main) accurately but mergeable calculation detects stale branch
- **Lesson**: In consecutive PR splits, the N+1th PR must rebase to main after Nth merge. Bundling with P2 fix saves cycle time.

### 4. Regression Seed Accumulation → CI Automation Candidate Identification Signal
- Sprint 144 PR #205 (mock coverage CI script): Critic-caught pattern → automation
- Sprint 145~146 PR #207~209 (prometheus + grafana verification): accumulated seeds → automation
- **Sprint 147 new seed candidate**: regex robustness P2 found 3 consecutive sprints → Sprint 148+ "regex robustness lint rule" or regex writing guide RUNBOOK candidate

## Seeds (Sprint 148+ Carryover)

### UAT User Direct (Sprint 143~147 Accumulated, Outside This Sprint's Scope)
- **Seed #5**: Programmers resubmission scoring pass confirmation (user direct UAT)
- **Seed #9**: English environment + production Grafana CB dashboard ai-analysis visual consistency confirmation (user direct UAT)
- Regression seeds blocked by this sprint's and Sprint 146's auto-blocking nets. Only the UAT itself remains as user responsibility.

### Automation Candidates (Sprint 148+ Oracle Work Targets)
- **New seed #11**: Recording rule (`algosu:*`) label definition ↔ service code consistency verification (currently 0 defects, proactive, difficulty Low)
- **New seed #12**: Dashboard datasource consistency + empty panel + duplicate panel id verification (currently 0 defects, proactive)
- **New seed #13**: Regex robustness lint rule or regex writing guide RUNBOOK (Sprint 145~147 P2 3 accumulated pattern blocking)
- **New seed #14**: ai-analysis problem context follow-up (Sprint 143 PR #200 unresolved — frontend leveraging problem context / submission response schema extension / saga payload flow verification)

## Verification

- All PRs: CI **28 SUCCESS / 11 SKIPPED**, mergeStateStatus CLEAN (re-verified after force-with-lease push)
- `scripts/check-grafana-metrics.mjs` final baseline: 204 metrics / 32 strict / 15 wildcard / **124 labels** / **41 panel title pairs** / **2 vars / 0 unused**
- Regression scenarios: PR #1 4 cases (scenario 1: title kept + expr metric prefix changed / scenario 2: title-expr domain mismatch / scenario 3: row type skip / scenario 4 Critic R1 follow-up: Claude API Request Rate panel TYPO expr detected) + PR #2 1 case (templating.list unused_test_var added → FAIL detected) all correct
- Branch discipline: **13 consecutive sprints compliant** ✅ — all 3 PRs use new branches + Squash merge, 0 direct commits to main (since Sprint 134 violation)

## ADR References

- This ADR: `docs/adr/sprints/sprint-147.md`
- Sprint 146 ADR: `docs/adr/sprints/sprint-146.md` (direct extension of regression blocking automation)
- Sprint 145 ADR: `docs/adr/sprints/sprint-145.md` (prometheus/grafana verification infrastructure basis)
- Sprint 141 ADR: `docs/adr/sprints/sprint-141.md` (group split PR pattern directly applied)
