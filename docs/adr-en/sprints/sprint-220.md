---
sprint: 220
title: "SP217 Quiz-Records Cutover Runbook + Live E2E Verification Checklist"
date: "2026-06-06"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["docs", "runbook", "deployment", "migration", "quiz"]
tldr: "A docs-only sprint that produces the operations cutover runbook needed to deploy and verify the CS quiz logged-in record integration (quiz_records), which was completed and code-verified across Sprints 215–219, on live. Because production cluster access is user/ops-only, the actual migration:run, redeploy, and live E2E cannot be performed here, so the focus is on capturing an accurate, executable procedure. Key correction: the db-migrate initContainer in identity-service.yaml runs migration:run automatically on rollout, so the long-carried 'manual migration:run + redeploy' framing is really a single 'redeploy (= initContainer auto-migration)' flow. The SP217 migration is a CREATE TABLE on a brand-new empty table, so it carries no statement_timeout risk (in contrast to the SP196 GIN index) and needs neither CONCURRENTLY nor SET timeout=0. The new runbook docs/runbook/sp217-quiz-records-cutover.md documents preconditions, backup, identity rollout (initContainer migration), gateway+frontend rollout, rollback, and a 6-item live E2E checklist (logged-in persistence, higher-only, cross-device sync, difficulty separation, idempotent merge-up, best-effort fallback) with exact API paths (GET/POST /api/quiz-records, by-user/:userId). Accuracy finding: /quiz is not in PUBLIC_PATHS — it is an auth-gated route — so the live E2E is done as a logged-in user and the current /quiz→/login 307 is correct behavior. Execution remains an ops carryover (the runbook makes it ready to run). docs-only — no code/schema/bundle change."
---
# Sprint 220 — SP217 Quiz-Records Cutover Runbook + Live E2E Verification Checklist

## Goal

- Produce an operations cutover runbook to **deploy and verify on live** the CS quiz logged-in record integration (`quiz_records`), which was **completed and code-verified** across Sprints 215–219.
- Because production cluster access is user/ops-only, this sprint targets **producing an accurate, executable procedure rather than executing it** (actual execution stays an ops carryover).
- **docs-only** — no code/schema/test/bundle change (the feature was completed and verified in 215–219).

## Background

### merge ≠ live, and the repeated "manual migration:run + redeploy" carryover

Since Sprint 217 added `quiz_records`, every sprint from 215–219 has carried the same item: "ops `identity_db` `migration:run` + server redeploy + live `/quiz` E2E verification." The code was verified by 218 (regression safety net) and 219 (lint cleanup), but **live is unverified**. Image builds are automatic on main merge, but rollout is manual ops (the image in `infra/k3s/*.yaml` is a `main-PLACEHOLDER` literal), so merge ≠ live is structurally maintained.

### The initContainer runs the migration automatically (carryover wording corrected)

While exploring, we confirmed that the **`db-migrate` initContainer** in `infra/k3s/identity-service.yaml` runs `migration:run` automatically before the app container starts:

```yaml
initContainers:
  - name: db-migrate
    command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/database/data-source.js"]
```

So the long-carried "manual `migration:run` + redeploy" read as two separate manual steps, but in reality **the redeploy (rolling out a new identity image) includes the migration**. This sprint codifies that as the primary path in the runbook and demotes `kubectl exec ... migration:run` to a verification/fallback path.

### The SP217 migration has no timeout risk

`20260602000000-SP217-CreateQuizRecords.ts` is a brand-new empty table `CREATE TABLE quiz_records` + a composite UNIQUE + a small `CREATE INDEX`. It does not exceed the production postgres `statement_timeout=200`, so **`SET statement_timeout=0` and `CREATE INDEX CONCURRENTLY` are unnecessary** (in contrast to the Sprint 196 `problem_db` GIN index, which needed timeout=0 for a large-table rewrite). `down()` = `DROP TABLE IF EXISTS` → rollback-safe.

## Decisions

### D1. Write a new dedicated cutover runbook (not an augmentation of the generic db-migration.md)

Create `docs/runbook/sp217-quiz-records-cutover.md`. Rationale: the cutover spans (migration + 3-service redeploy + live E2E), which is broader than the generic `db-migration.md` (general backup/timeout/rollback). Link the two with cross-references.

### D2. Codify redeploy (initContainer auto-migration) as the primary path

The runbook documents **identity rollout = automatic migration** as the primary path and `kubectl exec ... migration:run` as a verification/fallback path. It corrects the recurring "manual migration:run" framing to match reality.

### D3. Live E2E is done as a logged-in user (accuracy finding)

Because `/quiz` is **not** in the `PUBLIC_PATHS` of `frontend/src/middleware.ts`, it is an auth-gated route (entered via the AppLayout Brain menu after login). The `/quiz → /login` 307 for unauthenticated access is **correct behavior**, not a "not deployed" signal. Therefore the live E2E checklist targets the **logged-in server persistence** that SP217 added. The localStorage fallback is a frontend fallback, not a live anonymous-access mode.

## Implementation

### Artifacts

| File | Content |
|---|---|
| `docs/runbook/sp217-quiz-records-cutover.md` (new) | §0 key facts (initContainer auto-migration, no timeout risk, merge≠live, 3 services) / §1 preconditions / §2 backup / §3 identity rollout + migration verification / §4 gateway+frontend rollout / §5 rollback / §6 6-item live E2E / §7 follow-up |
| `docs/adr/sprints/sprint-220.md` (new) | KR record of the cutover guide decision, initContainer finding, execution carryover |
| `docs/adr-en/sprints/sprint-220.md` (new, this doc) | English SSOT |
| `docs/adr/README.md` | sprint ADR count 157→158, range 62~219→62~220 |
| `docs/runbook/db-migration.md` | cross-reference to the SP217 cutover runbook |

### Verified API contract (runbook E2E accuracy)

- **Frontend → Gateway BFF**: `GET /api/quiz-records` (my best list), `POST /api/quiz-records` body `{category, difficulty, scorePercent, playedAt}`. Cookie auth → JWT middleware injects X-User-ID.
- **Gateway → Identity internal**: X-Internal-Key. `POST /api/quiz-records` (upsert, `{data}` wrapped), `GET /api/quiz-records/by-user/:userId`.
- Allowed values: `category ∈ {DATA_STRUCTURE, ALGORITHM, NETWORK, OS, DATABASE}`, `difficulty ∈ {ALL, EASY, MEDIUM, HARD}`, `scorePercent 0–100`, `playedAt` ISO8601.
- Deployment names: Deployment `identity-service` (containers `db-migrate` + `identity-service`), `gateway`, `frontend`. identity_db lives in the `postgres` instance (superuser `algosu_admin`).

## Verification

- docs-only — no code/schema/bundle change.
- ADR gates: index count (sprint 158, --strict) / adr-en coverage (sprint-220 EN exists, --strict) / adr-links 0 broken / doc-refs no broken.
- Runbook internal relative link (`db-migration.md`) validity.

## Lessons

1. **When the redeploy includes the migration, "manual migration:run" is the wrong carryover framing** — for services using the initContainer pattern (`db-migrate`), the rollout *is* the migration. Checking the deploy mechanism (initContainer vs manual Job) before writing carryover wording avoids instructing ops to perform an unnecessary manual step.
2. **A migration's risk tier depends on the target table's state** — a `CREATE TABLE` on a new empty table carries no timeout risk, so copy-pasting the SP196 GIN index `SET statement_timeout=0` procedure would be overkill. Differentiate the procedure per migration by judging whether it triggers a rewrite.
3. **Live verification scenarios must first confirm the route's protection level** — not knowing that `/quiz` is auth-gated (not in `PUBLIC_PATHS`) leads to putting "guest anonymous play" into the live E2E and forming a wrong expectation (mistaking the 307 for a bug). The middleware's public-path list is a precondition of the E2E scenario.
4. **Even non-executable work advances a carryover when produced as an accurate, executable procedure** — without ops access we cannot execute directly, but a runbook with exact API paths, deployment names, and verification queries leaves the carryover in a ready-to-run state.

New pattern: none (applies the existing runbook-authoring pattern).

## Sprint 221+ Carryover

- **(Ops execution) Roll out identity → gateway → frontend per this runbook + verify the 6-item live `/quiz` E2E** (user/ops, important): the runbook fixes the procedure, but actual execution/verification needs ops access. On completion, remove the carryover from sprint-window and MEMORY.
- GA4 admin (stream URL, history page_view OFF, production UAT) — user-direct.
- Ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- Harness checkup `--full` CI scheduled automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

(The Codex cross-review result is recorded in this section in Wave C.)
