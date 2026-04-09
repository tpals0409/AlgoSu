---
sprint: 71
title: "세션 수명 불일치 버그 수정 + SessionPolicy 모듈화 (피드백 기반)"
date: "2026-04-09"
status: in_progress
agents: [Oracle, Gatekeeper, Palette, Herald, Scribe]
related_adrs: []
---

# Sprint 71: 세션 수명 불일치 버그 수정 + SessionPolicy 모듈화 (피드백 기반)

## Context

사용자 피드백: "세션이 너무 짧아요. 다른 거 하다가 돌아오면 또 로그인해야 하는 게 귀찮아요."

기획된 JWT 수명은 **2시간**이며, 사용자 활동 중에는 토큰이 갱신되는 **sliding session**이 의도된 동작이었다. 그러나 진단 결과 4개 레이어에 걸친 **이중 불일치 버그**가 확인되었다:

1. **운영 env `JWT_EXPIRES_IN=7d`** — 기획값 `2h`와 불일치. Sealed Secret에 레거시 값이 박혀 있었음.
2. **`cookie.util.ts`의 `COOKIE_MAX_AGE_SECONDS=60*60` 하드코딩** — JWT TTL과 무관하게 브라우저가 1시간 후 쿠키 폐기.
3. **`token-refresh.interceptor.ts`의 `REFRESH_THRESHOLD_SECONDS=5*60`** — 만료 5분 이내에만 갱신 → 사용자 활동 중에도 sliding이 사실상 작동하지 않음.
4. **`useSessionKeepAlive.ts`의 `SESSION_TIMEOUT_MS=65*60*1000`** — 프론트가 65분에 강제 로그아웃 판정하여 JWT 2h 기획과 불일치.

즉, 어느 한 곳만 고쳐도 다른 레이어가 세션을 끊는 구조였으며, **SSoT(진실의 원천)가 4개로 분산**된 상태였다.

초기 진단으로 cookie.util.ts를 JWT exp SSoT로 전환하고 임계값/프론트 timeout을 하드코딩 수정하는 기초안(D2~D4)을 도출했으나, PM 피드백 "세션을 하드코딩하지 말고 모듈화"를 수용하여 Oracle이 α 설계(SessionPolicyModule 신설 + `GET /auth/session-policy` 공개 엔드포인트)로 확장. 단일 진실의 원천을 서버 env로 통일하고, 서버/클라이언트가 모두 파생된 정책 값을 읽도록 구조를 재정렬.

## Decisions

### D1: JWT_EXPIRES_IN 7d → 2h
- **Context**: 운영 Sealed Secret에 레거시 `7d`가 박혀 있어 기획(`2h`)과 불일치. 기본 토큰 수명 정책이 비밀 값도 아닌데 Sealed Secret 안에 갇혀 있어 수정 난이도가 과도하게 높았음.
- **Choice**: aether-gitops `algosu/base/gateway.yaml`의 Deployment에 `env: JWT_EXPIRES_IN: "2h"` 블록을 추가해 envFrom(Sealed Secret) 값을 Kubernetes env override 규칙으로 덮어씀. Deployment `env:`는 `envFrom:`보다 우선하므로 재봉인 없이 정책 값 변경 가능.
- **Alternatives**: Sealed Secret 재봉인 — `kubeseal` 실행에 원본 평문 `.env`가 필요하고, 이를 위해 평문 secret 파일 관리 절차를 복원해야 함. 토큰 수명은 비밀이 아니므로 매니페스트 평문 관리가 구조적으로 합리적. 기각.
- **Code Paths**: `aether-gitops:algosu/base/gateway.yaml` (커밋 `beb7f7d`)

### D2: Cookie maxAge를 JWT exp claim SSoT로 전환
- **Context**: `COOKIE_MAX_AGE_SECONDS=60*60` 하드코딩으로 JWT TTL이 아무리 길어도 브라우저가 1시간 뒤 쿠키 폐기. JWT TTL과 Cookie TTL이 **이중 진실의 원천**인 상태.
- **Choice**: `cookie.util.ts`에서 `jsonwebtoken.decode`로 `exp` claim을 추출해 `maxAge = (exp * 1000) - Date.now()`로 동적 계산. exp 없음/디코딩 실패/이미 만료된 경우 방어적 fallback `1h` + JSON structured log(`event: 'cookie_maxage_fallback'`) 기록. sliding refresh로 새 토큰이 발급될 때마다 Cookie maxAge도 자동 동기화됨.
- **Alternatives**: `ConfigService`로 `JWT_EXPIRES_IN` 파싱(`ms` 라이브러리 필요) — 신규 의존성 추가 + JWT 자체의 `exp`를 무시하는 이중 경로 유지. JWT exp를 SSoT로 두는 것이 구조적으로 안전.
- **Code Paths**: `services/gateway/src/auth/cookie.util.ts`, `services/gateway/src/auth/cookie.util.spec.ts`

### D3: sliding refresh 임계값 5분 → 60분
- **Context**: 기존 `REFRESH_THRESHOLD_SECONDS=5*60` (5분)은 "사용자가 이용 중이면 세션 초기화" 정책을 실질적으로 구현하지 못함. 2h TTL 중 앞 1h 55분 동안은 요청이 와도 갱신이 일어나지 않아, 55분 쉬었다 돌아온 사용자가 잔여 시간이 적어 곧바로 로그아웃됨.
- **Choice**: `REFRESH_THRESHOLD_SECONDS`를 `60*60` (1시간, TTL의 50%)로 확장. 2h TTL의 절반 지점부터 요청마다 sliding 갱신 → 활성 사용자는 사실상 무한 sliding.
- **Alternatives**: 매 요청마다 갱신 — JWT 재서명 CPU 오버헤드 + 매 응답 Set-Cookie 헤더로 응답 크기 증가. 50% 임계값이 성능/UX 타협점.
- **Code Paths**: `services/gateway/src/auth/token-refresh.interceptor.ts`, `services/gateway/src/auth/token-refresh.interceptor.spec.ts`
- **Note**: → 71-1R에서 SessionPolicyService 주입 방식으로 재구현. 하드코딩 상수 제거.

### D4: Frontend SESSION_TIMEOUT_MS 65분 → 125분
- **Context**: 프론트 heartbeat이 65분 경과 시 강제 로그아웃 판정 → JWT 2h 기획과 불일치 (프론트가 서버보다 먼저 세션을 끊음).
- **Choice**: `SESSION_TIMEOUT_MS = 125 * 60 * 1000` (2h + 5분 버퍼)로 확장. heartbeat 10분 간격이 유지되므로 12회+ sliding 기회 제공. 5분 버퍼는 서버 sliding 갱신 직후 프론트 타이머가 바로 만료 판정하는 레이스를 방지.
- **Alternatives**: 서버 401 응답에만 의존하고 클라이언트 timeout 제거 — 오프라인/네트워크 단절 시 감지 UX 상실(마지막 활동 기준 모달 없이 조용히 끊어짐). heartbeat 유지가 안전.
- **Code Paths**: `frontend/src/hooks/useSessionKeepAlive.ts`
- **Note**: → 71-2R에서 `DEFAULT_SESSION_POLICY` fallback만 남기고 서버 정책 fetch로 전환. 하드코딩 상수 제거.

### D5: 데모 유저 2h 하드코딩 유지
- **Context**: `oauth.service.ts:466`의 데모 유저 JWT 발급 로직에 `'2h'` 하드코딩이 존재하며, 우연히 Sprint 71 기획값(2h)과 일치.
- **Choice**: 이번 스프린트에서는 유지. 향후 `JWT_EXPIRES_IN` env를 재사용하도록 통일하는 작업은 별도 리팩터링으로 분리.
- **Alternatives**: 즉시 통일 — 데모 계정 전용 정책(예: 데모는 30분)이 향후 요구될 수 있으므로 보수적으로 분리 유지.
- **Code Paths**: `services/gateway/src/auth/oauth.service.ts:466` (본 스프린트에서 변경 없음)
- **Note**: → 71-1R에서 `JWT_DEMO_EXPIRES_IN` env로 분리하고 SessionPolicyService가 파싱하도록 전환. 데모 전용 별도 정책(예: 30분) 구성 가능한 구조로 확장됨.

### D6: SessionPolicyModule 도입 + 공개 엔드포인트 (α 설계)
- **Context**: D2~D4 초기안은 하드코딩 상수를 다른 값으로 교체하는 수준에 불과했다. 여전히 서버(env), Gateway 코드 상수, Frontend 상수 3곳이 동기화 실패할 수 있는 구조가 남아 있어, PM 피드백("세션을 하드코딩하지 말고 모듈화")을 계기로 Oracle이 재설계. 근본 치료를 위해 정책 값 전반을 단일 서버 SSoT에서 파생시키는 아키텍처가 필요.
- **Choice**: Gateway에 `SessionPolicyModule` (service + controller + spec)을 신설. env 5종(`JWT_EXPIRES_IN`, `JWT_DEMO_EXPIRES_IN`, `SESSION_REFRESH_THRESHOLD`, `SESSION_HEARTBEAT_INTERVAL`, `SESSION_TIMEOUT_BUFFER`)을 ms 단위로 파싱하여 단일 SSoT 확보. 자체 duration 파서(`Nh|Nm|Ns|Nms|Nd`)를 내장하여 `ms` 패키지 직접 의존을 회피(transitive only 상태 유지). 공개 엔드포인트 `GET /auth/session-policy`로 클라이언트에 `{ accessTokenTtlMs, heartbeatIntervalMs, sessionTimeoutMs, refreshThresholdMs }` DTO 제공. consumer(JwtModule, OAuthService, TokenRefreshInterceptor) 모두 SessionPolicyService를 주입받도록 전환.
- **Alternatives**:
  - `NEXT_PUBLIC_*` 빌드타임 주입 — Sprint 65 G1(`NEXT_PUBLIC_` 빌드타임 인라인 리스크) 재발 우려로 기각. 빌드 시점과 런타임 값의 분리 불가.
  - 상수 모음 파일(`session-policy.constants.ts`) — env 연동 없어 근본 해결 아님. 기각.
  - `ms` 패키지 직접 의존 — 현재 transitive only 상태라 hoisting에 의존. 파서 누락 시 fail-fast가 어려워지므로 자체 파서가 안전.
- **Code Paths**:
  - `services/gateway/src/auth/session-policy/session-policy.module.ts`
  - `services/gateway/src/auth/session-policy/session-policy.service.ts`
  - `services/gateway/src/auth/session-policy/session-policy.controller.ts`
  - `services/gateway/src/auth/session-policy/session-policy.service.spec.ts`
  - `services/gateway/src/auth/auth.module.ts` (JwtModule.registerAsync)
  - `services/gateway/src/auth/oauth/oauth.module.ts`, `oauth.service.ts`, `oauth.service.spec.ts`
  - `services/gateway/src/auth/token-refresh.interceptor.ts`, `token-refresh.interceptor.spec.ts`
  - `services/gateway/src/app.module.ts` (JwtMiddleware exclude — `/auth/session-policy` 공개)
  - `frontend/src/lib/session-policy.ts` (신규)
  - `frontend/src/lib/__tests__/session-policy.test.ts` (신규)
  - `frontend/src/contexts/AuthContext.tsx` (sessionPolicy state + 앱 초기화 fetch)
  - `frontend/src/hooks/useSessionKeepAlive.ts` (하드코딩 제거, policy prop 수신)
  - `aether-gitops:algosu/base/gateway.yaml` (env 5개, 커밋 `beb7f7d` + `9c6968f`)

## Patterns

### P1: JWT exp claim을 다운스트림 상태의 SSoT로 활용
- **Where**: `services/gateway/src/auth/cookie.util.ts`
- **When to Reuse**: JWT 토큰이 있고 그 토큰과 연동되는 부가 상태(Cookie maxAge, 프론트 세션 타이머, 캐시 TTL, 재연결 타이머 등)가 있을 때. 별도 상수/env 대신 `jsonwebtoken.decode(token).exp`를 SSoT로 사용하면 TTL 정책 변경 시 한 곳(토큰 발급 지점)만 고치면 파생 상태가 자동 동기화된다. 파생 계산 실패에 대비해 방어적 fallback + structured log는 필수.

### P2: 정책 값의 서버 → 클라이언트 전파 파이프라인
- **Where**: `services/gateway/src/auth/session-policy/`, `frontend/src/lib/session-policy.ts`
- **When to Reuse**: 서버 환경변수로 제어되는 정책 값(세션, rate limit, feature flag 등)을 클라이언트도 알아야 할 때. 서버에 Policy Service를 두어 env를 SSoT로 파싱하고, 공개 `GET` 엔드포인트로 DTO를 내려주며, 클라이언트는 앱 부트 시 1회 fetch + `DEFAULT_*` fallback으로 부팅 안정성 확보. `NEXT_PUBLIC_*` 빌드타임 주입을 회피할 수 있는 런타임 전파 방식. 파서는 외부 패키지 대신 자체 구현하여 fail-fast 보장.

## Gotchas

### G1: 환경변수를 우회한 하드코딩 상수가 SSoT를 이중화시킴
- **Symptom**: `JWT_EXPIRES_IN` env를 `2h`/`7d`/기타 어떤 값으로 바꿔도 Cookie는 항상 정확히 1시간 후 삭제됨. 사용자가 "2시간 설정했는데 1시간 만에 로그아웃돼요"로 재현.
- **Root Cause**: `cookie.util.ts`의 `COOKIE_MAX_AGE_SECONDS = 60 * 60` 하드코딩 상수가 `JWT_EXPIRES_IN` env를 전혀 참조하지 않음. 토큰 수명과 쿠키 수명이 **구조적으로 분리된 이중 SSoT** 상태.
- **Fix**: 파생 상태의 원천을 env가 아니라 토큰 자체(JWT `exp` claim)로 끌어올려 SSoT를 일원화.
- **Lesson**: 환경변수로 제어하는 정책 값 근처에 "우연히 같은 의미"를 가진 상수를 두지 말 것. 같은 시맨틱이면 반드시 동일 진실의 원천을 참조해야 하며, env 하나를 바꿨을 때 연관 상태가 모두 따라오지 않으면 그 지점이 다음 버그의 씨앗.

### G2: Sealed Secret 안의 비-비밀 정책 값
- **Symptom**: `JWT_EXPIRES_IN` 같은 토큰 수명 정책이 Sealed Secret에 암호화 저장되어 있어, 수정하려면 `kubeseal` + 원본 평문 `.env` 복원 절차가 필요. 변경 허들이 불필요하게 높음.
- **Root Cause**: 초기 환경변수 구성 시 Sealed Secret에 전체 `.env`를 통째로 봉인해버림. 비밀/비-비밀 구분 없이 묶임.
- **Fix (이번 스프린트)**: Deployment `env:` 블록이 `envFrom:` (Sealed Secret)을 override하는 Kubernetes 규칙을 활용해 Sealed Secret 재봉인 없이 정책 값만 override.
- **Lesson**: 비-비밀 정책 값(TTL, feature flag, threshold)은 ConfigMap 또는 Deployment `env:`로 분리 관리. Sealed Secret은 진짜 비밀(JWT signing key, DB password, API token)에만 사용. 초기 설계 단계에서 "이 값이 공개돼도 보안상 문제가 없는가?"를 기준으로 분리.

### G3: 정책 값 하드코딩의 재발 구조
- **Symptom**: 환경변수로 제어되는 정책(예: JWT TTL)과 의미가 같은 상수(`REFRESH_THRESHOLD_SECONDS`, `SESSION_TIMEOUT_MS`, 데모 `'2h'` 리터럴)가 코드 곳곳에 흩어져 있으면, env만 고쳐도 동작이 바뀌지 않는 "사일런트 불일치" 버그 발생. Sprint 71 초기안(D2~D4)조차 상수 값 교체에 그쳐 재발 위험이 잔존.
- **Root Cause**: "상수"라는 관성적 표현이 환경변수 연동을 생략시키는 인지 편향. 초기 구현 시 설정 주입 경로(Config/Policy Service)가 구축되어 있지 않으면 개발자가 로컬 상수로 시작하고 그대로 남게 됨.
- **Fix**: 정책 값을 표현하는 모든 지점을 "정책 서비스 주입"으로 일원화. 상수 리터럴(숫자 × 단위 형태)이 `*policy*`, `*session*`, `*ttl*`, `*timeout*` 등과 함께 등장하면 리뷰 시 경계. Sprint 71 α 설계(D6)에서 SessionPolicyModule 도입으로 구조 정리.
- **Lesson**: env 추가 시 "consumer 검색 → 유사 의미 상수 grep → 전환 범위 PR에 명시" 체크리스트 필요. 상수 교체가 아닌 주입 구조로 한 번에 전환하지 않으면 동일 버그가 재발.

## Metrics
- **Commits (AlgoSu)**: 집계 대기 (Oracle 일괄 커밋 예정)
- **Commits (aether-gitops)**: 2건
  - `beb7f7d` — gateway.yaml `JWT_EXPIRES_IN` env override
  - `9c6968f` — SessionPolicy env 4개 추가 (`JWT_DEMO_EXPIRES_IN`, `SESSION_REFRESH_THRESHOLD`, `SESSION_HEARTBEAT_INTERVAL`, `SESSION_TIMEOUT_BUFFER`)
- **Files changed (AlgoSu)**: 총 **19 files**
  - **Gateway (14 files)**:
    - 신규 4: `session-policy/session-policy.module.ts`, `session-policy.service.ts`, `session-policy.controller.ts`, `session-policy.service.spec.ts`
    - 71-1 원본 2: `auth/cookie.util.ts`, `auth/cookie.util.spec.ts`
    - 수정 8: `auth/auth.module.ts`, `auth/oauth/oauth.module.ts`, `auth/oauth.service.ts`, `auth/oauth.service.spec.ts`, `auth/token-refresh.interceptor.ts`, `auth/token-refresh.interceptor.spec.ts`, `app.module.ts` (JwtMiddleware exclude), `main.ts`(필요 시)
  - **Frontend (4 files)**:
    - 신규 2: `src/lib/session-policy.ts`, `src/lib/__tests__/session-policy.test.ts`
    - 수정 2: `src/hooks/useSessionKeepAlive.ts`, `src/contexts/AuthContext.tsx`
  - **문서 (1 file)**: `docs/adr/sprints/sprint-71.md` (이 파일)
- **Files changed (aether-gitops)**: 1개 (`algosu/base/gateway.yaml`)
- **Tests**: Gateway 47 suites / 688 tests pass (신규 session-policy 8건), Frontend 110 suites / 1135 tests pass (신규 session-policy 16건)
- **신규 외부 의존**: 없음 (`ms` 패키지는 기존 transitive 상태 유지, 자체 duration 파서 채택. `jsonwebtoken`은 Gateway 기존 사용 중)

## 후속 권장 (Sprint 71 범위 외)

MEMORY.md 후속 처리 섹션에 추가 권장:

- **aether-gitops `algosu/base/sealed-gateway-secrets.yaml` orphan 파일 정리** — Herald 71-3에서 발견. 참조되지 않는 Sealed Secret 매니페스트.
- **Sealed Secret에서 `JWT_EXPIRES_IN` 키 제거** — kubeseal 재봉인 작업. 현재 Deployment env override로 무력화되어 있으나 근본적으로는 Sealed Secret에서 비-비밀 키를 배제해야 함.
- **`cookie.util.ts` fallback 로깅을 `StructuredLoggerService`로 통합** — 현재는 경량화를 위해 `console.warn` + JSON payload 직접 출력. 운영 로그 파이프라인과 일치시키는 리팩터링 필요.
- **Refresh Token + Redis 정식 도입 검토 (장기)** — 현재 sliding refresh는 단일 JWT를 재서명하는 방식. Refresh Token 분리 + 서버 측 세션 revoke 능력 확보를 위한 장기 과제.
- **`SessionPolicyModule` 패턴을 다른 정책 값에 재사용 검토** — rate limit, circuit breaker 임계값, upload size limit 등 현재 코드 상수로 흩어진 정책 값에 동일 파이프라인(env → PolicyService → public GET DTO → client fetch) 적용 검토.
- **`GET /auth/session-policy` 응답 캐싱 (SWR/ETag) — 장기** — 현재 앱 부트 시 1회 fetch로 충분하나, 정책이 런타임 변경 가능해질 경우(예: 관리자 UI에서 TTL 조정) SWR/ETag 기반 리프레시 전략 필요.
- **`JWT_EXPIRES_IN` Sealed Secret 레거시 값(`7d`) 정리** — 현재 Deployment env override로 가려져 있지만, kubeseal 재봉인으로 근본 제거 권장. 봉인 절차 재구축과 함께 수행.
