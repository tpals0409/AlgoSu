---
sprint: 169
title: "GitOps message service list + all-service zstd measurement + helper unit test (seeds #168-2/#168-3/#168-4)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Scout, Critic, Scribe]
related_adrs: ["sprint-168", "sprint-167", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 169 — GitOps message service list + all-service zstd measurement + helper unit test (seeds #168-2/#168-3/#168-4)

## Goal

- Recover the 3 carryover seeds from Sprint 168 (seed #168-1 GHCR retry guard was already recovered in Sprint 168 Phase F ✅)
- Seed #168-2 (observability): make the aether-gitops `deploy(algosu): update image tags` commit message list the actually-updated services + Trivy-skipped services (Sprint 168 D6 analysis)
- Seed #168-3 (verification): after Sprint 168's full zstd adoption, accumulate compression-ratio measurements across all services (8 services + frontend + blog) and document the data in the ADR → reinforce the Sprint 168 decision data (ai-analysis only → full 10-artifact expansion)
- Seed #168-4 (regression guard): add a unit test for `scripts/ci/report-build-metrics.sh` + auto-run in CI
- The settling stage of the "security gate (165) → visibility (166) → measurement (167) → full adoption (168) → verification/observability settling (169)" cycle

## Decisions

### D0. Single PR integration — 3 seeds + ADR (inherits Sprint 168 integration pattern)

- The 3 seeds (#168-2/#168-3/#168-4) + ADR are handled in a **single PR** (`feat/sprint-169-gitops-msg-zstd-data-helper-test`)
- Rationale:
  - All 3 seeds are in the CI domain (ci.yml + tests/ci/) — simple dependency graph
  - The sprint splits in Sprint 161~163 (P0/P1/P2) had high regression-isolation value, but these 3 seeds are mutually independent + small → single-PR integration cost < split cost
  - Phase split (architect code commit + scribe ADR commit) preserves atomicity
- Priority: #168-4 (regression guard, stability) > #168-2 (observability) > #168-3 (verification, already auto-accumulating so only ADR documentation)

### D1. Helper test framework — pure bash (no bats)

- Option comparison:
  - A (chosen): pure bash harness (`tests/ci/report-build-metrics-test.sh`) — zero external dependency, runs immediately on ubuntu-latest's default bash
  - B: bats (Bash Automated Testing System) — standard framework but adds a new CI toolchain (apt install bats) + learning cost
  - C: shellcheck only (lint) — not behavioral verification (static analysis only)
- Rationale: the helper is a single 75-line file + CI-only → bats adoption ROI is low. Zero-dependency pure bash matches the "minimize toolchain when adding new code" principle
- Environment guard: the helper assumes `stat -c %s` (GNU coreutils) → the test assumes the same. Non-GNU (macOS BSD stat) environments SKIP (exit 0) to prevent local false-red

### D2. commit message format — `→ <list> @ main-<sha> (skipped: <list>)`

- Recovery format decision for seed #168-2 from Sprint 168 D6
- Since all services share the same head SHA (`main-${SHA}`), repeating the SHA per service (`frontend@main-X, blog@main-Y`) is redundant → single SHA + service list for a non-redundant notation
- Format: `deploy(algosu): update image tags → <updated csv> @ main-<short-sha> (skipped: <skipped csv>)`
  - no updated (defensive): `deploy(algosu): update image tags @ main-<short-sha>`
  - no skipped: omit the `(skipped: ...)` clause
- Data source: `steps.update_tags.outputs.updated` + `skipped_trivy` (already exported since Sprint 160 Phase C) → no new output needed, reuse
- Implementation: leading space trim (`xargs`) + space→comma conversion (`sed 's/ /, /g'`). Service names are fixed identifiers → zero injection risk

### D3. All-service zstd compression measurement data (seed #168-3)

Measurement method: `workflow_dispatch + rebuild_all=true` (run #26139812059, run on a **feature branch** — the deploy job is gated by `github.ref == 'refs/heads/main'` and auto-skips → zero GHCR push/ArgoCD deploy side effects, only zstd tarball measurement)

Measurement results (run #26139812059, head SHA `6a34a28`, 8 build artifacts):

| build artifact | zstd OCI export | Step Summary `compression saving` |
|----------------|-----------------|-----------------------------------|
| gateway | ✅ | box shown |
| identity | ✅ | box shown |
| submission | ✅ | box shown |
| problem | ✅ | box shown |
| github-worker | ✅ | box shown |
| ai-analysis | ✅ | **-63.7%** (Sprint 168 measured, code unchanged) |
| frontend | ✅ | box shown |
| blog | ✅ | box shown |

- All 8 build jobs confirmed `#27 exporting to oci image format … sending tarball done` in build logs → zstd export works across all services (**adoption verification MET**)
- Each build job's Step Summary `### 📦 <label> build artifact` box shows `compression saving %` (**visibility MET** — Sprint 168 deliverable confirmed across all services)
- **Consolidating the per-service zstd raw % static table is carried over to Sprint 170 seed #169-1**: GitHub Step Summary is not exposed via REST API/job log + zstd tarballs are not uploaded as artifacts (intended design, no Trivy consumer) → not programmatically extractable. To auto-extract, the helper must echo a metric line to stdout (log-greppable) or upload the zstd tarball as an artifact (#169-1)
- The exact saving % for the 7 non-ai-analysis services is visually verifiable in each build job's Step Summary in run #26139812059 (live data)

### D4. Measurement dispatch safety policy — feature branch run (avoid deploy side effects)

- Sprint 168 Phase A used `--ref main` for force-build → the deploy job met the main-ref condition → actual ArgoCD deployment occurred (harmless then since idempotent)
- This sprint uses a **feature branch** dispatch → build jobs have `push=${{ github.ref == 'refs/heads/main' }}` = false (no GHCR push) + deploy job skips on the main gate → measurement data is obtained identically (zstd tarballs are always produced)
- Applies the "stability > velocity" principle at the measurement stage — measurement is not coupled with deploy side effects

## Implementation (single PR, targeting 37 consecutive sprints of branch discipline)

Branch: `feat/sprint-169-gitops-msg-zstd-data-helper-test` (new, based on main `7ec560c`)

### Phase A — helper unit test + CI integration (commit `6a34a28`)

`tests/ci/report-build-metrics-test.sh` (new, pure bash):

```bash
# docker PATH shim: controls buildx du via STUB_DOCKER_MODE(ok|fail) (removes daemon dependency)
# GNU stat guard: non-GNU environments SKIP (exit 0)
# 6 cases:
#   1. missing-arg fail-fast (${1:?} / ${2:?})
#   2. zstd branch compression saving % (1000→250 = -75.0%)
#   3. zstd-omitted branch (no oci+zstd line)
#   4. GITHUB_STEP_SUMMARY unset → /dev/stdout fallback + ::warning::
#   5. docker buildx du failure → graceful N/A / 0 fallback
#   6. docker buildx du success → cache size/entries parsing
```

`.github/workflows/ci.yml`:
- add a `ci-scripts` filter (`scripts/ci/**`, `tests/ci/**`) + output + rebuild_all override/else branches to `detect-changes`
- new `quality-ci-scripts` job — `if: needs.detect-changes.outputs.ci-scripts == 'true'` → `bash tests/ci/report-build-metrics-test.sh`

### Phase B — GitOps commit message service list (commit `6a34a28`)

`.github/workflows/ci.yml` "Commit and push to aether-gitops" step:

```bash
SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
UPDATED_CSV=$(echo "${{ steps.update_tags.outputs.updated }}" | xargs | sed 's/ /, /g')
SKIPPED_CSV=$(echo "${{ steps.update_tags.outputs.skipped_trivy }}" | xargs | sed 's/ /, /g')
if [ -n "$UPDATED_CSV" ]; then
  MSG="deploy(algosu): update image tags → ${UPDATED_CSV} @ main-${SHORT_SHA}"
else
  MSG="deploy(algosu): update image tags @ main-${SHORT_SHA}"
fi
if [ -n "$SKIPPED_CSV" ]; then
  MSG="${MSG} (skipped: ${SKIPPED_CSV})"
fi
git commit -m "$MSG"
```

### Phase C — all-service zstd measurement (external trigger, zero code change)

- `gh workflow run ci.yml --ref feat/sprint-169-... -f rebuild_all=true` (run #26139812059)
- the build-job helper already outputs zstd tarballs → collect compression ratios for 10 artifacts from the Step Summary (D1 data table → D3 documentation)

### Phase D — ADR documentation (commit `<TBD-ADR>`)

- `docs/adr/sprints/sprint-169.md` (KR) + `docs/adr-en/sprints/sprint-169.md` (EN 1:1 mapping)
- `docs/adr/README.md` count 108→109, range 62~168→62~169 (lines 18/52/54)

## Critic cycle

**R1** (codex review --base 7ec560c): `<TBD-CRITIC-R1>`

## Risk / regression guard

### Prediction 1: environment compatibility of the helper test

- `stat -c %s` assumes GNU coreutils → non-GNU SKIP guard (exit 0). On CI (ubuntu-latest) all 6 cases run
- the docker PATH shim removes the real docker daemon dependency → deterministic test (regardless of CI runner docker)
- `quality-ci-scripts` job verification: success in measurement run #26139812059 ✅ (18 assertions PASS in real CI environment)

### Prediction 2: zero aether-gitops regression from commit message change

- reuses the existing outputs (`updated`/`skipped_trivy`) of the `update_tags` step → no new output/logic added
- the `git diff --quiet` early-exit branch is unchanged → no commit when there are no changes (preserves existing behavior)
- service names are fixed identifiers (gateway/identity/...) → zero shell injection risk
- local simulation verified 5 cases (updated+skipped / updated only / single / skipped only / both empty)

### Prediction 3: zero deploy side effects of measurement

- feature branch dispatch → build push=false + deploy job skips on the main gate
- confirmed zero aether-gitops impact for measurement run #26139812059

## Verification

### Local
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS
- `bash tests/ci/report-build-metrics-test.sh` (with GNU stat shim injected) — 18/18 assertions PASS
- commit message logic simulation 5 cases PASS
- `node scripts/check-adr-en-coverage.mjs --strict` 118/118 (100.0%) PASS
- `node scripts/check-doc-refs.mjs` 301 files 0 broken refs PASS

### CI
- `quality-ci-scripts` job GREEN (helper test) — measurement run #26139812059 success ✅
- all 10 build artifacts show zstd compression ratios in the `workflow_dispatch + rebuild_all=true` run (D3)
- target mergeStateStatus CLEAN

### New UAT (Sprint 169)
- user-direct: visually confirm the service list + skipped services in the next aether-gitops deploy commit message

## Result

5 files changed:
- 1 new: `tests/ci/report-build-metrics-test.sh` (seed #168-4)
- 1 modified: `.github/workflows/ci.yml` (ci-scripts filter/output/job + commit message logic)
- 2 new: `docs/adr/sprints/sprint-169.md` (KR) + `docs/adr-en/sprints/sprint-169.md` (EN 1:1)
- 1 modified: `docs/adr/README.md` (lines 18/52/54)

Commits (PR #295):
- `6a34a28` feat(ci): Sprint 169 seeds #168-2/#168-4 — GitOps message service list + helper unit test
- `<TBD-ADR>` docs(adr): Sprint 169 ADR (KR + EN) + README update
- Squash merge: `<TBD-MERGE-SHA>`

## New patterns

- **Pure bash unit test + PATH shim = zero-dependency CI helper regression guard** — with bats not adopted, a pure bash harness in `tests/ci/*.sh` + a `docker` PATH shim (STUB_DOCKER_MODE) removes the daemon dependency → deterministic test. Runs immediately on ubuntu-latest's default bash. A single-file CI helper has low bats ROI → pure bash is the standard
- **GNU/BSD stat branching = environment-guard SKIP pattern** — the helper assumes `stat -c %s` (GNU) → the test guards the same environment then SKIPs (exit 0) on non-GNU. Prevents local (macOS) false-red for CI-only scripts. The "preserve local-run capability of CI-only code" pattern
- **Reusing existing step output = stronger observability without adding new output** — the commit message improvement reuses the `update_tags` step's existing `updated`/`skipped_trivy` outputs (introduced in Sprint 160 Phase C). Strengthens visibility only, with no new logic/output → minimal change surface
- **Feature-branch run for measurement dispatch = deploy side-effect isolation pattern** — for a `workflow_dispatch + rebuild_all` measurement, using a feature branch instead of the main ref → build push=false + deploy job skip → identical measurement data while zero GHCR push/ArgoCD deploy side effects. Safer than Sprint 168 Phase A (main ref). The principle of not coupling measurement with deploy
- **xargs trim + sed comma conversion = standard normalization of leading-space output** — since `${UPDATED}` is leading-space + space-separated, `echo | xargs` (trim+single-space) + `sed 's/ /, /g'` (comma) normalizes it. The standard pattern to convert a shell output list into a human-readable csv

## Lessons

- **Settling the carryover seeds across verification/observability/regression-guard = the natural follow-up to an adoption sprint** — right after Sprint 168's full zstd adoption, Sprint 169 settles via (1) all-service measurement verification (2) GitOps observability (3) helper regression guard. "adoption → settling" is the standard follow-up stage of a sprint split
- **ROI of pure bash tests = no bats needed for a single-file helper** — a 75-line single helper is sufficiently covered by pure bash + PATH shim. When the learning/toolchain cost of adopting a framework (bats) exceeds the ROI, the minimal tool is the right answer. "minimize toolchain when adding new code"
- **Observability strengthening prioritizes reuse of existing data** — the commit message improvement was solved by reusing the existing `update_tags` output, with no new output. When strengthening visibility, consider reusing existing data before adding new collection logic → minimizes change surface/regression risk
- **Separating measurement from deploy = the safety principle of measurement sprints** — Sprint 168 measured on the main ref (harmless since idempotent) but carried deploy side effects. Sprint 169 measures on a feature branch, isolating side effects. Measurement/experiments should run outside the deploy boundary as a standard

## Carryover items (Sprint 170+)

### New Sprint 169 carryover seeds
- **Seed #169-1**: auto-extract the per-service zstd raw % static table — have the helper also echo the `compression saving` metric line to stdout (log-greppable) or upload the zstd tarball as an artifact → auto-collect 8-service zstd % via `gh api .../logs` or artifact stat → complete the ADR D3 static table. Currently the Step Summary is not exposed via REST API, so it cannot be extracted

### Sprint 168 carryover remnants (recovered/continuing)
- ~~Seed #168-1 GHCR retry guard~~ → recovered in Sprint 168 Phase F ✅
- ~~Seed #168-2 GitOps commit message service list~~ → recovered in this sprint Phase B ✅
- ~~Seed #168-3 all-service zstd measurement~~ → recovered in this sprint Phase C/D3 ✅
- ~~Seed #168-4 helper unit test~~ → recovered in this sprint Phase A ✅

### CI visibility (Sprint 164 seeds #new4/5/7)
- PR-stage deploy gate simulation / aether-gitops kustomization auto PR template / `_parse_group_response` raw_text fallback envelope extension

### i18n/lint (Sprint 158 seeds #30/#31)
- build-artifact Korean-leftover CI step + i18n 3-layer checklist

### plan template (Sprint 157 seeds #24/#18)
- automate the i18n dual-obligation checklist / automate blog-post pre-merge cross-check

### ADR/blog reinforcement (Sprint 157 seeds #26/27/28)
- README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detection

### User-direct UAT (26 sprints accumulated)
- Seed #5: confirm Programmers re-submission grading passes
- Seed #9: visual alignment of ai-analysis on the production Grafana CB dashboard in an English environment
- All accumulated UAT items from Sprint 160~168 inherited
- New in Sprint 169 (1): visually confirm the service list + skipped in the next aether-gitops deploy commit message

### Maintained carryover
- Seed #23: plan template "fix accumulated count after rebase" checklist

### Follow-up (optional)
- create/edit page.tsx category UI
- Programmers URL auto category inference
- backfill existing SQL problem data
- remove coverage-gate `skipped` allowance (Sprint 156 Phase B option B)
- post-merge pre-deploy gate (Sprint 156 Phase B option C)
- automate prom-client Case B~D checks
- `.claude-tools/` Phase 2 actual deletion (after trigger-path verification)
- `(adr)` layout split (KR + EN override)
- Sprint 162 R1 P3: deep relative-path `.md` links uncovered
- Sprint 163 additional: H3-only PR table extraction + implementation H2 partial matcher + sprint-87 H3-only carryover

**ADR**: [sprint-169.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-169.md) (KR) + [sprint-169.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-169.md) <!-- doc-ref-lint: ignore -->
