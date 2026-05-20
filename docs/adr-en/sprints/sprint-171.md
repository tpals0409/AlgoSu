---
sprint: 171
title: "Remove zstd OCI export — concluding the Sprint 165~170 zstd cycle (seed #170-1)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-170", "sprint-168", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 171 — Remove zstd OCI export: concluding the Sprint 165~170 zstd cycle (seed #170-1)

## Goal

- Recover Sprint 170 carryover seed #170-1: follow-up decision on the measurement finding that zstd savings are ~0% on warm cache.
- Compare two candidates — (a) introduce `force-compression=true` (guarantees zstd savings, build-time trade-off) vs (b) remove the zstd OCI export (clean up the unconsumed + zero-saving redundant step).
- Final step of "security gate (165) → visibility (166) → measurement (167) → full adoption (168) → observation (169) → measurement automation (170) → cycle conclusion (171)".

## Decisions

### D0. Adopted approach — option (b) remove zstd OCI export

Adopt option (b) without a force-compression A/B measurement, because this sprint's codebase grep verification + Sprint 170's empirical data already make the decision conclusive:

1. **Zero consumer (verified this sprint)**: The `type=oci,compression=zstd,dest=...-zstd.tar` artifact is produced by 3 build jobs and read only by the `report-build-metrics.sh` measurement helper. `upload-artifact` uploads only the docker tarball (`image-<svc>.tar`), Trivy scans only `--input <docker tarball>`, and registry push uses only `type=image` → the zstd tarball is **consumed nowhere**.
2. **~0% saving on warm cache (Sprint 170 measurement)**: All 8 services show docker tarball ≈ oci+zstd tarball (exactly a 2048-byte container-format overhead difference). Without `force-compression=true`, buildx does not recompress cached/base layers, so both exporters embed identical blobs → saving -0.0%.
3. **(a) force-compression is irrational**: Spending extra build time to compress an artifact with no consumer yields zero value regardless of compression ratio — only a build-time regression.

→ The A/B measurement is unnecessary as a decision input. Remove the zstd OCI export to conclude the Sprint 165~170 zstd cycle as a redundant-step cleanup.

### D1. Rationale for skipping the force-compression A/B measurement

Seed #170-1's original plan was a cold-cache force-compression A/B, but the "zero consumer" discovery fixes the decision independently of any measurement result. An artifact with no consumer has zero value even at maximal compression, so force-compression's build-time cost is pure loss. We converge on (b) logically, with no measurement CI cost.

### D2. Helper 2-arg simplification (dead-code removal)

After removing the zstd export, the zstd branch in `report-build-metrics.sh` and the Sprint 170 ZSTD-METRIC stdout marker become uncalled dead code. Per project convention ("delete if certainly unused, avoid backwards-compat hacks"), remove the 3rd argument + zstd branch + marker block entirely → simplify to a `<label> <docker_tarball>` 2-arg helper. If zstd measurement is ever needed again, it is restorable from git history.

### D3. Remaining outputs = return to the Sprint 165 Option C baseline

After removal, the 3 build jobs' `outputs:` reduce to `type=image` (main push) + `type=docker` (Trivy tarball) — the baseline at the time Sprint 165 Option C was introduced. The Trivy scan job's `--input /tmp/image-<svc>.tar` path is unchanged → zero security-gate regression.

### D4. Unit test case re-ordering

After removing Case 2 (zstd saving %)/Case 7 (ZSTD-METRIC marker), Case 3 (no-zstd branch) is promoted to the canonical docker tarball path (neg assertions: confirm absence of oci+zstd / compression saving lines). Remaining cases 4/5/6 → 3/4/5. 7 cases → 5 cases, 22 → 16 assertions.

## Implementation (single PR, 39 consecutive sprints of branch discipline)

Branch: `feat/sprint-171-zstd-export-removal` → single PR squash merge.

### Phase A — code removal (Architect, commit `28dd957`)

- **`.github/workflows/ci.yml`**: Remove the `type=oci,compression=zstd,dest=/tmp/image-*-zstd.tar` line from 3 build jobs (build-services/build-frontend/build-blog) + remove the 3rd argument (zstd tarball) from the 3 `report-build-metrics.sh` calls + update Sprint 168 zstd comments to reflect the Sprint 171 decision. python3 yaml.safe_load PASS.
- **`scripts/ci/report-build-metrics.sh`**: Remove the zstd branch block + ZSTD-METRIC stdout marker block + `ZSTD_TARBALL` argument + usage/header comments → 2-arg helper. `bash -n` syntax PASS.
- **`tests/ci/report-build-metrics-test.sh`**: Remove Case 2/7, promote Case 3 (add neg assertions), renumber 4/5/6→3/4/5, update header case list.

### Phase B — ADR recording (Scribe, commit `<TBD-SCRIBE-SHA>`)

- `docs/adr/sprints/sprint-171.md` (KR) + `docs/adr-en/sprints/sprint-171.md` (EN 1:1)
- `docs/adr/README.md` count 110→111, range 62~170→62~171 (lines 18/52/54)

## Critic cycle

- **R1** (codex review --base bd60329): Trivy docker tarball path unchanged / zero zstd remnants / deploy gate unchanged — `<TBD-CRITIC-R1>`

## Risk / regression guard

### Prediction 1: Trivy security gate unchanged
Trivy does not use the zstd tarball (`--input docker tarball`), so removal does not affect scanning. The 8-matrix Trivy scan in the PR Checks tab stays SUCCESS as before.

### Prediction 2: deploy unchanged
The deploy job depends on `type=image` push (main only). Removing the zstd OCI export is unrelated to the push path → zero deploy regression.

### Prediction 3: helper regression guard
The `quality-ci-scripts` job runs unit tests on `scripts/ci/**`/`tests/ci/**` changes → the 2-arg helper's 5 cases / 16 assertions guard against regressions.

## Verification

### Local
- `bash -n scripts/ci/report-build-metrics.sh`: syntax PASS
- Unit tests (GNU stat shim): 16 assertions PASS (5 cases)
- python3 yaml.safe_load(ci.yml): PASS
- zstd remnant grep: 0 in code (comments only, intentional)

### CI
- PR CI run `<TBD-RUN>`: 8 build jobs + quality-ci-scripts + 8-matrix Trivy scan all expected success
- check-adr-en-coverage --strict: `<TBD>` PASS
- check-doc-refs: `<TBD>` PASS

### New UAT (Sprint 171)
- Visually confirm the 8-matrix Trivy scan in the PR Checks tab stays SUCCESS after the zstd export removal

## Result

- **Merge**: origin/main `bd60329` → `<TBD-MERGE-SHA>` (PR `<TBD-PR>`, squash merge)
- **Net change**: -84 +32 (zstd export + dead-code removal dominant)
- Conclusion of the Sprint 165~170 zstd cycle: security tarball (165) → visibility (166) → measurement (167) → zstd adoption (168) → observation (169) → measurement automation (170) → **redundant-step removal (171)**.

## New patterns

- **Discovering an unconsumed artifact = removal beats compression optimization**: After measurement automation (170) exposed ~0% savings, a follow-up grep confirmed "zero consumer" → the answer is removing the artifact, not improving its compression ratio (force-compression). The pattern: first verify whether the optimization target is actually consumed.
- **A measurement finding simplifies the decision = A/B can be skipped**: The prior sprint's measurement data + this sprint's static verification (grep) make an A/B measurement unnecessary. "If you have the data, skip the extra measurement" — a measurement sprint's output reduces the next sprint's cost.
- **A cycle-conclusion ADR = the full stop for a multi-stage seed**: The 165~171 7-sprint zstd cycle is concluded in a single ADR. The decision graph of each stage is traceable in one place.

## Lessons

- **"Adoption" does not guarantee "consumption"**: Sprint 168's full zstd adoption produced the artifact but never wired up a consumer. A checklist that names the consumer at the moment a new artifact is introduced prevents redundant-step debt.
- **Without force-compression, buildx leaves cached layers uncompressed (re-confirmed)**: The practical conclusion of the Sprint 170 finding — at warm-cache steady state, the zstd export is meaningless. Guaranteeing compression requires force-compression (build-time cost), but even that is a loss without a consumer.
- **Separating measure → decide → clean up isolates regressions**: Rather than fixing immediately during measurement (170), we split it into a seed → and decided cleanly with sufficient data this sprint. Re-confirms the pattern where a measurement sprint completes the input for a subsequent decision sprint.

## Carryover (Sprint 172+)

### New Sprint 171 carryover seed
- None — the zstd cycle is concluded. Turning "name the consumer simultaneously when introducing a new artifact" into a checklist is to be considered together with plan-template improvements (the #24 seed family).

### Inherited carryover seeds
- CI visibility (Sprint 164 #new4/5/7): PR deploy gate simulation / aether-gitops PR template / `_parse_group_response` raw_text fallback
- i18n/lint (Sprint 158 #30/#31), plan template (Sprint 157 #24/#18/#23), ADR/blog reinforcement (Sprint 157 #26/27/28)
- Direct user UAT: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160~170 accumulated
- MEMORY.md bloat cleanup (~44KB → one-line index)
