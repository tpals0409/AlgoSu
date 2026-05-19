---
sprint: 159
title: "AI Analysis Data Parsing Hotfix + Base Image CVE Deploy Unblock"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-158"]
related_memory: ["sprint-window"]
---
# Sprint 159 — AI Analysis Data Parsing Hotfix + Base Image CVE Deploy Unblock

## Goal

- Hotfix a bug where the AlgoSu study user dh4m's recent submission's AI analysis result page exposed raw JSON/markdown text as-is
- Immediately after merging the main hotfix PR, post-merge `Trivy Scan — ai-analysis` failed, causing `Update GitOps manifests` + `Deploy Notification` to skip → production deploy blocked → unblock via forward-fix
- Formal retrospective record for an urgent hotfix sprint that proceeded without `/start` invocation

## Decisions

- **Triple-defense pattern adopted**: Instead of a single-point fix, applied (A) backend envelope + (B) frontend string-aware brace counter + (C) frontend friendly fallback as three layers. If one layer is bypassed, the next layer defends. Direct continuation of Sprint 155's three-layer safety net pattern
- **Auto-Critic P2 option-branch judgment**: Critic R1 P2 finding (1 case: `raw_excerpt` logger exposure) → Oracle chose between option A (allow) / option B (reject) → **Option B adopted**. The sprint goal = block raw exposure, so logger exposure persistence is self-contradictory. Decision driven by sprint goal (Sprint 155 pattern carry-over)
- **"Main merge failed" forward-fix adopted**: PR #272 merge itself succeeded, but post-merge Trivy fail blocked the deploy pipeline. Instead of revert, added a base image patch PR for unblock. Forward-fix is correct since the code itself is normal
- **Base image patch approach**: Applied `apt-get update && upgrade -y` to both stages instead of switching to alpine. Alpine carries build-time dependency change risk and belongs to a separate sprint scope. `.trivyignore` rejected as self-contradictory (bypassing security scan in a security exposure fix sprint)
- **Self-contradiction detection possible after Critic 1st pass**: P1 envelope introduction was OK, but `raw_excerpt` persistence in logger contradicted the sprint goal. Codex cross-validation's hotfix sprint consistency guard effectiveness reaffirmed

## Implementation (2 PRs squash merge, origin/main `a73c596` → **`2ec3747`**)

| PR | Phase | Owner | Changes | Lines |
|----|-------|-------|---------|-------|
| [#272](https://github.com/tpals0409/AlgoSu/pull/272) | A/B/C + Critic P2 + format | architect ×4 + critic | dh4m AI analysis parsing triple defense + Critic P2 hardening + ruff format | +226 −24 |
| [#273](https://github.com/tpals0409/AlgoSu/pull/273) | base image CVE | architect | `python:3.13-slim` OS 3 HIGH CVE patches for deploy unblock | +10 |

### PR #272 Details — AI Analysis Parsing Hotfix (5 commits squash)

**Symptom**: dh4m's submission AI analysis result page exposed raw JSON/markdown text instead of structured categories/summary

**Root cause chain**:
1. Claude API returned malformed JSON response (e.g., pattern like `'broken{json "totalScore": 90 more broken'`)
2. Backend `services/ai-analysis/src/claude_client.py:_parse_response` (line 216~344) all 4 fallback stages failed (markdown strip / numeric quote sanitize / optimizedCode nullification / first JSON object extraction)
3. catch-all block (line 311~344) stored `raw_text` directly in `feedback` field + returned `status=completed` (when totalScore regex extraction succeeded)
4. Frontend `frontend/src/lib/feedback.ts:parseFeedback` (line 109~146) catch block fallback exposed raw text via `summary: feedback`
5. Additional defect: Frontend `cleanAndExtractJson` brace counter (line 95~99) did not recognize string-internal braces — robustness mismatch vs backend `_extract_first_json_object` (line 497~534, with in_string + escape tracking)

**Triple-defense applied**:

**(A) Backend envelope** (`services/ai-analysis/src/claude_client.py:311~362`):
- catch-all fallback always stores valid JSON envelope instead of raw text
- Envelope structure: `{"totalScore": <regex>, "summary": <friendly message>, "categories": [], "optimizedCode": null}`
- Summary varies by score: score>0 "AI analysis result parsing encountered a temporary error... only score available" / score=0 "Cannot display AI analysis result. Please try again later"
- Critic P2 follow-up: `raw_excerpt` removed from logger extra, only metadata `error/score_extracted/raw_length` exposed

**(B) Frontend string-aware brace counter** (`frontend/src/lib/feedback.ts:78~118`):
- New `findJsonObjectEnd` function — 1:1 mapping with backend `_extract_first_json_object`'s in_string + escape tracking
- Correctly handles braces inside strings (e.g., `"optimizedCode": "def f(): return {1,2}"`)

**(C) Frontend friendly fallback** (`frontend/src/lib/feedback.ts:144~158`):
- `parseFeedback` catch block no longer exposes raw `feedback` text via `summary`
- Replaced with user-friendly message "Cannot display AI analysis result. Please try again later."

### PR #272 Details — Critic P2 Hotfix Cycle

**Critic R1** (Codex gpt-5, `--base main`):
- 1 P2 finding: `services/ai-analysis/src/claude_client.py:317~320`'s `raw_excerpt = raw_text.strip()[:200]` followed by `logger.warning(..., extra={"raw_excerpt": raw_excerpt})` exposes raw Claude response (potentially containing user code/markdown/secrets) to logs/log aggregation
- Self-contradictory with this hotfix's goal (block raw text exposure)

**Oracle judgment**: Option B accepted (block maintained) — sprint goal is raw exposure blocking, so logger exposure must also be blocked

**Architect re-delegation result** (commit `33cad49`):
- `raw_excerpt` field removed, logger extra retains only metadata (`error[:100]`, `score_extracted`, `raw_length`)
- score extraction logic moved above logger to utilize `score_extracted` label
- New test `test_fallback_does_not_leak_raw_text_to_logs` (caplog-based)

**Critic R2**: clean ✅ "did not find a discrete functional, security, or maintainability regression"

### PR #272 Tests (Backend 3 updated + 2 new / Frontend 1 updated + 2 new)

**Backend** (`services/ai-analysis/tests/test_claude_client.py`):
- Updated: `test_parse_invalid_json_returns_envelope` (renamed from `_returns_raw`), `test_fallback_total_failure_regex_score`, `test_fallback_total_failure_no_score` — verifies feedback is valid JSON envelope + raw text never exposed in envelope/feedback
- New: `test_fallback_envelope_is_valid_json` — feedback always parses as valid JSON dict even with mixed raw markdown response
- New: `test_fallback_does_not_leak_raw_text_to_logs` (caplog-based) — verifies raw_text/potential secret tokens never exposed in logger anywhere + only metadata fields exist

**Frontend** (`frontend/src/lib/__tests__/feedback.test.ts`):
- Updated: parseFeedback fallback friendly message verification
- New: `cleanAndExtractJson handles braces inside string values` — string-internal braces parsed correctly
- New: `parseFeedback fallback shows friendly message not raw dump` — verifies raw text not included in summary

**Verification**:
- pytest `tests/test_claude_client.py`: 78/78 PASS (claude_client.py coverage 99%)
- jest `feedback.test.ts`: 44/44 PASS + tsc clean
- ruff check `src/`: All checks passed
- ruff format `src/`: 9 files already formatted (after commit `44eee44`)

### PR #273 Details — Base Image CVE Deploy Unblock

**Symptom**: PR #272 merge itself succeeded (origin/main `505568a`), but post-merge CI run `26071766405` `Trivy Scan — ai-analysis` failed → `Update GitOps manifests` + `Deploy Notification` skipped → production deploy blocked. The reality of "main merge failure".

**Trivy detected 3 CVEs** (all base image `python:3.13-slim` = Debian 13 Bookworm OS packages):

| CVE | Package | Installed | Fixed | Severity |
|---|---|---|---|---|
| CVE-2026-4878 | libcap2 | 1:2.75-10+b8 | 1:2.75-10+deb13u1 | HIGH |
| CVE-2026-29111 | libsystemd0 | 257.9-1~deb13u1 | 257.13-1~deb13u1 | HIGH |
| CVE-2026-29111 | libudev1 | 257.9-1~deb13u1 | 257.13-1~deb13u1 | HIGH |

**Security surface comparison**:
- ai-analysis: `python:3.13-slim` (Debian 13) ← affected
- 5 NestJS services: `node:22-alpine` ← unaffected (alpine, debian-independent)
- Python packages (Pydantic, FastAPI, anthropic, etc.): all clean (0 vulnerabilities)

**Changes** (`services/ai-analysis/Dockerfile`, +10):
- Added OS security patch layer to both builder + runner stages:
```dockerfile
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```
- debian security repo's `deb13u1` patches auto-applied
- `--no-install-recommends` + cache cleanup minimizes image size impact

**Verification**:
- PR #273 CI: 29 SUCCESS / 0 FAIL (Trivy SKIPPED on PR stage, runs only post-merge)
- Critic R1: clean ✅ "package index update/upgrade/cleanup steps to both Docker build stages... no discrete regression"
- Post-merge CI run `26072326494`: ALL SUCCESS including:
  - `Trivy Scan — ai-analysis`: ✅ success
  - `Update GitOps manifests`: ✅ success (previously SKIPPED → unblock)
  - `Deploy Notification`: ✅ success (previously SKIPPED → unblock)

## Verification

| Stage | Result |
|---|---|
| PR #272 pre-merge CI | 31 SUCCESS / 0 FAIL |
| PR #272 Critic R1 | 1 P2 (`raw_excerpt` logger exposure) |
| PR #272 Critic R2 | clean ✅ |
| PR #272 mergeStateStatus | CLEAN ✅ |
| **PR #272 post-merge CI** | ❌ Trivy Scan — ai-analysis fail (base image CVE) |
| **GitOps update / Deploy Notification** | ❌ SKIPPED (production deploy blocked) |
| PR #273 pre-merge CI | 29 SUCCESS / 0 FAIL |
| PR #273 Critic R1 | clean ✅ |
| PR #273 mergeStateStatus | CLEAN ✅ |
| **PR #273 post-merge CI** | ✅ ALL SUCCESS |
| **Trivy Scan — ai-analysis (re-run)** | ✅ success |
| **Update GitOps manifests** | ✅ success (unblock) |
| **Deploy Notification** | ✅ success (unblock) |

## New Patterns

1. **Triple-defense pattern** — backend envelope + frontend string-aware parser + user-friendly fallback. If one layer is bypassed, the next defends. Direct continuation of Sprint 155's three-layer safety net (plan + pre-push + CI lint), but this sprint applies backend/frontend layer separation
2. **Auto-Critic P2 hotfix sprint self-contradiction detection** — P1 envelope introduction successfully blocks raw exposure, but `raw_excerpt` persistence in logger self-contradicts sprint goal. Codex cross-validation's sprint consistency guard effectiveness. Continuation of Sprint 117~ Auto-Critic establishment pattern
3. **Oracle option-branch sprint-goal-driven decision** — between Critic-proposed options A/B, sprint goal = raw exposure blocking → option B (maintain block) adopted. Direct continuation of Sprint 155 pattern
4. **"Main merge failed" forward-fix pattern** — when git merge succeeds + post-merge security gate fails blocking deploy pipeline, avoid revert and add base image patch PR for unblock. Maintains code normality + separates security patch as distinct PR for clear history
5. **PR-stage Trivy SKIP + post-merge fail pattern exposed** — matrix conditional causes PR-stage SKIP, post-merge actually runs. Base image regressions undetectable pre-merge → post-fact forward-fix required. Sprint 160 seed: PR-stage Trivy activation
6. **Python (Debian) vs NestJS (alpine) security surface difference** — Python services' base image exposes OS CVEs more frequently. Base image regular update automation needed. Sprint 160 seed: Dependabot Dockerfile updater or weekly cron
7. **Formal retrospective for urgent hotfix sprint without `/start`** — abnormal flow but with actual work merged to main, user `/stop` invocation uses Sprint 159 slot + normal retrospective written. Status guard bypass policy

## Lessons

1. **Backend regex score fallback robustness ≠ user visibility** — totalScore regex extraction + status=completed makes analysis itself appear success, but raw exposure in feedback field renders it useless to users. Envelope consistency required all the way to frontend
2. **Frontend brace counter must 1:1 map with backend string-aware logic** — defense in depth. If only one side is string-aware, the other receives broken JSON and enters fallback. Sprint 159 hotfix's nature exposes this tech debt
3. **Self-contradiction detection possible after Critic 1st pass** — P1 envelope introduction succeeded, but `raw_excerpt` persistence in logger self-contradicts. Auto-Critic auto-queue (Sprint 117~) effectiveness reaffirmed this sprint. Sprint goal consistency guard at same level as message/symbol/exit code consistency
4. **PR-stage Trivy SKIP cannot detect base image regressions pre-merge** → post-fact forward-fix required. Sprint 160 seed activation to move detection earlier
5. **Successful git merge ≠ successful deploy** — when post-merge security gate fails, GitOps update + Deploy Notification skipped means no production deployment. "Main merge failed" reality = deploy pipeline blocked. User-facing message is ambiguous, needs clearer guard
6. **`python:3.13-slim` Debian base may regularly expose OS CVEs** — alpine switch carries build-time dependency change risk, but base image regular update is essential. Sprint 160 seed: Dependabot Dockerfile updater or weekly cron for automation
7. **`_parse_group_response` shares same raw_text fallback pattern** — identified in architect report. Outside this sprint's scope, but group analysis usage carries same exposure risk. Sprint 160 carry-over seed
8. **`apt-get upgrade` on both stages is standard pattern** — safer than base image tag change (regression risk). `--no-install-recommends` + cache cleanup minimizes image size impact (estimated +5~10MB)
9. **PR merge timing is not deploy completion** — needs explicit "merge ≠ deploy" distinction in user-facing alerts/Discord, etc. (Sprint 160+ UX seed)

## Sprint 160 Carry-Over Seeds

### New Automation Candidates (Derived from Sprint 159)

- **Seed #new1**: PR-stage Trivy scan activation — change matrix conditional for pre-merge base image regression detection (avoid this sprint's forward-fix cycle)
- **Seed #new2**: Base image regular update automation — Dependabot Dockerfile updater activation or weekly cron `apt-get upgrade` rebuild (continuation of Sprint 156 weekly cron pattern)
- **Seed #new3**: Apply same envelope to `_parse_group_response` raw_text fallback — extend this sprint's dh4m fix envelope protection to group analysis (architect-identified)
- **Seed #new4**: Strengthen deploy pipeline blocking alerts — clearly separate "git merge success + deploy block" cases in Discord/Slack notifications (avoid user's ambiguous "main merge failed" message)

### Sprint 158 Carry-Over

- **New automation candidates**:
  - Seed #30: Build output Korean residue auto-validation CI step (allowlist-based)
  - Seed #31: i18n matching checklist 3-layer (meta/UI/body) plan template auto
- **Sprint 157 carry-over**:
  - Seed #24: plan template i18n dual-side mandatory checklist auto
  - Seed #26: docs/adr/README.md paths filter negation
  - Seed #27: CI build-blog `ls out/` output existence verification step
  - Seed #28: check-adr-links.mjs ROOT auto-detection
  - Seed #29: plan template "probe step companion mandatory for new CI step"
- **UAT user-direct (16 sprints cumulative)**:
  - Seed #5: Programmers re-submission scoring pass confirmation
  - Seed #9: English environment + production Grafana CB dashboard ai-analysis visual integrity
- **Carry-over maintained**:
  - Seed #18: Blog post pre-merge domain fact cross-check automation
  - Seed #23: plan template "post-rebase cumulative count fix" checklist
- **Follow-up (optional)**:
  - create/edit page.tsx category UI
  - Programmers URL auto category inference
  - Existing SQL problem data backfill
  - coverage-gate `skipped` allowance removal (Sprint 156 Phase B option B)
  - post-merge pre-deploy gate (Sprint 156 Phase B option C)
  - prom-client Case B~D inspection automation
  - `.claude-tools/` Phase 2 actual deletion (after trigger path verification)
  - `(adr)` layout split (KR + EN override) — alternative to Sprint 158 description unification

## Branch Discipline

✅ **27 sprints consecutive compliance** — both PRs new branches + Squash merge, 0 main direct commits, 0 `--no-verify` uses. This sprint proceeded without `/start`, but formal process maintained: work branch separation + PR merge + Critic cross-validation.

## References

- Previous sprint: [sprint-158.md](sprint-158.md)
- PR #272: https://github.com/tpals0409/AlgoSu/pull/272
- PR #273: https://github.com/tpals0409/AlgoSu/pull/273
- main HEAD: `a73c596` → `2ec3747`
