# ADR-025: Gateway OAuth 에러 코드 정규화

- **상태**: 제안됨 (Proposed)
- **날짜**: 2026-04-24
- **스프린트**: Sprint 124 Phase D (기록), Sprint 125+ (구현)
- **의사결정자**: Oracle (심판관)
- **발의**: Critic (task-20260424-110809-47170)

---

## 컨텍스트

### 현재 Gateway OAuth 에러 emit 구조

`services/gateway/src/auth/oauth/oauth.controller.ts`의 `handleOAuthCallback()` catch 블록은
에러 유형을 세 가지 코드로만 분기한다:

```
[OAuth 제공자 에러] → encodeURIComponent(oauthError)  (provider raw string 패스스루)
[code/state 누락]  → 'missing_params'                 (고정 코드)
[그 외 예외]       → isUserFacing ? encodeURIComponent(message) : 'auth_failed'
```

| 케이스 | 실제 emit 예시 | 비고 |
|--------|--------------|------|
| 사용자 OAuth 거부 | `access_denied` (GitHub 표준) | provider raw 코드 패스스루 |
| code/state 파라미터 누락 | `missing_params` | 고정 코드 |
| BadRequestException 계열 | `%EC%9C%A0%ED%9A%A8%ED%95%98%EC%A7%80...` (URL 인코딩된 한글) | isUserFacing=true 경우 |
| 그 외 서버 에러 | `auth_failed` | 고정 코드 |

### 문제 1: invalid_state 데드코드 (Sprint 124 Phase C-fix Critic 발견)

Sprint 124 Phase C-fix에서 `callback/page.tsx`의 `ALLOWED_ERRORS` 화이트리스트를
Gateway 실측 emit 코드(`access_denied`, `missing_params`, `auth_failed`)와 동기화했다.

그러나 Critic(gpt-5.4) 교차 검증에서 `invalid_state`가 **pre-existing 데드코드**임이 확인되었다:

- `oauth.controller.ts`의 state 검증: `validateAndConsumeState()` → 실패 시
  `BadRequestException('유효하지 않거나 만료된 OAuth state입니다.')` throw
- catch 블록: `isUserFacing=true` → `encodeURIComponent('유효하지 않거나 만료된 OAuth state입니다.')`
- 프론트 수신: `#error=%EC%9C%A0%ED%9A%A8%ED%95%98%EC%A7%80...` → `toAuthError()` 매칭 실패 → `unknown` 폴백

**결론**: `'invalid_state'` 문자열은 현 Gateway가 URL fragment에 emit하지 않는다.
프론트에 화이트리스트로 유지하더라도 실제로 매칭되는 케이스가 없다.

### 문제 2: 사용자 친화 에러 메시지 부재

현재 상태:
- CSRF state 만료/불일치 → 한글 URL-encoded 문자열 → `unknown` 폴백 → 비 친화적 UI
- 토큰 교환 실패 → `auth_failed` (세분화 없음)
- 프로필 조회 실패 → `auth_failed` (세분화 없음)
- 이메일 중복 충돌 → `auth_failed` 또는 한글 URL-encoded → `unknown` 폴백

사용자가 실제 원인을 알 수 없어 불필요한 재시도나 혼란을 야기한다.

---

## 제안된 결정

### Gateway oauth.controller.ts catch 블록 에러 코드 표준화

catch 블록에서 예외 유형을 **enum으로 매핑**하여 프론트가 예측 가능한 고정 코드를 수신하도록 정규화한다.

#### 제안 에러 코드 enum

| 코드 | 트리거 조건 | 현재 상태 |
|------|------------|----------|
| `access_denied` | OAuth 제공자 사용자 거부 (`error=access_denied`) | 이미 정상 emit (provider 패스스루) |
| `missing_params` | code / state 파라미터 누락 | 이미 정상 emit ✅ |
| `invalid_state` | CSRF state 만료 또는 불일치 | **데드코드** — 한글 URL-encoded으로 emit됨 |
| `token_exchange` | OAuth provider 토큰 교환 실패 | `auth_failed` 뭉개짐 |
| `profile_fetch` | provider 프로필 조회 실패 | `auth_failed` 뭉개짐 |
| `account_conflict` | email 중복 등 계정 충돌 | 한글 URL-encoded으로 emit됨 |
| `auth_failed` | 그 외 분류 불가 예외 (default) | 이미 emit ✅ |

#### 제안 구현 방향 (oauth.controller.ts)

```typescript
// 예외 유형 → 에러 코드 매핑
function classifyOAuthError(error: unknown): string {
  if (error instanceof InvalidStateException)     return 'invalid_state';
  if (error instanceof TokenExchangeException)    return 'token_exchange';
  if (error instanceof ProfileFetchException)     return 'profile_fetch';
  if (error instanceof AccountConflictException)  return 'account_conflict';
  return 'auth_failed';  // default fallback
}

// catch 블록 교체
catch (error) {
  const code = classifyOAuthError(error);
  res.redirect(`${frontendUrl}/callback#error=${code}`);
}
```

**핵심 변경**: `encodeURIComponent(한글메시지)` URL 삽입 방식 폐지 → **고정 ASCII 코드** 전달.

---

## 영향 분석

### 긍정적 효과

1. **ALLOWED_ERRORS 화이트리스트 유효화**: 프론트의 `toAuthError()` 가 실제로 유효한 코드만
   화이트리스트에 포함하게 됨 — `invalid_state` 데드코드 제거 가능
2. **UX 개선**: 현재 `unknown` 폴백되는 케이스(CSRF state 오류, 계정 충돌 등)가
   세분화된 사용자 친화 메시지로 노출
3. **번역 체계 일관성**: `callback.error.*` 번역 키가 모두 실제 emit 코드와 1:1 대응
4. **디버깅 용이성**: 에러 코드 표준화로 로그 분석 및 모니터링 개선
5. **레거시 코드 정리**: 기존 `ERROR_KEY_MAP` 레거시 키 (pre-Sprint 124) 완전 삭제 가능

### 트레이드오프 / 리스크

1. **Gateway 코드 리팩토링 필요**: oauth.controller.ts catch 블록 + 예외 클래스 신설 or
   기존 예외에 식별자 추가
2. **테스트 보강 필요**: OAuth 에러 분기별 단위/통합 테스트 추가
3. **provider 다양성**: Google/Naver/Kakao의 비표준 `error` 쿼리 값 처리 정책 결정 필요
   (현재 패스스루, 표준화 후 매핑 or unknown 처리)
4. **프론트-백엔드 동시 배포 조율**: 에러 코드 변경 시 프론트 ALLOWED_ERRORS + 번역 키
   동시 업데이트 필요

### 마이그레이션 방향

```
현재:  encodeURIComponent(한글메시지) → URL fragment → unknown 폴백
목표:  고정 ASCII 에러 코드 → URL fragment → 정확한 번역 메시지
```

레거시 키 정리 순서:
1. Gateway emit 코드 표준화 (Sprint 125 구현)
2. 프론트 ALLOWED_ERRORS 최종 동기화 (Sprint 125 함께 배포)
3. 기존 `errors.*` 번역 키 레거시 제거 (Sprint 126+)

---

## 제약사항

- **본 스프린트(Sprint 124)에서는 결정만 기록**: 구현 준비 상태(백엔드 예외 클래스 설계,
  테스트 전략 수립)가 완료되지 않아 구현은 Sprint 125 로드맵에 편입
- **invalid_state 데드코드**: 당장 프론트에서 제거 가능하나, Gateway 정규화 구현과
  동시 배포가 일관성 확보에 유리하여 Sprint 125까지 유지
- **nestjs-i18n 미도입**: Gateway 백엔드 i18n 라이브러리 도입은 별도 결정 필요.
  본 ADR은 에러 **코드** 정규화만 다루며 Gateway 응답 메시지 다국어화는 미포함

---

## 후속 작업 (Sprint 125 로드맵)

- [ ] Gateway `oauth.service.ts` 예외 유형 식별자 추가 (또는 커스텀 예외 클래스 신설)
- [ ] `oauth.controller.ts` catch 블록 → enum 매핑 방식으로 리팩토링
- [ ] 프론트 `callback/page.tsx` ALLOWED_ERRORS 최종 동기화 (invalid_state 실유효화)
- [ ] `callback.error.*` 번역 키 7개 언어별 최종 확정
- [ ] OAuth 에러 분기별 통합 테스트 추가 (access_denied, invalid_state, token_exchange,
  profile_fetch, account_conflict, auth_failed)
- [ ] `ERROR_KEY_MAP` 레거시 키 완전 삭제

---

## 참고

- Critic 리뷰 (Medium 발견): `~/.claude/oracle/inbox/critic-task-20260424-110809-47170.md`
- Palette C-fix 구현: `~/.claude/oracle/inbox/palette-task-20260424-110630-46879.md`
- 관련 코드: `services/gateway/src/auth/oauth/oauth.controller.ts:97–144`
- 관련 ADR: ADR-024 (Admin 서버사이드 권한 가드)
- 파인딩 원본: Sprint 118 Critic 전수 감사 — p1-025; Sprint 124 Phase C-fix Critic (Medium)
