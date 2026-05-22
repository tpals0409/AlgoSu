---
sprint: 200
title: "github-worker main.ts Bootstrap Smoke + require.main Guard"
date: "2026-05-22"
status: completed
agents: [Oracle, Postman, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "bootstrap", "nodejs"]
tldr: "Extended the bootstrap/lifecycle smoke pattern established for 4 NestJS services in Sprint 197~199 to github-worker, a pure Node.js service with no app.module. Added a bootstrap smoke test that runs main()'s entrypoint wiring (startMetricsServer → CircuitBreakerManager → GitHubWorker → worker.start() → SIGTERM/SIGINT handlers) in a single pass, completing 'tests green = bootstrap works' for github-worker. Per-component unit specs (worker/config/circuit-breaker/metrics) were broad, but the path where main() wires them together was the one uncovered gap. Since the NestJS .compile() pattern does not apply, adopted approach B — export main and gate the void main() call behind require.main === module (preserves direct-execution behavior + blocks auto-run on test import), and change the return value to { worker, cbManager } to expose teardown handles. main.init.spec.ts reuses jest.mock(ioredis/config/amqplib) + mocks only startMetricsServer (via requireActual) to block real port listen. The negative check picks a throw point before any resource is created (startMetricsServer) to prove main() rejects without leaking opossum timers. Exploration found ai-analysis (FastAPI) already has bootstrap coverage via TestLifespan/TestStartupShutdownEvents + test_config.py import-time negative checks → excluded as pure duplication. tsc 0 · ESLint 0 · jest 9 suites 181 pass (funcs 100% · lines 100%, main.ts excluded from collectCoverageFrom so thresholds unaffected) · open handles 0 · CI #353 CLEAN · Critic (Codex) Critical/High 0. PR #353 squash → 40ad681."
---
# Sprint 200 — github-worker main.ts Bootstrap Smoke + require.main Guard

## Goal

- Extend the bootstrap/lifecycle smoke pattern established for the 4 NestJS services (gateway·submission·problem·identity) in Sprint 197~199 to **github-worker, a pure Node.js service with no app.module**.
- Add a **bootstrap smoke test that runs github-worker `main.ts`'s entrypoint wiring** (`startMetricsServer` → `CircuitBreakerManager` → `GitHubWorker` → `worker.start()` → SIGTERM/SIGINT handlers) in a single pass, completing "tests green = bootstrap works" for github-worker.

## Background

- github-worker is a RabbitMQ consumer worker (Node.js + amqplib + ioredis + Octokit + opossum + prom-client). It is **not NestJS and has no app.module**, so the `Test.createTestingModule({imports:[AppModule]}).compile()/.init()` pattern from Sprint 197~199 cannot be applied as-is.
- Existing test assets were broad per-component — `worker.spec.ts` (GitHubWorker.start/stop/message handling), `config.spec.ts` (missing-env throw negative check), `circuit-breaker.spec.ts`, `metrics.spec.ts`, etc. But the **path where `main.ts`'s `main()` wires them together** had no dedicated spec and was uncovered (`main.ts` is excluded from `collectCoverageFrom` — `jest.config.ts:10` `'!**/main.ts'`).
- That is, each component is verified with its own mocks, but it was never checked whether `startMetricsServer()` + `new CircuitBreakerManager(registry)` + `new GitHubWorker(cbManager)` + `await worker.start()` + signal handler registration throws when run **together** — the one real gap for this sprint.
- Technical hurdles: `main.ts` uses a top-level `void main().catch()` fire-and-forget pattern, so merely importing it auto-runs `main()`. Also `startMetricsServer()` actually listens on a port (`metrics.ts:97`), the `GitHubWorker` constructor calls `new Redis()` (`worker.ts:96`), and `worker.start()` calls `amqplib.connect` (`worker.ts:154`), so external I/O must be mocked. opossum breakers hold a stats-refresh `setInterval`, so without teardown the test hangs.

## Decision

### D0. Scope — github-worker only (rescoped from exploration)

- The sprint started as "extend bootstrap smoke to github-worker + ai-analysis", but pre-work exploration found **ai-analysis (FastAPI) already has effectively complete bootstrap smoke coverage**:
  - `tests/test_main.py`'s `client` fixture (`from src.main import app` → config import + app wiring), `TestStartupShutdownEvents` (calls `startup_event()` directly → Worker/Redis init), `TestLifespan` (TestClient context runs the full lifespan startup/shutdown).
  - `tests/test_config.py`'s import-time `ValidationError` negative checks (empty string/missing/whitespace → `INTERNAL_API_KEY`).
- Adding new tests would be pure duplication, so **ai-analysis is excluded** and we focus on the github-worker `main.ts` gap (confirmed via user AskUserQuestion).

### D1. Approach B — export + require.main guard (user-recommended, approved)

- Change `async function main()` → `export async function main()`, and wrap the top-level `void main().catch()` in an `if (require.main === module) { ... }` guard.
- Rationale: bootstrap runs **only when executed directly** as the entrypoint, so production behavior is unchanged, while tests can `import { main }` without auto-running and `await main()` to clearly verify wiring completes. The `@ci-measurement: sprint-105-post-baseline` anchor comment sits above the import and is preserved.
- Alternative A (no source change, fire-and-forget): would have to auto-run via `await import('./main')` while mocking `process.exit` + flushing microtasks to infer completion, and the test cannot obtain references to `main()`'s internal `cbManager`/`worker`, making opossum `setInterval` teardown awkward → open-handle risk, so rejected.

### D2. Change main() return value to { worker, cbManager } — expose teardown handles

- Change `main()`'s signature from `Promise<void>` → `Promise<{ worker; cbManager }>`. The production entrypoint (`void main().catch()`) ignores the return value (harmless), while tests use the returned handles to call `worker.stop()` + `cbManager.shutdown()`, cleaning up the MQ connection and the opossum `setInterval`. The JSDoc states the returned handles are for graceful shutdown and test teardown.

### D3. Partial mock of metrics — requireActual + only startMetricsServer no-op

- `jest.mock('./metrics', () => ({ ...jest.requireActual('./metrics'), startMetricsServer: jest.fn() }))`. Only `startMetricsServer` is no-op'd to block real port listen, while `registry`/Counters use **real prom-client instances** (since `new CircuitBreakerManager(registry)` actually uses the registry). jest's per-file module isolation avoids prom-client duplicate-registration conflicts (Sprint 197 lesson).
- ioredis/config/amqplib reuse `worker.spec.ts`'s mock patterns as-is (`jest.mock('ioredis')`, `jest.mock('./config')` with fixed config, `jest.mock('amqplib')` connect → mock channel). config load/missing-throw verification is already owned by `config.spec.ts`, so this smoke focuses on the wiring flow.

### D4. Negative-check throw point — a stage before any resource is created (startMetricsServer)

- The negative check proves "a wiring-stage defect is caught by the smoke", but the throw point is chosen as **`startMetricsServer`** (the first wiring stage): `(startMetricsServer as jest.Mock).mockImplementationOnce(() => { throw ... })` → `main()` rejects.
- Rationale: startMetricsServer runs **before** `cbManager`/`worker` are created, so a throw here means the opossum breaker is not yet created and there is no `setInterval` leak. Rejecting `worker.start()`'s `amqplib.connect` instead would, at that point, have already created `cbManager`/`worker` (holding opossum timers) that the rejected `main()` cannot return for cleanup → teardown leak, so rejected.

## Implementation

### Implementation commit (1 commit, PR #353 squash → `40ad681`)

- `fb2c733` test(github-worker): main.ts bootstrap smoke + require.main guard (+134/-5)
  - **`main.ts`**: `export async function main()` + return `{ worker, cbManager }` + `if (require.main === module)` guard. `@ci-measurement` anchor preserved. Added main() JSDoc.
  - **`main.init.spec.ts`** (new): `jest.mock('ioredis'|'./config'|'amqplib')` + metrics via `requireActual` with only `startMetricsServer` no-op. logger stdout suppressed. 2 its:
    - `main()` completes without throw + `startMetricsServer` called once + SIGTERM/SIGINT handlers registered → teardown (`worker.stop()` + `cbManager.shutdown()`).
    - `[negative check]` `startMetricsServer` throws → `main()` rejects (`SP200_NEGATIVE_CHECK`).
  - afterEach: `process.removeAllListeners('SIGTERM'|'SIGINT')` + `jest.clearAllMocks()` to prevent signal-handler leaks.

## Verification

- **Type/build**: `tsc --noEmit` 0. ESLint **0** (`main.ts` + `main.init.spec.ts`).
- **Tests**: new spec passes standalone (`--detectOpenHandles` warnings 0) + full regression **9 suites / 181 pass**. Coverage stmts 99.8% / branch 97.61% / **funcs 100% / lines 100%** → thresholds (92/100/98/98) all pass. **`main.ts` is excluded from `collectCoverageFrom` (`!**/main.ts`) so it is not in the coverage table → thresholds unaffected**.
- **Critic**: `codex review --base main` (Codex, session `019e4e41-1294-7fc0-8f1f-797af6106b85`) — Critical/High **0** ("The changes cleanly expose the bootstrap function for testing while preserving direct execution behavior via the CommonJS entrypoint guard. The added smoke test mocks external I/O and typechecking succeeds; no actionable correctness issues were found in the diff"). ✅ Mergeable.
- **CI #353**: `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`, Failed **0** (github-worker Quality/Audit/Test + E2E Programmers pass; unchanged areas skipping via path filter) → Squash merge.

## Lessons / Patterns

- ① **Pure Node.js entrypoints become testable via a `require.main === module` guard** — the standard for bootstrap smoke on services where the NestJS `.compile()`/`.init()` pattern does not apply (no app.module). Exporting main and wrapping auto-run in the guard preserves production behavior while letting tests verify wiring completion with `await main()`.
- ② **Pick the negative-check throw point before resource creation to avoid teardown leaks** — when a resource has a side effect on creation (like opossum's setInterval), a throw **after** that creation leaves a rejected main() unable to return the handle for cleanup. Moving the throw point **before** resource creation (here, startMetricsServer) gives the same proving power without leaks.
- ③ **Partial mock = `requireActual` + override only specific exports** — when part of a module (registry/Counters) needs real instances and only part (startMetricsServer) needs real I/O blocked, use `{ ...requireActual, target: jest.fn() }` to precisely block only the real I/O rather than auto-mocking the whole module.
- ④ **"Already covered" is also a scope decision — pre-work exploration removes duplication** — ai-analysis was already covered by existing `TestLifespan`/`TestStartupShutdownEvents` + import-time negative checks, so new tests would be pure duplication. Exploring before working prevented needless sprint bloat.

## New Patterns

- **Pure Node.js entrypoint bootstrap smoke** — export main + separate via `require.main === module` guard, expose teardown handles (worker/manager) via the return value, mock external I/O (metrics listen/RabbitMQ/Redis) (partial mock = `requireActual` + specific export override), and tear down side-effect resources (opossum setInterval) via the returned handles. The non-NestJS (github-worker) counterpart to `app.module.spec`.
- **Pre-resource-creation negative check** — embedding a temporary throw in the first wiring stage (startMetricsServer) to confirm `main()` rejects proves "a wiring defect is caught by the smoke" without creating side-effect resources like opossum timers.

## Carryover Items

- **Operational Sprint 196 migration run + redeploy** (user/ops): `npm run migration:run` on problem_db (jsonb conversion + GIN, runbook `SET statement_timeout=0`).
- (Optional) **CI PYTHON_VERSION 3.12 → 3.13** upgrade (separate sprint).
- Accumulated UAT (user, hands-on): Programmers re-submission grading / English production Grafana CB dashboard.
