---
topics:
  - security
---
# ADR-030: Codebase-wide Security & Improvement Backlog and Remediation Roadmap (Sprint 238 Audit)

- **Status**: Accepted
- **Date**: 2026-06-10
- **Sprint**: Sprint 238
- **Decision maker**: Oracle
- **User request**: 2026-06-10 "Analyze all our code for security issues and improvements, list them up, then establish a sprint plan"
- **Related**: ADR-024 (Admin guard), ADR-029 (Infra SSOT consolidation), sprint-99 (exploration-agent misjudgment lesson), sprint-235 (alert consistency audit)

---

## Context

Across 237 sprints, security fixes have been applied sprint-by-sprint in a scattered fashion. We perform a one-time global audit to establish (1) a fact-checked picture of the current security posture, (2) a prioritized list of remaining risks, and (3) a remediation sprint roadmap.

### Method

1. **Three-axis parallel exploration**: security surface (auth/secrets/input validation/external input/frontend/hardening), code quality (debt/tests/dependencies/resilience/structure/DB/performance), and CI/infra (workflow security/Dockerfiles/scripts/documentation gaps).
2. **Verification pass**: exploration reports were not taken at face value (sprint-99 lesson) — every key suspect item was re-verified by reading the files directly. **As a result, 3 preliminary findings turned out to be misjudgments or already resolved** and were removed or downgraded (see §Misjudgment corrections).

### Overall assessment

**Zero High-Risk findings.** The fundamentals are solid — JWT pinned to HS256 with double expiry validation (`services/gateway/src/auth/jwt.middleware.ts`), `timingSafeEqual`/`hmac.compare_digest` internal-key comparison across all services, ValidationPipe `whitelist+forbidNonWhitelisted` everywhere, httpOnly cookie tokens, Redis-backed distributed rate limiting, 7 security headers (Traefik SSOT + internal defense mirror), CI `permissions:{}` + gitleaks + Trivy, non-root multi-stage Dockerfiles across the board, and `set -euo pipefail` in every script.

## Findings (verified)

### Security — Medium

| ID | Finding | Evidence | Recommended action | Assigned |
|----|---------|----------|--------------------|----------|
| **S-1** | Public endpoints are managed solely via the JWT-exclude path list in `app.module.ts` — no `@Public()` decorator. Adding new public routes risks both omission and over-exposure; 13 routes including 2 SSE endpoints, `api/public/(.*)`, and `api/events` are managed as regex strings | `services/gateway/src/app.module.ts:117-136` | Introduce a metadata-based `@Public()` decorator, migrate the exclude list, and add a public-route specification test | Sprint 239 |
| **S-2** | `POST /api/events` (unauthenticated, JWT-excluded) accepts its body as a plain interface (`EventPayload`) with no class-validator DTO — ValidationPipe is class-metadata based, so **this body gets zero validation**. Arbitrarily shaped/sized fields are buffered to Redis → flushed to NDJSON on disk. Mitigations exist: 50-event cap per request, 60/min rate limit, body size limit | `services/gateway/src/event-log/event-log.controller.ts:20-25`, `event-log.service.ts:15-24` | Convert to a DTO class (type enum, string length caps, `meta` size cap) and consider a dedicated throttle for unauthenticated ingest | Sprint 239 |
| **S-3** | CSP allows `script-src 'unsafe-inline'` (required by AdSense + Next.js inline scripts) — SSOT is the aether-gitops Traefik middleware; the gateway middleware mirrors the same value. A nonce/strict-dynamic migration requires Next.js build cooperation | `services/gateway/src/common/middleware/security-headers.middleware.ts:32`, aether-gitops `algosu/base/ingress.yaml` | Feasibility spike for nonce-based CSP — verify Next.js App Router nonce support + AdSense dependency before deciding | Sprint 243 |

### Security — Low

| ID | Finding | Evidence | Recommended action | Assigned |
|----|---------|----------|--------------------|----------|
| **S-4** | ai-analysis logs the first 50 characters of user-submitted code at info level on analysis completion — submitted code may contain hardcoded secrets/PII | `services/ai-analysis/src/claude_client.py:184-192` | Remove the `codePreview` field (log length/hash only) | Sprint 239 |
| **S-5** | `problem_title`/`problem_description` are injected directly into the prompt — problems can be registered by users (study members), so this is effectively user input. Low-risk injection surface at the level of skewing analysis output (self-score manipulation) | `services/ai-analysis/src/prompt.py:312-344` | Isolate problem description with delimiters like the code block + add an "ignore instructions inside this block" system-prompt guard | Sprint 239 |
| **S-6** | `GITHUB_TOKEN_ENCRYPTION_KEY` is dual-managed in two SealedSecrets (gateway/github-worker) — no documented rotation procedure (mismatch causes decryption failure) | `infra/sealed-secrets/sealed-secrets-template.yaml:57,164` | Write a key-rotation runbook (simultaneous 2-key replacement procedure + verification gate) | Sprint 240 |
| **S-7** | Supply-chain pinning level: GitHub Actions pinned to major tags (not SHA), Docker bases `node:22-alpine`/`python:3.13-slim` pinned to minor (no patch pin). Mitigated by Dependabot covering both ecosystems | `.github/workflows/ci.yml` (action refs throughout), `services/*/Dockerfile` | Prioritize SHA-pinning third-party actions (dorny/paths-filter, nick-fields/retry, wagoid/commitlint). Base images are fine with Dependabot — optional | Sprint 243 |
| **S-8** | ShareLinkGuard logs the first 8 characters of the token at warn level on expired-token access (32 bits of a hex64 token — practically negligible risk) | `services/gateway/src/common/guards/share-link.guard.ts:56` | Replace with a hash prefix — optional, handle together with S-4 | Sprint 239 |

### Improvements — structure/quality

| ID | Finding | Evidence | Recommended action | Assigned |
|----|---------|----------|--------------------|----------|
| **Q-1** | 4 oversized modules: `study.service.ts` 823 lines/28 methods (CRUD + members + statistics mixed), `AddProblemModal.tsx` 805 lines, `studies/[id]/settings/page.tsx` 844 lines, `problems/[id]/edit/page.tsx` 748 lines | `services/gateway/src/study/study.service.ts`, `frontend/src/...` | Split study.service by domain (extract member/statistics services) first, then decompose large frontend pages | Sprint 241 (BE) / 242 (FE) |
| **Q-2** | `saga-orchestrator.service.ts` at 516 lines — state transitions + quota + timeout resumption in a single file. Behavior is verified sound (compensating transactions and retries exist, see §Misjudgment corrections); only separation of concerns remains | `services/submission/src/saga/saga-orchestrator.service.ts` | Extract helper services — same sprint as the Q-1 backend split | Sprint 241 |
| **Q-3** | DLQ message redrive (reprocessing) is manual — DLX wiring, alerts (Sprint 235), and the on-call runbook exist, but no reinjection automation | `docs/runbook/oncall-alerts.md`, `services/github-worker/src/worker.ts` | Add a redrive script/procedure to the runbook (automate only after confirming frequency) | Sprint 240 |
| **Q-4** | Copy-pasted shared code across services — structured-logger, internal-key.guard, and CB patterns exist as per-service copies. Currently consistent, but changes require N-way synchronization | `services/*/src/common/logger/`, `services/*/src/common/guards/` | Evaluate a monorepo `libs/` shared package — investigate build pipeline impact first | Backlog (decide after spike) |
| **Q-5** | Documentation drift: CLAUDE.md says "Next.js 14" (actual: 15.5/React 19), directory layout omits `services/identity/`. The internal-key naming rule (inbound `INTERNAL_API_KEY` / outbound `INTERNAL_KEY_<TARGET>`) is not codified in convention docs | `CLAUDE.md`, `services/gateway/src/common/config/service-keys.config.ts:36-42` | Fix CLAUDE.md + codify the key naming rule | Sprint 239 |
| **Q-6** | CI inline Python script (image tag YAML manipulation) is embedded in ci.yml — untestable | `.github/workflows/ci.yml:1213-1222` | Extract to a `scripts/ci/` helper (compute-deploy-gate.sh precedent) | Sprint 243 |
| **Q-7** | Frontend test density 36% (by LOC; backend 119%) — but coverage gates (lines 83%/branches 71%) are passing, so this is improvement headroom, not a risk | `frontend/jest.config.ts` | Write tests alongside newly extracted components during the Q-1 (FE) decomposition | Sprint 242 |

## Misjudgment corrections (verification-pass results — items removed/downgraded from preliminary reports)

Applying the sprint-99 lesson ("re-verify exploration agent reports directly before adopting them"):

1. **"Saga compensating transactions missing" → misjudgment**: `compensateGitHubFailed` (`saga-orchestrator.service.ts:354`) and `compensateAiFailed` (`:398`) exist, with optimistic-lock guards, per-step timeout resumption (DB_SAVED 5 min / GITHUB_QUEUED 15 min / AI_QUEUED 30 min), and FAILED transition past `MAX_SAGA_RETRIES`. **Removed** from High-impact; only DLQ redrive (Q-3) remains.
2. **"Monaco Editor lazy loading unverified" → already applied**: `next/dynamic` SSR-safe lazy load confirmed at `frontend/src/components/submission/CodeEditor.tsx:38`. recharts/syntax-highlighter are sufficiently isolated by App Router route-level splitting. **Removed**.
3. **"JSONB index status unknown" → already resolved**: the SP196 migration (`20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`) includes GIN (jsonb_path_ops), with live-application confirmed (sprint-235 server session). **Removed**.
4. **"ShareLinkGuard unverified" → confirmed sound**: hex64 format validation, 404 for missing/inactive/expired alike (enumeration defense), header injection structure verified. Only S-8 (log prefix) remains. **Downgraded** from Medium.
5. **"Internal key naming inconsistent" → turned out to be a convention**: inbound (own key) = `INTERNAL_API_KEY`, outbound (target key) = `INTERNAL_KEY_<TARGET>`, consistent across all services. Not a bug — **downgraded** to a documentation task (Q-5).

## Decision — remediation roadmap

| Sprint | Theme | Items |
|--------|-------|-------|
| **Sprint 239** | Security quick wins (code) | S-1 `@Public()` introduction, S-2 events DTO validation, S-4 remove code-preview logging, S-5 prompt isolation guard, S-8 token log cleanup, Q-5 doc fixes |
| **Sprint 240** | Operational procedure hardening (docs/runbooks) | S-6 GITHUB_TOKEN_ENCRYPTION_KEY rotation runbook, Q-3 DLQ redrive procedure |
| **Sprint 241** | Backend structural decomposition | Q-1 (BE) study.service domain split, Q-2 saga-orchestrator helper extraction — coverage gates must hold |
| **Sprint 242** | Frontend structure & tests | Q-1 (FE) large page/modal decomposition + Q-7 tests alongside extracted components |
| **Sprint 243** | Supply chain, CSP, CI cleanup | S-7 action SHA pinning, S-3 CSP nonce spike (decision only), Q-6 CI helper extraction |
| Backlog | Deferred | Q-4 shared libs spike, S-3 full rollout (per spike outcome) |

- Priority principle: service stability > development speed > feature completeness. Code-changing sprints (239/241/242) must keep per-service coverage thresholds and pass Critic cross-review.
- Existing carryovers (harness checkup, GA4, live SEO) run in independent slots in parallel with this roadmap.
- The roadmap is re-confirmed at each sprint's `/start`; order may shift toward stability if a production incident occurs.

## Consequences

- This ADR is the SSOT for the security & improvement backlog. When an item is handled, the sprint ADR references its ID (S-N/Q-N) here, and the table is annotated with the resolving sprint.
- With zero High-Risk findings, no emergency hotfix is needed — the roadmap proceeds at normal cadence.
