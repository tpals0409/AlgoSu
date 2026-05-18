---
sprint: 103
title: "CI Improvement — Prepare Pilot + Coverage Enforcement (Sprint 102 continuation)"
date: "2026-04-21"
status: completed
scope: "PR #111 (PR2+PR3 integrated squash merge)"
end_commit: 5fd8483
---

# Sprint 103 — CI Improvement: Prepare Pilot + Coverage Enforcement

## Background

Sprint 102 completed only Dependabot operations automation (PR #102 + #104) and carry-over cleanup (PR #103), deferring the Composite action pilot (PR2) and Coverage enforcement (PR3) to Sprint 103. This sprint completes those carry-over items.

Principles borrowed from the Channeltalk CI refactoring reference:
- ① Shared prepare extraction — perform preparation costs once instead of repeating per matrix node
- ② Input hash-based step caching — cache keys determined by dependency lockfile hash
- ⑤ Validate in a small service first, then expand — github-worker pilot → full-service rollout in Sprint 104

## Goals

1. Extract the `setup-node + cache + npm ci` repetition pattern as a Composite Action, piloted on github-worker only
2. Merge coverage artifacts and block PR merges at a global 60% threshold
3. Visualize per-service coverage in PR comments

## Work Summary

| Commit (pre-squash) | Agent | Content |
|---------------------|-------|---------|
| `1cef57d` | Architect | Composite action setup-node-service + github-worker pilot (Sprint 103-1) |
| `4f72c69` | Architect | coverage-gate job + 60% global threshold enforcement (Sprint 103-1) |
| `3fc6078` | Scribe | Sprint 103 ADR draft |
| `1a7aede` | Scribe | Sprint 102 ADR missing items cleanup |
| `ec4d96b` | Architect | coverage-gate hardening — empty artifact allowance + PR comment guard |

**Squash result**: `5fd8483` (PR #111, merged to main)

## Changes

### PR2 — Composite Action Pilot

**New files:**
- `.github/actions/setup-node-service/action.yml` (+43 lines)
  - 3 inputs: `service-path` (required), `node-version` (default 20), `install-command` (default npm ci)
  - Steps: setup-node@v6 → actions/cache@v5 (lockfile hash key) → conditional install

**Modified files:**
- `.github/workflows/ci.yml` (+46 lines, -9 lines)
  - `quality-nestjs`: github-worker → composite call, other services → existing inline retained (`matrix.service != 'github-worker'` condition)
  - `audit-npm`: same pattern + `install-command: 'npm ci --ignore-scripts'` passed
  - `test-node`: same pattern, default npm ci

### PR3 — Coverage Gate

**New files:**
- `scripts/check-coverage.mjs` (+112 lines)
  - Recursive lcov.info discovery + per-service lines/branches parsing
  - Markdown table output (GITHUB_STEP_SUMMARY + GITHUB_OUTPUT)
  - exit 1 on threshold miss
  - ESLint no-console compliance (process.stdout.write/process.stderr.write)

**Modified files:**
- `.github/workflows/ci.yml` (+40 lines)
  - `coverage-gate` job added (after test-node, test-frontend complete)
  - `download-artifact@v4` pattern: coverage-* (ai-analysis cobertura XML auto-excluded — no lcov.info generated)
  - sparse-checkout for scripts only (minimize cost)
  - `marocchino/sticky-pull-request-comment@v2` for PR comment
  - Not included in build-services.needs (no build blocking, Branch Protection only)

## Decisions

### D1: Pilot Limited to github-worker

github-worker is the simplest of the 5 Node services (pure Node.js, no NestJS). Validate pattern change impact in minimum scope, then expand to the remaining 4 NestJS services + frontend in Sprint 104. Sprint-level application of Channeltalk Principle ⑤ "validate small first, then expand."

### D2: Checkout Not Included in Composite Action

Checkout is always the same first step in each job regardless of service path (full repo checkout). The composite extracts only the "per-service branch point" of setup-node + cache + install. This decision increases the composite's versatility (checkout method can be freely changed at job level, e.g., sparse-checkout).

### D3: Global 60% vs Service-Specific High Threshold Dual Structure

Individual service Jest coverageThreshold (92–100%) serves "maintain existing code quality." Global 60% serves "floor defense when adding new services." The two layers have different roles and coexist. Path to upgrade global to 70% in Sprint 104 left open pending measurement data.

### D4: Exclude ai-analysis from Global Gate

ai-analysis (FastAPI) only generates pytest --cov-report=xml (cobertura format) with no lcov.info. Adding a cobertura→lcov conversion tool is low benefit relative to complexity. Sprint 104 will explore adding a separate pytest threshold gate for ai-analysis, or adding the lcov reporter to pytest.

### D5: coverage-gate Not in build-services.needs

Coverage verification aims to "block PR merge" not "block build." Having build-services wait for coverage-gate would unnecessarily increase overall CI time. Register coverage-gate as a Branch Protection required check to block only at merge time.

### D6: Custom Script Over lcov-result-merger

lcov-result-merger is an npm package with supply chain risk. No need to "merge per-file" across individual service lcov.info files — global ratio needs only LH/LF/BRH/BRF summation. Achieved zero external dependency with a custom script under 40 lines (actual 112 lines including comments/JSDoc).

## Verification

| Item | Result |
|------|--------|
| Composite action syntax | ✅ action.yml structure valid (using: composite, 3 inputs, 3 steps) |
| ci.yml branch conditions | ✅ github-worker uses composite, others retain inline |
| coverage-gate job structure | ✅ needs/if/permissions/steps valid |
| check-coverage.mjs logic | ✅ lcov parsing, threshold check, Markdown output |
| ESLint no-console | ✅ process.stdout.write/process.stderr.write |
| File header annotations | ✅ @file, @domain, @layer, @related |
| CI live verification | ✅ PR #111 CI 2nd pass all green (27 pass / 8 skip, Coverage Gate included) |
| Branch Protection registration | ✅ Oracle gh API — `Coverage Gate` required check added |
| Commitlint scope | ✅ filter-branch + force-push — `ci(actions)`→`ci(github-worker)`, `ci(coverage)`→`ci(ci)` corrected |

## github-worker Timing Comparison

### CI Timing — github-worker (Sprint 103 Pilot)

| Job | Pre-change avg (n=4) | Post-change avg (n=3)² | Difference | Notes |
|-----|---------------------|----------------------|------------|-------|
| Quality — github-worker | 22.2s (σ 5.8s) | 22.3s (σ 2.5s) | +0.1s (+0.4%) | Within ±10% — no change |
| Audit — github-worker | 19.8s (σ 3.7s) | 18.0s (σ 3.0s) | -1.8s (-8.9%) | Within ±10% — no change |
| Test GitHub Worker | 19.2s (σ 1.9s) | 20.0s (σ 1.0s) | +0.8s (+3.9%) | Within ±10% — no change |

² Post n=3 actual average obtained in Sprint 105 [B]. 2 natural runs (run 24702740418·24702828670) + 1 synthetic (run 24703075569 rebuild_all). Data lineage detail: `~/.claude/oracle/inbox/sensei-sprint-105-timing.md`

**Pre sample sources**:
- `a45878e` (PR #90, feat/gateway-programmers-dataset, 2026-04-20) (run 24646611483)
- `4b72ac2` (dependabot @types/node, 2026-04-20) (run 24646785496)
- `6ec1c46` (dependabot ts-jest, 2026-04-21 00:56 UTC) (run 24698331881)
- `6fdc408` (dependabot minor-patch group #104, 2026-04-21 01:07 UTC) (run 24698653487)

**Lesson**: When a pilot/expansion PR modifies only the workflow file, it produces no self-measured data. Standardize a process to run `rebuild_all=true` workflow_dispatch or a dummy touch commit alongside composite change PRs to secure at least 1 actual measurement.

## Lessons Learned

### 1. Commitlint scope-enum violations are discovered late at the PR stage

`ci(actions)`/`ci(coverage)` look intuitive but are not in `commitlint.config.mjs` scope-enum, causing the Lint Commit Messages job to fail. Without a local pre-commit hook, scope errors are only caught in PR CI. **Response**: Make checking `commitlint.config.mjs` scope-enum first a routine before writing commit messages. Sprint 102 used `ci(deps)` but Sprint 103 used `ci(actions)` misled by the physical "actions directory" name. Going forward, choose scopes based on **functional domain** (`github-worker`/`ci`/`infra`).

### 2. coverage-gate must handle the 0-artifact scenario for infrastructure-only PRs

This PR modified only `.github/workflows/ci.yml` + `scripts/` + `docs/` with no service code changes → detect-changes all services false → test-node matrix all skipped → 0 coverage-* artifacts uploaded → `download-artifact@v4` doesn't create `coverage/` directory → `readdirSync` ENOENT error → cascading empty message error in PR comment step. **Response**: Add `existsSync` guard to script + `coverage-body != ''` condition guard to PR comment step. Always assume "the verification environment (infrastructure PRs) may differ from the actual operating environment (service PRs)."

### 3. Scribe must not write code — Architect owns CI exclusively

Sprint 103's initial plan assigned PR3 to Scribe, but per `_base.md` protocol Scribe "handles docs/memory/Skill only — no code writing." Oracle re-verified roles before dispatch and reassigned both PR2/PR3 to Architect exclusively. **Lesson**: Sprint 102's "agent domain matching re-verification" lesson recurred in 103 — needs to be checklisted at each sprint start.

### 4. filter-branch + force-push is a safe recovery path on feature branches

Used `git filter-branch --msg-filter` + `git push --force-with-lease` for non-interactive commit message correction without `git rebase -i`. Safety ensured by feature branch (no main involvement) + `--force-with-lease`. PR body/comments are preserved; only commits are rewritten.

### 5. The decision not to include coverage-gate in build-services.needs is validated in PR #111

coverage-gate runs in parallel with build-services with no impact on overall CI time. PR merge blocked only by Branch Protection required check — build pipeline proceeds without delay. Maintain this structure when expanding in Sprint 104.

### 6. github-worker pre/post timing measurement not performed — carried to Sprint 104

Plan called for "5 samples starting from the 2nd run after merge" but only 1 main-branch execution existed by sprint end — insufficient for meaningful comparison. Retrospectively fill this ADR's comparison table after collecting 5 samples with `gh run list` at Sprint 104 start.

**Status update (Sprint 104 attempt result)**: In Sprint 104, Sensei attempted retrospective measurement but both PR #111/#113 modified only `.github/workflows/ci.yml` — detect-changes skipped github-worker → **Post sample count: 0**. Only Pre 4-run average applied retrospectively; Post marked as "measurement not possible¹" footnote. Actual measurement deferred to Sprint 105 (triggered when next github-worker substantive change PR merges).

## Carried Over (Sprint 104)

- Full Node service composite action expansion (remove `matrix.service != 'github-worker'` condition) — **priority**
- ai-analysis coverage lcov integration (pytest-cov --cov-report=lcov) — **priority**
- github-worker pre/post timing 5-sample measurement + retrospective fill of this ADR's comparison table — **priority**
- Oracle `__AGENT_DONE__` marker bug fix (oracle-spawn.sh)
- L2 cache layer (build output cache) — scope definition needed
- Frontend build optimization — scope definition needed
- Global coverage threshold upgrade to 70% — data-based decision

## References

- Channeltalk backend CI refactoring: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sprint 102 ADR: docs/adr/sprints/sprint-102.md
- CI refactoring 4-sprint roadmap: ~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-ci-refactoring-roadmap.md
