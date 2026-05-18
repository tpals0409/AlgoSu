---
sprint: 110
title: "Complete Carry-over Processing"
period: "2026-04-21"
status: complete
start_commit: 2f238b6
end_commit: 28f8694
---

# Sprint 110 — Complete Carry-over Processing

## Background

Sprints 107–109 completed CI refactoring, Programmers SQL support, and SQL rubric closure in sequence. However, 11 carry-over items pushed out of those sprints had accumulated. Individually small, but collectively they risked solidifying into technical debt — and with host-side build migration (LARGE) included, a separate roadmap might be needed.

Sprint 110 aimed to process this carry-over list completely in a single session, achieving **zero technical debt**. W1 Oracle inline reconnaissance pre-confirmed heavy deps unused, Monaco already complete, and GROUP_SYSTEM_PROMPT SQL branch not yet applied. W2–W6 wave parallelization compressed 11 items into 5 commits.

Wave structure: W1 (Oracle inline reconnaissance) → W2 (coverage/CI small 3 items) → W3 (SQL follow-up 3 items) → W4 (blog 2 items) → W5 (dependency cleanup + Coverage gate 2 items) → W6 (Blog host-side SSG migration 1 item) → W7 (Scribe ADR).

## Goals

| Item | Content | Status |
|------|---------|--------|
| `pyproject.toml` branch coverage | `branch=true` activation | ✅ Complete (W2) |
| github-worker incremental sync | `tsconfig.json` incremental + tsBuildInfoFile | ✅ Complete (W2) |
| APK_CACHE_BUST conditionalization | push/PR `stable`, workflow_dispatch only busts | ✅ Complete (W2) |
| GROUP_SQL_SYSTEM_PROMPT introduction | Group analysis SQL prompt branch | ✅ Complete (W3) |
| `_parse_response` fallback E2E verification | 7 tests (3-stage fallback + totalScore=0 + SQL weights) | ✅ Complete (W3) |
| Runbook crawler re-crawl cycle documentation | `runbook-programmers-pipeline.md` section addition | ✅ Complete (W3) |
| Blog order automation | slug alphabetical deterministic secondary sort | ✅ Complete (W4) |
| Blog series feature | `PostMeta` series field + series nav aside | ✅ Complete (W4) |
| Unused heavy deps removal | react-dnd (3 items) + react-slick (1 item) deleted | ✅ Complete (W5) |
| Per-service independent coverage gate | `check-coverage.mjs` SERVICE_THRESHOLDS map | ✅ Complete (W5) |
| Blog host-side SSG migration | Dockerfile multi-stage removed → nginx COPY only | ✅ Complete (W6) |
| Frontend host-side build migration | Sharp/SWC arm64 binary mismatch → HARD BLOCK | ❌ Non-adoption decision (D6) |

---

## Decisions

### D1. `pyproject.toml` `branch=true` Activation — Threshold Not Set

**Background**: Sprint 109 carry-over. ai-analysis Python coverage measured lines only, not branches axis.

**Options**:
1. `branch=true` + immediate threshold setting
2. `branch=true` only, set threshold after actual measurement

**Decision**: Option 2. Add only `[tool.coverage.run] branch = true`, threshold not set.

**Rationale**: Setting an arbitrary threshold without actual branch coverage data could cause unnecessary CI failures. Setting the appropriate value after 1–2 sprints of measurement is safer.

### D2. `github-worker/tsconfig.json` incremental Sync

**Background**: Other NestJS services (gateway, submission, problem) already use `incremental: true`, but github-worker alone was missing it.

**Options**:
1. Keep current (github-worker full rebuild only)
2. Add incremental + tsBuildInfoFile

**Decision**: Option 2. Add `"incremental": true`, `"tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo"`.

**Rationale**: Ensures consistency with other services + incremental build speed benefit during local development. No risk factors.

### D3. APK_CACHE_BUST Conditionalization

**Background**: `ci.yml` APK_CACHE_BUST performed cache bust on every build, unnecessarily invalidating APK cache on push/PR.

**Options**:
1. Always bust (current)
2. Only bust when workflow_dispatch input `apk_bust=true`, otherwise `stable`

**Decision**: Option 2. Branch `APK_BUST_VALUE` environment variable based on workflow_dispatch input condition.

**Rationale**: Reusing APK cache in push/PR builds saves CI time. Cases where APK bust is actually needed (Alpine package updates) are limited to manual dispatch.

### D4. GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt(language)` Introduction

**Background**: Sprint 109 introduced `get_system_prompt(language)` pattern but SQL branch was not applied to group analysis (`group_analyze`) (Sprint 109 carry-over, low priority).

**Options**:
1. Keep deferred (low group analysis SQL usage frequency)
2. Reuse `get_system_prompt` pattern to introduce `get_group_system_prompt(language)`

**Decision**: Option 2. Add `GROUP_SQL_SYSTEM_PROMPT` constant + `get_group_system_prompt(language)` function to `prompt.py`, connect in `claude_client.py` and `main.py`.

**Rationale**: Reuses the `get_*_prompt(language)` pattern established in Sprint 109 D2 at minimum implementation cost. Even if usage frequency is low, applying algorithm rubrics to SQL submissions in group analysis is logically inconsistent.

### D5. Blog Host-side SSG Migration Execution

**Background**: "Host-side build migration" had been deferred since Sprint 106. Blog runs Next.js SSG (Static Site Generation) — `npm run build` output is pure HTML/CSS/JS with no platform dependency.

**Options**:
1. Retain Docker multi-stage (current)
2. GHA runs `npm run build` → Docker is nginx COPY only

**Decision**: Option 2. Sensei pre-consultation confirmed SSG output's architecture agnosticism (PASS). Dockerfile reduced to nginx COPY only; `actions/setup-node` + `npm ci` + `npm run build` inserted into ci.yml build-blog job. New `.dockerignore` limits Docker context to `out/` + `nginx.conf`.

**Rationale**: Removing `npm ci` + `npm run build` from Docker build layers reduces image build time + improves layer cache efficiency. SSG output is pure static files — no host ↔ container architecture mismatch issues.

### D6. Frontend Host-side Build HARD BLOCK

**Background**: Frontend could attempt the same host-side migration as Blog, but Frontend includes `sharp` (image optimization) and `@swc/core` (SWC compiler) with arm64 native binaries.

**Options**:
1. Attempt Frontend host-side migration too
2. HARD BLOCK — retain Docker buildx

**Decision**: Option 2. Sensei pre-consultation confirmed Sharp/SWC arm64 native binaries could cause mismatch between GHA runner (linux/amd64) ↔ Docker target architecture. Third recurrence of Sprint 106 [C] pattern.

**Rationale**: Unlike Blog (SSG, pure static), Frontend operates in `next start` server mode with native binary dependencies. Copying `node_modules` built on host to a different-architecture container risks runtime crashes. This is a **non-adoption decision**, not a deferral.

---

## Wave Execution Log

| Wave | Agent | Task | Commit |
|------|-------|------|--------|
| W1 | Oracle (inline) | heavy deps/Monaco/GROUP_SYSTEM_PROMPT reconnaissance | — |
| W2 | Architect (3 parallel) | pyproject.toml branch=true, tsconfig incremental, APK_CACHE_BUST conditionalization | `4b245df` |
| W3 | Architect + Sensei | GROUP_SQL_SYSTEM_PROMPT, fallback E2E tests 7, runbook crawler cycle | `7789e79` |
| W4 | Architect + Scribe | Blog order automation, series feature introduction | `d38dcb0` |
| W5 | Architect | react-dnd/react-slick removal, per-service coverage gate | `01f8283` |
| W6 | Architect (Sensei pre-consult) | Blog host-side SSG migration, Frontend HARD BLOCK decision | `28f8694` |
| W7 | Scribe | Closing ADR | — |

---

## Outputs and Changed Files

| File | Action | Wave | Description |
|------|--------|------|-------------|
| `services/ai-analysis/pyproject.toml` | Modified | W2 | `[tool.coverage.run] branch = true` added |
| `services/github-worker/tsconfig.json` | Modified | W2 | `incremental: true` + `tsBuildInfoFile` added |
| `.github/workflows/ci.yml` | Modified | W2, W6 | APK_CACHE_BUST conditionalization (W2) + Blog host-side build insertion (W6) |
| `services/ai-analysis/src/prompt.py` | Modified | W3 | GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt(language)` added |
| `services/ai-analysis/src/claude_client.py` | Modified | W3 | `group_analyze` connected to `get_group_system_prompt(language)` call |
| `services/ai-analysis/src/main.py` | Modified | W3 | `group_analyze` → `get_group_system_prompt` parameter passing |
| `services/ai-analysis/tests/test_claude_client.py` | Modified | W3 | TestParseResponseFallback 7 added (3-stage fallback + totalScore=0 + SQL weights) |
| `services/ai-analysis/tests/test_prompt.py` | Modified | W3 | GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt` tests added |
| `docs/runbook/programmers-pipeline.md` | Modified | W3 | Problem list crawler re-crawl cycle section added |
| `blog/src/lib/posts.ts` | Modified | W4 | `PostMeta` series/seriesOrder fields + `getSeriesPosts()` + order automation (slug alphabetical) |
| `blog/src/components/post-page.tsx` | Modified | W4 | Series aside navigation added |
| `frontend/package.json` | Modified | W5 | react-dnd (3) + react-slick (1) dependencies removed |
| `frontend/package-lock.json` | Modified | W5 | Removed dependency lock reflected (−174 lines) |
| `scripts/check-coverage.mjs` | Modified | W5 | SERVICE_THRESHOLDS map + per-service independent gate |
| `blog/Dockerfile` | Modified | W6 | Multi-stage removed → nginx COPY only |
| `blog/.dockerignore` | New | W6 | Docker context limited to `out/` + `nginx.conf` |

**Change statistics**: 16 files changed, 428 insertions(+), 204 deletions(−)

**Commit list** (5 items):
- `4b245df` — chore(ci): Sprint 110 W2 — coverage/CI small bundle 3 items
- `7789e79` — feat(ai-analysis): Sprint 110 W3 — SQL follow-up bundle 3 items
- `d38dcb0` — feat(blog): Sprint 110 W4 — blog order automation + series feature
- `01f8283` — chore(frontend,ci): Sprint 110 W5 — unused dep removal + per-service coverage gate
- `28f8694` — feat(blog,ci): Sprint 110 W6 — Blog host-side SSG build migration

---

## Lessons Learned

### 1. Sensei Pre-consultation — Sprint 106 Pattern Third Recurrence

W6 could have also attempted Frontend host-side migration alongside Blog, but Sensei pre-consultation pre-detected Sharp/SWC arm64 native binary mismatch and determined HARD BLOCK. The "native binary architecture mismatch on host-side build" pattern first discovered in Sprint 106 [C] recurred for the third time. **Zero implementation line decisions** repeatedly proved their value in preventing runtime crashes.

### 2. Scout Agent Misjudgment Correction — Exploration Results Require Cross-verification

W1 reported react-dnd/react-slick as "unused," but actual measurement confirmed their presence in `package.json`. Case where exploration agent confused "not imported in code" with "not present in project." **Scout agent reports must always be cross-verified against `package.json`/`import` actuals**.

### 3. Complete Carry-over Processing Effect — Zero Technical Debt Achieved

Processing 11 carry-over items in a single sprint brought Sprint 107–109 accumulated technical debt to zero. Wave parallelization (W2 3-parallel, W3 3-item bundle, etc.) absorbed even the LARGE item (W6 Blog host-side). When carry-over items accumulate for 3+ sprints, organizing a complete-processing sprint is effective.

### 4. Pre-measurement of Carry-over Items Improves Scope Accuracy

Monaco dynamic import was on the carry-over list, but W1 reconnaissance confirmed it was already implemented at `CodeEditor.tsx:27` — excluded from scope. Pre-measuring carry-over items before starting eliminates unnecessary work and allows focus on items actually requiring processing.

---

## Carried Over

**None.**

All Sprint 107–109 carry-overs completed. Sprint 108+ "Frontend host-side build migration" is a **non-adoption decision** (D6 HARD BLOCK) — not a deferral.

---

## Related Documents

- `docs/adr/sprints/sprint-109.md` — preceding sprint (SQL learning experience closure)
- `docs/adr/sprints/sprint-106.md` — host-side build migration seed origin
- `services/ai-analysis/src/prompt.py` — GROUP_SQL_SYSTEM_PROMPT, get_group_system_prompt()
- `services/ai-analysis/tests/test_claude_client.py` — TestParseResponseFallback 7 items
- `scripts/check-coverage.mjs` — SERVICE_THRESHOLDS per-service independent gate
- `blog/Dockerfile` — nginx COPY only (host-side SSG migration result)
- `blog/.dockerignore` — Docker context minimization
