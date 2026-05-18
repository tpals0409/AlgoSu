---
sprint: 48
title: "Guest Mode & Public Profile"
date: "2026-03-10"
status: completed
---
# Sprint 48 — Guest Mode & Public Profile

## Oracle Verdict: APPROVED
- Date: 2026-03-10
- Priority: Service Stability > Dev Speed > Feature Completeness
- Scope: Share Links + Guest Study Room + Public Profile + Settings Extension
- Duration: 3 weeks (W1 Backend → W2 Frontend → W3 QA+Deploy)

---

## Executive Summary

| Item | Current State | Goal | Gap |
|------|-----------|------|-----|
| Study room access | Members only (StudyMemberGuard) | Guest read access via share link | Guard bypass + new token system |
| Profile visibility | None | `/profile/{slug}` public page | New entity+API+page |
| Settings | Not implemented | Profile visibility + slug settings | New Settings page |
| Anonymization | None | Anonymize other members in guest view | New frontend logic |

**Estimated Impact**: ~45-55 files (new ~25, modified ~20, tests ~15)

---

## PM Confirmed Requirements

### Functional Requirements
1. **Share Link**: Token-based URL (`/shared/{token}`), no login required
2. **Guest Access Scope**: Problem list + submission status + AI analysis + source code (full read-only)
3. **Expiry**: Indefinite (default) + optional expiry setting
4. **Creation Permission**: Any study member
5. **Anonymization**: Other members shown as random nicknames (adjective+noun, e.g., `Brave Explorer`)
6. **Public Profile**: Private by default, enabled via Settings
7. **Profile URL**: `/profile/{slug}` (user-set, lowercase letters+numbers+hyphens, 3~20 chars, freely changeable)
8. **Profile Display Info**: Name, avatar, list of joined studies, total submissions, average AI score, share link per study
9. **Guest Actions**: Completely read-only (all writes/interactions blocked)
10. **Visit Statistics**: Not required (MVP)
11. **Share Link Management UI**: Placed on personal profile page
12. **Public Profile Settings UI**: Placed on Settings page

---

## Dependency Graph

```
W1-1 DB Migration (share_links table + users columns)
  |
  +---> W1-2 ShareLink CRUD API (Gateway)
  |       |
  |       +---> W1-3 Guest Guard + Public Endpoints
  |
  +---> W1-4 Public Profile API (slug lookup, stats aggregation)
  |
  +---> W1-5 Settings API (slug setting, profile visibility toggle)
  |
  v
W2-1 Guest Study Room View (read-only + anonymization)
  |
W2-2 Public Profile Page
  |
W2-3 Settings Page (profile visibility + slug)
  |
W2-4 Share Link Management UI (within profile page)
  |
  v
W3-1 Backend Tests
  |
W3-2 Frontend Tests
  |
W3-3 Integration QA + Security Review
  |
W3-4 CI/CD Deploy
```

---

## Detailed Task Breakdown

### Wave 1: Backend Foundation (Week 1)

#### W1-1: DB Migration
- **Agent**: Architect
- **Risk**: LOW
- **Files**:
  - `services/gateway/src/database/migrations/XXXXXX-CreateShareLinksTable.ts`
  - `services/gateway/src/database/migrations/XXXXXX-AddProfileFieldsToUsers.ts`
- **Key Changes**:
  - Create new `share_links` table:
    ```
    id: UUID (PK)
    token: VARCHAR(64) (unique, index) — crypto.randomBytes(32).toString('hex')
    study_id: UUID (FK → studies.id)
    created_by: UUID (FK → users.id) — link creator
    expires_at: TIMESTAMP | NULL — NULL means indefinite
    is_active: BOOLEAN (default: true)
    created_at: TIMESTAMP
    updated_at: TIMESTAMP
    ```
  - Add columns to `users` table:
    ```
    profile_slug: VARCHAR(20) | NULL (unique, index) — custom profile URL
    is_profile_public: BOOLEAN (default: false) — profile visibility
    ```
- **Acceptance Criteria**:
  - Migration up/down works correctly
  - Indexes: `token` unique, `profile_slug` unique, `study_id` regular
  - NULL-allowed fields clearly distinguished
- **Rollback**: Revert migration

#### W1-2: ShareLink CRUD API
- **Agent**: Postman
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/share-link.entity.ts`
  - `services/gateway/src/share/share-link.service.ts`
  - `services/gateway/src/share/share-link.controller.ts`
  - `services/gateway/src/share/share-link.module.ts`
  - `services/gateway/src/share/dto/*.ts`
- **Key Changes**:
  - ShareLink entity + repository
  - CRUD endpoints (authentication required, StudyMemberGuard applied):
    ```
    POST   /api/studies/:studyId/share-links          — Create (member)
    GET    /api/studies/:studyId/share-links           — List (member)
    DELETE /api/studies/:studyId/share-links/:linkId   — Deactivate (creator or admin)
    ```
  - Create options: `{ expiresAt?: ISO8601 }`
  - Token generation: `crypto.randomBytes(32).toString('hex')`
- **Acceptance Criteria**:
  - CRUD accessible only by members
  - Expired links automatically filtered on lookup
  - Delete is soft delete (is_active = false)
- **Rollback**: Remove module + revert migration

#### W1-3: Guest Guard + Public Endpoints
- **Agent**: Gatekeeper
- **Risk**: HIGH
- **Files**:
  - `services/gateway/src/common/guards/share-link.guard.ts`
  - `services/gateway/src/share/public-share.controller.ts`
  - `services/gateway/src/auth/jwt.middleware.ts` (modified — exclude public paths)
  - `services/problem/src/common/guards/share-link.guard.ts`
  - `services/submission/src/common/guards/share-link.guard.ts`
- **Key Changes**:
  - `ShareLinkGuard`: validate token validity + expiry + active status
  - Add public paths to JWT middleware `ignoreTokenUrl`:
    ```
    /api/public/shared/:token          — Share link meta (study info)
    /api/public/shared/:token/problems — Problem list
    /api/public/shared/:token/submissions — Submission list
    /api/public/shared/:token/analysis/:submissionId — AI analysis result
    /api/public/profile/:slug          — Public profile
    ```
  - Public endpoints have no write API at all (GET only)
  - Add ShareLinkGuard to downstream services (Problem, Submission) or handle via Gateway proxy
- **Acceptance Criteria**:
  - Valid token: 200 + data returned
  - Expired/inactive/non-existent token: 404 (prevent information leakage, not 403)
  - Write operations blocked on public endpoints
  - No impact on existing authenticated paths
- **Rollback**: Remove Guard + Controller, restore ignoreTokenUrl

#### W1-4: Public Profile API
- **Agent**: Postman
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/public-profile.controller.ts`
  - `services/gateway/src/share/public-profile.service.ts`
- **Key Changes**:
  - Public endpoint (no authentication required):
    ```
    GET /api/public/profile/:slug
    ```
  - Response data:
    ```json
    {
      "name": "User Name",
      "avatarUrl": "preset:tree",
      "studies": [
        {
          "studyName": "Algorithm Study",
          "memberCount": 5,
          "shareLink": "/shared/{token}" | null,
          "totalSubmissions": 42,
          "averageAiScore": 78.5
        }
      ],
      "totalSubmissions": 120,
      "averageAiScore": 82.3
    }
    ```
  - Per-study stats: aggregate only the user's own submissions (exclude other members' data)
  - `is_profile_public = false`: return 404
  - Per-study share link: first active+valid link created by that user
- **Acceptance Criteria**:
  - Non-existent slug or private profile: 404
  - Stats query performance: confirm index usage
  - No sensitive info exposed (email, github_token, etc.)
- **Rollback**: Remove Controller + Service

#### W1-5: Settings API (Profile Visibility + Slug)
- **Agent**: Postman
- **Risk**: LOW
- **Files**:
  - `services/gateway/src/auth/oauth/user.entity.ts` (modified — add columns)
  - `services/gateway/src/user/user.controller.ts` (modified or new)
  - `services/gateway/src/user/dto/update-profile-settings.dto.ts`
- **Key Changes**:
  - Authentication-required endpoints:
    ```
    GET  /api/users/me/settings          — Get current settings
    PUT  /api/users/me/settings/profile  — Update profile visibility + slug
    ```
  - Slug validation:
    - Regex: `/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/` (3~20 chars, lowercase+numbers+hyphens, no leading/trailing hyphens)
    - Duplicate check: unique constraint + service-level validation
    - Reserved word blocking: `admin`, `api`, `public`, `shared`, `login`, `settings`, `profile`, etc.
  - `is_profile_public` toggle: true/false
  - Cannot set public without slug (slug is prerequisite)
- **Acceptance Criteria**:
  - Duplicate slug: 409 Conflict
  - Invalid slug format: 400 Bad Request
  - Reserved word: 400
  - Attempt is_profile_public=true without slug: 400
- **Rollback**: Remove endpoints, entity columns managed via migration

---

### Wave 2: Frontend (Week 2)

#### W2-1: Guest Study Room View
- **Agent**: Palette
- **Risk**: HIGH
- **Files**:
  - `frontend/src/app/shared/[token]/page.tsx` (new)
  - `frontend/src/app/shared/[token]/layout.tsx` (new)
  - `frontend/src/contexts/GuestContext.tsx` (new)
  - `frontend/src/lib/api.ts` (modified — add public API functions)
  - `frontend/src/lib/anonymize.ts` (new)
- **Key Changes**:
  - `/shared/{token}` route: separate layout accessible without authentication
  - `GuestContext`: token-based data fetching, read-only flag
  - Reuse existing study room components (read-only mode):
    - Hide problem add/edit/delete buttons
    - Hide submit button
    - Hide member management UI
    - Block study settings access
  - **Anonymization logic** (`anonymize.ts`):
    ```typescript
    const ADJECTIVES = ['Brave', 'Fast', 'Quiet', 'Bright', 'Wise', 'Steady', 'Agile', 'Meticulous', 'Vibrant', 'Calm']
    const NOUNS = ['Explorer', 'Navigator', 'Architect', 'Pioneer', 'Inventor', 'Analyst', 'Observer', 'Guardian', 'Adventurer', 'Researcher']
    ```
    - Same user within same token always gets same nickname (hash userId → determine index)
    - Profile owner (share link creator): show real name + avatar
    - Other members: anonymous nickname + default avatar
  - Add public API functions (api.ts):
    ```typescript
    export const publicApi = {
      getSharedStudy(token: string): Promise<SharedStudyData>
      getSharedProblems(token: string): Promise<Problem[]>
      getSharedSubmissions(token: string): Promise<Submission[]>
      getSharedAnalysis(token: string, submissionId: string): Promise<Analysis>
      getPublicProfile(slug: string): Promise<PublicProfile>
    }
    ```
- **Acceptance Criteria**:
  - `/shared/{token}` accessible without login
  - All write UI elements hidden
  - All members except profile owner anonymized
  - Same user always gets same anonymous nickname within same token
  - Expired/invalid token: error page shown
  - No impact on existing study room functionality
- **Rollback**: Remove `/shared` route + GuestContext + anonymize.ts

#### W2-2: Public Profile Page
- **Agent**: Palette
- **Risk**: MEDIUM
- **Files**:
  - `frontend/src/app/profile/[slug]/page.tsx` (new)
  - `frontend/src/components/profile/PublicProfileCard.tsx` (new)
  - `frontend/src/components/profile/StudyStatsCard.tsx` (new)
- **Key Changes**:
  - `/profile/{slug}` route: no authentication required
  - Layout:
    - Top: User name + avatar (profile card)
    - Middle: Overall stats (total submissions, average AI score)
    - Bottom: List of study cards
      - Study name, member count, user's own submissions, average AI score
      - If share link exists, "View Study Room" button → navigate to `/shared/{token}`
  - Private profile access: 404 page
  - Responsive: mobile/desktop support
- **Acceptance Criteria**:
  - Look up profile by slug + render
  - Share link navigation works
  - No sensitive info displayed (email, etc.)
  - Private profile: 404
- **Rollback**: Remove `/profile/[slug]` route + components

#### W2-3: Settings Page Extension
- **Agent**: Palette
- **Risk**: LOW
- **Files**:
  - `frontend/src/app/settings/page.tsx` (new or extend existing profile page)
  - `frontend/src/components/settings/ProfileVisibilitySettings.tsx` (new)
- **Key Changes**:
  - Add "Public Profile" section to Settings page:
    - Profile visibility toggle (Switch)
    - Slug input field + real-time duplicate check
    - Preview URL display: `algosu.com/profile/{slug}`
    - Slug validation (client-side)
  - Slug input disabled when toggle is OFF (readOnly)
  - Warning message when attempting to toggle ON without slug set
- **Acceptance Criteria**:
  - Slug setting + visibility toggle works
  - Real-time feedback for duplicate slug
  - Invalid slug format: immediate error display
  - After save success, show profile URL link (click → new tab)
- **Rollback**: Remove Settings section

#### W2-4: Share Link Management UI
- **Agent**: Palette
- **Risk**: LOW
- **Files**:
  - `frontend/src/app/profile/page.tsx` (modified — add share link section)
  - `frontend/src/components/profile/ShareLinkManager.tsx` (new)
- **Key Changes**:
  - Add "My Share Links" section to existing profile page:
    - List of share links per study
    - Create link button (expiry selection: indefinite / 7 days / 30 days / 90 days / custom)
    - Copy link button
    - Deactivate link button (confirm dialog)
    - Status display: active / expired
  - Immediately copy to clipboard on link creation
- **Acceptance Criteria**:
  - Link create/copy/deactivate works
  - Expired links visually distinguished
  - Empty state (no share links) handled
- **Rollback**: Remove section + component

---

### Wave 3: QA + Deploy (Week 3)

#### W3-1: Backend Tests
- **Agent**: Gatekeeper
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/__tests__/share-link.service.spec.ts`
  - `services/gateway/src/share/__tests__/share-link.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-share.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-profile.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-profile.service.spec.ts`
  - `services/gateway/src/common/guards/__tests__/share-link.guard.spec.ts`
  - `services/gateway/src/user/__tests__/settings.spec.ts`
- **Key Changes**:
  - ShareLink CRUD: create, retrieve, deactivate, expiry handling
  - ShareLinkGuard: valid/expired/inactive/non-existent token branches
  - Public endpoints: access without auth, write blocked
  - Public profile: slug lookup, private 404, stats aggregation
  - Settings: slug validation, duplicates, reserved words, toggle integration
  - **Security Tests**:
    - Cannot access other study data from public endpoints
    - Token enumeration attack defense: consistent 404 response
    - Defense against user info enumeration via slug
- **Acceptance Criteria**:
  - Coverage: lines ≥ 90%, branches ≥ 85%
  - All security scenarios tested
- **Rollback**: Remove test files

#### W3-2: Frontend Tests
- **Agent**: Gatekeeper
- **Risk**: MEDIUM
- **Files**:
  - `frontend/src/app/shared/__tests__/page.test.tsx`
  - `frontend/src/app/profile/__tests__/[slug].test.tsx`
  - `frontend/src/components/profile/__tests__/ShareLinkManager.test.tsx`
  - `frontend/src/components/settings/__tests__/ProfileVisibilitySettings.test.tsx`
  - `frontend/src/lib/__tests__/anonymize.test.ts`
- **Key Changes**:
  - Guest study room: rendering, read-only UI, anonymization display
  - Public profile: data display, share link navigation, 404 handling
  - Anonymization: hash consistency, nickname range, owner exclusion
  - Settings: slug input, validation, toggle integration
  - Share link management: create, copy, deactivate
- **Acceptance Criteria**:
  - All new component test coverage ≥ 90%
  - Existing tests unaffected
- **Rollback**: Remove test files

#### W3-3: Integration QA + Security Review
- **Agent**: Gatekeeper + Scout
- **Risk**: MEDIUM
- **Key Changes**:
  - E2E scenarios:
    1. Member creates share link → non-logged-in user accesses via link → verify data
    2. Expired link access → error page
    3. Set slug → make profile public → external access → study card → click share link
    4. Attempt write from share link → confirm blocked
  - Security review:
    - Confirm JWT middleware bypass is path-limited
    - No sensitive info exposed from public API
    - Token/slug brute force defense (consider rate limiting)
  - Responsive UI testing (mobile/desktop)
- **Acceptance Criteria**:
  - All E2E scenarios pass
  - All security checklist items pass
  - No regression in existing features

#### W3-4: CI/CD Deploy
- **Agent**: Conductor
- **Risk**: LOW
- **Key Changes**:
  - Apply DB migration to production
  - Confirm CI passes all checks
  - GHCR image build → aether-gitops tag update → ArgoCD auto-sync
  - Smoke test after deploy
- **Acceptance Criteria**:
  - CI 15 jobs all pass
  - ArgoCD syncs correctly
  - Share link + profile work in production environment
- **Rollback**: Revert migration + restore previous image tag

---

## Agent Assignment Matrix

| Agent | Tasks | Estimated Files | Estimated Hours |
|-------|-------|-----------------|-----------|
| Architect | W1-1 | ~3 | 2-3h |
| Postman | W1-2, W1-4, W1-5 | ~12 | 8-10h |
| Gatekeeper | W1-3, W3-1, W3-2, W3-3 | ~18 | 14-18h |
| Palette | W2-1, W2-2, W2-3, W2-4 | ~12 | 12-16h |
| Scout | W3-3 (security review) | - | 2-3h |
| Conductor | W3-4 | - | 2-3h |

---

## Execution Schedule

### Week 1: Backend Foundation
| Day | Tasks | Parallel | Agent |
|-----|-------|------|-------|
| D1 | W1-1 DB Migration | - | Architect |
| D2 | W1-2 ShareLink CRUD | - | Postman |
| D2 | W1-5 Settings API | Parallel | Postman |
| D3 | W1-3 Guest Guard + Public Endpoints | - | Gatekeeper |
| D3 | W1-4 Public Profile API | Parallel | Postman |

### Week 2: Frontend
| Day | Tasks | Parallel | Agent |
|-----|-------|------|-------|
| D1 | W2-1 Guest Study Room View | - | Palette |
| D2 | W2-2 Public Profile Page | - | Palette |
| D3 | W2-3 Settings Page | - | Palette |
| D3 | W2-4 Share Link Management UI | Parallel | Palette |

### Week 3: QA + Deploy
| Day | Tasks | Parallel | Agent |
|-----|-------|------|-------|
| D1-2 | W3-1 Backend Tests | - | Gatekeeper |
| D1-2 | W3-2 Frontend Tests | Parallel | Gatekeeper |
| D3 | W3-3 Integration QA + Security Review | - | Gatekeeper + Scout |
| D4 | W3-4 CI/CD Deploy | - | Conductor |

---

## Risk Management

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | JWT middleware bypass exposes existing auth paths | HIGH | Whitelist approach for ignoreTokenUrl, minimize patterns, full test coverage |
| R2 | Anonymization hash collision (two users get same nickname) | LOW | 10 adjectives × 10 nouns = 100 combinations, sufficient for study size. Collision doesn't break functionality |
| R3 | Brute force against public API without rate limiting | MEDIUM | 64-char hex token (256-bit) → enumeration impossible. Rate limiting can be added later |
| R4 | Missing read-only branches when reusing existing study room components | HIGH | GuestContext.isGuest flag-based, Gatekeeper full review |
| R5 | Missing slug reserved words causing routing conflicts | MEDIUM | Pre-define reserved word list based on Next.js route structure, test coverage |

---

## Go/No-Go Criteria

### Go (proceed to next Wave):
- `next build` succeeds
- TypeScript strict: 0 errors
- Tests: ≥ 95% pass rate
- No regression in existing features
- All security checklist items pass

### No-Go (rollback):
- Build failure unresolvable within 2 hours
- Security issue found in existing auth paths
- > 10% test failure rate
- PM rejects UX

---

## Technical Decisions

### TD-1: Public API Structure
- **Decision**: Separate with `/api/public/` prefix (prevent mixing with existing API)
- **Rationale**: Minimize JWT middleware bypass scope, clear security boundary

### TD-2: Anonymization Approach
- **Decision**: Client-side anonymization (server returns real data, frontend substitutes)
- **Rationale**: Simplifies server logic, profile owner identification is natural on frontend
- **Note**: Sensitive info (email, etc.) of other members must be removed server-side from public API responses

### TD-3: Token Storage Location
- **Decision**: Gateway DB (share_links table)
- **Rationale**: Separate from Identity service, Gateway is auth/authorization SSoT

### TD-4: Settings Page Location
- **Decision**: New `/settings` route (existing `/profile` remains for profile management)
- **Rationale**: Separation of concerns — profile management (avatar, GitHub) vs system settings (visibility, slug)

---

## File Impact Summary

- **New Files** (~25): entities, services, controllers, guards, DTOs, pages, components, utils
- **Modified Files** (~15): jwt.middleware.ts, api.ts, user.entity.ts, profile/page.tsx, AppModule, etc.
- **Test Files** (~15): backend 7, frontend 5, integration 3
- **Total Impact**: ~55 files

---

## Sprint 49 Backlog (Audit Carryover)

Following Sprint 48 W3-3 security review (Scout + Gatekeeper), the following unresolved items are carried over to Sprint 49.

### Critical (1 item)

| ID | Item | Description | Effort |
|----|------|------|--------|
| C-3 | Gateway → Identity DB direct access separation | Gateway directly connects to identity_db, managing 5 entities (User/Study/StudyMember/Notification/ShareLink). Violates DB per Service principle (ADR-001). Need to extend Identity API and remove TypeORM direct access in Gateway. ADR-002 creation needed. | **L** |

### High (1 item)

| ID | Item | Description | Effort |
|----|------|------|--------|
| H-8 | GitHub App Private Key periodic rotation process | Base64 encoding is not encryption. Need to establish quarterly rotation plan. Document immediate reissuance + full service redeployment procedure in case of exposure. | **M** |

### Medium (9 items)

| ID | Item | Description | Effort |
|----|------|------|--------|
| M-1 | Sync JWT cookie maxAge and token expiresIn hardcoding | Cookie maxAge and JWT expiresIn are separately hardcoded, risk of mismatch. Consolidate to constants SSoT. | **S** |
| M-2 | CORS origin production settings | Separate CORS origin settings per kustomize overlay (dev/staging/prod). Currently wildcard or single value. | **S** |
| M-3 | Redis/RabbitMQ per-user permission separation (ACL) | Currently all services access with single account. Apply least privilege principle with per-service ACL. | **M** |
| M-4 | PostgreSQL statement_timeout consideration during migration | Long-running migrations may be interrupted by statement_timeout. Need migration-specific settings. | **S** |
| M-7 | PublicShareController proxy error detailed logging | Insufficient debug info (URL, duration, response body) on proxy errors. Utilize StructuredLogger. | **S** |
| M-8 | StudyMemberGuard Redis failure Prometheus metrics | Add Prometheus counter/histogram to monitor Guard fallback behavior during Redis failures. | **S** |
| M-9 | Identity service .env.example creation | No .env.example for Identity service makes it hard for new developers to identify env vars during onboarding. | **S** |
| M-10 | Jest/TypeScript test dependency version unification | Jest, ts-jest, @types/jest versions differ per service. Unify versions across monorepo. | **S** |
| M-11 | API routing table ↔ actual endpoint consistency auto-validation | Script needed to auto-detect mismatches between routing table doc and actual registered endpoints in CI. | **M** |
| M-12 | Remove 153 `any` types (Gateway) | 153 `any` types exist in Gateway service. Progressively remove to strengthen TypeScript strict. | **L** |

### Low / Info (15 items)

| ID | Item | Effort |
|----|------|--------|
| L-1 | Confirm DB connection pool defaults (TypeORM pool size) | **S** |
| L-2 | Establish rule to include issue number in migration filename | **S** |
| L-3 | Monitor djb2 hash collision rate (anonymization nicknames) | **S** |
| L-4 | Document OAuth scopes (per Google/Naver/Kakao) | **S** |
| L-5 | Document middleware execution order (Gateway pipeline) | **S** |
| L-6 | Clean up Frontend environment variables (.env.local template) | **S** |
| L-7 | Confirm DataSource defaults (synchronize, logging, etc.) | **S** |
| L-8 | StructuredLoggerService DI conversion (remaining services besides submission) | **M** |
| L-9 | Frontend component separation (PublicProfileCard, StudyStatsCard, ProfileVisibilitySettings) | **M** |
| L-10 | Restore Gateway branches coverage to 96% | **S** |
| L-11 | Actual test of Ingress /internal external access blocking | **S** |
| L-12 | Standardize Share public API response format (envelope consistency) | **S** |
| L-13 | Define token expiry policy (share link default expiry, etc.) | **S** |
| L-14 | Review moving security headers to Traefik middleware (CSP, HSTS, etc.) | **M** |
| L-15 | Production monitoring of rate limit thresholds (for public API) | **S** |
