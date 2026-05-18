# ADR-026: Sprint 130 Operations Incident — Stuck Rollouts Left for 6 Days + SealedSecret Controller Key Mismatch Debt

- **Status**: Accepted
- **Date**: 2026-04-25
- **Sprint**: Sprint 130 (Wave E-1)
- **Decision maker**: Oracle
- **Related**: ADR-027 (aether-gitops branch discipline), ADR-028 (dev cluster separation)

---

## Context

### Incident Timeline

| Time | Event |
|---|---|
| **~2026-04-02** | sealed-secrets controller key rotation (`sealed-secrets-keyqvbr5` 53d → `sealed-secrets-keycdlrs` 23d). **8 SealedSecret manifests not re-sealed** (identity, submission, problem, postgres, postgres-problem, rabbitmq, redis, monitoring). Cluster Secrets already kept unsealed so no operational impact |
| **2026-04-16** | Sprint 92 closed ("AI analysis hotfix"). Last update to memory `sprint-window.md` — window not updated for the next 9 days |
| **2026-04-23 03:24 KST** | Sprint 121 PR #138 ("i18n foundation") merged. submission `services/submission/src/common/middleware/gateway-context.middleware.ts` newly introduced. **Regression from `req.path` with NestJS `forRoutes('*')` mount-strip → `/health` probe 401**. New ReplicaSet starts infinite CrashLoop |
| **2026-04-24 16:44 KST** | Sprint 125 Wave C PR #144 (`27d3f95`) merged. identity `services/identity/src/user/token-encryption.service.ts` newly introduced + `GITHUB_TOKEN_ENCRYPTION_KEY` required. However, during SealedSecret manifest re-sealing in aether-gitops commit `f5f391d`, **the key was missing from identity-service-secrets** (only gateway/github-worker were updated). identity new ReplicaSet starts infinite CrashLoop |
| **~2026-04-23 ~ 2026-04-25** | Both incidents left in ArgoCD `Health=Degraded` state **without alerts** — submission 2 days 5 hours (867 restarts), identity 26 hours (314 restarts) |
| **2026-04-25** | Oracle diagnosis + Sprint 130 starts → recovery within 4 hours |

### Discovered Impact Scope
- **SealedSecret controller key mismatch (8 items)**: Blocks cluster reflection when manifests change. Exposed after PR #2 merge in Sprint 130 Wave A-2 when identity-service-secrets unseal fails
- **submission-service-secrets `INTERNAL_KEY_AI_ANALYSIS` missing from manifest**: Exists in cluster → someone patched cluster directly in the past then failed to update manifest (exact time unknown)
- **Memory window not updated for 9 days**: 37 ADRs were written to the codebase between Sprint 92 → 130 but not reflected in the memory window. Sprint number was misread at /start time (Sprint 93 → actual Sprint 130)

---

## Root Causes

1. **No AlertManager rules/receivers**
   - ArgoCD `Health=Degraded` and k8s pod CrashLoopBackOff were not reported to the operator
   - Exact missing items: inspected in Sprint 130 Wave B-1 (separate PR)

2. **No manifest re-sealing procedure for SealedSecret controller key rotation**
   - Unknown whether rotation 23 days ago was automatic or manual
   - The re-sealing omission itself was not alerted (sealed-secrets controller `Status=False` only visible inside the cluster)

3. **aether-gitops main direct push flow**
   - `f5f391d` ("add GITHUB_TOKEN_ENCRYPTION_KEY to gateway + github-worker SealedSecrets") omission merged without PR review
   - `INTERNAL_KEY_AI_ANALYSIS` direct patch trace also lacks PR verification

4. **No automated memory window update**
   - `/start` skill references only sprint-window.md for sprint number
   - No cross-check with `docs/adr/sprints/` → incorrect starting point possible

---

## Decision

### Immediate Actions (Within Sprint 130)
1. **Fix submission /health regression** — `req.path` → `req.originalUrl` (PR #157, merged)
2. **Recover identity key omission** — cluster patch (Track 1, PR #2) + re-seal 8 SealedSecrets (PR #3, merged) — GitOps consistency simultaneously restored
3. **Strengthen AlertManager rules** — Wave B-1 separate PR (Architect in progress)
4. **Correct memory/sprint window** — Rename to Sprint 130, update sprint-window.md

### Separate ADRs (Structural Guards)
- **ADR-027**: aether-gitops branch discipline (work branch + PR + auto-merge)
- **ADR-028**: Dev server (k3d/separate dev cluster) separation — block direct production modifications

### Future Automation Candidates (Sprint 131+)
- Automatic re-sealing trigger (CI job) on SealedSecret controller key rotation
- `/start` skill cross-checks `docs/adr/sprints/` directory + auto-infers sprint number
- `/stop` skill forces sprint-window.md update (currently manual)

---

## Consequences

### Positive
- Production recovery within 4 hours in Sprint 130 + 100% GitOps consistency restored
- Recurrence prevention guards proposed via two ADRs → structural blocking when implemented in Sprint 131
- Incident learning permanently recorded

### Negative
- ADR-027/028 implementation deferred to Sprint 131 → same incidents remain possible in the interim (though alert guard B-1 shortens detection time)
- Sprint naming error (`sprint-93` embedded in PR #157, #2, #3) difficult to correct retroactively — this ADR serves as the mapping record

### Neutral
- Production traffic was handled by the old pod version during both incidents → minimal user impact. However, new features (i18n, OAuth normalization) not reflected = functionally stale

---

## Naming Error Mapping

Due to the memory window not being updated, PR/branch/commit messages had `sprint-93` embedded. Actual sprint is **Sprint 130**.

| Artifact | Named as | Actual Sprint |
|---|---|---|
| AlgoSu PR #157 | `fix(submission): /health probe 401 regression fix — use req.originalUrl (Sprint 93 A-1)` | Sprint 130 A-1 |
| aether-gitops PR #2 | `fix(secret): add GITHUB_TOKEN_ENCRYPTION_KEY to identity-service-secrets (Sprint 93 A-2)` | Sprint 130 A-2 |
| aether-gitops PR #3 | `fix(secret): batch re-seal 8 SealedSecrets (Sprint 93 B-2)` | Sprint 130 B-2 |
| Work branches | `fix/sprint-93-*` | Sprint 130 |

Work from this PR onwards (B-1, subsequent PRs) adopts `sprint-130` naming.

---

## References
- PR #157 (AlgoSu) — Wave A-1
- PR #2, #3 (aether-gitops) — Wave A-2, B-2
- ADR-027 (aether-gitops branch discipline)
- ADR-028 (dev server separation)
- Sprint ADR: `docs/adr/sprints/sprint-130.md`
- Memory: `feedback_critic_unavailable.md`, `feedback_avoid_prod_direct_edit.md`, `MEMORY.md`
