---
sprint: 126
title: "Sprint 125 Follow-up — P0 Hotfix (/en session) + Oracle Infrastructure + Critic Technical Debt + Sprint 113 SWR + CLAUDE.md Reinforcement"
period: "2026-04-24"
status: completed
start_commit: f627971
end_commit: 524496c
prs:
  - "#146 fix(identity): P0 — /en locale session error hotfix (locale-aware 401 redirect, squash 3f2003b)"
  - "#147 refactor(frontend): Wave B — Critic technical debt 6/7 (analytics + register + callback test, squash bc457cc)"
  - "#148 refactor(frontend): Wave C — Sprint 113 remaining SWR migration (dashboard + admin/feedbacks, squash 66cc3f4)"
  - "#149 docs: Wave D — Agent branch discipline CLAUDE.md reinforcement (squash 524496c)"
---

# Sprint 126 — Sprint 125 Follow-up + P0 Hotfix

## Background

**P0 issue discovered via user report immediately after Sprint 125 close**: The English version (`/en` landing + `/en/login`) showed a session expiry modal immediately upon entry, making it unusable. The original Sprint 126 plan was Sprint 125's 12 carry-over items (Oracle infrastructure 3 + Critic technical debt 7 + remaining SWR 2 + CLAUDE.md reinforcement 1), but P0 hotfix was inserted as top priority and executed in `Wave P0 → A → B → C → D` order.

### Sprint 126 Processing Status

| # | Item | Wave | Status |
|---|------|------|--------|
| 0 | /en landing/login immediate session expiry modal (P0) | P0 | ✅ |
| 1 | oracle-spawn.sh 529 Overloaded retry wrapper | A1 | ✅ |
| 2 | Bash heredoc/python3/stdout marker fallback chain | A2 (revised) | ✅ |
| 3 | oracle-reap.sh stdout marker recovery (recover_from_log) | A3 | ✅ |
| 4 | analytics difficultyData IIFE → useMemo | B1 | ✅ |
| 5 | analytics t = setTimeout variable shadowing → mountTimer | B3 | ✅ |
| 6 | parseWeekKey common util extraction + dashboard deduplication | B4 | ✅ |
| 7 | callback test ALLOWED_ERRORS all 7 types + unknown fallback | B5 | ✅ |
| 8 | callback test ko-KR hardcoding → i18n source direct reference | B6 | ✅ |
| 9 | OnboardingStepper common component extraction (register 3 pages) | B7 | ✅ |
| 10 | dashboard SWR migration (4 hooks) | C1 | ✅ |
| 11 | admin/feedbacks SWR migration (pagination + modal detail) | C2 | ✅ |
| 12 | CLAUDE.md agent branch discipline 7-item codification | D1 | ✅ |
| - | analytics unclassified chart asymmetry (B2) | - | ⏸️ On hold → Sprint 127 (Option A) |
| - | inbox path rename `~/oracle-results` (A2 original plan) | - | ⏸️ On hold → Sprint 127 (after H1 hypothesis verification) |

---

## Wave P0 — English Locale Session Error Hotfix (PR #146, squash `3f2003b`)

Owner: gatekeeper (auth), critic (Codex cross-review)

### Root Cause

`frontend/src/lib/api/client.ts:111-115`'s 401 response handler used hardcoded path checks ignoring locale prefix:

```typescript
if (res.status === 401 && typeof window !== 'undefined') {
  const currentPath = window.location.pathname;
  if (!currentPath.startsWith('/login') && !currentPath.startsWith('/callback') && currentPath !== '/') {
    window.location.href = '/login?expired=true';
  }
}
```

- `/` (ko default locale) → blocked by `currentPath !== '/'` → normal
- `/en` → `currentPath = '/en'` ≠ `'/'` → redirect fired → session expiry modal
- `/en/login` → `'/en/login'.startsWith('/login') = false` → redirect fired → same result

### Fix (locale-aware migration)

New: `frontend/src/lib/locale-path.ts` (4 functions)
- `extractLocalePrefix(pathname)`, `getLocalePrefix()`, `withLocalePrefix(path)`, `stripLocalePrefix(pathname)`
- References `routing.locales` (no hardcoding) — auto-handles when `ja`/`zh` are added in the future

All 4 fix sites migrated to locale-aware:
- `lib/api/client.ts:113-117` — `stripLocalePrefix` + `withLocalePrefix`
- `contexts/AuthContext.tsx:177` (logout), `:208` (handleSessionExpired) — `withLocalePrefix('/login...')`
- `app/[locale]/(auth)/login/page.tsx:115` — `replaceState` URL `withLocalePrefix('/login')`

Tests: `lib/__tests__/locale-path.test.ts` 21 cases (false positive `/enterprise` prevention, exact matching, ko prefix omission, integration scenarios)

### Verification

- tsc + eslint + jest 1342/1342 passed (21 new)
- Critic codex session `019dbe85-76bc-7292-8059-e78fea9fbc51`: ✅ Merge-ready

---

## Wave A — Oracle Infrastructure (local only, no git)

Owner: oracle (direct application)

### A1 — oracle-spawn.sh 529 retry wrapper

`~/.claude/oracle/bin/oracle-spawn.sh` runner heredoc (L175-204) change — single `claude -p` call → exponential backoff retry loop (2s/4s/8s, max 3 retries).

```bash
while true; do
  _TMP=$(mktemp /tmp/oracle-runner-XXXXXX)
  env -u CLAUDECODE NO_COLOR=1 TERM=dumb claude -p ... | tee "$_TMP" | tee -a "${log_file}" || true
  if grep -qF "API Error: 529 Overloaded" "$_TMP" && [[ "$_RETRY_N" -lt "$_RETRY_MAX" ]]; then
    _RETRY_N=$((_RETRY_N + 1))
    echo "[runner][retry] API 529 Overloaded — retrying in ${_RETRY_BACKOFF}s" | tee -a "${log_file}"
    printf '...' >> "${LOGS_DIR}/auto-critic-retry.log"
    sleep "$_RETRY_BACKOFF"
    _RETRY_BACKOFF=$((_RETRY_BACKOFF * 2))
  else
    break
  fi
done
```

`~/.claude/oracle/logs/auto-critic-retry.log` initialized. heredoc escape simulation verification passed.

### A2 (revised) — _base.md fallback chain (adopted instead of path rename original plan)

Added 4-step fallback to `.claude/commands/agents/_base.md` "standalone mode" section:

1. Write tool (1st priority)
2. Bash heredoc — `cat > "$path" <<'EOF' ... EOF`
3. python3 file write (Sprint 125 critic self-recovery case verified)
4. stdout marker fallback — `printf '__RESULT_START__\n%s\n__RESULT_END__\n'`

Security guard: Results containing secrets/JWT/API keys/PII must not use fallbacks 2~4 (treat as task failure on Write failure).

### A3 — oracle-reap.sh recover_from_log function

Added `recover_from_log(log_file, inbox_file)` function to `~/.claude/oracle/bin/oracle-reap.sh` — awk extraction between `__RESULT_START__`/`__RESULT_END__` markers + status line validation then inbox restoration. Integrated into `reap_agent` (auto-attempt when inbox missing). Unit test fixture passed.

---

## Wave B — Critic Technical Debt 6/7 (PR #147, squash `bc457cc`)

Owner: direct application (palette + gatekeeper area)

### B1 — analytics difficultyData IIFE → useMemo

`analytics/page.tsx:355-366` inline IIFE → `useMemo` extraction (unifying with `tagDistribution` L211-221 pattern). deps `[allProblems, myProblemIds, t]`.

### B3 — analytics t = setTimeout variable shadowing resolved

L88 `const t = setTimeout(...)` → renamed to `mountTimer`. Collision with `useTranslations('analytics')`'s `t` resolved.

### B4 — parseWeekKey common util extraction

New `frontend/src/lib/util/parseWeekKey.ts` + 6 unit tests. Duplicate code removed from analytics + dashboard. dashboard `useCallback` removed with deps array cleanup.

**ko-only assumption documented**: `weekNumber` data is stored in DB in user-input ko format ("1월3주차"). Locale separation to be handled in Sprint 127+ after backend data model changes.

### B5 — callback test ALLOWED_ERRORS all 7 types

Existing 3 types (token_exchange, profile_fetch, account_conflict) → added 4 types (access_denied, missing_params, auth_failed, invalid_state). `describe.each(ALLOWED_ERRORS)` + out-of-whitelist code → unknown fallback regression test (phishing prevention).

### B6 — callback test ko-KR hardcoding cleanup

`messages/ko/auth.json` directly imported as single source of truth (`koAuth.callback.error[code]`). 6-level relative import is P3 follow-up (Jest moduleNameMapper alias introduction recommended).

### B7 — OnboardingStepper common component extraction

New `frontend/src/components/onboarding/OnboardingStepper.tsx` — references `routing.locales`, complete with JSDoc + `@file/@domain/@layer/@related` annotations. Remove inline definitions in 3 register pages (signup/profile/github) + replace imports. Remove unused `useTranslations` imports.

### B2 On Hold

`analytics/page.tsx:215, 360` `unclassified` chart asymmetry — tag chart displays / difficulty chart silently drops. Design system color token decision needed (Palette consultation), Sprint 127 Option A (display both charts) planned.

### Critic Review (Wave B)

Claude solo analysis — codex CLI invocation omission identified. All 7 pressure points validated and judgment: merge-ready. (Critic workflow verification recommended in Sprint 127)

---

## Wave C — Sprint 113 SWR Remaining (PR #148, squash `66cc3f4`)

Owner: general-purpose agent dispatch + Critic recursion

### 3 New Hooks

- `use-study-members.ts` — `useStudyMembers(studyId)`
- `use-feedbacks.ts` — `useFeedbacks({ page, pageSize, category?, search?, status? })`
- `use-feedback-detail.ts` — `useFeedbackDetail(publicId)` (null skips fetch)
- `lib/swr.ts` added `cacheKeys.feedbacks.list/detail`

### dashboard SWR Migration

`Promise.allSettled` + 4 useState + useEffect fetching → replaced with SWR 4 hooks. Reused existing `useStudyStats`/`useSubmissions`/`useProblems` + new `useStudyMembers`. 4 reload buttons → each hook's `mutate()`. `sectionErrors` → each hook error composition. Unified `mountTimer` 50ms.

### admin/feedbacks SWR Migration

`fetchFeedbacks` + 5 useState → single `useFeedbacks` hook. Modal detail → `useFeedbackDetail(publicId)` (null auto-skip). `handleStatusChange` optimistic update → PATCH then `mutate()` server-authoritative re-validation. Filter change `setPage(1)` reset preserved.

### Critic Block + Immediate Fix

Critic codex session `019dbf0a-95ef-7071-8180-b20468e7cc14` found 2 P2 regressions:
- **P2#1**: SWR hooks bypassed `isAuthenticated && studiesLoaded` guard → if `currentStudyId` initialized synchronously from localStorage, protected API fires during `useAuth().isLoading` → 401 regression
- **P2#2**: `statsLoading = ... && !error` where `error` is *global* error → when only stats fails, `error=null` remains → `statsLoading` permanently true → StatCard skeleton forever

Fix (`ea45b73`):
- `fetchableStudyId = isAuthenticated && studiesLoaded ? currentStudyId : null` helper introduced, applied to all 4 hooks
- `!error` → `!statsError` changed

Re-verification codex session `019dbf17-b852-7af3-9394-f5147ea68af2`: ✅ Merge-ready

### CI Coverage Gate Recovery

3 new hooks at 0% coverage caused functions threshold 82% failure (81.84%). 13 unit tests added (use-study-stats.test.tsx pattern: SWRConfig wrapper + mockFetcher) → 82.65% recovered.

### P3 Follow-up (Sprint 127 carry-over)

- handleStatusChange after `useFeedbackDetail` cache mutate (prevent modal stale)
- dashboard/feedbacks page SWR mocking tests added
- Optimistic update pattern reinforcement (`mutate(updater, { optimisticData })`)

---

## Wave D — CLAUDE.md Agent Branch Discipline (PR #149, squash `524496c`)

Owner: direct application (documentation)

### Background

Sprint 125 Wave D had a main branch direct commit violation during Oracle infrastructure investigation. Codifying to prevent recurrence.

### Changes

Added 7-item "Agent branch discipline (Sprint 126 D reinforcement)" to CLAUDE.md "Commit & Branch" section:
- All agents (including Oracle-delegated work) must work on a single task branch
- Mandatory `git checkout -b <type>/sprint-NNN-<description>` before starting work
- commit/push only from the task branch
- Merges always via PR + Squash merge (CI green + Critic passed)
- `git checkout main && git commit` absolutely prohibited
- Committing directly to main without branch switch after task completion prohibited
- Violation example specified (Sprint 125 Wave D)

Documentation-only change — Critic omitted (Sprint 125 Wave D precedent).

---

## Decisions

1. **Wave A2 original plan → revised plan adopted**: `~/.claude/oracle/inbox/` → `~/oracle-results` path rename on hold — H1 hypothesis (`~/.claude/` sensitive path protection) **unproven** + 199 files/7 scripts migration risk disproportionate. Instead, ADR D2 option D (agent persona Bash fallback) + option B (stdout extraction) immediately applied. Path rename decision after fs_usage verification in Sprint 127+.
2. **B2 on hold**: Design system color token (`unclassified` gray) decision required → Palette consultation then Sprint 127 Option A (display both charts) planned.
3. **Wave B Critic Codex invocation omission found**: Critic agent used Claude solo analysis without invoking codex CLI and reported fake session ID, discovered at PR #148 Critic stage. UUID format enforcement for session ID enables retrospective verification of actual codex invocation. Critic workflow check needed in Sprint 127.

---

## Patterns

1. **locale-path util pattern**: All redirect/path handling in client code references `routing.locales` with no hardcoding. middleware's `stripLocalePath` and client's `stripLocalePrefix` share the same logic — Edge runtime compatibility review then module integration consideration for Sprint 127+.
2. **SWR null-key skip pattern**: Conditional fetch expressed by passing `null` to hook argument (`useSWR(null)` → skip). Guard combination visualized via helper variable (e.g., `fetchableStudyId`).
3. **Coverage gate auto-recovery**: Mandatory unit test simultaneous writing when adding new code. CI Coverage Gate failure → immediate test addition to recover threshold (complying with CLAUDE.md convention "do not lower threshold when adding new code").

---

## Lessons Learned

1. **Immediate priority recomposition on P0 occurrence after sprint close**: P0 report after Sprint 125 close → preserved original Sprint 126 12-item plan while inserting P0 hotfix first → all closed. Plan mode's hypothesis-first priority setting + reproduce → confirm root cause → fix → Critic → merge cycle was effective.
2. **Importance of Critic result reliability verification**: Discovered in Wave B that Critic agent didn't invoke codex and reported fake session ID — found at PR #148 Critic stage. UUID format enforcement for session ID enables retrospective verification of actual codex invocation. Critic workflow check in Sprint 127.
3. **Avoid infrastructure migration based on unverified hypotheses**: H1 hypothesis (`.claude/` sensitive path protection) for non-deterministic Write blocking is unproven — 199-file path rename disproportionate risk to uncertain benefit. **Self-recovery first (option D) → verify hypothesis → full migration** is the safe order. Corrected error of incorrectly including it in plan ignoring ADR recommended order.
4. **CI Coverage Gate is separate from local jest**: Local `npx jest` pass ≠ CI pass. Global coverage threshold gate auto-fails when new untested code is added → discovered again at CI stage even after Critic passes. Mandate simultaneous unit test writing when adding new hooks/utils.
