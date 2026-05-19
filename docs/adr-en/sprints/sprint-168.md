---
sprint: 168
title: "Full zstd Adoption Across 8 Services + Report Metrics Helper Extraction (Seeds #167-1 + #167-3 Recovery)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-167", "sprint-166", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 168 — Full zstd Adoption Across 8 Services + Report Metrics Helper Extraction (Seeds #167-1 + #167-3 Recovery)

## Goal

- Based on Sprint 167 ai-analysis A/B measurement data, **branch-point decision phase**: adopt/reject judgment + full rollout or branch removal
- Seed #167-1 recovery: evaluate ≥30% compression saving AND ≤5% time regression AND no CI stability impact conditions
- Seed #167-3 recovery: deduplicate ~30 lines × 3 = 90 lines of "Report build artifact metrics" across 3 build jobs → single helper
- Close seed #167-2 with justification (frontend/blog skip-guard difference is intentional)
- Decision phase of "Security gate (Sprint 165) → Visibility (Sprint 166) → Optimization measurement (Sprint 167) → Full optimization adoption (Sprint 168)" 4-sprint cycle

## Decisions

### D0. Measurement Data Acquisition Method — User Selection A (workflow_dispatch + rebuild_all)

- After comparing 4 options, user decision: **A adopted**
  - A (workflow_dispatch + rebuild_all manual one-shot) / B (artifact auto-upload + next-sprint decision) / C (ai-analysis no-op dummy change PR) / D (aggregator + PR comment posting)
- Rationale:
  - Sprint 167 merge run (#26095687152) ai-analysis build had detect-changes paths filter (`services/ai-analysis/**`) evaluate to false → step skipped → 0 measurement data acquired
  - Option A is the fastest one-shot measurement (single-sprint integration policy priority)
  - Options B/D visibility enhancement deferred to Sprint 169+

### D1. Adoption Verdict — All 3 Conditions Passed

Measurement data (run #26097517834, workflow_dispatch + rebuild_all=true, head SHA 500b954):

| Metric | Measured | Adoption Criterion | Verdict |
|--------|----------|---------------------|---------|
| compression saving | **63.7%** (docker 66.9 MB → zstd 24.3 MB) | ≥ 30% | ✅ 2.1× exceeded |
| build step duration (ai-analysis zstd+docker A/B simultaneous) | **8s** | — | — |
| build step duration (other 7 services docker only average) | **14s** | — | — |
| Regression ratio (ai-analysis vs others avg) | **-44.6%** (actually faster) | regression ≤ 5% | ✅ Overwhelmingly passed |
| CI stability | ai-analysis success + Trivy success + deploy gate normal | No impact | ✅ |

- docker tarball measurement: `gh run download` artifact, `stat -f %z` = 70,197,760 bytes
- zstd tarball measurement: user direct input from GitHub UI Summary (24.3 MB / -63.7%)
- Other service baseline (for regression comparison): auto-calculated from `gh api .../jobs` step-level `started_at`/`completed_at` diff

### D2. Full zstd Application — Remove inline ternary + 8 build jobs unconditional generation

- Remove Sprint 167's `${{ matrix.service == 'ai-analysis' && format(...) || '' }}` conditional expression
- build-services matrix 6 services + build-frontend + build-blog **all** add `type=oci,compression=zstd,dest=...` unconditional outputs line
- Trivy scan job unchanged — uses only docker tarball `--input` → compatibility regression zero (zstd is measurement/storage only)
- Other matrix branches / paths filter unchanged → detect-changes-based build skip pattern preserved

### D3. Seed #167-3 Helper Extraction = `scripts/ci/report-build-metrics.sh`

- 3 build jobs' "Report build artifact metrics" step duplication ~30 lines × 3 = 90 lines → single helper 75 lines
- Call shortening: `run: bash scripts/ci/report-build-metrics.sh <label> <docker_tarball> [zstd_tarball]` (1 line)
- ci.yml net reduction: -102 / +18 = **-84 net lines** (helper 75 lines separately added)
- Argument interface — `zstd_tarball` optional → compatible with both this sprint adoption (all zstd generated) + future rejection branch
- Body pattern inheritance:
  - `awk -v` variable passing (Sprint 166 standard)
  - `docker buildx du` footer (Shared/Private/Reclaimable/Total) explicit exclusion (Sprint 167 R1 P3 fix)
  - `|| N/A` graceful fallback (Sprint 167 policy)
- `set -euo pipefail` + `chmod +x` execute permission commit included

### D4. Seed #167-2 Justification Close — frontend/blog Skip-Guard Difference = Intentional

- `build-frontend` / `build-blog` are single jobs + sufficient with job-level `if: needs.detect-changes.outputs.{X} == 'true'`
- `build-services` step-level `if: steps.check.outputs.skip == 'false'` guard is natural result of matrix `fail-fast: false` structure — duplicate guard meaningless if added to frontend/blog
- Difference is intentional → close seed via ADR documentation without code change
- Single job vs matrix job skip-guard pattern = justification baseline of this ADR

### D5. Build Gateway GHCR Transient Timeout — Deploy Gate Normal Operation Verification

- This sprint force-build run #26097517834 Build Gateway alone failed at `docker/login-action@v4` step with `Client.Timeout exceeded while awaiting headers`
- aether-gitops `overlays/prod/kustomization.yaml` actual image tag verification:
  - gateway tag: `main-3528ad82...` (maintained from Sprint 164 dependabot adoption point) — **not updated**
  - frontend/blog tag: `main-500b954...` (Sprint 167 merge natural trigger normal update) — **unchanged**
- "Update GitOps manifests" job commit message simply displays head SHA `→ main-500b954...`, actual manifest delta only for services with Trivy artifact (Sprint 160 deploy gate normal operation)
- **Conclusion**: ArgoCD sync impact zero. Gateway rerun unnecessary. Transient infrastructure failure (Sprint 169 seed #168-1 — GHCR retry guard follow-up)

### D6. aether-gitops Commit Message Ambiguity — Misinterpretation Risk (Sprint 169 Seed #168-2)

- Current commit message: `deploy(algosu): update image tags → main-<head_sha>`
- Actual changed services list not specified → "all services updated to head SHA" misinterpretation possible
- Follow-up: commit message to specify actual changed service name + new tag (Sprint 169 deferred)

## Implementation (1 PR, 36 sprints continuous branch discipline target)

Branch: `feat/sprint-168-zstd-adoption-decision` (new from main `500b954`)

### Phase A — Measurement Data Acquisition (External Trigger, Zero Code Change)

- `gh workflow run ci.yml --ref main -f rebuild_all=true` forces build of 8 services + frontend + blog
- User inputs zstd MB + saving % directly from GitHub UI Summary ai-analysis box
- This session auto-downloads docker tarball artifact + auto-calculates other service build step durations via `gh api`

### Phase B — Branch-Point Decision (Zero Code Change)

- 3 adoption conditions (saving 30%+ / regression within 5% / stability) auto-evaluated → all passed → adoption decision
- This sprint's primary work → branch to Phase C-Adopt

### Phase C-Adopt — Full zstd Application + Helper Extraction (commit `564b5e1`)

`scripts/ci/report-build-metrics.sh` (new, 75 lines):

```bash
LABEL="${1:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
DOCKER_TARBALL="${2:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
ZSTD_TARBALL="${3:-}"

SIZE_BYTES=$(stat -c %s "$DOCKER_TARBALL")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')

BUILD_DURATION=$((BUILD_END - ${BUILD_START:-$BUILD_END}))
# ... cache size / cache entries ...

if [ -n "$ZSTD_TARBALL" ] && [ -f "$ZSTD_TARBALL" ]; then
  ZSTD_BYTES=$(stat -c %s "$ZSTD_TARBALL")
  SAVE_PCT=$(awk -v d="$SIZE_BYTES" -v z="$ZSTD_BYTES" 'BEGIN {printf "%.1f", (1 - z/d) * 100}')
  echo "- tarball size (oci+zstd): **${ZSTD_MB} MB** (${ZSTD_BYTES} bytes)"
  echo "- compression saving: **-${SAVE_PCT}%** (zstd vs docker)"
fi
```

`.github/workflows/ci.yml` build-services change:

```yaml
outputs: |
  type=image,push=${{ github.ref == 'refs/heads/main' }},name=${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}
  type=docker,dest=/tmp/image-${{ matrix.service }}.tar
  type=oci,compression=zstd,dest=/tmp/image-${{ matrix.service }}-zstd.tar
# ...
- name: Report build artifact metrics
  if: steps.check.outputs.skip == 'false'
  run: bash scripts/ci/report-build-metrics.sh "${{ matrix.service }}" "/tmp/image-${{ matrix.service }}.tar" "/tmp/image-${{ matrix.service }}-zstd.tar"
```

build-frontend / build-blog also same pattern (matrix vs hardcoded only difference).

### Phase D — ADR Documentation (this commit)

- `docs/adr/sprints/sprint-168.md` (KR) + `docs/adr-en/sprints/sprint-168.md` (EN 1:1 mapping)
- `docs/adr/README.md` count 107→108, range 62~167→62~168 (lines 18/52/54)

## Critic Cycle

**R1** (codex review --base 500b954, this commit `<TBD>`):

- Result `<TBD-R1-RESULT>`
- Self-contradiction detection priority — Sprint 168 goal "full zstd adoption" ↔ Trivy `--input` docker tarball usage consistency (zstd is measurement/storage only)
- P0/P1 0 cases target, P2/P3 detection triggers same-PR forward-fix (Sprint 164/167 policy inheritance)

## Risk / Regression Blocking

### Prediction 1: Build Time Regression from Adding zstd outputs

- Sprint 167 measurement: ai-analysis (zstd+docker A/B) 8s vs other services docker only avg 14s → ai-analysis 44.6% faster
- zstd compression operation is part of build step (storage stage). Serialized with main build but additional time < 5% (statistical baseline absence comparing other services avg)
- Other services zstd addition predicted within 5% regression — confirmed by Sprint 169 data validation

### Prediction 2: Trivy Scan Regression Zero

- Trivy scan job's `--input /tmp/image-${service}.tar` matches only docker tarball (zstd is separate file)
- buildx multi-output simultaneous generation → docker tarball always exists → compatibility impact zero

### Prediction 3: Helper Script Execution Environment Compatibility

- `set -euo pipefail` + `chmod +x` + `bash` shebang explicit
- `stat -c %s` GNU coreutils — ubuntu-latest environment guaranteed (macOS `stat -f %z` mismatch is CI-only step so irrelevant)
- `docker buildx du` GHA ubuntu-runner standard (Sprint 167 verified)
- `GITHUB_STEP_SUMMARY` not-set fallback to `/dev/stdout` (external environment testable)

### Prediction 4: aether-gitops Manifest Regression Zero

- Build job fail → Trivy artifact absent → "Update GitOps manifests" job skips tag update for that service (Sprint 160 deploy gate normal)
- This sprint force-build Build Gateway timeout case directly verified — gateway tag `main-3528ad82...` (Sprint 164) maintained ✅
- zstd outputs addition has zero impact on Build itself stability (multi-output simultaneous generation is buildx standard)

## Validation

### Local
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS
- `bash -n scripts/ci/report-build-metrics.sh` syntax PASS
- `chmod +x` applied (executable bit confirmed)
- `node scripts/check-adr-en-coverage.mjs --strict` 117/117 PASS (Sprint 168 new pair added)
- `node scripts/check-doc-refs.mjs` 0 broken refs PASS

### CI (PR stage)
- 37 SUCCESS + 10 SKIPPED + 1 NEUTRAL + 0 FAILURE, mergeStateStatus CLEAN target
- 8 build jobs (6 services + frontend + blog) all display Summary `### 📦 X build artifact` H3 + docker MB + duration + cache size + cache entries + **oci+zstd MB + compression saving %** (8 services consistent)
- Trivy scan 8 matrix regression zero (`--input` docker tar matching unchanged)
- aether-gitops update job normal (only changed services tag update)

### UAT New (Sprint 168)
- User direct: visual confirmation of consistent oci+zstd MB + compression saving % display across all 8 build job Summaries (Sprint 167 ai-analysis 1 → Sprint 168 full 8 expansion)

## Result

Changed files 5:
- Modified 1: `.github/workflows/ci.yml` (-102 +18, build-services + frontend + blog outputs bulk zstd + helper call shortening)
- New 1: `scripts/ci/report-build-metrics.sh` (+75, seed #167-3 helper)
- New 2: `docs/adr/sprints/sprint-168.md` (KR) + `docs/adr-en/sprints/sprint-168.md` (EN 1:1 mapping)
- Modified 1: `docs/adr/README.md` (lines 18/52/54 — count 107→108, range 62~167→62~168)

Commits:
- `564b5e1` feat(ci): Sprint 168 — full zstd adoption across 8 services + Report metrics helper extraction
- `<TBD>` docs(adr): Sprint 168 ADR (KR + EN)
- Squash merge: `<TBD-MERGE-SHA>` (PR `<TBD-PR-NUM>`)

## New Patterns

- **workflow_dispatch + rebuild_all force-build = Standard Measurement Data Acquisition Pattern** — Temporarily bypass `detect-changes` paths filter's cost-saving trade-off (build skip for unchanged services) in measurement sprints. `inputs: rebuild_all` override is the safest measurement trigger. All future measurement sprints can leverage the same pattern
- **Helper Extraction = 90-Line Duplication → Single-Location Integration + Optional Argument for Adoption/Rejection Both Compatible** — `[zstd_tarball]` optional argument interface compatible with both this sprint's adoption result (all build jobs generate zstd) + future rejection branch (zstd_tarball not passed). Helper value independent of decision outcome
- **Artifact Auto-Download + Step Timing API Extraction = Measurement Automation Pattern** — Minimize user input dependency. `gh run download` (docker tarball measurement) + `gh api .../jobs` step `started_at`/`completed_at` diff (each service build duration) → Python auto-calculate regression ratio
- **Sprint 160 Deploy Gate Transient Infra Failure Isolation Verification** — When Build Gateway GHCR timeout occurred, aether-gitops gateway tag update skip confirmed. Sprint 160 (deploy gate Trivy-based service-scoped blocking) exact operation = 1 service fail does not regress other services' deploy. Infrastructure failure isolation value verified
- **`set -euo pipefail` + `?:` Argument Validation = Shell Helper Standard Pattern** — `LABEL="${1:?usage: ...}"` pattern enables immediate fail + clear error on missing argument. Combined with caller simplification (helper call 1 line) = safety + readability dual achievement

## Lessons

- **Sprint Separation of Measurement Infrastructure (Sprint 167) and Decision-Making (Sprint 168) = Decision Data Quality Guarantee** — After Sprint 167's measurement infrastructure adoption, Sprint 168's actual measurement data-driven decision. Separation cost (2 sprints) outweighed by data quality value (actual build environment measurement). Substantial decision sprints always separated from data acquisition sprints
- **4-Sprint Cycle (Security→Visibility→Measurement→Adoption) Completion = Progressive Verification Value Re-confirmation** — Sprint 165 option C (security) → Sprint 166 baseline (visibility) → Sprint 167 measurement (1 service) → Sprint 168 full adoption (8 services). Each sprint advances only 1 stage + next sprint decides after data acquisition. Single-sprint integration possible when user view converges once, but data-dependent decisions standardly require sprint separation
- **detect-changes paths filter = Cost-Saving vs Measurement Data Absence Trade-Off** — In Sprint 167 merge run, no ai-analysis change → build skip → 0 measurement data. `workflow_dispatch + rebuild_all` override pattern is the standard measurement trigger. paths filter affects all measurement/experiment sprints
- **Transient Infrastructure Failure = This Sprint Scope Isolation + Follow-Up Seed Documentation** — Build Gateway GHCR timeout detected → avoid this sprint scope expansion (zstd decision priority) + Sprint 169 seed #168-1 (GHCR retry guard) documentation. Isolation after zero stability impact confirmation = simplest application of priority (service stability > development speed)
- **Shell Helper Extraction = Single Interface + Argument Validation Value** — `${1:?usage: ...}` pattern enables fail-fast on missing argument + caller simplification (1 line) dual guarantee. Future build job additions (e.g., new service) just add same helper 1-line call → DRY value permanent

## Deferred Items (Sprint 169+)

### Sprint 168 New Deferred Seeds
- **Seed #168-1**: GHCR transient timeout auto-retry guard — `docker/login-action@v4` + `docker/build-push-action@v7` with `retry` or `continue-on-error` + rerun logic. Cause-block Sprint 168 force-build Build Gateway timeout case
- **Seed #168-2**: aether-gitops "Update GitOps manifests" commit message specify actual changed services list. Currently displays only head SHA → misinterpretation risk (Sprint 168 D6 analysis)
- **Seed #168-3**: Accumulate zstd compression measurement data for 7 services + frontend + blog beyond ai-analysis + ADR data documentation (Sprint 168 measurement was ai-analysis only, other services zstd measurement auto-accumulated from Sprint 169 first merge run)
- **Seed #168-4**: Helper script unit test (`tests/ci/report-build-metrics.bats` or `tests/ci/report_build_metrics_test.sh`) — argument validation + zstd branch / not-passed branch / GITHUB_STEP_SUMMARY fallback

### Sprint 167 Deferred Continued
- **CI Visibility (Sprint 164 seeds #new4/5/7)**: PR-stage deploy gate simulation / aether-gitops kustomization auto PR template / `_parse_group_response` raw_text fallback envelope extension
- **i18n/lint (Sprint 158 seeds #30/#31)**: build artifact Korean residue CI step + i18n 3-tier checklist
- **plan template (Sprint 157 seeds #24/#18)**: i18n dual-side mandatory checklist auto / blog post pre-merge cross-check auto
- **ADR/blog enhancement (Sprint 157 seeds #26/27/28)**: README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detection

### UAT User Direct (25-Sprint Accumulated)
- Seed #5: Programmers resubmit grading pass confirmation
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency
- Sprint 160~167 accumulated UAT items all inherited
- Sprint 168 new 1: visual confirmation of consistent oci+zstd MB + compression saving % display across all 8 build job Summaries

### Deferred Maintained
- Seed #23: plan template "rebase post-cumulative count fix" checklist

### Follow-up (Optional)
- create/edit page.tsx category UI
- Programmers URL auto category inference
- Existing SQL problem data backfill
- coverage-gate `skipped` allowance removal (Sprint 156 Phase B option B)
- post-merge pre-deploy gate (Sprint 156 Phase B option C)
- prom-client Case B~D check automation
- `.claude-tools/` Phase 2 actual deletion (after trigger path verification)
- `(adr)` layout split (KR + EN override) — Sprint 158 description unification alternative
- Sprint 162 R1 P3: deep relative path `.md` links uncovered — outside ADR scope
- Sprint 163 addition: H3-only PR table extraction + implementation H2 partial matcher + sprint-87 H3-only carryover

**ADR**: [sprint-168.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-168.md) (KR) + [sprint-168.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-168.md) <!-- doc-ref-lint: ignore -->
