---
sprint: 125
title: "Sprint 124 9-Item Carry-Over Closure — i18n Completion + OAuth Error Normalization + Oracle Infrastructure"
period: "2026-04-24"
status: completed
start_commit: 7f753a8
end_commit: f627971
prs:
  - "#142 feat(i18n): Wave A mechanical quality improvements + Critic follow-up (squash f6c0391)"
  - "#143 feat(i18n): Wave B i18n translation reinforcement + B5 Critic follow-up (squash 83313ee)"
  - "#144 feat(auth): Wave C Gateway OAuth normalization (ADR-025) + identity atomicUpsert (squash 27d3f95)"
  - "#145 docs(adr): Wave D Oracle infrastructure investigation report (squash f627971)"
---

# Sprint 125 — Sprint 124 9-Item Carry-Over Closure

## Background

The goal is to close the 9 quality/technical debt items carried over from Sprint 124, bringing i18n system + Oracle infrastructure maturity to completion. PM principle: **0 carry-over** — each Wave's Critic Medium findings are absorbed as follow-ups within the same Wave, Lows are immediately resolved or closed with documented justification.

### Sprint 124 Carry-Over 9-Item Closure Status

| # | Item | Wave | Status |
|---|------|------|--------|
| 1 | useRouter global locale-aware replacement (15+ files) | A | ✅ |
| 2 | studies/[id]/room sub-component text translations | B-1 | ✅ |
| 3 | problems/create/edit self i18n remaining | B-3 | ✅ |
| 4 | ADR-025 Gateway OAuth error normalization implementation | C | ✅ |
| 5 | 3 test files ko-KR hardcoding cleanup | A | ✅ |
| 6 | analytics namespace technical debt | B-2 | ✅ |
| 7 | admin-guard defaultLocale hardcoding removal | A | ✅ (exploration found already resolved) |
| 8 | Oracle infrastructure: short-task inbox Write permission investigation | D | ✅ (investigation report complete, implementation reserved for Sprint 126) |
| 9 | Critic API 529 retry policy | D | ✅ (investigation report complete, implementation reserved for Sprint 126) |

---

## Wave A — Mechanical Quality Improvements (PR #142, squash `f6c0391`)

Owner: palette (i18n), scribe (documentation)

### A1 — useRouter global locale-aware replacement

- 21 source files + 13 test files = **34 files** migrated: `next/navigation useRouter` → `@/i18n/navigation useRouter`
- Target directories: all of `app/[locale]`, `contexts/`, `components/`
- Complete replacement with no missing files already using `@/i18n/navigation`

### A2 — 3 test files ko-KR hardcoding cleanup

- `NotificationBell.test.tsx`: `'알림'` literal → `t('notifications.title')` mocking
- `ReplyItem.test.tsx`: `'답글'` literal → `t('reviews.reply')` mocking
- `CommentThread.test.tsx`: `'댓글'` literal → `t('reviews.comment')` mocking

### A3 — Sprint 123 Critic Low absorption

- `FeedbackForm` / `FeedbackWidget` `useMemo` dependency array optimization
- `reviews.commentThread.replies` ICU message EN plural (`{count, plural, =0{No replies} one{# reply} other{# replies}}`)

### A4 — Critic Medium follow-up absorption

- `next/link` → `@/i18n/navigation Link` migration in 8 files
- `reviews.json` `=0` plural dead code removal ko/en
- `CommentThread` test regex precision improvement at 6 spots (`/n개의 댓글/` → `/\d+개의 댓글/`)

### A5 — admin-guard exploration

- grep result for `admin-guard defaultLocale hardcoding`: `routing.defaultLocale` already referenced → no changes needed, item closed

**Critic result**: ✅ Merge-ready

---

## Wave B — i18n Translation Reinforcement (PR #143, squash `83313ee`)

Owner: palette (translation), scribe (documentation)

### B1 — studies/[id]/room translations

- `AnalysisView.tsx` 5 Korean literal lines translated
- Namespace: `studies` (created in Sprint 124, reused)

### B2 — analytics namespace migration

- `dashboard.analyticsSection.*` → `analytics.*` namespace independently separated
- Affected files: `analytics/page.tsx`, `analytics/components/*`
- Remaining key cleanup in existing `dashboard` namespace

### B3 — problems/create·edit self i18n

- `problems/create/page.tsx` + `problems/[id]/edit/page.tsx` self-translations, 52 keys
- Commits: `4961053` (B3 body) + `dfaf7c2` (fix: TypeScript strict error correction)

### B4 — OnboardingStepper translations (Wave A Critic Low absorbed)

- `OnboardingStepper.tsx` 3 Korean literals → `common.onboarding.*` keys

### B5 — Wave B Critic Medium+Low absorption

- analytics `'미분류'` (unclassified) category → `t('analytics.uncategorized')`
- problems icon `aria-label` → `t('problems.filter.ariaLabel')`

**New translation keys**: 153 (ko 76 + en 77)
**Critic result**: ✅ Both rounds merge-ready

### Sprint 126 Technical Debt Registration (found in Wave B)

- `difficultyData` array `useMemo` extraction (analytics/page.tsx inline constant — pre-existing)
- unclassified chart asymmetry: ko `'미분류'` vs en `'Unclassified'` data layer mismatch (pre-existing)

---

## Wave C — Gateway OAuth Error Code Normalization (ADR-025 implementation)

Owner: gatekeeper (C1), palette (C2), scribe (C3)

Branch: `feat/sprint-125-wave-c-oauth-normalization`

### C1 — Gateway backend enum + 7 Exception types (commit `0d13282`)

- New directory `services/gateway/src/auth/oauth/exceptions/`
  - `oauth-callback.exception.ts` — `OAuthCallbackErrorCode` type + base class + 7 Exception classes
  - `index.ts` — barrel export
- `oauth.service.ts`: `validateAndConsumeState()` → `OAuthInvalidStateException`, token exchange → `OAuthTokenExchangeException`, profile fetch → `OAuthProfileFetchException`, account conflict → `OAuthAccountConflictException`
- `oauth.controller.ts` catch block: `instanceof OAuthCallbackException` branch → `e.code` redirect (deprecated Korean `encodeURIComponent` approach)
- `oauth.controller.spec.ts`: redirect URL verification tests for all 7 Exception branches
- `oauth.service.spec.ts`: Exception class verification tests at each throw site

### C2 — Frontend ALLOWED_ERRORS extension + 6 i18n keys (commit `98a1621`)

- `callback/page.tsx` `ALLOWED_ERRORS` 7 types complete (existing 4 → added `token_exchange`, `profile_fetch`, `account_conflict`)
- `ERROR_KEY_MAP` same 3 `callback.error.*` key mappings added
- `messages/ko/auth.json` `callback.error.*` 3 keys added
- `messages/en/auth.json` `callback.error.*` 3 keys added

### C3 — ADR-025 Accepted promotion + sprint-125.md draft (this commit)

- `docs/adr/ADR-025-gateway-oauth-error-normalization.md`: status `proposed` → `accepted`, implementation result section added
- `docs/adr/sprints/sprint-125.md`: this file newly created

---

## Wave D — Oracle Infrastructure (herald + sensei) — ✅ Investigation Complete, Pending Oracle Application

### D1 — Critic API 529 Retry Logic Investigation and Design (herald)

#### Root Cause Analysis

1 of Sprint 124's 7 Critic rounds (`critic-task-20260424-115243-51116`) had 529 Overloaded.
Log review:

```
# ~/.claude/oracle/logs/critic-task-20260424-115243-51116.out
API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment.
If it persists, check status.claude.com.
```

**Failure point**: `claude -p` invocation itself failed (Claude API layer). Not the `codex review` Bash call inside the Critic agent. Meaning the agent never even started.

#### Retry Option Comparison

| Option | Location | Effectiveness | Owner |
|--------|----------|---------------|-------|
| A | Retry instruction in `critic.md` prompt | ❌ Invalid — agent never starts | Oracle |
| B | Retry loop for `claude -p` in `oracle-spawn.sh` runner template | ✅ Direct handling at root point, covers all agents | Oracle (sensitive file) |
| C | Detect previous failure in `oracle-auto-critic.sh` and re-queue retry task | △ Indirect handling, longer retry interval | Oracle (sensitive file) |

**Recommendation: Option B** — Wrap `claude -p` invocation in `oracle-spawn.sh` runner template with retry loop. Applied to all agents (including Critic) in batch, directly handling the root point.

#### Oracle Application Diff (Option B)

File: `~/.claude/oracle/bin/oracle-spawn.sh`

**Change location**: `RUNNER_EOF` heredoc `claude -p` invocation (currently around lines 175~182)

```diff
-env -u CLAUDECODE NO_COLOR=1 TERM=dumb \\
-  claude -p "\$TASK_PROMPT" \\
-  --model "${model}" \\
-  --system-prompt "\$SYSTEM_PROMPT" \\
-  --permission-mode bypassPermissions \\
-  --add-dir "${INBOX_DIR}" \\
-  --output-format text \\
-  2>&1 | tee "${log_file}"
+# Sprint 125 D1: API 529 Overloaded retry wrapper (max 3 retries, exponential backoff 2s/4s/8s)
+_RETRY_MAX=3
+_RETRY_N=0
+_RETRY_BACKOFF=2
+
+while true; do
+  _TMP=\$(mktemp /tmp/oracle-runner-XXXXXX)
+  env -u CLAUDECODE NO_COLOR=1 TERM=dumb \\
+    claude -p "\$TASK_PROMPT" \\
+    --model "${model}" \\
+    --system-prompt "\$SYSTEM_PROMPT" \\
+    --permission-mode bypassPermissions \\
+    --add-dir "${INBOX_DIR}" \\
+    --output-format text \\
+    2>&1 | tee "\$_TMP" | tee -a "${log_file}" || true
+
+  if grep -qF "API Error: 529 Overloaded" "\$_TMP" && [[ "\$_RETRY_N" -lt "\$_RETRY_MAX" ]]; then
+    _RETRY_N=\$((_RETRY_N + 1))
+    echo "[runner][retry] API 529 Overloaded — retrying in \${_RETRY_BACKOFF}s (\${_RETRY_N}/\${_RETRY_MAX})" | tee -a "${log_file}"
+    printf '%s\t%s\t%s\tretry=%s\tbackoff=%ss\n' \
+      "\$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${agent}" "${task_id}" "\$_RETRY_N" "\$_RETRY_BACKOFF" \
+      >> "${LOGS_DIR}/auto-critic-retry.log" 2>/dev/null || true
+    sleep "\$_RETRY_BACKOFF"
+    _RETRY_BACKOFF=\$((_RETRY_BACKOFF * 2))
+    rm -f "\$_TMP"
+  else
+    rm -f "\$_TMP"
+    break
+  fi
+done
```

#### HEREDOC Escaping Notes

In `<<RUNNER_EOF` (unquoted) heredoc:
- `\$_TMP` → `$_TMP` in runner (runtime variable) ✅
- `\$(mktemp ...)` → `$(mktemp ...)` in runner (runtime command substitution) ✅
- `\${_RETRY_N}` → `${_RETRY_N}` in runner (runtime variable) ✅
- `${model}`, `${INBOX_DIR}`, `${log_file}`, `${LOGS_DIR}`, `${agent}`, `${task_id}` → expanded at runner creation time (outer bash variables) ✅
- `\\` at EOL → `\` in runner (line continuation) ✅

#### Oracle Approval Required

- [ ] Apply `oracle-spawn.sh` runner template diff above (sensitive file — Oracle direct edit)
- [ ] Add header comment to `oracle-auto-critic.sh` (optional, Oracle direct edit)
- [ ] Create initial file: `touch ~/.claude/oracle/logs/auto-critic-retry.log`

### D2 — Short-task Inbox Write Permission Investigation Report (sensei)

#### 3 Reproduction Cases Summary

| # | task_id | Agent | Timeline | Failure Mode | Oracle Handling |
|---|---------|-------|----------|--------------|-----------------|
| 1 | task-20260424-151306-69314 | palette | 15:13~15:16 | **Cognitive skip** — no Write attempt, only stdout summary | completed_no_result (unrecovered) |
| 2 | task-20260424-161529-80208 | critic | 16:15~16:19 | **Success** — inbox file 3,498 bytes written normally | completed (baseline) |
| 3 | task-20260424-163101-82662 | critic | 16:31~16:33 | **Permission blocked** — agent explicitly reported error, stdout fallback | Oracle manual recovery → 16:37 inbox file created |

**Case 3 agent message (verbatim)**:
> ⚠️ Failed to create result file — write permission to `/Users/leokim/.claude/oracle/inbox/` is blocked.
> Need to add this path to `.claude/settings.json` or allowlist.

**Difference between success case (#2) vs failure case (#3)**: Both tasks use same model (`claude-sonnet-4-6`), same runner script, same `--permission-mode bypassPermissions --add-dir ~/.claude/oracle/inbox` flags. No externally distinguishable difference.

#### Root Cause Hypotheses

Current `oracle-spawn.sh` runner uses this combination:
```
claude -p ... --permission-mode bypassPermissions --add-dir ~/.claude/oracle/inbox
```

**H1 (primary hypothesis)**: Claude Code recognizes `~/.claude/` path as its own config directory and applies internal "sensitive path" protection. This protection activates after the `bypassPermissions` stage, causing **non-deterministic** blocking even when whitelisted via `--add-dir`.
→ Explains why same flags produce different results per session.

**H2 (secondary hypothesis)**: Removing CLAUDECODE env var via `env -u CLAUDECODE` causes Claude Code to operate in "headless mode," with a timing bug where `--add-dir` whitelist fails to register in session context.

**H3 (cognitive failure)**: Some agents (like case 1 palette) experience a cognitive error where they skip the result file Write step after completing code work — not a permission issue but a prompt compliance failure.

#### Candidate Solutions Comparison

| Solution | Approach | Effect | Effort | Side Effects |
|----------|----------|--------|--------|--------------|
| **A. Inbox path rename** (`~/.claude/oracle/inbox` → `~/oracle-results`) | Structural change — completely avoids `~/.claude/` protected zone | ✅ Root fix | Medium (update all paths in oracle-spawn/reap/watchdog) | Need to migrate existing inbox files |
| **B. oracle-reap.sh auto-stdout extraction** | Parse `.out` file when no inbox, auto-recover result | △ Workaround (root not fixed) | Low | Format dependency — recovery fails without YAML frontmatter |
| **C. Explicit Write in project settings.local.json** | Add `Write(~/.claude/oracle/*)` to `/AlgoSu/.claude/settings.local.json` | △ Partial fix (blocking occurred even with global `Write(*)` — uncertain effectiveness) | Very Low | None |
| **D. Agent prompt Bash fallback instruction** | Specify "on Write failure, retry with Bash(cat > file)" in agent persona | ✅ Practical self-recovery | Low (Oracle approval needed) | Token ↑, agent behavior change |
| **E. Runner pre-test Write + early warning** | `touch inbox_file` at runner start → log warning on failure | △ Early detection, not a fix | Low | Failure detected before `__AGENT_DONE__` → prompts Oracle manual intervention |

**Recommended combination**: **A (long-term) + D (short-term)** — root fix via path rename, agent Bash fallback for self-recovery in the interim.

#### Oracle Approval Required (Sprint 126)

- [ ] **D (short-term)**: Add Bash fallback instruction to agent common persona `_base.md` or individual personas (Oracle direct modification)
  ```
  If result file Write is rejected: retry with Bash("cat > {result_file_path} << 'EOF'\n{content}\nEOF")
  ```
- [ ] **A (long-term)**: Rename `oracle-spawn.sh` `INBOX_DIR` variable to `~/oracle-results`, update all related scripts
- [ ] **B (short-term, optional)**: Add stdout extraction logic to `oracle-reap.sh` — auto-recovery when no `inbox` + `.out` has YAML frontmatter pattern

---

## Achievement Summary

| Metric | Value |
|--------|-------|
| Total commits (Wave A~C) | ~50+ |
| New translation keys (Wave A~B) | ~200+ (ko+en) |
| Namespace count (Sprint 125 basis) | 18 (confirmed in Wave B) |
| OAuth error code normalization | 7 types enum complete |
| Sprint 124 carry-over 9-item closure | 9/9 ✅ (D1/D2 investigation complete, pending Oracle application) |

---

## Technical Debt and Sprint 126 Registration List

| Item | Source | Priority |
|------|--------|----------|
| `errors.authFailed` / `errors.serviceFailed` unreferenced legacy key review | ADR-025 follow-up | Low |
| `difficultyData` useMemo extraction | Wave B Critic Low | Low |
| unclassified chart ko/en asymmetric data layer alignment | Wave B Critic Low | Low |
| oracle-spawn.sh 529 retry diff application (Oracle direct application needed) | Sprint 125 D1 | Medium |
| oracle inbox path rename (`~/.claude/oracle/inbox` → `~/oracle-results`) — root fix | Sprint 125 D2 (Solution A) | Medium |
| Agent persona Bash fallback instruction — self-recovery on Write blocking | Sprint 125 D2 (Solution D) | Medium |
| oracle-reap.sh stdout auto-extraction — `.out` parsing recovery when no inbox | Sprint 125 D2 (Solution B) | Low |
