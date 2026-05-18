---
sprint: 118
title: "Full Codebase Audit via Critic Agent — Workflow Setup + 7-Service First Audit"
period: "2026-04-22"
status: complete
start_commit: fff8314
end_commit: 823499b
---

# Sprint 118 — Critic Full Audit Workflow + 7-Service First Audit

## Background

Sprint 117 completed the **diff-only auto-Critic chain** based on `oracle-auto-critic.sh`, but one structural limitation remained: **files not changed last would remain in review blind spots forever.** Accumulated debt in old legacy code can never be revealed by diff-only approaches.

Since Sprint 117's demo refactoring (`api.ts` 860-line domain separation) proved refactoring value with just one "hidden large file," the next step was to **perform a first full audit across the entire codebase** to expose similar debt all at once.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | Create full audit wrapper script (`oracle-full-audit.sh`) + prompt + JSON→MD helper | ✅ Complete |
| B | Finalize finding storage schema (`docs/audits/sprint-118/`) | ✅ Complete |
| C | Run full review on 7 services (frontend + 6 backends) | ✅ Complete |
| D | Design P0/P1 auto-delegation queue + triage script (`oracle-audit-triage.sh`) | ✅ Design complete |
| E | ADR, memory, and commit | ✅ Complete |

> Phase D actual dispatch to be performed in Sprint 119 (591 findings too large for a single sprint).

## Key Decisions (D1~D6)

### D1. Use `codex exec` (non-review) instead of codex review (diff) for full audit
**Selected**: Inject Critic checklist + file paths + JSON Lines output schema into `codex exec "<prompt>"`.
**Alternatives**: `codex review --base <empty-tree>` trick, other tools besides codex.
**Rationale**: (1) codex review is diff-based, unsuitable for full review, (2) `codex exec` reads file contents directly in read-only sandbox, (3) Output format (JSON Lines) is controllable. Pilot (config.py 38 lines) verified only JSON Lines output.

### D2. File batch size = 8 (per codex call)
**Selected**: Fixed batch size of 8 (adjustable via command-line option).
**Rationale**: Average ~100 LOC/file × 8 = ~800 LOC ≈ 5~6K tokens. Sufficient for single codex session context. Observed attention degradation for later files with larger batches.

### D3. Finding storage = `docs/audits/sprint-118/` (committed inside repo)
**Selected**: Service-specific MD + raw JSONL committed inside repo.
**Alternative**: `~/.claude/oracle/inbox/` outside repo.
**Rationale**: git blame, PR references, and history tracking possible. Easy to cite "source" in next sprint refactoring PRs.

### D4. 4-level severity (P0/P1/P2/Low) — following Sprint 115–117 convention
**P0**: Merge block (security/runtime crash/data corruption)
**P1**: Merge after re-verification (performance/API breakage)
**P2**: Non-blocking (convention/code smell)
**Low**: Optional improvement

### D5. P0/P1 auto-delegation routing matrix
**1st (category-based)**: security / data-integrity → architect (fixed)
**2nd (service-based)**:
- frontend → palette (convention/maintainability) / herald (otherwise)
- problem, submission → curator (domain logic)
- gateway, identity, github-worker, ai-analysis → postman (backend services)

**Actual distribution** (P0 17 + top 5 P1 = 22): architect 18 (P0 16 + P1 2), postman 3 (P1), herald 1 (P0).
**Rationale**: security/correctness is overwhelming majority of P0 (94%) → architect concentration is natural.

### D6. Batch failure resilience = 1 retry then skip (no full stop)
**Selected**: On `codex exec` failure, retry once → if still failing, skip that batch and continue.
**Rationale**: frontend batches 30 and 31 failed, but remaining 29 batches (94%) completed normally. Full audit is expensive to restart due to one failure.

## Implementation

### Phase A — Full Audit Scripts (outside repo, `~/.claude/oracle/`)

**New files**:
- `bin/oracle-full-audit.sh` — service-level full audit wrapper. Options: `--files`, `--severity-min`, `--batch-size`, `--dry-run`.
- `bin/oracle-audit-triage.sh` — findings → agent queue conversion. Options: `--severity-min`, `--limit`, `--dry-run`.
- `bin/lib/audit-schema.sh` — JSONL → service MD + comprehensive README conversion helper.
- `prompts/full-audit.txt` — Critic checklist + JSON Lines output schema for full audit.

**5 bugs found during implementation** (all immediately fixed):
1. `count_severity` double output with `grep -c` — exit 1 on 0 matches + `|| echo 0` double trigger. Fixed with `|| true; echo ${var:-0}` pattern.
2. `run_codex_batch` stdout contamination — log/ok/warn output to stdout → session ID capture mixed with logs. All moved to stderr.
3. **Critical**: `codex exec` consuming while loop's stdin (`< $all_files`) — hidden bug where only batch 1 ran. Fixed with `codex exec ... < /dev/null`. Before fix: identity 22 findings → after fix: 86 findings (4x increase).
4. Triage `grep -o '[0-9]\+'` double matching — "P0: 5" matched both "0" (from P0) and "5" (value). Replaced with `sed -E 's/.*P0: ([0-9]+).*/\1/'`.
5. `${var,,}` bash 4+ only lowercase conversion fails on macOS 3.2 — replaced with `tr '[:upper:]' '[:lower:]'`.

### Phase C — 7-Service Full Review Execution Results

| Service | LOC | Files | Findings | P0 | P1 | P2 | Low |
|---------|-----|-------|----------|----|----|----|-----|
| ai-analysis | 2,351 | 9 | 18 | 1 | 12 | 5 | 0 |
| github-worker | 1,611 | 8 | 18 | 1 | 13 | 4 | 0 |
| problem | 2,542 | 32 | 41 | 2 | 31 | 8 | 0 |
| identity | 4,265 | 69 | 86 | 5 | 37 | 44 | 0 |
| submission | 4,860 | 56 | 65 | 3 | 41 | 21 | 0 |
| gateway | 8,863 | 82 | 111 | 2 | 64 | 44 | 1 |
| frontend | 32,320 | 248 | 252 | 3 | 81 | 163 | 5 |
| **Total** | **56,812** | **504** | **591** | **17** | **279** | **289** | **6** |

> frontend batches 30 and 31 failed after codex exec retry, missing last 16 files (actual 232/248 = 94% coverage). Re-run planned for Sprint 119+.

### Phase D — P0/P1 Auto-delegation Queue

**Triage run**: `oracle-audit-triage.sh --severity-min P1 --limit 5`
- **Queued findings**: 22 (all P0 17 + top 5 P1)
- **Agent distribution**: architect 18, postman 3, herald 1
- **Queue location**: `~/.claude/oracle/audit-queue/audit-20260422-*.json`

**Sprint 119 dispatch plan**: Assign each task JSON to respective agent via `oracle-spawn.sh` → fix → auto-Critic re-verification → remove from queue.

## Key P0 Finding Samples (5 of 17)

| # | File | Content |
|---|------|---------|
| P0-01 | `services/ai-analysis/src/config.py:24` | `internal_api_key` empty string default → X-Internal-Key auth bypass |
| P0-02 | `frontend/src/app/shared/[token]/page.tsx:42` | (see audit MD for details) |
| P0-05 | `services/gateway/src/auth/token-refresh.interceptor.ts:54` | Token refresh interceptor issue |
| P0-08 | `services/identity/src/database/data-source.ts:22` | DB connection config security issue |
| P0-13 | `services/problem/src/problem/internal-problem.controller.ts:67` | Internal controller auth issue |

## Verification

- ✅ `oracle-full-audit.sh <service>` ran successfully for all 7 services
- ✅ `oracle-audit-triage.sh --severity-min P1 --limit 5` → 22 queue entries created
- ✅ JSON schema compliance: `finding_id`, `assigned_agent`, `service`, `status` recorded for all
- ✅ `docs/audits/sprint-118/README.md` comprehensive dashboard generated (7-service summary table)
- ✅ 7 service-specific MD files with valid frontmatter (severity_counts, codex_sessions included)

## Lessons Learned

1. **stdin inheritance is a hidden trap in while loops** — Child processes like `codex exec` consuming loop stdin causes batches to terminate early. **Explicit `< /dev/null` redirection is mandatory**. Evidence: identity findings jumped 22→86 (4x) after the fix.
2. **Value of batch resilience design** — Despite frontend batches 30/31 failing, remaining 29 batches completed for **94% coverage**. "Full stop vs partial skip" — the latter was correct.
3. **P0 findings concentrate on architect** (94%) — Characteristic of security/correctness category. Routing matrix with category-first is correct.
4. **`codex exec` is more flexible than review** — In scenarios without diff like full audits, injecting checklists via prompt into `codex exec` is cleaner and easier to control output than the `codex review --base <trick>` alternative.
5. **All 5 script bugs were bash-specific traps** — macOS bash 3.2 compatibility, grep/`||` double output patterns, `${var,,}` case, stdin inheritance, `grep -o` multiple matching. **macOS-targeted bash script checklist needed**.

## Carried Over

- [ ] **Sprint 117 carry-over re-carried**: auto-Critic tmux dispatch E2E verification (cleanup hook not triggered in interactive mode).
- [ ] **Phase D actual dispatch** (Sprint 119 top priority): P0 17 → architect auto-delegation, Critic re-verification loop demonstrated.
- [ ] **frontend batches 30/31 re-run**: Cover remaining 16 missing files.
- [ ] **Sprint 119 roadmap draft**: Refactoring sprint splits based on 591 findings (P0 17 → P1 279 → P2 289 sequence).
- [ ] **Regular audit execution** review: Quarterly full audit schedule (cron/CI).

## Metrics

- **No coverage change** (only audit MD added, no production code changes)
- **Audit execution time**: ~2–3 hours for 7 services (some parallel, accounting for codex rate limits)
- **Total codex sessions**: ~70 (1 session per batch)
- **Script bug cycle**: 5 found → 5 immediately fixed

## Related ADRs

- Sprint 114 — Critic agent established (Codex gpt-5 based)
- Sprint 115 — Phase E verification (P0/P1/P2 convention established)
- Sprint 116 — Critic tmux dispatch integration
- Sprint 117 — auto-Critic chain (diff-only) + api.ts demo separation
- **Sprint 118 (this document)** — Full audit workflow + 591 findings discovered
- Sprint 119 (planned) — Phase D actual dispatch + 591-finding refactoring begins
