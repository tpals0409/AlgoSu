---
sprint: 165
title: "PR-Stage Trivy Security Gate Establishment — Option C tarball + --input (Sprint 164 Phase A Essential Redesign)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-164", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 165 — PR-Stage Trivy Security Gate: Option C tarball + `--input`

## Goal

- Recover Sprint 164 Phase A carry-over — essential redesign to establish PR-stage Trivy scan as a security gate
- Single `if`-condition change (Sprint 164 Phase A close cause) collides with image registry policy, so build job itself + Trivy scan method must be redesigned together
- 3-option comparison (Option A `load: true` / Option B PR-specific tag push / Option C buildx tarball + fs scan) followed by essential decision
- Single sprint 4-phase completion (Sprint 161~163 split policy applied as unified case only for essential redesign)

## Decisions

### D0. Option C Adopted (User Decision)

- **Option C (buildx tarball + `--input`)** — build job exports tarball via `outputs: type=docker,dest=*.tar` → uploaded via `actions/upload-artifact@v6` → trivy-scan job downloads via `download-artifact` and performs `trivy image --input <tarball>` local scan
- **Adoption rationale**:
  - 0 GHCR pushes (zero storage cost, no cleanup workflow needed)
  - `linux/arm64` single-platform policy unchanged (avoids Option A conflict)
  - Matrix structure preserved (Sprint 160 per-service deploy gate pattern unchanged)
- **Rejection rationale**:
  - Option A (`load: true` + local scan): buildx `load` requires single-platform daemon → conflicts with `linux/arm64` build + GHA host `linux/amd64` runner. Tarball variant converges into Option C effectively
  - Option B (PR-specific tag push): 8 images pushed to GHCR per PR → storage increase + retention/cleanup workflow needed → operational debt

### D1. buildx Multi-Output Compatibility — `outputs:` Single Build

`docker/build-push-action@v7` conflicts when `outputs:` and separate `push:` coexist. With `outputs:` defined, push must also be specified inside outputs:

```yaml
# Before (adjacent cause of Sprint 164 close)
push: ${{ github.ref == 'refs/heads/main' }}
tags: ${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}

# Sprint 165 new
outputs: |
  type=image,push=${{ github.ref == 'refs/heads/main' }},name=${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}
  type=docker,dest=/tmp/image-${{ matrix.service }}.tar
```

Adoption rationale: conservative minimal change (single build) + cache scope unchanged. If cache hit rate regresses, forward-fix option of step separation retained within Sprint 165.

### D2. Tarball Format — `type=docker` (uncompressed) + GHA Default Zip Compression

- `type=docker`: docker save-compatible tar. Trivy `--input` reference implementation, 100% compatible
- `actions/upload-artifact@v6` default zip compression effective on docker save tarball layer metadata
- `type=oci,compression=zstd` carries double-compression inefficiency concern → forward-fix retained after measurement

### D3. Trivy `--platform` Option — Removed

Tarball is `linux/arm64` single manifest, so `--platform` option is meaningless. When using `--input`, blocks platform-matching-failure risk.

### D4. Deploy Gate Pattern (Sprint 160) — Unchanged

`deploy` job is automatically blocked from PR stage by `if: github.ref == 'refs/heads/main'` guard. Although `trivy-status` artifact is generated in PR stage, deploy doesn't lookup it → zero cost, zero regression.

## Implementation (1 PR, 33-Sprint Consecutive Branch Discipline)

| PR | Phase | Branch | Result |
|----|-------|--------|--------|
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | A — build tarball export | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase A `b8c6918` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | B — Trivy `--input` transition | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase B `1f9c364` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | C — Critic R1 P2 fix (SARIF fork PR guard) | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase C `8068806` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | D — Sprint 165 ADR | `feat/sprint-165-pr-trivy-tarball` | This ADR |

### Phase A — Build Job Tarball Export (`b8c6918`)

- **Changed file**: `.github/workflows/ci.yml` (+31 -6)
- **Change scope**: 3 build jobs (`build-services` / `build-frontend` / `build-blog`)
- **Key changes**:
  - Remove `push:`/`tags:` keys → add `outputs:` multi-line (image push conditional + docker tarball unconditional)
  - New `actions/upload-artifact@v6` step (name: `image-tar-${service}`, retention-days: 1, `skip` guard same)
  - `platforms` / `cache-from` / `cache-to` / `build-args` / `context`: **unchanged**
- **Verification**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS, diff stat +31 -6

### Phase B — Trivy `--input` Transition (`1f9c364`)

- **Changed file**: `.github/workflows/ci.yml` (+11 -11)
- **Key changes**:
  - `if: github.ref == 'refs/heads/main' && !cancelled()` → `if: ${{ !cancelled() }}`
  - New `actions/download-artifact@v6` step right after Checkout (name: `image-tar-${matrix.service}`, path: `/tmp`)
  - `trivy image` 2 calls (table + SARIF): remove `--platform linux/arm64`, registry ref → `--input /tmp/image-${service}.tar`
  - Remove `TRIVY_USERNAME`/`TRIVY_PASSWORD` env (registry auth unnecessary)
  - `.trivyignore` / `--severity CRITICAL,HIGH` / `--exit-code 1` / `--ignore-unfixed` / SARIF format/output / `upload-sarif@v4` / status artifact: **unchanged**
- **Verification**: YAML parse PASS, trivy-scan steps 9 (1 new download-artifact added), Sprint 160 per-service gate pattern unchanged

### Phase C — Critic R1 P2 fix + Measurement

**Codex Critic R1** (codex review --commit `1f9c364`, session via `codex exec`):
- **P0/P1: 0 items** ✅
- **P2 1 item**: `upload-sarif@v4` may fail due to permission shortage in fork/Dependabot PRs
  - Cause: GitHub fork PR `GITHUB_TOKEN` is read-only, so `security-events: write` not allowed
  - Impact: Trivy table scan succeeds but only SARIF upload fails → Sprint 164 "noisy CI red" pattern recurrence possible (partial self-contradiction of sprint goal)
  - Recommended action: extend `if` of SARIF upload step with same-repo PR guard
- **Focused Checks 5 items all OK**: buildx multi-output compatibility / Trivy `--input` + arm64 tarball / deploy gate regression / registry auth removal / PR-commit description consistency

**Phase C P2 fix** (commit `8068806` + R2 forward-fix `<TBD-FORWARDFIX-SHA>`):
- `.github/workflows/ci.yml:895` "Upload Trivy SARIF" step `if` condition extension (R1 + R2 P2 combined):
  ```yaml
  if: >
    always() &&
    steps.check.outputs.skip == 'false' &&
    (github.event_name != 'pull_request' ||
     (github.event.pull_request.head.repo.full_name == github.repository &&
      github.event.pull_request.user.login != 'dependabot[bot]'))
  ```
- table scan (PR gate) preserved as-is → security gate effect 100% preserved
- SARIF upload limited to same-repo non-Dependabot PR + main only → blocks fork/Dependabot noisy red
- R2 P2 detection: GitHub Docs "Dependabot on GitHub Actions" notes that same-repo Dependabot PRs also receive read-only `GITHUB_TOKEN` → original `head.repo.full_name == repository` guard alone is partial. Combined with `pull_request.user.login != 'dependabot[bot]'`

**Measurement results (PR #290 run 26087105241, ci.yml + sprint-165.md change PR)**:
- detect-changes: 6 services changed=false (no code change), blog/docs changed=true (`docs/adr/**` match)
- build-services 6 SUCCESS (each 4-9 sec — only `Skip if not changed` step executed)
- build-frontend SKIPPED, build-blog runs after this ADR commit
- Trivy Scan 8 matrix all SUCCESS (skip step working correctly, matrix regression zero)
- **PR limitation**: ci.yml itself doesn't match paths-filter → tarball + `--input` empirical validation naturally occurs in next code-changing PR (e.g., seed #new-4~7 recovery). Carried over to UAT items

### Phase D — ADR Record (This PR)

- **New files**: `docs/adr/sprints/sprint-165.md` (KR) + `docs/adr-en/sprints/sprint-165.md` (EN)
- **Updated file**: `docs/adr/README.md` count 104 → 105, range 62~164 → 62~165
- **Memory update**: `sprint-window.md` Sprint 164 → Sprint 165 sliding (Oracle direct after Phase D)

## Risk/Regression Blocking (Critic R1 Pre-prediction 3 items)

### Prediction 1: buildx Multi-Output Cache Hit Rate Degradation

- **Hypothesis**: cache layer efficiency reports for `cache-to: type=gha,mode=max` combined with `outputs: type=image,push=... + type=docker,dest=...`
- **Pre-blocking**: D1 adoption + `cache-from`/`cache-to` scope unchanged
- **Critic R1 result**: ✅ OK — "Not a change that directly breaks cache key or hit rate. retention-days: 1 keeps storage quota risk low"

### Prediction 2: Trivy `--input` + `--platform` Matching Failure

- **Hypothesis**: matching failure reports when `--platform linux/arm64` specified on `linux/arm64` single-manifest tarball
- **Pre-blocking**: D3 — remove `--platform` option. Specified in Phase B diff
- **Critic R1 result**: ✅ OK — "Trivy `--platform` removal fits single-image tarball scan. Trivy docs also support `--input` for tar archive scan"

### Prediction 3: Deploy Gate Artifact Regression

- **Hypothesis**: trivy-scan generates status artifact in PR stage → deploy job may erroneously lookup PR artifact
- **Pre-blocking**: D4 — deploy's `github.ref == 'refs/heads/main'` guard automatically blocks
- **Critic R1 result**: ✅ OK — "trivy-status-* artifacts generated in PR aren't looked up because deploy job doesn't run"

### New Detection: fork/Dependabot PR SARIF Upload Failure (Critic R1 P2)

- **Cause**: fork/Dependabot PR `GITHUB_TOKEN` is read-only, so `security-events: write` permission blocked → `upload-sarif@v4` fail
- **Impact**: Trivy table scan succeeds but only SARIF upload fails → Sprint 164 noisy CI red pattern recurrence possible (partial self-contradiction of sprint goal)
- **Phase C fix applied**: extend SARIF upload step `if` condition — same-repo PR + main only allowed, fork/Dependabot PR auto-skipped. table scan preserved, security gate effect 100% preserved

## Verification

- [x] CI 35 checks PASS (run 26087105241, mergeStateStatus CLEAN)
- [x] PR Checks tab `Trivy Scan — {service}` 8 matrix displayed (gateway/identity/submission/problem/github-worker/ai-analysis/frontend/blog)
- [x] `deploy` job auto-skip confirmed (PR stage not triggered, `github.ref == 'refs/heads/main'` guard)
- [x] Codex Critic R1: P0/P1 0 items, P2 1 item (fork PR SARIF) — Phase C immediate fix
- [ ] Codex Critic R2 PASS — to be invoked after Phase C fix push
- [ ] check-adr-en-coverage --strict 114/114 (100.0%) PASS
- [ ] check-doc-refs 0 broken refs
- [ ] **Carry-over UAT**: tarball + `--input` empirical validation (naturally occurs in next code-changing PR)
- [ ] **Carry-over UAT**: Security tab SARIF code scanning alert visual confirmation (after main merge)
- [ ] **Carry-over UAT**: cache hit rate measurement (multi-output regression blocking validation)

## Results

- **origin/main**: `ecfe954` → **`<TBD-MERGE-SHA>`** (after PR #290 squash merge, sprint-window.md update)
- **commits**: Phase A `b8c6918` + Phase B `1f9c364` + Phase C `8068806` + Phase D `de38d62` + R2 P2/P3 forward-fix `<TBD-FORWARDFIX-SHA>` (5 commits total → squash merge)
- **ci.yml cumulative change**: +50 -18 (3 build jobs multi-output + trivy --input + SARIF fork guard)

## New Patterns

- **Essential redesign 1-sprint integration vs split pattern comparison**: Sprint 161~163 split (P0/P1/P2 per sprint) vs Sprint 165 single integration. Option comparison → essential decision → single-PR's simple dependency-graph preferred over split's regression isolation effect
- **buildx multi-output explicit pattern**: `outputs: | type=image,push=...,name=... + type=docker,dest=...` two lines. Consolidate `push:` and `tags:` keys into single `type=image` line inside outputs. Push policy branching consistently handled via `push=<expression>` inside outputs
- **upload-artifact + download-artifact pair matrix naming**: build job's `name: <prefix>-${matrix.service}` 1:1 matches trivy-scan job's `name: <prefix>-${matrix.service}`. Standard pattern for artifact transfer between two matrix jobs
- **`--platform` removal = tarball scan safety pattern**: single-manifest tarball carries matching failure risk when `--platform` is specified. Removing `--platform` is the default when using Trivy `--input` (difference from registry pull explicitly documented)
- **Critic R1 P2 immediate forward-fix pattern**: P0/P1 0 items + P2 1 item self-contradiction detected → blocked same-PR same-day with same-repo guard. Sprint 164 Phase B blog Dockerfile fix pattern recurrence

## Lessons

- **Essential redesign can be integrated in single sprint — when option comparison converges in single user-facing decision**: Sprint 164 Phase A close cause's adjacent cause (image registry policy graph) clearly converged to Option C. AskUserQuestion single round decision → single-sprint integration cost lower than split's regression isolation effect
- **`outputs:` and `push:` keys mutually exclusive**: `docker/build-push-action@v7` buildx multi-output mode ignores `push:`/`tags:` keys. Policy branching consolidated to `push=<expr>` + `name=<ref>` inside outputs. Must be documented in PR body/comments
- **PR-stage security gate is standard solution via build artifact transfer pattern**: avoid registry push (external PR trust boundary) + zero storage cost + matrix structure preservation. tarball + upload-artifact is most conservative in ARM-only single-platform environments
- **Sprint 164 Critic R1 P1 self-contradiction detection value re-confirmed**: Codex gpt-5 detected image registry policy conflict in simple 1-line change as essential defect → triggered Sprint 165 essential redesign. Single-model-family blindspot complementing pattern extended
- **Trivy `--input` doesn't require registry auth — env cleanup obligation**: `TRIVY_USERNAME`/`TRIVY_PASSWORD` are meaningless during tarball scan but residual creates cleanup debt. Env cleanup checklist established during registry → tarball transition
- **fork/Dependabot PR SARIF upload permission limit**: `security-events: write` blocked in fork PRs is a structural limitation. Same-repo PR + main only guard becomes standard pattern. Sprint 164 Phase A "noisy CI red" reproduction route blocked

## Carry-Over (Sprint 166+)

- **Sprint 166 cleanup sprint candidates**:
  - tarball size monitoring automation (cache hit rate + artifact size in GHA step summary)
  - zstd compression forward-fix comparison (D2 alternative)
- **Sprint 164 carry-over seeds (continued)**:
  - Seeds #new-4/5/6/7 (CI visibility): PR deploy gate simulation / aether-gitops kustomization auto-PR / `$GITHUB_STEP_SUMMARY` standardization / envelope extension
  - Seeds #30/#31 (Sprint 158): Build output Korean residue CI step + i18n 3-layer checklist
  - Seeds #24/#18: plan template i18n bilateral obligation / blog cross-check
  - Seeds #26/27/28 (Sprint 157): README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detect
- **UAT 22-sprint cumulative**:
  - Seed #5/#9 + Sprint 160~164 new
  - Sprint 165 new: PR Checks tab `Trivy Scan — {service}` matrix visual + Security tab SARIF code scanning alert
- **Carry-over retained**: Seed #23 (plan template rebase count fix)
- **Follow-up (optional)**: Sprint 162 R1 P3, Sprint 163 additions (H3-only PR table extraction etc.), `.claude-tools/` Phase 2 actual deletion, `(adr)` layout split, post-merge pre-deploy gate
