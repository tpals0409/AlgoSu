---
sprint: 240
title: "Operational procedure hardening — ADR-030 S-6/Q-3 (docs only)"
date: "2026-06-10"
status: completed
agents: [Oracle, Architect, Postman, Scribe]
related_adrs: ["ADR-030", "sprint-239", "sprint-236", "sprint-235"]
related_memory: ["sprint-window"]
topics: ["security", "ops-runbook", "dlq"]
tldr: "Sprint 2 of the ADR-030 remediation roadmap. Two undocumented operational gaps closed with zero code changes — runbook-only. S-6: GITHUB_TOKEN_ENCRYPTION_KEY rotation runbook (encryption-key-rotation.md) — dual-key unsupported means rotation invalidates all existing encrypted tokens, but worker.ts fallback path (GitHub App Installation Token) keeps the service live. 3-Secret (gateway-secrets + github-worker-secrets + identity-service-secrets — the 2-Secret draft was caught by Critic R1 P1 for the missing identity service, expanded after code-level verification) simultaneous replacement in a single aether-gitops commit + 4-point verification gate (sha256 match / positive / fallback / closed). Q-3: DLQ redrive runbook (dlq-redrive.md) — topology table (submission.events → 2 queues → 2 DLQs), 5-reason table, root-cause-removal pre-gate (reason-based branch), dynamic shovel recommended + rabbitmqadmin fallback, idempotency caveat (github-worker redis TTL 1 h). 4 cross-ref updates + ADR-030 S-6/Q-3 Sprint 240 ✅. Verification: 5 ADR gates + doc-ref-lint PASS."
---
# Sprint 240 — Operational procedure hardening (ADR-030 S-6/Q-3, docs only)

## Goal

- Item 2 on the ADR-030 remediation roadmap — handle the two operational-procedure items (S-6, Q-3) in a single sprint.
- Minimal code change — focus is on runbook quality and verification gates.
- Close the undocumented operational gaps left after Sprint 239's code quick wins.

## Context

- `/start` argument: process ADR-030 §Decision roadmap item 2, S-6 + Q-3.
- **S-6**: `GITHUB_TOKEN_ENCRYPTION_KEY` is dual-managed across two SealedSecrets (gateway-secrets, github-worker-secrets) with no documented rotation procedure. A mismatch causes decryption failure.
- **Q-3**: DLQ message redrive is manual but undocumented. `oncall-alerts.md:111` ended with "DLQ messages are processed manually/in batch" — one line, no procedure.

## Work summary (Architect + Postman + Scribe, 3 commits total + Critic R1 corrections)

### S-6 — New runbook `encryption-key-rotation.md` (Architect) + Critic R1 corrections

- **Source files read directly**: `services/gateway/src/auth/oauth/token-crypto.util.ts` (encryption), `services/github-worker/src/worker.ts:384-398` (fallback path), `infra/sealed-secrets/sealed-secrets-template.yaml:58,164` (two SealedSecret locations — initial read), `docs/runbook/key-rotation.md` (kubeseal conventions).
- **§0 Background & impact**: AES-256-GCM symmetric key; ciphertext format `iv:ciphertext:tag`. **Dual-key unsupported** — rotating the key immediately invalidates all existing encrypted tokens. However, the `worker.ts:384-398` fallback (GitHub App Installation Token) absorbs decryption failures and keeps the service live. Users re-encrypt on their next GitHub re-link. Bulk migration is not needed under the current design. Rotation triggers (scheduled / suspected leak) distinguished.
- **§1 Pre-flight checklist**: kubeseal · kubectl · aether-gitops clone up to date (reuses `key-rotation.md` pattern).
- **§2 New key generation**: `openssl rand -hex 32` + 64-char hex format validation.
- **§3 Initial 2-Secret → Critic R1 corrected to 3-Secret simultaneous replacement**: Critic flagged missing identity service (P1). Oracle confirmed via code: `services/identity/src/user/token-encryption.service.ts:28-34` — throws on boot if `GITHUB_TOKEN_ENCRYPTION_KEY` is unset (live identity running = key exists in live secret); `user.service.ts:136` uses encryption. **Updated from 2-secret to 3-secret (gateway-secrets + github-worker-secrets + identity-service-secrets)**: §0 management table gained identity row, §3 gained identity-service-secrets regeneration step (9 keys), §4 sha256 comparison expanded to 3-secret, §5 rollback updated to 3-secret simultaneous restore. `infra/sealed-secrets/sealed-secrets-template.yaml` identity-service-secrets section gained `GITHUB_TOKEN_ENCRYPTION_KEY` entry (template drift closed). Full key-list inclusion warning (same as `key-rotation.md §3`).
- **§4 Verification gate (4 points)**: ① 3-Secret sha256 match (without exposing plaintext) ② New GitHub OAuth link positive test ③ Existing-token `GITHUB_APP_FALLBACK` log = expected signal ④ Error rate and DLQ unchanged (closed-circuit proof).
- **§5 Rollback**: single-commit revert of all 3 Secrets to old key + ArgoCD sync + 3-service rollout restart.
- **§6 Post-rotation cleanup**: delete plaintext key files, record rotation in log table.
- **§7 Related docs**: key-rotation.md, github-token-relink.md, sealed-secrets-template.yaml, ADR-030.
- **Critic R1 P2**: Added explicit `kubectl rollout restart deployment/{gateway,github-worker,identity-service} -n algosu` + rollout status for 3 services after §3 ArgoCD sync — SealedSecret updates do not guarantee automatic pod restarts; this is now stated explicitly in the runbook.

### Q-3 — New runbook `dlq-redrive.md` (Postman) + Critic R1 correction

- **Source files read directly**: `services/submission/src/saga/mq-publisher.service.ts:72-105` (DLQ topology declaration), `services/github-worker/src/worker.ts:174-180,200,269` (DLQ NACK + reason labels), `services/ai-analysis/src/worker.py:149-156,316,370,384` (DLQ NACK + reason), `docs/runbook/oncall-alerts.md:103-111` (DLQReceived alert).
- **§0 Background & topology**: `submission.events` (topic) → `submission.github_push` / `submission.ai_analysis`; NACK(requeue=false) → `submission.events.dlx` → `submission.github_push.dlq` (routing `github.push.dead`) / `submission.ai_analysis.dlq` (routing `ai.analysis.dead`). 5-reason table: `parse_error` / `process_failure` (both workers), `circuit_breaker_exhausted` / `rate_limit_exhausted` (ai-analysis only), `token_invalid` (github-worker only).
- **§1 Pre-redrive mandatory gate**: **root cause must be resolved first** — reason-based branches: `parse_error` is a publisher schema defect, so redriving immediately re-fails (meaningless); `process_failure` — confirm downstream recovery; `circuit_breaker_exhausted` / `rate_limit_exhausted` — confirm CB CLOSED and rate normalized.
- **§2 DLQ inspection**: kubectl exec + rabbitmqctl for queue depth/message peek; management plugin availability verified as a pre-check step.
- **§3 Redrive procedure**: recommended = **dynamic shovel** (DLQ → original exchange + routing key, no message loss, delete shovel when done); alternative = rabbitmqadmin manual loop (for small counts).
- **§3 Method B Critic R1 P2 fix**: The initial Method B used `ackmode=ack_requeue_false` to consume the message while extracting payload via `grep -oP` — ① `--format=json` was absent making parsing unreliable ② escaped quotes in JSON payload caused truncation → truncated payload published + original permanently lost. **Reconstructed as peek → validate → publish → consume**: `ack_requeue_true --format=json | jq -r '.[0].payload'` for safe extraction → `jq -e '.submissionId'` for JSON validity gate → only after confirmed publish success does `ack_requeue_false` remove the original. Method B data-loss warning strengthened.
- **§4 Idempotency & duplicate risk**: github-worker redis key `ghw:processed:{submissionId}` TTL 1 hour — redrive within 1 hour is auto-skipped (safe), after 1 hour a duplicate GitHub push occurs (assess impact). ai-analysis has no idempotency guard; result overwrite is accepted.
- **§5 Verification**: DLQ depth 0 + worker processing logs + `dlq_messages_total` no new increment + submission status transition confirmed.
- **§6 Automation decision criteria**: if monthly occurrence exceeds N times, evaluate automation — makes the ADR-030 "confirm frequency first" decision operationally visible.
- **§7 Related docs**: oncall-alerts.md, mq-publisher.service.ts, github-token-relink.md, ADR-030.

### Index & cross-reference updates (Scribe)

- `docs/runbook/README.md`: GitHub/auth 4→5 (added encryption-key-rotation), observability/monitoring 2→3 (added dlq-redrive).
- `docs/README.md`: runbook count 21→23; both section table entries updated.
- `docs/runbook/oncall-alerts.md`: DLQReceived response "수동/배치 재처리" → explicit reference to `dlq-redrive.md` (root-cause removal first, noted).
- `docs/runbook/key-rotation.md`: comment cross-ref to `encryption-key-rotation.md` on the `GITHUB_TOKEN_ENCRYPTION_KEY` line.
- `docs/adr/ADR-030-security-improvement-backlog.md` (+EN): S-6/Q-3 rows → `Sprint 240 ✅`; roadmap table Sprint 240 row → ✅.
- `docs/adr/README.md`: sprint ADR count 177→178; range Sprint 62~239 → 62~240.

## Key decisions

1. **Dual-key rotation = existing-token invalidation, but service stays live**: the `worker.ts` fallback path (GitHub App Installation Token) absorbs decryption failures automatically. The runbook explicitly marks this as "expected behavior" — "after rotation, `GITHUB_APP_FALLBACK` logs are a normal signal, not an alert". Without this framing, an operator would mistake fallback logs for a production incident.
2. **Distinguishing single-commit replacement from Sprint 236's 2-commit ordering**: Sprint 236 added a new secret (pod would fail to mount if absent) → 2-commit add-then-switch. Sprint 240 replaces an existing secret → single commit to eliminate the mismatch window. The same "commit carefully" principle leads to opposite strategies depending on whether the resource is being added or replaced.
3. **DLQ redrive requires root-cause removal as a pre-condition**: `parse_error` is a publisher schema defect — redriving re-fails immediately → redrive is pointless. The runbook's §1 reason-based gate blocks the "just redrive it" anti-pattern.
4. **Dynamic shovel recommended; rabbitmqadmin is the debug fallback**: shovel achieves atomic move without message loss (including large volumes). Manual rabbitmqadmin loop is for small-scale debugging. The automation threshold in §6 operationalizes ADR-030's "confirm frequency first" by giving it a concrete measurable condition.
5. **Docs-only sprint still goes through Critic cross-review**: runbook command accuracy (exchange names, routing keys, secret key names) carries the same risk of production failure as code bugs.

## Verification

- 5 ADR gates (`node scripts/check-adr-index.mjs` etc.) PASS: index 178 / EN 188/188 / links 0 / doc-refs / conversion.
- `node scripts/check-doc-refs.mjs` (doc-ref-lint): all cross-ref links in the two new runbooks valid, 0 errors.
- Manual command consistency check: exchange/queue/routing key names verified against `mq-publisher.service.ts:72-105` declaration; SealedSecret key names verified against `sealed-secrets-template.yaml:58,164` — match confirmed.
- Critic cross-review (Codex, `--base 924c650`): **R1 findings → corrections applied**
  - **[P1] S-6 identity service missing from secret rotation scope**: Oracle confirmed via code (`token-encryption.service.ts:28-34` boot throw, `user.service.ts:136` encryption) → 2-secret expanded to 3-secret throughout runbook + `sealed-secrets-template.yaml` identity-service-secrets section gained `GITHUB_TOKEN_ENCRYPTION_KEY` (template drift closed).
  - **[P2] S-6 no rollout restart after SealedSecret update**: added `kubectl rollout restart deployment/{gateway,github-worker,identity-service}` + rollout status for 3 services; explicit note that SealedSecret updates do not guarantee automatic pod restarts.
  - **[P2] Q-3 Method B message-loss risk**: reconstructed as peek → validate → publish → consume; `ack_requeue_true --format=json | jq` for safe extraction; `ack_requeue_false` only after confirmed publish success. Data-loss warning strengthened.
- auto-critic R2: with an invalid message stuck at the queue head, Method B's `continue` re-peeks the same message forever → fixed with `break` + manual-removal guidance (`df14b84`). auto-critic R3 **CLEAN**.
- **Merge-gate Critic R1–R5** (Codex, full-branch `--base 924c650`): R1 — [H-1] a cross-ref comment inserted **inside** the multi-line bash command in `key-rotation.md` severed the line continuation, producing a SealedSecret missing every subsequent key (a regression introduced by this sprint) + [M-1] ADR-030 S-6 row still saying 2-location/2-key + [L-1–L-3] §1 identity omission, §6 cleanup omission, line ref `:164→:167` → all 5 fixed. R2 — gate 2 `grep -v` misjudgment (always passes) + jq install note targeting the pod instead of the local shell → fixed. R3 — gate 2 bidirectional misjudgment (false failure from concurrent users' fallback / false success on kubectl failure) → fixed with traceId scoping + 2 pre-gates. R4 — pre-gates echo but flow continues, still reaching a false ✅ → fixed with a single exclusive if/elif/else verdict. **R5 CLEAN** ✅.
- Changed files: `docs/runbook/encryption-key-rotation.md`, `docs/runbook/dlq-redrive.md`, `docs/runbook/key-rotation.md`, `infra/sealed-secrets/sealed-secrets-template.yaml`, `docs/adr/ADR-030-security-improvement-backlog.md` (+EN), `docs/adr/sprints/sprint-240.md`, `docs/adr-en/sprints/sprint-240.md`.

## Lessons

1. **A runbook's key job is distinguishing "expected behavior" from "error"**: in S-6, if `GITHUB_APP_FALLBACK` log is not labeled a normal signal, an operator seeing it after rotation will treat it as an incident. Runbooks must describe the expected-path behavior explicitly.
2. **Similar-looking commit strategies differ by context**: new-secret add (Sprint 236, 2-commit) and existing-secret replace (Sprint 240, single-commit) have opposite reasoning. Applying a pattern without understanding its premise increases risk.
3. **Root-cause removal belongs in §1, before How**: "when NOT to redrive" must come before "how to redrive" to prevent operational errors. A runbook's When is more important than its How.
4. **Docs-only sprints get the same Critic gate as code sprints**: incorrect exchange names or routing keys cause production failures just as surely as code bugs.

5. **Runbook review for key scope must be closed by code grep, not diagram assumption**: even though the planning doc listed identity as a key user, the initial runbook assumed "encryption = gateway, decryption = github-worker" as a two-node diagram. One `grep -r GITHUB_TOKEN_ENCRYPTION_KEY services/` command would have surfaced all three locations. **Whenever a runbook asks "how many places use this Secret?", the answer must come from code grep, not architectural intuition.**

New patterns: **expected-behavior-explicit runbook pattern** (fallback path and decryption failure labeled as "normal signal"), **root-cause-first gate pattern** (§1 branches by reason — conditions under which redriving is valid before the How), **key-scope code-grep verification pattern** (grep first, document second — scope by evidence not assumption).

## Carry-overs

- Sprint 241 confirmed: Q-1 (BE) study.service domain split, Q-2 saga-orchestrator helper extraction — ADR-030 §Decision roadmap.
- ThrottlerGuard for /api/events (backlog, Sprint 239 carry-over).
- Existing carry-overs: harness checkup in separate slot · GA4 console 3 items · live SEO · harness cron · webhook regenerate · cumulative UAT · blog backlog (CS quiz / deleted features / zstd).
