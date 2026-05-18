---
sprint: 130
title: "Production Incident Recovery (submission/identity rollout stuck) + Monitoring Strengthening + SealedSecret Debt Clearance + Carryover Cleanup"
date: "2026-04-25"
status: completed
agents: [Oracle, Architect]
related_adrs: ["ADR-026", "ADR-027", "ADR-028"]
naming_correction: "PR/branch/commit messages contain 'sprint-93' but actual sprint is 130. Naming error due to memory window not updated for 9 days — see ADR-026 naming error mapping table"
---

# Sprint 130: Production Incident Recovery + Debt Clearance

## Decisions

### D1: submission `/health` 401 regression fix (Wave A-1)
- **Context**: `services/submission/src/common/middleware/gateway-context.middleware.ts` newly introduced in Sprint 121 PR #138 ("i18n foundation") uses `req.path`. NestJS `forRoutes('*')` mount-strip interprets `/health` request as `/` inside middleware, forcing X-Internal-Key authentication → probe 401 → liveness probe failure → 867 restarts (2 days 5 hours)
- **Choice**: `req.path` → `(req.originalUrl ?? req.url).split('?')[0]` change + 7 unit tests added (mount-strip regression simulation)
- **Alternatives**: Changing `forRoutes` pattern → expanded change scope, high regression risk / Changing probe path to bypass middleware → ad-hoc, same pattern latent in other middleware
- **Code Paths**: `services/submission/src/common/middleware/gateway-context.middleware.ts:64`, spec.ts (15→22 tests)
- **PR**: [#157](https://github.com/tpals0409/AlgoSu/pull/157) (`8800cfc`)

### D2: identity `GITHUB_TOKEN_ENCRYPTION_KEY` missing recovery (Wave A-2)
- **Context**: In aether-gitops `f5f391d` commit, when adding new key to SealedSecret, only gateway/github-worker were updated, **identity-service-secrets missing**. Sprint 125 Wave C code (`token-encryption.service.ts`) requires the key but cluster Secret not reflected → new ReplicaSet CrashLoopBackOff 308 times (26 hours)
- **Choice (Track 1, temporary)**: Directly `kubectl patch` cluster Secret with same key used by gateway/github-worker + rollout restart → immediate production recovery. **0 user impact** (no re-authentication needed, DB tokens 4 entries preserved)
- **Choice (Track 2, formal)**: SealedSecret manifest PR (#2) to add key → however unseal failure due to controller key mismatch debt → absorbed into Wave B-2 (PR #3) for GitOps consistency recovery
- **Alternatives**: Issue new key → invalidate DB GitHub tokens 4 entries, force user re-authentication (not chosen)
- **PR**: [aether-gitops #2](https://github.com/tpals0409/aether-gitops/pull/2) (Track 2 draft), Track 1 is `kubectl patch` temporary → structural blocking decided in ADR-028 (dev server separation)

### D3: SealedSecret 8 items bulk re-seal — controller key mismatch debt clearance (Wave B-2)
- **Context**: After sealed-secrets controller key rotation (~2026-04-02, `sealed-secrets-keyqvbr5` 53d → `sealed-secrets-keycdlrs` 23d), 8 SealedSecret manifests not re-sealed. Cluster's unsealed Secret maintained in pre-rotation state with no production impact, but **manifest changes blocked from cluster application** — exposed in Wave A-2 PR #2
- **Choice**: Extract plaintext keys from cluster memory directly → re-seal with current active controller cert using `kubeseal --raw` → bulk replace `encryptedData:` blocks in 8 manifests. Preserve `apiVersion`/`kind`/`metadata`/`template:`
- **Alternatives**: Restore controller old key → increased infra complexity / Maintain only cluster Secret direct patch → permanent GitOps consistency break (not chosen)
- **Side effect**: `INTERNAL_KEY_AI_ANALYSIS` key missing from submission-service-secrets manifest (exists in cluster) → absorbed into manifest = **additional GitOps consistency recovery achieved simultaneously**
- **Verification**: After merge, all 8 in `kubectl get sealedsecret -n algosu` reached `Synced=True`, cluster Secret data sha256 hash identical before and after merge (plaintext value unchanged), production pod restarts 0
- **PR**: [aether-gitops #3](https://github.com/tpals0409/aether-gitops/pull/3) (`f458d55`)

### D4: AlertManager rule strengthening + receiver activation — incident recurrence blocking (Wave B-1)
- **Context**: Both Sprint 130 incidents had ArgoCD `Health=Degraded` status but left unnoticed for 26h~2 days 5 hours without alerts
- **Shocking finding (Architect)**: **alertmanager `receiver: 'null'`** — 13 existing rules (PodRestartFrequent, ServiceDown, OOMKilled, etc.) were firing normally but **all alerts were silently dropped**. The real root cause of Sprint 130 no-alerts was not rule absence but **outlet (receiver) itself disabled**
- **Choice**:
  1. AlertManager receiver activated: `null` → `discord-default` (warning, 1h repeat) + `discord-critical` (critical, 30m repeat, @here)
  2. PrometheusRule manifest: 6 new rules added: `KubePodCrashLooping`, `KubeDeploymentReplicasMismatch`, `KubeDeploymentRolloutStuck`, `ArgoCDAppDegraded`, `ArgoCDAppOutOfSync`, `ArgoCDAppSyncFailed`
  3. alertmanager v0.28.1 upgrade, reusing existing `identity-discord-secret` webhook (no new SealedSecret needed)
- **Verification**: promtool/amtool/kustomize all SUCCESS. Immediately after PR merge, Sprint 130 remaining firing (`PodRestartFrequent` 2 items) reached Discord channel → receiver activation verified simultaneously
- **PR**: [aether-gitops #4](https://github.com/tpals0409/aether-gitops/pull/4) (first PR adopting Sprint 130 naming)

### D5: Memory/sprint window correction (Wave D-3)
- **Context**: `sprint-window.md` not updated for 9 days since Sprint 92 ended. Sprint number misidentified at `/start` time (Sprint 93 → actual 130)
- **Choice**: Correct sprint-window.md to [1]=Sprint 129 / [2]=Sprint 130. Add Sprint 93~129 bundled archive row to MEMORY.md table. PR/branch/commit `sprint-93` naming difficult to correct retroactively, so permanently recorded in ADR-026 naming error mapping table
- **Alternatives**: Force correct all PR/commit messages (rebase) → risk of changing merged history, ADR mapping is sufficient

### D6: Structural guard ADR proposals (Wave C-2 + dev server separation)
- **Choice**: Two ADRs written in proposed status. Implementation decision + adoption in Sprint 131
  - **ADR-027**: aether-gitops branch discipline (work branch + PR + auto-merge blocking main direct push)
  - **ADR-028**: Dev server (k3d/separate dev cluster) separation (structural blocking of direct production modification anti-pattern)

### D7: Incident comprehensive ADR (Wave E-1)
- **Choice**: ADR-026 written — timeline, 4 root causes, learnings, naming error mapping permanently recorded

---

## Patterns

### P1: Avoid `req.path` in NestJS `forRoutes('*')` middleware — use `req.originalUrl`
- **Where**: `services/submission/src/common/middleware/gateway-context.middleware.ts:64`
- **When to Reuse**: When doing path matching with `req.path` in NestJS `consumer.apply(...).forRoutes('*')` or wildcard routes. May cause regression where mount-strip interprets as `/` — use `req.originalUrl ?? req.url` for non-stripped path
- **Verification pattern**: Inject `originalUrl`/`url` together in unit test mocks (production simulation). `path`-only setter cannot detect regressions

### P2: SealedSecret bulk re-seal (after controller key rotation)
- **Where**: `aether-gitops/algosu/base/sealed-secrets/`
- **When to Reuse**: When sealed-secrets controller key rotation or SealedSecret unseal failure found
- **Steps**:
  1. Extract plaintext keys from cluster to memory (shell variable) only: `kubectl get secret -n <ns> <name> -o json | jq -r '.data | to_entries[] | "\(.key)=\(.value | @base64d)"'`
  2. Seal each key-value: `echo -n "$VAL" | kubeseal --raw --namespace <ns> --name <secret>`
  3. Replace only manifest `encryptedData:` block (preserve apiVersion/kind/metadata/template)
  4. Dry-run unseal verification with `kubeseal --validate`
  5. Absolutely no plaintext value exposure in disk/log/PR/commit message, clear history after work

### P3: Cluster Secret data hash comparison for plaintext value unchanged verification
- **Where**: SealedSecret re-seal PR merge verification step
- **Steps**:
  - Before merge: capture baseline with `kubectl get secret -n <ns> <name> -o json | jq -S '.data' | sha256sum`
  - Wait for ArgoCD sync completion after merge
  - Calculate hash again → compare diff
  - If identical, plaintext value unchanged → cluster impact confirmed none

### P4: Production hotfix Track 1 + Track 2 pattern
- **When to Reuse**: When production recovery is urgent with GitOps flow blocked
- **Track 1 (immediate recovery)**: Direct cluster patch — but separately record in ADR + maintain consistency with memory `feedback_avoid_prod_direct_edit.md`
- **Track 2 (post-reconciliation)**: Absorb cluster traces into manifest via GitOps PR — process within same Sprint as Track 1

---

## Gotchas

### G1: Memory window not updated → wrong sprint number at `/start`
- **Symptom**: Wrong sprint number embedded in PR/branch/commit messages (e.g., Sprint 93 → actual 130)
- **Root Cause**: `/start` skill depends solely on `sprint-window.md`, no cross-check with `docs/adr/sprints/`
- **Fix**: In this Sprint, permanently recorded via ADR-026 naming error mapping. Automation is a Sprint 131+ candidate

### G2: No procedure for SealedSecret manifest re-seal after controller key rotation
- **Symptom**: SealedSecret in `Status=False (no key could decrypt secret)` state. Cluster Secret maintained in pre-rotation state with no production impact → **no alerts** → exposed only when manifest changes blocked from cluster application
- **Root Cause**: No manifest re-seal synchronization procedure for either automatic/manual rotation
- **Fix**: Bulk re-seal in this Sprint Wave B-2. Automation (CI job) is a Sprint 131+ candidate

### G3: NestJS `forRoutes('*')` unit test cannot catch mount-strip regression
- **Symptom**: Production regression not detected by direct `req.path` mock injection in spec.ts
- **Root Cause**: Express middleware mount behavior not simulated in unit test environment
- **Fix**: Inject `originalUrl`/`url` mock together (production simulation). Adding e2e integration tests is a P3 follow-up

### G4: aether-gitops main direct push allows missing commit to bypass PR review
- **Symptom**: identity-service-secrets key addition missing in `f5f391d` commit. Single reviewer flow allowed human error through
- **Fix**: Structurally blocked when ADR-027 (branch discipline introduction) is adopted

### G5: Production cluster `kubectl` direct modification environment
- **Symptom**: Direct cluster Secret patch in Sprint 130 Track 1. GitOps consistency temporarily broken + change tracking difficult
- **Fix**: Structurally blocked when ADR-028 (dev server separation + production read-only) is adopted

### G6: alertmanager `receiver: 'null'` causes all alerts to silently drop
- **Symptom**: 13 PrometheusRules were firing normally but operators were not notified. ArgoCD `Health=Degraded` also without alerts. Direct cause of Sprint 130 two incidents 6 days/26 hours unnoticed + sealed-secrets controller key mismatch 23 days unnoticed
- **Root Cause**: alertmanager.yaml receiver set to `null` → all routing mapped to discard destination. Would not have been found by checking rules alone (rule inventory was normal)
- **Fix**: Activated `discord-default` + `discord-critical` in Wave B-1 (PR aether-gitops #4). **End-to-end verification including receiver behavior is required when checking, not just rules** (amtool/actual Discord reach test)
- **Recurrence prevention**: Consider adding self-test rule for alertmanager receiver behavior monitoring in Sprint 131 (e.g., fire dummy alert every 5 minutes → high alert if Discord not reached)

---

## Metrics
- Commits (AlgoSu): 1 (PR #157)
- Commits (aether-gitops): 2 (PR #2, #3)
- Manifest changes: SealedSecret 8 + identity additional key 1 + submission INTERNAL_KEY_AI_ANALYSIS absorption 1
- Code changes: middleware 1 line + 7 tests added
- New ADRs: 3 (ADR-026, ADR-027, ADR-028)
- New memory: 2 (`feedback_critic_unavailable.md`, `feedback_avoid_prod_direct_edit.md`)
- Recovery time: Production stuck 26 hours/2 days 5 hours → **complete recovery within ~4 hours** after Sprint 130 recognition
- User impact: **0** (old version traffic served, no re-authentication required)
- ArgoCD: Degraded → **Healthy**

## Carried Over (Sprint 131)
- ADR-027 / ADR-028 implementation (branch discipline + dev server separation)
- C-1 unused ReplicaSet cleanup + revisionHistoryLimit
- D-1 E2E Integration Test failure investigation
- D-2 CB + classic queue infinite requeue prevention (Sprint 92 G1 carryover)
- SealedSecret controller key rotation automatic re-seal CI job
- Add `docs/adr/sprints/` cross-check to `/start` skill
