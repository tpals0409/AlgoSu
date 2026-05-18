---
sprint: 131
title: "Sprint 129 Seed Closure — TopNav Dead Code Removal + AppLayout Test Deduplication + /start ADR Cross-Check"
date: "2026-04-25"
status: completed
agents: [Oracle]
related_adrs: ["ADR-026"]
---

# Sprint 131: Sprint 129 Seed Closure + Minor Maintenance

## Decisions

### D1: TopNav Dead Code Full Removal (Wave A)
- **Context**: Seed 1 identified in Sprint 129 Critic 1st review. `TopNav.tsx` (392 lines) is completely dead code with 0 production imports since AppLayout was introduced. `TopNav.test.tsx` (551 lines) is also dead code.
- **Choice**: Delete TopNav.tsx + TopNav.test.tsx + replace 5 `@related TopNav` comments with AppLayout references (LanguageSwitcher, StudySidebar, avatars.ts, study-room/page.tsx)
- **Verification**: Confirmed 0 remaining references via `grep -rn "TopNav" frontend/src/`
- **Code Paths**: Deleted — `frontend/src/components/layout/TopNav.tsx`, `frontend/src/components/layout/__tests__/TopNav.test.tsx`
- **PR**: [#159](https://github.com/tpals0409/AlgoSu/pull/159) (`411479b`)

### D2: AppLayout.test.tsx Duplicate Test Case Removal (Wave B)
- **Context**: Seed 2 identified in Sprint 129 Critic 1st review. L189-196 Case 1 ("dashboard nav is active on locale-stripped /dashboard path") and L198-203 Case 2 ("dashboard nav activated on Korean locale /dashboard — regression") have identical behavior: both use `mockUsePathname.mockReturnValue('/dashboard')` + `bg-primary-soft` assertion.
- **Choice**: Preserve Case 1 (clearly expresses locale-stripped meaning), delete Case 2 (-6 lines)
- **Code Paths**: `frontend/src/components/layout/__tests__/AppLayout.test.tsx` L198-203 deleted
- **PR**: [#159](https://github.com/tpals0409/AlgoSu/pull/159) (`411479b`)

### D3: Sprint Number ADR Cross-Check Added to /start Skill (Wave C)
- **Context**: Prevention of Sprint 130 ADR-026 G1 (sprint number confusion due to missing memory window update). During Sprint 125~130, sprint-window.md was stuck at Sprint 92, causing PR/branch naming contamination with `sprint-93`.
- **Choice**: Added step 2.5 to `/start` skill — compares the latest ADR number in `docs/adr/sprints/` with the sprint-window.md [2] number within a ±2 range, outputs a warning if mismatched.
- **Note**: `.claude/` directory is included in `.gitignore`, so only local application is possible. Git tracking not available.

## Metrics

| Item | Value |
|------|-------|
| Total changes | -955 lines (5 insertions, 955 deletions) |
| jest | 1356 passing (1408 → 1356, -52 tests: TopNav 51 + duplicate 1) |
| tsc | clean |
| lint | clean |
| CI | 30+ checks all SUCCESS |
| Critic | Codex gpt-5.4 session `019dc4a9-5025-7262-baec-d0f4caa83885` — ready to merge ✅ |
| PR | [#159](https://github.com/tpals0409/AlgoSu/pull/159) Squash merge `411479b` |
| Commits | 1 (squash) |
| end_commit | `411479b` |

## Carryover (Sprint 132 Candidates)

Remaining unprocessed items from Sprint 130 carryover (6 items):
- [ ] ADR-027 implementation — aether-gitops branch discipline
- [ ] ADR-028 implementation — development server separation
- [ ] C-1: Unused ReplicaSet cleanup + revisionHistoryLimit
- [ ] D-1: E2E Integration Test failure investigation
- [ ] D-2: Circuit Breaker + classic queue infinite requeue prevention
- [ ] SealedSecret controller key rotation auto-resealing CI
- [ ] AlertManager receiver self-test rule
