---
sprint: 95
title: "Programmers Dataset + Gateway External Integration"
date: "2026-04-20"
status: completed
---

# Sprint 95 — Programmers Dataset + Gateway External Integration

## Background

Following the Baekjoon (BOJ) service shutdown, AlgoSu's problem source must migrate to Programmers. The migration scope spans backend, frontend, and submission pipeline — requiring a **3-sprint roadmap** (Sprint 95 backend infra → Sprint 96 frontend UX → Sprint 97 submission/docs). This sprint focuses exclusively on backend infrastructure with **zero user-visible changes** as the guiding principle.

At sprint start, two problems had accumulated in `.planning`:
1. No official Programmers API — real-time parsing would require fragile scraping
2. Problem pool is finite and rarely updated — pre-bundled JSON is more operationally stable

## Goals

- Bundle Programmers problem metadata as a pre-curated JSON file, eliminating external API dependency from the search UX
- Build `/api/external/programmers/*` endpoints in Gateway with **symmetric structure** to the existing BOJ (Solved.ac) endpoints
- Strengthen DTO `sourcePlatform` with `@IsIn(['BOJ','PROGRAMMERS'])` to explicitly declare allowed values
- Guarantee 0 BOJ path regressions

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `adad5cf` | architect | ProgrammersService/Controller skeleton + external.module.ts registration + DTO `@IsIn` extension |
| `60b7925` | librarian | Data bundling decision ADR (`docs/adr/topics/sprint-95-programmers-dataset.md`) |
| `e460b79` | postman | Playwright-based crawler script + initial dataset of 373 problems |
| `18b3932` | curator | Data quality QA report (`PROGRAMMERS-QA.md`) |
| `2578ae0` | gatekeeper | Verification report + 749 tests PASS + BOJ regression integrity |
| `aff4b47` | Oracle | DTO type strengthening follow-up: `problem.service.spec.ts` sync |

## Changes

### Gateway External Module

- `services/gateway/src/external/programmers.service.ts` — JSON loaded at startup, `Map<problemId, Info>` in-memory cache, `fetchProblem`/`searchProblem` — symmetric to SolvedacService interface
- `services/gateway/src/external/programmers.controller.ts` — `GET /problem/:problemId`, `GET /search?query=&page=`, Swagger `External — Programmers`
- `services/gateway/src/external/external.module.ts` — ProgrammersService/Controller registered (alongside existing Solvedac)
- Data envelope structure: `{ version: ISO8601, items: ProgrammersProblemInfo[] }` + legacy array backward compatibility (`isDataEnvelope()` type guard)

### Crawler & Dataset

- `services/gateway/scripts/fetch-programmers-problems.ts` — Playwright chromium headless, iterates `/learn/challenges?levels=N&order=acceptance_desc&page=M`. Per-level independent pagination, terminates when 0 new items found, 300–500ms random delay, HTML/URL logging prohibited
- `services/gateway/data/programmers-problems.json` — **373 problems** collected (Lv.1:95 / Lv.2:132 / Lv.3:95 / Lv.4:31 / Lv.5:20), includes problem 42840 (mock exam), zod runtime validation passed

### DTO

- `services/problem/src/problem/dto/create-problem.dto.ts` — `SOURCE_PLATFORMS = ['BOJ','PROGRAMMERS'] as const` extracted, `@IsIn(SOURCE_PLATFORMS)` applied, type exported
- DB migration **not required** (existing `source_platform` VARCHAR(50) retained)

### Test Sync

- `services/problem/src/problem/problem.service.spec.ts` L156/L414/L422 — dummy platform literals ('LeetCode','Codeforces') → `'PROGRAMMERS'` replacement. `sourceUrl` retains only `@IsUrl` validation — minimum change principle applied

## Verification

| Item | Result |
|------|--------|
| Gateway unit tests (50 suites / **749 tests**) | ✅ PASS |
| Gateway `tsc --noEmit` | ✅ 0 errors |
| Gateway ESLint (src + scripts) | ✅ 0 errors |
| Problem `problem.service.spec.ts` (35 tests) | ✅ PASS (initial FAIL → Oracle fix) |
| BOJ regression (`solvedac.{service,controller}.ts` diff) | ✅ 0 lines changed |
| Data quality (duplicate/missing/encoding/representative problems) | ✅ 6 PASS / 1 WARN (tags) |

## Decisions

- **Pre-curated JSON bundling over real-time parsing/unofficial API**: No official API + Cloudflare JA3 blocking (Sprint 83 precedent) + finite problem pool (373 items)/low update frequency. Operational stability prioritized
- **Search API also bundling-based**: In-memory `search` endpoint symmetric to Solvedac → Sprint 96 frontend can implement identical UX
- **Lv.1~5 ↔ BRONZE~DIAMOND 1:1 mapping**: 0 design token lines changed — reuses existing `Difficulty` enum and style tokens
- **DTO `@IsIn` strengthening**: From free-string to allowlist. Early mismatch rejection at input boundary. DB retains VARCHAR → Expand-Contract not required
- **Branch discipline restoration**: architect accidentally committed directly to main (adad5cf) → moved to `feat/gateway-programmers-dataset` branch, main reset (local stage). "No direct push to main" rule enforced

## Lessons Learned

- **External metadata source selection is determined by "update frequency × available API quality"**. For sources like Programmers with low growth rate and no official API, pre-bundling has lower total cost than real-time parsing
- **Large-scale migrations should not be crammed into a single sprint — split into independently deployable units**. Initial single-sprint plan included data infra + backend + frontend + submission + docs, creating regression/QA risk. Redesigned as 3-sprint roadmap based on user feedback
- **Oracle dispatch pipeline is most effective when dependency analysis is managed in Waves**. scout→postman→curator chain with librarian parallel placement was natural
- **DTO type strengthening must also update existing spec file literals**. When `@IsIn([...])` + `as const` is introduced, all hardcoded strings in tests referencing that type become TS2322 candidates. Caught early in gatekeeper Wave 3
- **tmux pane resources leak during long-lived sessions**. Stale pane/lock cleanup is always necessary during oracle dispatch. Cases where zombie sessions leave only locks (architect/gatekeeper) require cross-referencing panes.json and locks directories
- **Crawler count targets should be adjusted after confirming actual available pool**. scout estimate 600–800 vs actual 373 — 3-sort cross-verification confirmed it's the full public pool. Accept practical sufficiency over target rigidity

## Carried Over (Sprint 96–97)

- **tags empty array enrichment**: 373 problems have no tags collected. Individual problem detail page breadcrumb crawling for subsequent collection (postman, Sprint 96 or 97)
- **Frontend UX integration**: `programmersApi`, `useProgrammersSearch` hook, `AddProblemModal` platform toggle (Sprint 96)
- **GitHub Worker extension**: `formatPlatform()` `'programmers' → 'PROGRAMMERS'` case + `prg_` filename prefix (Sprint 97)
- **AI feedback prompt**: `sourcePlatform` dynamic injection (Sprint 97)
