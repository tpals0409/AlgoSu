---
sprint: 138
title: "demo-seed ConfigMap Auto Sync — Kustomize configMapGenerator + 3 DB Separation"
date: "2026-04-27"
status: completed
agents: [Oracle, Conductor]
related_adrs: ["sprint-137"]
---

# Sprint 138: demo-seed ConfigMap Auto Sync

## Sprint Goal

Sprint 137 follow-up seed — resolve the issue of `infra/k3s/demo-reset-cronjob.yaml`'s ConfigMap remaining in `SELECT 1;` placeholder state. Automate so that the 6-hour interval CronJob always reflects the **latest seed** by using `scripts/demo-seed.sql` as the single SSoT and auto-generating the ConfigMap with Kustomize `configMapGenerator`.

## Background

### Remaining Issue from Sprint 137

Sprint 137 resolved the demo account avatar broken image, but the production demo auto-reset pipeline still referenced the placeholder ConfigMap (`data: { demo-seed.sql: "SELECT 1;" }`). This meant that even though the CronJob ran every 6 hours, the actual seed was not being applied, leaving a latent risk that the same broken image state could recur in the production demo environment.

### Structural Root Cause

- `scripts/demo-seed.sql` (code SSoT) ↔ inline ConfigMap in `demo-reset-cronjob.yaml` (operational SSoT) — dual source
- Code changes required **manual synchronization** of the yaml ConfigMap, which was missed at the time of Sprint 137

## Fix Options

### Option A (Adopted): Kustomize configMapGenerator + 3 DB Separation

Add `configMapGenerator` to `infra/k3s/kustomization.yaml` to register `scripts/demo-seed-*.sql` files directly as ConfigMap data. Use the `disableNameSuffixHash` option to prevent ConfigMap names from varying with content hashes, enabling the CronJob to reference them with static names.

At the same time, split `scripts/demo-seed.sql` from a single file into 3 DB-separated files:
- `scripts/demo-seed-identity.sql` — identity-service DB seed
- `scripts/demo-seed-problem.sql` — problem-service DB seed
- `scripts/demo-seed-submission.sql` — submission-service DB seed (separated from old `demo-seed.sql`)

Mount each DB's ConfigMap independently so the CronJob injects only the correct seed into each service's DB.

**Reason for adoption**: Unifies code SSoT and operational SSoT + future seed changes are automatically reflected + DB boundaries are clearly separated.

### Option B (Not Adopted): Keep Single Inline ConfigMap + CI Sync Verification

Add a script to CI that verifies equivalence between `scripts/demo-seed.sql` and the yaml inline ConfigMap.
**Reason for rejection**: The duplication itself is maintained, leaving the root cause of sync omissions unresolved. CI guards are ultimately post-hoc verification.

## Changes

| File | Lines | Change |
|------|-------|--------|
| `infra/k3s/kustomization.yaml` | +9 | Add 3 `configMapGenerator` entries (identity/problem/submission) + `disableNameSuffixHash` |
| `infra/k3s/demo-reset-cronjob.yaml` | -18 / +18 | Remove placeholder ConfigMap section + update to mount 3 ConfigMap references |
| `scripts/demo-seed-identity.sql` | +63 | New identity-service DB seed (separated from old `demo-seed.sql`) |
| `scripts/demo-seed-problem.sql` | +121 | New problem-service DB seed |
| `scripts/demo-seed.sql` → `scripts/demo-seed-submission.sql` | rename / -182 | Only submission-service area remains |

- **Total changes**: 5 files / +207 -186 (1 rename)
- **Branch**: `fix/sprint-138-demo-seed-configmap-sync` → PR #176 → Squash merge (0 direct commits to main ✅)

## Verification Results

| Item | Result |
|------|--------|
| `kubectl kustomize build` | 3 ConfigMaps generated correctly (identity/problem/submission) |
| ConfigMap name stability | `disableNameSuffixHash` applied — name fixed even when content changes |
| CronJob mount | 3 ConfigMaps referenced correctly |
| Other manifest regressions | 0 |
| CI | All checks passed (mergeStateStatus CLEAN) |

## Decisions

### D1: Option A — Kustomize configMapGenerator + 3 DB Separation

Removes the duplication itself by auto-syncing the code SSoT (`scripts/demo-seed-*.sql`) and the operational ConfigMap at build time. Since the CronJob runs automatically every 6 hours, the latest seed is automatically applied at the **merge → ArgoCD sync → next CronJob execution** point.

DB separation aligns with service boundaries, ensuring that future changes to a single DB seed do not affect other DBs.

### D2: `disableNameSuffixHash` Applied

Default `configMapGenerator` appends a content hash suffix to ConfigMap names (`demo-seed-identity-h7g8f9...`). While this is advantageous for triggering automatic rollouts on ConfigMap updates, in this case where the CronJob must reference ConfigMaps by **static names**, it would require yaml updates every time. `disableNameSuffixHash: true` fixes the name, simplifying CronJob references.

### D3: Critic Not Invoked

This is a simple structural change to infrastructure yaml (file separation + use of Kustomize features) with 0 new business logic. Does not fall under Critic's review scope (code correctness, concurrency, data integrity, rollback possibility). Same policy applied as Sprint 131/132/133/134/136/137.

## Merge Information

- PR: [#176](https://github.com/tpals0409/AlgoSu/pull/176) — MERGED 2026-04-27
- Squash commit: `71d1153`
- start_commit: `3c92997` (Sprint 137 end)
- end_commit: `71d1153` (origin/main, 2026-04-27)
- Branch: `fix/sprint-138-demo-seed-configmap-sync` (to be auto-deleted after Squash merge)

## Outputs

- `infra/k3s/kustomization.yaml` (modified — `configMapGenerator` added)
- `infra/k3s/demo-reset-cronjob.yaml` (modified — placeholder removed)
- `scripts/demo-seed-identity.sql` (new)
- `scripts/demo-seed-problem.sql` (new)
- `scripts/demo-seed-submission.sql` (renamed from `demo-seed.sql`)
- ADR: This document (`docs/adr/sprints/sprint-138.md`)

## Sprint 139+ Carryover

### Accumulated Seeds (carried over from Sprint 135, unresolved after Sprint 138)

- [ ] github-worker errorFilter wrapper + WeakSet synchronization (Wave A consistency recovery)
- [ ] ai-analysis Python CB schema unification (state 0/0.5/1 → 0/1/2 + name label)
- [ ] CLAUDE.md `"ai-feedback"` → actual `"ai-analysis"` naming correction
- [ ] E2E auto PR CI integration (Sprint 134 carryover maintained)

### Separate Processing Needed

- [ ] `docs/adr/sprints/sprint-136.md` in untracked state — written at Sprint 136 end but not committed (separate Housekeeping PR needed)

### Post-Operational Verification

- [ ] After merge, confirm ArgoCD sync + verify demo login broken image recovery at the next CronJob execution (production environment work)
