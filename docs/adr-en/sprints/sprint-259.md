---
sprint: 259
title: "AI Reanalysis Request Path + Analysis Limit/Circuit Raise + Analysis-Done/Saga State Reconciliation"
date: "2026-07-25"
status: completed
agents: [Oracle]
related_adrs: ["sprint-258", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["submission", "ai-analysis", "saga", "frontend"]
tldr: "Bundles 4 AI-analysis reliability/recoverability items. (1) A submission that went straight to DONE with aiSkipped=true on limit exhaustion had no way to be re-analyzed after the limit reset → new submission POST /:id/reanalyze (verify owner + aiSkipped, atomically roll saga back to GITHUB_QUEUED + rerun advanceToAiQueued; if still exhausted, skipped again) + FE 'skipped' state block/reanalyze button. (2) Circuit breaker failure threshold 5→10 (config.py SSOT) to mitigate early tripping (silent outage). (3) AI daily analysis limit 5→10 (config.py SSOT, quota badge data-driven). (4) aiAnalysisStatus was terminal (completed/failed) while sagaStep lingered at AI_QUEUED, so the study room showed 'analyzing' while the detail showed 'complete' — a mismatch → updateAiResult atomically persists sagaStep=DONE in a single row-write + saga-timeout reconcileTerminalAnalysis (2-min periodic recovery of lingering rows). PR #494 `b6b67942` / #490 `9e1c8f9f` / #491 `b60694de` / #492 `7c2ff43c`·#493 `a476f27b`."
---
# Sprint 259 — AI Reanalysis Request + Analysis Limit/Circuit Raise + Saga State Reconciliation

_Date: 2026-07-25_

## Goal

Bundle 4 reliability/recoverability defects of AI code analysis into one sprint. The core problems are (a) no path to re-analyze a submission whose analysis was skipped on limit exhaustion, (b) overly conservative circuit-breaker/daily-limit thresholds, and (c) a mismatch between analysis completion and saga state that leaves the study room stuck at "analyzing" forever.

**Targets**
- PR #494 `b6b67942` — AI limit-exhausted skipped submission reanalysis request path
- PR #490 `9e1c8f9f` — circuit breaker failure threshold 5→10
- PR #491 `b60694de` — AI daily analysis limit 5→10
- PR #492 `7c2ff43c` · #493 `a476f27b` — analysis-done/saga state mismatch recovery

## Decisions

### D1. New reanalysis request path — atomic saga rollback (#494)

Submitting while over the limit makes the saga go straight to `DONE(aiSkipped=true, aiAnalysisStatus='skipped')`, but there was no way to request analysis again after the limit reset. Add **`POST /:id/reanalyze`**: after verifying owner + `aiSkipped`, **atomically roll the saga back to `GITHUB_QUEUED`** and rerun the existing `advanceToAiQueued` (limit recheck + queue). If still over the limit, it is skipped again and distinguished by `aiSkipped` in the response. Gateway/ai-analysis are unchanged (catch-all proxy + existing worker reuse); FE adds a 'skipped' state block and [Request reanalysis] button to the analysis page (on success, transition to pending + resume polling).

### D2. Raise circuit/limit thresholds to mitigate early tripping/early exhaustion (#490, #491)

Strengthen tolerance to transient Claude API failures. Raise the **circuit breaker failure threshold 5→10** (`cb_failure_threshold`) and the **AI daily analysis limit 5→10** (`ai_daily_limit`). Both use the pydantic default in `config.py` as SSOT and allow env-var override. The two values are raised together consistently (circuit 10 ↔ limit 10) to mitigate early tripping (silent outage) and early exhaustion simultaneously. The quota value is served by `/api/analysis/quota` and reflected as-is by the FE badge, so no frontend change is needed.

### D3. Atomic recovery of analysis-done/saga mismatch + periodic reconcile (#492, #493)

`aiAnalysisStatus` was terminal (completed/failed) while `sagaStep` lingered at `AI_QUEUED`, so the study room (judged by sagaStep) showed "analyzing" forever while the analysis detail (judged by aiAnalysisStatus) showed "complete." The cause was `advanceToDone` silently returning on optimistic-lock `affected=0`, leaving `updateAiResult` to commit only completed. Recovery:
- `updateAiResult`: on complete/fail, **carry `sagaStep=DONE` on the entity and persist it atomically in a single row-write**
- saga-timeout: add **`reconcileTerminalAnalysis`** — recover terminal-but-AI_QUEUED lingering rows to DONE on a 2-min cycle (self-healing)
- `advanceToDone`: invalidate the stats cache on the non-QR success path (analysis-count consistency)

## Implementation

- **#494**: `submission.controller.ts` `POST /:id/reanalyze` + `submission.controller.spec.ts`; FE `analysis/page.tsx` skipped block/reanalyze button + `page.test.tsx`; `lib/api/submission.ts`·`types.ts`; i18n `analysis.skipped`/`analysis.reanalyze` (ko/en)
- **#490/#491**: `services/ai-analysis/src/config.py` `cb_failure_threshold` 5→10 · `ai_daily_limit` 5→10 + `tests/test_config.py` default-value assertion sync
- **#492/#493**: `saga-orchestrator.service.ts`·`submission.service.ts` `updateAiResult` atomic persist + `saga-timeout.service.ts` `reconcileTerminalAnalysis` + specs

**Verification (Oracle re-verified directly — distrust self-reports)**: submission jest (controller reanalyze, saga-timeout reconcile, service atomic persist) green, ai-analysis pytest (config defaults) green. All related PRs merged to origin/main (squash). (#492·#493 are the same content re-merged — a double application of the state-mismatch recovery.)

## Incidents

1. **Analysis-done/saga mismatch (study room stuck at analyzing)**: a code path silently ignoring optimistic-lock failure split the terminal status from the saga step, so users saw "analyzing" and "complete" differently across screens. Recovered via single-row-write atomic persist + 2-min periodic reconcile for self-healing.

## Carryover

- (none — followed by a further AI daily limit raise (#506 10→20) in a later sprint)

## Lessons

- **Even a skip needs a recovery path**: limit-exhausted skip is a transient state, not terminal — provide a re-entry path that atomically rolls the saga back to a safe step, enabling user self-recovery.
- **Silently ignoring optimistic-lock failure creates state divergence**: swallowing `affected=0` splits the terminal status from the saga step. Atomize terminal transitions in a single row-write and self-heal lingering rows with a periodic reconcile.
- **Consistent thresholds are adjusted together**: raise the circuit threshold and daily limit to the same value to mitigate early tripping and early exhaustion at once.
