---
sprint: 120
title: "Sprint 119 Carry-Over Processing — P0/P1 Remaining Fixes + oracle-spawn Parallelization + Frontend Security Re-Audit"
period: "2026-04-22"
status: complete
start_commit: f2bde3e
end_commit: 940a746
---

# Sprint 120 — Sprint 119 Carry-Over Closure

## Background

Sprint 119 completed P0 13 + P1 3 of 22 audit-queue items and demonstrated the E2E pipeline, but 4 items (P0 3 + P1 1) remained in pending/in_progress state. Additionally, `oracle-spawn.sh` concurrent pane contention, audit-queue manual status transition issues, and frontend security re-audit were carried over.

Sprint 120's goal is to fully close these carry-over items and raise the pipeline automation level to enable Sprint 121+ batch processing of the remaining P1 49 items.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | audit-queue status sync (4 items in_progress → completed) | ✅ Complete |
| B | Remaining 4 security fix dispatches (P0 3 + P1 1) | ✅ 4/4 complete |
| C | oracle-spawn.sh pane parallelization full fix (spawn lock) | ✅ Complete |
| D | audit-queue auto status transition (cleanup trap integration) | ✅ Complete |
| E | Frontend security-critical 10-file re-audit | ✅ P1 3 found, queued |
| F | Sprint 120 ADR | ✅ Complete |

## Key Decisions

### D1. Resolve audit-queue drift — reverse-trace via git log
**Problem**: Sprint 119's 4 auto-loop processed items (p0-009, p1-019~021) had their commits applied but audit-queue JSON status remained in_progress.
**Fix**: Manually sync by mapping commit hashes from git log. Phase D cleanup trap automation prevents recurrence.

### D2. getGitHubTokenInfo endpoint separation
**Selected**: Existing `/github-token` → return `{ has_token: boolean }` (no token included) + new `/github-encrypted-token` → return `{ encrypted_token }` (internal only)
**Alternative**: Return encrypted prefix field name from existing endpoint
**Rationale**: Least privilege principle — separate callers needing only token existence check (oauth.service) from those needing the actual token (github-worker). Access scope clearly delineated at endpoint level.

### D3. atomicUpsert TOCTOU prevention — PostgreSQL WHERE clause
**Selected**: Raw query + `WHERE users.oauth_provider = $4` condition instead of TypeORM `orUpdate`
**Alternative**: Application-level re-fetch + provider re-validation
**Rationale**: Must block atomically at DB level for zero race window. Raw query pattern already used in softDeleteUser within this project.

### D4. spawn lock — mkdir-based global serialization
**Selected**: Add `acquire/release_spawn_lock` to `_lib.sh`, protect pane allocation section (idle detection → send-keys) atomically.
**Alternative**: PID file-based per-pane lock
**Rationale**: mkdir is POSIX atomic and a proven pattern in macOS environments without flock (`panes_locked_update`). Global lock is simpler than per-pane lock, and spawn takes milliseconds so no bottleneck.

### D5. Frontend re-audit result — P0 0 items, P1 3 items
**Audit scope**: 10 files related to auth/authorization/session/API communication/URL handling
**Result**: Sprint 119's XSS/Open Redirect fixes (sanitizeUrl, sanitizeRedirect) properly applied. P1 3 items are functional security (missing /shared path, admin CSR-only, callback error display) with low data leak risk.
**Judgment**: P1-023~025 queued for Sprint 121+. Current sprint focused on closing carry-over P0 items.

## Execution Results

### Phase B — 4 Security Fixes

| Finding | Agent | Result | Commit | Fix Content | Impact Scope |
|---------|-------|--------|--------|-------------|--------------|
| p0-010 | postman | ✅ | `973d709` | getGitHubTokenInfo → has_token separated, encrypted separate endpoint | identity, gateway, github-worker (12 files) |
| p0-011 | postman | ✅ | `fb10d51` | findBySlug public profile whitelist projection | identity controller (2 files) |
| p0-012 | postman | ✅ | `51c6295` | atomicUpsert WHERE provider condition + re-fetch validation | identity service (2 files) |
| p1-022 | sensei | ✅ | `acb7199` | problem_id/study_id/user_id UUID validator | ai-analysis (2 files) |

### Phase C-D — Infrastructure Improvements (outside repo)

| Target | Fix Content |
|--------|-------------|
| `_lib.sh` | `acquire/release_spawn_lock` functions added (mkdir-based atomic lock) |
| `oracle-spawn.sh` | spawn lock applied to pane allocation section + cleanup trap for audit-queue auto status transition |

### Phase E — Frontend Re-Audit Results

| Finding | File | Content | Agent |
|---------|------|---------|-------|
| p1-023 | middleware.ts | /shared path missing from PUBLIC_PATHS | palette |
| p1-024 | admin/layout.tsx | admin auth CSR-only | palette |
| p1-025 | callback/page.tsx | OAuth error fragment displayed directly | palette |

## audit-queue Final Status

| Status | End of Sprint 119 | End of Sprint 120 |
|--------|-------------------|-------------------|
| completed | 16 | 22 |
| false_positive | 2 | 2 |
| pending | 4 | 3 (new P1) |
| in_progress | 4 | 0 |
| **Total** | 22 + 4 = 26? → 22 | 22 + 3 = 25 |

- All existing 22 items: fully resolved as completed(20) or false_positive(2)
- 3 new items (p1-023~025): Sprint 121+ queue waiting

## Change Statistics

- **Code commits**: 4 (14 files, +269/-83 lines)
- **Infrastructure modifications**: 2 files (`_lib.sh`, `oracle-spawn.sh`)
- **audit-queue updates**: 8 items (4 existing status sync + 3 new registrations + 4 completed transitions)
- **Tests**: Identity 263 passed, Gateway 765 passed, GitHub Worker 118 passed

## Sprint 121+ Roadmap

1. **P1 security 49-item batch dispatch** — top 49 items from Sprint 118 triage's P1 279
2. **Frontend P1 3-item processing** (p1-023~025)
3. **audit-queue full automation** — Phase D cleanup trap integration complete, real-world verification needed
4. **MEMORY.md remaining**: Redis statistics cache, problem.tags JSON, SWR migration
