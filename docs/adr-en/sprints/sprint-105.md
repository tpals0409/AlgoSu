---
sprint: 105
title: "CI Actual Measurement Data + Operations Convention Standardization + Commit Gate Automation"
date: "2026-04-21"
status: completed
scope: "rebuild_all operations convention [A] + github-worker actual measurement [B] + commitlint pre-commit automation [C]"
start_commit: e520bb9
end_commit: 745fbbc
---

# Sprint 105 — CI Actual Measurement Data + Operations Convention Standardization + Commit Gate Automation

## Background

Sprint 104 completed Channeltalk CI refactoring Principle ⑤ (expansion phase) but failed to obtain actual measurement data. The cause is clear: CI infrastructure PRs (modifying `.github/workflows/ci.yml` alone) don't pass the `detect-changes` path-filter, causing all service jobs to be skipped. Sprint 104 ADR Lesson 1 documented this as "CI infrastructure PRs cannot generate their own actual measurement data due to detect-changes skip" and deferred standardization to Sprint 105.

Sprint 105 is the **closing sprint** of the CI refactoring 4-sprint roadmap (102–105). It consists of three tasks:

1. **[A] rebuild_all operations convention standardization** — `workflow_dispatch.inputs.rebuild_all` has existed since Sprint 103 but lacked a convention for when/who/how to trigger it. This sprint institutionalizes the convention with a runbook and PR template checkbox.
2. **[B] github-worker actual measurement forced collection** — Secure Post 5 samples via 4 rebuild_all runs + 1 dummy touch PR. Update sprint-103/104 comparison table "not measurable¹" cells with actual values.
3. **[C] commitlint pre-commit automation** — Move commitlint validation from CI stage only to local commit stage, and convert scope-enum to dynamic generation from `services/` directory, eliminating manual maintenance.

## Goals

1. Create `docs/runbook/ci-rebuild-all.md` — provide standard procedure for CI infrastructure PR owners
2. Add checkbox to `.github/pull_request_template.md` — enforce stating rebuild_all plan at PR open time
3. Collect github-worker job Post actual 5 measurements → retrospectively update sprint-103/104 comparison tables
4. root `package.json` + husky commit-msg hook + dynamic scope-enum for local commitlint automation

## Work Summary

| Task | Agent | Status | Output |
|------|-------|--------|--------|
| [A] rebuild_all runbook + PR template checkbox | Architect | ✅ Complete | `docs/runbook/ci-rebuild-all.md`, `.github/pull_request_template.md` |
| [A] Sprint 105 ADR | Scribe | ✅ Complete | This document |
| [B] dummy touch PR + rebuild_all trigger | Sensei | ✅ Complete | PR #117 (`6f42b0f`) + run 24703075569 |
| [B] Actual measurement aggregation + retrospective table update | Sensei | ✅ Complete | `sprint-103.md`, `sprint-104.md` retrospectively updated |
| [B] Sensei measurement report | Sensei | ✅ Complete | `~/.claude/oracle/inbox/sensei-sprint-105-timing.md` |
| [C] root package.json + husky + dynamic scope-enum | Architect | ✅ Complete | `package.json`, `.husky/commit-msg`, `commitlint.config.mjs` (PR #116) |
| [C] git-hooks runbook | Architect | ✅ Complete | `docs/runbook/git-hooks.md` (PR #116) |
| PR creation/merge | Postman | ✅ Complete | PR #115 / #116 / #117 / #118 |

## [A] Operations Convention Decision Basis

### Problem Definition (Sprint 104 Lesson 1)

The `detect-changes` path-filter optimization is a core design that reduces CI costs. However, this design creates a paradoxical gap in PRs that modify CI infrastructure files themselves: even when the workflow is modified, the service jobs that workflow runs are skipped. Both PR #111 (Sprint 103) and PR #113 (Sprint 104) failed this way, leaving github-worker Post measurement data at 0.

### Decision

`workflow_dispatch.inputs.rebuild_all=true` was already implemented at `ci.yml:131-139`. Establish the standard process through **operations convention documentation only** — no additional code changes.

Core convention principles:
- **3 trigger conditions explicitly stated**: `.github/workflows/*.yml` standalone change / `.github/actions/**` composite change / `scripts/check-coverage.mjs` and other CI common script changes
- **PR template checkbox**: force PR author to explicitly state rebuild_all plan at PR open time (prevents after-the-fact omission)
- **Prohibited cases explicitly stated**: misuse in service code change PRs causes GHA cost waste → state that path-filter is sufficient

### Alternative Comparison

| Approach | Pros | Cons | Selected |
|----------|------|------|---------|
| Runbook + PR template (adopted) | No implementation, immediately applicable, intention explicit | Human-dependent (checklist-based) | ✅ Adopted |
| Add CI file paths to path-filter | Automated | Full service builds trigger on every CI PR → cost increase | ❌ Rejected |
| Separate `ci-infra.yml` workflow | Clear separation of concerns | Workflow files spread, maintenance complexity increases | ❌ Deferred for consideration |

### Affected Files (commit `6d6233b`)

| File | Action | Description |
|------|--------|-------------|
| `docs/runbook/ci-rebuild-all.md` | New | 5 sections: purpose/trigger conditions/execution procedure/verification/prohibited cases |
| `.github/pull_request_template.md` | Modified | 1-line rebuild_all checkbox added in infrastructure change section |

## [B] Measurement Completion Conclusion

The github-worker actual measurement deferred across 3 sprints from Sprint 103 pilot through Sprint 105 is finally complete. 2 natural runs (run 24702740418·24702828670) triggered by the dummy anchor comment in PR #117 (`6f42b0f`) activating detect-changes, plus 1 synthetic run via `workflow_dispatch(rebuild_all=true)` (run 24703075569), secured Post n=3. Compared to Pre n=4: Quality +0.4% / Audit -8.9% / Test +3.9% — all jobs within the ±10% practical threshold. Welch t-test results for all 3 jobs: |t_obs| < 0.7 (t_crit=2.776) — confirmed that composite action expansion has no measurably significant impact on github-worker individual job runtimes. The "not measurable¹" cells in sprint-103.md·sprint-104.md comparison tables are retrospectively updated with actual averages, and all measurement obligations of the CI refactoring 4-sprint (102–105) roadmap are hereby concluded.

## [C] commitlint Automation Decision Basis

### Problem Definition

Prior to Sprint 105, commitlint was only validated in CI's `wagoid/commitlint@v6` job. If a developer committed with a wrong scope/type, it was discovered only after PR submission and required force-push rewriting. Additionally, the 16 static hardcoded scope-enum values in `commitlint.config.mjs:18-26` were easily missed when adding a new service directory (recurring cause of `feedback-commitlint-scope.md` feedback).

### Decision

**husky + commit-msg hook + dynamic scope-enum**. Alternative comparison:

| Approach | Pros | Cons | Selected |
|----------|------|------|---------|
| husky + commitlint (adopted) | Single root config, natural for distributed monorepo, reuses ESM config | Requires new root `package.json` | ✅ Adopted |
| lefthook | Go binary, lightweight | Requires `lefthook.yml` distributed in each service directory, heterogeneous with Node environment | ❌ Rejected |
| pre-commit (Python) | Universal | Adding Python tool → heterogeneous in Node-centric repo | ❌ Rejected |

### Dynamic scope-enum Generation

`fs.readdirSync('./services', { withFileTypes: true })` + `isDirectory()` filter generates service list at runtime. Merged with 10 static scopes (`ci`, `docs`, `blog`, `frontend`, `infra`, `deps`, `security`, `adr`, `e2e`, `runbook`) then `.sort()`. New service directory creation alone automatically registers the scope. The human-dependent feedback "register scope-enum when adding new directory" from `feedback-commitlint-scope.md` is structurally automated.

### CI Impact

Despite adding root `package.json`, all existing CI jobs use `working-directory` specification or go through composite action — no impact (verified by all jobs SUCCESS in PR #116).

### Affected Files (commit `0b916cf`)

| File | Action | Description |
|------|--------|-------------|
| `package.json` | New | root devDependencies: @commitlint/cli + config-conventional + husky |
| `.husky/commit-msg` | New | `npx --no -- commitlint --edit "$1"` |
| `commitlint.config.mjs` | Modified | static 16 scope-enum → dynamic services/ + static 10 |
| `docs/runbook/git-hooks.md` | New | Installation/troubleshooting/CI impact analysis |

## Lessons Learned

1. **Runbooks must be rehearsed immediately to be validated** — `docs/runbook/ci-rebuild-all.md` ([A]) was rehearsed within 2 hours of merge by running [B] synthetic run. Gaps in the procedure (e.g., how to specify result verification report path) are not discovered without rehearsal. Best practice for documentation quality assurance: merge infrastructure runbook → schedule first usage within the same sprint.

2. **Pre sample count is the dominant bottleneck for statistical MDE** — In the Welch-Satterthwaite formula, Pre n=4 fixes df at 4, so increasing Post n from 2→6 only improves MDE by 0.8s. Original N=4 was over-engineered. Sensei consultation → reduced to N=1 → 75% runner-minutes savings. "Obtaining many synthetic samples" has lower investment efficiency than "historically securing Pre samples."

3. **CI timing requires practical significance criteria to be realistic** — Due to GitHub Actions runner jitter (±5–10s) and small sample constraints, formal significance (p<0.05) is structurally unachievable. Concluded with practical criteria: all 3 jobs `|t_obs| < 0.7` / Delta within ±10%. Attempting formal criteria requiring n≥20 in a single sprint is unrealistic.

4. **Human-dependent feedback must be upgraded to system automation** — `feedback-commitlint-scope.md` was recurring feedback "register scope-enum when adding new directory." Resolved structurally through `services/` directory dynamic scan. Feedback memory is a candidate for promotion/removal as "structurally resolved" when automation is complete.

5. **Oracle's pre-consultation with Sensei pattern reverses N=1 decision costs** — Instead of plan original N=4 → user approval → execution, a 2-stage split "Sensei consultation on sample sizing → report results → re-decide N" saved 75% runner costs + runbook rehearsal value. "Plan approval → immediate execution" is not always optimal; prior quantitative analysis is valid in some cases.

## Carried Over (Sprint 106+)

- L2 cache layer (build output) — proceed after scope definition
- Frontend build optimization — proceed after scope definition (Turbopack + `.next/cache` already active)
- Global coverage threshold 60% → 70% upgrade consideration — data-based decision

## References

- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §Lessons Learned 1
- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §Carried Over
- rebuild_all runbook: `docs/runbook/ci-rebuild-all.md`
- Approved Sprint 105 execution plan: `/Users/leokim/.claude/plans/eventual-hugging-cocke.md`
- Channeltalk CI refactoring: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sensei Sprint 104 measurement report: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`
- Sensei Sprint 105 final measurement report: `~/.claude/oracle/inbox/sensei-sprint-105-timing.md`
