---
topics:
  - cicd
---
# ADR-029: Consolidate Infra Deployment Definition SSOT into aether-gitops (Retire AlgoSu Parallel Manifests)

- **Status**: Accepted
- **Date**: 2026-06-09
- **Sprint**: Sprint 234
- **Decision maker**: Oracle
- **User request**: 2026-06-09 "the root-cause fix" + "resolve the root cause while maximizing stability"
- **Related**: ADR-027 (aether-gitops branch discipline), ADR-028 (dev cluster separation), ADR-026 (incident roundup)

---

## Context

The surface task was "verify the loki Deployment hardening gap," but a three-way comparison (live / gitops / mirror) showed the hardening gap was already resolved; the real problem was structural and deeper.

### Root cause: one system with two sources of truth (SSOT)

- **Operational SSOT**: aether-gitops (`algosu/base/` + `algosu/overlays/prod/`) — only this is synced by ArgoCD
- **Parallel definition**: AlgoSu repo's `infra/k3s/` (its own kustomize base) + `infra/overlays/{dev,staging,prod}/` + `scripts/deploy.sh`

The two definitions were edited independently by humans and inevitably diverged. `infra/k3s/monitoring` was a chronic-debt "mirror" repeatedly hand-reconciled (git log shows recurring "mirror drift realign" commits).

### Real symptoms produced by the divergence (verified)

- **prometheus-rules.yaml**: mirror 214 lines (old) vs aether 297 lines (canonical) — the mirror was actually stale
- **grafana.yaml**: mirror had hardening (securityContext/probe), aether/live did not — opposite direction from loki
- **grafana-cb-dashboard.yaml**: present only in mirror + CI, absent from aether/live — the circuit breaker dashboard was permanently unshipped
- **CB alert schema bug**: the live `CircuitBreakerOpen` (severity: critical) rule was pinned to `== 1` (HALF_OPEN) and never fired on the actual OPEN (=2) state — an availability blind spot. Only the mirror held the correct `== 2` fix.

"Auto-syncing the mirror" is merely a workaround that aligns the two definitions one-way; as long as the second definition exists, the possibility of divergence remains forever.

## Decision

**Consolidate the k8s manifest SSOT into aether-gitops alone, and retire the parallel manifest definitions in the AlgoSu repo.**

1. **Absorb then retire**: absorb the genuine improvements that existed only in the mirror (CB bug fix, grafana hardening/probe/readOnlyRootFS, cb dashboard, datasources uid) into aether-gitops, then delete `infra/k3s/` + `infra/overlays/`.
2. **Switch deploy.sh to an aether basis**: the emergency-recovery script clones aether-gitops and applies `kubectl apply -k overlays/prod`. The recovery safety net is preserved without a parallel definition.
3. **Wire validation directly to the SSOT**: monitoring validation scripts (`check-prometheus-rules.mjs`, `check-grafana-metrics.mjs`) read aether-gitops directly via the `MONITORING_SRC` env. CI sparse-checks out aether and injects the path.
4. **Resolve incidental debt found**: add a configmap-reload sidecar to prometheus (automatic rule reload), set grafana strategy Recreate (avoid PVC multi-attach).
5. **Preserve**: postgres-init is mounted by local dev (docker-compose.dev.yml), so it is relocated to `infra/postgres-init/`. The `infra/sealed-secrets/` templates/docs are kept.

## Consequences

### Positive
- Structurally removes the drift source — the editable source of truth converges to one (aether-gitops)
- "Validation and deployment see the same source" — CI monitoring validation gates the operational SSOT directly
- Resolves a latent operational bug (CB alert never firing) and an omission (cb dashboard)
- Eliminates the double-maintenance cost (manual mirror reconciliation)

### Negative / trade-offs
- AlgoSu CI can no longer detect aether-gitops manifest changes → manifest-validation responsibility must move to the aether-gitops side (follow-up)
- postgres-init persists as two copies, in dev (AlgoSu) and ops (aether)

## Alternatives

- **Auto-derive the mirror (read-only artifact)**: keep the parallel tree but have CI machine-generate it from aether. Prevents divergence but the dual structure and maintenance cost remain — rejected.
- **Partial sync of monitoring only**: not a root fix; the remaining parallel tree could still diverge — rejected.

## Follow-ups

- Port the code↔dashboard cross-check job into the aether-gitops repo (make manifest validation an SSOT)
- A consistency lint for the dev/ops copies of postgres-init
- grafana admin user/email is not absorbed (login-behavior change risk + no value); retire it. Introduce separately via SealedSecret if ever needed.
- Bulk-clean historical `infra/k3s` references in runbooks (monitoring-system-audit, gitops-migration, oncall-alerts, sp217, etc.)

### Mirror-only, never-applied definitions (absent from both ops and aether)

Definitions that existed only in the mirror and were never applied to production — "authored but never propagated to the SSOT" debt created by the parallel definition.

- **PDB** (gateway/identity/submission, minAvailable:1): absorbed into aether in this work — low-risk availability improvement
- **HPA** (gateway/submission/ai-analysis, CPU 70%): replicas ownership change (fixed → autoscale) + overlays patch adjustment + metrics-server dependency → **deferred to a separate validated task**
- **demo-reset CronJob** (DB seed every 6h): `postgres-credentials` secret dependency + production data impact to review → **deferred**
- **NetworkPolicy** (default-deny/metrics/service): traffic-block outage risk → introduce separately after a service-to-service traffic-matrix validation
- Deferred definitions are preserved in git history (the commit just before this PR)
