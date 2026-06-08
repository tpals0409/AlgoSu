---
sprint: 231
title: "Full Monitoring System Audit + Log Collection Diagnosis + Alertmanager Discord Receiver Wiring"
date: "2026-06-08"
status: completed
agents: [Oracle, Explore, Librarian, Postman, Critic]
related_adrs: ["sprint-148", "sprint-191"]
related_memory: ["sprint-window"]
topics: ["observability", "monitoring", "logging", "alerting", "infra"]
tldr: "Audited the full AlgoSu observability stack (8 metric scrape jobs, 17 alert rules + 2 recording rules, 4 Grafana dashboards, Loki+Promtail logging, 8-dimension validation CI) and diagnosed the user's concern of 'service/error logs not being collected' by tracing the pipeline end to end. Conclusion: the logging pipeline is correctly wired at the static-config level (Promtail CRI+JSON → loki:3100; NetworkPolicy loki-ingress allows it and default-deny is Ingress-only so egress is unrestricted; Grafana loki uid consistent; level value lowercase-consistent across all services) → if logs are truly missing it is a runtime cause requiring live diagnosis (operator side). The real defect is the alert delivery path: alertmanager receiver='null' silently dropped all 17 rules, and the comment claiming 'switched to Identity webhook' was false (Identity discord is feedback-only). Per user decision, wired a real Alertmanager Discord receiver (discord_configs.webhook_url_file) + added ALERTMANAGER_DISCORD_WEBHOOK placeholder to monitoring-secrets (real seal is operator side). Fixed the Grafana Error Logs Only query's dead branches (level=~error|fatal|CRITICAL — no service ever emits fatal/CRITICAL) + fragile line filter into a direct level label filter. Fact-checked speculative gaps: github-worker-metrics Service exists (scrape valid), Identity discord=feedback, .bak files were git-untracked. Deliverable: docs/runbook/monitoring-system-audit.md (inventory + coverage matrix + live diagnosis procedure + gaps/debug/seeds). Verification: check-grafana-metrics.mjs passes."
---
# Sprint 231 — Full Monitoring System Audit + Log Collection Diagnosis + Alertmanager Discord Receiver Wiring

## ERRATA (Sprint 232)

> This ADR's **"Alerting — zero delivery path (real defect)"** conclusion, and the "Discord receiver wiring" work premised on it, are **wrong**. Corrected via server-side live diagnosis (the body is kept as a historical record; the facts below take precedence).
>
> - **Root misunderstanding**: AlgoSu `infra/k3s/` is a **non-deployed reference mirror**; the actual deployment SSOT is **aether-gitops** (`algosu/base/monitoring/` + `overlays/prod`). AlgoSu CI only bumps image tags in aether-gitops and does not propagate manifests. Sprint 231 misread the mirror's stale snapshot (`receiver: 'null'`) as the deployed config.
> - **Alerting was healthy in production** — Sprint 130 B-1 already wired alertmanager-native `discord-default` + `discord-critical` (severity routing, `identity-discord-secret/webhook-url`, v0.28.1). "All 17 rules dropped / 6 days of no alerts" is false.
> - The mirror "fix" Sprint 231 added (`monitoring-secrets/discord_webhook` + v0.27.0 + `webhook_url_file`) was a **non-functional** config (v0.27.0 does not support file-based discord webhook) → Sprint 232 aligns the mirror to live and removes the `ALERTMANAGER_DISCORD_WEBHOOK` placeholder.
> - **The actual "log non-collection" cause was Loki OOM** (512Mi limit, ~5-day spike) — fixed and verified via aether-gitops PR #7 (512Mi→1Gi). This ADR's "logging pipeline statically sound" diagnosis itself remains valid (the pipeline was fine; the cause was Loki resources).
> - Lesson updated: **do not assert runtime defects from static manifests (especially a non-deployed mirror)** — [[feedback-source-vs-live-drift]]. Details: `docs/runbook/monitoring-system-audit.md` §0/§4.

## Goal

- Audit the entire AlgoSu monitoring stack (metrics, alerts, dashboards, logging, validation CI, conventions) and persist a fact-based (file:line) inventory of current state, coverage, and gaps.
- Diagnose the user's concern that **"service log / error logs do not seem to be collected"** by tracing the logging pipeline precisely.
- **Fact-check** the gaps the agents flagged as speculation (alertmanager routing, github-worker connectivity, secrets) against code/manifests.
- Fix the low-risk defects confirmed during the audit in-repo.

## Background

- Started from the `/start` argument "audit our monitoring system." After three parallel Explore agents (infra manifests / service instrumentation / validation & docs), the user narrowed focus to **"check whether service/error logs are being collected"** and instructed "fact-check the speculative gaps too."
- Audit baseline commit `2e7e350` (Sprint 230 merge).

## Root Cause / Diagnosis (confirmed via code/manifests)

### Logging pipeline — static config is correct
1. **Promtail** (`promtail.yaml:59-71`): reads `/var/log/pods` → `cri:{}` → `json:{level,traceId,tag}` → promotes `labels:{level,tag}`. Keeps `algosu` namespace; labels `namespace`/`pod`/`app`/`container`.
2. **NetworkPolicy**: `default-deny-network-policy.yaml:16-17` is `policyTypes:[Ingress]` **only** (egress unrestricted) → Promtail's loki push egress is not blocked. `service-network-policies.yaml:542-574` `loki-ingress` explicitly allows Promtail→loki:3100. **Not a block.**
3. **Grafana datasource**: Loki uid `loki` ↔ dashboard panel uid consistent (`grafana-service-dashboard.yaml:693,716`).
4. **`level` value consistency**: NestJS logger `'error'` (lowercase), Python `LEVEL_MAP` unifies CRITICAL→`"error"` (`ai-analysis/src/logger.py:97-103`). Lowercase-consistent across all services.
→ **If logs are truly missing, it is a runtime cause, not a static-config bug** (Promtail crash, Loki PVC/OOM, pod labels, time range), and confirmation requires OCI live diagnosis (operator side, runbook §3).

### Alerting — zero delivery path (real defect)
- `alertmanager.yaml:22` `route.receiver: 'null'` → all 17 rules (including critical ServiceDown, OOMKilled, CircuitBreakerOpen, AuthFailure) fire with **no delivery path**.
- The comment (`alertmanager.yaml:4-5,25`) "Discord alerts switched to the Identity service webhook" is **false**: Identity `DiscordWebhookService` only calls `sendFeedbackNotification` in `feedback.service.ts:58` — a **user-feedback-only** path with no Prometheus/Alertmanager alert-receiving controller.

### Speculative-gap fact-check
- github-worker-metrics Service **exists** (`infra/k3s/github-worker.yaml:81`, 9100) → scrape target valid. The 'critical gap' speculation is false.
- Identity discord = feedback-only (unrelated to alerts).
- Monitoring SealedSecret = just `GRAFANA_ADMIN_PASSWORD`.
- The two `.bak` files were git **untracked** (not checked in) — local cleanup only.

## Key Decisions

1. **Log non-collection = a runtime diagnosis target**: since static config is sound, the deliverable is a **live diagnosis procedure (runbook §3)** rather than a "fix" (the agent environment's kubectl points to a non-running cluster, so autonomous live execution is impossible).
2. **Wire a real alert receiver** (user-confirmed): Alertmanager v0.27.0 native `discord_configs.webhook_url_file` references a secret file (no plaintext), `route.receiver` null→discord. The real webhook URL seal is operator side (kubeseal).
3. **Fix the log query**: remove Error Logs Only's dead branches + fragile line filter → direct `level` label filter (index-efficient, clear).
4. **Record false speculation as debug in the runbook** (C1–C4) to prevent the same misjudgment in the future.

## Work Summary (start `2e7e350`)

- `351e61d` **fix(infra)**: alertmanager Discord receiver wiring (discord_configs.webhook_url_file + route null→discord + Deployment secret volume mount + false-comment correction) / sealed-secrets-template `ALERTMANAGER_DISCORD_WEBHOOK` placeholder / grafana-service-dashboard Error Logs Only query corrected to a direct `level` label filter.
- (docs) New `docs/runbook/monitoring-system-audit.md` (§0 summary, §1 inventory, §2 coverage matrix, §3 live diagnosis, §4 gaps/debug/seeds) + ADR sprint-231 KR+EN + README index 168→169.

## Verification

- `node scripts/check-grafana-metrics.mjs` **passes** (exit 0, 8-dimension cross-check: defined 204, strict 32, wildcard 15, label 124, panel-title 41, variable 0 unused, rule-label 15, datasource pass, empty 0, dup-id 0).
- alertmanager.yaml valid YAML (3 docs, embedded alertmanager.yml parses, volumes/mounts consistent).
- ADR gates (index 169, adr-en, links, doc-refs) + CI `quality-monitoring` (BLOCKING) green.
- Live DB/cluster verification is impossible in this environment (kubectl points to a non-running local cluster) → perform runbook §3 operator-side after merge.

## Lessons

1. **Sound static config ≠ sound runtime** — even if the logging pipeline is correctly wired in code/manifests, a non-collection symptom can be a runtime cause. For live verification that cannot be run autonomously, the correct deliverable is a **step-by-step diagnosis procedure (runbook) that narrows down where it breaks**, not the "execution" itself.
2. **A `null` receiver silently swallows alerts** — even with 17 rules, a null receiver means zero delivery. "Rules exist ≠ delivery works." Alerting must be verified end to end from fire to delivery.
3. **Verify comments against code** — the "switched to Identity webhook" comment pointed at a feedback-only service and masked the absence of an alert path. Even infra comments must be confirmed via the call graph.
4. **Agent-audit 'speculation' is refutable** — both the github-worker-metrics-Service-absent and checked-in-.bak speculations were proven false by code. Do not treat speculation as a defect before fact-checking; record the verification result as debug to block re-misjudgment.
5. **Loki direct `level` label filter > `| json` re-parse** — the `level` label promoted by Promtail is indexed, so `{... level="error"}` is efficient and clear. `| json` re-parsing is fragile due to label collision (`level_extracted`). Dead regex branches in a query (levels never emitted) invite confusion.

New pattern: **operational-verification diagnosis runbook pattern** (produce a step-by-step narrowing diagnosis procedure for live verification that cannot be run autonomously) + **end-to-end alert delivery verification** (not rule existence but actual receiver wiring).

## Carryover

- **(operator) B3 Discord webhook seal + rollout**: per runbook §4-B3, seal `ALERTMANAGER_DISCORD_WEBHOOK` then ArgoCD sync → confirm Discord delivery on fire.
- **(operator) live log diagnosis**: use runbook §3 to confirm actual collection on OCI.
- (existing carryover) Sprint 230 problem-service rollout check, live /quiz verification, SP217 cutover, GA4, problem_db migration, harness cron.
- (follow-up seeds) D2 check-prom-default-metrics CI integration / D3 DLQ & Python CB metric augmentation / D4 OTel distributed tracing & on-call runbook expansion.
