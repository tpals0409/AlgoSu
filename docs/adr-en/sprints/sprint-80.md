---
sprint: 80
title: "Monitoring 1033 Error Resolution"
date: "2026-04-10"
status: completed
agents: [Oracle, Architect, Scout, Scribe]
related_adrs: ["sprint-69"]
---

# Sprint 80: Monitoring 1033 Error Resolution

## Decisions

### D1: Zero-downtime Deployment with blog Deployment preStop Hook
- **Context**: Cloudflare Error 1033 recurred on blog.algo-su.com. Sprint 69 resolved the same error due to missing cloudflared `--metrics` flag, but this time the cloudflared pod itself was normal (Running, 0 restarts, `--metrics 0.0.0.0:2000` applied). Root cause was: during ArgoCD rolling update in a replicas=1 environment, old pod readiness probe failure → Service endpoint gap → cloudflared receiving upstream 502 → Cloudflare 1033 propagation.
- **Choice**: Add `preStop: exec: command: ["sh", "-c", "sleep 5"]` lifecycle hook to blog Deployment spec. Old pod continues serving traffic for 5 seconds after receiving SIGTERM, eliminating the endpoint gap until the new pod reaches Ready state.
- **Alternatives**: (a) Scale to replicas=2 — OCI ARM resource limits (24GB memory, 6 services + monitoring running) make maintaining 2 replicas costly, rejected. (b) Apply only `maxSurge=1, maxUnavailable=0` strategy — already default but does not prevent endpoint gap on readiness failure, rejected. (c) Recreate strategy — allows intentional downtime, rejected.
- **Code Paths**: `infra/k3s/blog.yaml` (or corresponding aether-gitops manifest)

## Patterns

### P1: Zero-downtime Rolling Update Pattern for replicas=1 Services
- **Where**: blog Deployment `spec.template.spec.containers[].lifecycle.preStop`
- **When to Reuse**: When traffic interruption during rolling update needs to be prevented in a Deployment with replicas=1. Core mechanism: (1) Start new pod first with `maxSurge=1, maxUnavailable=0`, (2) Apply `preStop: sleep N` to old pod (N = new pod readiness time + buffer) to maintain traffic serving for a period after SIGTERM. `terminationGracePeriodSeconds` must be greater than or equal to the preStop sleep time.

## Gotchas

### G1: Endpoint Gap Can Occur Even with replicas=1 + maxUnavailable=0 Due to Readiness Failure
- **Symptom**: Cloudflare Error 1033 recurred on blog.algo-su.com after blog image deployment (commit 7fe12ea). cloudflared pod is running normally.
- **Root Cause**: During rolling update, when kubelet sends SIGTERM to old pod (blog-65869f5699), readiness probe immediately fails with `connection reset by peer`. kube-proxy removes old pod from endpoints, but new pod (blog-64998d8b9f) is not yet Ready. As a result, blog Service endpoints drop to 0, cloudflared receives upstream 502, and Cloudflare returns Error 1033.
- **Fix**: `preStop: exec: command: ["sh", "-c", "sleep 5"]` delays old pod process termination for 5 seconds after SIGTERM. During these 5 seconds, old pod is still serving traffic and passing readiness probes, so no endpoint gap occurs until new pod is Ready.

### D2: Monitoring Tunnel cloudflared Connector Recovery
- **Context**: Cloudflare Error 1033 occurring on monitoring.algo-su.com. Tunnel `05b4b0d6` has a Public Hostname registered, but the corresponding cloudflared connector (pod) is absent from the cluster. Existing cloudflared Deployment connects only to tunnel `47de6ba1` (for blog).
- **Choice**: Create a new `cloudflared-monitoring` Deployment to restore the connector for tunnel `05b4b0d6`. Operate separately from the existing blog tunnel.
- **Alternatives**: (a) Consolidate both domains into a single tunnel — requires tunnel reconfiguration in Cloudflare dashboard + DNS CNAME changes, risk of service interruption during operation, rejected.
- **Code Paths**: `infra/k3s/cloudflared-monitoring.yaml`

## Metrics
- Commits: 2 (46e4525, 6b2063e)
- Files changed: 3 (+98/-0)
- Service impact: blog.algo-su.com — Error 1033 prevented during rolling update, monitoring.algo-su.com — Grafana access restored
