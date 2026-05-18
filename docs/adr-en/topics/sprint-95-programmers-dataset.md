---
sprint: 95
title: "Programmers Dataset Bundling + Gateway External Integration"
date: "2026-04-20"
status: proposed
agents: [Oracle, Scout, Architect, Postman, Curator, Gatekeeper, Librarian]
related_adrs: ["sprint-83"]
related_memory: ["project-programmers-migration"]
---

# Sprint 95 — Programmers Dataset Bundling + Gateway External Integration

## Background

With the shutdown of Baekjoon (BOJ) service, AlgoSu must migrate its problem source to Programmers. As the first phase of the Sprint 95~97 roadmap, this sprint bundles Programmers problem metadata as a pre-curated JSON and builds an external endpoint in Gateway with a symmetric structure to BOJ (Solved.ac). UI and submission flows are not touched in this sprint.

### Core Assumptions
- Existing BOJ records and UI flows **preserved** — only new registrations use Programmers
- `sourcePlatform` column is already `VARCHAR(50)` — **no DB migration required**
- Merging Sprint 95 alone results in 0 user-visible changes (backend infrastructure deployed first)

## Decision 1: Metadata Strategy — Pre-Curated JSON Bundling

### Choice
Collect Programmers problem metadata via a **one-time crawler script** and bundle it as static JSON at `services/gateway/data/programmers-problems.json`. Load the JSON into memory at service startup and cache it as `Map<problemId, info>`.

### Alternative Comparison

| Criteria | A: Pre-curated JSON bundling (chosen) | B: Real-time HTML parsing | C: Unofficial API direct call |
|----------|--------------------------------------|--------------------------|-------------------------------|
| **Stability** | ✅ File-based, 0 external dependencies | ❌ Breaks immediately on HTML structure change | ❌ Cloudflare blocking, rate limit |
| **Response speed** | ✅ Memory lookup O(1) | ❌ Network RTT + parsing per request | ⚠️ Network RTT |
| **Data freshness** | ⚠️ Manual refresh (quarterly script re-run) | ✅ Always current | ✅ Always current |
| **Maintainability** | ✅ zod schema validation, refresh runbook | ❌ Must track selector changes | ❌ Must handle API changes/blocking |
| **Cloudflare handling** | ✅ Bypass only once (wget subprocess) | ❌ Must bypass JA3 per request | ❌ Fingerprint blocked (Sprint 83 case) |

### Rationale
- Programmers has no official API
- In Sprint 83, Cloudflare fully blocked the Node.js TLS JA3 fingerprint
- The coding test practice problem pool is finite (~800 items) with low update frequency (2~5 new problems per month)
- Memory cache-based search/lookup UX is fastest

### Refresh Policy
- **Frequency**: Manual run once per quarter (`pnpm --filter @algosu/gateway run fetch-programmers`)
- **Runbook**: `docs/runbook/programmers-dataset-refresh.md` (to be written in Sprint 97)
- **Automation**: Follow-up Backlog (cron pipeline is out of scope for this sprint)

## Decision 2: Gateway External Module Symmetric Structure

### Choice
Implement `ProgrammersService` / `ProgrammersController` with the **same interface contract** as existing `SolvedacService` / `SolvedacController`, and register them side-by-side in `external.module.ts`.

### Architecture

```
services/gateway/src/external/
├── external.module.ts              [modified: register Programmers*]
├── solvedac.service.ts             [existing, unchanged]
├── solvedac.controller.ts          [existing, unchanged]
├── programmers.service.ts          [new]
├── programmers.controller.ts       [new]
├── programmers.service.spec.ts     [new]
└── programmers.controller.spec.ts  [new]
```

### Endpoint Symmetry

| BOJ (existing) | Programmers (new) |
|----------------|-------------------|
| `GET /api/external/solvedac/problem/:problemId` | `GET /api/external/programmers/problem/:problemId` |
| `GET /api/external/solvedac/search?query=&page=` | `GET /api/external/programmers/search?query=&page=` |

### Response Interface

```typescript
/** ProgrammersProblemInfo — symmetric to SolvedacProblemInfo */
interface ProgrammersProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  level: number;       // Programmers Lv.1~5
  sourceUrl: string;   // https://school.programmers.co.kr/learn/courses/30/lessons/{id}
  tags: string[];
}
```

### Design Principles
1. **Interface symmetry**: Response structure identical so Sprint 96 frontend can swap APIs with a platform toggle only
2. **Data source separation**: SolvedacService uses wget subprocess (real-time), ProgrammersService uses JSON file (static) — only internal implementation differs
3. **Swagger tag separation**: `External — Solved.ac` / `External — Programmers`

## Decision 3: Difficulty Mapping — Reuse Existing Tokens

| Programmers | Difficulty Enum | Existing color token |
|-------------|----------------|----------------------|
| Lv.1 | `BRONZE` | `#C06800` |
| Lv.2 | `SILVER` | `#5A7B99` |
| Lv.3 | `GOLD` | `#D48A00` |
| Lv.4 | `PLATINUM` | `#20C490` |
| Lv.5 | `DIAMOND` | `#00A8E8` |

- `Difficulty` Enum, style tokens, badge component — **0 lines changed**
- Add mapping function `programmersLevelToDifficulty(level: 1..5)` (used by Sprint 96 frontend)

## Decision 4: DTO sourcePlatform Validation Hardening

### Before
```typescript
// services/problem/src/problem/dto/create-problem.dto.ts
@IsOptional()
@IsString()
@MaxLength(50)
sourcePlatform?: string;   // free string
```

### After
```typescript
@IsOptional()
@IsIn(['BOJ', 'PROGRAMMERS'])
sourcePlatform?: string;   // restricted to allowed values
```

### DB Impact Assessment (Librarian)
- `source_platform` column is `VARCHAR(50)` — **not an ENUM**, so adding a value requires no migration
- Existing data may include values other than `'BOJ'` (e.g., `'baekjoon'`, `'LeetCode'`), but DTO validation **restricts new input only** — no impact on existing records
- Apply `@IsIn` equally to `UpdateProblemDto` to restrict allowed values on update as well
- For future platform additions, only add the value to the `@IsIn` array — no Expand-Contract needed

## Crawler Script Design

### Data Source
Collect the public problem list from the Programmers coding test practice page (`school.programmers.co.kr/learn/challenges`).

### Collected Fields
```typescript
interface ProgrammersProblemRaw {
  id: number;              // Problem unique ID (lessons/{id} in URL)
  title: string;           // Korean title
  level: number;           // 1~5
  partTitle: string;       // Category (hash, stack/queue, sort, etc.)
  finishedCount: number;   // Completion count (popularity indicator)
}
```

### Output
- Path: `services/gateway/data/programmers-problems.json`
- Size: estimated 100~300KB (600~800 items)
- Validation: zod schema (`z.array(ProgrammersProblemSchema).min(500)`)

### Cloudflare Bypass Strategy
Reuse the **wget subprocess** pattern verified in Sprint 83. Since Cloudflare only allows Alpine's default wget (BusyBox) TLS fingerprint, collect data via `child_process.execFile('wget', ...)`.

## 3-Sprint Roadmap Summary

| Sprint | Focus | Deployment Impact |
|--------|-------|------------------|
| **95** (current) | Dataset + Gateway external integration | 0 user-visible changes — backend only |
| **96** | Frontend UX (search toggle, default switch) | New registrations possible via Programmers |
| **97** | GitHub Worker `prg_` prefix, AI feedback, documentation | end-to-end complete |

### Split Rationale
- **Regression isolation**: Each sprint is independently mergeable, so a defect in one stage does not block the entire flow
- **Forward dependency order**: 95 (BE) → 96 (FE, requires 95) → 97 (Worker, requires 96)
- **Minimized verification unit**: Narrower change scope per sprint reduces testing and review burden

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Programmer HTML structure change breaks crawler | Medium | Medium | Since JSON is bundled, no immediate service impact. Fix script on refresh |
| JSON data missing or miscategorized | Medium | Low | Curator quality review + zod schema validation |
| `@IsIn` addition breaks existing DTO compatibility | Low | Medium | Existing record read path does not go through DTO. Impact only on update — `UpdateProblemDto` also updated |
| Cloudflare extends wget blocking | Low | Medium | No impact once bundling is complete. Browser manual collection as fallback |

## Out of Scope (Deferred to Sprint 96~97)

- Frontend `programmersApi`, hooks, modal changes
- `github-push.service.ts` `formatPlatform()` extension (`prg_` prefix)
- AI feedback prompt dynamic platform injection
- Data refresh automation cron pipeline

## Verification Plan

1. `pnpm --filter @algosu/gateway run fetch-programmers` → JSON generated, 600+ problems confirmed
2. `GET /api/external/programmers/search?query=mock-test` → returns matching problems
3. `GET /api/external/programmers/problem/42840` → returns single item
4. Non-existent ID → `404 NotFoundException`
5. `pnpm --filter @algosu/gateway test` — all tests pass
6. `tsc --noEmit` — 0 type errors
7. **Regression**: `/api/external/solvedac/*` existing BOJ routes confirmed working
