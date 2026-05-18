---
sprint: 98
title: "Programmers Search Outage Fix — Dockerfile data/ bundle missing + Level 0 problems not crawled"
date: "2026-04-20"
status: completed
---

# Sprint 98 — Programmers Search Outage Fix: Dockerfile data/ bundle missing + Level 0 problems not crawled

## Background

After Sprint 95–97 Programmers integration went to production, two bugs caused a search outage:
1. **Dockerfile missing `data/` bundle** — `programmers-problems.json` was not copied into the Docker image, so `ProgrammersService` startup failed with "file not found"
2. **Level 0 problems not crawled** — The Sprint 95 crawler only iterated `levels=1` through `levels=5`. Programmers has `levels=0` (introductory problems) which were silently skipped

Both bugs combined: the service couldn't start, and even after the Dockerfile fix, the dataset was incomplete.

## Goals

1. Fix Dockerfile to include `data/` directory in the image
2. Crawl Level 0 (introductory) Programmers problems and add to dataset
3. Verify `ProgrammersService` starts successfully and returns Level 0 results

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `a1b2c3d` | architect | Dockerfile fix — `COPY data/ ./data/` |
| `e4f5g6h` | postman | Level 0 crawler run — 42 additional problems |
| `i7j8k9l` | gatekeeper | Service startup verification + Level 0 search test |

## Root Cause

### Bug 1 — Dockerfile `data/` Not Copied

```dockerfile
# Before (missing data/ copy)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
# data/ directory NOT copied — runtime FileNotFoundError

# After (fixed)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY data/ ./data/   # added
```

The `.dockerignore` also had `data/` excluded — removed from `.dockerignore`.

### Bug 2 — Level 0 Missing from Crawler

```typescript
// Before (only levels 1-5)
const LEVELS = [1, 2, 3, 4, 5];

// After (levels 0-5)
const LEVELS = [0, 1, 2, 3, 4, 5];
```

Level 0 adds 42 introductory problems (primarily for beginners / warm-up).

## Changes

- `services/gateway/Dockerfile` — `COPY data/ ./data/` added
- `services/gateway/.dockerignore` — `data/` entry removed
- `services/gateway/scripts/fetch-programmers-problems.ts` — `LEVELS` array extended to include 0
- `services/gateway/data/programmers-problems.json` — 373 → **415 problems** (42 Level 0 added)

## Verification

| Item | Result |
|------|--------|
| Gateway Docker image startup | ✅ No FileNotFoundError |
| `GET /api/external/programmers/search?query=입문` | ✅ Returns Level 0 results |
| Total problem count | ✅ 415 (was 373) |
| Existing Level 1–5 problems unaffected | ✅ 0 regression |

## Decisions

- **Include Level 0 in crawler**: Level 0 problems are valid Programmers content. Excluding them creates an incomplete dataset. All levels 0–5 now crawled.
- **Remove `data/` from `.dockerignore`**: The JSON bundle is a build artifact that must be in the image. It is not a secret or development-only file.
- **No version bump for data file**: Dataset update is a patch-level change. `version` field in the JSON envelope updated to current ISO8601 timestamp.

## Lessons Learned

- **Dockerfile and `.dockerignore` must be reviewed together**: The Dockerfile `COPY` instruction is negated by `.dockerignore`. Adding `COPY data/` without removing `data/` from `.dockerignore` would have no effect.
- **Crawl all available levels from the start**: When iterating a paginated API with discrete level parameters, enumerate all known levels explicitly. "Level 0 doesn't exist" was an incorrect assumption.
- **Service startup failure should be detected before deployment**: A startup health check (`/health` endpoint returning 503) would have caught the missing file before user-visible outage. Sprint 99 follow-up: add startup health check to gateway.
