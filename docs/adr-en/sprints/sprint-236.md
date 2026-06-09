---
sprint: 236
title: "Operational alert channel critical/general split — live apply (alertmanager-discord-secret)"
date: "2026-06-09"
status: completed
agents: [Oracle]
related_adrs: ["sprint-235", "sprint-232", "sprint-231", "ADR-029"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra", "alerting", "observability"]
tldr: "Live-applied to server-side aether-gitops the operational alert channel split that Sprint 235 had pre-staged as the 'target state' in the mirror. Previously alertmanager reused identity-discord-secret (the feedback-only webhook), so user feedback, operational warning, and critical all mixed into one channel → split via a new alertmanager-discord-secret (2 keys: webhook-url=general, webhook-url-critical=critical). To avoid an optional:false mount failure, applied as a 2-commit split (SealedSecret first → secret-existence gate → alertmanager manifest swap). End-to-end verification: 2-key mount, config alignment, critical/warning firing delivery (notifications_total 0→2→4, failed 0), resolve delivery, feedback isolation all passed, and the PM visually confirmed arrival in the two real Discord channels. identity-discord-secret is kept for feedback only (do not delete)."
---
# Sprint 236 — Operational alert channel critical/general split (live apply)

## Goal

- Take the operational alert channel split that Sprint 235 **pre-staged as the "target state"** in the mirror (`sealed-secrets-template.yaml` + the then-present `infra/k3s/monitoring/alertmanager.yaml`) and, in the server environment, seal the real Discord webhooks + live-apply to aether-gitops + verify end-to-end, **resolving the drift**.

## Background

- Sprint 235 carry-over: two items requiring a server environment with live cluster access — "(server) channel split live apply" + "(server) alertmanager mirror alignment".
- Prior state: alertmanager reused `identity-discord-secret` (the Identity **feedback-only** webhook, key `webhook-url`) → user feedback + operational warning + operational critical all **mixed into the single "Feedback Bot" channel** (Sprint 130 B-1 future item). Investigation found only this one discord webhook in the cluster, shared by identity-service (`DISCORD_FEEDBACK_WEBHOOK_URL`) and alertmanager (both discord-default/discord-critical).
- The deployment SSOT is aether-gitops (`algosu/base/monitoring/alertmanager.yaml`). The AlgoSu `infra/k3s/` mirror was **retired by ADR-029** → the alertmanager.yaml mirror is already deleted (read the runbook's `infra/k3s/monitoring/...` references as the equivalent aether-gitops path). The only remaining mirror is `infra/sealed-secrets/sealed-secrets-template.yaml` (a key-list reference template).

## Key decisions

1. **The new webhooks are net-new assets**: the existing "Feedback Bot" webhook is kept feedback-only per §6 (do not delete). Created two new operational alert channels (`#algosu-alerts`, `#algosu-alerts-critical`) + two new webhooks ("Ops Alert Bot", "Critical Alert Bot"). Before sealing, a channel-isolation gate verified that the general/critical/feedback channel_ids are mutually distinct.
2. **2-commit split apply (prevents order inversion)**: alertmanager's secret volume is `optional: false` → if the secret is absent the pod fails to mount and goes down. Therefore **add the SealedSecret first → sync → confirm existence with `kubectl get secret` (gate) → only then swap the alertmanager manifest** (secretName/items/webhook_url_file). The two changes are not bundled into one commit.
3. **Routing unchanged**: aether-gitops alertmanager already routed `severity=critical → discord-critical`, else → `discord-default`. The actual change points are (a) volume secretName `identity-discord-secret`→`alertmanager-discord-secret`, (b) items 2 keys, (c) `discord-critical.webhook_url_file` `webhook-url`→`webhook-url-critical`. discord-default keeps `webhook-url`.

## Work summary (aether-gitops, 2 commits)

- `9f7680b`: `feat(monitoring)` channel split 1/2 — add `sealed-alertmanager-discord-secret.yaml` (kubeseal-sealed 2 keys) + register in `kustomization.yaml` resources. **This commit alone is synced → secret existence confirmed before the next commit.**
- `842b93d`: `feat(monitoring)` channel split 2/2 — switch `alertmanager.yaml` to the dedicated secret (secretName `alertmanager-discord-secret`, items `webhook-url`/`webhook-url-critical`, swap discord-critical webhook_url_file) + comment updates.

(AlgoSu repo: this ADR + mirror banner drift resolution (`sealed-secrets-template.yaml`) + runbook §0/§6 drift-marker updates.)

## §5 end-to-end verification results

| # | Item | Result |
|---|------|--------|
| 5.1 | secret 2-key mount | ✅ `alertmanager-74668dd49c-zf2dl` mounts `webhook-url`, `webhook-url-critical` (`ls /etc/alertmanager/secrets/`) |
| 5.2 | receivers/webhook_url_file alignment | ✅ discord-default→`webhook-url`, discord-critical→`webhook-url-critical`, routing severity=critical→critical. config loaded, cluster ready (`/api/v2/status`) |
| 5.3 | critical/warning firing delivery | ✅ `alertmanager_notifications_total{discord}` 0→2, `failed_total` all 0 |
| 5.5 | resolve `[RESOLVED]` delivery | ✅ after resolve total 2→4, failed 0, active 0 (delivered ~162s later per group_interval) |
| 5.6 | feedback channel isolation | ✅ identity-discord-secret kept/not deleted, identity-service still references it, live alertmanager mounts alertmanager-discord-secret → secret/channel separated |
| 5.4 | arrival in both real Discord channels (no cross-delivery) | ✅ **PM visual confirmation** — critical/warning firing + resolved messages arrived in their correct channels, no cross/feedback mixing |
| — | ArgoCD / pod | ✅ Synced/Healthy (rev 842b93d), pod Running 1/1 restarts 0 |

> Verification tools: `amtool` not installed → used the Alertmanager API (`/api/v2/alerts` POST, `/metrics`, `/api/v2/status`). Proved delivery deterministically via `notifications_total`/`failed_total` metric deltas.

## Lessons

1. **An optional:false secret volume mandates SealedSecret-first 2-commit ordering** — bundling the secret and the workload that references it in one commit opens a mount-failure window depending on sync timing. Enforce "add → verify (existence gate) → switch" across commit boundaries.
2. **rule/config existence ≠ delivery** — re-confirms the Sprint 231 lesson. Prove server-side delivery via notifications_total delta + failed=0, but channel cross-delivery is indistinguishable by metrics → verification closes only with a visual check of the real channels.
3. **webhook URL secret hygiene** — plaintext webhook URLs risk exposure via tmux dispatch prompts/ps/logs (`_base.md` security guard), so the seal step is unsuitable for dispatch. Did the channel-isolation check + sealing as a single in-session one-shot to minimize plaintext residue. (Any transcript residue can be invalidated by regenerating the webhooks if needed.)

## Carry-over / follow-up

- (Optional) webhook regenerate — if plaintext transcript residue is sensitive, reissue the two webhooks in Discord and reseal (same procedure).
- ~~(server) channel split live apply~~ ✅ done this sprint.
- ~~(server) alertmanager mirror alignment~~ ✅ with the ADR-029 SSOT consolidation the alertmanager.yaml mirror is retired, single aether-gitops alignment.
