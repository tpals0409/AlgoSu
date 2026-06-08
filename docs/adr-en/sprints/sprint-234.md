---
sprint: 234
title: "Monitoring Drift Cleanup (Grafana no-data + argocd metrics + promtail/loki SSOT alignment)"
date: "2026-06-08"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-231", "sprint-232", "sprint-233"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra"]
tldr: "Three panels (Container CPU/Memory, two Loki log panels) of the live Grafana 'AlgoSu Service Debug' dashboard showed no-data. Live diagnosis confirmed two root causes: (A) Prometheus had no kubelet/cAdvisor scrape_config → container_* metrics entirely uncollected (0 series). (B) Live promtail emits a service label while the dashboard referenced a nonexistent pod label → log panels always 0. Fixed live first via aether-gitops PR #8 (+0a7156d): merged, ArgoCD Synced, live 3-way verification passed (container_* 75 series, log panels streaming). This sprint aligns the non-deployed reference mirror infra/k3s/monitoring to the final live form: prometheus-config gains kubernetes-cadvisor/nodes jobs (via apiserver proxy) + SA/ClusterRole/CRB, dashboard $service variable values unified to the Loki service label, Loki panels use service= selectors, job=~ at 12 sites, and promtail aligned to emit the service label (Critic R1 P2). Gate check-grafana-metrics passes. Critic R1 [P2] (mirror promtail missing service label) → R2 CLEAN. During the sprint the same monitoring-drift cleanup expanded: AlgoSu #414 (argocd-metrics/argocd-server-metrics scrape jobs + revisionHistoryLimit 10→5) and #415 (promtail kubernetes_sd→static_configs full SSOT replacement + loki allow_structured_metadata false→true paired alignment), plus server aether-gitops #8 (live no-data), #9 (CB panel stale fix + revisionHistoryLimit, ReplicaSet 126→73), #10 (cloudflared-monitoring GitOps adoption), and curl-test pod cleanup, completed in parallel."
---
# Sprint 234 — Monitoring Drift Cleanup (Grafana no-data + argocd metrics + promtail/loki SSOT alignment)

## Goal

- Diagnose and fix the no-data state of three panels (Container CPU/Memory, two Loki log panels) on the live Grafana "AlgoSu Service Debug" dashboard.
- After the live (aether-gitops) fix, align the non-deployed reference mirror `infra/k3s/monitoring` to the final live form to prevent drift.

## Background

- The user reported no-data on the CPU/Memory/Loki panels of the live dashboard. `infra/k3s` is a non-deployed reference mirror and the deployment SSOT is aether-gitops (confirmed Sprint 232) → do not conclude runtime defects from static manifests; run live diagnosis first ([[feedback-source-vs-live-drift]]).

## Root Cause (live diagnosis)

- **(A) cAdvisor metrics uncollected**: `container_cpu_usage_seconds_total` returned 0 series namespace-wide. Live Prometheus also used only `static_configs`, with no kubelet/cAdvisor/`role:node` targets. kube-state-metrics only provides `kube_*` object state (≠ container resource usage). → data-source (collection) defect.
- **(B) Loki label model mismatch**: logs were collected fine (`{namespace="algosu"}` = 6 streams). Live promtail emits a `service` label (values: gateway/submission/problem/identity/ai-analysis/github-worker) but the dashboard referenced a nonexistent `pod` label → always 0. Variable value (submission-service) also differed from the service label value (submission). → dashboard-query defect.

## Key Decisions

1. **Fix live first (aether-gitops PR #8)**: (A) `kubernetes-cadvisor`/`kubernetes-nodes` jobs (apiserver proxy `/api/v1/nodes/${node}/proxy/metrics[/cadvisor]`) + prometheus SA/ClusterRole (nodes/nodes-metrics/nodes-proxy + nonResourceURLs)/CRB. (B) unify the $service variable values to the Loki service label values and map per-panel selectors: Loki `service="${service}"`, Prometheus `job=~"${service}.*"` (submission→submission-service prefix match), cAdvisor/KSM `pod=~"${service}.*"` kept.
2. **Block id19 Error Logs dead branch (Critic, live PR)**: the server's draft `|= "error" | json | level=~"error|fatal|CRITICAL"` re-introduced the dead branch removed in Sprint 231 (promtail promotes the level label → json re-parse unnecessary and conflicts via level_extracted; fatal/CRITICAL never emitted; `|=` matches body coincidences) → corrected to `service="${service}", level="error"` direct level-label filter. Live level values = debug/error/info/warn empirically confirm the dead branch.
3. **Mirror alignment scope (this sprint)**: the gate `check-grafana-metrics.mjs` silently skips Loki selectors and container_* panels via `ALWAYS_AUTO_LABELS` (includes service/pod/job) → promtail alignment is not required for the gate. However, to address Critic R1 P2 (mirror internal consistency: dashboard service= ↔ promtail missing service label), promtail was also aligned to the live label model.

## Work Summary (start `9f844db`, 3 commits)

- `6a47973`: `fix(infra)` prometheus-config cadvisor/nodes jobs + SA/ClusterRole/CRB + serviceAccountName / grafana-service-dashboard variable shortening, Loki service=, job=~ at 12 sites, header comment / promtail drift banner.
- `ea54009`: `fix(infra)` mirror promtail service-label alignment (Critic R1 P2) — extract & promote the JSON service field, drop pod/app/container labels (unnecessary after the dashboard's service switch + cardinality reduction), label set namespace+service+level+tag (4).
- ADR commit (this doc) + README 171→172.

## Verification

- Replacement counts: `job=~"${service}.*"` 12, remaining `pod=~"${service}.*"` 3 (KSM/cAdvisor×2), Loki `service="${service}"` 2, non-regex `job="${service}"` 0.
- YAML valid (3 files) + embedded dashboard JSON parses OK (20 panels, uid algosu-service-debug), variable values [gateway,submission,problem,identity,ai-analysis,github-worker].
- promtail label set namespace+service+level+tag = 4 (≤5 guidance), service = SERVICE_NAME short form (confirmed by grep across services).
- Gate `check-grafana-metrics.mjs` all [OK]. `check-prometheus-rules.mjs` validates rules.yaml (unchanged) → unaffected.
- **Live evidence (aether-gitops, preceding this sprint)**: cadvisor/nodes targets UP, `container_*{namespace=algosu}` 75 series (was 0), id18 gateway/problem/submission 2/2/2, id19 problem level=error 2.
- **Critic** (Codex gpt-5.5, `--base 9f844db`): R1 [P2] mirror promtail missing service label → `ea54009` aligned → **R2 CLEAN** ("no discrete regression... label changes consistent with service names emitted by structured loggers and metric job mappings").

## Lessons

1. **Do not conclude runtime defects from a static mirror; run live diagnosis first** — drift between the non-deployed mirror (infra/k3s) and the deployment SSOT (aether-gitops) is persistent. Both root causes were confirmed by live measurement ([[feedback-source-vs-live-drift]]).
2. **`container_*` comes from cAdvisor (kubelet) — kube-state-metrics ≠** — KSM only provides `kube_*` object state. CPU/Memory no-data commonly stems from a missing kubelet/cAdvisor scrape_config (via apiserver proxy).
3. **When a dashboard variable maps to multiple label dimensions, unify a single value + regex prefix matching** — unify $service to the Loki service label value and absorb Prometheus via `job=~"x.*"` and pods via `pod=~"x.*"` (resolving submission↔submission-service mismatch).
4. **Mirror alignment is not done at gate-pass — internal consistency (Critic)** — the gate skips service/pod as auto-labels, but dashboard service= with no producing promtail label yields empty panels on apply. The mirror must also adopt the live label model (service promotion) to be complete.
5. **Prevent id19 dead-branch regression** — re-applied the Sprint 231 lesson (direct level-label filter > json re-parse) during the live PR review, empirically confirming fatal/CRITICAL are never emitted via live level values.

New pattern: **fix-live-first → align-mirror-after** (verify the deployment SSOT live, then align the non-deployed mirror to the same form, double-checking via gate + Critic internal consistency).

## Appendix: Additional same-sprint work (monitoring drift cleanup expansion)

After #413 (main body), the same monitoring-drift cleanup expanded into 2 AlgoSu mirror PRs + 3 server aether-gitops PRs:

### AlgoSu mirror (this repo)
- **#414 (`317de34`)**: residual mirror drift — added `argocd-metrics`/`argocd-server-metrics` scrape jobs (already present live, Sprint 130 B-1) + kustomize patch setting all Deployments' `revisionHistoryLimit` 10→5 (blocks unused ReplicaSet accumulation, aligns aether-gitops #9).
- **#415 (`8ef4edf`)**: full promtail SSOT alignment — replaced `kubernetes_sd(role:pod)` with `static_configs` (removed DaemonSet HOSTNAME env, `-config.expand-env`, etc., −60/+12) + restored `traceId` as structured_metadata + **loki-config `allow_structured_metadata` false→true** (the paired setting required for promtail structured_metadata to work). Measured: live promtail-config == gitops. **The #413 dashboard `service=` selector stays consistent since the SSOT promtail emits the same `service` label (no regression)**. → resolves the Sprint 234 carryover "promtail discovery alignment."

### Server aether-gitops (deployment SSOT, live)
- **#8**: live Grafana no-data fix (matches #413) — container metrics 75 series, targets UP.
- **#9**: Circuit Breaker panel stale fix + `revisionHistoryLimit:5` — CB 0/1/2 reflected, ReplicaSet 126→73.
- **#10**: cloudflared-monitoring GitOps adoption — tunnel healthy.
- (direct) curl-test pod cleanup.

## Carryover

- **(server) back-port loki Deployment hardening — gap confirmed**: #415 measurement found loki `securityContext` (runAsNonRoot/readOnlyRootFS) + liveness/readiness probes exist **only in the mirror, absent in gitops/live**. The Sprint 231/232 D1 (loki prod hardening gap) is now confirmed → back-port the mirror's loki hardening into aether-gitops (mirror→SSOT direction).
- (existing carryover) ADR-028 SA application/token issuance · Sprint 230 rollout check · live /quiz verification · SP217 cutover · GA4 · problem_db · harness cron.
- ~~promtail discovery alignment~~ → **resolved by #415**.
