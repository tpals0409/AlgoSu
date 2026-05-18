---
sprint: 155
title: "Seed #22 pre-push Hook Staging Auto-Verification (3-Layer Safety Net Completion)"
date: "2026-05-14"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-153", "sprint-154"]
related_memory: ["sprint-window"]
---
# Sprint 155 — Seed #22 pre-push Hook Staging Auto-Verification (3-Layer Safety Net Completion)

## Goals

- Directly reinforce Sprint 153 Phase A/E incidents (PR #241 hotfix) + Sprint 154 §6 specification + Sprint 154 Lesson #4 (untracked verification blind spot)
- Complete 3-layer safety net: **plan stage (Sprint 154 A)** + **pre-push stage (this sprint)** + **CI lint stage (Sprint 154 B)**
- Eliminate untracked .md broken ref blind spot — first detection locally before push

## Decisions

- **Phase 1 (architect)**: New `.husky/pre-push` shim + `scripts/check-staging-integrity.mjs`. Add `--include-untracked` option + ESM export to `check-doc-refs.mjs`
- **Phase 3+4 (scribe)**: New `docs/runbook/pre-push-check.md` + `git-hooks.md` §2 expansion + 3 existing RUNBOOK cross-refs + ADR
- **Single sprint 2 PR bundle** — Phase 1 code (architect) → Phase 3+4 docs (scribe) sequential merge. Sprint 150~154 pattern inherited
- **2 regression fixtures**: Sprint 153 Phase E (old runbook slug) / Sprint 154 PR #246 (home path reference) — previous incidents fixed as self-test baseline

## Implementation (2 PR squash merge, origin/main `1e51e24` → TBD)

| PR | Phase | Owner | Changes | Lines |
|----|-------|-------|---------|-------|
| [#247](https://github.com/tpals0409/AlgoSu/pull/247) | 1+2 (code) | architect | `.husky/pre-push` + `scripts/check-staging-integrity.mjs` (341 lines) + `check-doc-refs.mjs` export/option expansion | +484 −43 |
| [#248](https://github.com/tpals0409/AlgoSu/pull/248) | 3+4 (docs) | scribe | New `docs/runbook/pre-push-check.md` + `git-hooks.md` §2 + `git-staging-checklist.md` §6 + `doc-ref-lint.md` §8 + `README.md` + sprint-155 ADR | +300 |

### Phase 1+2 Detail — Code Implementation (PR #247)

**`.husky/pre-push`** (2 lines):
```sh
#!/usr/bin/env sh
npx --no -- node scripts/check-staging-integrity.mjs
```

**`scripts/check-staging-integrity.mjs`** (341 lines):
- Verification 1: `git ls-files --others --exclude-standard "*.md"` → untracked .md broken refs
  - Reuses `check-doc-refs.mjs`'s `validateRef` / `extractMarkdownLinks` / `extractBareDocPaths` / `stripInlineCode`
  - Exemption: `<!-- staging-check: ignore -->` or `<!-- doc-ref-lint: ignore -->` (both compatible)
  - exit 2 (push blocked when broken refs exist)
- Verification 2: `git status --porcelain` Y=M lines → detect unstaged modified files
  - `[BLOCK]` message + exit 1 (push blocked — intentionally unstaged can bypass with `git push --no-verify`)
- **regression fixture** `runRegressionFixtures()`:
  - Scenario 1 — Sprint 153 Phase E: old slug `docs/runbook-monitoring-log-rules.md` reference → 1 violation detected
  - Scenario 2 — Sprint 154 PR #246: home path `~/.claude/projects/.../sprint-999.md` → 1 violation detected
  - exit 2 (fail-safe) if self-test fails

**`scripts/check-doc-refs.mjs` expansion**:
- Export `validateRef` / `extractMarkdownLinks` / `extractBareDocPaths` / `stripInlineCode` / `collectUntrackedMarkdown`
- Entry point guard (`process.argv[1] === __selfPath`) — main logic does not execute on import
- `--include-untracked` flag: combined scan of tracked + untracked .md (166 files, 0 broken refs)

### Phase 3+4 Detail — Documentation (PR #248, this PR)

**New `docs/runbook/pre-push-check.md`** (7 sections):
- §1 Overview — Sprint 153 Phase E / Sprint 154 PR #246 2 incidents directly cited. 3-layer safety net diagram
- §2 Verification items (2 types) — exit code behavior + exemption pattern details
- §3 Exemption policy — automatic exemption patterns + explicit directive (`<!-- staging-check: ignore -->`)
- §4 Operations procedure — Husky activation / automatic execution on push / manual execution
- §5 Bypass — allowed cases for `git push --no-verify` explicitly stated
- §6 FAQ — false positive / intentional unstaged / self-test failure response
- §7 History

**`docs/runbook/git-hooks.md` §2 newly created**:
- §2.1 Introduction background — Sprint 153 Phase E / Sprint 154 PR #246 incident summary table
- §2.2 Verification item summary + `pre-push-check.md` cross-ref
- §2.3 Bypass procedure (`--no-verify`)

**Existing RUNBOOK cross-ref updates (3 items)**:
- `git-staging-checklist.md` §6: "future expansion candidate" → "Sprint 155 completed" + 3-layer safety net table + ADR cross-ref
- `doc-ref-lint.md` §8: untracked limitation specified + `--include-untracked` option + `pre-push-check.md` cross-ref
- `README.md` local development environment (4) → (5): `pre-push-check` item added

## Verification

- **Phase 1 PR #247 CI**: CI SUCCESS, mergeStateStatus CLEAN ✅
- **self-test 2/2**: Sprint 153 Phase E scenario + Sprint 154 PR #246 scenario manually reproduced → exit 2 each confirmed
- **`--include-untracked` verification**: `node scripts/check-doc-refs.mjs --include-untracked` → 166 files, 0 broken refs
- **Local doc-ref-lint**: 2 new RUNBOOKs in this sprint (pre-push-check.md, sprint-155.md) passed self-lint (Sprint 154 meta-self-verification pattern inherited)
- **Auto-Critic R1 P2 1 issue → R2 clean** (Phase 1 architect): `[WARN]` message + `exit(1)` inconsistency caught → message/symbol/exit code 3-element consistency policy established

## Branch Discipline

- Both PRs use new branches + Squash merge — **22 consecutive sprints compliant** (since Sprint 134 violation)
- 0 direct commits to main

## New Patterns

1. **3-layer safety net pattern completed (Sprint 154 2-layer → this sprint 3-layer)** — plan (checklist) + pre-push (hook) + CI (lint). Each stage blocks a different blind spot at a different point in time. If one stage is bypassed, the next stage defends
2. **Untracked supplement bypass mode (`--include-untracked`)** — Added untracked file support to `check-doc-refs.mjs`'s `git ls-files` based scan. pre-push hook runs automatically; manual verification uses `--include-untracked` option
3. **ESM function export safety via entry point guard** — `process.argv[1] === __selfPath` condition prevents main logic execution on import. Prevents CI entry point duplicate execution when `check-staging-integrity.mjs` imports from `check-doc-refs.mjs`
4. **Regression fixture directly mapped to preceding incident scenarios** — Sprint 153 Phase E (old slug) + Sprint 154 PR #246 (home path) fixed as self-test baseline. Same principle as Sprint 154 pattern (5-slug fixture)

## Lessons Learned

1. **`[WARN]` vs `exit(1)` inconsistency immediately caught by Auto-Critic R1 (preempts user/team confusion)** — exit(1) actually blocks push but `[WARN]` prefix is easily misread as "OK to continue." Message symbol (`[OK]`/`[WARN]`/`[FAIL]`) + exit code 3 elements must be consistent for hook reliability
2. **`<!-- staging-check: ignore -->` and `<!-- doc-ref-lint: ignore -->` compatibility policy** — Both lints inspect the same files, so a single exemption directive must exempt both. Minimizes operational burden
3. **Message/symbol/exit code 3-element consistency is the core of hook reliability** — `[OK]` = exit 0 / `[WARN]` = exit 1 (soft block) / `[FAIL]` = exit 2 (hard block). Inconsistency risks team members ignoring output or making incorrect judgments
4. **New RUNBOOK self-verification via doc-ref-lint (Sprint 154 meta-self-verification pattern inherited)** — pre-push-check.md introduced in this sprint also passed lint before commit. The 3-layer safety net RUNBOOK is verified by the net itself

## Sprint 156 Carryover

### UAT User Direct (12 sprints accumulated)

- Seed #5: Programmers resubmission scoring pass confirmation
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency

### Sprint 152~153 New Automation Candidates (Carry Forward)

- Seed #18: Blog post pre-merge domain fact cross-check automation
- Seed #19: KR/EN dual simultaneous authoring plan obligation + CI rule

### Follow-up (Optional, Sprint 151 unchanged)

- create/edit page.tsx category UI addition
- Programmers URL automatic category inference
- Existing SQL problem data backfill
- Sprint 150 unresolved 3 candidates (`.claude-tools/` cleanup / CI paths filter bypass debt check automation / prom-client default metric stale check)

## Related Memory

- [sprint-window.md](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-window.md) <!-- doc-ref-lint: ignore -->
