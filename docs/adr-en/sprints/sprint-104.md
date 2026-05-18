---
sprint: 104
title: "CI Improvement — Full Expansion + AI Coverage Integration + Measurement"
date: "2026-04-21"
status: completed
scope: "PR #113 (composite expansion + AI coverage) + Oracle runner local fix + measurement attempt"
end_commit: 00650bf
---

# Sprint 104 — CI Improvement: Full Expansion + AI Coverage Integration + Measurement

## Background

Continuing from Sprint 103's "pilot then expand" decision, this sprint's core tasks were expanding the `setup-node-service` composite action from github-worker only to all Node services, and integrating ai-analysis (FastAPI/pytest) into the global coverage-gate. Simultaneously, the Oracle `__AGENT_DONE__` marker bug carried over from Sprint 102 was resolved through Oracle self-fix, restoring agent chain automation reliability.

This sprint also completes the expansion phase of Channeltalk CI refactoring Principle ⑤ (validate in a small service first, then expand).

## Goals

1. Expand `setup-node-service` composite action to all Node services (quality-nestjs / audit-npm / test-node matrix integration)
2. Integrate ai-analysis (Python/pytest) coverage into the global coverage-gate
3. Restore automation reliability by fixing the Oracle agent chain `__AGENT_DONE__` marker missing bug
4. Obtain Sprint 103 pilot actual measurement data (github-worker pre/post timing comparison)

## Work Summary

| Task | Agent | Output |
|------|-------|--------|
| Composite action full-service expansion | Architect | PR #113 (`00650bf`) |
| ai-analysis coverage-gate integration | Architect | PR #113 (`00650bf`) |
| Oracle runner trap fix | Oracle (direct) | `~/.claude/oracle/bin/oracle-spawn.sh` |
| github-worker timing measurement | Sensei | ✅ Sprint 105 retrospective completion | `sensei-sprint-105-timing.md` |
| ADR update | Scribe | This document + sprint-103.md retrospective |

## Changes

### 1. Composite Action Expansion (ci.yml)

- Removed `matrix.service != 'github-worker'` condition from quality-nestjs / audit-npm / test-node 3 jobs
- Inline 3 steps (Setup Node + Cache + Install) × 3 jobs = **67 lines deleted**
- All Node services (gateway, identity, submission, problem, github-worker) now go through composite
- audit-npm retains `install-command: 'npm ci --ignore-scripts'` (security scan policy)

### 2. AI Coverage-Gate Integration (ci.yml)

- `test-ai-analysis`: added `--cov-report=lcov:coverage/lcov.info` to pytest
- artifact path expanded to multi-line (xml + lcov)
- `test-ai-analysis` added to `coverage-gate` needs, if condition expanded
- `scripts/check-coverage.mjs`: no changes required (recursive discovery automatically recognizes ai-analysis)

### 3. Oracle Runner `__AGENT_DONE__` Marker (Local Infrastructure)

- `~/.claude/oracle/bin/oracle-spawn.sh:127-149` runner heredoc reconstructed
- `set -euo pipefail` → `set -uo pipefail` (errexit removed)
- `cleanup()` function + `trap cleanup EXIT`: guarantees marker echo + lock removal + reap + dispatch on any exit path
- Covers all 4 failure modes: tee pipe SIGPIPE / empty output / tmux detached
- Reference memory: `memory/issue-oracle-pipeline-agent-done-marker.md`

### 4. Measurement Attempt (Sensei)

Sensei attempted Pre/Post sample collection via `gh run list` + jobs API. Pre 4-run average (Quality 22.2s / Audit 19.8s / Test 19.2s) successfully obtained, but both PR #111/#113 modified only workflow files — detect-changes skipped github-worker → **Post sample count: 0**. No runs observed where composite action executed through actual install/test path. Full report: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`

**Sprint 105 [B] retrospective actual measurement result** (task-20260421-sp105-b3-finalize):

| Job | Pre-change avg (n=4) | Post-change avg (n=3)² | Difference | Practical verdict |
|-----|---------------------|----------------------|------------|-------------------|
| Quality — github-worker | 22.2s (σ 5.8s) | 22.3s (σ 2.5s) | +0.1s (+0.4%) | ✅ No change |
| Audit — github-worker | 19.8s (σ 3.7s) | 18.0s (σ 3.0s) | -1.8s (-8.9%) | ✅ No change |
| Test GitHub Worker | 19.2s (σ 1.9s) | 20.0s (σ 1.0s) | +0.8s (+3.9%) | ✅ No change |

² Post n=3: 2 natural runs (run 24702740418·24702828670) + 1 synthetic (run 24703075569 rebuild_all). Detail: `~/.claude/oracle/inbox/sensei-sprint-105-timing.md`

## Lessons Learned

### 1. CI infrastructure PRs cannot generate their own actual measurement data due to detect-changes skip

Both PR #111 (Sprint 103) and PR #113 (Sprint 104) modified only `.github/workflows/ci.yml`. detect-changes did not detect `services/github-worker/**` changes — entire matrix skipped. **Response**: Standardize `workflow_dispatch(rebuild_all=true)` once alongside composite/pipeline change PRs, or use a dummy touch commit. Deferred to Sprint 105.

### 2. "Pilot then expand" decisions are justified by code duplication removal alone

67-line deletion (25% compression) secures maintainability. Actual performance measurement is a follow-up validation, not the basis for the expansion decision. Reconfirmed that Sprint 103's original plan ("measure from 2nd run after merge") was an asynchronous structure.

### 3. `trap EXIT` covers all 4 shell runner failure modes in one guard

`set -e` + `tee` pipeline fails to execute subsequent cleanup if even one of normal exit / claude failure / SIGPIPE / signal receipt is missing. `trap EXIT` intercepts **all exit paths** — single guard handles all 4 cases. Borrowable for other dispatch system designs.

### 4. Script-zero-change is the best approach for AI coverage integration

`scripts/check-coverage.mjs` already has recursive discovery structure implying extensibility. Simply adding the lcov reporter to pytest enables automatic recognition. Maintains the simplicity of handling Python/Node coverage in a single script. Sprint 103 lesson "test 0-artifact scenario for infrastructure PRs" is also applicable here.

## Carried Over (Sprint 105)

- github-worker actual measurement completion — **re-measurement trigger**: when 5 real github-worker change PRs are available
- `workflow_dispatch(rebuild_all=true)` guardrail introduction (Sensei recommendation, Sprint 104 Lesson 1 response)
- L2 cache layer (build output) — scope definition needed
- Frontend build optimization — scope definition needed
- Global coverage threshold upgrade to 70% — after actual measurement data obtained
- commitlint scope-enum management automation (pre-commit hook consideration)

## References

- Sprint 103 ADR: `docs/adr/sprints/sprint-103.md`
- PR #113: composite expansion + AI coverage (`00650bf`)
- Channeltalk CI refactoring: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sensei measurement report: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`
- Oracle issue memory: `~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/issue-oracle-pipeline-agent-done-marker.md`
