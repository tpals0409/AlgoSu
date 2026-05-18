---
sprint: 132
title: "LegalLayout LanguageSwitcher Mount — Language Toggle Exposed on /privacy, /terms"
date: "2026-04-26"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 132: LegalLayout LanguageSwitcher Mount

## Decisions

### D1: Suspense + LanguageSwitcher Mounted in LegalLayout Nav (Wave A)
- **Context**: In Sprint 129, LanguageSwitcher was mounted at 4 locations with Suspense pattern (AppLayout L384/L464, AuthShell L43, LandingContent L80). In Sprint 131, TopNav was deleted → AppLayout unified. However, LegalLayout (`/privacy`, `/terms`) is a separate layout with no LanguageSwitcher mounted — language switching unavailable when visiting legal pages.
- **Choice**: Added `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` to the right side of the LegalLayout Nav. Applied `justify-between` to the nav container for Logo left / LanguageSwitcher right placement. Kept Server Component (async); Client Component (LanguageSwitcher) is automatically handled by RSC→CC boundary.
- **Verification**: jest 1357 passing (+1), tsc/lint clean
- **Code Paths**: `frontend/src/components/layout/LegalLayout.tsx` (+8 lines), `frontend/src/components/layout/__tests__/LegalLayout.test.tsx` (+11 lines, LanguageSwitcher mock + mount verification)
- **PR**: [#161](https://github.com/tpals0409/AlgoSu/pull/161) (`fa1d68a`, Squash merge)

### D2: GuestNav / SharedLayout Excluded from Sprint 132 Scope (Policy Decision)
- **Context**: `/guest`, `/guest/preview/[slug]` (GuestNav), `/shared/[token]` (SharedLayout) also have LanguageSwitcher unmounted. Reconnaissance identified 5 candidates.
- **Choice**: By user policy decision, only LegalLayout was fixed. Guest pages can switch language via LanguageSwitcher on Landing (`/`) before entry; Shared links are read-only views where toggling is not necessary.

## Metrics

| Item | Value |
|------|-------|
| Total changes | +19 lines, -2 lines (2 files) |
| jest | 1357 passing (1356 → +1) |
| tsc | clean |
| lint | clean |
| Critic | Omitted (5th repetition of existing pattern, 0 new logic — same policy as Sprint 131) |
| PR | [#161](https://github.com/tpals0409/AlgoSu/pull/161) Squash merge `fa1d68a` |
| Commits | 2 (before squash: `29b6b8f` code + `ef5609d` ADR) |
| CI | 31 pass / 7 skipping / 0 fail |
| end_commit | `fa1d68a` |

## Carryover (Sprint 133+)

Unprocessed operational debt from Sprint 130:
- [ ] ADR-027 implementation — aether-gitops branch discipline
- [ ] ADR-028 implementation — development server separation
- [ ] C-1: Unused ReplicaSet cleanup + revisionHistoryLimit
- [ ] D-1: E2E Integration Test failure investigation
- [ ] D-2: Circuit Breaker + classic queue infinite requeue prevention
- [ ] SealedSecret controller key rotation auto-resealing CI
- [ ] AlertManager receiver self-test rule
- [ ] GuestNav LanguageSwitcher addition (excluded from Sprint 132 scope)
- [ ] SharedLayout LanguageSwitcher addition (excluded from Sprint 132 scope)
