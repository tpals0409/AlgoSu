---
sprint: 164
title: "Carry-Over Automation Seeds Cleanup — Trivy/Dependabot/Envelope (Critic Self-Contradiction Detection)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-163", "sprint-162", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 164 — Carry-Over Automation Seeds Cleanup: Trivy/Dependabot/Envelope (Critic Self-Contradiction Detection)

## Goal

- Clean up the top 3 carry-over automation seeds (#new1/#new2/#new3) accumulated in Sprint 157~163
- Seed #new1 — Enable Trivy scan at the PR stage (attempt to land Sprint 160 lesson #6)
- Seed #new2 — Add 5 docker entries to dependabot.yml (block the Sprint 159 missing base image refresh causal chain)
- Seed #new3 — Apply envelope to `_parse_group_response` (recover Sprint 159 single-analysis envelope on the group side)
- 5 user-facing UAT guides (visual validation of Sprint 161~163 new behaviors)

## Decisions

- **Split into 4 PRs**: Phase A/B/C/D each one-PR-one-responsibility — minimize regression risk. No single-PR compression
- **Close Phase A + defer redesign to Sprint 165**: After Critic R1 P1 essential defect detection, immediately close. Avoid compressing essential redesign (build job `load: true` + multi-arch) into a single sprint. Apply priority (service stability > development speed)
- **Apply Critic R1 P2 fix immediately (Phase B)**: Add equal coverage for blog Dockerfile — resolve the self-contradiction (blog is also CI-built + Trivy-scanned but not covered by dependabot) immediately
- **Envelope simplification (Phase C)**: group has no score regex extraction pattern → always return `status="failed"` (simplified single envelope, consistency justified)
- **New PII/secret mock raw token leakage test**: Introduce `test_group_response_fallback_no_raw_exposure` — explicitly verify all string values in envelope never contain raw tokens

## Implementation (4 PRs, 32 sprints consecutive branch discipline)

| PR | Phase | Branch | Result |
|----|-------|--------|--------|
| [#280](https://github.com/tpals0409/AlgoSu/pull/280) | A — Enable PR Trivy | `chore/sprint-164-pr-trivy-enable` | ❌ **Closed** (Critic R1 P1 essential defect → Sprint 165 redesign) |
| [#281](https://github.com/tpals0409/AlgoSu/pull/281) | B — dependabot docker x6 | `chore/sprint-164-dependabot-docker` | ✅ Squash merge `b13e6c5` |
| [#282](https://github.com/tpals0409/AlgoSu/pull/282) | C — group envelope | `fix/sprint-164-ai-analysis-group-envelope` | ✅ Squash merge `12eb347` |
| [#TBD](https://github.com/tpals0409/AlgoSu/pulls) | D — Sprint 164 ADR | `docs/sprint-164-adr` | This PR (architect + scribe) |

### Phase A — PR-stage Trivy scan activation attempt (closed)

- **Change**: `.github/workflows/ci.yml:781` `if: github.ref == 'refs/heads/main' && !cancelled()` → `if: "!cancelled()"`
- **Goal**: Trivy SARIF upload on both PR + main → 1st-stage PR security regression detection (Sprint 160 lesson #6)
- **Critic R1 P1 detected** (codex review --commit 1e2e3c2):
  > Avoid scanning registry tags that PR builds never push (ci.yml:784). On `pull_request`, build jobs still use `push: ${{ github.ref == 'refs/heads/main' }}`, so they do not publish `ghcr.io/...:main-${{ github.sha }}`. With this job now running for PRs, any changed service that reaches Trivy will try to pull a tag that was never pushed and fail before producing a useful security result.
- **Essential defect**: PR build doesn't push to GHCR → Trivy tries to pull missing tag → fail. This PR **produces noisy CI red, not a security gate** = sprint goal self-contradiction
- **Decision**: Close PR + defer to Sprint 165 redesign (need 3-option comparison: build job `load: true` + Trivy local image scan, or PR-specific tag push, or buildx artifact + fs scan)
- **Lesson**: A seemingly-simple 1-line `if` change can require essential redesign when interacting with image registry policy

### Phase B — dependabot.yml docker x6 additions

- **Change**: `.github/dependabot.yml` docker entries 2 → 8
  - Existing: `/services/gateway`, `/services/ai-analysis`
  - New: `/services/identity`, `/services/submission`, `/services/problem`, `/services/github-worker`, `/frontend`, `/blog`
- **Common config**: weekly Monday Asia/Seoul, labels `["dependencies", "docker"]`, commit prefix `chore(docker)`, semver-major ignore
- **Critic R1 P2 detected** (codex review --commit cdec0a2, session `019e3f46-4dad-73c0-911f-09066d212f60`):
  > Include the blog Dockerfile in Docker updates. CI builds and Trivy-scans a `blog` image from `/blog/Dockerfile`, but this new Docker coverage still omits `/blog`. If the blog image's `nginx` base tag goes stale or vulnerable, the same Trivy failures this change is meant to prevent can still recur for blog.
- **Immediate fix** (commit `0f81fb1`): Add `/blog` docker entry — resolve self-contradicting omission against this PR's causal-chain blocking goal
- **Critic R2 PASS** ✅ — "No breaking or actionable issues were identified in the change"
- **Merge**: squash sha `b13e6c5`

### Phase C — `_parse_group_response` envelope application

- **Change**: `services/ai-analysis/src/claude_client.py:476-490` (envelope pattern)
  - Before: `fallback = raw_text.strip()` + backtick strip + `comparison: fallback[:50000]` (50KB raw exposure)
  - After: `comparison: "AI 그룹 분석 결과 파싱에 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요."` (zero raw body exposure)
  - logger.warning extra: only `raw_length` recorded (no raw body)
  - group has no score regex extraction pattern → always `status="failed"` (simplified single envelope)
- **Tests** (`services/ai-analysis/tests/test_claude_client.py`):
  - 4 existing tests converted to envelope verification: `test_parse_group_response_invalid_json` + `test_parse_group_response_empty_string` + `test_group_response_fallback_backtick_no_closing` + `test_group_response_fallback_backtick_with_closing`
  - 1 new: `test_group_response_fallback_no_raw_exposure` — verify with PII/secret mock raw (`hunter2` / `123-45-6789` / `sk-abc123def456` / `user_id=42`) that no raw tokens leak into envelope string values
- **Critic R1 PASS** ✅ (codex review --commit, session `019e3f4a-92d5-7503-8dd3-e92f5ae18c78`): "I did not find a discrete regression introduced by this commit"
- **Verification**: pytest 79 PASS, claude_client.py coverage 99% maintained

### Phase D — Sprint 164 ADR (this PR)

- `docs/adr/sprints/sprint-164.md` (KR) + `docs/adr-en/sprints/sprint-164.md` (EN, this file, 1:1 mapping)
- `docs/adr/README.md` update — count 103 → 104, range 62~163 → 62~164

## Verification

| Item | Result |
|------|--------|
| Phase B YAML syntax | ✅ docker entries 8 (2→8) |
| Phase B CI | 29 checks SUCCESS + SKIPPED |
| Phase B Critic R1 P2 → R2 | PASS ✅ |
| Phase C pytest | 79 PASS (5 group included) |
| Phase C claude_client.py coverage | 99% maintained |
| Phase C Critic R1 | PASS ✅ |
| check-adr-en-coverage --strict | 113/113 (100.0%) PASS (post Phase D) |
| check-doc-refs | 0 broken refs (post Phase D) |
| Branch discipline | ✅ 32 sprints consecutive, 0 direct main commits, 0 `--no-verify` |

## Branch Discipline ✅ 32 Sprints Consecutive

- All 4 PRs use new branches + Squash merge (Phase A closed + branch deleted)
- 0 direct main commits, 0 `--no-verify`

## New Patterns

1. **Critic R1 self-contradiction detection 2× per single sprint** (Sprint 155/159/160 pattern reinforced) — Phase A essential defect (image tag missing) + Phase B blog equal coverage omission. Codex cross-validation's sprint consistency-guard effect confirmed 2× in this sprint
2. **PR close + Sprint 165 redesign deferral pattern** — Even seemingly-simple 1-line change requires immediate close + separate sprint split when essential redesign is required. Avoid single-sprint compression (continues Sprint 161~163 3-sprint split policy)
3. **Cross-service envelope pattern recovery** — Apply Sprint 159 single-analysis envelope to group side. Score regex extraction difference → simplification (group: always `status="failed"`). Difference justification required when same pattern applied to different functions
4. **PII/secret mock raw token leakage explicit verification** — Strengthen envelope pattern's core promise (zero raw body exposure) via unit test. Regression-blocking gate (supplements Sprint 159 envelope's partial verification limitation)
5. **stash + branch switching multi-PR parallel handling** — When Phase B Critic R1 P2 fix occurred, stash Phase C work → switch to Phase B → push fix → stash pop Phase C. Safe handling in multi-PR within single session
6. **codex CLI direct call backgrounding** — Run `codex review --commit <sha>` in background and proceed with next Phase in parallel. Hide Critic cycle processing time

## Lessons

1. **A simple 1-line `if` change can also require essential redesign when interacting with image registry policy** — Phase A's removal of `if: github.ref == 'refs/heads/main'` collided with PR build's `push: false` policy. Trivy pulls missing tag → fail → sprint goal self-contradiction. Change impact scope evaluated via adjacent policy graph, not just code lines
2. **Critic R1 self-contradiction detection 2× per sprint is no longer accidental** — Sprint 155/159/160 + Sprint 164 (Phase A + Phase B) accumulated. Codex gpt-5 cross-validation's pattern of compensating for single-model family blind spots (limits of self-consistency verification) reinforced and reconfirmed this sprint
3. **blog Dockerfile omission is the result of separation policy between CI build/Trivy scan targets and dependabot** — Auto-registering only services directories misses blog. Dockerfile-bearing directory = dependabot registration mandatory established as SSOT (services + blog + frontend all equal)
4. **Envelope simplification requires inter-function consistency justification** — Difference between `_parse_response` (single, score extractable) and `_parse_group_response` (group, no score) justified via envelope simplification. Explicitly stated in PR body + code comments
5. **PII/secret mock raw token verification test is the regression-blocking gate for envelope promise** — Simple envelope message verification alone is insufficient for future regression blocking. Explicit PII/secret token non-exposure verification enforces envelope promise
6. **Forward-fix policy single-sprint application case extended** — Sprint 159 base image patch → Sprint 160 frontend tag advance → Sprint 164 blog Dockerfile addition. Immediate fix on regression detection established
7. **Split-handling 4 PR vs single-sprint integrated commit comparison** — 4-PR splitting has regression isolation effect but Phase-to-Phase dependencies (rebase conflicts, etc.) occur. This sprint's Phase C rebase naturally occurred — splitting's standard cost recognized

## Sprint 165 Carry-Over

### Automation Seeds (Sprint 164 unresolved + new)

- **Seed #new1 redesign** (Sprint 164 Phase A close recovery) — PR-stage Trivy essential redesign
  - Option A: build job `load: true` + Trivy local image scan (buildx `load` is single-platform → conflicts with ARM aarch64 policy)
  - Option B: PR-specific tag (`pr-{number}-{sha}`) push + Trivy registry scan (GHCR storage increase)
  - Option C: buildx output → artifact → Trivy fs scan (separate step cost)
  - 3-option comparison + essential decision required

- **Seed #new4** (Sprint 159 recovery, unprocessed this sprint) — CI visibility: PR-stage deploy gate simulation / aether-gitops kustomization auto PR template / `$GITHUB_STEP_SUMMARY` standardization (Sprint 160 establishment extension)

- **Seed #30/#31** (Sprint 158 recovery) — i18n/lint: build artifact Korean residue CI step + i18n 3-layer checklist

- **Seed #24/#18** (Sprint 157 recovery) — Plan template: i18n bilateral mandatory automation / pre-merge cross-check for blog posts

- **Seed #26/27/28** (Sprint 157 recovery) — ADR/blog reinforcement: README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detection

- **Sprint 163 additional automation candidates** — H3-only PR table extraction / implementation H2 partial matcher / sprint-87 H3-only carryover

### UAT User-Direct Verification (21 sprints accumulated)

- Seed #5 (Programmers re-submission grading)
- Seed #9 (English env + production Grafana CB dashboard ai-analysis visual integrity)
- Sprint 160 new (ArgoCD `algosu` sync / `kubectl rollout` new ReplicaSet / AI analysis fallback friendly message)
- Sprint 161/162/163 new (Hero/cards/Phase strip + Mermaid + in-place callout)
- **Sprint 164 new**:
  - Phase C envelope behavior visual confirmation: AI group analysis fallback message displays friendly text without raw exposure
  - Phase B dependabot docker 6 entries activation (GitHub Dependency graph → Dependabot tab)

### Carry-Over Maintained

- Seed #23: plan template "post-rebase cumulative count fix" checklist

### Follow-up (Optional)

- create/edit page.tsx category UI
- Programmers URL auto category inference
- Existing SQL problem data backfill
- coverage-gate `skipped` allowance removal (Sprint 156 Phase B option B)
- post-merge pre-deploy gate (Sprint 156 Phase B option C)
- prom-client Case B~D check automation
- `.claude-tools/` Phase 2 actual deletion (post trigger-path verification)
- `(adr)` layout split (KR + EN override)
- Sprint 162 R1 P3: deep relative `.md` link uncovered
- Sprint 163 R-cycle: H3-only PR table extraction + implementation H2 partial matcher + sprint-87 H3-only carryover
