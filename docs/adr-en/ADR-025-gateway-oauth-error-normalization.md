# ADR-025: Gateway OAuth Error Code Normalization

- **Status**: Accepted
- **Date**: 2026-04-24
- **Sprint**: Sprint 124 Phase D (recorded), Sprint 125 Wave C (implemented)
- **Decision maker**: Oracle
- **Proposed by**: Critic (task-20260424-110809-47170)

---

## Context

### Current Gateway OAuth Error Emission Structure

The `handleOAuthCallback()` catch block in `services/gateway/src/auth/oauth/oauth.controller.ts`
branches on only three error codes:

```
[OAuth provider error] → encodeURIComponent(oauthError)  (provider raw string passthrough)
[code/state missing]   → 'missing_params'                 (fixed code)
[other exceptions]     → isUserFacing ? encodeURIComponent(message) : 'auth_failed'
```

| Case | Actual emit example | Notes |
|--------|--------------|------|
| User denies OAuth | `access_denied` (GitHub standard) | Provider raw code passthrough |
| code/state parameter missing | `missing_params` | Fixed code |
| BadRequestException class | `%EC%9C%A0%ED%9A%A8%ED%95%98%EC%A7%80...` (URL-encoded Korean) | When isUserFacing=true |
| Other server errors | `auth_failed` | Fixed code |

### Problem 1: invalid_state Dead Code (Found by Sprint 124 Phase C-fix Critic)

In Sprint 124 Phase C-fix, the `ALLOWED_ERRORS` whitelist in `callback/page.tsx` was synchronized
with Gateway's actual emit codes (`access_denied`, `missing_params`, `auth_failed`).

However, cross-verification by Critic (gpt-5.4) confirmed that `invalid_state` is **pre-existing dead code**:

- `oauth.controller.ts` state validation: `validateAndConsumeState()` → on failure,
  throws `BadRequestException('Invalid or expired OAuth state.')`
- catch block: `isUserFacing=true` → `encodeURIComponent('Invalid or expired OAuth state.')`
- Frontend receives: `#error=%EC%9C%A0%ED%9A%A8%ED%95%98%EC%A7%80...` → `toAuthError()` match fails → `unknown` fallback

**Conclusion**: The string `'invalid_state'` is not emitted by the current Gateway in URL fragments.
Even if maintained in the frontend whitelist, there are no cases that actually match it.

### Problem 2: Absence of User-Friendly Error Messages

Current state:
- CSRF state expiry/mismatch → Korean URL-encoded string → `unknown` fallback → unfriendly UI
- Token exchange failure → `auth_failed` (no granularity)
- Profile fetch failure → `auth_failed` (no granularity)
- Email conflict → `auth_failed` or Korean URL-encoded → `unknown` fallback

Users cannot know the actual cause, leading to unnecessary retries and confusion.

---

## Proposed Decision

### Standardize Gateway oauth.controller.ts Catch Block Error Codes

Map exception types to an **enum** in the catch block so the frontend receives predictable fixed codes.

#### Proposed error code enum

| Code | Trigger condition | Current state |
|------|------------|----------|
| `access_denied` | OAuth provider user denial (`error=access_denied`) | Already emitting correctly (provider passthrough) |
| `missing_params` | code / state parameter missing | Already emitting correctly ✅ |
| `invalid_state` | CSRF state expiry or mismatch | **Dead code** — emitted as Korean URL-encoded |
| `token_exchange` | OAuth provider token exchange failure | Lumped under `auth_failed` |
| `profile_fetch` | Provider profile fetch failure | Lumped under `auth_failed` |
| `account_conflict` | Account conflict such as email duplication | Emitted as Korean URL-encoded |
| `auth_failed` | Other unclassifiable exceptions (default) | Already emitting ✅ |

#### Proposed implementation direction (oauth.controller.ts)

```typescript
// Exception type → error code mapping
function classifyOAuthError(error: unknown): string {
  if (error instanceof InvalidStateException)     return 'invalid_state';
  if (error instanceof TokenExchangeException)    return 'token_exchange';
  if (error instanceof ProfileFetchException)     return 'profile_fetch';
  if (error instanceof AccountConflictException)  return 'account_conflict';
  return 'auth_failed';  // default fallback
}

// Replace catch block
catch (error) {
  const code = classifyOAuthError(error);
  res.redirect(`${frontendUrl}/callback#error=${code}`);
}
```

**Key change**: Abolish the `encodeURIComponent(Korean message)` URL insertion approach → deliver **fixed ASCII codes**.

---

## Impact Analysis

### Positive Effects

1. **ALLOWED_ERRORS whitelist validated**: Frontend's `toAuthError()` will only include actually valid codes
   in the whitelist — dead code `invalid_state` can be removed
2. **UX improvement**: Cases currently falling back to `unknown` (CSRF state errors, account conflicts, etc.)
   will surface as granular, user-friendly messages
3. **Translation consistency**: `callback.error.*` translation keys all correspond 1:1 to actual emit codes
4. **Improved debuggability**: Error code standardization improves log analysis and monitoring
5. **Legacy code cleanup**: Existing `ERROR_KEY_MAP` legacy keys (pre-Sprint 124) can be fully removed

### Trade-offs / Risks

1. **Gateway code refactoring required**: oauth.controller.ts catch block + creating new exception classes or
   adding identifiers to existing exceptions
2. **Tests need enhancement**: Add unit/integration tests per OAuth error branch
3. **Provider diversity**: Need to define policy for handling non-standard `error` query values from Google/Naver/Kakao
   (currently passthrough; determine whether to map or handle as unknown after standardization)
4. **Frontend-backend simultaneous deploy coordination**: When error codes change, frontend ALLOWED_ERRORS + translation keys
   must be updated simultaneously

### Migration Direction

```
Current:  encodeURIComponent(Korean message) → URL fragment → unknown fallback
Target:   Fixed ASCII error code → URL fragment → accurate translated message
```

Legacy key cleanup order:
1. Standardize Gateway emit codes (Sprint 125 implementation)
2. Final synchronization of frontend ALLOWED_ERRORS (deploy together with Sprint 125)
3. Remove legacy `errors.*` translation keys (Sprint 126+)

---

## Constraints

- **This sprint (Sprint 124) records the decision only**: Implementation preparation (backend exception class design,
  test strategy formulation) is incomplete, so implementation is incorporated into the Sprint 125 roadmap
- **invalid_state dead code**: Can be removed from frontend immediately, but keeping it until Sprint 125
  is preferable for consistency with simultaneous Gateway normalization deployment
- **nestjs-i18n not adopted**: A separate decision is needed for introducing a Gateway backend i18n library.
  This ADR covers only error **code** normalization and does not include multilingual Gateway response messages

---

## Follow-up Tasks (Sprint 125 Roadmap)

- [x] Add exception type identifiers to Gateway `oauth.service.ts` — confirm throw points for 5 Exception classes (Wave C1)
- [x] Refactor `oauth.controller.ts` catch block → `instanceof OAuthCallbackException` branching approach (Wave C1)
- [x] Final sync of frontend `callback/page.tsx` ALLOWED_ERRORS (invalid_state effective validation + 3 additions) (Wave C2)
- [x] Finalize `callback.error.*` translation keys — 7 keys in ko/en (Wave C2)
- [x] Add unit tests per OAuth error branch — 7 controller variants + service throw point verification (Wave C1)
- [ ] Remove unreferenced legacy `errors.*` translation keys → register as Sprint 126 technical debt (review `auth.json` `errors.authFailed`, `errors.serviceFailed`)

---

## Implementation Results (Sprint 125 Wave C)

### Final enum — 7 codes confirmed

| Code | Trigger condition | HTTP Status |
|------|------------|------------|
| `access_denied` | OAuth provider user denial | 400 |
| `missing_params` | code / state parameter missing | 400 |
| `invalid_state` | CSRF state expiry or mismatch | 400 |
| `token_exchange` | OAuth token exchange failure | 400 |
| `profile_fetch` | Profile fetch failure | 400 |
| `account_conflict` | Duplicate email account conflict | 409 |
| `auth_failed` | Unclassifiable exception (default fallback) | 500 |

### Exception Class List

File: `services/gateway/src/auth/oauth/exceptions/oauth-callback.exception.ts`

```
OAuthCallbackException          (abstract base class)
├── OAuthAccessDeniedException
├── OAuthMissingParamsException
├── OAuthInvalidStateException
├── OAuthTokenExchangeException
├── OAuthProfileFetchException
├── OAuthAccountConflictException
└── OAuthAuthFailedException
```

### Frontend i18n Key Mapping

File: `frontend/src/app/[locale]/(auth)/callback/page.tsx`

| AuthError (ALLOWED_ERRORS) | ko translation | en translation |
|---------------------------|---------|---------|
| `access_denied` | OAuth 인증을 거부했습니다. 다시 시도해 주세요. | You denied the OAuth authorization request. |
| `missing_params` | 인증 정보가 누락되었습니다. 다시 시도해 주세요. | Authentication parameters are missing. |
| `invalid_state` | 인증 상태(CSRF) 검증에 실패했습니다. 다시 시도해 주세요. | CSRF state verification failed. |
| `token_exchange` | 토큰 교환 중 문제가 발생했습니다. | Failed to exchange OAuth token. |
| `profile_fetch` | 프로필 정보를 불러오지 못했습니다. | Failed to load profile information. |
| `account_conflict` | 이미 다른 방식으로 가입된 이메일입니다. | This email is already registered with another method. |
| `auth_failed` | 인증 처리에 실패했습니다. 잠시 후 다시 시도해 주세요. | Authentication processing failed. |

### Commit SHA References

- Wave C1 (gateway): `0d13282c214bb4d3ef1f320eff199d524f9c9134`
- Wave C2 (frontend): `98a16219f8609636343af10adff0f69fe01f65b6`
- Wave C3 (docs/adr): this commit

---

## References

- Critic review (Medium finding): `~/.claude/oracle/inbox/critic-task-20260424-110809-47170.md`
- Palette C-fix implementation: `~/.claude/oracle/inbox/palette-task-20260424-110630-46879.md`
- Related code: `services/gateway/src/auth/oauth/oauth.controller.ts:97–144`
- Related ADR: ADR-024 (Admin Server-side Authorization Guard)
- Original finding: Sprint 118 Critic comprehensive audit — p1-025; Sprint 124 Phase C-fix Critic (Medium)
