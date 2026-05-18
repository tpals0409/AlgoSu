---
sprint: 102
title: "CI Improvement — Operations Automation + Prepare Pilot (PR1)"
date: "2026-04-21"
status: completed
scope: "PR1 only (PR2/PR3 covered in Sprint 103 ADR)"
---

# Sprint 102 — CI Improvement: Operations Automation + Prepare Pilot (PR1)

## Background

Following analysis of the Channeltalk backend CI refactoring reference (36.6 min → 15 min 38 sec), a 4-sprint roadmap was established for Sprints 102–105. Principle ⑤ "validate in a small service first, then expand" was promoted to sprint-level granularity — Sprint 102 focuses on pilot and operations automation, while Sprint 103 handles full-service rollout.

Two problems had accumulated in `.planning` at sprint start:
1. **30 pending Dependabot PRs** — weekly PR creation accumulating manual squash-merge burden
2. **quality/audit/test matrix duplication** — `setup-node + cache + npm ci` repeated 3–4 times per Node service

PR1 resolves (1), PR2 resolves (2). This ADR records PR1 only. PR2/PR3 continue in Sprint 103.

## Goals

1. Dependabot PR operations automation — grouping + patch/minor auto-merge
2. Establish main branch protection + repository settings to create safe boundaries for auto-merge
3. Prove the auto-merge path with a 3-item safe pilot
4. Apply Channeltalk Principle ⑤ at PR level — 3-item pilot, not a 30-item batch

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `46aeb73` (PR #102) | Architect + Scribe | Dependabot grouping + patch/minor auto-merge workflow (Sprint 102-1) |
| `0d57816` (PR #104) | Dependabot + Auto-merge workflow | `github-worker-minor-patch` group PR auto-merge (auto-merge proof) |
| `f98ce25` (PR #103) | Scribe | Sprint 101 ADR status/lessons finalized (carry-over cleanup) |

## Changes

### New/Changed Files (PR #102)

- `.github/dependabot.yml` — added `{service}-minor-patch` groups block to 8 ecosystems (excluding 2 Docker entries)
- `.github/workflows/dependabot-automerge.yml` — newly created
  - Trigger: `pull_request_target` (requires secrets access, no-checkout pattern defends against code injection)
  - Conditions (AND): `github.actor == 'dependabot[bot]'` + `dependabot/fetch-metadata@v2` update-type is patch/minor + `gh pr merge --auto` scheduled
  - major: explicit `exit 0` skip
  - permissions: `contents: write`, `pull-requests: write` (minimum principle)
- `.github/pull_request_template.md` — Dependabot Auto-merge conditions section inserted under `## Change Type`

### Repository Settings Changes (Oracle direct gh API)

| Target | Setting |
|--------|---------|
| `repos/tpals0409/AlgoSu` | `allow_auto_merge: true`, `delete_branch_on_merge: true` |
| `branches/main/protection` | `strict: true`, required checks = `["Secret & Env Scan", "Detect Changed Services"]`, `allow_force_pushes: false`, `allow_deletions: false`, `required_conversation_resolution: true` |

### Carry-over Cleanup (PR #103)

- `docs/adr/sprints/sprint-101.md` — status `in-progress` → `completed`, actual commit SHAs reflected in work summary table, key lessons section added

## Verification

| Item | Result |
|------|--------|
| PR #102 CI overall | ✅ 26 success / 10 skipped / 0 failure |
| PR #103 CI overall | ✅ 27 success / 9 skipped / 0 failure |
| Auto-merge workflow execution | ✅ 7/7 success (PR #104–#110) |
| **Actual auto-merge proof** | ✅ **PR #104** (github-worker 3 updates) — `app/github-actions` merger confirmed |
| Dependabot pending PRs | 30 → 2 (28 regrouped into 7 group PRs, 1 merged, 6 auto-merge scheduled) |
| Branch Protection effectiveness | ✅ main direct push blocked, strict mode requires latest base |

## Decisions

- **Architect-led re-matching**: Draft was Gatekeeper-led, but CI/CD is Architect's core domain per `.claude-team.json`. Gatekeeper (auth/API Gateway) is out of scope. Oracle re-coordinated Sprint 102 under Architect leadership.
- **Option C (3-item safe pilot)**: 30-item batch auto-merge validation has poor benefit vs. mass-merge risk + commit spam + CI minutes. Only 3 items (#85 dev dep gateway patch · #80 dev dep github-worker patch · #65 dev dep frontend patch) rebase-triggered; remainder delegated to Monday's Dependabot schedule. In practice, Dependabot detected grouping and took the "close existing PRs + recreate as group PRs" path — reducing 30 to 7 group PRs. Exceeded expectations.
- **`pull_request_target` + no-checkout pattern adopted**: `pull_request` cannot access secrets from fork PRs. `pull_request_target` has code injection risk, but removing `actions/checkout` makes PR code execution zero. 3-layer defense: job-level actor check + step-level update-type check.
- **Branch Protection required checks minimized**: Conditional quality/audit/test/build jobs block when skipped — excluded from required. Only always-running Secret Scan + Detect Changes specified.
- **`enforce_admins=false` retained**: Preserves Oracle emergency fix path. Admin merge bypass not used during this sprint.
- **PR2/PR3 deferred**: Context management + preserving each PR's independent value — continuing in Sprint 103.

## Lessons Learned

- **Agent domain matching must be verified upfront**: Plan-stage assumptions like "CI = Gatekeeper" can misalign with actual domains in `.claude-team.json`. Oracle must re-verify domains before dispatch.
- **Auto-merge requires Repo settings + Branch Protection combined**: Workflow alone is incomplete. `allow_auto_merge=true` + required status checks must both be present. Both settings were missing during initial PR progress — Oracle direct correction required.
- **Dependabot grouping auto-regroups existing PRs**: Safe 3-item `@dependabot rebase` actually took the "close existing individual PRs + recreate as group PRs" path, reducing 30 to 7. Better than expected cleanup effect.
- **strict=true + multiple competing PRs**: As group PRs were merged consecutively, other PRs became `BEHIND` repeatedly. `update-branch` followed immediately by merge attempt, or `--auto` scheduling, is essential.
- **Oracle pipeline `__AGENT_DONE__` marker missing**: Runner's `claude -p | tee` pipeline didn't execute the marker echo, requiring 2 manual interventions. Backlog registered ([issue-oracle-pipeline-agent-done-marker.md](../../../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/issue-oracle-pipeline-agent-done-marker.md)). <!-- doc-ref-lint: ignore -->

## Carried Over (Sprint 103)

- **PR2**: Composite action creation + github-worker pilot (Architect-led, pre/post time measurement included)
- **PR3**: Coverage artifact merge + PR 60% threshold enforcement (Scribe-led)
- **Oracle pipeline bug fix**: `__AGENT_DONE__` marker not written → `oracle-spawn.sh` runner fix (Sprint 103–105 or separate emergency sprint)

## References

- Channeltalk backend CI refactoring: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- 4-sprint roadmap: [project-ci-refactoring-roadmap.md](../../../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-ci-refactoring-roadmap.md) <!-- doc-ref-lint: ignore -->
