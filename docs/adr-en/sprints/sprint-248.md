---
sprint: 248
title: "AI Analysis Context Enrichment — Group Analysis Problem Injection + Programmers Crawler Module"
date: "2026-07-15"
status: completed
agents: [Oracle, Scout, Sensei, Curator, Critic]
related_adrs: ["sprint-247", "sprint-238", "sprint-97"]
related_memory: ["sprint-window"]
topics: ["ai-analysis", "problem", "crawler", "context-enrichment", "security"]
tldr: "Resolved the pain point of AI analysis receiving only user code without problem context — two complementary approaches. Wave B: Group analysis endpoint now queries Problem Service and injects problem_title/problem_description as a <problem_context> block (reusing ADR-030 S-5 individual analysis pattern). Wave A: New Programmers crawler module in problem service auto-fills description on problem registration using sourceUrl (axios+cheerio, no Playwright). Crawling spike (Scout) confirmed BOJ fully shut down on 2026-04-28; Programmers is SSR and parseable with httpx alone. Critic gate returned 3 findings (P1 SSRF, P2 envelope unwrap, P2 catch handler), all resolved before merge. multer CVE-2026-5079 (HIGH) patched concurrently. PR #462 merged at a7731fa. AI Analysis 353 passed / 99% coverage; Problem 205 passed / 96.47% branch coverage."
---
# Sprint 248 — AI Analysis Context Enrichment

## Goal

- Eliminate the pain point where AI analysis receives only user code, forcing the AI to reverse-engineer the problem.
- **Wave B**: Inject problem information (title + description) into group analysis to improve multi-submission comparison accuracy.
- **Wave A**: Auto-populate `description` via Programmers crawling on problem registration, fundamentally resolving the missing AI context.
- **Wave S (spike)**: Validate that Programmers can be parsed with httpx+BeautifulSoup4 alone, before committing to Wave A.

## Background

- Sprint 238 (ADR-030 S-5) implemented the `<problem_context>` injection pattern for individual analysis, but the group analysis endpoint (`/group-analysis`) was never updated with the same pattern.
- The `Problem` entity already had `sourceUrl`/`sourcePlatform` fields (from Sprint 97 Programmers migration), but no auto-crawling logic on registration — leaving `description` empty in most cases.
- Crawling feasibility could not be assumed without a spike, so Wave S (Scout) was placed before Wave A.

## Decisions

### D1. Group Analysis Problem Injection Strategy — Internal API Query

- On group analysis request, query Problem Service `GET /internal/{problem_id}` using `problem_id`.
- On query failure (network error, problem not found): **fallback** — log warning and proceed without problem info to preserve service availability.
- `<problem_context>` block follows the ADR-030 S-5 isolation pattern — prompt injection defense included.
- Both `GROUP_SYSTEM_PROMPT` and `GROUP_SQL_SYSTEM_PROMPT` updated with injection defense guidelines.
- Outbound key: `INTERNAL_KEY_PROBLEM` (CLAUDE.md Sprint 239 Q-5 SSOT).

### D2. Crawling Scope — Programmers Only, Single Async Backfill on Registration

- Scout spike result: **BOJ service fully shut down on 2026-04-28**, Programmers confirmed as SSR (no JS rendering required).
- Playwright prohibited (Docker image ~400MB increase, browser runtime not allowed in problem service) → `axios` + `cheerio` lightweight crawling.
- On problem registration: if `description` is empty and `sourceUrl`/`sourcePlatform` are present, trigger **async backfill** (fire-and-forget, non-blocking).
- `ALLOWED_HOSTS` whitelist: `school.programmers.co.kr` only + `https:` protocol enforcement → SSRF defense.

### D3. Spike-First Principle Reconfirmed

- Running Wave S (Scout) before Wave A to validate crawling feasibility proved correct.
- Operational changes like BOJ shutdown can only be confirmed by actual HTTP requests, not static analysis.

## Implementation

### Wave S — Crawling Spike (Scout)

- BOJ `acmicpc.net/problem/1000`: HTTP 200 but returns "scoring service under maintenance" page — **shutdown confirmed**.
- Programmers `school.programmers.co.kr/learn/courses/30/lessons/{N}`: SSR confirmed, HTML received via httpx direct request.
  - Parseable fields: title (`.challenge-title`), difficulty (`[data-challenge-level]`), description (`div.markdown`), constraints, I/O example tables.

### Wave B — Group Analysis Context Injection (ai-analysis, Oracle direct)

| File | Change |
|------|--------|
| `src/config.py` | Added `problem_service_url` / `problem_service_key` env vars |
| `src/prompt.py` | `build_group_user_prompt()` — added `problem_title`/`problem_description` params, `<problem_context>` isolated block injection |
| `src/main.py` | `/group-analysis` endpoint — Problem Service query + fallback logic |
| `tests/test_prompt.py` | 5 new tests (context inject / no-inject / sanitize) |
| `tests/test_main.py` | 2 new tests (Problem Service success / failure scenarios) |

- Commit: `bd33185`
- Tests: 353 passed / coverage TOTAL **99%**

### Wave A — Programmers Crawler Module (problem, Oracle direct)

| File | Change |
|------|--------|
| `src/crawler/crawler.service.ts` | ALLOWED_HOSTS whitelist + axios+cheerio Programmers SSR parsing |
| `src/crawler/crawler.module.ts` | Module registration |
| `src/problem/problem.module.ts` | CrawlerModule import |
| `src/problem/problem.service.ts` | Async crawling trigger after `create()` (with `.catch()`) |
| `src/crawler/crawler.service.spec.ts` | 5 new tests (platform detection, parsing, error handling, SSRF blocking) |
| `src/problem/problem.service.spec.ts` | 2 new tests (crawling trigger, early return) |

- Commits: `d7b11ef`, `20a4f28` (coverage fix)
- Tests: 198 → 205 passed / Branches **96.47%** / Functions **98.61%**

### Critic Gate Findings Resolution (commit `95e34dd`)

| Severity | Finding | Fix |
|----------|---------|-----|
| **P1** SSRF | `crawler.service.ts` — unvalidated `sourceUrl` passed directly to axios | `ALLOWED_HOSTS` whitelist + `https:` protocol enforcement |
| **P2** envelope unwrap | `main.py` — `{data: problem}` response accessed directly for fields | `prob_data.get("data", prob_data)` unwrap before extraction |
| **P2** catch handler | `problem.service.ts` — fire-and-forget missing catch → unhandled rejection | Added `.catch()` with Error / non-Error branching |

### Security Patch (commit `86cc2ec`)

- `multer` 2.1.1 → **2.2.0** — CVE-2026-5079 (HIGH) security patch.

## Verification

- **CI**: 38 checks PASS / 0 FAIL
- **AI Analysis**: 353 passed · TOTAL 99% · main.py 100% · prompt.py 100%
- **Problem**: 205 passed · Statements 99.02% · Branches **96.47%** ≥ 96% · Functions **98.61%** ≥ 98% · Lines 99.13%
- **ESLint**: 0 errors (tsc pre-existing baseUrl deprecation at tsconfig.json:12 is a known issue from Sprint 246, unrelated to changes)
- **Critic (Codex gpt-5.5)**: All 3 findings (P1·P2·P2) resolved → **CLEAN**
- **PR #462** squash merge → `a7731fa` (2026-07-15T08:58:11Z)

## Lessons Learned

1. **Spike-first concretizes Wave A design.** BOJ shutdown was discovered via actual HTTP request rather than code analysis — this adjusted crawling scope from "BOJ+Programmers" to "Programmers only." Reconfirms the Sprint 243 pattern: "spike-first closes blockers cheaply."
2. **Reusing ADR-030 S-5 pattern ensures safe context injection.** Applying the same `<problem_context>` isolation block from individual analysis to group analysis automatically brought along prompt injection defenses — the value of security pattern reuse.
3. **SSRF is always the first checkpoint for any new crawler.** Critic flagged unvalidated `sourceUrl` as P1 — domain whitelist is a baseline requirement for any code that makes external URL requests.
4. **Missing catch on fire-and-forget is a perennial async pitfall.** The P2 `.catch()` finding highlights that testing only the success path misses unhandled rejections in the error path — async backfill patterns must always have a paired `.catch()`.
5. **Explicitly unwrap internal API response envelopes.** `{ data: problem }` structure accessed directly causes `undefined` errors — always verify internal API response shape before designing field access.

## Carry-over

- **Sprint 249** — Wave C: Copy `difficulty`/`level` to Submission entity + inject difficulty context into AI analysis prompt (rubric calibration). Wave D: Structure crawled data (I/O examples, constraints → separate fields) + inject structured data into prompts.
- **Ops**: aether-gitops needs new `PROBLEM_SERVICE_URL`/`INTERNAL_KEY_PROBLEM` SealedSecret for ai-analysis Wave B env vars. Existing `ANTHROPIC_API_KEY` SealedSecret validity check also pending (Sprint 247 carry-over).
- GA4 Enhanced Measurement OFF · GA4 production UAT · server redeploy + live SEO verification (ongoing carry-overs).
