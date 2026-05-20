---
sprint: 173
title: "PR deploy gate simulation + forward-fix PR template (seeds #new4/#new5)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-164", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 173 — PR deploy gate simulation + forward-fix PR template (seeds #new4/#new5)

## Goal

- Recover 2 carryover CI-visibility seeds from Sprint 164.
- **#new4** — simulate the deploy gate at the PR stage for shift-left visibility: surface which services WOULD deploy / which would SKIP in PR Checks before the main merge.
- **#new5** — auto-generate a forward-fix PR body template in the deploy summary that the operator can paste immediately when an aether-gitops push fails.
- Seed **#new7** (`_parse_group_response` envelope extension) carries a security-regression risk of touching Sprint 164 #new3's raw-exposure-blocking fix, so it is separated from this sprint's scope → carried over to Sprint 174.

## Decisions

### D0. Extract the deploy gate fail-closed decision logic into a pure helper

Extract the deploy gate fail-closed decision logic into a `scripts/ci/compute-deploy-gate.sh` pure helper → the deploy job (main-only) and the new deploy-simulation job (PR) share the same SSOT. Rationale: duplicating the same gate in two places risks a divergence between the PR simulation prediction and the actual deploy → a single helper guarantees consistency. Follows the existing helper-extraction pattern (Sprint 168 `report-build-metrics.sh`).

### D1. Candidate list (CANDIDATES) computation stays out of the helper

The candidate list computation depends on the GitHub Actions context (detect-changes outputs + build job result), so it stays out of the helper — the caller (ci.yml) computes it and passes it as an argument. The helper handles only the trivy-status gate decision (single responsibility).

### D2. Preserve fail-closed

Each candidate's `trivy-status/<svc>.txt` yields UPDATED only when it is exactly `"pass"`; everything else (fail/missing/look-alike values) yields SKIPPED. This is the core property of the Sprint 159 regression + Critic R1 P1 security gate — preserved identically after the helper extraction.

### D3. Rationale for the PR simulation being feasible

The trivy-scan job also runs on PRs (Sprint 165 Option C, `if: !cancelled()`) and uploads the `trivy-status-<svc>` artifact on PRs too → at PR time, all simulation inputs (detect-changes / build result / artifact) exist. The simulation job is dry-run (no clone / yaml edit / push) → it only writes a Step Summary.

### D4. The #new5 forward-fix template prints only on the push-failure branch

#new5 prints only on the push-failure branch of the deploy job's "Surface deploy summary" — it generates a forward-fix PR body for the operator to paste (target image tag + kustomization overlays/prod path + failing CI run link) as a `<details>` collapsible block + markdown code fence. The happy-path behavior is unchanged.

### D5. Reuse the detect-changes filter

The new helper/tests are already covered by detect-changes' `ci-scripts` filter (`scripts/ci/**` + `tests/ci/**` globs) → no per-file filter addition needed. Only add a test-execution step to the `quality-ci-scripts` job.

## Implementation (single PR, branch `feat/sprint-173-deploy-gate-visibility`)

### Phase A — helper extraction + unit tests (Architect, commit `f7cda47`)

`feat(ci): compute-deploy-gate.sh 헬퍼 추출 + 단위 테스트 (Sprint 173 #신규4)`

- `scripts/ci/compute-deploy-gate.sh` new (58 lines, fail-closed pure helper, header annotation)
- `tests/ci/compute-deploy-gate-test.sh` new (pure bash, 7 cases / 19 assertions)

### Phase B — ci.yml wiring + simulation job + forward-fix (Architect, commit `3379f4d`)

`feat(ci): deploy 게이트 헬퍼 연동 + PR 시뮬 job + forward-fix 템플릿 (Sprint 173 #신규4/#신규5)`

- Add a test-execution step to the `quality-ci-scripts` job
- Refactor the deploy job's `update_tags` gate loop to a helper call + add a helper sparse-checkout step (the deploy job does not full-checkout the AlgoSu repo, only clones aether-gitops)
- New deploy-simulation job (PR-only `if: github.event_name == 'pull_request' && !cancelled()`, trivy-status-* download continue-on-error, helper dry-run → STEP_SUMMARY)
- Add the #new5 forward-fix block

### Phase C — ADR recording (Scribe, this commit)

- `docs/adr/sprints/sprint-173.md` (KR) + `docs/adr-en/sprints/sprint-173.md` (EN 1:1)
- `docs/adr/README.md` count 111→112, range 62~171→62~173

## Critic cycle

- **R1** (`codex review --base main`, codex-cli 0.130.0, session ID `019e43cf-5c4e-7153-9dcc-1df410f5d5e9`): **0 P0/P1/P2/P3 findings, PASS** ✅ — "no functional regression, no merge-blocking bug". Confirmed deploy gate behavior unchanged + fail-closed preserved.

## Risk / regression guard

### Prediction 1: deploy behavior unchanged
STATUS_DIR definition / CANDIDATES computation / python yaml tag edit / GITHUB_OUTPUT recording are all preserved. The helper is invoked by absolute path (`$GITHUB_WORKSPACE/scripts/ci/...`), so it works even after `cd aether-gitops/...`. The helper output may leave a leading space, but downstream normalizes it via xargs anyway → behavior identical.

### Prediction 2: simulation job has no production impact
The simulation job is PR-only + dry-run → no production impact. A docs-only PR (0 artifacts) does not turn the job red either, thanks to continue-on-error + a defensive mkdir.

### Prediction 3: helper regression guard
`quality-ci-scripts` runs the 19 assertions on `scripts/ci/**` or `tests/ci/**` changes → guards against helper regressions.

## Verification

### Local
- `bash tests/ci/compute-deploy-gate-test.sh`: 19/19 PASS (macOS, no docker / GNU stat dependency)
- `python3 yaml.safe_load(ci.yml)`: PASS
- shellcheck (helper + tests): CLEAN
- diff secret scan: 0 sensitive patterns
- fail-closed edges: missing→skip, look-alike (passed/PASS)→skip verified via unit tests

### CI (expected)
- On PR CI, `quality-ci-scripts` (19 assertions) success → the deploy-simulation job writes "Deploy preview" to the PR Step Summary
- `check-adr-en-coverage --strict` / `check-doc-refs` expected PASS

### New UAT (Sprint 173)
- On a real PR, visually confirm the deploy-simulation job's Step Summary shows the WOULD deploy / SKIP list accurately as "🔮 Deploy preview"

## Result

- **Merge**: origin/main `0739913` → `<TBD-MERGE-SHA>` (PR #<TBD>, squash merge)
- **Net change**: +304 -16 (new helper + tests + ci.yml, 3 files)

## New patterns

- **Gate-logic SSOT extraction → guaranteed main/PR consistency**: unifying the deploy decision rule into a helper makes "what you saw predicted in the PR" structurally identical to "the actual main deploy". The trustworthiness of shift-left visibility comes from sharing the same code.
- **Accompany a security-gate extraction with fail-closed unit tests**: extraction carries a regression risk → lock down exact-match / missing / look-alike rejection with tests to preserve the security property after extraction.

## Lessons

- **A simulation is only meaningful when it shares code with the real path**: if the dry-run is separate logic, it soon diverges from reality. The same helper + the same input (artifact) secure the accuracy of the PR prediction.
- **"Behavior unchanged" in an extraction refactor must be verified down to the downstream contract**: real invariance requires confirming the helper output format (leading-space trim) is compatible with the GITHUB_OUTPUT consumer (xargs).
- **Separate carryover is the right call for security-sensitive seeds**: #new7 risks touching the #new3 security fix → keep it unbundled and separated to isolate the regression.

## Carryover (Sprint 174+)

### Sprint 173 separated carryover seed
- **#new7** `_parse_group_response` envelope extension (needs careful security review — may conflict with the #new3 raw-exposure-blocking fix)

### Inherited carryover seeds
- i18n/lint (Sprint 158 #30/#31), plan template (Sprint 157 #24/#18/#23 + the "name the consumer simultaneously when introducing a new artifact" checklist = combined with the Sprint 171 lesson), ADR/blog reinforcement (Sprint 157 #26/27/28)
- Direct user UAT: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160~173 accumulated
- Other follow-ups (optional): remove coverage-gate skipped tolerance, post-merge pre-deploy gate, prom-client Case B~D, .claude-tools Phase 2 deletion, (adr) layout split, deep relative-path .md links, H3-only PR table extraction
