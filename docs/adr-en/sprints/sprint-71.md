---
sprint: 71
title: "Session Lifetime Mismatch Bug Fix + SessionPolicy Modularization (Feedback-Based)"
date: "2026-04-09 ~ 2026-04-10"
status: completed
agents: [Oracle, Gatekeeper, Palette, Herald, Scribe]
related_adrs: []
---

# Sprint 71: Session Lifetime Mismatch Bug Fix + SessionPolicy Modularization (Feedback-Based)

## Context

User feedback: "Sessions are too short. It's annoying to have to log in again when I come back from doing something else."

The planned JWT lifetime was **2 hours**, with tokens refreshing while the user was active — **sliding session** was the intended behavior. However, diagnosis revealed a **dual mismatch bug** across 4 layers:

1. **Production env `JWT_EXPIRES_IN=7d`** — Mismatch with planned value `2h`. Legacy value was embedded in Sealed Secret.
2. **`cookie.util.ts`'s `COOKIE_MAX_AGE_SECONDS=60*60` hardcoded** — Browser deletes cookie after 1 hour regardless of JWT TTL.
3. **`token-refresh.interceptor.ts`'s `REFRESH_THRESHOLD_SECONDS=5*60`** — Refresh only within 5 minutes of expiry → sliding effectively doesn't work even while user is active.
4. **`useSessionKeepAlive.ts`'s `SESSION_TIMEOUT_MS=65*60*1000`** — Frontend forces logout at 65 minutes, conflicting with the planned 2h JWT.

In other words, fixing any single layer would cause another layer to terminate the session. The state was **4 separate sources of truth (SSoT)**.

The initial diagnosis derived a foundation plan (D2~D4) for converting cookie.util.ts to JWT exp SSoT and hardcoding threshold/frontend timeout fixes, but PM feedback ("don't hardcode sessions, modularize") was accepted and Oracle extended it to an alpha design (new SessionPolicyModule + `GET /auth/session-policy` public endpoint). Unified the single source of truth to server env and restructured so both server and client read derived policy values.

## Decisions

### D1: JWT_EXPIRES_IN 7d → 2h
- **Context**: Legacy `7d` embedded in production Sealed Secret conflicted with planned value (`2h`). Token lifetime policy — not even a secret — was locked inside Sealed Secret, making changes unnecessarily difficult.
- **Choice**: Add `env: JWT_EXPIRES_IN: "2h"` block to Deployment in aether-gitops `algosu/base/gateway.yaml`, overriding envFrom (Sealed Secret) value using Kubernetes env override rule. Deployment `env:` takes precedence over `envFrom:`, allowing policy value changes without re-sealing.
- **Alternatives**: Re-seal Sealed Secret — requires `kubeseal` and restoring original plaintext `.env`. Token lifetime is not a secret so plaintext manifest management is structurally reasonable. Rejected.
- **Code Paths**: `aether-gitops:algosu/base/gateway.yaml` (commit `beb7f7d`)

### D2: Convert Cookie maxAge to JWT exp claim SSoT
- **Context**: `COOKIE_MAX_AGE_SECONDS=60*60` hardcoded value deletes browser cookie after 1 hour regardless of JWT TTL. Cookie TTL and JWT TTL were in a **dual source of truth** state.
- **Choice**: In `cookie.util.ts`, extract `exp` claim with `jsonwebtoken.decode` and dynamically calculate `maxAge = (exp * 1000) - Date.now()`. Defensive fallback `1h` + JSON structured log (`event: 'cookie_maxage_fallback'`) for missing exp/decode failure/already expired cases. Cookie maxAge auto-syncs whenever a new token is issued by sliding refresh.
- **Alternatives**: Parse `JWT_EXPIRES_IN` with `ConfigService` (`ms` library needed) — adds new dependency + maintains dual path ignoring JWT's own `exp`. Using JWT exp as SSoT is structurally safer.
- **Code Paths**: `services/gateway/src/auth/cookie.util.ts`, `services/gateway/src/auth/cookie.util.spec.ts`

### D3: Sliding refresh threshold 5 minutes → 60 minutes
- **Context**: Existing `REFRESH_THRESHOLD_SECONDS=5*60` (5 minutes) practically fails to implement the "reset session if user is active" policy. With 2h TTL, no refresh occurs for the first 1h 55m even when requests come in, so a user returning after 55 minutes of inactivity immediately gets logged out due to insufficient remaining time.
- **Choice**: Extend `REFRESH_THRESHOLD_SECONDS` to `60*60` (1 hour, 50% of TTL). From halfway through the 2h TTL, sliding refresh occurs per request → effectively infinite sliding for active users.
- **Alternatives**: Refresh on every request — JWT re-signing CPU overhead + Set-Cookie header on every response increases response size. 50% threshold is performance/UX tradeoff.
- **Code Paths**: `services/gateway/src/auth/token-refresh.interceptor.ts`, `services/gateway/src/auth/token-refresh.interceptor.spec.ts`
- **Note**: → Re-implemented with SessionPolicyService injection in 71-1R. Hardcoded constant removed.

### D4: Frontend SESSION_TIMEOUT_MS 65 minutes → 125 minutes
- **Context**: Frontend heartbeat forces logout judgment at 65 minutes → conflicts with planned 2h JWT (frontend terminates session before server).
- **Choice**: Extend `SESSION_TIMEOUT_MS = 125 * 60 * 1000` (2h + 5 minute buffer). With heartbeat at 10-minute intervals, 12+ sliding refresh opportunities provided. 5-minute buffer prevents race where frontend timer expires immediately after server sliding refresh.
- **Alternatives**: Rely only on server 401 response and remove client timeout — would lose detection UX when offline/network disconnected (session quietly terminates without last-activity modal). Keeping heartbeat is safer.
- **Code Paths**: `frontend/src/hooks/useSessionKeepAlive.ts`
- **Note**: → Converted to server policy fetch in 71-2R, keeping only `DEFAULT_SESSION_POLICY` fallback. Hardcoded constant removed.

### D5: Keep demo user 2h hardcoding
- **Context**: `'2h'` hardcoding exists in `oauth.service.ts:466` for demo user JWT issuance, which coincidentally matches Sprint 71 planned value (2h).
- **Choice**: Maintain for this sprint. Unifying to reuse `JWT_EXPIRES_IN` env will be a separate refactoring task.
- **Alternatives**: Unify immediately — demo account-specific policy (e.g., demo is 30 minutes) may be required in the future, so conservatively keep separate.
- **Code Paths**: `services/gateway/src/auth/oauth.service.ts:466` (no change in this sprint)
- **Note**: → Separated to `JWT_DEMO_EXPIRES_IN` env in 71-1R with SessionPolicyService parsing. Extended to structure allowing separate policy (e.g., 30 minutes) for demo.

### D6: SessionPolicyModule introduction + public endpoint (alpha design)
- **Context**: The initial plan (D2~D4) was merely replacing hardcoded constants with different values. The risk of synchronization failure across server (env), Gateway code constants, and Frontend constants remained. PM feedback ("don't hardcode sessions, modularize") prompted Oracle to redesign. Fundamental treatment requires an architecture where all policy values are derived from a single server SSoT.
- **Choice**: Create new `SessionPolicyModule` (service + controller + spec) in Gateway. Parse 5 env vars (`JWT_EXPIRES_IN`, `JWT_DEMO_EXPIRES_IN`, `SESSION_REFRESH_THRESHOLD`, `SESSION_HEARTBEAT_INTERVAL`, `SESSION_TIMEOUT_BUFFER`) in milliseconds as single SSoT. Built-in duration parser (`Nh|Nm|Ns|Nms|Nd`) to avoid direct `ms` package dependency (maintain transitive-only status). Provide `{ accessTokenTtlMs, heartbeatIntervalMs, sessionTimeoutMs, refreshThresholdMs }` DTO to client via public endpoint `GET /auth/session-policy`. Convert all consumers (JwtModule, OAuthService, TokenRefreshInterceptor) to inject SessionPolicyService.
- **Alternatives**:
  - `NEXT_PUBLIC_*` build-time injection — Sprint 65 G1 (`NEXT_PUBLIC_` build-time inline risk) recurrence concern. Cannot separate build-time from runtime values.
  - Constants file (`session-policy.constants.ts`) — no env integration, not a fundamental solution. Rejected.
  - Direct `ms` package dependency — currently transitive-only, relying on hoisting. Harder to fail-fast on missing parser, so self-parser is safer.
- **Code Paths**:
  - `services/gateway/src/auth/session-policy/session-policy.module.ts`
  - `services/gateway/src/auth/session-policy/session-policy.service.ts`
  - `services/gateway/src/auth/session-policy/session-policy.controller.ts`
  - `services/gateway/src/auth/session-policy/session-policy.service.spec.ts`
  - `services/gateway/src/auth/auth.module.ts` (JwtModule.registerAsync)
  - `services/gateway/src/auth/oauth/oauth.module.ts`, `oauth.service.ts`, `oauth.service.spec.ts`
  - `services/gateway/src/auth/token-refresh.interceptor.ts`, `token-refresh.interceptor.spec.ts`
  - `services/gateway/src/app.module.ts` (JwtMiddleware exclude — `/auth/session-policy` public)
  - `frontend/src/lib/session-policy.ts` (new)
  - `frontend/src/lib/__tests__/session-policy.test.ts` (new)
  - `frontend/src/contexts/AuthContext.tsx` (sessionPolicy state + app init fetch)
  - `frontend/src/hooks/useSessionKeepAlive.ts` (remove hardcoding, receive policy prop)
  - `aether-gitops:algosu/base/gateway.yaml` (5 env vars, commits `beb7f7d` + `9c6968f`)

## Patterns

### P1: JWT exp claim as SSoT for downstream state
- **Where**: `services/gateway/src/auth/cookie.util.ts`
- **When to Reuse**: When there's a JWT token and supplementary state tied to it (Cookie maxAge, frontend session timer, cache TTL, reconnect timer, etc.). Using `jsonwebtoken.decode(token).exp` as SSoT instead of separate constants/env means changing the TTL policy only requires updating one place (token issuance point) and derived state auto-syncs. Defensive fallback + structured log for derived calculation failures is essential.

### P2: Server → client policy value propagation pipeline
- **Where**: `services/gateway/src/auth/session-policy/`, `frontend/src/lib/session-policy.ts`
- **When to Reuse**: When policy values controlled by server env (session, rate limit, feature flags, etc.) also need to be known by the client. Place Policy Service on server to parse env as SSoT, expose DTO via public `GET` endpoint, client fetches once at app boot + `DEFAULT_*` fallback for boot stability. Runtime propagation method that avoids `NEXT_PUBLIC_*` build-time injection. Implement parser in-house rather than using external package for fail-fast guarantee.

## Gotchas

### G1: Hardcoded constants bypassing env vars create duplicate SSoT
- **Symptom**: No matter how `JWT_EXPIRES_IN` env is changed to `2h`/`7d`/any value, browser always deletes cookie after exactly 1 hour. User reproduces: "I set it to 2 hours but got logged out after 1 hour."
- **Root Cause**: `COOKIE_MAX_AGE_SECONDS = 60 * 60` hardcoded constant in `cookie.util.ts` makes no reference to `JWT_EXPIRES_IN` env. Token lifetime and cookie lifetime are in a **structurally separated dual SSoT** state.
- **Fix**: Elevate the source of derived state from env to the token itself (JWT `exp` claim) to unify SSoT.
- **Lesson**: Don't place constants with "coincidentally same meaning" near policy values controlled by env vars. If they share the same semantic, they must reference the same source of truth. Any point where changing one env var doesn't cascade to related state is the seed of the next bug.

### G2: Non-secret policy values inside Sealed Secret
- **Symptom**: Token lifetime policy like `JWT_EXPIRES_IN` stored encrypted in Sealed Secret, requiring `kubeseal` + original plaintext `.env` restoration procedure to modify. Unnecessarily high change barrier.
- **Root Cause**: Initial env var configuration sealed entire `.env` into Sealed Secret. Bundled without distinguishing secrets from non-secrets.
- **Fix (this sprint)**: Use Kubernetes rule where Deployment `env:` block overrides `envFrom:` (Sealed Secret) to change policy value without re-sealing.
- **Lesson**: Manage non-secret policy values (TTL, feature flags, thresholds) with ConfigMap or Deployment `env:`. Use Sealed Secret only for true secrets (JWT signing key, DB password, API token). At initial design stage, use "would exposure of this value be a security problem?" as the separation criterion.

### G3: Recurring structure of hardcoded policy values
- **Symptom**: When constants with the same meaning as env-controlled policies (e.g., JWT TTL) — like `REFRESH_THRESHOLD_SECONDS`, `SESSION_TIMEOUT_MS`, demo `'2h'` literal — are scattered in code, changing just env creates "silent mismatch" bugs where behavior doesn't change. Even the Sprint 71 initial plan (D2~D4) only replaced constant values, leaving recurrence risk.
- **Root Cause**: "Constant" as a mental habit omits env integration. When config injection path (Config/Policy Service) is not established at initial implementation, developers start with local constants and leave them as-is.
- **Fix**: Unify all points expressing policy values to "policy service injection". When constant literals (number × unit form) appear with `*policy*`, `*session*`, `*ttl*`, `*timeout*` etc., raise alert at review. Sprint 71 alpha design (D6) introduced SessionPolicyModule for structural cleanup.
- **Lesson**: When adding env vars, "search consumers → grep similar-meaning constants → list conversion scope in PR" checklist needed. Replacing constants instead of converting to injection structure at once allows same bug to recur.

## Metrics
- **Commits (AlgoSu)**: Pending aggregation (Oracle batch commit planned)
- **Commits (aether-gitops)**: 2
  - `beb7f7d` — gateway.yaml `JWT_EXPIRES_IN` env override
  - `9c6968f` — SessionPolicy env 4 additions (`JWT_DEMO_EXPIRES_IN`, `SESSION_REFRESH_THRESHOLD`, `SESSION_HEARTBEAT_INTERVAL`, `SESSION_TIMEOUT_BUFFER`)
- **Files changed (AlgoSu)**: Total **19 files**
  - **Gateway (14 files)**:
    - New 4: `session-policy/session-policy.module.ts`, `session-policy.service.ts`, `session-policy.controller.ts`, `session-policy.service.spec.ts`
    - 71-1 original 2: `auth/cookie.util.ts`, `auth/cookie.util.spec.ts`
    - Modified 8: `auth/auth.module.ts`, `auth/oauth/oauth.module.ts`, `auth/oauth.service.ts`, `auth/oauth.service.spec.ts`, `auth/token-refresh.interceptor.ts`, `auth/token-refresh.interceptor.spec.ts`, `app.module.ts` (JwtMiddleware exclude), `main.ts` (if needed)
  - **Frontend (4 files)**:
    - New 2: `src/lib/session-policy.ts`, `src/lib/__tests__/session-policy.test.ts`
    - Modified 2: `src/hooks/useSessionKeepAlive.ts`, `src/contexts/AuthContext.tsx`
  - **Documentation (1 file)**: `docs/adr/sprints/sprint-71.md` (this file)
- **Files changed (aether-gitops)**: 1 (`algosu/base/gateway.yaml`)
- **Tests**: Gateway 47 suites / 688 tests pass (8 new session-policy), Frontend 110 suites / 1135 tests pass (16 new session-policy)
- **New external dependencies**: None (`ms` package remains existing transitive state, self-implemented duration parser. `jsonwebtoken` already in use in Gateway)

## Follow-up Recommendations (outside Sprint 71 scope)

Add to MEMORY.md follow-up section:

- **aether-gitops `algosu/base/sealed-gateway-secrets.yaml` orphan file cleanup** — Found by Herald 71-3. Sealed Secret manifest not referenced anywhere.
- **Remove `JWT_EXPIRES_IN` key from Sealed Secret** — kubeseal re-sealing task. Currently neutralized by Deployment env override, but fundamentally non-secret keys should be excluded from Sealed Secret.
- **Integrate `cookie.util.ts` fallback logging with `StructuredLoggerService`** — Currently using `console.warn` + JSON payload direct output for lightweight logging. Refactoring needed for alignment with production log pipeline.
- **Formal Refresh Token + Redis introduction review (long-term)** — Current sliding refresh re-signs single JWT. Long-term task for Refresh Token separation + server-side session revoke capability.
- **Reuse `SessionPolicyModule` pattern for other policy values** — Review applying same pipeline (env → PolicyService → public GET DTO → client fetch) to policy values currently scattered as code constants: rate limit, circuit breaker thresholds, upload size limits, etc.
- **`GET /auth/session-policy` response caching (SWR/ETag) — long-term** — Currently sufficient with one fetch at app boot, but if policy becomes runtime-changeable (e.g., admin UI adjusts TTL), need SWR/ETag-based refresh strategy.
- **`JWT_EXPIRES_IN` Sealed Secret legacy value (`7d`) cleanup** — Currently hidden by Deployment env override, but recommend fundamental removal via kubeseal re-sealing. Perform alongside rebuilding sealing procedure.
