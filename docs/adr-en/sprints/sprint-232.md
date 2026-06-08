---
sprint: 232
title: "Alertmanager Mirror Drift Correction + Sprint 231 Documentation ERRATA (infra/k3s ≠ deployment SSOT)"
date: "2026-06-08"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-231", "sprint-130"]
related_memory: ["sprint-window", "feedback-source-vs-live-drift"]
topics: ["observability", "monitoring", "alerting", "infra", "gitops"]
tldr: "Sprint 231's central conclusion ('alertmanager receiver:null → all 17 rules dropped / 6 days no alerts') was proven wrong by server-side live diagnosis. Root cause: AlgoSu infra/k3s/ is a non-deployed reference mirror; the actual deployment SSOT is aether-gitops (algosu/base/monitoring + overlays/prod). AlgoSu CI only bumps image tags in aether-gitops and does not propagate manifests, and ArgoCD (automated, selfHeal, Synced) only watches aether-gitops. Sprint 231 misread this non-deployed mirror's stale snapshot (receiver:null) as the deployed config. Live alertmanager was already healthy via Sprint 130 B-1 (alertmanager-native discord-default + discord-critical, identity-discord-secret/webhook-url, v0.28.1). Worse, the 'fix' Sprint 231 added to the mirror (monitoring-secrets/discord_webhook + v0.27.0 + webhook_url_file) was non-functional since v0.27.0 does not support file-based discord webhooks. The actual 'log non-collection' cause was Loki OOM (512Mi limit, ~5-day spike), fixed and verified via aether-gitops PR #7 (512Mi→1Gi) (C). This sprint: A-lite aligns the AlgoSu alertmanager mirror to live (v0.28.1 + discord-default/critical + identity-discord-secret/webhook-url + non-deployed banner) and removes the sealed-secrets placeholder; B adds ERRATA to the Sprint 231 ADR/runbook; B+ seeds the loki probe/securityContext live gap. Deployment-neutral (mirror/doc integrity restoration). Critic R1 CLEAN. Lesson: do not assert runtime defects from static manifests (especially a non-deployed mirror) (feedback-source-vs-live-drift)."
---
# Sprint 232 — Alertmanager Mirror Drift Correction + Sprint 231 Documentation ERRATA

## Goal

- Correct Sprint 231's (full monitoring audit) **misjudgment** based on server-side live diagnosis.
- Align the AlgoSu `infra/k3s/` mirror to the live (aether-gitops) configuration and document the structure that caused the misjudgment (`infra/k3s` ≠ deployment SSOT).

## Background

- Sprint 231 saw `receiver: 'null'` in `infra/k3s/monitoring/alertmanager.yaml` and asserted "all 17 alert rules dropped, 6 days of no alerts" as a **confirmed defect**, then "wired" a Discord receiver.
- The user diagnosed live on the server and the conclusion turned out to be **wrong**.

## Root Cause (confirmed via server diagnosis)

1. **AlgoSu `infra/k3s/` is a non-deployed reference mirror.** The actual deployment SSOT is **aether-gitops** (`algosu/base/monitoring/` + `overlays/prod`). AlgoSu CI (`ci.yml:1073+`) only bumps **image tags** in aether-gitops and does not propagate manifests. ArgoCD (automated, selfHeal, Synced) only watches aether-gitops.
2. The `receiver: 'null'` Sprint 231 read was a **stale snapshot of the non-deployed mirror**. Live alertmanager was **already healthy via Sprint 130 B-1** — alertmanager-native `discord-default` + `discord-critical` (severity routing, repeat 30m), `webhook_url_file` referencing `identity-discord-secret/webhook-url` (`optional: false`), image v0.28.1.
3. The "fix" Sprint 231 added (`monitoring-secrets/discord_webhook` + keeping v0.27.0 + `webhook_url_file`) was **non-functional** — v0.27.0 does not support file-based discord webhooks — pushing the mirror further from live.
4. The actual "log non-collection" cause was **Loki OOM**, not the pipeline (limit 512Mi, restartCount 17, last OOMKilled 2026-05-18, ~5-day spike exceeding the limit).

## Key Decisions

1. **Mirror role = demote to reference + fix only what's broken** (full mirror sync isn't worth the burden for a solo/Free Tier project). A non-deployed banner blocks future misreads.
2. **A-lite**: replace AlgoSu `alertmanager.yaml` with the live manifest (v0.28.1 + discord-default/critical + identity-discord-secret/webhook-url + optional:false), remove the sealed-secrets `ALERTMANAGER_DISCORD_WEBHOOK` placeholder (reuse the existing secret). **Deployment-neutral** (ArgoCD does not reference infra/k3s).
3. **B**: the Sprint 231 ADR/runbook are historical records, so keep the body and add an **ERRATA block** at the top to correct the facts.
4. **C** (done on server): Loki OOM hardening via aether-gitops PR #7 (`5b07bf6`), 512Mi→1Gi / 128Mi→256Mi req, verified (loki Running, no OOM recurrence, ample node headroom).

## Work Summary (start `e5f1046` → squash `cc92924`, PR #401)

- `e080ff1` **fix(infra)**: align alertmanager.yaml to live (v0.28.1, discord-default/critical, identity-discord-secret/webhook-url optional:false, title/message templates) + non-deployed banner header + remove sealed-secrets placeholder.
- `6c4a55f` **docs**: runbook §0 ERRATA + §1.2/§4-A/B/C factual corrections (mirror ≠ deployment source, alerting healthy in live, Loki OOM as the real cause, loki hardening gap D1 seed) + ERRATA block atop ADR sprint-231 KR+EN.

## Verification

- alertmanager.yaml valid YAML (3 docs, route discord-default + critical route, secret identity-discord-secret/webhook-url optional:false, image v0.28.1) · `check-grafana-metrics.mjs` exit 0.
- ADR gates (index 170, adr-en, links 0, doc-refs 0) + adr-conversion OK.
- **Critic** (Codex gpt-5.5, `codex review --base e5f1046`): **R1 CLEAN** ("changes mainly align the reference Alertmanager manifest and documentation with the stated live configuration. I did not find any introduced functional issue").
- CI #401: `Secret & Env Scan` failed once (gitleaks download 504 flake) → re-run passed → autoMerge SQUASH. All gates (esp. `Quality — monitoring` BLOCKING) green.

## Lessons

1. **Do not assert runtime defects from static manifests (especially a non-deployed mirror)** — Sprint 231 misread the non-deployed `infra/k3s/` mirror as the deployed config, asserted a nonexistent "no-alerts defect," and even added a non-functional config. Runtime claims must be verified against live (aether-gitops/cluster). [[feedback-source-vs-live-drift]]
2. **Confirm the deployment topology first** — AlgoSu's `infra/k3s/` is a reference mirror; the deployment SSOT is aether-gitops (CI propagates image tags only). Without knowing which manifest actually deploys, all infra analysis can be wrong.
3. **Correct an already-merged misjudgment via history-preserving ERRATA** — overwrite the facts with a top correction block without deleting the ADR body, keeping both traceability and accuracy.
4. **"Demote to reference" is the realistic drift fix** — instead of full mirror sync, a non-deployed banner + fixing only what's broken blocks future misreads and avoids maintenance burden.

## Carryover

- **(server) B+ loki prod hardening gap verification**: the AlgoSu mirror loki has probes/securityContext but the live dump lacks them → verify live and, if absent, add to aether-gitops (runbook §4-D1).
- **(server) ADR-028 read-only ServiceAccount/kubeconfig implementation**: the first implementation of the no-cluster-admin-copy decision (`prod-diag-readonly` SA + short-lived token). Apply via GitOps on the server.
- (existing carryover) Discord webhook seal unnecessary (live works) · Sprint 230 rollout check · live /quiz verification · SP217 cutover · GA4 · problem_db · harness cron.
