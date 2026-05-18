---
sprint: 133
title: "Carryover Item Processing — GuestNav LanguageSwitcher Mount + Operational Debt Reconnaissance"
date: "2026-04-26"
status: completed
agents: [Oracle, Herald, Scout]
related_adrs: ["ADR-026"]
---

# Sprint 133: Carryover Item Processing

## Decisions

### D1: GuestNav LanguageSwitcher Mount (Wave A-1)
- **Context**: In Sprint 129, LanguageSwitcher was mounted at 4 locations (AppLayout L384/L464, AuthShell L43, LandingContent L80). Sprint 132 added the 5th mount in LegalLayout. GuestNav (`/guest`, `/guest/preview/[slug]`) has its own nav (Logo + ThemeToggle + signup CTA) but LanguageSwitcher is not mounted — Korean/English switching unavailable on guest pages.
- **Choice**: Added `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` to the right actions div of GuestNav (placed before ThemeToggle). Unified as 6th mount point. Created GuestNav.test.tsx with 4 cases.
- **Alternatives**: Placing after ThemeToggle → visual position inconsistency with other mount points.
- **Code Paths**: `frontend/src/components/guest/GuestNav.tsx:73-75`, `frontend/src/components/guest/__tests__/GuestNav.test.tsx`
- **PR**: [#163](https://github.com/tpals0409/AlgoSu/pull/163) (`ea9ac28`, Squash merge)

### D2: SharedLayout LanguageSwitcher — Policy Exclusion Maintained (Wave A-2)
- **Context**: SharedLayout (`/shared/[token]`) is `<>{children}</>` empty fragment — no nav present. Mounting LanguageSwitcher would require designing a new nav container.
- **Choice**: Policy exclusion maintained. For shared links, fixing the locale of the link issuer is better UX. Consistent with Sprint 132 D2 policy decision.
- **Alternatives**: ① Add mini nav (requires design decision, exceeds scope) / ② Delegate to page.tsx top (awkward UX)
- **Rationale**: Language switching on unauthenticated shared links deviates from issuer intent. Forcibly mounting on a layout without nav is excessive.

### D3: D-2 Queue Requeue Prevention — Already Implemented (Wave B)
- **Context**: Sprint 130 ADR-026 carryover item. Scout reconnaissance revealed DLQ (`submission.events.dlx`) + NACK (`channel.nack(msg, false, false)`) + Redis idempotency + Saga timeout (5/15/30 minutes) + max 3 retries are fully implemented.
- **Choice**: D-2 carryover resolved. Circuit Breaker pattern absence is a separate item → Sprint 134+ seed.
- **Code Paths**: `services/github-worker/src/worker.ts:132,224,350-402`, `services/submission/src/saga/mq-publisher.service.ts:88-105,149-207`, `services/submission/src/saga/saga-orchestrator.service.ts:34-42,455`

### D4: infra Manifest Absence Confirmed — C-1 Not Workable in This Repo (Wave B Reconnaissance) ⚠️ **Post-hoc Correction (2026-04-27)**
- **Context**: During Scout reconnaissance, confirmed that the `infra/` directory does not exist in this AlgoSu repo. k8s manifests exist only in the external aether-gitops repo.
- **Choice**: All manifest changes including C-1 (adding revisionHistoryLimit) require separate work in the aether-gitops repo. Deferred to Sprint 134+.

### D4 Correction (Post Sprint 133, 2026-04-27)
- **Fact correction**: The `infra/` directory **actually exists** in this repo. The `find infra/ ...` command during Sprint 133 Wave B reconnaissance returned empty results due to shell globbing / argument form issues, leading to the incorrect conclusion of "absent."
- **Actual structure**:
  - `infra/k3s/` — base Kustomize manifests (gateway/frontend/postgres/redis/rabbitmq/minio/identity/problem/submission/github-worker/ai-analysis and all other services)
  - `infra/overlays/{dev,staging,prod}/` — environment-specific Kustomize overlays (already separated, basis for ADR-028 Option A)
  - `infra/sealed-secrets/` — SealedSecret templates
  - `infra/DEPLOYMENT.md` — deployment guide (L115 specifies `revisionHistoryLimit: 3` policy)
- **C-1 reclassification**: Applying revisionHistoryLimit is **directly modifiable in this repo's `infra/k3s/*.yaml`**. Not an aether-gitops external task. Corrected to Sprint 134 work candidate.
- **Verification pattern lesson**: Scout reconnaissance `find <dir>` empty result may not mean directory absence — could be a command argument / globbing problem. Triple-check with `ls -la <dir>` + `test -d <dir>` + `find <dir> -type f | head`.
- **Related ADR**: ADR-028 (partially applied confirmed), user statement 2026-04-27 "development server is already separated."

## Patterns

### P1: LanguageSwitcher Mount Pattern — 6th Repetition
- **Where**: GuestNav.tsx (Client Component)
- **Pattern**: `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` — right actions area, first position to the right of ThemeToggle or nav.
- **Precedent**: AppLayout (L384/L464), AuthShell (L43), LandingContent (L80), LegalLayout (L36-38), GuestNav (L73-75)
- **When to Reuse**: When language switching is needed in new layouts. Apply only when a nav container already exists. When no nav exists, policy exclusion decision must come first.

## Metrics

| Item | Value |
|------|-------|
| Total changes | +80 lines, -1 line (2 files) |
| jest | 1357 → **1361** (+4) |
| tsc | clean |
| lint | clean |
| Critic | Omitted (6th repetition of existing pattern, 0 new logic) |
| PR | [#163](https://github.com/tpals0409/AlgoSu/pull/163) Squash merge `ea9ac28` |
| CI | 15 pass / 5 skipping / 0 fail |
| end_commit | `ea9ac28` |

## Carryover (Sprint 134+)

Unprocessed operational debt from Sprint 130 (external repo or infra-dependent):
- [ ] ADR-027 implementation — aether-gitops branch discipline
- [ ] ADR-028 implementation — development server separation (infra cost decision required)
- [x] C-1: revisionHistoryLimit: 3 applied — applied to 8 Deployments in `infra/k3s/*.yaml` in this repo (applied via Sprint 134 PR)
- [x] D-1: Post-hoc correction — e2e-full.sh 657 lines confirmed to exist, .github/workflows/ci.yml workflow_dispatch manual-only. Auto PR CI integration reclassified as Sprint 135 new seed (Sprint 134 correction)
- [ ] SealedSecret controller key rotation auto-resealing CI
- [ ] AlertManager receiver self-test rule

New seeds:
- [ ] Circuit Breaker pattern introduction (GitHub API, Problem Service, AI Analysis Service HTTP calls)
