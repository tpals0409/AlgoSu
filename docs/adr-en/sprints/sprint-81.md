---
sprint: 81
title: "Dev Server Migration — k3d Cluster Synchronization"
date: "2026-04-13"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 81: Dev Server Migration — k3d Cluster Synchronization

## Decisions

### D1: kube-state-metrics New Deployment (Base Manifest)
- **Context**: `kube-state-metrics:8080` scrape target is defined in Prometheus config, but the manifest for this resource was missing, causing scrape failures on both OCI and dev.
- **Choice**: Created new Deployment/Service/ServiceAccount/ClusterRole/ClusterRoleBinding in `infra/k3s/kube-state-metrics.yaml`. Resource savings via `--namespaces=algosu` restriction.
- **Alternatives**: (a) Install via Helm chart — inconsistent with kustomize-based operations, rejected. (b) Remove the scrape target entirely — makes k8s resource metrics collection (HPA/PDB, etc.) impossible, rejected.
- **Code Paths**: `infra/k3s/kube-state-metrics.yaml`, `infra/k3s/kustomization.yaml`, `infra/k3s/metrics-network-policy.yaml`

### D2: Remove stateful service securityContext in dev overlay
- **Context**: k3d's local-path provisioner doesn't properly support fsGroup, causing postgres/rabbitmq/minio pods with `securityContext.fsGroup: 999` to fail startup with permission errors after PVC mount.
- **Choice**: Use JSON Patch in `infra/overlays/dev/kustomization.yaml` to remove pod-level securityContext for postgres, postgres-problem, minio, and rabbitmq. Run with image default uid.
- **Alternatives**: (a) chown with initContainer — pod-level `runAsNonRoot: true` blocks root initContainer, rejected. (b) Remove securityContext from base — weakens production (OCI) security, rejected.
- **Code Paths**: `infra/overlays/dev/kustomization.yaml`

### D3: Dev overlay readinessProbe /health → fallback
- **Context**: Current `:dev` images have `/health/ready` endpoint either unimplemented (404) or blocked by Gateway authentication middleware (401). readinessProbe failures keep pods permanently Not Ready.
- **Choice**: Patch readinessProbe path to `/health` for 5 app services in dev overlay.
- **Code Paths**: `infra/overlays/dev/kustomization.yaml`

## Patterns

### P1: dev overlay JSON Patch Pattern for k3d Compatibility
- **Where**: `infra/overlays/dev/kustomization.yaml` patches section
- **When to Reuse**: When base manifest production settings are incompatible with k3d/local environments. Selectively remove/modify securityContext, readinessProbe, imagePullSecrets, etc. in dev overlay while keeping base unmodified.

## Gotchas

### G1: k3d local-path Provisioner + fsGroup Incompatibility
- **Symptom**: postgres, minio, rabbitmq pods crash with `data directory has wrong ownership`, `file access denied` errors after PVC mount — CrashLoopBackOff.
- **Root Cause**: local-path provisioner creates files as root (GID 0) when provisioning volumes, and kubelet's recursive fsGroup chown doesn't work properly.
- **Fix**: Remove pod securityContext in dev overlay. Running with image default uid (postgres=999, minio=1000) allows initdb to function normally.

### G2: Secret Mismatch After problem-service DB Separation
- **Symptom**: problem-service init container gets `ECONNREFUSED` — NetworkPolicy blocking access to postgres (main).
- **Root Cause**: `problem-service-secrets.DATABASE_HOST` still points to `postgres` (main), but `problem-policy` NetworkPolicy only allows egress to `postgres-problem`. Secret not updated after DB separation completed.
- **Fix**: Update `problem-service-secrets.DATABASE_HOST` to `postgres-problem` and sync password with `postgres-problem-secret`.

## Metrics
- Commits: 1 (515c817)
- Files changed: 4 (+226/-0)
- Cluster state: 18 pods Running, HPA 3, PDB 3, NetworkPolicy 19, kube-state-metrics scrape up
