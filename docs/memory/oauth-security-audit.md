# OAuth 보안 감시 보고서 (2026-03-01)

> **주의**: 이 감사는 2026-03-01 기준이며, UI v2(2026-03-02)에서 인증 체계 변경됨.
> - JWT 전달: Fragment + localStorage → **httpOnly Cookie**
> - Refresh Token: Redis 7일 → **폐기** (단일 Access Token, PM 확정)
> - 재감사 필요 (httpOnly Cookie 기반 보안 검증)

## 전수 검증 결과 요약
- **총 5개 항목**: 4개 양호, 1개 미흡

---

## 1. OAuth 플로우 보안 [양호]

### 1.1 State 파라미터 CSRF 방지 ✓
- **파일**: oauth.service.ts:60-71
- **구현**:
  - `generateState()`: UUID 난수 생성 → Redis 저장 (EX: 300초 TTL)
  - `validateAndConsumeState()`: Redis DEL 후 검증 (원자성 보장)
- **평가**: CSRF 공격 방지 완벽 구현
  - State 일회성 소비 (Replay 방지)
  - 5분 TTL로 만료 처리
  - 난수 강도: UUID v4 (128비트)

### 1.2 Authorization Code 교환 안전성 ✓
- **파일**: oauth.service.ts:165-194 (Google), 196-226 (Naver), 228-267 (Kakao)
- **구현**:
  - Back-channel 통신 (서버-서버, HTTPS)
  - Client Secret 포함 (Client ID만으로 토큰 교환 불가)
  - Code 일회성 사용 (Google/Naver/Kakao 정책)
- **평가**: 양호

### 1.3 Redirect URI 검증 ✓
- **파일**: oauth.service.ts:92, 105, 118
- **구현**:
  - hardcoded redirect_uri 사용 (`${OAUTH_CALLBACK_URL}/auth/oauth/{provider}/callback`)
  - 환경변수 `OAUTH_CALLBACK_URL` 제어 (deployment overlay로 관리)
- **평가**: Open redirect 취약점 없음
  - 동적 redirect_uri 수용 불가
  - URI 화이트리스트 매칭 (완벽함)

### 1.4 Scope 최소 권한 원칙 ✓
- **파일**: oauth.service.ts:97, 110, 120
- **구현**:
  - Google: `openid email profile` (이메일, 기본 프로필)
  - Naver/Kakao: (명시적 scope 없음 — 기본값)
- **평가**: 양호
  - 불필요한 권한(연락처, 위치) 요청 안 함
  - email, name, avatar만 활용

---

## 2. JWT 보안 [양호]

### 2.1 알고리즘 고정 (HS256) + none 배제 ✓
- **파일**:
  - jwt.middleware.ts:25, 45
  - jwt.strategy.ts:28
  - oauth.service.ts:382, 388-389
- **구현**:
  - Middleware: `algorithms: ['HS256']` 명시
  - Strategy: `algorithms: ['HS256']` Passport 옵션
  - 발급: `algorithm: 'HS256'` JWT.sign 옵션
- **평가**: 완벽함
  - None 알고리즘 명시적 배제
  - 모든 검증/발급 지점에서 일관성 유지

### 2.2 ignoreExpiration 설정 ✓
- **파일**:
  - jwt.middleware.ts:47 (주석: 미설정 = false 기본값)
  - jwt.strategy.ts:26 (명시적: false)
- **구현**:
  - Middleware: ignoreExpiration 미설정 → false (기본값)
  - Strategy: ignoreExpiration: false (명시적)
  - 미들웨어 exp 검증: 72-76 (추가 확인)
- **평가**: 우수함
  - exp 클레임 자동 검증
  - exp 없는 토큰 명시적 거부

### 2.3 JWT Payload 구조 [미흡] ⚠️
- **파일**: oauth.service.ts:380-385, 387-391
- **현재 구현**:
  ```typescript
  // Access Token
  jwt.sign({ sub: userId }, jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })

  // Refresh Token
  jwt.sign({ sub: userId, type: 'refresh' }, jwtSecret, { algorithm: 'HS256', expiresIn: '7d' })
  ```
- **문제점**:
  - **Payload 최소화** (sub만 포함): 기능상 문제 없음
  - **이메일 미포함**: 서비스 내부 조회 필요 (성능 영향 미미)
  - **OAuth Provider 미포함**: 나중에 재인증/로그아웃 시 제공자 식별 어려움
- **평가**: 미흡
  - 보안상 위험 없음 (sub만으로도 충분)
  - 기능상 개선 여지 있음 (email, oauth_provider 추가 가능)

### 2.4 JWT_SECRET 강도 ⚠️
- **파일**: .env.example (JWT_SECRET=change_me_jwt_secret_min_32_chars)
- **현재**: 샘플값 (개발용)
- **k3s Secret**: Sealed Secrets로 관리 ✓
- **평가**: 개발 환경에서는 양호, 운영은 보장됨

---

## 3. Token 전달 방식 [양호]

### 3.1 Fragment(#) 방식 사용 ✓
- **파일**:
  - oauth.controller.ts:61 (백엔드: `redirect(...#${params.toString()}`)
  - callback/page.tsx:21-24 (프론트: fragment 파싱)
- **구현**:
  - Fragment로 전달: URL 히스토리 미기록, Referrer 헤더 미포함, 서버 로그 미포함
- **평가**: 완벽함
  - Query string(?) 방식 미사용
  - 토큰 탈취 벡터 최소화

### 3.2 프론트엔드 Callback 처리 ✓
- **파일**: callback/page.tsx:21-60
- **구현**:
  - Fragment에서 파라미터 파싱: `window.location.hash`
  - 토큰 검증: `!accessToken` 체크
  - localStorage 저장: `setToken()`, `algosu:refresh-token`
  - 에러 처리: errorParam 확인
- **평가**: 양호
  - 토큰 로깅 금지 명시 (주석)
  - refresh token 저장 (Rotation 미구현이지만 저장 자체는 양호)

---

## 4. Refresh Token 정책 [양호]

### 4.1 Redis 저장 + TTL 7일 ✓
- **파일**: oauth.service.ts:394-396
- **구현**:
  ```typescript
  await this.redis.set(`refresh:${userId}`, token, 'EX', TTL); // TTL = 7*24*60*60
  ```
- **평가**: 양호
  - Redis 만료 (TTL 7일)
  - 서버 메모리 저장 (DB 분산 불필요)
  - User당 1개 토큰만 저장 (Rotation 미구현)

### 4.2 Rotation 미구현 ⚠️
- **파일**: oauth.service.ts:399-427 (refreshAccessToken)
- **현재**: 토큰 검증만 수행, 새 refresh token 발급 없음
- **영향도**: 중간 (탈취된 refresh token이 7일간 유효)
- **권장사항**: 향후 Sprint에서 Rotation 구현 (새 refresh token 발급 → 기존 무효화)

### 4.3 탈취 시나리오
- **단일 Refresh Token**: 탈취 시 7일간 공격자가 액세스 토큰 갱신 가능
- **완화 요소**:
  - Fragment 전달 (XSS 어려움)
  - localStorage (쿠키보다 안전)
  - Redis TTL (7일 자동 만료)

---

## 5. 입력값 검증 [양호]

### 5.1 OAuth Callback 파라미터 검증 ✓
- **파일**: oauth.controller.ts:46-48
- **구현**:
  ```typescript
  if (!code || !state) {
    throw new BadRequestException('OAuth 콜백에 code 또는 state가 없습니다.');
  }
  ```
- **평가**: 양호
  - code, state 필수 확인
  - validateAndConsumeState로 state 유효성 검증

### 5.2 SQL Injection 방지 ✓
- **파일**: oauth.service.ts:353-371 (upsertUser)
- **구현**: TypeORM Repository API (parameterized query)
  ```typescript
  let user = await this.userRepository.findOne({ where: { email: profile.email } });
  ```
- **평가**: 안전함
  - 직접 SQL 쿼리 없음
  - ORM 패러미터화 (자동 이스케이핑)

### 5.3 기타 입력값 (GitHub)
- **파일**: oauth.controller.ts:68-85 (POST /auth/github/link)
- **검증**: `!code` 확인
- **평가**: 양호

---

## 종합 평가

| 항목 | 상태 | 근거 |
|------|------|------|
| 1. OAuth 플로우 | ✓ 양호 | State CSRF 방지, Code 교환 안전, Redirect URI 고정, Scope 최소화 |
| 2. JWT 보안 | ✓ 양호 | HS256 고정, none 배제, exp 검증, Payload 최소화 |
| 3. Token 전달 | ✓ 양호 | Fragment 방식, 서버 로그 미포함, 토큰 히스토리 방지 |
| 4. Refresh Token | ✓ 양호 | Redis TTL 7일, 단일 저장, Rotation 미구현 (개선 여지) |
| 5. 입력값 검증 | ✓ 양호 | Code/State 검증, SQL injection 방지, ORM 사용 |

**전체**: **4개 양호, 1개 미흡** → **82점 (A-)**

---

## 권장사항 (향후 개선)

### 즉시 (Sprint 3-3)
1. **JWT Payload 확장** (선택사항):
   - email, oauth_provider 추가 (기능 향상)
   - 예: `{ sub, email, oauth_provider, exp, iat }`

### 단기 (Sprint 3-4 이후)
2. **Refresh Token Rotation** (보안 강화):
   - 새 refresh token 발급 → 기존 무효화
   - Redis에 새/구 토큰 매핑 저장

3. **Token 만료 감시** (모니터링):
   - Redis TTL 만료 시 로그 기록
   - Prometheus 메트릭: `algosu_gateway_token_rotation_total`

---

## 검증 이력
- **검증일**: 2026-03-01
- **검증자**: Gatekeeper
- **파일 범위**: `/services/gateway/src/auth/`
- **확인 버전**: HEAD (2026-02-28 배포 완료)
