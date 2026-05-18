---
sprint: 148
title: Sprint 147 Regression Blocking Follow-up Extension — Recording Rule Labels + Dashboard Structure + Regex RUNBOOK
status: completed
period: 2026-05-12 ~ 2026-05-13 (single cycle, includes overnight work)
start_commit: 9d303ac
end_commit: c04b889
prs:
  - https://github.com/tpals0409/AlgoSu/pull/220 (PR #1 — Regex Robustness RUNBOOK + Agent cross-ref, seed #13, Critic not invoked)
  - https://github.com/tpals0409/AlgoSu/pull/221 (PR #2 — Recording rule+Alert rule label consistency verification, seed #11, Critic R1+R2 P2 1 resolved)
  - https://github.com/tpals0409/AlgoSu/pull/222 (PR #3 — Dashboard structure 3-dimension verification, seed #12, Critic R1+R2+R3 P2 3 resolved)
related_sprints:
  - sprint-147 (regression blocking follow-up extension — panel title + variable usage verification — direct extension target)
  - sprint-146 (regression blocking automation — Grafana metric/label verification entry point prototype)
  - sprint-145 (Prometheus Rules + Grafana Dashboard verification infrastructure basis)
  - sprint-142 (Critic multiple round pattern prototype)
---

# Sprint 148 — Sprint 147 Regression Blocking Follow-up Extension — Recording Rule Labels + Dashboard Structure + Regex RUNBOOK

## Goals & Background

Sprint 147 extended `scripts/check-grafana-metrics.mjs` to 823 lines and added **panel title ↔ metric consistency + unused variable** dimensions. This sprint bundles the 3 Sprint 147 carryover automation candidates (seeds #11/#12/#13):

1. **Seed #13 — Regex Robustness RUNBOOK** (PR #220): Root cause of regex P2 being caught 3 consecutive sprints in Sprint 145~147 — structurally blocks 4 common pitfalls in writing PromQL/JavaScript regex (`|` precedence / character class inconsistency / quantifier processing / prefix anchoring) that relied on human attention using a **documented checklist**. Agent cross-refs added to `.claude/commands/agents/` to mandate RUNBOOK reference during review.

2. **Seed #11 — Recording Rule Label Consistency Verification** (PR #221): Auto-verify that labels used in `prometheus-rules.yaml` `record:` + `alert:` expressions are consistent with labels defined in service code SSOT. Full support for YAML block scalar modifiers (`|`/`|-`/`>`, etc., all 6 types). External metric skip policy explicitly stated (`up`/`rabbitmq_*`/`kube_*`/`container_*`).

3. **Seed #12 — Dashboard Structure Verification** (PR #222): Simultaneously verify 3 dimensions — datasource consistency (Prometheus uid enforced) + empty targets panel detection + duplicate panel id detection across dashboard JSON. Loki (uid=loki) exemption policy. Policy branching for target.datasource null = panel inheritance (skip) vs variable.datasource null = top-level (violation) documented in both JSDoc + inline comments.

Sprint 145 metric → Sprint 146 label → Sprint 147 panel-title+variable → **Sprint 148 rule-label+dashboard-structure** — 5th cumulative dimension extension.

## PR-by-PR Summary

### PR #220 — `docs/runbook/regex-robustness.md` New (Seed #13)

- **Change**: `docs/runbook/regex-robustness.md` new 260 lines 7 sections
- **Content**:
  - §1 Background: Analysis of 3 accumulated regex P2 cases in Sprint 145~147
  - §2 Checklist of 4 types: `|` precedence / character class consistency / quantifier processing / prefix anchoring
  - §3 PromQL idiomatic patterns SSOT (label selector masking / `__name__` selector / union vs wildcard)
  - §4 JavaScript regex idiomatic patterns (sticky flag caution / source property / unicode)
  - §5 Automation candidate list (Sprint 149+ seed #17 — lint rule candidate)
  - §6 Historical case citations (Sprint 145~147 P2 three cases in detail)
  - §7 Reference links
- **Agent cross-ref**: RUNBOOK reference added to `.claude/commands/agents/critic.md` + `architect.md` (gitignored, local only)
- **Critic**: Not invoked (docs-only, excluded from Auto-Critic)
- **CI**: docs-only → mostly SKIPPED, mergeStateStatus CLEAN

### PR #221 — Recording Rule + Alert Rule Label Consistency Verification (Seed #11)

- **Change**: `scripts/check-grafana-metrics.mjs` 842→1023→1036 lines (+189 -1)
- **3 new functions**:
  - `extractRulesWithExpr(yamlContent)` — supports all 6 YAML block scalar modifiers `|`/`|-`/`|+`/`>`/`>-`/`>+` to extract record/alert expressions
  - `validateRuleExprLabels(expr, definedLabels, metricName)` — verifies extracted PromQL expression labels are contained in service code SSOT defined label set
  - `collectRecordingRuleExprViolations(rulesYaml, definedLabels)` — collects violations across entire rules YAML
- **External metric skip policy**: `up`/`rabbitmq_*`/`kube_*`/`container_*` patterns — consistent with Sprint 145 policy (metrics outside service code SSOT)
- **Baseline**: 15 rule pairs / 5 external skipped / 0 violations
- **Critic R1+R2**: R1 P2 1 (YAML block scalar modifier `|-`/`>` not recognized → false negative) → fix (expanded to all 6 types) → R2 clean pass ✅ ("no discrete introduced bug")
- **CI**: SUCCESS, mergeStateStatus CLEAN

### PR #222 — Dashboard Structure 3-Dimension Verification (Seed #12)

- **Change**: `scripts/check-grafana-metrics.mjs` 1030→1286→~1295 lines (+293 -2)
- **4 new functions**:
  - `checkDatasourceAllowed(datasource, context)` — enforce Prometheus (uid=prometheus), exempt Loki (uid=loki), violation for others
  - `isPanelTargetsEmpty(panel)` — detect panels with no or empty targets array
  - `walkPanelsForStructural(panels, violations, context)` — recursive panel traversal (row type → includes sub-panels)
  - `collectDashboardStructuralViolations(dashboards)` — collect violations across 3 dimensions (datasource/empty-targets/duplicate-id)
- **Loki exemption policy**: `uid=loki` datasource exempted as logging-only
- **target vs variable null policy branching**:
  - `target.datasource === null` → panel inheritance = Grafana standard behavior → skip
  - `variable.datasource === null` → top-level variable has no inheritance meaning → violation
  - Rationale documented in both JSDoc + inline comments
- **Baseline**: 41 panels / 3 dashboards / 0 violations
- **Critic R1+R2+R3**:
  - R1 P2 2: (1) target-level datasource override not verified (target datasource can point to different source when panel datasource is overridden) / (2) variable null skip false negative (variable.datasource null = top-level means violation)
  - R2 P2 1: (1) R1 fix added target.datasource null check → target null = panel inheritance false positive risk (skip is correct)
  - R3 clean pass ✅ ("no discrete regression introduced — target null skip is correct per Grafana spec")
- **CI**: SUCCESS, mergeStateStatus CLEAN

## New Patterns

### 1. Regression Blocking Core Cumulative Dimension Extension — 5th Dimension

Verification dimensions accumulated at single entry point `scripts/check-grafana-metrics.mjs`:
- Sprint 145: metric name (service code ↔ dashboard expr)
- Sprint 146: label name (TS labelNames + Python labelnames ↔ dashboard expr labels)
- Sprint 147: panel title keyword + dashboard variable
- **Sprint 148: rule expression label + dashboard structure (datasource/empty/duplicate-id)**

Result: 823 lines (Sprint 147 end) → 1036 lines (seed #11) → ~1295 lines (seed #12). 0 CI job additions.

### 2. YAML Block Scalar Modifier All 6 Types Support

When embedding multi-line PromQL in Kubernetes ConfigMap, 5 types other than `|` are commonly used: `|-`/`|+`/`>`/`>-`/`>+`. `extractRulesWithExpr()` designed to support all 6:
- `|` (literal, preserves trailing newline)
- `|-` (literal, strips trailing newline) ← Critic R1 P2 target
- `|+` (literal, preserves trailing newlines)
- `>` (folded, preserves trailing newline)
- `>-` (folded, strips trailing newline) ← Critic R1 P2 target
- `>+` (folded, preserves trailing newlines)

**Direct application** of RUNBOOK §2.2 character class consistency checklist (Sprint 147 regex P2 pattern immediately defended).

### 3. target vs variable null Policy Branching (PR #222 Critic Lesson)

- `panel.datasource = null` → panel inherits dashboard default datasource → Grafana standard behavior → **skip**
- `target.datasource = null` → target inherits panel datasource → Grafana standard behavior → **skip**
- `variable.datasource = null` → top-level variable is start of inheritance chain → meaningless null → **violation**

Policy difference rationale documented in **both** JSDoc + inline comments. Forces future operators to check both locations when changing null handling policy.

### 4. External Exporter Metric Skip Policy Explicitly Stated

Consistent inheritance of service code SSOT principle introduced in Sprint 145:
- `up` — Prometheus basic target health metric
- `rabbitmq_*` — RabbitMQ exporter (external dependency)
- `kube_*` — kube-state-metrics exporter (external dependency)
- `container_*` — cAdvisor exporter (external dependency)

As of Sprint 148, `algosu:*` recording rules other than these 4 patterns should be defined in service code SSOT.

### 5. Critic 3-Round Pattern Reconfirmed

Sprint 142 (5 rounds) → Sprint 146 (3 rounds) → Sprint 147 (2 rounds) → Sprint 148 PR #222 (3 rounds):
- Pattern reappears where R1 fix triggers new P2 in R2 (target override added → target null false positive)
- When branching policy, simultaneously examining all corner cases (null/undefined/override) is necessary to avoid R2 P2
- **R3 clean threshold reconfirmed**: "no discrete introduced bug + simple 1-line null-skip addition"

## Lessons

### 1. R1 Fix Can Trigger New P2 in R2

PR #222 R1 P2-1 (target-level datasource override not verified) → fix (add target.datasource !== null check) → R2 P2 (target.datasource null = panel inheritance = skip, but treated as violation — false positive). **Mandate simultaneous examination of all corner cases (null/undefined/override) when fixing policy branching**.

### 2. YAML Block Scalar Modifier 6 Types All Require Support in Verification Scripts

If a Prometheus operator uses `|-` or `>-` instead of `|`, `extractRulesWithExpr()` silently skips and treats as outside verification scope. **When adding future rules, consciously choose modifier type, or mandate ADR documentation for script update obligation**.

### 3. `.claude/` gitignored — Agent Cross-ref Modifications Are Local Only

The `.claude/commands/agents/` directory is included in `.gitignore` and not git tracked. PR #220 added RUNBOOK cross-refs to critic.md/architect.md but won't sync to other machines/teammates. **Sprint 149+ seed candidate #16**: Review `.gitignore` policy for converting only `.claude/commands/` to tracked.

### 4. Regex Robustness Checklist = Strengthened Automation Candidate (3+1 Sprints Accumulated)

Sprint 145~147 regex P2 3 cases + Sprint 148 PR #221 R1 P2 (block scalar modifier `|-`/`>` not recognized) = 4 accumulated. RUNBOOK checklist still relies on human attention, allowing recurrence. **Seed #17**: Automate static detection of 4 pattern types via ESLint custom rule or custom regex linter.

## Sprint 149 Carryover Seeds (Total 6)

### UAT User Direct (Sprint 143~148 Accumulated, Outside Oracle's Scope)
- **Seed #5**: Programmers resubmission scoring pass confirmation (user direct UAT, 5 sprints accumulated)
- **Seed #9**: English environment + production Grafana CB dashboard ai-analysis visual consistency confirmation (user direct UAT, Sprint 146 regression blocking net built)

### Automation / Infrastructure (Oracle Work Targets)
- **Seed #14**: ai-analysis problem context follow-up (Sprint 143 PR #200 unresolved — frontend leveraging problem context / submission response schema extension / saga payload flow verification)
- **New seed #15**: `extractInlineBlock()` asymmetric processing — caller only matches `includes(${key}: |)`, `>`/`|-` etc. undetected (Critic R2 additional observation, currently no regression, gradual improvement candidate)
- **New seed #16**: `.claude/` gitignore policy review — convert only `.claude/commands/` to tracked for multi-machine agent cross-ref sync
- **New seed #17**: Regex robustness lint rule automation — static detection of RUNBOOK §4 checklist (Sprint 145~148 P2 4 accumulated → strengthened automation candidate)

## Verification Results

| PR | CI checks | mergeStateStatus | Critic |
|----|-----------|-----------------|--------|
| #220 (seed #13) | SKIPPED (docs-only) | CLEAN | Not invoked |
| #221 (seed #11) | SUCCESS | CLEAN | R1 P2 1 → R2 clean ✅ |
| #222 (seed #12) | SUCCESS | CLEAN | R1 P2 2 → R2 P2 1 → R3 clean ✅ |

- `scripts/check-grafana-metrics.mjs` final lines: ~1295 lines
- Baseline (Sprint 148 end): 204 metrics / 32 strict / 15 wildcard / 124 labels / 41 panel title pairs / 2 vars / **15 rule pairs** / **5 external skipped** / **0 violations**

## Branch Discipline

- **All 3 PRs: new branches + Squash merge**
- **14 consecutive sprints compliant** ✅ (since Sprint 134 violation), 0 direct commits to main
- PR #220: `docs/sprint-148-regex-runbook` → Squash merge
- PR #221: `feat/sprint-148-rule-label-validation` → Squash merge
- PR #222: `feat/sprint-148-dashboard-structure` → Squash merge

## ADR References

- This ADR: `docs/adr/sprints/sprint-148.md`
- Sprint 147 ADR: `docs/adr/sprints/sprint-147.md` (Panel title + Variable — direct extension prototype)
- Sprint 146 ADR: `docs/adr/sprints/sprint-146.md` (regression blocking automation — label dimension prototype)
- Sprint 145 ADR: `docs/adr/sprints/sprint-145.md` (Prometheus/Grafana verification infrastructure basis)
- RUNBOOK: `docs/runbook/regex-robustness.md` (Sprint 148 new)
