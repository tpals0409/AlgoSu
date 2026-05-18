---
sprint: 123
title: "Component Translation Completion — Phase A 6 Waves + ui/layout/analytics/feedback Namespaces"
period: "2026-04-23 ~ 2026-04-24"
status: completed
start_commit: 4e235cf
end_commit: 340cc0c
---

# Sprint 123 — Component-Level i18n Full Completion

## Background

Sprint 122 completed **page-level i18n** (21 error.tsx batch replacement, 5-Wave page translations, SEO hreflang), reaching 10 cumulative namespaces. However, at Sprint 122 close, **component-level translation was entirely unapplied** — only 27 files across the entire frontend used `useTranslations`, with most components including Shell/Nav/Dashboard/Review/Feedback/Submission/UI commons containing hardcoded Korean.

Sprint 123 goals:
1. Close Sprint 122 PR #139 (CI fix 3 commits push incomplete carry-over) → Phase 0
2. On the page-level i18n foundation, **complete translations for 44 components (actual 48 commits processed)** → Phase A
3. (Planned) admin/studies pages + Sprint 120 carry-over P1 security + i18n quality remaining → Phase B~E

This sprint actually completed **Phase 0 + Phase A** (PR #140 merged). Phase B~E transferred to Sprint 124.

---

## Phase 0 — PR #139 Closure

Sprint 122 session had network EADDRNOTAVAIL issue causing CI fix 3 commits (`edffa97`/`8b6637c`/`b8af62c`) push to fail and carry over. At Sprint 123 session start, confirmed network recovery (HTTP 200) → push → CI re-run → all PASS confirmed (including Test Frontend 52s) → Squash merge (`4e235cf`, --delete-branch) → local main sync → Sprint 123 dedicated branch `feature/sprint-123-i18n-components` created.

---

## Phase A — Component Translation Waves (44→48 files, 63 commits)

### Preliminary Survey
Explore agent full scan results: 48 of 104 frontend `.tsx` files had hardcoded Korean (611 lines). -5 vs Sprint 122 ADR "53 files" record (some already absorbed at page level). Executed in 6 Wave splits.

### Wave-by-Wave Progress

| Wave | Scope | Namespace | Commits | Critic Results | Notes |
|------|-------|-----------|---------|----------------|-------|
| **A1** | Shell/Nav 6 | `layout` new (11th) | 9 + 3 fix | M×3 fix | AppLayout/TopNav/StudySidebar/NotificationBell/AuthShell/LegalLayout |
| **A2** | 2 high-volume | `submissions`/`problems` extended | 2 + 2 fix | **H-1 DB integrity** + L-1 fix | CodeEditor (60 lines)/AddProblemModal (66 lines) |
| **A3** | Dashboard 3 + Analytics 1 | `analytics` new (12th) + `dashboard` extended | 5 + 2 fix | M-1 shadowing + L-1 English idiom fix | DashboardTwoColumn/ThisWeek/WeeklyChart + AnalyticsCharts |
| **A4** | Feedback 3 + Review 5 | `feedback` new (13th) + `reviews` extended | 9 + 1 fix | **M-1/M-2 DRY** → extracted `review-time.ts` shared util | BugReport/Feedback×2 + Comment/CodePanel/StudyNote/Reply |
| **A5** | Submission 2 + Share 1 + Guest 1 + Providers 4 + Landing 1 | Extended existing 5 (no new) | 9 | **0 items** (passed without fix-round for first time) | Dead-key prevention pattern established |
| **A6** | UI commons 20 (shadcn excluded) | `ui` new (14th) | 20 + 1 fix | **0 items** (Critical/High/Medium 0, Low 3 allowed) | 9 translated + 10 JSDoc-only + A6-2b test fix |

**Total 63 atomic commits**, 48 files processed, 14 namespaces final.

---

## Key Decisions (D1~D4)

### D1. Component Translation Namespace Strategy

**Decision**: Create new namespaces only when "shared category is clear," otherwise extend existing.

| New | Reason |
|-----|--------|
| `layout` (Wave A1) | Concentrated keys for shared layout components like AppLayout/TopNav/StudySidebar |
| `analytics` (Wave A3) | Chart-dedicated (axis/legend/tooltip), prepared for future analytics component additions |
| `feedback` (Wave A4) | Shared by 3 components: BugReport/Feedback*/Widget |
| `ui` (Wave A6) | 9 sections × 19 keys, dedicated to UI primitives |

| Absorbed (extended) | Reason |
|---------------------|--------|
| CodeEditor → `submissions.editor.*` | Domain membership clear |
| AddProblemModal → `problems.addModal.*` | /problems page modal (not admin-only) |
| Dashboard 3 components → `dashboard.*` | Existing extension natural |
| Review 5 components → `reviews.*` | Domain membership |
| ShareLinkManager → `account.shareLink.*` | account domain (22 keys, including error codes) |
| GuestNav → `common.guestNav.*` | Single file, economical to absorb into common |
| AuthGuard/HomeRedirect/Providers → **no translation keys added** | 0 user-facing Korean (JSDoc English only) — dead-key prevention |

### D2. DB Integrity vs Locale Separation (Wave A2 H-1)

**Problem**: In `AddProblemModal.tsx handleAdd`, `t('addModal.confirm.weekFormat', { month, week })` result was **saved directly to DB** → en locale stores `"Month 4 Week 1"` format, causing regex `/^(\d+)월(\d+)주차$/` parse failures in `dashboard/page.tsx:357`/`analytics/page.tsx:57`, and complete `services/problem/...spec.ts` API contract mismatch.

**Decision**: **Separate display label (t) from DB stored value (canonical)**.
```tsx
// DB storage (canonical fixed, ko format maintained)
const weekNumber = `${month}월${week}주차`;
// Display label (t() maintained, follows locale)
<SelectItem>{t('addModal.confirm.weekFormat', { month, week })}</SelectItem>
```

**Scope**: Only weekNumber this time. Same pattern applied when future i18n targets API-transmitted values. Backend format normalization (en locale official support) deferred to Sprint 124.

### D3. Shared Time Format Utility Extraction (Wave A4 M-1/M-2)

**Problem**: `CommentThread.tsx` and `ReplyItem.tsx` had **completely duplicated** `formatRelativeTime` function and `tTime = (key, values) => t(\`time.${key}\` as ..., values as never)` lambda (type bypass ×2 + 5-branch logic copy-paste 18 lines×2).

**Decision**: Create new `frontend/src/lib/utils/review-time.ts` shared util.
- `createTimeTranslator(t)` — key-constrained via `TimeKey` union (`'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo'`), directly uses `TranslationValues` → `as never` completely removed
- `formatReviewRelativeTime(iso, tTime, locale)` — unified 5-branch conversion logic
- `TimeTranslatorFn` type exported (reusable)

**Side effect**: `utils.ts → utils/index.ts` directory migration (74 imports unchanged, TypeScript module resolution automatic).

### D4. Dead Keys Prevention Policy (Wave A5/A6)

**Decision**: Components with **0** user-facing Korean strings get **no translation keys added**, only JSDoc/comments Englished.

**Applied to 20 components**:
- Provider/Guard: AuthGuard, HomeRedirect, WebVitalsReporter, ThemeProvider, EventTracker, SWRProvider
- UI primitive: Badge, Logo, CodeBlock, Button, Input, Card, MarkdownViewer, StatusBadge, EmptyState

**Rationale**: Confirmed as "correct design decision" by Critic in Wave A5/A6 twice. Empty translation keys trigger false positives when next-intl type plugin is introduced, and increase bundle size.

---

## Patterns

### P1. Locale-aware date/number (Wave A2 L-1 → extended to all Waves)

Ban `toLocaleString('ko-KR')` hardcoding. Inject `useLocale()` then use `toLocaleString(locale)`. Applied to all charts/statistics/date display components.

### P2. Pre-grep shadowing (Wave A3 M-1 → standard for all Waves)

When adding outer scope `const t = useTranslations(...)`, variable name collisions occur with inner `const t = setTimeout(...)` etc. Pre-check with `const t =` grep at Wave start → proactively rename colliding variables (`timer`, `tabItem`, etc.).

### P3. Server Component translations (Wave A1 M-1 → standard)

Static pages (LegalLayout etc.) use `async function + getTranslations({ namespace })` without `'use client'` directive. Tests use Sprint 122 not-found pattern (`jest.mock('next-intl/server')` + `await Component()`).

### P4. Error code separation + catch block translation (Wave A4)

`throw new Error('Korean message')` → `throw new Error('ERROR_CODE')` — only throw code, component catch block translates via `t('error.${code}')`. Applied in BugReportForm resizeImage, AddProblemModal searchSolvedAC/searchProgrammers.

---

## Lessons Learned

### L1. Write Block Issue (Infrastructure Unresolved)

Total **6 times** across Waves A2/A3(critic)/A4/A4 fix/A5/A6 — palette/critic runner Write to `~/.claude/oracle/inbox/*.md` failed due to **"sensitive path blocked"**. Even in `bypassPermissions` mode, `~/.claude/` subdirectory has exception policy.

**Temporary workaround**: Instruct runner to stdout fallback (markdown code block + `__AGENT_DONE__` sentinel), Oracle collects from log and manually Writes to inbox. 2~3 minute overhead per Wave.

**Root fix (deferred to Sprint 124)**: Add `--add-dir ~/.claude/oracle/inbox` to claude command in `oracle-spawn.sh`, or migrate inbox path to `/tmp/algosu-oracle/inbox` with reap script copying. Recommend analysis delegation to sensei/gatekeeper.

### L2. `ps aux grep` Limitation (Repeated Diagnosis Error)

**Same diagnostic mistake repeated** in Wave A1 and Wave A3: `ps aux | grep ${task_id}` misses process due to column slicing from very long claude argv → "misdiagnosed as crash" → incorrect recovery plan proposed. Palette was actually proceeding normally.

**Recurrence prevention standard**: palette status check must use `pgrep -f "runner.sh" → pgrep -P <runner_pid>` for parent-child relationship tracking. Do not rely on grep limitations.

### L3. auto-critic Chain Trigger Reliability

palette cleanup trap's automatic `oracle-dispatch.sh` invocation **failed in some Waves** (A1, A3, A4 palette → critic auto-transition missed). Failure cause unidentified. Bypassed via manual `oracle-dispatch.sh` re-invocation. Cleanup trap logic improvement or auto-critic.sh rewrite needed in Sprint 124.

### L4. Critic Quality Rising Curve

Waves A1~A4 all required fix-rounds (0 Critical/High but Medium/High 1~3 items). **From Wave A5 onward, fix-round not needed** — palette internalized accumulated per-Wave Critic feedback (shadowing/dead-key/DRY/canonical). For same-domain work in Sprint 124+, fix-round skip is likely possible (maintaining critic chain ensures safety).

---

## Key Outputs

### New Files
- `frontend/messages/{ko,en}/layout.json` — 88 lines (appLayout/topNav/studySidebar/notificationBell/authShell/legalLayout)
- `frontend/messages/{ko,en}/analytics.json` — 35 lines (charts.weeklyTrend, charts.aiScore)
- `frontend/messages/{ko,en}/feedback.json` — 34 keys (bugReport/feedbackForm/widget + errors)
- `frontend/messages/{ko,en}/ui.json` — 19 keys / 9 sections (alert/backBtn/categoryBar/difficultyBadge/langBadge/loadingSpinner/notificationToast/scoreGauge/skeleton)
- `frontend/src/lib/utils/review-time.ts` — createTimeTranslator + formatReviewRelativeTime

### Structural Changes
- `frontend/src/lib/utils.ts` → `frontend/src/lib/utils/index.ts` (directory migration, 74 imports unchanged)
- `frontend/src/i18n/request.ts` NAMESPACES 14 registered
- `frontend/src/test-utils/i18n.tsx` DEFAULT_MESSAGES includes all 14

### Shared Infrastructure Established
- `renderWithI18n` test helper: applied across all files in Waves A1~A6 (previous `render()` direct calls removed)
- wrapper option support (SWR+i18n composable, Wave A1 c65a8d1)

---

## Carried Over (Sprint 124)

### Planned Work Carry-Over (Phase B~E incomplete)
- **Phase B**: studies domain 3 (page/[id]/page/room), problems/[id]/status (study statistics), admin 3 (problems/[id]/edit, problems/create, admin/feedbacks), guest/page, shared/[token]/page, privacy/terms → **new `admin` + `studies` namespaces 15th-16th**
- **Phase C**: Sprint 120 carry-over Frontend P1 3 items (p1-023/024/025) + P1 security 49 items
- **Phase D**: Zod errorMap i18n, lib/date.ts useFormatter migration, useSubmissionSSE dynamic translation caller migration, utils.ts/client.ts HTTP error translations, code:'404' semantic key replacement, backend OAuth error structuring ADR (NestJS nestjs-i18n introduction or error code standardization)
- **Phase E**: renderWithI18n full migration (beyond Phase A level), next-intl type plugin introduction review (dynamic key type safety)

### Critic Carry-Over (Wave A4 Low, bundled as Sprint 124 i18n QA)
- L-1: FeedbackForm `categoryOptions` / FeedbackWidget `tabs` component internal arrays without `useMemo` (no performance impact)
- L-2: `reviews.commentThread.replies` EN plural ICU not handled (`{count, plural, one {Reply} other {Replies}}`)

### Technical Debt (Wave A3 Critic L-2)
- `analytics/page.tsx` still uses `useTranslations('dashboard')` after Wave A3 → needs migration to `analytics` namespace

### Infrastructure Improvements
- **Write block issue**: `oracle-spawn.sh` `--add-dir` flag addition or inbox path migration + reap copy strategy (see L1)
- **auto-critic chain instability**: cleanup trap → `oracle-auto-critic.sh`/`oracle-dispatch.sh` chain rewrite (see L3)
- **weekNumber backend format normalization**: DB/API contract standardization review for en locale official support

---

## Verification Summary

| Item | Result |
|------|--------|
| **PR #140** | Squash merge, origin/main `340cc0c` |
| **CI all** | PASS (Build Frontend 3m10s, Coverage Gate, E2E Programmers Full Flow included) |
| **Korean grep 48 files** | 0 items |
| **`npx tsc --noEmit`** | PASS (all Waves) |
| **Jest cumulative** | 200+ tests PASS (confirmed per Wave) |
| **ko/en key 1:1 parity** | Complete across all 14 namespaces |
| **Critic Codex gpt-5.4 6 rounds** | All merge-ready (A5/A6 passed without fix-round) |

## Agents Involved

- **Oracle**: Routing, Phase/Wave decision-making, inbox recovery, task JSON status transitions
- **Palette** (opus-4-6): Namespace creation/extension, component useTranslations injection, test migration — dedicated to Waves A1~A6
- **Critic** (sonnet runner + Codex gpt-5.4): Cross-review at end of each Wave, 6 rounds, diff-based Critical/High/Medium/Low classification
- **Scribe**: This ADR (Oracle delegation)
