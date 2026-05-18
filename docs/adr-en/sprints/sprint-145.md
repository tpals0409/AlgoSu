---
sprint: 145
title: Prometheus Rules + Grafana Dashboard Automatic Verification CI
status: completed
period: 2026-05-09 (single day)
start_commit: c27232c
end_commit: f0affd4
prs:
  - https://github.com/tpals0409/AlgoSu/pull/207 (PR 1 — promtool check rules CI)
  - https://github.com/tpals0409/AlgoSu/pull/208 (PR 2 — grafana dashboard ↔ service code cross-check + Critic R2 P2 fix)
related_sprints:
  - sprint-144 (regression blocking automation — seed #7 identified in this sprint)
  - sprint-143 (carryover seeds bulk cleanup — seed #7 prototype)
  - sprint-142 (prompt optimization — Critic multiple round pattern prototype)
---

# Sprint 145 — Prometheus Rules + Grafana Dashboard Automatic Verification CI

## Context

Resolving monitoring stack consistency debt identified in Sprint 143 retrospective. `prometheus-rules.yaml` and 3 Grafana dashboards' consistency relied on human attention — risk of regression from omitting simultaneous updates on schema changes. Sprint 144 validated the same pattern (SSOT/CI automation) for mock factory + weight SSOT regression blocking → now structurally blocking monitoring stack consistency.

This sprint processes only **seed #7** (monitoring CI automation) from the **3 remaining seeds from Sprint 143~144**. Seeds #5/#9 are user direct UATs with 0 code work, verified separately at user's convenience.

### Processing Scope

| Seed | Location | Priority | Status |
|------|----------|---------|--------|
| A | promtool check rules CI (syntax verification) | P2 | ✅ PR #207 |
| B | grafana dashboard ↔ service code cross-check | P2 | ✅ PR #208 (fixed through Critic R2) |

### Sprint 146 Carryover (Sprint 143~144 remaining 2 items)

- Seed #5: UAT — Programmers resubmission scoring pass confirmation (user direct)
- Seed #9: UAT — English environment calendar + production Grafana CB dashboard ai-analysis consistency (user direct)

## Decisions

### Plan Assumption Broken + User Decision

**Initial plan assumption**: prometheus-rules.yaml is the metric SSOT — cross-check whether algosu metrics referenced by dashboard exprs are defined in rules.

**Actual data verification result**: 6 metrics used in rules vs 32 used in dashboards → **26 false positives**. Rules only hold alert/recording definitions and cannot serve as metric SSOT (exporter metrics are directly exposed by service code).

**User decision (2 steps)**:
1. Among options B/C/D → chose **C (service code SSOT)**
2. C-light (prefix verification) vs C-strict (complete metric set) → chose **C-strict**

### Seed A — promtool Installation Location (CI install vs Docker image)

**GitHub Actions step download (adopted)**: Download `prometheus/prometheus` v2.55.0 binary in `quality-monitoring` job via `curl | tar xz` then move to `/usr/local/bin/`.
- Advantage: 0 external Docker image dependencies, can pin version, runs directly on ubuntu-latest.
- Disadvantage: Download cost on every CI run (~30 seconds). Negligible cumulative cost since only triggered on monitoring changes.

### Seed B — Metric SSOT Definition Extraction Heuristic

**Static analysis (adopted)**: Static analysis of service code via regex to build defined metric set.
- NestJS 4 services: Validate `process.env['SERVICE_NAME'] ?? 'xxx'` defaults + extract `${prefix}_yyy` backtick interpolation + prepend prom-client v15.x default 28 prefixes when `collectDefaultMetrics` is called
- github-worker: `PREFIX = 'algosu_github_worker'` constant + additional circuit-breaker metrics
- Additional TS files (submission/circuit-breaker, problem/dual-write): `name: 'algosu_xxx'` literal extraction
- ai-analysis: Python `name="algosu_ai_analysis_xxx"` literal extraction (Python default metrics registered without prefix → outside dashboard verification scope)
- Histogram: `_bucket` / `_count` / `_sum` suffix auto-registration
- Recording rules (auxiliary SSOT): `record:` fields in `prometheus-rules.yaml` → `algosu:*` metrics added

**Runtime probe (not adopted)**: Launch services and hit `/metrics` endpoint to extract exposed metrics — e2e territory, CI time explosion.

### Seed B — `__name__` Selector Processing (R1 P2 #1 fix)

When dashboard exprs reference metrics via `{__name__=<op>"<pattern>"}` selectors:

| Operator | Pattern | Processing |
|----------|---------|------------|
| `=` / `!=` | exact metric name | strict (exactly 1 definition required) |
| `=~` / `!~` | union `algosu_(a\|b\|c)_xxx` | strict (all 3 must be defined) |
| `=~` / `!~` | wildcard `algosu_.+_xxx` | **least-one match** — OK if 1+ defined after expanding KNOWN_SERVICE_PREFIXES 6 |
| `=~` / `!~` | other regex | conservatively ignored (to avoid false positives) |

Treating wildcards as strict would cause failures for normal cases where some services don't expose the metric (github-worker doesn't handle standard HTTP, ai-analysis has no nodejs metrics since it's Python). Must preserve dashboard intent ("show only services that have it").

## Change Summary

### PR #207 — Sprint 145 Seed A (squash merge `6bfb10a`)

- New: `scripts/check-prometheus-rules.mjs` (+102)
- Changed: `.github/workflows/ci.yml` (+26) — `detect-changes` outputs `monitoring` + paths filter `infra/k3s/monitoring/**` + `quality-monitoring` job (promtool install + script run)
- Total: **2 files / +128**
- Critic not invoked — same policy as Sprint 144 seed A (CI infrastructure addition + standard tool dependency).

### PR #208 — Sprint 145 Seed B (squash merge `f0affd4`)

- New: `scripts/check-grafana-metrics.mjs` (+365 cumulative, R1+R2 commits)
- Changed: `.github/workflows/ci.yml` (+9) — add service metric definition files to paths filter + 1 step to `quality-monitoring` job
- Total: **2 files / +374**
- Critic invoked (Codex gpt-5):
  - **R1** (session `019e0d1c-b153-7732-95eb-8b38d385e60c`): P0/P1 0, **P2 2 caught**
    - P2 #1 — `__name__=~` selector entirely masked → 17 false negatives
    - P2 #2 — `algosu:` recording rule not in service code SSOT → false positive risk when used in future dashboards
  - **R2**: P0/P1 0, **P2 1 caught**
    - P2 — source-code extractor regex `[a-z_]+` → digit not allowed. Future `algosu_gateway_http_2xx_total` style metrics risk false positive
  - **R3 not invoked** — simple character class widening (4-character change) with no new defect possibility

## Verification

- **All CI GREEN**: PR #207 + #208 both pass Quality + Test all services + Coverage Gate + E2E Programmers Full Flow (28 checks).
- **3 local regression scenarios** (seed B):
  - Strict literal typo (`algosu_submission_circuit_breaker_TYPO`) → exactly 1 metric output + exit 1 ✅
  - Wildcard `.+` pattern all services undefined → all 4 panels detected + all expanded metrics output ✅
  - Union one-miss (renamed service) → exactly detected + exit 1 ✅
- **Final state**: 204 defined metrics / 32 strict dashboard / 15 wildcard groups all pass.

## Branch Discipline

- New branch + PR + Squash merge — **11 consecutive sprints compliant** (since Sprint 134 violation)
- 0 direct commits to main in both PRs

## New Patterns

### Wildcard Expansion Least-One Match
Dashboard `__name__=~"algosu_.+_xxx"` pattern is OK if 1+ service is defined after expanding known service prefixes. Union `(a|b|c)` patterns are strict (all must be defined). Preserves dashboard intent ("show only services that have it") while detecting prefix typos.

### Multi-Source SSOT Combination
Service code (primary SSOT, exporter metrics) + prometheus-rules.yaml (auxiliary SSOT, recording rules) used together. Abandons single SSOT illusion — reflects reality that different metric types have different definition location SSOTs. Recording rules are accurately extracted from prometheus-rules.yaml as that's their definition SSOT.

### Plan Assumption Verification Step
Sanity check of SSOT assumptions with actual data is mandatory just before plan adoption. In this sprint, the "rules are metric SSOT" assumption was verified to produce 26 false positives → plan redefinition + user decision. When assumption breaks are discovered, redefinition takes priority over proceeding.

### Critic Multiple Rounds P2 Resolution (R3 Threshold)
Sprint 142 (5 rounds) pattern shortened. R1 P2 2 → R2 P2 1 → R3 not invoked. R3 non-invocation threshold: when change risk is definitionally near zero, such as "simple character class change + no new defect possibility."

## Lessons

### Plan Assumption Immediate Verification Obligation
SSOT assumptions in plan writing must be sanity-checked with actual data. In this sprint, the plan's "rules SSOT" assumption was not verified during plan writing and was discovered mid-work → user re-decision flow. **When assumptions break, plan redefinition + getting user decision takes priority over proceeding**.

### Single Critic Round May Be Insufficient — 3-Round Value Proven
The plan specified "1 Critic round" but R1 caught 2 P2 issues (17 false negatives + future false positive risk) → R2 after fix caught 1 new P2. **If only a single round had been called, 17 false negative regressions would have been created**. P2s directly tied to regression blocking core justify additional rounds.

### Regex Character Class Consistency
Same domain (prometheus metric names) requires consistent character class usage between source/dashboard side regex. Sprint 145 R2 P2 case: dashboard side used `[a-zA-Z0-9_:]+` but source side used `[a-z_]+` — caught by Critic R2 and unified. **character class inconsistency is a future false positive regression seed**.

### Default Metric List Stale Risk
Script hardcodes prom-client v15.x default 28 metrics. Major library version upgrades may remove existing metrics or add new ones — risk of this script becoming stale. **CHANGELOG review + Sprint-unit sync check needed** (Sprint 146+ seed candidate).

## Sprint 146 Carryover

Sprint 143~145 remaining 2 items carried over as-is:

- **Seed #5** (UAT — Sprint 143 carryover): User directly resubmits optimizedCode to actual Programmers → scoring pass confirmation
- **Seed #9** (UAT — Sprint 143 carryover): English environment calendar + production Grafana CB dashboard ai-analysis consistency

New seeds from this sprint:

- **Seed #10** (Sprint 145 new): prom-client/prometheus_client default metric list stale check — sync automation or Sprint-unit manual check on library version upgrade
