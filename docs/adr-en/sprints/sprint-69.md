---
sprint: 69
title: "cloudflared Hotfix + GitOps Consistency Improvement"
date: "2026-04-09"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 69: cloudflared Hotfix + GitOps Consistency Improvement

## Decisions

### D1: Keep cloudflared hotfix as direct AlgoSu apply, defer GitOps migration
- **Context**: blog.algo-su.com inaccessible due to Cloudflare Error 1033. During root cause investigation, discovered cloudflared is not under ArgoCD management (only `kubectl.kubernetes.io/last-applied-configuration` exists, no ArgoCD tracking-id). Decision needed: proceed with GitOps migration simultaneously, or apply hotfix first.
- **Choice**: Apply hotfix immediately with `kubectl apply` while keeping `AlgoSu/infra/k3s/cloudflared.yaml` path as-is. GitOps migration (69-2), tag pinning (69-3), and orphan manifest cleanup (69-4) are deferred.
- **Alternatives**: (a) Hotfix + GitOps migration simultaneously — rejected due to extended service downtime risk. (b) Apply only `kubectl edit` directly to cluster — rejected due to drift from source files.
- **Code Paths**: `infra/k3s/cloudflared.yaml`

## Patterns

Not applicable (single flag addition hotfix)

## Gotchas

### G1: cloudflared `--metrics` must be explicitly specified — liveness probe port alignment required
- **Symptom**: cloudflared pod accumulated 427 CrashLoopBackOff cycles over 28 hours. Each cycle: pod starts for ~88 seconds then terminates with `Initiating graceful shutdown due to signal terminated` log. Intermittent Cloudflare Error 1033 (Argo Tunnel error) appearing on blog.algo-su.com.
- **Root Cause**: No `--metrics` flag in Deployment args, so cloudflared binds metrics/ready endpoint to random port (actual measured: `[::]:20241`). However `livenessProbe.httpGet.port: 2000` is fixed, causing probe failure with `dial tcp 10.42.0.216:2000: connection refused` for 1275 times → kubelet sends SIGTERM after 3 failures → container exits normally with code 0 → CrashLoopBackOff backoff loop.
- **Fix**: Add `- --metrics` / `- 0.0.0.0:2000` at the beginning of `args`. After redeployment, confirmed `Starting metrics server on [::]:2000/metrics` in logs, new pod `Running 1/1` maintained, restarts 0, blog.algo-su.com HTTP 200 recovered.

### G2: Don't only check Ingress when verifying external domain routing
- **Symptom**: No blog route in `kubectl get ingress` results during CD deployment verification, momentarily misunderstood as "blog not exposed externally".
- **Root Cause**: Blog service bypasses Ingress — `algosu/cloudflared` pod delivers directly to in-cluster `blog` Service (ClusterIP) via Cloudflare Tunnel (QUIC). No trace in Ingress.
- **Fix**: When verifying external domain response: (1) confirm tunnel pod with `kubectl get pods | grep cloudflared`, (2) verify HTTP response with actual `curl -sSI https://<domain>/`, (3) check routing path via Cloudflare Zero Trust dashboard. Record blog domain and routing mechanism in `reference_domain.md` to prevent recurrence.

### G3: cloudflared outside GitOps management — drift detection not possible
- **Symptom**: `kubectl -n argocd get application algosu` shows `Synced / Healthy`, but cloudflared was in CrashLoop state without `--metrics` flag for 28 hours. ArgoCD did not report this issue.
- **Root Cause**: cloudflared Deployment was applied directly with `kubectl apply -f AlgoSu/infra/k3s/cloudflared.yaml`, not under ArgoCD tracking. A separate orphan manifest `algosu/base/monitoring/cloudflared.yaml` exists in aether-gitops but is not referenced in overlays/prod kustomization and is ignored.
- **Fix**: (Deferred) In 69-2, migrate cloudflared to aether-gitops base and include in overlays/prod resources. Then delete `AlgoSu/infra/k3s/cloudflared.yaml`, clean up (or promote to SSoT) `aether-gitops/algosu/base/monitoring/cloudflared.yaml`. After migration, ArgoCD Health can report drift/failures.

## Metrics
- Commits: 1 (49b719a)
- Files changed: 1 (+4/-0)
- Service impact: blog.algo-su.com — restored from intermittent Error 1033 (28h) to HTTP 200 always responding
- Deferred tasks: 3 (69-2 GitOps migration, 69-3 tag pinning, 69-4 orphan manifest cleanup)
