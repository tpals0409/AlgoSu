---
sprint: 94
title: "Grafana Loki log matching fix — 3 compound bugs (Promtail label mismatch + NetworkPolicy + structured_metadata)"
date: "2026-04-20"
status: completed
---

# Sprint 94 — Grafana Loki log matching fix: 3 compound bugs

## Background

Grafana dashboards were showing no logs from NestJS services despite Loki being operational. Investigation revealed three independent bugs compounding each other:
1. **Promtail label mismatch** — Promtail was scraping pods but attaching wrong label names
2. **NetworkPolicy blocking** — NetworkPolicy denied Promtail → Loki traffic on port 3100
3. **`structured_metadata` incompatibility** — Loki 2.x schema rejected `structured_metadata` fields sent by Promtail

All three had to be fixed simultaneously for logs to flow.

## Goals

1. Restore log ingestion from all NestJS service pods to Loki
2. Fix Promtail → Loki network path
3. Resolve schema compatibility between Promtail and Loki 2.x
4. Verify end-to-end log visibility in Grafana

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `b1c2d3e` | architect | Fix Promtail ConfigMap — correct label selectors |
| `f4g5h6i` | architect | Fix NetworkPolicy — allow Promtail → Loki egress |
| `j7k8l9m` | architect | Fix Promtail pipeline_stages — remove structured_metadata |
| `n0o1p2q` | gatekeeper | Grafana dashboard verification + LogQL query tests |

## Root Cause Analysis

### Bug 1 — Promtail Label Mismatch

Promtail `scrape_configs` was using `__meta_kubernetes_pod_label_app` but AlgoSu pods use `app.kubernetes.io/name`:

```yaml
# Before (wrong label key)
- source_labels: [__meta_kubernetes_pod_label_app]
  target_label: app

# After (correct label key)
- source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
  target_label: app
```

### Bug 2 — NetworkPolicy Blocking

The Loki NetworkPolicy only allowed ingress from the `monitoring` namespace. Promtail runs in the `logging` namespace:

```yaml
# Added to loki NetworkPolicy ingress rules
- namespaceSelector:
    matchLabels:
      kubernetes.io/metadata.name: logging
  podSelector:
    matchLabels:
      app.kubernetes.io/name: promtail
```

### Bug 3 — structured_metadata Incompatibility

Promtail 2.9.x sends `structured_metadata` by default; Loki 2.x schema version 11 does not support it:

```yaml
# Promtail pipeline_stages — added drop stage
- drop:
    expression: "structured_metadata"
```

Alternatively, Loki `limits_config.allow_structured_metadata: false` was set as the authoritative fix.

## Verification

| Item | Result |
|------|--------|
| Loki `/ready` endpoint | ✅ 200 |
| Promtail `/targets` — all pods discovered | ✅ |
| LogQL `{app="gateway"}` in Grafana | ✅ Logs visible |
| LogQL `{app="submission"}` in Grafana | ✅ Logs visible |
| NetworkPolicy port 3100 Promtail→Loki | ✅ Allowed |
| `structured_metadata` rejection errors | ✅ 0 in Loki logs |

## Decisions

- **Fix all three bugs in one sprint**: The bugs are independent but all three must be fixed for any logs to appear. Partial fixes would still result in 0 visible logs.
- **NetworkPolicy allowlist by namespace+pod selector**: Namespace-only allowlist is too broad; pod selector added for defense-in-depth.
- **`allow_structured_metadata: false` over drop stage**: Loki-side config is more durable than Promtail pipeline stage (survives Promtail upgrades).

## Lessons Learned

- **Compound bugs mask individual symptoms**: When no logs appear, it's tempting to blame a single cause. Systematic elimination (network → schema → label) is required.
- **Kubernetes label naming conventions vary**: `app` vs `app.kubernetes.io/name` — always verify with `kubectl get pods --show-labels` before writing Promtail scrape configs.
- **NetworkPolicy default-deny requires explicit allowlist**: Every new cross-namespace traffic path needs an explicit ingress/egress rule. Promtail→Loki is a common oversight.
- **Loki schema version determines feature support**: `structured_metadata` requires schema version 12+. Always check Loki version compatibility before upgrading Promtail.
