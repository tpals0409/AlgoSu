---
sprint: 137
title: "Demo Account Avatar Image Fix — Seed Missing Asset Reference Correction"
date: "2026-04-27"
status: completed
agents: [Oracle, Conductor]
related_adrs: []
---

# Sprint 137: Demo Account Avatar Image Fix

## Sprint Goal

Diagnose the issue causing avatar images for demo accounts (`demo-alice`, `demo-bob`, `demo-charlie`) to appear broken (HTTP 404 on login), and correct the seed data to reference existing assets with minimal changes.

## Background

### Root Cause Diagnosis

In `scripts/demo-seed.sql` L48-50, the `avatar_url` values for the three demo accounts were set to `preset:avatar-1`, `preset:avatar-2`, and `preset:avatar-3`.

However, these keys do not exist in the `AVATAR_PRESETS` whitelist in `frontend/src/lib/avatars.ts`. The frontend constructs the path `/avatars/{key}.svg` from the preset key, but `avatar-1/2/3.svg` assets do not exist in the `public/avatars/` directory, resulting in HTTP 404.

**Summary**: seed → DB → API → frontend → `/avatars/avatar-{n}.svg` 404 → broken image

### Impact Scope

All three demo accounts display broken avatar images on the demo login page. No impact on functional logic (submission, AI analysis, peer review).

## Fix Options

### Option A (Adopted): Seed Data Correction — Replace with Existing Asset Keys

Replace `preset:avatar-1/2/3` → `preset:tree/graph/sort`.
`tree`, `graph`, and `sort` are registered keys in the `AVATAR_PRESETS` whitelist and their `/avatars/{key}.svg` assets exist.

**Reason for adoption**: Minimal change scope (1 file, 3 lines), full consistency with the existing avatar system, 0 side effects.

### Option B (Not Adopted): Add Missing Assets

Create new `avatar-1/2/3.svg` files in `public/avatars/` and register them in `AVATAR_PRESETS`.
**Reason for rejection**: Requires design asset decisions and unnecessarily widens the change scope. The structural issue of seed using keys outside the whitelist is already resolved by Option A.

### Option C (Not Adopted): Add Non-Validating Fallback to AVATAR_PRESETS

Add defensive logic to allow keys not registered in the whitelist.
**Reason for rejection**: Weakens the integrity verification layer and risks concealing future seed errors.

## Changes

| File | Lines | Change |
|------|-------|--------|
| `scripts/demo-seed.sql` | L48-50 | `preset:avatar-1/2/3` → `preset:tree/graph/sort` (+3 / -3) |

- **Total changes**: 1 file / +3 -3 (net diff 0)
- **Branch**: `fix/sprint-137-demo-avatar-seed` → PR → Squash merge (0 direct commits to main ✅)

## Verification Results

| Item | Result |
|------|--------|
| Asset existence | `/avatars/tree.svg`, `/avatars/graph.svg`, `/avatars/sort.svg` confirmed present |
| AVATAR_PRESETS | `tree`, `graph`, `sort` keys confirmed in whitelist |
| jest | 1361 passed (0 regressions) |
| tsc | clean |
| lint | clean |
| CI | 27 pass / 12 skipping / 0 fail |
| mergeStateStatus | CLEAN |

## Decisions

### D1: Option A — Simple Seed Data Correction

The change scope is minimized to 1 file and 3 lines, and system consistency is immediately restored by using existing assets and whitelist-registered keys. No new logic or architectural changes, making it the safest path.

### D2: Critic Not Invoked

The change is limited to replacing 3 string lines of seed data, which does not fall under Critic's review scope (code correctness, concurrency, data integrity, rollback possibility). Same policy applied as Sprint 131/132/133/134/136.

## Merge Information

- PR: [#174](https://github.com/tpals0409/AlgoSu/pull/174) — MERGED 2026-04-27
- Squash commit: `aaf6f7f`
- start_commit: `f580ce8` (Sprint 136 end)
- end_commit: `aaf6f7f` (origin/main, 2026-04-27)
- Branch: `fix/sprint-137-demo-avatar-seed` (auto-deleted after Squash merge)

## Outputs

- `scripts/demo-seed.sql` (modified)
- ADR: This document (`docs/adr/sprints/sprint-137.md`)

## Sprint 138+ Carryover

### New Seeds (from Sprint 137)

- [ ] `infra/k3s/demo-reset-cronjob.yaml` ConfigMap seed is in `SELECT 1;` placeholder state — needs to be updated with the content of `scripts/demo-seed.sql` when automating the production environment

### Accumulated Seeds (carried over from Sprint 135)

- [ ] github-worker errorFilter wrapper + WeakSet synchronization (Wave A consistency recovery)
- [ ] ai-analysis Python CB schema unification (state 0/0.5/1 → 0/1/2 + name label)
- [ ] CLAUDE.md `"ai-feedback"` → actual `"ai-analysis"` naming correction
- [ ] E2E auto PR CI integration (Sprint 134 carryover maintained)
