---
sprint: 235
title: "Monitoring Alert System Gap Hardening (CB/DLQ alert coverage + alert channel separation + on-call runbook)"
date: "2026-06-09"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-231", "sprint-232", "sprint-234"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra", "alerting"]
tldr: "A full monitoring-system audit + alert-system review surfaced four gaps, each hardened. (1) CircuitBreakerOpen alert watched only ai-analysis → unified with submission/github-worker (all three CB metrics exist; rule expanded only). (2) DLQReceived alert referenced the never-emitted placeholder algosu_submission_dlq_messages_total → fact-check confirmed submission is a saga orchestrator that emits no DLQ counter, so it was replaced with the actually-emitted worker metrics algosu_(github_worker|ai_analysis)_dlq_messages_total. (3) Operational alerts reused identity-discord-secret (the feedback-only webhook), mixing into the same Discord channel → split into critical/general two channels via alertmanager-discord-secret (2 keys webhook-url/webhook-url-critical); the mirror is pre-staged as the target state (real sealing/apply is server-side aether-gitops). (4) No on-call runbook → added oncall-alerts.md (per-alert diagnosis queries and response for all 13 alerts) + alert-channel-separation.md (live apply procedure for channel split). infra/k3s/monitoring is a non-deployed reference mirror — live-apply items go to runbook + carry-over. Gate check-grafana-metrics all dimensions [OK], check-doc-refs 437 files no broken refs."
---
# Sprint 235 — Monitoring Alert System Gap Hardening (CB/DLQ alert coverage + alert channel separation + on-call runbook)

## Goal

- Audit the monitoring system overall + review the alert system (rule → route → receiver delivery path).
- Harden the gaps found in the review per item after user confirmation. Live-apply items go to runbook + carry-over.

## Background

- Started from `/start` argument "audit our monitoring system, review the monitoring alert system. When the audit is done, ask me one by one." Three parallel Explore investigations (infra manifests / service instrumentation & logging / verification & docs).
- `infra/k3s/monitoring` is a **non-deployed reference mirror**; the deployment SSOT is aether-gitops (confirmed in Sprint 232). Do not declare runtime defects from the static mirror ([[feedback-source-vs-live-drift]]). Live cluster access is unavailable in this environment → static work (mirror/rules/docs) + live-apply carry-over.
- Confirmed the audit findings with the user per item → 4 hardening items + channel-split granularity (critical/general two channels) fixed.

## Gaps found in the review (fact-checked)

1. **CB alert partial coverage**: `CircuitBreakerOpen` (`prometheus-rules.yaml:126`) watched only `algosu_ai_analysis_circuit_breaker_state`. submission·github-worker also emit a `circuit_breaker_state` metric (value 2=OPEN) but had no alert → no alert when Saga/GitHub sync is blocked.
2. **DLQ alert references a never-emitted placeholder**: `DLQReceived` (`:157`) referenced `algosu_submission_dlq_messages_total > 0`, but **this metric is emitted nowhere** (0 hits in submission source). submission is a saga **orchestrator** and emits no DLQ counter; DLQ occurs in the **consumer workers** (github-worker, ai-analysis) (`algosu_github_worker_dlq_messages_total`, `algosu_ai_analysis_dlq_messages_total` exist). The §7 "Placeholder" comment corroborates this. → identifies the "DLQ alert placeholder" gap in monitoring-system-audit.md §4-D3.
3. **Single shared Discord webhook**: Operational alerts reuse the Identity **feedback-only** webhook (`identity-discord-secret`) (`alertmanager.yaml:145`) → operational alerts and user feedback mixed in the same channel. discord-default/discord-critical also share one webhook.
4. **No on-call runbook**: no document for diagnosis/response after receiving an alert (monitoring-system-audit.md §4-D4).

## Key Decisions

1. **CB alert unified across 3 services**: all three metrics confirmed to exist → expr expanded to `{__name__=~"algosu_(ai_analysis|submission|github_worker)_circuit_breaker_state", name=~".+"} == 2`. summary/description identify service/breaker via `{{ $labels.job }}`·`{{ $labels.name }}`. Sprint 141 schema (OPEN=2) and `{name=~".+"}` legacy guard preserved.
2. **DLQ alert placeholder replacement (not expansion)**: the user's request was "submission + 2 workers unified," but fact-check confirmed the submission DLQ metric is never emitted → the honest fix replaces the never-emitted placeholder with the actually-emitted 2-worker metrics. Excluding submission is architecturally correct (an orchestrator emits no DLQ). The final expr reflects 2 Critic rounds: `increase({__name__=~"algosu_(github_worker|ai_analysis)_dlq_messages_total"}[5m]) > 0` (counter raw value `>0` fires forever, R1 P2) + zero-init of reason labels in the workers (the gap where increase misses the first DLQ of a lazily-created series, R2 P2).
3. **Alert channel critical/general split**: new `alertmanager-discord-secret` (2 keys: `webhook-url`=general, `webhook-url-critical`=critical). discord-default→webhook-url, discord-critical→webhook-url-critical. **The mirror is pre-staged as the "target state" ahead of live** (secret volume secretName swap + banner) — real Discord channel creation, webhook sealing, and aether-gitops apply follow `alert-channel-separation.md` server-side. The alertmanager webhook key removed by the Sprint 232 ERRATA is **re-introduced for the legitimate purpose of "channel separation"** (the rationale is recorded in the ADR to prevent re-misjudgment).
4. **Two new on-call runbooks**: `oncall-alerts.md` (per-alert meaning, PromQL/LogQL diagnosis, first response for all 13 alerts + delivery-path check §3) + `alert-channel-separation.md` (channel-split live apply + fire→Discord-arrival end-to-end verification). The live delivery verification procedure is absorbed into the latter.

## Work Summary (start `ca2b0bd`, 6 commits)

- `04e504a`: `feat(infra)` prometheus-rules.yaml — CircuitBreakerOpen unified across 3 services + DLQReceived placeholder→2-worker real metrics replacement.
- `1f160c3`: `feat(infra)` alertmanager.yaml (discord-critical webhook-url-critical · secret volume alertmanager-discord-secret 2 keys · target-state banner) + sealed-secrets-template.yaml (alertmanager-discord-secret 2 keys added).
- `a700cbb`: `docs(runbook)` oncall-alerts.md + alert-channel-separation.md new + both READMEs gain 'Observability/Monitoring' category (19→21).
- (ADR commit: this doc + README 172→173).
- `0d6b771`: `fix(infra)` DLQReceived counter raw value `>0` → `increase(...[5m]) > 0` (prevent permanent firing, Critic R1 P2) + oncall runbook query aligned.
- `43578a0`: `fix(github-worker,ai-analysis)` DLQ counter reason-label zero-init (prevent increase missing the first DLQ of a lazily-created series, Critic R2 P2). github-worker [parse_error, process_failure] / ai-analysis [circuit_breaker_exhausted, rate_limit_exhausted, process_failure] — aligned to actual usage · stale comments corrected.

## Verification

- **Gate `check-grafana-metrics.mjs` all dimensions [OK]**: defined metrics 204, rule expr label pairs 15 (external skip 5) — CB `name` label·DLQ metrics aligned and pass. The `__name__=~` pattern matches the way the existing recording rules (lines 35, 45) already pass.
- YAML valid: prometheus-rules.yaml inner (10 groups·15 rules parsed), alertmanager.yaml 3-doc (receiver webhook_url_file ↔ secret volume items ↔ sealed key aligned), sealed-secrets-template.yaml.
- `check-doc-refs.mjs`: 437 files no broken refs (regression fixtures 8/8).
- `check-prometheus-rules.mjs` (promtool) not installed locally — runs in CI install step. Locally augmented with YAML + PromQL-shape parsing.
- **Critic** (Codex gpt-5.5, `--base ca2b0bd`): **R1 [P2]** DLQReceived used counter raw value `> 0` → fires forever after the first DLQ event until process restart → corrected to `increase(...[5m]) > 0`. **R2 [P2]** `increase()` misses the first DLQ of a lazily-created counter series (no baseline 0 to compare against) → zero-init known reason labels in the workers. **R3 CLEAN** ("No discrete correctness issues were found in the changed monitoring rules, alertmanager mirror updates, sealed-secret template, or DLQ metric initialization changes").

## Lessons

1. **rule existence ≠ delivery, and rule reference ≠ metric emission** — DLQReceived was meaningless even when firing (referenced metric never emitted). Verify in code that the metric an alert points at is actually emitted (an extension of Sprint 231's "rule existence ≠ delivery").
2. **placeholder alerts give false safety** — `algosu_submission_dlq_messages_total` had a §7 "Placeholder" comment but the expr was live, so dashboards/reviews could mistake it for "DLQ being watched." Never-emitted metrics must be replaced with real metrics or removed.
3. **correct even user requests against code facts** — the "submission + 2 workers unified" request was honestly narrowed to "2-worker replacement" by the fact that submission emits no DLQ. The form matching the architecture (an orchestrator emits no DLQ) is right.
4. **alert channel separation = webhook isolation = signal/noise separation** — putting critical in the same channel as feedback/warning causes misses. Per-severity channel (webhook) separation secures critical visibility.
5. **mirror pre-staging (target state) creates drift — guard re-misjudgment with banner+ADR rationale** — when the live fix is server-side work that can't be done first, pre-staging the mirror as the target state creates drift ahead of live. This is the reverse-direction risk of Sprint 231's misjudgment (reading the mirror as the deployment) → manage with a "target state" banner + intent recorded in the ADR + an apply runbook.
6. **counter alerts need `increase(...[window])` + label zero-init, not raw value** (Critic R1/R2) — ① a counter is monotonic, so `metric > 0` fires forever after the first event → use `increase(...[5m]) > 0` for "recent events" only. ② prom-client/prometheus_client create a label series lazily on the first `.inc()`, so it first appears at value 1 → `increase` has no baseline (0) to compare and misses the first event → zero-init known label values at process start. The rarer the critical event (DLQ), the more both are required.

New pattern: **review-driven alert alignment pattern** (verify in code whether the metric an alert references is actually emitted → replace/remove never-emitted placeholders, unify coverage gaps onto existing metrics) + **mirror pre-staging (target state) + apply runbook pattern** (when the live fix is server-side and can't go first, leave the mirror as the target state and pin the apply path with a banner + runbook).

## Carry-over

- **(server) channel-split live apply** — follow `alert-channel-separation.md`: create 2 Discord channels → 2 webhooks → seal `alertmanager-discord-secret` → apply in aether-gitops → fire→Discord-arrival end-to-end verification. After apply, mark drift resolved on the mirror "target state" banner.
- **(server) alertmanager mirror alignment** — align aether-gitops alertmanager.yaml to the alertmanager-discord-secret 2-channel form (currently only the mirror is pre-staged).
- (existing carry-over) loki Deployment hardening back-port (gap confirmed) · ADR-028 SA apply·token issuance · Sprint 230 rollout check · live /quiz verification · SP217 cutover · GA4 · problem_db · harness cron.
