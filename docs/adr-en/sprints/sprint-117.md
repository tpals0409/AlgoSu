---
sprint: 117
title: "Full Agent Critic Feedback Integration + Code Refactoring"
period: "2026-04-22"
status: complete
start_commit: 78e43d2
end_commit: fff8314
---

# Sprint 117 — Full Agent Critic Feedback Integration + Code Refactoring

## Background

Sprints 114–116 completed establishing the Critic (Codex cross-review) agent and dispatch pipeline integration, but invocation remained as **manual trigger only**. Even when code-changing agents left commits, Critic review was not automatically applied, making the actual merge-gate role incomplete.

Additionally, `frontend/src/lib/api.ts` was a single 860-line file mixing 17 domain APIs, selected as a **demo refactoring target to demonstrate the Critic feedback loop** in practice.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | Build Critic auto-chain workflow after code-changing agent completion | ✅ Complete |
| B | `api.ts` (860 lines) → `api/` 12 domain module separation (demo case) | ✅ Complete |
| C | Receive and judge Critic cross-review | ✅ Complete |

## Key Decisions (D1~D5)

### D1. Insert auto-critic chain into Runner script cleanup()
**Selected**: Add HEAD comparison logic to `cleanup()` function in `oracle-spawn.sh` runner template.
**Alternatives**: dispatch post-run, per-agent hooks.
**Rationale**: Preserving `HEAD_BEFORE` per agent is most accurate. dispatch post-run bundles multiple agent completions making it impossible to pinpoint commit range.

### D2. Separate new script `oracle-auto-critic.sh`
**Selected**: Separate auto-Critic chain logic into a dedicated script.
**Rationale**: Single responsibility principle. Independent smoke testing possible. Runner template simply makes the call.

### D3. Explicitly list 9 code-changing agents in `.claude-team.json` as single source
**Included**: conductor, gatekeeper, librarian, architect, postman, curator, herald, palette, sensei
**Excluded**: scribe (documentation), critic (self-reference prevention), scout (verification)
**Rationale**: Single consistency point. Synchronized with `CODE_CHANGING_AGENTS` in `oracle-auto-critic.sh`.

### D4. Critic self-reference prevention
**Selected**: Immediately skip in `oracle-auto-critic.sh` if input agent is critic.
**Rationale**: Prevent infinite loop (Critic → Critic → ...).

### D5. Phase B demo target is `api.ts` domain separation
**Rationale**: (1) Single 860-line file with the most surface-area debt, (2) 17 domain sections already clearly separated by `// ──` comments — low risk, (3) Barrel export enables keeping 72 import locations unchanged.

## Implementation

### Phase A — Infrastructure (outside repo + inside repo)

**Outside repo (`~/.claude/oracle/bin/`)**:
- `oracle-auto-critic.sh` **new**: receives agent name + task_id + base_commit arguments; auto-creates Critic task via `oracle-create-task.sh --simple` if agent is code-changing and HEAD has changed
- `oracle-spawn.sh` modified: `HEAD_BEFORE=$(git rev-parse HEAD)` added to runner template + `oracle-auto-critic.sh` call inserted in `cleanup()`

**Inside repo**:
- `.claude-team.json`: `dispatch.codeChangingAgents[9]` + `dispatch.autoCritic{enabled,trigger,method}` added (commit `17cf39a`)
- `.claude/commands/agents/_base.md`: automatic Critic review rules section added (not committed via gitignore)

### Phase B — `api.ts` 860 lines → `api/` 12 files

| File | Lines | Domain |
|------|-------|--------|
| `client.ts` | 147 | fetchApi, fetchPublicApi, ApiError, StudyRequiredError |
| `types.ts` | 126 | Problem, Submission, Study and 12 shared interfaces |
| `auth.ts` | 69 | authApi, settingsApi |
| `study.ts` | 133 | studyApi, shareLinkApi, StudyStats |
| `problem.ts` | 26 | problemApi |
| `submission.ts` | 80 | submissionApi, draftApi, aiQuotaApi |
| `external.ts` | 86 | solvedacApi, programmersApi |
| `notification.ts` | 43 | notificationApi |
| `review.ts` | 82 | reviewApi, studyNoteApi |
| `public.ts` | 54 | publicApi (no auth required) |
| `feedback.ts` | 77 | feedbackApi, adminApi |
| `index.ts` | 59 | barrel re-export |

**Compatibility**: 72 import (`@/lib/api`) locations unchanged. `tsc --noEmit` 0 errors. (commit `fff8314`)

### Phase C — Critic Cross-Review
- **Session ID**: `019db399-45eb-7343-9295-bc072cdbd085`
- **Command**: `codex review --base 78e43d2`
- **Judgment**: ✅ "no actionable regressions were identified"
- **Out-of-scope P1 found (immediately corrected)**: `critic.md` stdin syntax (`--base <ref> - <<< "..."`) is incompatible with codex 0.122.0 CLI — `--base`/`--commit` and `[PROMPT]` (`-` stdin included) are mutually exclusive. Corrected to use `--uncommitted "prompt"` or prompt alone.

## Verification

### 5-point consistency verification (applying Sprint 116 lessons)
| # | Verification Point | Status |
|---|--------------------|--------|
| 1 | `.claude-team.json` codeChangingAgents (9) | ✅ |
| 2 | `oracle-auto-critic.sh` CODE_CHANGING_AGENTS | ✅ |
| 3 | `oracle-create-task.sh` VALID_AGENTS | ✅ |
| 4 | `oracle-spawn.sh` VALID_AGENTS + cleanup() auto-critic call | ✅ |
| 5 | `oracle-watchdog.sh` get_tier() | ✅ |
| 6 | `_base.md` auto-Critic section | ✅ |

### Smoke test (4/4 PASS)
| Scenario | Expected | Result |
|----------|----------|--------|
| code-changing agent + HEAD same | Skip | ✅ |
| Non-code-changing (scribe) | Skip | ✅ |
| Self-reference prevention (critic) | Skip | ✅ |
| code-changing agent + HEAD changed | Critic task auto-created | ✅ |

### Refactoring regression verification
- `tsc --noEmit`: 0 errors
- Jest: 120 suites / 1259 tests PASS
- Coverage: lines 85.99% / branches 76.95% (above thresholds 83/71)

## Key Lessons Learned

1. **Critic review scope is diff only**: `codex review --base <ref>` reviews changes only. Full repo audit requires separate design (Sprint 118 target).
2. **Watch for Codex output contamination**: `frontend/coverage/` HTML and `.next/` build artifacts mixed into review context causing 1MB+ output explosion. Need `rm -rf coverage .next` before review.
3. **critic.md CLI syntax must be tested**: The stdin syntax documented when established in Sprint 114 differs from actual codex 0.122.0. Re-verify on next codex version upgrade.
4. **Interactive vs tmux dispatch**: Auto-Critic chain fires only in runner script cleanup(). In interactive sessions, manual Oracle invocation required. Sprint 118 E2E verification is tmux-based.

## Carried Over

- auto-Critic chain tmux dispatch mode E2E verification (only smoke in interactive — cleanup hook not triggered)
- P0/P1 auto-detection → auto-fix delegation loop (currently Oracle manual mediation)

## Commit Map

| Commit | Scope | Content |
|--------|-------|---------|
| `17cf39a` | chore(infra) | `.claude-team.json` autoCritic metadata |
| `fff8314` | refactor(frontend) | `api.ts` 860 lines → `api/` 12-file separation |
| (outside repo) | - | `oracle-auto-critic.sh` new, `oracle-spawn.sh` runner template modified |
| (.claude/ gitignore) | - | `_base.md` auto-Critic section, `critic.md` stdin syntax corrected, prompts 12/12 rebuilt |
