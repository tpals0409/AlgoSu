---
sprint: 167
title: "zstd Compression Measurement + cache hit/miss Visibility Integration — Sprint 165 Option C Optimization Phase (Seed #165-2 + D1 Recovery)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-166", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 167 — zstd Compression Measurement + cache hit/miss Visibility Integration (Seed #165-2 + Sprint 166 D1 Recovery)

## Goal

- After Sprint 166 baseline (tarball size) established, **optimization phase step 1**: seed #165-2 zstd compression measurement + Sprint 166 D1 deferred cache visibility recovery in same sprint
- A/B dual build only on ai-analysis service → docker tar vs OCI zstd tar generated simultaneously → compression saving % auto-calculated
- Common to 3 build jobs (services/frontend/blog): add build duration + `buildx du` cache size + cache entries
- "Security gate (Sprint 165) → Visibility (Sprint 166) → Optimization (Sprint 167)" 3-sprint cycle step 3

## Decisions

### D0. A/B Dual Build (ai-analysis only) + buildx du + duration — User Selection (Recommended)

- **A adopted** among zstd measurement options A~C (user decision):
  - A (A/B dual build, ai-analysis only) / B (gradual transition + post-comparison) / C (measurement-only PR, all 8 services)
- Rationale: balance single-sprint comparison data acquisition + PR-level regression risk minimization
- **A adopted** for cache visibility signal options A~C: buildx du + build duration (indirect indicator combination)
- If data is clear this sprint, consider full adoption on 8 services in Sprint 168

### D1. ai-analysis Selection — Maximum Compression Measurement Value

- Python FastAPI service — base image (python:3.12-slim) + pip wheels multi-layer + source layer accumulation
- Heavier library dependencies than Node.js TypeScript services (gateway/identity/submission/problem/github-worker)
- Best candidate for measuring zstd effect — provides decision basis for other services

### D2. buildx multi-output Conditional Expression — Empty Line = Ignore Pattern

- `outputs:` multi-line uses `${{ matrix.service == 'ai-analysis' && format(...) || '' }}` conditional branching
- Other matrix services evaluate to empty line → buildx parser ignores empty lines (zero regression)
- buildx multi-output generates docker tar + oci zstd tar simultaneously in single build — zero build time impact (compression only)
- `docker/build-push-action@v7` + buildx v0.13+ officially support `type=oci,compression=zstd`
- Trivy v0.69.2 supports OCI tar + zstd, but this sprint scans only docker tar (zstd is measurement-only)

### D3. cache Visibility = `buildx du` Disk Usage + `tail -n +2 | wc -l` entries

- `docker buildx du --verbose` Total line awk-parsed → cache disk usage displayed
- `docker buildx du | tail -n +2 | wc -l` → cache entries count
- `2>/dev/null` + `[ -z "$VAR" ] && VAR=N/A` graceful fallback — cache visibility is nice-to-have, hard fail prohibited
- Direct hit rate not exposed (buildx structural limitation) → indirect indicator: disk usage + entries + duration 3-signal combination

### D4. BUILD_START env Propagation = `>> "$GITHUB_ENV"`

- "Record build start time" step uses `BUILD_START=$(date +%s) >> $GITHUB_ENV` → environment variable auto-exposed to next step
- Standard GitHub Actions env propagation pattern (cross-step communication)
- Avoids shell variable scope limitation (same step internal only)

### D5. "Report tarball size" → "Report build artifact metrics" Naming Evolution

- Single signal (size) → 4 signals (size/duration/cache size/cache entries) expansion → name reflects essence
- Sprint 166 step name `Report tarball size` → Sprint 167 `Report build artifact metrics`
- ai-analysis additionally exposes zstd branch (5th signal)

### D6. frontend/blog skip Guard Inconsistency Intentionally Maintained (Deferred to Sprint 168+)

- Only build-services has `if: steps.check.outputs.skip == 'false'` guard, frontend/blog do not
- Sprint 166 pattern maintained — because paths filter differs (build-services supports per-matrix skip, frontend/blog has no job-level skip guard)
- Avoid scope expansion this sprint — consistent policy decided in separate sprint

## Implementation (1 PR, 35 sprints consecutive branch discipline)

Branch: `feat/sprint-167-zstd-cache-visibility` (new from main `76b1520`)

### Phase A — A/B Dual Build (ai-analysis only)

`.github/workflows/ci.yml` build-services job changes:

```yaml
- name: Record build start time
  if: steps.check.outputs.skip == 'false'
  run: echo "BUILD_START=$(date +%s)" >> "$GITHUB_ENV"
- uses: docker/build-push-action@v7
  if: steps.check.outputs.skip == 'false'
  with:
    outputs: |
      type=image,push=${{ github.ref == 'refs/heads/main' }},name=...
      type=docker,dest=/tmp/image-${{ matrix.service }}.tar
      ${{ matrix.service == 'ai-analysis' && format('type=oci,compression=zstd,dest=/tmp/image-{0}-zstd.tar', matrix.service) || '' }}
```

ai-analysis branch in "Report build artifact metrics" step:

```bash
if [ "${{ matrix.service }}" = "ai-analysis" ]; then
  ZSTD_TARBALL=/tmp/image-${{ matrix.service }}-zstd.tar
  if [ -f "$ZSTD_TARBALL" ]; then
    ZSTD_BYTES=$(stat -c %s "$ZSTD_TARBALL")
    ZSTD_MB=$(awk -v b="$ZSTD_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')
    SAVE_PCT=$(awk -v d="$SIZE_BYTES" -v z="$ZSTD_BYTES" 'BEGIN {printf "%.1f", (1 - z/d) * 100}')
    echo "- tarball size (oci+zstd): **${ZSTD_MB} MB** (${ZSTD_BYTES} bytes)"
    echo "- compression saving: **-${SAVE_PCT}%** (zstd vs docker)"
  fi
fi
```

### Phase B — cache Visibility (3 build jobs common)

3 build jobs each add "Record build start time" before build-push-action step + integrate 4 signals in "Report build artifact metrics":

```bash
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
DURATION_FMT=$(awk -v s="$BUILD_DURATION" 'BEGIN {printf "%dm %ds", int(s/60), s%60}')

CACHE_DU=$(docker buildx du --verbose 2>/dev/null | awk '/^Total:/ {print $2, $3; exit}')
[ -z "$CACHE_DU" ] && CACHE_DU="N/A"
CACHE_ENTRIES=$(docker buildx du 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
[ -z "$CACHE_ENTRIES" ] && CACHE_ENTRIES="0"

{
  echo "### 📦 ${{ matrix.service }} build artifact"
  echo "- tarball size (docker): **${SIZE_MB} MB** (${SIZE_BYTES} bytes)"
  echo "- build duration: **${DURATION_FMT}** (${BUILD_DURATION}s)"
  echo "- cache size: **${CACHE_DU}**"
  echo "- cache entries: **${CACHE_ENTRIES}**"
  ...
} >> "$GITHUB_STEP_SUMMARY"
```

All 3 build jobs use identical pattern (matrix vs hardcoded only difference) — Sprint 166 DRY policy inherited.

### Phase C — Critic R1 P3 forward-fix (`<TBD>`)

`.github/workflows/ci.yml` 3 build job CACHE_ENTRIES count logic modified:

- **R1 P3 finding**: `docker buildx du` output includes footer rows (`Shared:`, `Private:`, `Reclaimable:`, `Total:`), and `tail -n +2 | wc -l` counts footer as entries → inflated metric → weakens cache visibility signal accuracy
- **fix applied**: `awk 'NR > 1 && !/^(ID|Reclaimable|Shared|Private|Total):/ && NF > 0 {count++} END {print count+0}'` pattern explicitly excludes header + footer + empty lines
- Inherits Sprint 164 R1 P3 self-fix policy (same PR same-day forward-fix)

### Phase D — ADR Recording (this commit)

- `docs/adr/sprints/sprint-167.md` (KR) + `docs/adr-en/sprints/sprint-167.md` (EN 1:1 mapping)
- `docs/adr/README.md` count 106→107, range 62~166→62~167 (lines 18/52/54)

## Critic Cycle

**R1** (codex review --base 76b1520, background PID 53829, completed successfully):

- **Counts: P0: 0, P1: 0, P2: 0, P3: 1**
- **Judgement**: "No blocking CI regression found; only low-severity cache metrics accuracy issue."
- **P3 finding**: cache entries count inflated by `docker buildx du` footer rows (Shared/Private/Reclaimable/Total) → same-PR same-day forward-fix (Phase C)
- **Checked Areas 7 items all OK**:
  - Shell injection / quoting: no new exploitable issue. Matrix values + locally computed variables + paths properly quoted
  - Sprint goal consistency: consistent. Only ai-analysis gets zstd A/B artifact, all Docker build jobs get duration/cache visibility
  - buildx multi-output empty expression: safe. `docker/build-push-action` parses outputs via `Util.getInputList(...)` — empty list items not passed as `--output`
  - Non-ai-analysis services: no regression from empty zstd branch
  - Frontend/blog jobs: no zstd branch — only metrics added, no regression
  - `docker buildx du Total:` parsing: matches current Docker documented output format (text parsing inherently brittle)
  - `BUILD_START` propagation: `$GITHUB_ENV` exposes to subsequent steps in same job — metrics step runs after record step
- **Sources used**: Docker buildx du official docs + docker/build-push-action source (Util.getInputList)

## Risk / Regression Prevention

### Prediction 1: buildx multi-output Conditional Expression Empty Line Handling

- `${{ ... && format(...) || '' }}` evaluates to empty string on false branch → empty line in multi-line `|`
- buildx outputs parser processes line by line + ignores empty lines → zero regression for other matrix services (gateway/identity etc.)
- Trivy `--input` uses only docker tar (zstd tar measurement-only) → zero scan regression

### Prediction 2: `docker buildx du` Output Format Assumption

- Assumes "Total: <size> <unit>" line awk parsing. On format change → empty result → `[ -z ]` fallback → "N/A" displayed
- Zero work failure — `2>/dev/null || ...` pattern blocks hard fail

### Prediction 3: BUILD_START env cross-step Exposure

- GitHub Actions `>> "$GITHUB_ENV"` standard pattern — auto-exposed to subsequent steps within same job
- If `$BUILD_START` undefined, `BUILD_END - BUILD_START` becomes large value → no fallback mechanism needed (always propagated in normal flow)

### Prediction 4: zstd tarball Not Produced Case

- For non-ai-analysis services, buildx ignores empty zstd outputs line → `/tmp/image-{service}-zstd.tar` not generated
- "Report build artifact metrics" `[ -f "$ZSTD_TARBALL" ]` guard → displays "N/A (file not produced)" if absent — zero runtime error

## Verification

- **Local**: `python3 yaml.safe_load` PASS, `bash scripts/check-adr-en-coverage.sh --strict` 116/116 PASS, `bash scripts/check-doc-refs.sh` 0 broken refs
- **CI (PR phase)**:
  - 37 SUCCESS + 0 FAILURE, mergeStateStatus CLEAN
  - ai-analysis build job Summary: `### 📦 ai-analysis build artifact` H3 + docker MB + duration + cache size + cache entries + oci+zstd MB + compression saving % displayed
  - Other services (gateway/identity/submission/problem/github-worker): only docker MB + duration + cache size + entries (no zstd branch)
  - frontend/blog: identical pattern (no zstd branch)
  - Trivy scan 8 matrix no regression (`--input` docker tar matching unchanged)
- **UAT new 1 item**: visual confirmation of compression saving % in ai-analysis Summary (user direct)

## Result

4 files changed:
- Modified 1: `.github/workflows/ci.yml` (+80 -13, 3 build job multi-output conditional + step add + Report step expansion)
- New 2: `docs/adr/sprints/sprint-167.md` (KR) + `docs/adr-en/sprints/sprint-167.md` (EN 1:1 mapping)
- Modified 1: `docs/adr/README.md` (lines 18/52/54 — count 106→107, range 62~166→62~167)

Commits:
- `07828d8` feat(ci): Sprint 167 — zstd 압축 실측 + cache 가시성 통합
- `<TBD>` docs(adr): Sprint 167 ADR (KR + EN)
- Squash merge: `<TBD-MERGE-SHA>` (PR #292)

## New Patterns

- **buildx multi-output Conditional Branching Pattern** — `${{ matrix.X == 'Y' && format(...) || '' }}` conditional expression combined with buildx multi-line outputs empty-line-ignore = only some matrix services generate additional output. Zero regression + minimal diff. Future standard pattern for measurement/experiment steps
- **A/B Measurement + Build 1x Simultaneous Generation** — buildx multi-output simultaneous support results in zero build time impact. Measurement cost = compression computation + disk I/O only. Avoids separate measurement build job pattern
- **4-Signal Integrated Output + graceful fallback Policy** — single step integrates size + duration + cache size + cache entries 4 signals → future signal addition expands same step (Sprint 168 follow-up). `|| N/A` fallback blocks hard fail of nice-to-have signals
- **Seed Compression Recovery = Next-Sprint Data Verification Pattern** — Sprint 165 Option C established → Sprint 166 baseline → Sprint 167 measurement. 3-sprint cycle complete. Without baseline data, comparison meaningless → sequential recovery policy established
- **Critic R1 P3 Self-fix Same-PR Policy Established (Sprint 164 → 167 Accumulated)** — Codex gpt-5 R1 detected P3 accuracy issue → same-PR same-day forward-fix → ADR documents fix circumstances. Sprint 164 ADR Critic R1 P3 fix pattern reproduces in Sprint 167 = avoid split sprint + prioritize single-sprint completeness policy established

## Lessons

- **User Decision Sides = Single-Sprint Integrated Policy Establishment** — Sprint 165 option comparison → this sprint zstd method/cache signal simultaneous decisions. When user perspective converges on two decisions in 1 round, single-sprint processing possible. Integration cost lower than split-sprint regression isolation benefit
- **buildx multi-output Empty-Line-Ignore Characteristic = Conditional Branching Safety Guarantee** — `${{ ... || '' }}` pattern creates empty line on false branch → buildx parser auto-ignores. Zero regression for other matrix values. Reconfirms yaml multi-line pattern safety guarantee
- **cache hit rate Direct Exposure Absent = Indirect Signal Combination Strategy** — docker/build-push-action does not expose cache hit rate in metadata. Combines disk usage + entries + duration 3 signals for indirect measurement. Avoids single-signal perfect measurement attempt + establishes multi-signal integration strategy
- **graceful fallback = nice-to-have Signal Standard Policy** — `|| N/A` blocks hard fail of undefined data. Visibility step is not core security/deploy path → avoids workflow total failure on measurement failure
- **Naming Evolution = Essence Reflection Obligation** — `Report tarball size` (Sprint 166, single signal) → `Report build artifact metrics` (Sprint 167, 4 signals) name change. Naming sync on essence expansion blocks future regression/misunderstanding

## Deferred Items (Sprint 168+)

- **Sprint 167 new deferred seeds**:
  - Seed #167-1: full adoption on 8 services if zstd measurement clear (when ai-analysis data shows 30%+ compression rate + time regression within 5%)
  - Seed #167-2: frontend/blog skip guard inconsistency consistent policy (unify with build-services pattern)
  - Seed #167-3: `$GITHUB_STEP_SUMMARY` standardization helper (seed #new-6 recovery)
- **Sprint 166 deferred continuing**:
  - Sprint 164 seeds #new-4/5/7 CI visibility (deploy gate simulation / aether-gitops kustomization auto PR / `_parse_group_response` envelope expansion)
  - Seeds #30/#31 (Sprint 158 i18n/lint): build artifact Korean residue CI step + i18n 3-layer checklist
  - Seeds #24/#18 (Sprint 157): plan template i18n bidirectional auto + blog post merge cross-check automation
  - Seeds #26/27/28 (Sprint 157 ADR/blog reinforcement): README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detection
  - UAT 23-sprint accumulated user direct verification (#5/#9 + Sprint 160~166 accumulated + Sprint 167 new 1 item: visual confirmation of oci+zstd MB + compression saving % in ai-analysis Summary)
  - Maintained — seed #23 (rebase cumulative count fix checklist)
  - Optional follow-up 10 items (Sprint 166 deferred as-is)
- **ADR**: [sprint-167.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-167.md) (KR) + [sprint-167.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-167.md) <!-- doc-ref-lint: ignore -->
