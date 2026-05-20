---
sprint: 170
title: "zstd saving stdout auto-extraction + measurement finding: zstd ~0% on warm cache (seed #169-1)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Scout, Critic, Scribe]
related_adrs: ["sprint-169", "sprint-168", "sprint-167"]
related_memory: ["sprint-window"]
---
# Sprint 170 — zstd saving stdout auto-extraction + measurement finding: zstd ~0% on warm cache (seed #169-1)

## Goal

- Recover Sprint 169 carryover seed #169-1: have `report-build-metrics.sh` emit `compression saving %` to **stdout (job log)** as a greppable marker, in addition to `$GITHUB_STEP_SUMMARY` → auto-collect the 8-service zstd % via `gh run view --log | grep` → complete the incomplete static table from Sprint 169 ADR D3 (only ai-analysis had a raw %)
- Extend the `quality-ci-scripts` unit test alongside the helper change (mandatory regression guard)
- The measurement-automation stage of the "security gate (165) → visibility (166) → measurement (167) → full adoption (168) → verification/observability settling (169) → measurement automation (170)" cycle

## Decisions

### D0. Adopted approach — Option A (stdout echo)

- Option comparison:
  - A (chosen): the helper echoes the saving metric as one line to stdout (job log) → extract via `gh run view --log | grep`. Zero storage cost, log-observability bonus
  - B: upload the zstd tarball as an artifact → `gh run download` + stat for exact bytes. But storage cost + no Trivy consumer makes the artifact pointless
- Rationale: the Step Summary is not exposed via GitHub REST API/`gh run view --log` so it cannot be extracted programmatically (the Sprint 169 D3 carryover reason). Option A is superior — zero storage + grep all 8 services at once from the log

### D1. Marker format — plain greppable line (no `::notice::`)

- Format: `ZSTD-METRIC service=<label> docker_bytes=<n> zstd_bytes=<n> saving_pct=-<pct>`
- Plain marker chosen over `::notice::` annotation — grep robustness + avoids GitHub annotation limits/noise
- Output location: stdout **immediately after** the `} >> "$GITHUB_STEP_SUMMARY"` block. The group command `{ }` is not a subshell, so `ZSTD_BYTES`/`SAVE_PCT` set in the zstd branch remain valid after the block → no recomputation (minimal change)
- No marker when the zstd file is absent (N/A) — the current 8 services always produce zstd, so success-only is sufficient

### D2. Unit test Case 7 (mandatory regression guard)

- Added Case 7 to `tests/ci/report-build-metrics-test.sh` — mandatory `quality-ci-scripts` regression guard on helper changes (Sprint 169 seed #168-4 settling)
- 3 verifications: (1) marker value accuracy (`docker=1000 zstd=250 saving=-75.0`) (2) marker not mixed into the Summary file (stdout separation) (3) marker absent when no zstd
- Inherits the existing GNU stat guard — macOS local SKIP (exit 0), full run in CI (ubuntu-latest) (18 → 22 assertions)

### D3. Measurement result — zstd ~0% on warm cache (key finding)

Measurement method: **PR #296's CI run #26140657480** (no separate `workflow_dispatch` needed). The helper file is included in every service's `detect-changes` filter (`'scripts/ci/report-build-metrics.sh'`), so a helper-change PR triggers all 8 build jobs → the PR run itself is the measurement run. The PR has `push=${{ github.ref == 'refs/heads/main' }}` = false → zero GHCR push/ArgoCD deploy side effects (the Sprint 169 D4 isolation principle naturally satisfied by the PR run).

`gh run view 26140657480 --log | grep ZSTD-METRIC` auto-collection result (head SHA `12b3535`, 8 build artifacts):

| build artifact | docker tarball | oci+zstd tarball | compression saving |
|----------------|----------------|------------------|--------------------|
| gateway | 94.8 MB (99,382,272 B) | 94.8 MB (99,380,224 B) | **-0.0%** |
| identity | 77.4 MB (81,171,456 B) | 77.4 MB (81,169,408 B) | **-0.0%** |
| submission | 77.8 MB (81,590,272 B) | 77.8 MB (81,588,224 B) | **-0.0%** |
| problem | 77.5 MB (81,282,560 B) | 77.5 MB (81,280,512 B) | **-0.0%** |
| github-worker | 64.0 MB (67,122,688 B) | 64.0 MB (67,120,640 B) | **-0.0%** |
| ai-analysis | 55.8 MB (58,486,784 B) | 55.8 MB (58,484,736 B) | **-0.0%** |
| frontend | 94.0 MB (98,544,640 B) | 94.0 MB (98,543,104 B) | **-0.0%** |
| blog | 30.8 MB (32,316,928 B) | 30.8 MB (32,315,392 B) | **-0.0%** |

**Finding**: across all 8 services the size difference between the docker tarball and the oci+zstd tarball is exactly **2048 bytes** (container-format manifest/index overhead) → the layer blobs are **byte-identical** between the two exporters → zstd compression is not actually applied to the layers (saving ~0%).

**Cause (cold vs warm cache)**:
- The build log shows `#7 importing cache manifest from gha:...` → `cache-from: type=gha` warm cache hit
- Without `force-compression=true`, buildx **reuses the existing compressed layer blobs from cache/base images without recompressing** → both `type=docker` and `type=oci,compression=zstd` embed the same blob → identical size
- Sprint 168's ai-analysis -63.7% (docker 66.9 MB → zstd 24.3 MB) was a one-time measurement from the **first-ever zstd build (cold/fresh layers)** + the zstd value was manually typed by the user from the UI → not representative of steady state

**Implications**:
- The current zstd OCI export provides ~0% saving on warm-cache steady-state builds + Trivy consumes the docker tarball (the zstd tarball is not uploaded, no consumer) → **the zstd export is effectively an unconsumed, zero-saving redundant export step**
- This finding is the result of #169-1 auto-measurement working as intended — manual Step Summary inspection only confirmed "box shown across all services" (Sprint 169 D3), whereas auto-extraction's raw-byte comparison revealed the ~0% fact
- The follow-up decision is **split into seed #170-1** (avoid scope creep, measurement-sprint principle)

### D4. PR run = measurement run (natural evolution of Sprint 169 D4)

- Sprint 169 D4 ran a separate `workflow_dispatch + rebuild_all=true` on a feature branch for measurement
- This sprint: the helper file is registered in every service's detect-changes filter, so a **helper-change PR auto-triggers all 8 build jobs** → the PR run becomes the measurement run without a separate dispatch → saves one CI run
- The PR run's build `push=false` + the deploy job's main gate → zero deploy side effects (same D4 isolation principle satisfied)

## Implementation (single PR, 38 consecutive sprints of branch discipline)

Branch: `feat/sprint-170-zstd-metric-stdout` (new, based on main `c8f6cb6`)

### Phase A — helper stdout marker (commit `12b3535`)

Immediately after the Summary block in `scripts/ci/report-build-metrics.sh`:

```bash
# Sprint 170 seed #169-1: emit zstd saving to stdout (job log) as a greppable marker.
if [ -n "$ZSTD_TARBALL" ] && [ -f "$ZSTD_TARBALL" ]; then
  echo "ZSTD-METRIC service=${LABEL} docker_bytes=${SIZE_BYTES} zstd_bytes=${ZSTD_BYTES} saving_pct=-${SAVE_PCT}"
fi
```

### Phase B — unit test Case 7 (commit `12b3535`)

`tests/ci/report-build-metrics-test.sh` Case 7 — capture stdout then verify marker value / Summary non-mixing / absence when no zstd + add verification case 7 to the header comment.

### Phase C — automated measurement collection (external trigger, zero code change)

- PR #296 CI run #26140657480 (8 build jobs success) → `gh run view --log | grep ZSTD-METRIC` auto-collected the 8-service raw bytes → completed the D3 static table

### Phase D — ADR recording (commit `ffc0861`)

- `docs/adr/sprints/sprint-170.md` (KR) + `docs/adr-en/sprints/sprint-170.md` (EN 1:1 mapping)
- `docs/adr/README.md` count 109→110, range 62~169→62~170 (lines 18/52/54)

## Critic cycle

**R1** (codex review --base c8f6cb6, session `019e439a-203a-7dc0-b144-9f6eb1cf5b69`):

- **Result**: P0/P1/P2/P3 **0 findings, PASS** ✅
- **codex verdict**: "The change adds a stdout marker for existing zstd metrics and a regression test covering the new behavior. I did not find a discrete issue in the diff that would break existing functionality or CI."
- codex directly checked: grepped helper/test/ci.yml to verify the marker addition + Case 7 regression-test coverage. The stdout marker output leaves existing build/Summary behavior unchanged
- Zero self-contradiction detected — sprint goal (auto-measurement + documenting the finding) ↔ implementation aligned. Single-pass PASS (Sprint 169 normal pattern reproduced, no codex hang)

## Risk / regression guard

### Prediction 1: zero side effect from marker output

- The marker is one stdout line in a build job step → no downstream parser (pure log). Build/deploy logic unchanged
- `quality-ci-scripts` job success (run #26140657480) → 22 assertions PASS in real CI

### Prediction 2: measurement accuracy

- The helper compares actual file sizes (`stat -c %s`) → the measurement itself is accurate. ~0% is not a measurement error but the real result of buildx behavior (absence of force-compression)
- The constant 2048-byte difference = OCI/docker container-format overhead (evidence of layer-blob identity)

## Verification

### Local
- `bash tests/ci/report-build-metrics-test.sh` (with GNU stat shim) — 22/22 assertions PASS / macOS default SKIP (exit 0)
- `bash -n` syntax check PASS (helper + test)
- `node scripts/check-adr-en-coverage.mjs --strict` 119/119 (100.0%) PASS
- `node scripts/check-doc-refs.mjs` 303 files 0 broken refs PASS

### CI
- PR #296 run #26140657480: success — 8 build jobs + `quality-ci-scripts` all success
- `gh run view 26140657480 --log | grep ZSTD-METRIC` → 8-service markers auto-extracted (D3)
- mergeStateStatus CLEAN target

### New UAT (Sprint 170)
- User direct: visually confirm the 8-service markers appear in the log via `gh run view --log | grep ZSTD-METRIC` on the PR or main run

## Result

Changed files (PR #296):
- modified 1: `scripts/ci/report-build-metrics.sh` (stdout marker)
- modified 1: `tests/ci/report-build-metrics-test.sh` (Case 7)
- new 2: `docs/adr/sprints/sprint-170.md` (KR) + `docs/adr-en/sprints/sprint-170.md` (EN 1:1)
- modified 1: `docs/adr/README.md` (lines 18/52/54)

Commits (PR #296):
- `12b3535` feat(ci): zstd saving stdout greppable marker + unit test Case 7 (seed #169-1)
- `ffc0861` docs(adr): Sprint 170 ADR (KR + EN) + README update
- `<TBD-CRITIC-DOC>` docs(adr): document Sprint 170 Critic R1 cycle (KR + EN)
- Squash merge: `<TBD-MERGE-SHA>`

## New patterns

- **stdout greppable marker = bypassing the Step Summary's programmatic-extraction gap** — the GitHub Step Summary is not exposed via REST API/job log so it cannot be auto-collected. If the helper echoes the same metric to stdout as a plain marker, it becomes extractable via `gh run view --log | grep`. Zero storage + log-observability bonus. A dual-output pattern: Summary (human render) + stdout marker (machine collection)
- **leveraging group-command variable persistence = minimal change without recomputation** — `{ ... } >> file` is not a subshell, so variables set inside the block remain valid afterward. The marker needs no recomputation of zstd bytes/saving
- **registering the helper file in all service filters = turning the PR run into the measurement run** — the shared helper (`scripts/ci/report-build-metrics.sh`) is registered in every service's detect-changes filter, so a helper-change PR auto-triggers all 8 build jobs → no separate measurement dispatch needed. PR run = measurement run (saves one CI run, a natural evolution of Sprint 169 D4)
- **auto-measurement exposes the blind spot of manual inspection** — Sprint 169 D3 could only manually confirm "the Step Summary box is shown"; raw-byte auto-extraction quantitatively exposed the ~0% saving across all 8 services. Proves the value of the manual-visual → auto-quantitative transition

## Lessons

- **measurement automation validates the assumptions of prior decisions** — Sprint 168's full zstd adoption was based on a single ai-analysis cold-cache measurement (-63.7%, manually input). #169-1 auto-measurement revealed ~0% saving in steady state (warm cache) → auto-measurement corrected the representativeness limit of "one measurement + manual input". Decision data must be validated with automated + repeated measurement
- **buildx does not recompress cached layers without force-compression** — `compression=zstd` applies only to new layers; existing compressed blobs from cache/base images are reused as-is (`type=docker` and `type=oci,zstd` embed the same blob → identical size). Guaranteeing zstd saving requires `force-compression=true` (with a build-time trade-off, separate measurement needed)
- **cold vs warm cache governs the measurement result** — compression/time measurements must state the cache state to be reproducible. cold (first build) and warm (cache hit) numbers differ fundamentally. Measurement ADRs must record the cache state
- **measurement sprints split off findings** — the follow-up to the ~0% finding (adopt force-compression vs remove the zstd export) needs separate measurement + decision → split into seed #170-1. A measurement sprint does not immediately expand a finding into a fix (avoiding scope creep, "separating measurement from change")

## Carryover (Sprint 171+)

### New Sprint 170 carryover seed
- **Seed #170-1 (top priority)**: follow-up decision after the zstd ~0% finding — option (a) add `force-compression=true` (guarantees zstd saving but needs a cold-cache A/B build-time measurement) vs (b) remove the zstd OCI export (eliminates the unconsumed + warm-cache zero-saving redundant step; Trivy uses only the docker tarball). Recommend a cold-cache force-compression A/B measurement before deciding. This sprint's stdout marker + Case 7 are reusable as measurement infrastructure

### Sprint 169 carryover (recovered)
- ~~Seed #169-1 zstd raw % auto-extraction~~ → recovered this sprint ✅ (+ measurement finding D3)

### CI visibility (Sprint 164 seeds #new4/5/7)
- PR-stage deploy gate simulation / aether-gitops kustomization auto PR template / `_parse_group_response` raw_text fallback envelope extension

### i18n/lint (Sprint 158 seeds #30/#31)
- build-artifact Korean-residue CI step + i18n 3-layer checklist

### plan templates (Sprint 157 seeds #24/#18)
- i18n dual-side mandatory checklist automation / pre-merge blog cross-check automation

### ADR/blog reinforcement (Sprint 157 seeds #26/27/28)
- README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detection

### UAT user-direct (27 sprints accumulated)
- Seed #5: confirm Programmers re-submission grading passes
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency
- All accumulated Sprint 160~169 UAT items carried over
- Sprint 170 new 1: visually confirm 8-service markers in the log via `gh run view --log | grep ZSTD-METRIC`

### Retained carryover
- Seed #23: plan template "fix cumulative count after rebase" checklist

### Follow-up (optional)
- create/edit page.tsx category UI
- Programmers URL auto category inference
- backfill existing SQL problem data
- remove coverage-gate `skipped` tolerance (Sprint 156 Phase B option B)
- post-merge pre-deploy gate (Sprint 156 Phase B option C)
- prom-client Case B~D check automation
- `.claude-tools/` Phase 2 actual deletion (after trigger-path verification)
- `(adr)` layout split (KR + EN override)
- Sprint 162 R1 P3: deep relative-path `.md` links not covered
- Sprint 163 addition: H3-only PR table extraction + implementation H2 partial matcher + sprint-87 H3-only carryover
- **MEMORY.md bloat cleanup** (system warning 43.6KB): long inline sprint entries → concise 1-line index + detail referenced in ADR

**ADR**: [sprint-170.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-170.md) (KR) + [sprint-170.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-170.md) <!-- doc-ref-lint: ignore -->
