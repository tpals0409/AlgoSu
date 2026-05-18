---
sprint: 146
title: UAT-Dependent Seeds → Regression Blocking Automation Conversion
status: completed
period: 2026-05-10 (single day)
start_commit: f0affd4
end_commit: 7fca904
prs:
  - https://github.com/tpals0409/AlgoSu/pull/209 (PR 1 — Grafana labelnames consistency verification extension + Critic 3 rounds)
  - https://github.com/tpals0409/AlgoSu/pull/210 (PR 2 — Calendar English locale mapping unit tests)
related_sprints:
  - sprint-145 (Prometheus Rules + Grafana Dashboard automatic verification — direct extension of this sprint's seed B)
  - sprint-144 (regression blocking automation — "Critic-frequently-caught defect patterns → CI automation candidates" pattern prototype)
  - sprint-141 (Calendar useLocale dynamic mapping introduction — protection target of this sprint's PR #210)
  - sprint-142 (Critic multiple round pattern prototype)
---

# Sprint 146 — UAT-Dependent Seeds → Regression Blocking Automation Conversion

## Context

The 2 accumulated UAT seeds from Sprint 143~145 are essentially **user environment-dependent verification** (seed #5: Programmers OJ scoring / seed #9: production Grafana visual confirmation + English i18n environment), always relying on human attention. User request "complete all work inside Claude" → direct application of **Sprint 144 new pattern** ("Critic-frequently-caught defect patterns → CI automation candidates"). UAT itself is impossible due to external system dependency, but conversion to a structure that **blocks regression seeds that could fail UAT via static/unit verification** is possible.

This sprint considers ROI + implementation difficulty + Sprint 145 single-day merge pattern for 5 automation candidates and processes **3 PRs split → 1 PR skipped + 2 PRs merged**.

### Processing Scope

| PR | Seed | Location | Result |
|----|------|----------|--------|
| #1 | #5 | ai-analysis regression blocking test strengthening | ⏭️ **Skipped** (Plan assumption broken — already covered in Sprint 142~144) |
| #209 | #9 | Grafana dashboard labelNames ↔ service code labelnames consistency verification | ✅ Critic 3 rounds passed |
| #210 | #9 | Calendar English locale mapping unit tests | ✅ 4 tests PASS |

### Sprint 147 Carryover

- Seed #5: UAT — Programmers resubmission scoring pass confirmation (user direct). Not yet verified since Sprint 142 prompt strengthening
- Seed #9: UAT — English environment + production Grafana CB dashboard ai-analysis visual confirmation (user direct). Regression seeds auto-blocked this sprint, only visual verification remains

## Decisions

### Plan Assumption Broken — Immediate Report (PR #1 Skip)

3 "missing test" items from PR #1 exploration phase all **already exist**:

| Plan-assumed missing | Actual location | Introduced sprint |
|---|---|---|
| `TestIsExplicitFalse` | test_claude_client.py:1220-1259 | Sprint 142 (9 cases added) |
| `TestComputeTotalScoreLanguageBranch` | test_prompt.py:324-365 | Sprint 144 (Python/SQL/missing) |
| `TestPlatformContextInjection` | test_prompt.py:413-492 (TestPlatformContextImperative) | Sprint 142 (all branches) |

Exploration report based on outdated information. Proceeding with PR #1 as-is would only add duplicate tests (0 regression blocking value). Immediately applies Sprint 145 new pattern ("Plan assumption broken → immediate redefinition + user decision") → user decides to skip PR #1, Sprint 146 scope reduced to PR #209 + #210 2 items.

### Seed #9 — Maintain Single SSOT Verification Entry Point (Sprint 145 Seed B Extension)

**Options**:
- A. Add new script `scripts/check-grafana-labels.mjs`
- B. Extend `scripts/check-grafana-metrics.mjs` (add label dimension to Sprint 145 seed B)

**B adopted**: Maintain single entry point for dashboard ↔ service code consistency verification. Verification intensity increases without changing the `quality-monitoring` CI job. Adding new verification dimensions would proliferate script count, degrading discoverability/maintainability.

### Critic Invocation Policy

- **PR #209**: R1 invocation mandatory. Directly tied to regression blocking core (false negative/positive blocking). If R1 catches P0/P1, proceed to R2.
- **PR #210**: Not invoked. Only test additions, 0 production behavior changes. Same as PR #1 pattern (tests only).

Actual results:
- PR #209 R1: P0/P1 0, **P2 1** (quoted brace)
- PR #209 R2: P0/P1 0, **P2 2** (le global exemption, Histogram suffix labels)
- PR #209 R3: Clean pass ✅

P2s directly tied to regression blocking core had rounds added and all resolved (Sprint 145 pattern directly applied).

## Core Changes

### PR #209 — Grafana Dashboard Labelnames Consistency Verification Extension

**Target**: `scripts/check-grafana-metrics.mjs` (Sprint 145 seed B 365 lines → 553 lines, +216 -28)

**Key additions**:

1. **`metricLabels: Map<metricName, Set<labelName>>`** — registers label set for metrics defined in source code. prom-client default + recording rules skip verification.

2. **Auto label separation (Critic R2 P2-1 fix)**:
   - `ALWAYS_AUTO_LABELS`: exempted from all metrics (job/instance/pod/namespace/node/container/service/kind/version/__name__)
   - `HISTOGRAM_BUCKET_LABEL = 'le'`: exempted only for `_bucket` suffix metrics (Histogram bucket auto-dimension)
   - `SUMMARY_QUANTILE_LABEL = 'quantile'`: this project has no Summary usage → always strict
   - `isLabelExempt(metric, label)` helper for metric-conditional application

3. **`extractLabelsFromBlock()`** — extracts `labelNames` (TS) / `labelnames` (Python) regex from slice from metric `name:` match position to before next metric definition start. Also registers same labels for Histogram's `_bucket`/`_count`/`_sum` suffix metrics (always registered regardless of labels size — P2-2 fix).

4. **`collectLiteralMetricsAndLabels()`** — collects label usage from literal `algosu_xxx{label=...}` patterns in dashboard exprs.

5. **`collectNameSelectorMetrics()` extension** — when processing `{__name__=~"...", label=...}` selectors, add labelUsage for all expanded metrics (including wildcard expansion).

6. **`normalizeExprForSelectorParse()`** — blocks 2 false negatives:
   - Grafana variable `${service}` inner `}` → `__GRAFANA_VAR__` placeholder substitution
   - PromQL regex quantifier `5[0-9]{2}` inner brace in quoted value → `_` substitution (Critic R1 P2 fix)

**Verification (all 6 regression scenarios correctly detected + baseline passed)**:
- baseline: defined metrics 204 / dashboard label usages 124 / wildcard groups 15 / all defined
- Scenario 1 (Python labelnames typo): ai-analysis CB metric change → 3 detected
- Scenario 2 (TS labelNames typo): gateway http_requests_total change → 2 detected (service-debug + slo)
- Scenario 3 (dashboard side typo): submission CB selector change → 1 detected
- Scenario 4 (R1 P2: quoted brace + label typo): 1 detected
- Scenario 5 (R2 P2-1: le selector on normal metric): 1 detected
- Scenario 6 (R2 P2-2: wrong label on Histogram _count metric): 1 detected
- Scenario 7 (bucket metric + le exemption): correctly passes

### PR #210 — Calendar English Locale Mapping Unit Tests

**Target**: `frontend/src/components/ui/__tests__/Calendar.test.tsx` new (+82, 0 production code changes)

**4 Tests (all PASS)**:
1. `props.locale={enUS}` explicit → `<th aria-label="Sunday">` English full name
2. `<NextIntlClientProvider locale="en">` mock → useLocale() normal → `LOCALE_MAP["en"]=enUS` applied
3. provider absent (useLocale throw) → ko fallback → `<th aria-label="일요일">` (protects Sprint 141 PR #193 try-catch intent)
4. `props.locale` priority — `props={ko}` takes priority even when provider is `"en"`

**Verification dimension**: react-day-picker v9 renders weekdays as `<th aria-label="Sunday">Su</th>`, making **aria-label full name** the most robust locale verification dimension (clear English vs Korean distinction).

## Verification

- **PR #209**: CI 38 checks SUCCESS (Quality + Test all services + Coverage Gate + E2E + quality-monitoring)
- **PR #210**: CI 38 checks SUCCESS (Test Frontend + Quality frontend + Coverage Gate + E2E)
- **Regressionless ✅**: jest UI suite 205 PASS (0 regressions), tsc clean (0 errors)
- **Critic 3 rounds** (PR #209 only): R1 P2 1 + R2 P2 2 all resolved, R3 clean pass

## Branch Discipline

✅ **12 consecutive sprints compliant** (since Sprint 134 violation): both PRs use new branches + Squash merge, 0 direct commits to main.
- `feat/sprint-146-grafana-labelnames-check` → PR #209 (squash merge `1699851`)
- `test/sprint-146-calendar-en-locale` → PR #210 (squash merge `7fca904`)

## New Patterns

### 1. UAT → Automated Verification Structure Conversion

When UAT items are accumulated in carryover, identify "regression seeds that could cause UAT to fail" and block them with static/unit verification. Keep UAT itself as user responsibility while thickening the blocking net.
- User environment dependency (OJ scoring / production Grafana / English i18n) is the cause of UAT persistence
- Convert "UAT failure reveals regressions" to "block regression seeds that could arise at PR/CI stage"
- Reduced user-side UAT burden + lower regression occurrence rate, both achieved

### 2. Regression Blocking Core Dimension Extension Pattern

Extend existing automated verification script's verification dimensions rather than creating new scripts. Maintain single SSOT verification entry point while increasing verification intensity.
- Sprint 145 seed B (metric names) → Sprint 146 (label dimension) → future seeds (label values / Prometheus type compatibility)
- 0 CI job additions, preserved discoverability/maintainability
- Scattered verification entry points make it harder to detect missing new verifications → keep strict with single entry point

### 3. Grafana Variable/PromQL Quantifier Placeholder Substitution Pattern

Avoid false negatives where inner curly braces break matching boundary in dashboard selector regex matching.
- `${service}` Grafana variable inner `}` → placeholder
- `5[0-9]{2}` PromQL regex quantifier inner `{}` → underscore (inside quoted value)
- Label names are extracted from outside quotes, so quoted value inner transformation doesn't affect verification accuracy
- Input normalization is simpler/safer than making regex wrapper `[^{}]*` robust

### 4. Plan Assumption Immediate Report + User Decision Pattern (Sprint 145 Direct Application)

When plan assumption breaks during exploration, reporting takes priority over proceeding. User decides among (a) skip (b) scope reduction (c) redefine to different area.
- Sprint 145: assumption verification before plan adoption (before code writing)
- Sprint 146: assumption break found immediately after code start (at exploration completion)
- User decision takes priority over proceeding at both timings

## Lessons

### 1. Exploration Report's Outdated Risk

Cases occurred where "missing" items reported by exploration agents actually already existed. Exploration reports have temporal limitations and must be cross-checked with actual code grep before reflecting in plan. Sprint 146 PR #1 was possible to skip immediately because plan assumption break was found right after work start.

### 2. Critic R1 Alone May Be Insufficient — 3-Round Value Proven

PR #209 in this sprint had only P2 1 reported in R1, but R2 caught 2 additional P2s (le global exemption false negative + Histogram suffix label verification missing). If only R1 had been called, these two regression patterns would have been newly created by this script introduction itself. P2s directly tied to regression blocking core justify additional rounds.

### 3. Regression Blocking Automation is Essentially Accumulation of Verification Dimensions

Sprint 144 (weight SSOT + mock factory) → Sprint 145 (metric name consistency) → Sprint 146 (label consistency) — the same monitoring/verification domain repeatedly strengthens by adding dimensions. Not blocking all dimensions at once, but incrementally adding a new dimension each time regression occurs is the optimal ROI pattern.

### 4. UI Test Selector Robustness — aria-label Priority

react-day-picker v9 renders weekdays as `<th aria-label="Sunday">Su</th>`. textContent abbreviation ("Su") verification has abbreviation length change regression risk (e.g., locale variants). aria-label full name ("Sunday"/"일요일") is directly tied to locale specification and is most robust. When writing UI regression blocking tests, prefer accessibility label over visual display.

## Sprint 147 Carryover

| Seed | Source | Processing Method |
|------|--------|------------------|
| #5 | Sprint 143~146 accumulated | UAT — user direct (Programmers resubmission → scoring pass confirmation) |
| #9 visual verification | Sprint 143~146 accumulated | UAT — user direct (English environment + production Grafana CB dashboard ai-analysis visual consistency) — regression seeds auto-blocked this sprint |

Both seeds require no additional Claude-side work. UAT can be performed at user's convenience (auto-blocking reduces regression occurrence rate).
