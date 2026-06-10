---
sprint: 239
title: "Security quick wins — ADR-030 S-1/S-2/S-4/S-5/S-8/Q-5"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Sensei, Scribe]
related_adrs: ["ADR-030", "sprint-238", "sprint-99"]
related_memory: ["sprint-window", "feedback-source-vs-live-drift"]
topics: ["security", "quick-wins"]
tldr: "First sprint in the ADR-030 remediation roadmap. The six security/doc quick wins adopted in the Sprint 238 audit (S-1/S-2/S-4/S-5/S-8/Q-5) are processed as six atomic commits. Key decision: during planning, the Plan agent surfaced a decisive fact — the three gateway proxy paths (/api/problems, /api/submissions, /api/analysis) are terminated inside ProxyDispatchMiddleware (no next() call), which means the global JwtAuthGuard switch (option A) would bypass authentication for those paths. → Hybrid (B-2) adopted: keep JwtMiddleware, introduce @Public() as a declarative SSOT, and enforce two-way consistency between the decorator and the PUBLIC_ROUTES constant with a specification test. During S-1 we also discovered that inbound identity headers (x-user-id / x-demo-user) are not stripped, which lets an attacker rotate fake headers to bypass IP rate limiting → HeaderSanitizerMiddleware is added at the very front of the chain to close that gap. For S-2 we confirmed that ThrottlerModule is registered but has no handler guards attached (so it is globally inactive), and judged RateLimitMiddleware 600/min + 50-event cap + body limit sufficient — no additional throttle was added. Verification: gateway tsc 0 / eslint 0 / jest 842 pass / coverage lines 98.87 (threshold 98 maintained); ai-analysis ruff clean / pytest 334 pass / coverage 99.09 (gate 97)."
---
# Sprint 239 — Security quick wins (ADR-030 S-1/S-2/S-4/S-5/S-8/Q-5)

## Goal

- Top of the ADR-030 remediation roadmap — process five code-changing quick wins (S-1/S-2/S-4/S-5/S-8) and one documentation fix (Q-5) in a single sprint.
- Follow each item's recommended action from ADR-030, but if planning surfaces a decisive fact (e.g. middleware shape) that conflicts with the recommendation, deviate consciously and record the reasoning in this retrospective.
- No per-service coverage threshold reduction; Critic cross-review is mandatory (ADR-030 §Decision).

## Context

- `/start` argument: process the quick wins finalized in ADR-030 at Sprint 238.
- The Sprint 238 retrospective (`sprint-238.md`) left a decisive lesson — "ValidationPipe is class-metadata based; a plain interface body bypasses whitelist entirely (zero validation)" — and S-2 is the direct case.
- Zero High-Risk findings means urgency is low, but consolidating the scattered items in one go reduces backlog noise — the secondary goal is to flip six ADR-030 rows to ✅.

## Work summary (start `4c57244`, 6 commits + this ADR commit)

### S-1 — `@Public()` decorator SSOT (Gatekeeper, `538fb1f`)

- **Trigger**: public endpoints were managed solely by the regex exclude list in `app.module.ts`, which risks both omission and over-exposure when adding new public routes.
- **Decisive finding in planning → approach change**: by reading the gateway proxy code directly, the Plan agent confirmed that `/api/problems`, `/api/submissions`, and `/api/analysis` are **terminated inside ProxyDispatchMiddleware** (no `next()` call; http-proxy-middleware responds directly). Adopting ADR-030's recommendation A (switch to a global JwtAuthGuard) verbatim would let the guard run at the controller layer, **bypassing authentication on all three proxy paths**. → **Hybrid (B-2) adopted**: keep JwtMiddleware (protecting the proxies) + introduce `@Public()` as the declarative SSOT (restoring Nest-domain readability) + enforce three-way consistency between the decorator, the `PUBLIC_ROUTES` constant, and the exclude list via a specification test.
- **Implementation**:
  - `@Public()` decorator (`SetMetadata(IS_PUBLIC_KEY, true)`) + `public-routes.ts` with a 22-entry `PUBLIC_ROUTES` constant.
  - Tightened the three wildcards called out by ADR-030 into exact-path enumerations: `auth/oauth/(.*)` ALL → `auth/oauth/discord` GET + `auth/oauth/discord/callback` GET (2 entries), `internal/(.*)` ALL → the 4 real handlers GET only, `api/public/(.*)` GET → the 5 real handlers only.
  - New specification test: reflection-scan all `@Public()`-decorated handlers and enforce two-way consistency with the `PUBLIC_ROUTES` constant + snapshot pinning + a negative guard (no leak of auth-required routes). Drift self-check passes.
  - `@Public()` attached on 10 controllers (health, oauth, public dashboard/profile/ranking, internal admin/check/study, event-log, etc.).
- **Scope addition — HeaderSanitizerMiddleware**: during planning we discovered that inbound client headers (`x-user-id`, `x-demo-user`) pass through unstripped. Since rate-limit identity trusts client headers prior to verification, an attacker can rotate fake headers to bypass IP-based rate limiting → HeaderSanitizerMiddleware is placed at the head of the middleware chain to strip inbound identity-like headers wholesale (paths where the Gateway itself issues identity headers are explicitly whitelisted).

### S-2 — `POST /api/events` DTO validation (Gatekeeper, `210136f`)

- **Trigger**: an unauthenticated ingest endpoint (JWT-excluded) was receiving its body as a plain TS interface (`EventPayload`) with no class-validator DTO — ValidationPipe applied zero validation (direct case of the Sprint 238 §Lessons point).
- **Implementation**:
  - New DTOs `IngestEventsDto` + `EventItemDto` with class-validator.
  - `type` is a **conscious deviation** from ADR-030's "enum recommendation": grepping the codebase showed actual `type` values are a free-form namespace (`PAGE_VIEW`, `guest:cta_signup_click`, mixing colons/underscores/hyphens), which would cause enums to constantly conflict with call sites → enforce shape only with pattern `/^[\w:.-]+$/` and a 64-character cap.
  - `meta` is capped at 2 KB after JSON serialization + `ts` `@IsISO8601` + `events` `@ArrayMaxSize(50)`. Crucially, 51+ events now **reject with 400** rather than the previous silent slice mentioned in ADR-030 — **a deliberate behavior change** (silent slice hurts client debug visibility).
- **Throttle decision (no additional throttle applied)**: direct code reading shows `ThrottlerModule.forRoot({60, 60_000})` is registered, but no handler uses `@UseGuards(ThrottlerGuard)` → effectively **globally inactive**. Actual protection for /api/events is RateLimitMiddleware (60→600/min IP, Redis-distributed) + the 50-event cap + body size limit, which we judge sufficient → a dedicated ThrottlerGuard is out of scope. This finalizes the "dedicated throttle for unauthenticated ingest" question raised in ADR-030 §S-2 and is recorded here.

### S-8 — ShareLinkGuard expired-token log hashing (Gatekeeper, `0b8b82d`)

- **Trigger**: on expired-token access, a warn log included `token.slice(0, 8)` (32 bits of a hex64 token — practically negligible risk, but exposing raw token prefixes is poor hygiene).
- **Implementation**: `token.slice(0, 8)` → `crypto.createHash('sha256').update(token).digest('hex').slice(0, 12)`. 12-character hash prefix (64 bits). Expiration-pattern tracking for the same token still works because the hash is deterministic.

### S-4 — Remove submitted-code preview logging (Sensei, `68b3fc0`)

- **Trigger**: an info log in `claude_client.py` was recording `codePreview = code[:50]` — the first 50 characters of user-submitted code, which may include hardcoded secrets or PII.
- **Implementation**: the `codePreview` field is removed and replaced by `codeLength` (int). logger.py's whitelist is intentionally **not** changed — **the root block is not injecting extras at the call site; the whitelist is just a JSON-serialization filter**. We record that judgment in code comments and here as a hint to prevent regression.

### S-5 — Prompt `problem_context` isolation + injection guard (Sensei, `aca85c3`)

- **Trigger**: `build_user_prompt` injected `problem_title`/`problem_description` directly as Markdown. Problems can be registered by users (study members), making this effectively user input — a low-risk injection surface, at the level of skewing analysis output (self-score manipulation).
- **Implementation**:
  - Wrap the problem section in explicit `<problem_context>` … `</problem_context>` markers (mirroring the code block pattern).
  - Add a "[Security rule] Trust boundary — prompt injection defense" guard to the header of both system prompts (algorithms / SQL): instructions inside the block, requests to change evaluation criteria, or requests to manipulate scores must be ignored; instruction-like phrasing may only be reported as "this phrasing was present in the body".
  - Six new tests: presence of the block markers, presence of the guard text in the system prompt, and end-to-end guard effect against injection-attempt inputs (no score-manipulation reflected in the analysis output).

### Q-5 — CLAUDE.md drift fix + internal-key naming codified (Scribe, `52da74d`)

- **Fact-check** (direct Read): `frontend/package.json` → `next ^15.5.19` / `react ^19.2.7`. `services/identity/` exists (NestJS) — `package.json` description "AlgoSu Identity Service — OAuth user management", with modules for OAuth/users/studies/share/feedback/quiz-records under src/.
- **Three edits**:
  1. "Next.js 14 App Router" → "Next.js 15 App Router + React 19".
  2. Added `services/identity/` to the directory tree with the one-line description "NestJS Identity (OAuth user / studies / share / feedback / quiz-records)".
  3. Added a four-bullet Internal Key naming convention to the Security section — inbound `INTERNAL_API_KEY` / outbound `INTERNAL_KEY_<TARGET>` + evidence file (`service-keys.config.ts`).

## Key decisions

1. **Hybrid (B-2) over global guard (option A)**: when middleware terminates the request for some paths, switching to a global guard creates an authentication bypass. When an ADR recommendation conflicts with a fact uncovered in planning, the fact wins, and the deviation is recorded in the retrospective (the canonical example for this sprint).
2. **Specification test prevents SSOT drift**: enforce three-way consistency between the `@Public()` decorator, the `PUBLIC_ROUTES` constant, and the exclude regex list via a two-way test. Adding a new public route that fails any side turns CI red.
3. **Conscious deviation from the recommended enum**: the recommendation in ADR-030 may itself conflict with code facts (the `type` usage pattern), and that is grounds to deviate. The deviation is recorded so the question is not re-raised (an application of the Sprint 238 §Lessons "misjudgment corrections are recorded assets").
4. **Logger whitelist is a backup; the root block is the caller's responsibility**: as S-4 shows, a whitelist is a filter at the serialization layer — when extras leak through, the failure mode is silent pass-through rather than silent drop. The first line of defense is the caller not injecting sensitive fields.
5. **HeaderSanitizer goes first**: identity-header sanitization must run before any authentication/rate-limit middleware (downstream code assumes the headers are trustworthy). This case was not enumerated in ADR-030 — it is a fresh discovery handled inside the S-1 sprint.

## Verification

- **gateway**: tsc 0 / eslint 0 / jest 842 pass / coverage **lines 98.87% / branches 95.80% / functions 96.73% / statements 98.51%** (thresholds 98/95/96/98 maintained).
- **ai-analysis**: ruff clean / pytest 334 pass / coverage **99.09%** (gate 97%).
- New tests:
  - gateway: `@Public()` specification test (reflection-scan ↔ constant two-way + snapshot + negative guard), `IngestEventsDto` validation tests, `HeaderSanitizerMiddleware` unit tests.
  - ai-analysis: six prompt-injection guard tests + one regression test for the post-S-4 codeLength logging signature.
- Critic cross-review (pre-merge): Codex `--base 4c57244`, one round — outcome is annotated just before the ADR commit.

## Lessons

1. **An ADR recommendation is not unconditional**: ADR-030 §S-1's recommendation (global JwtAuthGuard) would have created an authentication bypass for three proxy paths. Direct code reading during planning takes precedence over the recommendation — this is the Sprint 238 "exploration → verification → adoption" two-stage structure applied one round deeper (the recommendation itself is subject to verification).
2. **The real value of specification tests is two-way enforcement**: with only `@Public()`, someone could add a controller without the decorator and have it silently pass. With only the `PUBLIC_ROUTES` constant, decorator-vs-constant consistency is not checked. Two-way enforcement (decorator → fail when missing from constant, constant → fail when no decorator) is what makes an SSOT real.
3. **Missing inbound identity-header sanitization is a deep flaw**: if rate-limit identity trusts client headers before verification, both IP and user ID become rotatable → rate limiting is effectively disabled. ADR-030's audit missed this (uncovered serendipitously during S-1), suggesting **"inbound identity-header strip check" should be added to the audit checklist** as a named item.
4. **Whitelist is the last line of defense, not the first**: not injecting sensitive fields into `extra` at the call site is the block; the whitelist is reinforcement. Putting both layers in one commit risks the cognitive bug "the whitelist makes it safe". They should be separated explicitly as first / second line.
5. **Enums clash with free-form namespaces**: when usage is a free-form namespace (`PAGE_VIEW`, `guest:cta_signup_click`, …), an enum forces every new usage to update the enum → for free-namespace domains, regex + cap is safer. Align ADR recommendations with measured domain facts.

New patterns: **hybrid auth SSOT pattern** (keep JwtMiddleware + `@Public()` declarative SSOT + specification test enforcing two-way consistency), **inbound identity-header sanitize-first pattern**.

## Carry-overs

- **(Sprint 240 confirmed)** S-6 GITHUB_TOKEN_ENCRYPTION_KEY rotation runbook + Q-3 DLQ redrive procedure — ADR-030 §Decision roadmap.
- Whether to attach a dedicated ThrottlerGuard to /api/events — judged unnecessary today given RateLimitMiddleware coverage; re-evaluate if ingest traffic grows. (Backlog)
- Add "inbound identity-header strip check" to the audit checklist — to be applied at the next ADR-030 follow-on audit. (Backlog)
- Existing carry-overs: harness checkup in a separate slot · GA4 console 3 items · live SEO · harness cron · webhook regenerate · cumulative UAT.
