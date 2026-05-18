---
sprint: 124
title: "Sprint 123 Carry-Over Closure — i18n Component Completion + Sprint 118 P1 Security 3 Items + Oracle Infrastructure Stabilization + 2 Design ADRs"
period: "2026-04-24"
status: completed
start_commit: 340cc0c
end_commit: 0bf8091
---

# Sprint 124 — Sprint 123 Carry-Over Closure

## Background

Sprint 123 completed only Phase A (component translation 48 files × 6 Waves), with Phase B~E carried over. Sprint 124 aims to close the 4 carry-over Phases (admin/studies page translations, Sprint 120 P1 security, i18n quality remaining, test infrastructure) while structurally resolving Oracle dispatch pipeline stability defects (Write blocking, unstable auto-critic chain, stale task loops).

---

## Phase 0 — Housekeeping

1. Branch rename: `feature/sprint-123-phase-b-admin` → `feature/sprint-124-carryover`
2. Sprint 123 ADR commit (`5500b06`) — was 216 lines in untracked state
3. audit-queue JSON path update: p1-024/p1-025 file fields updated to `[locale]` paths (reflecting Sprint 121 i18n refactoring)

---

## Phase G — Oracle Infrastructure Improvements (`~/.claude/oracle/`, outside git)

Resolving Write blocking that recurred 6 times + 3 unstable auto-critic chain occurrences from Sprint 123.

| # | Change | File |
|---|--------|------|
| G-1 | Add `--add-dir ${INBOX_DIR}` to `claude -p` invocation | `bin/oracle-spawn.sh` |
| G-3a | Guarantee `cd "${project_dir}"` in cleanup trap + per-step log redirect (`-critic.log`, `-reap.log`, `-dispatch.log`) | `bin/oracle-spawn.sh` |
| G-3b | Add `-C "$project_dir"` to git commands for directory-independent stability | `bin/oracle-auto-critic.sh` |
| G-4a | New `is_agent_alive()` function (`pgrep -P pane_pid -f claude`) | `bin/_lib.sh` |
| G-4b | Integrate `●` (alive) / `○` (dead) display in oracle-status.sh active agent lines | `bin/oracle-status.sh` |
| G-5 | [Additional fix] `is_task_stale()` — age > `ORACLE_STALE_HOURS` (default 2h) + no lock → auto-mark as cancelled | `bin/oracle-dispatch.sh` |

---

## Phase B — i18n Component Completion (3 Waves, 18 commits)

### B1 (5 commits, base 5500b06)

- `studies` namespace newly created (15th)
- `studies/page` (61) + `studies/[id]/page` (55) + `studies/[id]/room/page` (19) + `studies/[id]/settings/page` (111) translations
- 154 new translation keys (ko/en)
- Critic: merge-ready (L1 void useRouter, L2 Korean in tests — corrected in B2/Sprint 125 carry-over)

### B2 (7 commits, base 5500b06)

- `admin` / `sharing` / `legal` namespaces newly created (16th~18th)
- guest under `common.guest.*` (avoid independent namespace)
- `admin/feedbacks` (65) + `shared/[token]` (93) + `privacy` (54) + `terms` (51) + `guest` (16) translations
- privacy/terms converted to async Server Component (SSR SEO optimization side effect)
- B1 Critic Low (void useRouter) correction included
- 151 new translation keys
- Critic: ⚠️ Conditional → resolved via B2-fix

### B2-fix (6 commits, base f6c7735)

- 10 production `toLocaleDateString`/`toLocaleTimeString('ko-KR')` hardcodings migrated to `useLocale()`
  - Critic-identified 5 spots (admin/feedbacks 3, shared/[token] 2) + Oracle global grep 5 additional spots (studies/room AnalysisView/SubmissionView, submissions/analysis, submissions/status, analytics)
- `shared/[token]` AI category safe lookup fallback (via `t.has`)
- Critic: ✅ merge-ready

---

## Phase C — Sprint 120 P1 Security 3 Items (2 Waves, 6 commits)

### architect consultation (task-20260424-103725-44440)

- Compared 4 options for p1-024 resolution (Middleware / Server Component / keep CSR / Hybrid cookie mirror)
- Key finding: JWT is already stored as httpOnly Cookie (Sprint 120 migration complete) — corrected task premise
- Recommendation: Option B (Server Component) — JWT_SECRET not exposed to frontend + SealedSecret unchanged + middleware.ts 100% compatible

### C main dispatch (5 commits)

- **C-1 (p1-023)**: Add `/shared`, `/privacy`, `/terms` to middleware `PUBLIC_PATHS`
- **C-2a (infra)**: Add `GATEWAY_INTERNAL_URL` env (non-sensitive)
- **C-2b**: New `admin-guard.ts` — `requireAdmin(locale)` Server util, `cookies()` + Gateway `/auth/profile` fetch + fail-secure redirect
- **C-2c (p1-024)**: `admin/layout.tsx` remove `'use client'` → async Server Component migration → block non-admin bundle exposure
- **C-3 (p1-025)**: OAuth callback `ALLOWED_ERRORS` enum + 12 new translation keys

### C-fix (1 commit)

- Critic P2 finding: `ALLOWED_ERRORS` mismatches Gateway actual emit codes (`access_denied`/`missing_params`/`auth_failed`) — caused by Oracle consultation message error
- Re-synced after measuring actual `Gateway oauth.controller.ts:97-144`
- Removed 4 keys, added 3 keys

---

## Phase D — i18n Quality + ADR Documentation (4 tasks, 6 commits)

### Parallel Dispatch

- palette D1+D2 (tier3, 7m) + scribe ADR (tier2, 1m) simultaneously spawned, separate panes
- Phase G-4 `is_agent_alive` indicator working correctly in parallel confirmed

### palette D1 (1 commit)

- Zod schemas 4 (study/submission/problem/feedback) integrated with `errorMap` i18n
- 12 new keys in `errors.validation.*` section
- Applied `tErrors()` to 5 form usage sites + `problem-form-utils` + `schemas.test.ts`

### palette D2a (1 commit)

- `lib/date.ts` `relativeTime(dateStr, locale='ko')` parameter added
- `RELATIVE_LABELS` map: ko + en support
- `useLocale()` passed at 2 call sites

### palette D2b (1 commit)

- Removed `hour12: true` (`shared/[token]`:540, `submissions/analysis`:298)

### scribe ADR 2 items

- **ADR-024** `admin-server-guard.md` (accepted) — Option B selection rationale + 4-option comparison table
- **ADR-025** `gateway-oauth-error-normalization.md` (proposed) — invalid_state dead code resolution proposal, Sprint 125+ implementation

### D-hotfix (1 commit)

- Critic P2 finding: `problems/[id]/edit/page.tsx` exposes raw `validateProblemForm` i18n keys
- 5-line change (import 1 + declaration 1 + L540/591/623 `tErrors` wrapping)
- Critic re-verification had API 529 Overloaded → Oracle spot approval (create/page.tsx pattern match confirmed)

---

## Critic Chain Summary (7 rounds)

| Target | Result | Notes |
|--------|--------|-------|
| B1 | ✅ Merge-ready (Medium 1, Low 2) | useRouter global deferred to Sprint 125 |
| B2 | ⚠️ Conditional → resolved via B2-fix | P2 3 items (ko-KR hardcoding) |
| B2-fix | ✅ Merge-ready | M-1/L-1 deferred to Phase D |
| C | ⚠️ Conditional → resolved via C-fix | P2 1 item (ALLOWED_ERRORS mismatch) |
| C-fix | ✅ Merge-ready | Medium 1 item (invalid_state dead code) → ADR-025 |
| D | ⚠️ Conditional → resolved via D-hotfix | P2 1 item (edit page tErrors missing) |
| D-hotfix | API 529 → Oracle spot ✅ | External infrastructure issue, pattern match verified |

---

## Sprint 118 Audit 25 Items Full Closure

- Sprint 118 total findings: 25 (P0 17 + P1 8)
- Sprint 119 (13 items) + Sprint 120 (4 items) + Sprint 124 Phase C (3 items) + existing false_positive (2 items) + other processing
- At Sprint 124 close: completed 23 + false_positive 2 = **25 items 100% closed**

---

## Lessons Learned (Carry-Over to Sprint 125+)

### Oracle Pipeline Follow-up Investigation

- **Short-task inbox Write permission issue** (C-fix + D-hotfix + D-hotfix Critic): Even with `--add-dir` + `bypassPermissions` settings, agent self-log shows "Permission required to write result file." Normal for long tasks (7m+). Need to investigate specific `claude -p` runtime scenarios.
- **Critic API 529 Overloaded** (D-hotfix): No auto-retry logic when Anthropic server overloaded during Critic auto-chain. Consider explicit flow for manual spot approval option on failure.

### Sprint 125 Roadmap Additions

- useRouter global locale-aware replacement (15+ files)
- `studies/[id]/room` sub-component text translations (AnalysisView/SubmissionView/WeekSection)
- `problems/create/page.tsx`, `problems/[id]/edit/page.tsx` self i18n unapplied Korean literals remaining
- ADR-025 Gateway OAuth error code normalization implementation
- 3 test files ko-KR hardcoding cleanup (NotificationBell/ReplyItem/CommentThread tests)
- analytics namespace technical debt (dashboard → analytics)
- admin-guard `defaultLocale` hardcoding removal (`routing.defaultLocale` reference)
- FeedbackForm/FeedbackWidget useMemo (Sprint 123 Critic Wave A4 Low carry-over)
- `reviews.commentThread.replies` EN plural ICU (Sprint 123 Critic Low carry-over)

### False Positive Record (Sprint 124 Investigation)

- B2-fix M-2 (submissions/analysis category fallback): `CATEGORY_KEYS` mapping-based fallback was already applied (line 498)

---

## Final Namespace State: 18 (existing 14 + new 4)

account / analytics / auth / common / dashboard / difficulty / errors / feedback / landing / layout / problems / reviews / submissions / ui / **studies / admin / sharing / legal**

---

## Commit Hash Index (31 total, chronological)

| Phase | Commit Hashes |
|-------|---------------|
| Phase 0 | `5500b06` |
| Phase B1 | `a5c691a` / `68fa7fe` / `4bb4015` / `51b7567` / `daab8df` |
| Phase B2 | `728b1ba` / `18e55ed` / `d512219` / `96179b6` / `3455fbf` / `353e741` / `f6c7735` |
| Phase B2-fix | `436fcdc` / `2e4f354` / `74ed237` / `b99e35f` / `a6b1033` / `492f344` |
| Phase C | `16d5952` / `6122469` / `3b955d9` / `1ef4ced` / `36a4247` |
| Phase C-fix | `caea563` |
| Phase D ADR | `5d7ba06` / `4b92a8c` |
| Phase D palette | `47c1a77` / `d06de25` / `708d5e9` |
| Phase D-hotfix | `0bf8091` |
