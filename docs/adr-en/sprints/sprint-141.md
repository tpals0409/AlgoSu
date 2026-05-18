---
sprint: 141
title: Carryover Seeds Bulk Cleanup — Infrastructure Debt Resolution + Operational Automation Enhancement
status: completed
period: 2026-05-07 ~ 2026-05-08
start_commit: 2e37d1d
end_commit: fc18639
prs:
  - https://github.com/tpals0409/AlgoSu/pull/190 (Group A — docs/infra housekeeping)
  - https://github.com/tpals0409/AlgoSu/pull/191 (Group B-1 — github-worker WeakSet)
  - https://github.com/tpals0409/AlgoSu/pull/192 (Group B-2 — ai-analysis CB schema + monitoring)
  - https://github.com/tpals0409/AlgoSu/pull/193 (Group C — calendar locale)
  - https://github.com/tpals0409/AlgoSu/pull/194 (Group D-1 — PR pre-flight checklist)
  - https://github.com/tpals0409/AlgoSu/pull/195 (Group D-2 — Oracle PATH runbook)
  - https://github.com/tpals0409/AlgoSu/pull/196 (Group D-3 — E2E label trigger)
related_sprints:
  - sprint-134 (E2E auto PR CI integration — 7 sprints accumulated carryover closed)
  - sprint-135 (CB infrastructure — github-worker WeakSet backport + ai-analysis schema unification seed)
  - sprint-139 (Oracle PATH P1 + react-day-picker regression pattern seed)
  - sprint-140 (sealed-secrets/ outdated + ADMIN_EMAILS runbook seed)
---

# Sprint 141 — Carryover Seeds Bulk Cleanup

## Context

Entered Sprint 141 with 9 accumulated carryover seeds from Sprint 134~140. Seed types are extremely diverse (infrastructure/documentation/code consistency/CI policy), so proceeded with **group-by-group PR split strategy** instead of a single PR bundle:

| Group | Seeds | Type |
|-------|-------|------|
| A | #3 #4 #8 | docs/infra housekeeping (low risk) |
| B-1 | #6 | github-worker code consistency (Critic invoked) |
| B-2 | #7 | ai-analysis CB schema unification + monitoring update (Critic invoked) |
| C | #5 | frontend i18n (UI) |
| D-1 | #2 | PR pre-flight policy |
| D-2 | #1 | Oracle infrastructure (external file) |
| D-3 | #9 | E2E CI policy |

## Decisions

### Group-by-Group PR Split + Parallel Processing
- All 7 PRs forked directly from main → processed in parallel (each group has 0 dependencies)
- Critic invocation policy: invoke only for code changes (B-1, B-2, C) + user input flow changes. No invocation for docs/infra cleanup (A, D-1, D-2, D-3) — same policy as Sprint 131~138

### Group A — sealed-secrets/ Option A Adopted
- aether-gitops as SSoT, AlgoSu repo `infra/sealed-secrets/generated/` is a historical artifact (not ArgoCD-watched) → **directory removal** decided
- SSoT location explicitly stated in README
- Option B (keep directory + outdated warning) rejected due to remaining SSoT conflict risk

### Group B-2 — Simultaneous operational stack update on schema change
- When changing ai-analysis CB schema, simultaneously update the following **4 consumers in a single PR**:
  1. `prometheus-rules.yaml` — `CircuitBreakerOpen` alert (`state==1` → `state==2`)
  2. `grafana-cb-dashboard.yaml` — 2 Python panels
  3. `grafana-service-dashboard.yaml` id=13
  4. `grafana-slo-dashboard.yaml` id=11
- Critic round 1 caught 4 consumers with alert (P0) + 2 dashboards (P1) not reflected → fix-up added to same PR
- Applied `{name=~".+"}` matcher to block legacy unlabeled series (transitional safety)

### Group C — useLocale Dynamic Mapping + ko Fallback
- 3-tier priority: `props.locale` (override) → `LOCALE_MAP[currentLocale]` → `ko` fallback
- ko fallback is safe even if LOCALE_MAP is not updated when adding a locale to routing.ts (defensive default)

### Group D-2 — External file changes preserved as runbook
- `~/.claude/oracle/bin/oracle-spawn.sh` is not git-tracked → applied directly on this machine + patch code/procedure preserved as `docs/runbook/oracle-tmux-path.md`
- Same patch can be applied on other machines/reconfiguration

### Group D-3 — E2E full integration opt-in policy
- `e2e-programmers` runs automatically for all PRs (~3 min, already integrated)
- `e2e-test` (full, ~10 min) has cost burden → auto-triggered only when `run-e2e-full` label is attached (explicit trigger for large changes)

## Patterns

### Critic Invocation Policy Strengthened — Bulk check of operational consumers on schema change
When changing schema/metric labels, check all consumers in these 4 categories:
1. **Alert rule** (prometheus-rules.yaml) — threshold comparison logic
2. **Grafana dashboard** — mappings/thresholds/queries
3. **Recording rules** — derived metric definitions
4. **Application code** — direct metric set/labels calls

Critic round 1 caught P0 (alert misfire) + P1 2 issues (stale dashboards) → validates that single code file verification is insufficient for schema changes.

### Transitional Compatibility — `{name=~".+"}` Matcher Pattern
Prevents regression where legacy unlabeled series could be misinterpreted in new mappings when Prometheus labels are added. Adding `{name=~".+"}` or `{name=~"$name"}` matcher to all dashboard/alert queries → matches only labeled series.

### PR Preservation Pattern for External File Changes
When changing files not tracked by git (`~/.claude/`, `/etc/`, sealed cluster cert environment):
1. Apply directly on this machine/environment (Bash/Edit)
2. Preserve procedure/patch code in repo runbook (PR-mergeable)
3. Explicitly state "external file change" in PR body

## Lessons

### Critic 6 Rounds — Quantitative Value of Pre-Blocking Operational Regressions
- 6 rounds invoked (B-1: 2 / B-2: 3 / C: 1) with **1 P0 + 2 P1 + 3 P2** caught and resolved
- B-2 P0 (alert state==1 → state==2) pre-blocked production deployment regression where **critical alert misfires in HALF_OPEN + no alert fires in actual OPEN** — proven quantitative ROI of Critic invocation
- Operational stack consistency issue absolutely impossible to detect by verifying only a single code file (`metrics.py`)

### Dependency Major Regression Pattern Can Only Be Blocked by Policy
- 5 react-day-picker v8→v9 unhandled regressions in Sprint 139/140 (className mapping 8 + root relative missing + English locale + nav position + not clickable)
- Regressions that tsc/lint clean won't catch — className/CSS/i18n regressions
- PR pre-flight checklist formalized in Sprint 141 — elevating user visual verification to an explicit step

### 7 Consecutive Sprints of Branch Discipline Compliance
After Sprint 134 main direct push violation, Sprint 135~141 all followed new branch + PR + Squash merge path (7 sprints total). This sprint set a new record with 7 PRs as single-sprint max — proving split strategy is compatible with discipline compliance.

### Value of Regular Cleanup Sprints — Accumulated Carryover Seed Pattern
- Seed accumulation from Sprint 134 (E2E PR CI), Sprint 135 (CB pattern sync), Sprint 137 (small housekeeping), Sprint 139/140 (Oracle PATH + sealed-secrets)
- Sprint 141 single sprint processed 9 items in bulk — spread merge burden across 7 PRs
- Recommended frequency for next regular cleanup sprint: every 5~7 sprints or when accumulated seeds reach 8

## Follow-up

### User Visual Verification (Sprint 142+)
- Group C: Verify English month/weekday display in English environment (en locale dynamic mapping validation)
- Group B-2 operational verification: Verify ai-analysis Python CB normal display in Grafana CB dashboard + alert consistency after production deployment

### Sprint 142+ Seeds
- **Calendar provider dependency defense** (Sprint 141 Group C P2): Defensive logic for use outside NextIntlClientProvider (Storybook/tests) + real component tests (currently limited to known usage — safe)
- **prometheus-rules / dashboard automatic verification CI** (Sprint 141 Group B-2 lesson): Evaluate feasibility of introducing schema change consumer auto-check lint
- **E2E full integration UX enhancement** (Group D-3 follow-up): Auto comment on label attachment + auto-link to failure logs

## Outputs

### Code Changes
- `services/github-worker/src/circuit-breaker.ts` — errorFilter wrapper + WeakSet marker (+47/-7)
- `services/github-worker/src/circuit-breaker.spec.ts` — 3 regression protection tests (+108/-2)
- `services/ai-analysis/src/metrics.py` — schema + name label (+22/-7)
- `services/ai-analysis/tests/test_metrics.py` — Gauge value direct verification + wiring tests (+58/-9)
- `frontend/src/components/ui/calendar.tsx` — useLocale dynamic mapping (+24/-7)

### Infrastructure/CI Changes
- `infra/k3s/monitoring/prometheus-rules.yaml` — alert state==2 + name matcher
- `infra/k3s/monitoring/grafana-cb-dashboard.yaml` — 2 Python panel schema unification + templating variable regex expansion
- `infra/k3s/monitoring/grafana-service-dashboard.yaml` id=13 — schema unification
- `infra/k3s/monitoring/grafana-slo-dashboard.yaml` id=11 — schema unification
- `infra/sealed-secrets/generated/` — 12 files removed (outdated artifact)
- `.github/workflows/ci.yml` — e2e-test label trigger added
- `.github/pull_request_template.md` — new dependency major checklist section

### Documentation
- `CLAUDE.md` — `ai-feedback` → `ai-analysis` naming correction
- `docs/runbook/admin-emails.md` — new (Sprint 140 operational work proceduralized)
- `docs/runbook/dependency-major-upgrade.md` — new (5-step dependency major guide)
- `docs/runbook/oracle-tmux-path.md` — new (Oracle PATH patch procedure)
- `docs/runbook/e2e-pr-label.md` — new (E2E label trigger guide)
- `infra/sealed-secrets/README-sealed-secrets.md` — SSoT location explicitly stated

### Critic Verification Total
- B-1 (PR #191): 2 rounds (P2 1 issue → regression protection test + comment correction)
- B-2 (PR #192): 3 rounds (P0 1 alert + P1 2 stale dashboards + P2 1 wiring → all resolved)
- C (PR #193): 1 round (P2 1 non-blocking — provider dependency)
- Total 6 rounds / P0 1 + P1 2 + P2 3 = **6 issues caught, all resolved**
