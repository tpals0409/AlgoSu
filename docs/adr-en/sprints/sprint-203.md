---
sprint: 203
title: "github-worker·ai-analysis Bootstrap Smoke Re-audit — Cross-Runtime Negative-Verification Ladder Alignment"
date: "2026-05-27"
status: completed
agents: [Oracle, Postman, Critic, Scribe]
related_adrs: ["sprint-197", "sprint-199", "sprint-200"]
related_memory: ["sprint-window"]
topics: ["testing", "bootstrap", "observability"]
tldr: "Re-audited the bootstrap smoke inventory for all 6 services after Sprint 200 — confirmed that github-worker (Node.js) and ai-analysis (FastAPI) smokes exist as assumed (Sprint 200 assumption validated). Discovered one gap: ai-analysis had no lifespan-runtime negative-verification (in-startup_event throw), only import-time coverage. Phase A adds TestLifespanNegative (sentinel SP203_NEGATIVE_CHECK). Cross-runtime negative-verification ladder pattern (import-time → assembly → lifecycle hook) across NestJS·Node.js·FastAPI is formalised as a new pattern."
---
# Sprint 203 — github-worker·ai-analysis Bootstrap Smoke Re-audit — Cross-Runtime Negative-Verification Ladder Alignment

## Goal

- **Re-audit** the full bootstrap smoke inventory for all 6 services after Sprint 200 and verify that the Sprint 200 assumption matches actual code state.
- Confirm that the negative-verification ladder (import-time → assembly → lifecycle hook) is aligned across heterogeneous runtimes (NestJS·Node.js·FastAPI), and fill any discovered gaps.
- Persist the re-audit result and new patterns as an ADR.

## Background

The bootstrap smoke introduction followed the path: Sprint 197 (`.compile()` DI-graph smoke) → Sprint 199 (`.init()`/`.close()` lifecycle smoke extension) → Sprint 200 (github-worker `main.ts` assembly smoke + assumption that ai-analysis was complete). Sprint 200's ADR recorded this as the full coverage baseline. Sprint 203 was triggered by the need to validate whether "complete" still matched actual code state, and to close any gaps in the same sprint.

In particular, it was unclear whether ai-analysis (FastAPI) had a **lifespan-runtime negative-verification** analogous to the NestJS `onModuleInit` throw pattern from Sprint 199. The three import-time `ValidationError` tests in `test_config.py` were confirmed, but no Sprint 200 ADR entry explicitly addressed a runtime throw inside `startup_event`.

## Decision

### D0. Re-audit Approach

Use the Read tool to enumerate bootstrap smoke locations and negative-verification status for all 6 services, producing a structured inventory.

### D1. Findings

- Sprint 200 assumption — github-worker `main.init.spec.ts` complete, ai-analysis `test_main.py` TestLifespan + TestStartupShutdownEvents complete — **matches code state ✅**
- **Gap discovered**: ai-analysis has no lifespan **runtime** (inside-startup_event throw) negative verification. Import-time negative verification (`test_config.py` INTERNAL_API_KEY `ValidationError` × 3) exists, but there is no proof that a throw propagated during the first step of the FastAPI lifespan context triggers fail-fast.
- github-worker has complete assembly-stage negative verification: `startMetricsServer` throw → `SP200_NEGATIVE_CHECK`.

### D2. Gap-Fill Decision

Add a `TestLifespanNegative` class to `tests/test_main.py` to prove lifespan-runtime fail-fast. Sentinel: `SP203_NEGATIVE_CHECK`. This completes the negative-verification pairing (github-worker SP200 ↔ ai-analysis SP203).

## Implementation

### Phase A — Add TestLifespanNegative (commit e5ff06a)

Delegated to Postman. Appended `TestLifespanNegative` class to `services/ai-analysis/tests/test_main.py` (+33 lines).

**Throw-point rationale**: throw injected at `src.main.circuit_breaker.set_state_change_callback` — the first step inside `startup_event`, **before** `redis.from_url` / `AIAnalysisWorker()` construction, so no worker_thread leak. Follows the Sprint 200 principle: pick a throw point before any resource with side-effects is created.

**`finally` block**: resets global state (`worker_instance` / `worker_thread` / `redis_client`) to `None` to ensure isolation from other tests.

**Python lambda throw idiom**: `monkeypatch.setattr("src.main.circuit_breaker.set_state_change_callback", lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("SP203_NEGATIVE_CHECK")))` — pytest builtin `monkeypatch` direct assignment (NOT pytest-mock `mocker.patch` + `side_effect=`). Unconventional but accepted for test isolation.

## Verification

- `pytest services/ai-analysis/tests/test_main.py::TestLifespanNegative` → **1 PASSED**
- Full regression: **328 passed**
- Coverage: **99.09%** (actual threshold: `pyproject.toml` `fail_under=97` / `addopts --cov-fail-under=97`)
  - **Note**: the commit message states 'threshold 98%' — this was the value passed in the delegation instruction and does not match the actual SSOT (`pyproject.toml` = 97). No functional or CI impact. Per Sprint 202 lesson (avoid history rewrite), the correction is recorded here in the ADR rather than rewriting commit history.
- **Critic (Codex session `019e6912-ee57-7622-92a8-817fe4d0a11a`)**: Critical/High/Medium **0**, P3 × 1 (threshold value discrepancy — no functional or CI impact).

## Bootstrap Smoke Inventory (current as of Sprint 203)

| Service | Runtime | Bootstrap Smoke Location | Verification Level | Introduced | Negative Verification |
|---------|---------|--------------------------|-------------------|------------|-----------------------|
| gateway | NestJS | `app.module.spec.ts` (.compile) + `app.module.init.spec.ts` (.init/.close) | DI graph + lifecycle | 197/199 | ✅ (Sprint 199, raise-time) |
| submission | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle (amqplib mock) | 197/199 | ✅ saga onModuleInit throw (Sprint 199) |
| problem | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle (dual DataSource teardown quirk catch) | 197/199 | ✅ (Sprint 199) |
| identity | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle | 197/199 | ✅ (Sprint 199) |
| github-worker | Node.js (no app.module) | `src/main.init.spec.ts` | main() assembly + signal handlers + teardown handles | 200 | ✅ startMetricsServer throw → SP200_NEGATIVE_CHECK |
| ai-analysis | FastAPI | `tests/test_main.py` — TestLifespan + TestStartupShutdownEvents + (Sprint 203) TestLifespanNegative | lifespan context + startup/shutdown direct calls + lifespan-runtime negative verification | 200/203 | ✅ circuit_breaker.set_state_change_callback throw → SP203_NEGATIVE_CHECK |

> Import-time negative verification (ai-analysis): `test_config.py` INTERNAL_API_KEY `ValidationError` × 3 (empty string / unset / whitespace-only) — independent of the assembly negative verification above.

## New Pattern — Cross-Runtime Bootstrap Smoke Ladder

### Mapping Principle

| Runtime | Bootstrap Equivalent Level | Negative Verification Stage |
|---------|--------------------------|----------------------------|
| NestJS | `.compile()` (DI graph build + useFactory) | `.init()` → onModuleInit throw |
| Node.js | `main()` (entry-point assembly) | first-step throw → main() reject |
| FastAPI | `lifespan` context entry | startup_event first-step throw |

### Three-Tier Negative-Verification Ladder

| Tier | What It Proves | Example |
|------|---------------|---------|
| **import-time** | Process cannot start when config is missing | `test_config.py` ValidationError |
| **assembly** | First-step throw propagates at bootstrap entry | SP200_NEGATIVE_CHECK / SP203_NEGATIVE_CHECK |
| **lifecycle hook** | Lifecycle hook (onModuleInit) throw propagates | Sprint 199 saga throw |

- github-worker: import-time (config) + assembly.
- ai-analysis: import-time (config) + assembly.
- NestJS × 4: import-time (config) + assembly (.compile) + lifecycle hook (.init).

## Lessons

1. **Re-audit = assumption check + gap fill + ADR persistence — three steps, not one.** Stopping at assumption validation lets discovered gaps become orphaned notes lost in the next sprint's context. Filling the gap in the same sprint completes the pattern.
2. **Apply the same negative-verification tiers across heterogeneous runtimes.** Python's lambda throw idiom (`(_ for _ in ()).throw(...)`) is unconventional, but the role — "bootstrap entry → first-step throw → propagation" — is identical to the NestJS and Node.js patterns. The ladder is runtime-agnostic.
3. **Commit message delegation-value vs. actual SSOT discrepancy: avoid history rewrite.** Per the Sprint 202 lesson, recording the correction in the ADR is sufficient. No rewrite.

## Deferred

- **Production Sprint 196 migration run + redeploy** (user/ops responsibility)
- (optional) Add `oracle` to `commitlint` scope-enum (Sprint 202: `chore(oracle):` was blocked)
- (optional) CI PYTHON 3.12 → 3.13
- (optional) Promote Build Blog (SSG) to required check
- (seed) Harness routine-checkup checklist automation script
- Accumulated UAT (user direct) → Sprint 204
