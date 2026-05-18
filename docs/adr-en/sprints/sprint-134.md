---
sprint: 134
title: "Carryover Item Processing (Continued) — revisionHistoryLimit Bulk Application + Meta Correction"
date: "2026-04-27"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["ADR-026", "ADR-028"]
---

# Sprint 134: Carryover Item Processing (Continued)

## Sprint Goal

Process the actionable items in this repo from Sprint 133 carryover operational debt + meta correction. Close 2 items from Sprint 130 ADR-026 — C-1 (revisionHistoryLimit) and D-1 (E2E investigation) — and record lessons from the shell globbing misidentification pattern recurrence.

## Decisions

### D1: C-1 revisionHistoryLimit: 3 Bulk Application (Wave A)
- **Context**: `infra/DEPLOYMENT.md` L115 explicitly states `revisionHistoryLimit: 3` as OCI Free Tier policy. However, 8 Deployment yamls in `infra/k3s/` do not have this field applied — policy and actual manifests are diverged. Sprint 130 ADR-026 C-1 carryover item. Sprint 133 D4 post-hoc correction confirmed direct modification in this repo is possible.
- **Choice**: Bulk-added `revisionHistoryLimit: 3` at the `spec` level in 8 Deployment yamls (`ai-analysis-service`, `blog`, `frontend`, `gateway`, `github-worker`, `identity-service`, `problem-service`, `submission-service`). Overlays (dev/staging/prod) require no separate changes due to base Kustomize inheritance.
- **Verification**: `grep -r 'revisionHistoryLimit' infra/k3s/` 8/8 matches. Applied without downtime on ArgoCD sync (Deployment spec change with no pod template change → no rollout).
- **Code Paths**: `infra/k3s/ai-analysis-service.yaml`, `infra/k3s/blog.yaml`, `infra/k3s/frontend.yaml`, `infra/k3s/gateway.yaml`, `infra/k3s/github-worker.yaml`, `infra/k3s/identity-service.yaml`, `infra/k3s/problem-service.yaml`, `infra/k3s/submission-service.yaml`
- **PR**: [#166](https://github.com/tpals0409/AlgoSu/pull/166) (`95d4bd8`)

### D2: Sprint 133 ADR Carryover C-1 / D-1 Post-hoc Correction (Wave B)
- **Context**: C-1 and D-1 in the Sprint 133 ADR Carryover section were in incomplete (`[ ]`) state, but were actually processed in Sprint 134.
- **Choice**: Corrected 2 carryover items in `docs/adr/sprints/sprint-133.md` to `[x]`
  - **C-1**: Completed by direct modification of `infra/k3s/` in this repo, not an aether-gitops task.
  - **D-1**: `e2e-full.sh` 657 lines confirmed to exist (Sprint 133's "does not exist" conclusion was shell globbing misidentification — same pattern as `infra/` absence misidentification). `.github/workflows/ci.yml` workflow_dispatch is manual-only and operating normally. Auto PR CI integration reclassified as Sprint 135+ new seed.
- **Code Paths**: `docs/adr/sprints/sprint-133.md:73-74`
- **PR**: [#166](https://github.com/tpals0409/AlgoSu/pull/166) (`95d4bd8`)

## Patterns

### P1: Shell Globbing Misidentification → "Absent" Conclusion Pattern (Recurring Warning)
- **Where**: During Scout reconnaissance when `find`/`ls` results return empty array.
- **Pattern**: 2 recurrences in Sprint 133 — (1) `infra/` directory absence misidentification, (2) `e2e-full.sh` absence misidentification. Both returned empty results due to shell globbing / argument form issues → premature "file not found" conclusion.
- **Countermeasure**: Triple cross-verification required before concluding "absent" from `find` empty results: `ls -la <dir>` + `test -d <dir>` + `find <dir> -type f | head`. No absence conclusion from a single command result.
- **When to Apply**: Always when agents (Scout etc.) determine file/directory existence.

## Metrics

| Item | Value |
|------|-------|
| Total changes | +10 lines, -2 lines (9 files) |
| jest | No changes (only infra yaml modified, no test impact) |
| tsc | clean |
| lint | clean |
| Critic | Omitted (simple infra yaml field addition, 0 new logic — same policy as Sprint 131/132/133) |
| PR | [#166](https://github.com/tpals0409/AlgoSu/pull/166) `95d4bd8` |
| CI | 36 checks SUCCESS/SKIPPED, 0 failures, mergeStateStatus CLEAN |
| Merge | 2026-04-27 Squash merge `16794cd` |
| end_commit | `16794cd` |

## Carryover (Sprint 135+)

### New Seeds
- [ ] Circuit Breaker pattern introduction (estimated 1~1.5 week standalone sprint) — github-worker 5 locations (status-reporter/token-manager/worker → GitHub API) + submission 3 locations (saga-orchestrator/submission.service → Problem Service, AI Analysis Service). Reference ai-analysis Python implementation (`circuit_breaker.py`). Introduce opossum + Saga conflict verification + Prometheus metrics/Grafana dashboard.
- [ ] E2E auto PR CI integration — extend services containers in docker-compose.dev.yml + convert ci.yml to auto trigger. Cost/secrets management evaluation required first (current workflow_dispatch manual-only is an intentional policy).

### External Repo Branching (aether-gitops)
- [ ] ADR-027 implementation — aether-gitops branch discipline
- [ ] SealedSecret controller key rotation auto-resealing CI
- [ ] AlertManager receiver self-test rule

### Awaiting User Decision
- [ ] ADR-028 unapplied items — production cluster kubeconfig read-only separation + Claude Code execution environment migration decision
