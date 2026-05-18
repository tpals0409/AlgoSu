---
sprint: 135
title: "Circuit Breaker Standalone Sprint — opossum Introduction + 5 Host Single CB + Grafana Dashboard"
date: "2026-04-27"
status: completed
agents: [Oracle, Architect, Postman, Scribe, Critic]
related_adrs: ["ADR-026"]
---

# Sprint 135: Circuit Breaker Standalone Sprint

## Sprint Goal

Introduce the Circuit Breaker pattern to NestJS HTTP call sites to block external service failure propagation. Proceed in order: Wave A (PoC) → Wave B (github-worker expansion) → Wave A sync (separate PR) → Wave C (submission addition) → Wave D (Grafana dashboard).

## Final Result Summary (Wave E Comprehensive)

| Item | Result |
|------|--------|
| **Merged PRs** | 5 (#167 / #168 / #169 / #170 / #171) |
| **CB instances** | 5 (host single isolation) |
| **Protected external services** | 4 (AI Analysis / submission internal / Gateway / Problem Service) |
| **New NestJS modules** | 2 (`CircuitBreakerModule@Global`, `ProblemServiceClientModule`) |
| **New library** | opossum v8 (Node.js TypeScript), existing Python `circuit_breaker.py` retained |
| **Cumulative tests** | submission 343 + github-worker 175 = **518 tests** |
| **Critic cross-review** | 17 rounds (3/4/3/5/3 per PR) — P1 8 + P2 9 all resolved before merge |
| **Grafana dashboard** | 1 set (12 panels, uid `algosu-cb`) |

### Host Single CB Instances

| Service | CB Name | External Call | Fallback Policy |
|---------|---------|---------------|-----------------|
| submission | `aiQuotaCheck` | AI Analysis `/quota/check` | `() => true` (fail-open, `errorFilter: () => false` override — default whitelist neutralized since it's a fixed endpoint) |
| submission | `problem-service-internal` | Problem Service (2 ops via dispatcher) | Per-op (`undefined` / `{isLate: false, weekNumber: null}`) |
| github-worker | `submission-internal` | submission internal API (5 ops via dispatcher) | throw propagation (DLQ handling) |
| github-worker | `gateway-getUserGitHubInfo` | Gateway `/internal/users/.../github-encrypted-token` | throw propagation |
| github-worker | `problem-getProblemInfo` | Problem Service `/internal/{id}` | default value + try/catch safety net |

### PR Merge Commits

| PR | Wave | Squash commit | Key changes |
|----|------|---------------|-------------|
| [#167](https://github.com/tpals0409/AlgoSu/pull/167) | A | `459cd8a` | submission `aiQuotaCheck` PoC + opossum introduction + Prometheus metrics 3 types |
| [#168](https://github.com/tpals0409/AlgoSu/pull/168) | B | `c561488` | github-worker plain class wrapper + host single CB 3 + errorFilter whitelist |
| [#169](https://github.com/tpals0409/AlgoSu/pull/169) | A sync | `1f40247` | Wave B policy sync + errorFilter wrapper + WeakSet marker (P2 exact resolution) |
| [#170](https://github.com/tpals0409/AlgoSu/pull/170) | C | `7d4c539` | `ProblemServiceClient` + `CircuitBreakerModule@Global` + `isConfigReady` |
| [#171](https://github.com/tpals0409/AlgoSu/pull/171) | D | `2c5d8e3` | Grafana CB dashboard (12 panels, TypeScript + Python schema separated) |

## Decisions

### D1: opossum Library Adoption (Wave A)
- **Context**: Python reference implementation (`services/ai-analysis/src/circuit_breaker.py`) is a custom implementation (threading.Lock-based 3-state machine). TypeScript porting required a choice between self-implementation vs library introduction.
- **Options**: (A) opossum — Node.js leading CB library, Netflix Hystrix pattern, event-based metrics integration / (B) Self-implementation — 1:1 port of Python reference.
- **Choice**: (A) opossum v8. Reason: Event-based state transition simplifies Prometheus metrics integration, proven sliding window statistics, NestJS DI compatible, minimizes maintenance burden.
- **Code Paths**: `services/submission/package.json` (opossum@8, @types/opossum@8)

### D2: CB Thresholds — Python Reference Consistency (Wave A)
- **Context**: Mapping Python CB's `failure_threshold=5`, `recovery_timeout=30`, `half_open_requests=2` to opossum options.
- **Choice**: `volumeThreshold: 5` (judge after minimum 5 requests), `errorThresholdPercentage: 50` (failure rate 50%+), `resetTimeout: 30000` (30 seconds to HALF_OPEN), `rollingCountTimeout: 60000` (60 second aggregate window), `timeout: 10000` (fetch 10 second timeout)
- **Rationale**: Maintains same flow as Python — "5 failures → OPEN → 30 second wait → HALF_OPEN". Planned adjustment after accumulating production operation data.

### D3: Prometheus Metrics Design (Wave A)
- **Choice**: 3 metrics, sharing existing MetricsService Registry
  - `algosu_submission_circuit_breaker_state` (Gauge, label: name) — 0=CLOSED / 1=HALF_OPEN / 2=OPEN
  - `algosu_submission_circuit_breaker_failures_total` (Counter, label: name)
  - `algosu_submission_circuit_breaker_requests_total` (Counter, labels: name, result) — result: success/failure/reject/timeout
- **Architecture**: MetricsModule shares prom-client Registry via `METRICS_REGISTRY` custom provider. CircuitBreakerModule → MetricsModule import → registers CB metrics on same Registry → collected by Prometheus at /metrics endpoint.
- **Code Paths**: `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts`, `services/submission/src/common/metrics/metrics.module.ts`

### D4: AI Quota Check Fallback Strategy — fail-open (Wave A)
- **Context**: `saga-orchestrator.service.ts:checkAiQuota` existing behavior: return `true` on API failure (allow AI analysis). Should also allow when CB OPEN to avoid Saga compensation transaction conflicts.
- **Choice**: `fallback: () => true` (fail-open). When CB OPEN, skip AI Analysis Service call entirely and return allow immediately → Saga flow uninterrupted.
- **Rationale**: checkAiQuota is a non-critical guard (quota check). Service stays uninterrupted even if AI analysis proceeds without quota check on failure. Context differs from Python reference's "DELAYED + analysis delayed" fallback, but fail-open is appropriate for this quota pre-check call.
- **Code Paths**: `services/submission/src/saga/saga-orchestrator.service.ts:110-133` (createBreaker), `services/submission/src/saga/saga-orchestrator.service.ts:324-332` (checkAiQuota)

### D5: retry vs Circuit Breaker Priority (Design Principle)
- **Context**: Order determination required when retry and CB coexist.
- **Choice**: Retry 3 times → CB judgment (retry failures reflected in CB failure count). Current Wave A target checkAiQuota has no retry, so only CB applied (same as existing code). For Wave B+ expansion, calls with retry use "retry → CB" order.
- **Rationale**: Retry recovers from transient network errors, CB detects persistent failures. If retry wraps CB externally, unnecessary delay before recording CB failure. Placing retry inside CB enables faster blocking.

## Wave A Output

| Item | Result |
|------|--------|
| PR | feat/sprint-135-cb-poc (13 files, +661/-58) |
| Commits | 3 atomic (module creation → call site application → tests) |
| Tests | 21 suites / 283 tests (existing 268 + new 15) |
| typecheck | 0 errors |
| lint | 0 errors (9 pre-existing warnings) |

## Wave A Memory Correction

- sprint-window.md "github-worker 5 locations" → "7 locations (status-reporter 5 + worker.ts 2)": Confirmed actual `grep -n fetch services/github-worker/src/status-reporter.ts services/github-worker/src/worker.ts` results show 7 call sites.

### D6: github-worker CB Expansion — plain class Wrapper (Wave B)
- **Context**: github-worker is standalone TS, not NestJS. CB introduction required in an environment without NestJS DI pattern.
- **Choice**: Wrapped opossum in `CircuitBreakerManager` plain class. Single instance created in main.ts → injected into GitHubWorker/StatusReporter constructors.
- **Host single CB instances 3 (after Critic 3rd P1 integration)**: submission-internal 1 (5 methods integrated — generic dispatcher), gateway-internal 1 (gateway-getUserGitHubInfo), problem-service 1 (problem-getProblemInfo). Host 1 = CB 1 principle for stronger host-isolation (blocking dead host load amplification).
  - Initial design was separate CB per 5 methods, but Critic 3rd pointed out that reporters sharing the same host create dead host hammering risk without load distribution → integrated to host single CB.
- **Fallback strategy**: StatusReporter 5 locations throw propagation (DLQ/idempotency handling), gateway-getUserGitHubInfo throw propagation (can't push without token), problem-getProblemInfo returns default value + external try/catch safety net (maintains existing catch behavior → 0 regressions).
- **Metrics prefix**: `algosu_github_worker_circuit_breaker_*` (only service prefix differs, same label/structure as Wave A)
- **Code Paths**: `services/github-worker/src/circuit-breaker.ts` (new + spec), `services/github-worker/src/main.ts`, `services/github-worker/src/worker.ts`, `services/github-worker/src/status-reporter.ts`, `services/github-worker/src/metrics.ts` (registry export)

### D7: errorFilter Policy + Host Single CB (Wave B Critic 1st~3rd Integration)
- **Context (1st)**: Critic 1st review P1 2 items — 4xx permanent errors (404 not found, etc.) counted as CB failures, causing circuit OPEN. Wide-scale outage risk of normal messages being rejected during 30-second worker paralysis (Critic 1st P1).
- **Context (2nd)**: 1st fix excluded all 4xx (`>=400 && <500`) via errorFilter, but 401/403 also pass through → internal-auth outage protection fails if permanent 401/403 occurs from X-Internal-Key rotation/misconfiguration. Also, opossum errorFilter pass emits `success` event with first argument being Error instance (filtered error object) → counted with `result="success"` label → inaccurate metrics (Critic 2nd P1+P2).
- **Context (3rd)**:
  - status-reporter's 5 method CBs (`submission-getSubmission` + 4 others) share the same submission-service host. If submission-service fails, only `submission-getSubmission` opens and the other 4 remain CLOSED → continue calling dead host → host-isolation purpose neutralized + load amplification (Critic 3rd P1).
  - `FILTERED_BUSINESS_STATUS` includes 400 → CB OPEN not triggered on DTO/contract regression (header missing, validation drift, schema mismatch), allowing infinite hammering of dead dependency (Critic 3rd P2).
- **Choice (1st & 2nd maintained)**:
  - Narrowed errorFilter scope to explicit business 4xx whitelist — 401/403/408/429 etc. counted as CB failures to maintain auth/permission/timeout/overload outage protection.
  - When opossum errorFilter passes, branch on result being Error instance in success event handler → count as `requests_total{result="filtered"}` separately (metric accuracy).
  - `result` label enum expanded: `success | failure | reject | timeout | filtered`.
- **Choice (3rd)**:
  - Integrated status-reporter into **host single CB (`submission-internal`)**. 5 ops (get/reportSuccess/reportFailed/reportTokenInvalid/reportSkipped) share generic dispatcher (`_dispatch` + `_resolveEndpoint`). Unified to single SubmissionRequest payload (`{ op, submissionId, body? }`). All 5 methods blocked simultaneously when host OPEN → dead host protection.
  - `FILTERED_BUSINESS_STATUS = {404, 410, 422}` — removed 400. 400 is a contract regression signal → counted as CB failure to trigger circuit OPEN + alert.
  - StatusReporter public API signature unchanged — no impact on existing callers (worker.ts).
- **Rationale**:
  - Host-isolation essence is "don't keep calling a failed host" — per-method separation on the same host only causes load amplification. Integrated with host 1 = CB 1 principle.
  - 400 Bad Request looks like a permanent business error but may be contract drift (header missing, schema mismatch) → circuit protection target. True permanent business errors are sufficiently represented by 404 (not found) / 410 (permanently removed) / 422 (rule violation).
- **Code Paths**:
  - `services/github-worker/src/status-reporter.ts` (5 CBs → 1 host CB + dispatcher / `_dispatch` + `_resolveEndpoint` SRP separation)
  - `services/github-worker/src/circuit-breaker.ts` (removed 400 from `FILTERED_BUSINESS_STATUS`)
  - `services/github-worker/src/status-reporter.spec.ts` (host single CB validation + `_resolveEndpoint`/`_dispatch` unit test new)
  - `services/github-worker/src/circuit-breaker.spec.ts` (new 400 protection OPEN case + whitelist definition/unit behavior update)
  - `services/github-worker/src/worker.spec.ts` (5 CB registration validation → 1 host CB validation)
- **Test updates/additions (3rd)**: status-reporter.spec.ts host single CB registration validation + `_resolveEndpoint` 5 items (op-by-op endpoint mapping) + `_dispatch` 4 items (get/reportSuccess/reportFailed/non-ok status attachment) + circuit-breaker.spec.ts 1 new 400 OPEN transition. jest 169 → **175** (+6 net), coverage stmts 99.79% / branches 97.45% / functions 100% / lines 100% (threshold 98/92/100/98 met)
- **Wave A compatibility**: Same whitelist policy (including removing 400) + filtered metrics separation seed for `submission/circuit-breaker.service.ts` → Sprint 135 Wave C or separate PR. Currently fetchAiQuota uses `fallback: () => true` so no user impact, but follow-up correction recommended for consistency, metric accuracy, and auth/contract failure protection.

## Wave B Output

| Item | Result |
|------|--------|
| Branch | feat/sprint-135-cb-worker |
| CB instances | 3 (submission-internal / gateway-getUserGitHubInfo / problem-getProblemInfo) — Critic 3rd P1 integrated from 7 → 3 |
| Commits | 5 atomic (deps+manager → status-reporter → worker → tests → ADR) + 2 (1st errorFilter fix + ADR D7) + 2 (Critic 2nd whitelist+filtered label fix + ADR D7 update) + 2~3 (Critic 3rd host single CB + remove 400 + ADR D7 update) |
| Tests | 8 suites / 175 tests |
| Coverage | stmts 99.79% / branches 97.45% / functions 100% / lines 100% (threshold 98/92/100/98 met) |
| typecheck | 0 errors |
| lint | 0 errors |

### D8: Wave A submission CB Policy Sync with Wave B (Separate PR)
- **Context**: Wave B (D7) errorFilter whitelist policy not applied to Wave A's `services/submission/src/common/circuit-breaker/` module. Synchronization needed for metric accuracy + contract regression protection consistency. fetchAiQuota uses `fallback: () => true` so no user impact, but dead dependency hammering risk from contract regression / auth outage is identical.
- **Choice**:
  - Applied `FILTERED_BUSINESS_STATUS = {404, 410, 422}` whitelist (same as Wave B, excluding 400)
  - Added `DEFAULT_ERROR_FILTER` — applied by default in `createBreaker`, overridable by caller
  - In success event, branch on `result instanceof Error` → `requests_total{result="filtered"}` label separation (prevent success count contamination)
  - fetchAiQuota non-2xx throw now attaches `error.status` → errorFilter can branch
  - Added `buildHttpError(message, status)` helper to `circuit-breaker.constants.ts` (reusability + consistency)
- **Rationale**: CB policies of both modules (submission/github-worker) must be consistent for operational/monitoring consistency. When permanent 5xx/401/403 occurs → CB OPEN → fallback triggered (fail-open maintained) → dead dependency hammering blocked. Public API signature unchanged (createBreaker/getBreaker/getState/onModuleDestroy all maintained) — no regression in callers (saga-orchestrator).
- **Code Paths**:
  - `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts` (FILTERED_BUSINESS_STATUS / DEFAULT_ERROR_FILTER / errorFilter option / success handler filtered branch)
  - `services/submission/src/common/circuit-breaker/circuit-breaker.constants.ts` (`buildHttpError` helper)
  - `services/submission/src/saga/saga-orchestrator.service.ts` (use buildHttpError in `fetchAiQuota`)
  - `services/submission/src/common/circuit-breaker/circuit-breaker.service.spec.ts` (errorFilter unit + integration + buildHttpError validation, +15 tests)
  - `services/submission/src/saga/saga-orchestrator.service.spec.ts` (2 fetchAiQuota status attachment additions)
- **Tests**: 21 suites / 290 → **305 tests** (+15 net), coverage threshold met (stmts 97.91% / branches 92.82% / functions 96.34% / lines 97.98% — all thresholds 97/92/96/97 passed)

#### D8 Critic 1st Follow-up Corrections (P1+P2)

- **P1 — `aiQuotaCheck` CB with `errorFilter: () => false` override applied**:
  - `fetchAiQuota` only calls a fixed endpoint (`/quota/check`) → 404/410/422 are not resource-not-found but "AI Analysis Service route misconfig or service absence" signals.
  - Applying default whitelist (`{404,410,422}`) as-is allows infinite calls to dead service + CB OPEN not triggered + no alert fired.
  - `errorFilter: () => false` counts all non-2xx as CB failures so CB OPEN when `volumeThreshold` reached → fallback `() => true` keeps user impact at 0 + alert signal obtained.
  - **Code Paths**: `services/submission/src/saga/saga-orchestrator.service.ts:onModuleInit` createBreaker call
  - **Tests**: 2 new `errorFilter` option validation + override behavior unit tests in `saga-orchestrator.service.spec.ts`
- **P2 Exact Resolution (Critic 2nd)**:
  - Introduced errorFilter wrapper + WeakSet marker pattern for accurate success/filtered branching.
  - Wrapper: when filtered — (a) count `requests_total{result="filtered"}` + (b) add marker to WeakSet.
  - Success handler: if result is object and WeakSet has marker, skip (prevent double-counting).
  - Resolves both incorrect cases of previous `instanceof Error` heuristic (Error resolve / non-Error throw).
  - **Remaining limit**: primitives (string/number) cannot be added to WeakSet → primitive errorFilter pass adds 1 success count (practical impact 0, this project only throws Error/object).
  - **Code Paths**: `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts` createBreaker (wrapper + WeakSet) + success handler (marker lookup) + onModuleDestroy (WeakSet cleanup)
  - **Test additions**: plain object throw + filtered (1) / WeakSet reuse safety (1) / primitive limit documented (1) / object resolve regression prevention (1) — total +4
  - **Sprint 136+ seed update**: Apply same wrapper pattern to Wave B (`services/github-worker/src/circuit-breaker.ts`) (currently `instanceof Error` heuristic).

### D9: Wave C — submission Service Problem Service 2 Call Sites CB Applied

- **Context**: submission service's 2 Problem Service HTTP call sites (`saga-orchestrator.fetchSourcePlatform`, `submission.service.checkLateSubmission`) are unprotected by CB. Infinite calling possible on dead host + graceful degradation exists on deadline query failure but no dead host hammering block.
- **Choice**:
  - Host single CB (`problem-service-internal`) — same dispatcher pattern as Wave B status-reporter.
  - Encapsulated in `ProblemServiceClient` NestJS service — 2 call ops (`getSourcePlatform`, `getDeadline`) integrated via dispatcher (`_dispatch` + `_doGetSourcePlatform` + `_doGetDeadline` SRP separation).
  - Per-op fallback (`getSourcePlatform: undefined`, `getDeadline: {isLate: false, weekNumber: null}`) — maintains existing graceful degradation.
  - Default 4xx whitelist (`{404, 410, 422}`) applied — Problem Service uses dynamic endpoint (`/internal/{problemId}`) so 404 = "problem not found" is a natural business error, only 5xx/auth/timeout counted as CB failures.
  - Non-2xx uses `buildHttpError(message, status)` to attach status → DEFAULT_ERROR_FILTER can branch on whitelist.
- **Code Paths**:
  - `services/submission/src/common/problem-service-client/` (new module — module/client/index/spec)
  - `services/submission/src/saga/saga-orchestrator.service.ts` (remove `fetchSourcePlatform` private method → delegate to client, remove problemServiceUrl/Key fields)
  - `services/submission/src/submission/submission.service.ts` (simplify `checkLateSubmission` body to 1-line client delegation, remove ConfigService dependency)
  - `services/submission/src/submission/submission.module.ts` (import `ProblemServiceClientModule`)
- **Host single CB instances (Sprint 135 comprehensive)**:
  - submission service: `aiQuotaCheck` (1) + `problem-service-internal` (1) = 2
  - github-worker: `submission-internal` (1) + `gateway-getUserGitHubInfo` (1) + `problem-getProblemInfo` (1) = 3
  - Total 5 CB instances protecting 4 external services (AI Analysis / submission internal / Gateway / Problem Service)
- **Tests**: `problem-service-client.spec.ts` 24 new + saga-orchestrator/submission.service/ai-satisfaction spec updates. Total 334 tests pass, coverage stmts 98.46% / branches 94.53% / functions 96.59% / lines 98.55% (threshold 97/92/96/97 met)
- **Public API signature unchanged**: No impact on SagaOrchestratorService.advanceToAiQueued / SubmissionService.create callers
- **Critic 1st P2 follow-up correction**: Regression block when env (`PROBLEM_SERVICE_KEY`) not set → fetch slow path (timeout 5 seconds → CB OPEN). Added key validation at start of public methods (`getSourcePlatform`/`getDeadline`) → immediate fallback return for sub-millisecond recovery. Preserved existing `submission.service.checkLateSubmission`'s `getOrThrow` immediate fallback behavior. Added 2 env-not-set fallback validation cases to `problem-service-client.spec.ts` (fetch not triggered + hostBreaker.fire not called + default value returned).
- **Critic 2nd P1 follow-up correction**: Marked `CircuitBreakerModule` as `@Global()` + removed from `ProblemServiceClientModule.imports`. NestJS instantiates `CircuitBreakerService` separately per module scope, causing prom-client duplicate metric registration error and submission service boot failure. Single import in AppModule or SubmissionModule suffices for global use.
- **Critic 3rd P1 follow-up correction — defense code added**: Added `instanceof Error` check to `hostBreaker.fire` result in `getSourcePlatform`/`getDeadline`. Current opossum 8.x calls `reject(error)` when errorFilter passes → caught in catch → fallback returned, but explicit check (1) guards against future opossum behavior changes + (2) clarifies code intent + (3) ensures Error objects don't reach business logic (`sourcePlatform: Error`, `isLate: Error`). Defense in depth. 2 new tests (1 each for getSourcePlatform/getDeadline — mock Error as resolve → verify fallback returned). Total 336 → **338 tests** pass, problem-service-client.ts coverage stmts/branches/functions/lines all 100% maintained.
- **Critic 4th P2 follow-up correction — URL validation added**: 1st P2 fix validated only `problemServiceKey` and left `problemServiceUrl` falling back to default value (`'http://problem-service:3002'`). URL not set + KEY set → fetch to default host 5-second timeout → CB OPEN regression possible. In constructor, removed default (preserved as `?? ''` empty string) + `isConfigReady()` private helper validates both URL and KEY + guard in public methods (`getSourcePlatform`/`getDeadline`) changed from `if (!this.problemServiceKey)` → `if (!this.isConfigReady())`. `getOrThrow` not used (boot-time throw regression risk) — get + empty string fallback pattern maintained. 5 new tests (URL not set / URL+KEY both not set each for getSourcePlatform/getDeadline + ConfigService.get returns undefined → no default applied). Total 338 → **343 tests** pass, problem-service-client.ts stmts/branches/lines 100% maintained (functions 91.66% limited to index.ts empty re-export — this file 100%).

### D10: Wave D — Grafana CB Dashboard
- **Context**: Sprint 135 Wave A/B/C introduced 5 host single CBs in production. No operation dashboard to monitor CB state changes/request throughput/failure rate at a glance.
- **Choice**:
  - Created new ConfigMap `grafana-cb-dashboard` (`infra/k3s/monitoring/grafana-cb-dashboard.yaml`)
  - Added ConfigMap mount to `grafana.yaml`'s projected volume → automatic provisioning
  - 5 panel types: State Matrix (current state) + Request Rate by Result (throughput) + Failure Rate + State Timeline (state history) + Distribution (cumulative stats) + Stats Table
  - Integrated metrics from both submission + github-worker (`algosu_submission_circuit_breaker_*` + `algosu_github_worker_circuit_breaker_*`)
  - Template variable `name` (multi-select, includeAll) — auto-exposes all 5 CB instances via `label_values({__name__=~"algosu_(submission|github_worker)_circuit_breaker_state"}, name)` query + panel filtering
  - Dashboard uid: `algosu-cb`, refresh: 30s, schemaVersion: 39, links: SLO Overview / Service Debug
- **Code Paths**:
  - `infra/k3s/monitoring/grafana-cb-dashboard.yaml` (new)
  - `infra/k3s/monitoring/grafana.yaml` (1 line added to projected sources)
- **Operational value**: Visual alert immediately when CB OPEN + observe infra failures (failure/timeout/reject) and business 4xx (filtered) separately via result label.
- **Verification**: yaml.safe_load pass + ConfigMap's JSON `json.loads` pass + Deployment's projected sources 3 (slo/service/cb) consistency.
- **Critic 1st P2 follow-up correction — AI Analysis addition + schema difference acknowledged**:
  - Initial D10 implementation only visualized TypeScript CBs (submission 2 + github-worker 3) → Sprint 135 original reference Python CB (`services/ai-analysis/src/circuit_breaker.py`, metric `algosu_ai_analysis_circuit_breaker_state`) operates in production but was missing from dashboard → Claude API failures would show "all normal" without observation.
  - **Schema differences**: TypeScript (0=CLOSED/1=HALF_OPEN/2=OPEN, name label present, failures_total + requests_total{result} exist) vs Python (0=CLOSED/0.5=HALF_OPEN/1=OPEN, no name label, only state metric exposed) — simple regex integration not possible.
  - **State Matrix panel separated**: Existing Panel id=1 width 24→18 (`Circuit Breaker State (TypeScript)`), new Panel id=7 width 6 (`AI Analysis CB State (Python)`, mappings 0/0.5/1, thresholds green→yellow at 0.5→red at 1).
  - **State Timeline separated**: Existing Panel id=4 width 24→18 (`Circuit Breaker State Timeline (TypeScript)`), new Panel id=8 width 6 (`AI Analysis CB Timeline (Python schema)`, same 0/0.5/1 mappings).
  - **Request Rate / Failure Rate / Distribution / Stats Table**: ai-analysis lacks `failures_total`/`requests_total{result}` metrics → no changes, description added ("AI Analysis Python CB ... metrics absent — to be added in Sprint 136+ when schema unified").
  - **Verification**: yaml.safe_load pass + json.loads pass + 12 panel IDs (100/1/7/101/2/3/102/4/8/103/5/6) no conflicts + gridPos per-row 24-width consistency (y:1 18+6 / y:17 18+6).
  - **Sprint 136+ seed**: Unify ai-analysis Python CB metric schema with TypeScript (state value 0/1/2 + `name` label + `failures_total` + `requests_total{result}`) → can integrate into single Grafana query regex. Requires simultaneous update of `services/ai-analysis/src/metrics.py` + `circuit_breaker.py` + operational alert rules.

## Carryover (Wave E Comprehensive — All Complete)

### Sprint 135 Internal Work (All Complete ✅)

- [x] **Wave A**: submission `aiQuotaCheck` PoC + opossum introduction (D1~D5) — PR #167 `459cd8a`
- [x] **Wave B**: github-worker 7 sites CB applied + host single CB pattern (D6~D7) — PR #168 `c561488`
- [x] **Wave A follow-up correction (separate PR)**: errorFilter wrapper + WeakSet marker for exact P2 resolution (D8) — PR #169 `1f40247`
- [x] **Wave C**: submission 2 sites added (`ProblemServiceClient` + `CircuitBreakerModule@Global`) (D9) — PR #170 `7d4c539`
- [x] **Wave D**: Grafana CB dashboard (TypeScript + Python schema separated) (D10) — PR #171 `2c5d8e3`
- [x] **Wave E**: Sprint 135 ADR comprehensive update + sprint-window.md final cleanup — this ADR `status: completed`

### Sprint 136+ Carryover Seeds

#### CB Consistency Improvements
- [ ] **github-worker errorFilter wrapper sync**: Apply errorFilter wrapper + WeakSet marker pattern to `services/github-worker/src/circuit-breaker.ts` (currently `instanceof Error` heuristic → same exact branching as Wave A). Only submission applied in Sprint Wave A sync PR #169, two modules need consistency recovery.
- [ ] **ai-analysis Python CB metric schema unification**: Add state value 0/1/2 + `name` label + `failures_total` + `requests_total{result}` to match TypeScript. Update `services/ai-analysis/src/metrics.py` + `circuit_breaker.py` + operational alert rules simultaneously. After unification, the separated Python schema panels in Grafana dashboard can be integrated into a single query regex.

#### Separate Seeds (non-CB)
- [ ] **CLAUDE.md L11 naming mismatch correction**: Document says "ai-feedback" → actual directory is `services/ai-analysis/`. Metadata consistency issue discovered during Sprint Wave A.
- [ ] **E2E auto PR CI integration** (Sprint 134 carryover): Integrate `e2e-full.sh` (657 lines) into `.github/workflows/ci.yml` PR trigger. Currently only manual workflow_dispatch execution is possible.
