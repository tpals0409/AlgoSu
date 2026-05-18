---
sprint: 81
title: "Monitoring Dashboard Refactoring"
date: "2026-04-10"
status: completed
agents: [Oracle, Architect, Scout, Scribe]
related_adrs: ["sprint-80"]
---

# Sprint 81: Monitoring Dashboard Refactoring

## Decisions

### D1: Achieve DRY with Alert Rule Recording Rules
- **Context**: HighErrorRate 4, HighMemoryUsage 4, HighLatencyP95 2 existed as copy-paste duplicates differing only in service name. Every time a new service is added, a new rule must be copied with risk of omission.
- **Choice**: Introduced recording rules (`algosu:http_error_rate:5m`, `algosu:memory_usage_pct`) + consolidated into single regex-based alert. 10 alerts → 5 alerts + 2 recording rules = 7 total.
- **Alternatives**: (a) Keep existing copy-paste — risk of omission when adding services, rejected. (b) Switch to Grafana Managed Alerting — dual management with Prometheus rules, rejected.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`

### D2: Switch HighMemoryUsage to RSS/container limits Based Alert
- **Context**: heapUsed/heapTotal based alert was triggering false positives during V8's normal heap management pattern (89.2% firing, actual RSS 70MB/1Gi). Node.js V8 normally allocates a small heap and maintains high usage until GC runs.
- **Choice**: Changed to `process_resident_memory_bytes / kube_pod_container_resource_limits{resource="memory"}` basis. Dynamically references limits from kube-state-metrics.
- **Alternatives**: (a) Raise threshold to 95% — not a fundamental fix, rejected. (b) Use fixed value (1Gi) — inconsistent when limits change, rejected.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`, `infra/k3s/gateway.yaml`

### D3: Alertmanager Deployment Recovery + github-worker metrics Service Creation
- **Context**: Alertmanager Pod not deployed so all alerts were going to a blackhole. github-worker-metrics Service missing causing scrape failures. kube-state-metrics scrape config missing from ConfigMap.
- **Choice**: Deploy Pod with existing alertmanager.yaml, apply existing Service definition from github-worker.yaml, add kube-state-metrics job to prometheus-config.
- **Code Paths**: `infra/k3s/monitoring/alertmanager.yaml`, `infra/k3s/github-worker.yaml`, `infra/k3s/monitoring/prometheus-config.yaml`

## Patterns

### P1: Prometheus Recording Rule + Regex-Based Single Alert Pattern
- **Where**: `prometheus-rules.yaml` recording rule group `algosu.recording`
- **When to Reuse**: When applying the same metric pattern to multiple services. Auto-includes new services with `{__name__=~"algosu_.+_http_requests_total"}` regex.

## Gotchas

### G1: V8 heapUsed/heapTotal Ratio is Unsuitable as Memory Leak Indicator
- **Symptom**: Gateway HighMemoryUsage alert constantly firing (89.2%). Actual RSS is 70MB/1Gi (7%).
- **Root Cause**: V8 allocates a small heap (~51MB) when `--max-old-space-size` is not set and maintains high usage until GC runs. heapUsed/heapTotal is always near 80%+.
- **Fix**: Switched to RSS/container limits based alert + added `NODE_OPTIONS=--max-old-space-size=768`.

### G2: aether-gitops and Source Repo ConfigMap Mismatch
- **Symptom**: prometheus-config ConfigMap differed between cluster (aether-gitops) and source repo. alerting section, github-worker job, etc. were missing.
- **Root Cause**: aether-gitops sync was omitted when source repo was changed.
- **Fix**: Copy same file to aether-gitops after source repo change + commit/push. Register missing resources (grafana-service-dashboard, alertmanager) in kustomization.yaml.

## Metrics
- Commits: 2 (6dd91ed, b197297)
- Files changed: 6 (+66/-125)
- aether-gitops: 2 (4ca6f74 monitoring sync, bef7dc6 gateway NODE_OPTIONS)
- Carryover items: Anonymous access, Loki restart, Grafana upgrade, Promtail structured_metadata
