---
sprint: 118
service: gateway
audited_at: 2026-04-22
loc_audited: 8863
files_audited: 82
codex_sessions: [019db3d3-57a2-7d83-8ab7-27ed5577139f, 019db3d4-9bf0-7d10-a2ef-75b780855aa0, 019db3d6-2c23-72f1-af8f-ab9be1c5585a, 019db3d7-cc61-7ed1-a5c5-e0c634af7763, 019db3d8-f311-75c0-83f6-088dc4871104, 019db3da-6fcf-7152-b90f-8d5f90a07326, 019db3db-df58-7220-b6f5-257210a2f378, 019db3dd-c549-7c01-ae17-94f9bd19b56a, 019db3df-966d-77e2-81dd-4ea3a7ca0e55, 019db3e1-d65d-79f2-bc20-e01335cf391d, 019db3e3-2407-7c23-81b1-18aab91601c0]
severity_counts: { P0: 2, P1: 64, P2: 44, Low: 1 }
---

# Audit — gateway

> 감사 일자: 2026-04-22 | LOC: 8863 | 파일: 82개
> P0: 2 | P1: 64 | P2: 44 | Low: 1

## P0 (머지 차단)

### P0-01 — services/gateway/src/auth/token-refresh.interceptor.ts:54
- **category**: security
- **message**: 글로벌 인터셉터가 JwtMiddleware 제외 공개 라우트에서도 클라이언트가 보낸 x-user-id 헤더를 신뢰해 새 JWT를 발급할 수 있습니다.
- **suggestion**: 토큰 갱신은 JWT 검증이 끝난 요청에서만 수행하고, 사용자 식별자는 클라이언트 헤더가 아니라 검증된 payload/req.user에서 가져오도록 변경하세요.

### P0-02 — services/gateway/src/share/public-share.controller.ts:144
- **category**: security
- **message**: 공유 토큰으로 검증된 studyId와 submissionId의 소속 관계를 확인하지 않아, 유효한 공유 링크 하나만 있으면 임의 UUID 제출의 코드와 AI 분석을 조회할 수 있는 IDOR 위험이 있습니다.
- **suggestion**: ShareLinkGuard가 주입한 studyId를 함께 사용해 제출 조회 API가 해당 스터디 소속인지 검증하게 하거나, 응답의 study_id를 비교해 불일치 시 404를 반환하세요.

## P1 (재검증 필수)

### P1-01 — services/gateway/src/auth/oauth/oauth.service.ts:67
- **category**: security
- **message**: OAuth state가 Redis에만 저장되고 브라우저 세션 또는 임시 쿠키와 바인딩되지 않아 로그인 CSRF로 피해자를 공격자 계정에 로그인시킬 수 있습니다.
- **suggestion**: state 생성 시 nonce를 httpOnly/SameSite 쿠키 또는 서버 세션에 함께 저장하고 콜백에서 Redis state와 클라이언트 바인딩 값을 모두 검증하세요.

### P1-02 — services/gateway/src/auth/oauth/oauth.service.ts:80
- **category**: security
- **message**: GitHub 연동 state 검증이 get 후 del로 분리되어 동시 요청에서 같은 state가 두 번 사용될 수 있습니다.
- **suggestion**: Redis GETDEL 또는 Lua 스크립트로 state 조회와 삭제를 원자적으로 처리하세요.

### P1-03 — services/gateway/src/auth/oauth/oauth.service.ts:184
- **category**: performance
- **message**: 외부 OAuth API 호출에 timeout이 없어 제공자 장애 시 요청이 장시간 점유되어 게이트웨이 리소스 고갈로 이어질 수 있습니다.
- **suggestion**: 공통 axios 인스턴스에 짧은 timeout과 제한적인 재시도 정책을 설정하고 모든 OAuth/GitHub 외부 호출에 적용하세요.

### P1-04 — services/gateway/src/auth/oauth/oauth.service.ts:203
- **category**: data-integrity
- **message**: Google 프로필의 email 존재 여부를 검증하지 않고 사용자 upsert에 전달해 잘못된 계정 생성 또는 Identity API 오류가 발생할 수 있습니다.
- **suggestion**: Google/Naver 모두 이메일이 비어 있거나 문자열이 아니면 BadRequestException으로 중단하고 upsert 전에 정규화 검증을 수행하세요.

### P1-05 — services/gateway/src/auth/oauth/oauth.service.ts:235
- **category**: data-integrity
- **message**: Naver 프로필의 email 존재 여부를 검증하지 않고 사용자 upsert에 전달해 잘못된 계정 생성 또는 Identity API 오류가 발생할 수 있습니다.
- **suggestion**: profile.email이 유효한 문자열인지 확인하고 누락 시 명확한 인증 실패 응답을 반환하세요.

### P1-06 — services/gateway/src/auth/oauth/oauth.controller.ts:336
- **category**: security
- **message**: refreshToken은 JWT 서명만 검증하고 exp 클레임 존재를 확인하지 않아 만료 시간이 없는 유효 서명 토큰도 새 토큰으로 갱신될 수 있습니다.
- **suggestion**: JwtMiddleware와 동일하게 payload.exp가 없으면 거부하고, 가능하면 refresh 전용 토큰 또는 세션 저장소 기반 검증으로 분리하세요.

### P1-07 — services/gateway/src/auth/jwt.middleware.ts:117
- **category**: data-integrity
- **message**: x-study-id가 배열 등 문자열이 아닌 형태로 들어오면 검증을 건너뛴 채 내부 서비스로 전달될 수 있습니다.
- **suggestion**: x-study-id가 존재하지만 단일 문자열이 아니면 즉시 거부하거나 헤더를 삭제하고, 검증된 단일 UUID만 내부로 전달하세요.

### P1-08 — services/gateway/src/app.module.ts:120
- **category**: security
- **message**: metrics 엔드포인트가 JWT 미들웨어에서 제외되어 운영 메트릭이 공개될 수 있습니다.
- **suggestion**: metrics는 내부망/IP allowlist 또는 별도 인증 토큰으로 보호하고 공개 라우트 제외 목록에서 제거하세요.

### P1-09 — services/gateway/src/auth/token-refresh.interceptor.ts:61
- **category**: correctness
- **message**: refreshAndSetCookie를 await하지 않아 DB 조회 중 응답이 먼저 커밋되면 Set-Cookie 헤더가 누락될 수 있습니다.
- **suggestion**: 쿠키를 설정해야 하는 비동기 작업은 응답 전 완료되도록 mergeMap/from 등으로 Observable 흐름에 포함하거나 next.handle 이전에 await하세요.

### P1-10 — services/gateway/src/auth/session-policy/session-policy.service.ts:95
- **category**: correctness
- **message**: 숫자 문자열 TTL을 초 단위로 파싱하지만 원본 문자열을 jsonwebtoken expiresIn에 넘겨 실제 JWT 만료가 밀리초 단위로 적용될 수 있습니다.
- **suggestion**: 숫자 문자열은 number 초 값으로 정규화해 반환하거나 '3600s'처럼 단위가 명확한 문자열로 변환해 저장하세요.

### P1-11 — services/gateway/src/avatar/avatar.controller.ts:60
- **category**: data-integrity
- **message**: 아바타 업로드 후 저장소 URL만 반환하고 사용자 avatar_url을 갱신하지 않아 업로드 결과가 프로필 데이터에 반영되지 않습니다.
- **suggestion**: 업로드 성공 후 Identity 사용자 레코드의 avatar_url을 같은 흐름에서 갱신하고 실패 시 업로드 객체 정리 또는 보상 처리를 추가하세요.

### P1-12 — services/gateway/src/avatar/avatar.controller.ts:74
- **category**: correctness
- **message**: DELETE /avatar가 인증 확인 후 아무 작업 없이 204를 반환해 실제 아바타 삭제 또는 기본값 복원이 수행되지 않습니다.
- **suggestion**: 현재 사용자의 avatar_url을 null로 갱신하고 필요한 경우 기존 객체 삭제를 호출하도록 구현하세요.

### P1-13 — services/gateway/src/common/guards/demo-write.guard.ts:42
- **category**: security
- **message**: 허용 목록을 startsWith로 비교해 POST /auth/logout-all처럼 허용 경로 접두사를 가진 다른 쓰기 엔드포인트도 데모 유저가 통과할 수 있습니다.
- **suggestion**: method와 path를 분리해 정확히 일치시키거나 검증된 라우트 패턴 매처로 허용 목록을 비교하세요.

### P1-14 — services/gateway/src/common/guards/internal-key.guard.ts:39
- **category**: security
- **message**: 서비스별 키 설정이 존재하지만 가드는 단일 INTERNAL_API_KEY만 검증하므로 한 내부 키 유출이 모든 내부 API 접근 권한으로 확대될 수 있습니다.
- **suggestion**: 요청 경로 또는 호출 서비스 식별자에 따라 서비스별 환경변수 키를 선택해 검증하고, 공유 키 사용을 제거하세요.

### P1-15 — services/gateway/src/common/guards/share-link.guard.ts:54
- **category**: correctness
- **message**: expires_at이 잘못된 날짜 문자열이면 Invalid Date가 되어 만료 검사를 통과하고 공유 링크가 유효한 것으로 처리됩니다.
- **suggestion**: Date.parse 결과가 NaN인지 확인하고 유효하지 않은 expires_at은 404로 거부하세요.

### P1-16 — services/gateway/src/common/guards/share-link.guard.ts:61
- **category**: data-integrity
- **message**: study_id 또는 created_by가 누락되어도 String(undefined)을 헤더에 주입해 downstream에서 잘못된 스터디 컨텍스트로 처리될 수 있습니다.
- **suggestion**: verify 응답의 필수 필드를 타입과 형식까지 검증한 뒤 헤더에 주입하고, 누락 시 404 또는 502로 실패 처리하세요.

### P1-17 — services/gateway/src/common/guards/study-active.guard.ts:44
- **category**: data-integrity
- **message**: 스터디 상태 조회 중 Identity API 오류가 발생하면 study를 null로 만들고 가드를 통과시켜 CLOSED 스터디 쓰기가 허용될 수 있습니다.
- **suggestion**: 조회 실패와 미존재를 구분하고, 상태 확인 불가 시 fail-close로 ForbiddenException 또는 ServiceUnavailableException을 반환하세요.

### P1-18 — services/gateway/src/common/guards/study-member.guard.ts:49
- **category**: security
- **message**: 멤버십을 300초 동안 긍정 캐시해 멤버가 제거되거나 권한이 회수된 뒤에도 최대 5분간 접근이 유지될 수 있습니다.
- **suggestion**: 멤버십 변경 시 캐시를 즉시 무효화하거나 권한 버전/짧은 TTL을 적용해 철회 지연을 줄이세요.

### P1-19 — services/gateway/src/common/logger/sanitize.ts:22
- **category**: security
- **message**: 민감 헤더 목록에 set-cookie, proxy-authorization 같은 인증 관련 헤더가 없어 응답 쿠키나 프록시 인증값이 로그로 노출될 수 있습니다.
- **suggestion**: REDACTED_HEADERS에 set-cookie, proxy-authorization 및 필요한 인증/세션 헤더를 추가하고 대소문자 정규화 후 일괄 마스킹하세요.

### P1-20 — services/gateway/src/common/logger/structured-logger.service.ts:65
- **category**: correctness
- **message**: 전역 싱글턴 로거가 mutable context를 공유하므로 여러 서비스의 setContext 호출 순서에 따라 다른 컴포넌트 로그의 context가 오염됩니다.
- **suggestion**: setContext로 전역 상태를 바꾸지 말고 child logger를 생성하거나 각 로그 호출에서 context를 명시적으로 전달하도록 구조를 바꾸세요.

### P1-21 — services/gateway/src/common/logger/structured-logger.service.ts:139
- **category**: security
- **message**: extra 필드를 그대로 로그 엔트리에 병합해 authorization, cookie, token 같은 민감 키가 전달되면 마스킹 없이 출력됩니다.
- **suggestion**: extra 병합 전에 키 기반 redaction과 문자열 sanitize를 재귀적으로 적용하고 허용된 필드만 기록하세요.

### P1-22 — services/gateway/src/common/logger/structured-logger.service.ts:156
- **category**: correctness
- **message**: JSON.stringify가 BigInt 또는 순환 참조 extra를 만나면 예외가 발생해 로깅 호출이 애플리케이션 흐름을 깨뜨릴 수 있습니다.
- **suggestion**: safe stringify를 사용해 BigInt와 순환 참조를 안전하게 직렬화하고, 직렬화 실패 시 최소 로그만 출력하도록 try/catch를 추가하세요.

### P1-23 — services/gateway/src/common/metrics/metrics.controller.ts:17
- **category**: security
- **message**: /metrics 엔드포인트가 코드상 인증이나 내부망 제한 없이 노출되어 프로세스/런타임 메트릭이 외부에 공개될 수 있습니다.
- **suggestion**: Prometheus scraper 전용 네트워크 정책, 내부 키 가드, 또는 환경별 접근 제한을 코드나 인프라 설정과 함께 강제하세요.

### P1-24 — services/gateway/src/common/metrics/metrics.module.ts:39
- **category**: correctness
- **message**: tap의 next/error에서 메트릭을 기록해 SSE나 다중 emission Observable에서 요청 1건이 여러 번 기록되고 activeRequests가 음수로 감소할 수 있습니다.
- **suggestion**: finalize에서 요청당 한 번만 duration/count/activeRequests를 처리하고, 스트리밍 응답은 별도 정책으로 계측하세요.

### P1-25 — services/gateway/src/common/metrics/metrics.module.ts:39
- **category**: performance
- **message**: 요청이 클라이언트 abort 등으로 unsubscribe되면 tap next/error가 실행되지 않아 httpActiveRequests가 감소하지 않고 게이지가 누수됩니다.
- **suggestion**: RxJS finalize 연산자를 사용해 성공, 오류, 취소 모든 종료 경로에서 activeRequests를 감소시키세요.

### P1-26 — services/gateway/src/common/metrics/metrics.service.ts:48
- **category**: correctness
- **message**: SERVICE_NAME을 검증 없이 Prometheus metric name에 삽입해 하이픈 등 허용되지 않는 문자가 있으면 서비스 시작 시 메트릭 생성이 실패할 수 있습니다.
- **suggestion**: serviceName을 Prometheus 네이밍 규칙에 맞게 [a-zA-Z_:][a-zA-Z0-9_:]* 형태로 검증하거나 안전한 문자로 정규화하세요.

### P1-27 — services/gateway/src/common/middleware/request-id.middleware.ts:79
- **category**: security
- **message**: 클라이언트가 보낸 x-user-id 헤더를 신뢰해 그대로 로그에 남기므로 사용자 식별자 노출과 로그 오염이 발생할 수 있습니다.
- **suggestion**: 인증 미들웨어가 검증한 사용자 ID만 사용하고, 필요하지 않으면 userId 로그 필드를 제거하거나 해시/마스킹 처리하세요.

### P1-28 — services/gateway/src/common/middleware/security-headers.middleware.ts:32
- **category**: security
- **message**: CSP script-src에 'unsafe-inline'이 포함되어 XSS 발생 시 인라인 스크립트 실행을 차단하지 못합니다.
- **suggestion**: 인라인 스크립트를 제거하거나 nonce/hash 기반 CSP로 전환하고, 필요한 외부 스크립트만 allowlist에 유지하세요.

### P1-29 — services/gateway/src/common/types/identity.types.ts:35
- **category**: security
- **message**: 공용 IdentityUser 타입에 github_token이 포함되어 있어 이 타입이 API 응답 DTO로 재사용되면 GitHub 액세스 토큰이 외부로 노출될 수 있습니다.
- **suggestion**: 민감 필드는 내부 전용 타입으로 분리하고, 외부 응답 타입에서는 github_token을 제거하거나 명시적으로 omit 하세요.

### P1-30 — services/gateway/src/event-log/event-log.controller.ts:20
- **category**: security
- **message**: 이벤트 수집 엔드포인트에 인증, 서명 검증, 레이트 리밋이 없어 임의 클라이언트가 Redis와 로그 디스크를 채울 수 있습니다.
- **suggestion**: JWT/익명 세션 서명 검증과 Throttler 같은 레이트 리밋을 적용하고, 허용 출처 및 페이로드 크기를 제한하세요.

### P1-31 — services/gateway/src/event-log/event-log.controller.ts:21
- **category**: correctness
- **message**: body 또는 body.events가 배열이 아닌 객체일 때 slice 호출로 500 오류가 발생합니다.
- **suggestion**: Array.isArray(body?.events)로 먼저 검증하고, DTO와 ValidationPipe로 events 배열 및 각 이벤트 필드를 검증하세요.

### P1-32 — services/gateway/src/event-log/event-log.service.ts:73
- **category**: data-integrity
- **message**: 고정된 임시 Redis 키로 RENAME하고 파일 쓰기 전에 삭제하므로 이전 flush 잔여 데이터가 덮어써지거나 파일 쓰기 실패 시 이벤트가 유실될 수 있습니다.
- **suggestion**: flush마다 고유 임시 키를 사용하고, 파일 append가 성공한 뒤에만 Redis 데이터를 삭제하며 실패 시 원본 큐로 재삽입하거나 재시도 큐에 보존하세요.

### P1-33 — services/gateway/src/external/programmers.service.ts:167
- **category**: correctness
- **message**: 프로그래머스 JSON 로드 실패를 경고만 남기고 빈 캐시로 기동해 운영에서 모든 조회가 404가 되어도 배포가 성공한 것처럼 보입니다.
- **suggestion**: 운영 환경에서는 데이터 파일 누락이나 파싱 실패 시 부트스트랩을 실패시키고, 개발/테스트에서만 빈 캐시 허용 옵션을 두세요.

### P1-34 — services/gateway/src/identity-client/identity-client.service.ts:144
- **category**: security
- **message**: 내부 API 키가 설정되지 않아도 빈 문자열로 계속 동작해 잘못된 내부 인증 설정을 배포할 수 있습니다.
- **suggestion**: INTERNAL_KEY_IDENTITY 또는 INTERNAL_API_KEY를 getOrThrow로 필수화하고, 빈 문자열이면 부팅을 실패시키세요.

### P1-35 — services/gateway/src/identity-client/identity-client.service.ts:485
- **category**: security
- **message**: 재시도/에러 로그에 전체 URL을 기록하여 공유 토큰, 초대 코드 같은 민감한 path 값이 로그에 남을 수 있습니다.
- **suggestion**: 로그에는 라우트 템플릿이나 민감 값이 제거된 URL만 남기고 token/code/slug 등은 마스킹하세요.

### P1-36 — services/gateway/src/feedback/feedback.controller.ts:114
- **category**: performance
- **message**: 관리자 피드백 목록의 page/limit을 parseInt만 하고 범위 검증을 하지 않아 NaN, 음수, 과도한 limit이 하위 서비스로 전달될 수 있습니다.
- **suggestion**: ParseIntPipe와 DTO 검증을 사용해 page는 1 이상, limit은 상한이 있는 양의 정수로 제한하세요.

### P1-37 — services/gateway/src/health.controller.ts:15
- **category**: correctness
- **message**: readiness 엔드포인트가 의존 서비스 상태를 확인하지 않고 항상 ok를 반환해 장애 상태의 파드가 트래픽을 받을 수 있습니다.
- **suggestion**: Identity/Redis 등 필수 의존성 헬스 체크를 수행하고 실패 시 503을 반환하세요.

### P1-38 — services/gateway/src/internal/internal.controller.ts:62
- **category**: correctness
- **message**: 스터디 멤버십 조회에서 모든 예외를 삼켜 Identity 장애나 500 오류도 비멤버 404로 변환합니다.
- **suggestion**: NotFoundException만 404로 처리하고, 네트워크 오류나 5xx 계열 예외는 그대로 전파하세요.

### P1-39 — services/gateway/src/internal/internal.controller.ts:84
- **category**: correctness
- **message**: 스터디 조회에서 모든 예외를 삼켜 Identity 장애나 권한 오류도 스터디 없음 404로 변환합니다.
- **suggestion**: 404만 스터디 없음으로 변환하고 다른 예외는 원인 보존을 위해 재던지세요.

### P1-40 — services/gateway/src/rate-limit/rate-limit.middleware.ts:38
- **category**: security
- **message**: RateLimitMiddleware가 JwtMiddleware보다 먼저 실행되는데, 클라이언트가 보낸 x-user-id 헤더를 그대로 신뢰해 임의 사용자 ID로 rate limit을 우회할 수 있습니다.
- **suggestion**: JWT 검증 전에는 x-user-id를 사용하지 말고 IP 기반으로 제한하거나, JwtMiddleware 이후 별도 인증 사용자 제한을 적용하세요.

### P1-41 — services/gateway/src/proxy/proxy.module.ts:145
- **category**: correctness
- **message**: 프록시 오류 처리에서 res가 ServerResponse이면 status()가 없어 아무 응답도 보내지 않고 요청이 멈출 수 있습니다.
- **suggestion**: onError에서 res.writeHead(502, {'Content-Type':'application/json'}) 후 res.end(...)로 항상 응답을 종료하세요.

### P1-42 — services/gateway/src/notification/deadline-reminder.service.ts:176
- **category**: data-integrity
- **message**: 마감 알림 중복 방지가 GET 후 생성 후 SET 순서라 여러 인스턴스나 중복 Cron 실행 시 같은 알림이 중복 생성될 수 있습니다.
- **suggestion**: Redis SET key value NX EX ttl로 발송 권한을 원자적으로 선점한 뒤 알림을 생성하고, 실패 시 보상 삭제를 고려하세요.

### P1-43 — services/gateway/src/notification/deadline-reminder.service.ts:211
- **category**: correctness
- **message**: Submission 서비스 설정 누락이나 조회 실패를 빈 제출자 목록으로 처리해 모든 멤버에게 잘못된 미제출 알림을 보낼 수 있습니다.
- **suggestion**: 제출자 조회 실패는 []가 아니라 실패 상태로 반환하고 해당 문제의 알림 발송을 건너뛰세요.

### P1-44 — services/gateway/src/main.ts:53
- **category**: correctness
- **message**: CORS allowedHeaders에 Authorization이 없어 브라우저 클라이언트가 Bearer 토큰 인증 요청을 보낼 때 preflight가 실패할 수 있습니다.
- **suggestion**: Authorization을 허용 헤더에 추가하거나 쿠키 인증만 지원하도록 인증 방식을 명확히 제한하세요.

### P1-45 — services/gateway/src/main.ts:82
- **category**: correctness
- **message**: uncaughtException 리스너가 예외를 Sentry에만 전송하고 프로세스를 종료하지 않아 치명적 오류 후 손상된 상태로 계속 실행될 수 있습니다.
- **suggestion**: Sentry.flush 후 process.exit(1) 하거나 Nest 종료 훅을 거쳐 프로세스를 재시작하도록 처리하세요.

### P1-46 — services/gateway/src/review/review.controller.ts:164
- **category**: security
- **message**: 클라이언트가 보낸 x-study-id를 검증 없이 내부 서비스 신뢰 헤더로 전달합니다. 다운스트림이 이 값을 권한 판단에 사용하면 스터디 컨텍스트를 위조할 수 있습니다.
- **suggestion**: x-study-id는 요청 헤더를 그대로 신뢰하지 말고 라우트/토큰에서 검증된 값만 전달하거나 StudyMemberGuard로 멤버십을 확인한 뒤 전달하세요.

### P1-47 — services/gateway/src/share/public-profile.controller.ts:83
- **category**: performance
- **message**: 공개 프로필 조회에서 스터디 수만큼 멤버, 공유 링크, 통계 요청을 제한 없이 병렬 실행해 공개 엔드포인트 하나가 내부 서비스에 대량 fan-out 부하를 만들 수 있습니다.
- **suggestion**: 프로필용 집계 API를 추가하거나 스터디 수 제한, 페이지네이션, 동시성 제한(p-limit 등), 캐싱을 적용하세요.

### P1-48 — services/gateway/src/review/review.controller.ts:177
- **category**: performance
- **message**: Submission Service 프록시 fetch에 타임아웃이 없어 내부 서비스 지연 시 요청이 오래 붙잡혀 게이트웨이 리소스가 고갈될 수 있습니다.
- **suggestion**: AbortController 또는 공통 HTTP 클라이언트에 제한 시간을 설정하고 타임아웃 시 504 계열 오류로 변환하세요.

### P1-49 — services/gateway/src/share/public-share.controller.ts:96
- **category**: performance
- **message**: 공개 공유 프록시의 내부 서비스 fetch에 타임아웃이 없어 Problem/Submission 서비스 장애가 게이트웨이 요청 적체로 전파될 수 있습니다.
- **suggestion**: 공통 fetch 래퍼로 타임아웃, 재시도 정책, 오류 변환을 일관되게 적용하세요.

### P1-50 — services/gateway/src/share/share-link.service.ts:108
- **category**: correctness
- **message**: 프로필 설정 업데이트 시 Identity 서비스 DTO와 다른 필드명(publicId, is_profile_public)을 전송해 slug/공개 설정이 실제로 반영되지 않을 수 있습니다.
- **suggestion**: Identity 서비스 계약에 맞춰 profileSlug, isProfilePublic 필드로 전송하고 관련 테스트도 실제 API 계약 기준으로 수정하세요.

### P1-51 — services/gateway/src/sse/sse.controller.ts:118
- **category**: performance
- **message**: SSE cleanup이 heartbeat/connectionTimeout 선언 전에 정의된 변수를 참조해 조기 close 또는 예외 경로에서 초기화 전 접근으로 런타임 오류가 발생할 수 있습니다.
- **suggestion**: 타이머 핸들을 let으로 먼저 선언하고 cleanup에서 undefined 여부를 확인한 뒤 clear 하도록 변경하세요.

### P1-52 — services/gateway/src/sse/sse.controller.ts:171
- **category**: performance
- **message**: Redis 구독 등록을 await한 뒤 close 핸들러를 등록하므로 구독 중 클라이언트가 끊기면 리스너가 정리되지 않아 누수될 수 있습니다.
- **suggestion**: req.on('close', cleanup)을 구독 전에 등록하고, 구독 이후 이미 연결이 닫혔는지 확인해 즉시 cleanup 하세요.

### P1-53 — services/gateway/src/sse/sse.controller.ts:239
- **category**: performance
- **message**: 제출물 소유권 확인 fetch에 타임아웃이 없어 Submission Service 지연 시 SSE 요청이 무기한 대기할 수 있습니다.
- **suggestion**: AbortController 또는 공통 HTTP 클라이언트 타임아웃을 적용하고 시간 초과 시 명확한 504/403 응답으로 처리하세요.

### P1-54 — services/gateway/src/sse/sse.controller.ts:292
- **category**: performance
- **message**: 알림 SSE cleanup도 타이머 선언 전 변수를 참조해 조기 close 경로에서 초기화 전 접근 오류가 발생할 수 있습니다.
- **suggestion**: heartbeat와 connectionTimeout을 let으로 선선언하고 cleanup에서 존재할 때만 clear 하도록 수정하세요.

### P1-55 — services/gateway/src/sse/sse.controller.ts:313
- **category**: performance
- **message**: 알림 SSE도 Redis 구독 완료 후 close 핸들러를 등록해 구독 중 연결 종료 시 채널 리스너가 남을 수 있습니다.
- **suggestion**: close 핸들러를 addChannelListener 호출 전에 등록하고 연결 종료 상태를 확인해 누수를 방지하세요.

### P1-56 — services/gateway/src/study-note/study-note.controller.ts:97
- **category**: performance
- **message**: Submission Service 프록시 fetch에 타임아웃이 없어 upstream 지연 시 요청이 무기한 대기할 수 있습니다.
- **suggestion**: AbortController 기반 타임아웃 또는 공통 HTTP 클라이언트 타임아웃을 적용하세요.

### P1-57 — services/gateway/src/study/invite-throttle.service.ts:47
- **category**: security
- **message**: 초대코드 실패 카운터가 IP와 코드 조합별로만 증가해 공격자가 매번 다른 코드를 시도하면 잠금 임계값에 도달하지 않습니다.
- **suggestion**: IP 단위 실패 카운터 또는 슬라이딩 윈도우를 추가하고, 필요하면 IP+코드 카운터와 병행해 전체 초대코드 추측 시도를 제한하세요.

### P1-58 — services/gateway/src/study/study.service.ts:354
- **category**: data-integrity
- **message**: 초대 가입에서 현재 인원과 초대 사용 횟수를 조회한 뒤 별도 호출로 멤버 추가/사용 처리하여 동시 가입 시 50명 제한 또는 max_uses를 초과할 수 있습니다.
- **suggestion**: Identity 서비스에 조건부 멤버 추가와 초대 사용 증가를 하나의 트랜잭션/원자적 엔드포인트로 묶고, DB 제약으로 최대 인원과 사용 횟수를 보장하세요.

### P1-59 — services/gateway/src/study/study.service.ts:360
- **category**: data-integrity
- **message**: 멤버 추가 후 consumeInvite가 실패하면 사용 횟수는 증가하지 않았는데 사용자는 가입된 상태로 남아 초대 데이터가 불일치할 수 있습니다.
- **suggestion**: 멤버 추가와 초대 소비를 같은 트랜잭션에서 처리하거나 실패 시 보상 삭제를 수행하는 서버 측 원자 작업으로 변경하세요.

### P1-60 — services/gateway/src/study/study.service.ts:617
- **category**: data-integrity
- **message**: 마지막 ADMIN 보호 로직이 조회 후 변경 방식이라 역할 변경/탈퇴/추방이 동시에 실행되면 ADMIN이 0명이 되는 경쟁 조건이 발생할 수 있습니다.
- **suggestion**: ADMIN 수 검증과 역할 변경 또는 멤버 제거를 Identity 서비스의 단일 트랜잭션으로 처리하고, 최소 1명 ADMIN 제약을 DB 레벨에서도 보장하세요.

### P1-61 — services/gateway/src/study/study.service.ts:183
- **category**: performance
- **message**: 스터디 삭제 시 Redis KEYS 명령을 사용해 전체 키스페이스를 스캔하므로 운영 Redis에서 이벤트 루프를 장시간 블로킹할 수 있습니다.
- **suggestion**: SCAN 기반 반복 삭제나 스터디별 캐시 키 set을 유지해 비차단 방식으로 삭제하세요.

### P1-62 — services/gateway/src/study/study.service.ts:423
- **category**: performance
- **message**: 내부 서비스 fetch 호출에 타임아웃이 없어 Submission 서비스가 응답하지 않으면 Gateway 요청이 무기한 대기할 수 있습니다.
- **suggestion**: AbortController 또는 HTTP 클라이언트 timeout을 적용하고, 타임아웃 시 명확한 503 계열 예외로 변환하세요.

### P1-63 — services/gateway/src/study/study.service.ts:501
- **category**: performance
- **message**: Problem 서비스 호출에도 타임아웃이 없어 장애 시 통계 요청 처리 자원이 장시간 점유될 수 있습니다.
- **suggestion**: 내부 서비스 호출 공통 유틸에 제한 시간, 재시도 정책, 회로 차단을 두고 fetchActiveProblemIds에도 적용하세요.

### P1-64 — services/gateway/src/study/study.service.ts:475
- **category**: correctness
- **message**: Submission 서비스 응답을 검증하지 않고 data.byMember.map을 호출해 byMember가 누락되거나 null이면 런타임 예외가 발생합니다.
- **suggestion**: 응답 DTO/schema 검증을 추가하고 배열 필드는 Array.isArray 확인 후 기본값을 사용하거나 잘못된 응답을 502로 처리하세요.

## P2 (비차단)

### P2-01 — services/gateway/src/auth/oauth/oauth.service.ts:298
- **category**: security
- **message**: GitHub OAuth scope가 repo로 설정되어 모든 공개/비공개 저장소 권한을 요청하므로 권한 범위가 과도합니다.
- **suggestion**: 실제 기능에 필요한 최소 scope로 줄이거나 GitHub App 설치 권한처럼 저장소 단위로 제한되는 방식으로 전환하세요.

### P2-02 — services/gateway/src/auth/oauth/oauth.controller.ts:287
- **category**: data-integrity
- **message**: avatar_url이 preset: 접두사와 길이만 검증되어 허용되지 않은 프리셋 값도 저장될 수 있습니다.
- **suggestion**: 서버에서 허용하는 preset ID 목록 또는 정규식으로 검증하고 알 수 없는 값은 거부하세요.

### P2-03 — services/gateway/src/common/guards/internal-key.guard.ts:65
- **category**: security
- **message**: 키 길이가 다르면 즉시 false를 반환해 비교 시간이 달라지므로 내부 키 길이 정보가 노출될 수 있습니다.
- **suggestion**: 고정 길이 HMAC 또는 해시값을 만든 뒤 timingSafeEqual로 비교해 길이 차이에 따른 조기 반환을 없애세요.

### P2-04 — services/gateway/src/avatar/avatar.service.ts:79
- **category**: correctness
- **message**: Magic Byte는 맞지만 손상된 이미지가 들어오면 sharp 오류가 그대로 전파되어 사용자 입력 오류가 500 응답으로 처리될 수 있습니다.
- **suggestion**: resizeImage 호출을 try/catch로 감싸 sharp 파싱 실패를 BadRequestException으로 변환하세요.

### P2-05 — services/gateway/src/event-log/event-log.service.ts:91
- **category**: performance
- **message**: Cron 작업에서 mkdirSync와 appendFileSync를 사용해 이벤트 루프를 블로킹하며, 이벤트가 많이 쌓이면 게이트웨이 요청 처리 지연이 발생할 수 있습니다.
- **suggestion**: fs.promises 또는 스트림 기반 비동기 파일 쓰기로 변경하고 flush 배치 크기를 제한하세요.

### P2-06 — services/gateway/src/event-log/event-log.service.ts:70
- **category**: maintainability
- **message**: flushToFile 메서드가 Redis 키 이동, 조회, 삭제, 파일 I/O, 오류 처리를 모두 포함해 20라인을 초과하고 장애 처리 흐름을 검증하기 어렵습니다.
- **suggestion**: Redis drain, NDJSON 생성, 파일 append, 실패 복구를 별도 메서드로 분리하고 각 단계별 단위 테스트를 추가하세요.

### P2-07 — services/gateway/src/external/programmers.service.ts:147
- **category**: data-integrity
- **message**: JSON 스냅샷을 타입 단언만 하고 스키마 검증 없이 캐시에 적재해 tags가 배열이 아니거나 필드가 누락되면 검색 중 런타임 오류가 발생할 수 있습니다.
- **suggestion**: zod/class-validator 등으로 problemId, title, level, tags, sourceUrl, category 스키마를 검증한 뒤 유효한 항목만 적재하거나 로드를 실패시키세요.

### P2-08 — services/gateway/src/external/programmers.service.ts:143
- **category**: maintainability
- **message**: loadFromFile 메서드가 파일 읽기, JSON 파싱, 포맷 호환 처리, 캐시 변환, 로깅을 모두 포함해 20라인을 초과합니다.
- **suggestion**: 파일 읽기, envelope 정규화, 항목 검증/변환, 캐시 교체를 작은 함수로 분리하세요.

### P2-09 — services/gateway/src/external/solvedac.service.ts:154
- **category**: correctness
- **message**: Solved.ac 응답 구조를 검증하지 않아 tags가 없거나 배열이 아니면 런타임 TypeError가 발생합니다.
- **suggestion**: JSON 파싱 후 problemId/titleKo/level/tags 타입을 검증하고 잘못된 응답은 ServiceUnavailableException으로 처리하세요.

### P2-10 — services/gateway/src/external/solvedac.service.ts:173
- **category**: correctness
- **message**: 검색 응답의 items가 배열인지 확인하지 않고 map을 호출해 외부 API 응답 변경 시 500 오류가 발생할 수 있습니다.
- **suggestion**: body.items가 배열인지 검증한 뒤 매핑하고, 유효하지 않으면 외부 API 응답 오류로 처리하세요.

### P2-11 — services/gateway/src/feedback/feedback.controller.ts:149
- **category**: data-integrity
- **message**: 피드백 상태 변경 body가 DTO 검증 없이 임의의 status 문자열을 하위 서비스로 전달합니다.
- **suggestion**: UpdateFeedbackStatusDto를 만들고 허용된 상태 enum만 통과하도록 IsEnum 검증을 적용하세요.

### P2-12 — services/gateway/src/feedback/feedback.controller.ts:167
- **category**: correctness
- **message**: user.email이 없거나 문자열이 아니면 toLowerCase 호출로 500 오류가 발생합니다.
- **suggestion**: email 타입을 확인하고 없으면 ForbiddenException 또는 UnauthorizedException으로 명시 처리하세요.

### P2-13 — services/gateway/src/identity-client/identity-client.service.ts:194
- **category**: security
- **message**: slug를 encodeURIComponent 없이 path에 삽입해 슬래시나 쿼리 문자가 포함되면 의도치 않은 Identity 라우트로 요청될 수 있습니다.
- **suggestion**: 동적 path segment는 모두 encodeURIComponent로 인코딩하거나 호출 전에 허용 문자 패턴으로 검증하세요.

### P2-14 — services/gateway/src/identity-client/identity-client.service.ts:308
- **category**: security
- **message**: 초대 코드를 encodeURIComponent 없이 path에 삽입해 특수문자 포함 시 라우팅이 변조될 수 있습니다.
- **suggestion**: code를 path에 넣기 전에 encodeURIComponent를 적용하고 초대 코드 형식도 검증하세요.

### P2-15 — services/gateway/src/identity-client/identity-client.service.ts:449
- **category**: security
- **message**: 공유 링크 토큰을 encodeURIComponent 없이 path에 삽입해 토큰에 /, ?, # 등이 포함되면 다른 경로 또는 쿼리로 해석될 수 있습니다.
- **suggestion**: token을 encodeURIComponent로 인코딩하거나 토큰을 쿼리/본문으로 전달하는 API로 변경하세요.

### P2-16 — services/gateway/src/identity-client/identity-client.service.ts:561
- **category**: correctness
- **message**: Identity 서비스의 401 응답을 default로 처리해 클라이언트에 500을 반환합니다.
- **suggestion**: 401 상태는 UnauthorizedException으로 매핑해 인증 실패 의미를 보존하세요.

### P2-17 — services/gateway/src/proxy/proxy.module.ts:70
- **category**: security
- **message**: 라우팅 판별에 startsWith만 사용해 /api/problems-extra 같은 의도하지 않은 경로도 /api/problems 서비스로 프록시될 수 있습니다.
- **suggestion**: prefix와 정확히 일치하거나 prefix 뒤가 '/'인 경우에만 매칭하도록 경계 검사를 추가하세요.

### P2-18 — services/gateway/src/notification/notification.service.ts:90
- **category**: performance
- **message**: 알림 목록 조회가 페이지네이션이나 limit 파라미터 없이 전체 사용자 알림을 요청할 수 있어 데이터가 많아지면 응답이 느려질 수 있습니다.
- **suggestion**: Gateway에서 limit=50 같은 명시적 제한과 커서/페이지 파라미터를 Identity API에 전달하세요.

### P2-19 — services/gateway/src/notification/deadline-reminder.service.ts:73
- **category**: correctness
- **message**: 24시간 조회 범위가 now~24h라 1시간 이내 문제도 포함되어 같은 Cron 실행에서 24h 알림과 1h 알림을 모두 받을 수 있습니다.
- **suggestion**: 24h 알림 범위를 1h~24h 또는 별도 시간 버킷으로 분리해 중복 긴급도 알림을 방지하세요.

### P2-20 — services/gateway/src/notification/deadline-reminder.service.ts:171
- **category**: performance
- **message**: 미제출자별 Redis 조회, 알림 생성, Redis SET을 모두 순차 실행해 대형 스터디에서 Cron 처리 시간이 선형으로 길어집니다.
- **suggestion**: 동시성 제한이 있는 Promise pool과 Redis mget/pipeline을 사용해 배치 처리하세요.

### P2-21 — services/gateway/src/notification/notification.service.ts:28
- **category**: performance
- **message**: Redis publisher 연결을 생성하지만 모듈 종료 시 quit하지 않아 테스트나 재시작 과정에서 연결이 누수될 수 있습니다.
- **suggestion**: OnModuleDestroy를 구현하고 redisPublisher.quit()을 호출하세요.

### P2-22 — services/gateway/src/notification/notification.service.ts:144
- **category**: maintainability
- **message**: 알림 정리 Cron에서 Identity 호출 실패를 잡지 않아 스케줄러 오류가 서비스 로그와 제어 흐름에서 분리되지 않습니다.
- **suggestion**: try/catch로 실패를 구조화 로그로 남기고 다음 Cron 실행에 영향이 없도록 처리하세요.

### P2-23 — services/gateway/src/proxy/proxy.module.ts:35
- **category**: performance
- **message**: HealthController가 Redis 연결을 보유하지만 종료 훅에서 닫지 않아 애플리케이션 종료 시 연결이 남을 수 있습니다.
- **suggestion**: OnModuleDestroy를 구현해 this.redis.quit()을 호출하세요.

### P2-24 — services/gateway/src/rate-limit/redis-throttler.storage.ts:85
- **category**: correctness
- **message**: Redis pipeline.exec()의 개별 명령 오류를 확인하지 않아 ZCARD 실패가 totalHits=0처럼 처리되어 제한이 우회될 수 있습니다.
- **suggestion**: results 각 항목의 error를 검사하고 오류가 있으면 fallback으로 전환하거나 예외를 발생시키세요.

### P2-25 — services/gateway/src/share/public-profile.controller.ts:112
- **category**: correctness
- **message**: 전체 averageAiScore를 스터디별 평균의 단순 평균으로 계산해 제출 수가 다른 스터디가 동일 가중치를 갖는 잘못된 전체 평균이 됩니다.
- **suggestion**: 스터디별 점수 합계와 제출 수를 함께 받아 제출 수로 가중 평균을 계산하거나 백엔드 집계 API에서 전체 평균을 직접 반환하세요.

### P2-26 — services/gateway/src/review/review.controller.ts:187
- **category**: correctness
- **message**: 204가 아닌 모든 응답을 무조건 JSON으로 파싱해 빈 본문이나 비JSON 오류 응답이 오면 원래 상태 코드 대신 500으로 변환됩니다.
- **suggestion**: content-type과 본문 길이를 확인한 뒤 JSON을 파싱하고, 파싱 실패 시에도 원래 response.status를 보존해 HttpException을 생성하세요.

### P2-27 — services/gateway/src/share/public-share.controller.ts:160
- **category**: correctness
- **message**: Submission Service 응답에 data가 없으면 sub.aiFeedback 접근에서 런타임 예외가 발생합니다.
- **suggestion**: result.data 존재 여부를 확인하고 없으면 NotFoundException 또는 BadGatewayException으로 명확히 처리하세요.

### P2-28 — services/gateway/src/share/share-link.service.ts:68
- **category**: data-integrity
- **message**: deactivateShareLink가 studyId를 인자로 받지만 사용하지 않아 요청 경로의 스터디와 링크의 소속 일치 여부를 보장하지 못합니다.
- **suggestion**: 비활성화 전에 linkId가 studyId에 속하는지 검증하거나 Identity API에 studyId를 함께 전달해 소속 조건으로 처리하세요.

### P2-29 — services/gateway/src/sse/sse.controller.ts:52
- **category**: correctness
- **message**: ai_failed 상태가 AI_COMPLETED 알림 타입으로 매핑되어 실패 알림이 완료 알림으로 저장됩니다.
- **suggestion**: 실패 전용 NotificationType을 추가하거나 기존 타입 중 실패를 의미하는 타입으로 매핑하세요.

### P2-30 — services/gateway/src/sse/sse.controller.ts:94
- **category**: maintainability
- **message**: streamStatus 함수가 20줄을 크게 초과해 인증, 소유권 확인, SSE 전송, 알림 생성, cleanup 책임이 한 곳에 섞여 있습니다.
- **suggestion**: 토큰 검증, SSE 연결 초기화, 메시지 처리, cleanup 생성을 별도 private 메서드로 분리하세요.

### P2-31 — services/gateway/src/sse/sse.controller.ts:273
- **category**: maintainability
- **message**: streamNotifications 함수가 20줄을 초과하고 streamStatus와 타이머/cleanup/heartbeat 로직이 중복됩니다.
- **suggestion**: 공통 SSE 연결 관리 헬퍼를 만들어 채널명과 메시지 핸들러만 주입하도록 정리하세요.

### P2-32 — services/gateway/src/study-note/study-note.controller.ts:48
- **category**: data-integrity
- **message**: 스터디 노트 upsert 요청 본문을 unknown으로 받아 Gateway 레벨에서 필수 필드나 허용 필드를 검증하지 않습니다.
- **suggestion**: 전용 DTO를 정의하고 ValidationPipe가 적용되도록 Body 타입과 class-validator 규칙을 추가하세요.

### P2-33 — services/gateway/src/study-note/study-note.controller.ts:107
- **category**: correctness
- **message**: 모든 upstream 응답을 무조건 JSON으로 파싱해 빈 본문 또는 비JSON 오류 응답이 502로 오분류될 수 있습니다.
- **suggestion**: Content-Type과 본문 존재 여부를 확인한 뒤 JSON 파싱하고, 파싱 실패 시 원래 HTTP 상태를 보존하세요.

### P2-34 — services/gateway/src/study-note/study-note.controller.ts:74
- **category**: maintainability
- **message**: proxyToSubmission 함수가 20줄을 크게 초과하며 헤더 구성, fetch, 응답 파싱, 에러 변환 책임이 한 함수에 집중되어 있습니다.
- **suggestion**: 헤더 생성, upstream 호출, 응답/에러 변환을 작은 private 메서드로 분리하세요.

### P2-35 — services/gateway/src/study/dto/create-study.dto.ts:17
- **category**: data-integrity
- **message**: description에 길이 제한이 없어 과도하게 큰 문자열이 DB 저장 및 응답 처리 비용을 증가시킬 수 있습니다.
- **suggestion**: 제품 요구사항에 맞는 MaxLength를 추가하고 Swagger maxLength도 함께 명시하세요.

### P2-36 — services/gateway/src/study/dto/create-study.dto.ts:22
- **category**: data-integrity
- **message**: githubRepo가 문자열 길이만 검증하고 URL 형식이나 GitHub 저장소 URL 여부를 검증하지 않습니다.
- **suggestion**: IsUrl 및 GitHub repo URL 패턴 검증을 추가하거나 서비스 레이어에서 정규화/검증하세요.

### P2-37 — services/gateway/src/study/dto/create-study.dto.ts:29
- **category**: data-integrity
- **message**: name과 nickname은 공백 문자열만으로도 IsNotEmpty를 통과할 수 있어 표시상 빈 값이 저장될 수 있습니다.
- **suggestion**: Transform으로 trim한 뒤 Matches(/\S/) 또는 MinLength를 적용해 실질 내용이 있는지 검증하세요.

### P2-38 — services/gateway/src/study/dto/join-study.dto.ts:14
- **category**: data-integrity
- **message**: 초대 코드에 길이 제한과 형식 검증이 없어 비정상적으로 긴 문자열이나 잘못된 형식이 Redis 키와 하위 조회로 전달됩니다.
- **suggestion**: 초대 코드 정책에 맞춰 @MaxLength와 @Matches 또는 전용 검증 데코레이터를 추가하세요.

### P2-39 — services/gateway/src/study/dto/verify-invite.dto.ts:14
- **category**: data-integrity
- **message**: 초대 코드 검증 DTO가 문자열 여부만 확인해 잘못된 형식의 코드도 서비스 레이어로 전달됩니다.
- **suggestion**: JoinStudyDto와 동일한 @MaxLength 및 형식 검증을 적용해 초대 코드 입력 범위를 제한하세요.

### P2-40 — services/gateway/src/study/dto/notify-problem.dto.ts:14
- **category**: data-integrity
- **message**: problemId가 UUID라고 문서화되어 있지만 @IsString만 적용되어 잘못된 ID가 알림 생성 로직으로 전달될 수 있습니다.
- **suggestion**: @IsUUID('4') 또는 프로젝트에서 사용하는 UUID 버전에 맞는 검증을 적용하세요.

### P2-41 — services/gateway/src/study/dto/notify-problem.dto.ts:19
- **category**: data-integrity
- **message**: problemTitle에 길이 제한이 없어 과도하게 긴 제목이 알림 저장소와 응답 페이로드에 전달될 수 있습니다.
- **suggestion**: 도메인 정책에 맞는 @MaxLength를 추가하고 프론트엔드 표시 한계와 일치시키세요.

### P2-42 — services/gateway/src/study/dto/update-study.dto.ts:20
- **category**: data-integrity
- **message**: description 필드에 길이 제한이 없어 큰 본문이 그대로 하위 서비스에 전달될 수 있습니다.
- **suggestion**: 스터디 설명 최대 길이를 정하고 @MaxLength를 추가하세요.

### P2-43 — services/gateway/src/study/dto/update-study.dto.ts:15
- **category**: data-integrity
- **message**: name이 제공된 경우 빈 문자열이나 공백만 있는 문자열도 통과할 수 있어 스터디 이름을 무효한 값으로 변경할 수 있습니다.
- **suggestion**: @IsNotEmpty와 trim 변환 또는 공백 전용 문자열을 거부하는 @Matches(/\S/) 검증을 추가하세요.

### P2-44 — services/gateway/src/study/study.service.ts:540
- **category**: performance
- **message**: 멤버 목록 조회가 각 멤버마다 findUserById를 호출하는 N+1 패턴이라 멤버 수가 늘수록 지연과 Identity 서비스 부하가 증가합니다.
- **suggestion**: Identity 서비스에 사용자 정보를 포함한 멤버 목록 또는 userIds 배치 조회 API를 추가해 단일 호출로 보강하세요.

## Low (선택적 개선)

### Low-01 — services/gateway/src/study/dto/update-ground-rules.dto.ts:11
- **category**: convention
- **message**: Swagger 문서의 maxLength는 500이지만 실제 검증은 5000자로 서로 달라 API 계약이 혼동됩니다.
- **suggestion**: ApiProperty의 maxLength와 주석을 실제 @MaxLength 값과 동일하게 맞추세요.

