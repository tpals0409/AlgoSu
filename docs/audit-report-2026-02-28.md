# AlgoSu 프로젝트 전수 문제점 분석 보고서

**일자**: 2026-02-28
**분석 주체**: TF 9명 전원 (Gatekeeper, Librarian, Conductor, Architect, Postman, Curator, Sensei, Palette, Herald)
**총괄**: Oracle (심판관)
**교차 검증**: 동일 이슈를 독립적으로 발견한 Agent 수 표기

---

## CRITICAL (즉시 수정 필요) — 8건

| # | 이슈 | 교차검증 | 발견자 |
|---|------|---------|--------|
| C1 | **Identity 서비스 email/password 코드 존재 — 소셜로그인 전용 정책 위반** | **4명** | Gatekeeper, Librarian, Postman, Sensei |
| C2 | **User 엔티티 2벌 (Identity vs Gateway) — 같은 DB에 다른 스키마** | **3명** | Gatekeeper, Librarian, Sensei |
| C3 | **GitHub Worker 콜백 4개 엔드포인트 미구현 → Saga 영구 정체** | **3명** | Conductor, Postman, Herald |
| C4 | **GitHub Worker → Gateway 스터디 조회 엔드포인트 누락 → Push 전체 불가** | **1명** | Postman |
| C5 | **Identity RollingUpdate maxUnavailable:1 → replica 1에서 무중단 배포 불가** | **1명** | Architect |
| C6 | **Gateway가 identity_db 직접 접근 — Sprint 3-3 DB 분리 최대 블로커** | **1명** | Architect |
| C7 | **Frontend SSE 환경변수명 불일치 (NEXT_PUBLIC_API_URL vs API_BASE_URL)** | **1명** | Palette |
| C8 | **Submission data-source.ts 기본 포트 6432 (PgBouncer 미배포)** | **2명** | Architect, Librarian |

### C1. Identity 서비스 email/password 코드 존재 — 소셜로그인 전용 정책 위반

- **파일**: `services/identity/src/auth/auth.controller.ts`, `auth.service.ts`, `auth.dto.ts`, `auth.service.spec.ts`
- **상세**: PM 확정 정책은 **소셜로그인(OAuth) 전용**. Sprint 3-2에서 범용 Agent가 skill 없이 email/password 기반 register/login을 구현. `POST /register`, `POST /login` 엔드포인트가 노출됨.
- **영향**: 보안 정책 위반. 의도하지 않은 인증 경로가 프로덕션에 노출 위험.
- **권장**: auth.controller.ts, auth.service.ts, auth.dto.ts, auth.module.ts에서 register/login 관련 코드 전면 제거.

### C2. User 엔티티 2벌 (Identity vs Gateway) — 같은 DB에 다른 스키마

- **파일**: `services/identity/src/user/user.entity.ts` vs `services/gateway/src/auth/oauth/user.entity.ts`
- **상세**: Identity 엔티티는 `username`, `password_hash`, `role` (email/password 스키마). Gateway 엔티티는 `name`, `avatar_url`, `oauth_provider`, `github_connected` (OAuth 스키마). 마이그레이션 `1700000400000`은 Gateway 스키마와 일치.
- **영향**: Identity 서비스의 User 쿼리가 런타임에 "column does not exist" 에러 발생.
- **권장**: Identity의 user.entity.ts를 OAuth 스키마(마이그레이션/Gateway 기준)로 재작성.

### C3. GitHub Worker 콜백 4개 엔드포인트 미구현 → Saga 영구 정체

- **파일**: `services/github-worker/src/status-reporter.ts:58-106` (호출측), `services/submission/src/submission/submission-internal.controller.ts` (수신측 — 미구현)
- **상세**: StatusReporter가 호출하는 4개 엔드포인트가 Submission InternalController에 없음:
  - `POST /internal/:id/github-success`
  - `POST /internal/:id/github-failed`
  - `POST /internal/:id/github-token-invalid`
  - `POST /internal/:id/github-skipped`
- **영향**: GitHub Push 결과 보고 불가 → Saga가 GITHUB_QUEUED에서 영구 정체 → AI 분석 큐 발행 안 됨.
- **권장**: SubmissionInternalController에 POST 4개 엔드포인트 추가 + SagaOrchestratorService 연동.

### C4. GitHub Worker → Gateway 스터디 조회 엔드포인트 누락

- **파일**: `services/github-worker/src/worker.ts:96-112` (호출측), `services/gateway/src/internal/internal.controller.ts` (수신측 — 미구현)
- **상세**: GitHub Worker가 `GET /internal/studies/:studyId`를 호출하여 스터디의 `github_repo`를 조회하지만, Gateway InternalController에 해당 엔드포인트 없음 (멤버십 확인만 존재).
- **영향**: GitHub Push 자체가 불가. 모든 제출의 GitHub 동기화 실패.
- **권장**: Gateway InternalController에 `GET /internal/studies/:studyId` 엔드포인트 추가.

### C5. Identity RollingUpdate maxUnavailable:1 → 무중단 배포 불가

- **파일**: `infra/k3s/identity-service.yaml:16-17`
- **상세**: `maxUnavailable: 1, maxSurge: 0` — replica 1 환경에서 기존 Pod를 먼저 죽인 후 신규 Pod를 띄움.
- **비교**: gateway, submission, problem은 모두 `maxUnavailable: 0, maxSurge: 1` (정상).
- **권장**: `maxUnavailable: 0, maxSurge: 1`로 수정.

### C6. Gateway가 identity_db 직접 접근 — Sprint 3-3 DB 분리 최대 블로커

- **파일**: `services/gateway/src/app.module.ts:28-41`
- **상세**: Gateway가 `IDENTITY_DB_*` 환경변수로 identity_db에 직접 TypeORM 연결. User, Study, StudyMember, StudyInvite, Notification 5개 엔티티를 직접 조작.
- **영향**: Identity DB 물리 분리 시 Gateway도 DB 연결 정보 변경 필요. API 전환(직접 DB → HTTP API) 미완료.
- **권장**: Sprint 3-3 시 Gateway → Identity API 전환 필수 선행.

### C7. Frontend SSE 환경변수명 불일치

- **파일**: `frontend/src/hooks/useSubmissionSSE.ts:42`
- **상세**: `process.env.NEXT_PUBLIC_API_URL` 사용. `.env.example`과 `next.config.ts`에서는 `NEXT_PUBLIC_API_BASE_URL`로 정의.
- **영향**: SSE 연결이 런타임에 실패 (fallback `http://localhost:3000`으로만 동작).
- **권장**: 환경변수명 통일 (`NEXT_PUBLIC_API_BASE_URL`).

### C8. Submission data-source.ts 기본 포트 6432

- **파일**: `services/submission/src/database/data-source.ts:6`
- **상세**: 기본값 6432 (PgBouncer 포트)이나 현재 PgBouncer 미배포. 환경변수 미설정 시 연결 실패.
- **비교**: Problem(5432), Identity(ConfigService 5432) 모두 정상.
- **권장**: 기본값 5432로 수정.

---

## HIGH (조속한 수정 필요) — 16건

### H1. SSE 엔드포인트 인증 부재 — IDOR 위험 (3명: Gatekeeper, Postman, Herald)

- **파일**: `services/gateway/src/sse/sse.controller.ts:15-16`, `app.module.ts:93`
- **상세**: JWT 미들웨어에서 SSE 경로 제외. submissionId(UUID)만 알면 타인의 제출 상태 감시 가능.
- **권장**: SSE 연결 시 JWT 또는 쿼리 토큰 기반 인증 + 구독자 == 제출자 검증.

### H2. MetricsService serviceName 'gateway' 하드코딩 (2명: Architect, Sensei)

- **파일**: `services/identity/src/common/metrics/metrics.service.ts:43`, `services/problem/src/common/metrics/metrics.service.ts:43`, `services/submission/src/common/metrics/metrics.service.ts:43`
- **상세**: Identity, Problem, Submission 서비스 fallback 기본값이 모두 `'gateway'`. Prometheus 메트릭이 모두 `algosu_gateway_*`로 수집.
- **권장**: 각 서비스에 맞는 기본값 (`'identity'`, `'problem'`, `'submission'`).

### H3. GitHub Worker console.log 13건 (3명: Conductor, Postman, Sensei)

- **파일**: `worker.ts:68,75,80,83,125,172,184,193,211`, `github-push.service.ts:82`, `status-reporter.ts:116,135`, `token-manager.ts:118`
- **상세**: 구조화 로거(`logger.ts`)가 이미 구현되어 있으나 worker.ts 등에서 `console.log` 직접 사용. Loki/Promtail JSON 파싱 불가.
- **권장**: 모든 console.* → `logger.info()`, `logger.warn()`, `logger.error()` 교체.

### H4. OAuth 콜백 토큰 URL query parameter 노출 (2명: Gatekeeper, Palette)

- **파일**: `services/gateway/src/auth/oauth/oauth.controller.ts:55-62`, `frontend/src/app/(auth)/callback/page.tsx:15-17`
- **상세**: `res.redirect(...?access_token=...&refresh_token=...)` — URL에 토큰이 브라우저 히스토리, 서버 로그, Referrer 헤더에 노출.
- **권장**: fragment 방식(`#token=...`) 또는 임시 코드 발급 후 POST 교환.

### H5. GitHub 연동 state=userId — CSRF 방지 실패 (1명: Gatekeeper)

- **파일**: `services/gateway/src/auth/oauth/oauth.service.ts:274`
- **상세**: OAuth state에 userId를 직접 사용. state 검증 없음 (Redis 저장/검증 미구현).
- **권장**: 다른 OAuth provider처럼 Redis에 random state 저장 + userId 매핑.

### H6. Submission weekNumber 컬럼 Entity 누락 (1명: Conductor)

- **파일**: `services/submission/src/submission/submission.service.ts:126`
- **상세**: 페이지네이션에서 `s.weekNumber`로 필터링하지만 submission.entity.ts에 `weekNumber` 컬럼 없음.
- **영향**: weekNumber 필터 사용 시 런타임 QueryBuilder 에러.

### H7. Reconciliation 불일치 시 전환 차단 미구현 (1명: Curator)

- **파일**: `services/problem/src/database/reconciliation.service.ts:75-79`
- **상세**: 기획서 "불일치 발견 시 2단계 전환 차단 플래그 설정" 명시. 현재 mismatchCount 로그만 기록.
- **권장**: mismatch > 0 시 readRepo 전환 차단 또는 Prometheus gauge 메트릭 expose.

### H8. Dual Write 모니터링 메트릭 4개 미구현 (1명: Curator)

- **파일**: `services/problem/src/database/dual-write.service.ts`
- **상세**: 기획서에 4개 메트릭 정의 (`dual_write_total`, `dual_write_latency_seconds`, `reconciliation_mismatches`, `reconciliation_runs_total`). 현재 HTTP 메트릭만 존재.
- **영향**: 운영 중 Dual Write 실패/지연 감지 불가.

### H9. Sealed Secret 템플릿 vs 실제 키 목록 불일치 (1명: Architect)

- **파일**: `infra/sealed-secrets/sealed-secrets-template.yaml` vs `infra/sealed-secrets/generated/`
- **상세**: 템플릿 identity-service-secrets 6키 vs 실제 7키, gateway-secrets 11키 vs 실제 25키+.
- **권장**: 템플릿을 실제 운영 키 목록으로 업데이트.

### H10. Identity/Submission/Problem 구조화 로거 미적용 (1명: Sensei)

- **상세**: Gateway만 `StructuredLoggerService` 구현. 나머지 3개 NestJS 서비스는 기본 Logger (plaintext). Loki 파이프라인 불일치.
- **권장**: Gateway의 StructuredLoggerService를 공통 모듈로 추출하여 전 서비스 적용.

### H11. maxQueryExecutionTime 전 서비스 1000ms (1명: Sensei)

- **파일**: Gateway, Identity, Problem, Submission의 `app.module.ts`
- **상세**: 모니터링 로그 규칙 §8-1은 **200ms** 임계값 명시. 현재 전 서비스 1000ms.
- **권장**: `maxQueryExecutionTime: 200` 으로 변경.

### H12. Submission IDOR 방지 HTTP 200에 403 body 반환 (1명: Postman)

- **파일**: `services/submission/src/submission/submission.controller.ts:80-81,99-100`
- **상세**: `return { statusCode: 403, message: ... }` — HTTP 200으로 응답하면서 body에만 403.
- **권장**: `throw new ForbiddenException(...)` 으로 변경.

### H13. GitHub Worker 헬스체크 부실 (1명: Architect)

- **파일**: `infra/k3s/github-worker.yaml:39-43`
- **상세**: `node -e 'process.exit(0)'` — Node.js 런타임 존재만 확인. RabbitMQ 연결 단절 감지 불가.
- **권장**: 최소 HTTP 서버 추가 + `/health`에서 RabbitMQ 연결 상태 반환.

### H14. SubmissionStatus.tsx 디자인 토큰 미사용 (1명: Palette)

- **파일**: `frontend/src/components/submission/SubmissionStatus.tsx`
- **상세**: `text-gray-500`, `bg-white` 등 Tailwind 기본 색상 하드코딩. 디자인 시스템 토큰 미사용. 이모지 아이콘 (Lucide 미사용).
- **권장**: 디자인 시스템 토큰 기반으로 리팩터링.

### H15. ai_failed 알림 타입 AI_COMPLETED로 오분류 (1명: Herald)

- **파일**: `services/gateway/src/sse/sse.controller.ts:23`
- **상세**: `ai_failed` 상태의 알림 타입이 `NotificationType.AI_COMPLETED`로 설정. 실패인데 완료 아이콘 표시.
- **권장**: 별도 `AI_FAILED` 타입 추가 또는 기존 타입 변경.

### H16. SSE 타임아웃 미설정 (1명: Herald)

- **파일**: `services/gateway/src/sse/sse.controller.ts`
- **상세**: SSE 연결에 최대 수명(timeout) 없음. Redis 구독자 무한 누적.
- **권장**: 최대 연결 시간 (예: 5분) + 클라이언트 측 재연결 로직.

---

## MEDIUM (개선 권장) — 20건

### M1. profiles 테이블 Dead migration (Librarian)

- **파일**: `services/identity/src/database/migrations/1700000200000-CreateProfilesTable.ts`
- **상세**: profiles 테이블 마이그레이션 존재하나 사용 엔티티 없음. `user_role_enum`, `github_token_status_enum`도 DB에 잔존.
- **권장**: profiles 마이그레이션 삭제 또는 Expand-Contract로 정리.

### M2. study_members.role 마이그레이션 VARCHAR vs 엔티티 enum 불일치 (Librarian)

- **파일**: `services/gateway/src/study/study.entity.ts:53`, `services/identity/src/database/migrations/1700000300000:34`
- **상세**: 마이그레이션은 `VARCHAR(10) + CHECK`, 엔티티는 `enum(StudyMemberRole)`. synchronize:false이므로 런타임 문제는 없으나 유지보수성 저하.

### M3. Saga 단계별 타임아웃 미구현 (Conductor)

- **파일**: `services/submission/src/saga/saga-orchestrator.service.ts`
- **상세**: 설계서 "DB_SAVED 5분, GITHUB_QUEUED 15분, AI_QUEUED 30분" 명시. Startup hook에서 1시간 이내 미완료만 검색. 단계별 타임아웃 Cron 없음.
- **권장**: 주기적 타임아웃 체크 Cron 구현.

### M4. StudyMemberGuard Redis 미사용 — 인메모리 캐시만 (Conductor)

- **파일**: `services/submission/src/common/guards/study-member.guard.ts:27`
- **상세**: 설계서 "Redis 캐시 `study_member:{study_id}:{user_id}`, TTL 10분" 요구. 인메모리 Map만 사용.
- **영향**: Pod 재시작 시 캐시 소실, 멀티 Pod 캐시 불일치.

### M5. MQ x-trace-id 이중 기록 미구현 (Conductor)

- **파일**: `services/submission/src/saga/mq-publisher.service.ts:99-112`
- **상세**: Conductor skill "MQ 전파: Body `submissionId` + AMQP Header `x-trace-id` 이중 기록" 미이행.
- **권장**: publish() options에 `headers: { 'x-trace-id': submissionId }` 추가.

### M6. 문제 DELETE API 미구현 (Curator)

- **파일**: `services/problem/src/problem/problem.controller.ts`
- **상세**: POST(생성), PATCH(수정)만 존재. DELETE 엔드포인트 없음. Curator skill "문제 등록/수정/삭제 가능" 명시.
- **권장**: DELETE 또는 soft delete(status=CLOSED 전환) API 추가.

### M7. weekNumber 변경 시 구 주차 캐시 미무효화 (Curator)

- **파일**: `services/problem/src/problem/problem.service.ts:118-122`
- **상세**: 수정 후 `saved.weekNumber` 캐시만 무효화. weekNumber가 변경되면 구 주차 캐시에 해당 문제가 남음.
- **권장**: 변경 전 weekNumber도 무효화.

### M8. Gateway vs Problem 캐시 키 형식 불일치 (Postman)

- **파일**: `services/gateway/src/study/study.service.ts:314`, `services/problem/src/common/guards/study-member.guard.ts:49`
- **상세**: Gateway `study:membership:{studyId}:{userId}` vs Problem `study_member:{studyId}:{userId}`. 키 불일치로 Gateway 캐시 무효화가 Problem 캐시에 무영향.
- **권장**: 캐시 키 형식 통일.

### M9. process.env 직접 접근 다수 (Gatekeeper, Postman, Sensei)

- **파일**: `gateway/src/main.ts:14,30`, `gateway/src/auth/oauth/oauth.controller.ts:56`, `github-worker/src/worker.ts:28-29,45-46,50` 등
- **상세**: 코드 규칙 "ConfigService를 통해 접근. process.env 직접 접근 금지" 위반.
- **권장**: NestJS 서비스는 ConfigService, GitHub Worker는 중앙 config 모듈.

### M10. InternalKeyGuard 자체 timingSafeEqual (Gatekeeper, Curator)

- **파일**: `services/gateway/src/common/guards/internal-key.guard.ts:52-58`, `services/problem/src/common/guards/internal-key.guard.ts:41-48`
- **상세**: 자체 구현. Node.js 내장 `crypto.timingSafeEqual()`이 더 안전.
- **권장**: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` 사용.

### M11. Redis 연결 에러 핸들링 부재 (Gatekeeper)

- **파일**: `services/gateway/src/auth/oauth/oauth.service.ts:48`, `services/gateway/src/study/study.service.ts:30-31`
- **상세**: `new Redis(redisUrl)` 후 에러 핸들링 없음. Redis 연결 실패 시 Rate Limit, OAuth state, Refresh Token 검증 모두 실패.
- **권장**: Redis 에러 이벤트 핸들러 + fail-closed 보장.

### M12. Refresh Token rotation 없음 (Gatekeeper)

- **파일**: `services/gateway/src/auth/oauth/oauth.service.ts:382-385`
- **상세**: 단일 사용자당 1개 토큰. 탈취 시 무한 갱신 가능. 다중 디바이스에서 세션 충돌.
- **권장**: (향후) 토큰 패밀리 기반 rotation 도입.

### M13. SSE 연결마다 새 Redis 클라이언트 생성 (Herald)

- **파일**: `services/gateway/src/sse/sse.controller.ts:46`
- **상세**: `new Redis(redisUrl)` — 연결마다 인스턴스 생성. 동시 사용자 증가 시 연결 풀 고갈.
- **권장**: 공유 subscriber 패턴 또는 Redis 연결 풀 도입.

### M14. MQ 연결 실패 시 자동 재연결 없음 (Herald)

- **파일**: `services/submission/src/saga/mq-publisher.service.ts:86-88`
- **상세**: RabbitMQ 연결 실패 시 에러 로그만. 이후 메시지 발행 시 throw.
- **권장**: 지수 백오프 기반 자동 재연결.

### M15. Submission orderBy SQL Injection 잠재 위험 (Sensei)

- **파일**: `services/submission/src/submission/submission.service.ts:129-131`
- **상세**: `qb.orderBy(\`s.\${sortField}\`, ...)` — sortField 화이트리스트 검증 없이 문자열 보간.
- **권장**: 허용 컬럼명 배열(`['createdAt', 'language', 'sagaStep']`)로 화이트리스트 검증.

### M16. Identity RequestIdMiddleware 미구현 (Sensei)

- **상세**: 모니터링 로그 규칙 §1-1 "모든 요청에 requestId(X-Request-ID) 필수". Gateway에만 존재.
- **권장**: Gateway의 RequestIdMiddleware를 Identity에도 적용.

### M17. AuthContext 토큰 만료 확인 로직 없음 (Palette)

- **파일**: `frontend/src/contexts/AuthContext.tsx`
- **상세**: 마운트 시 토큰 만료(exp) 확인 없음. 만료된 토큰으로 앱 진입 가능.
- **권장**: `exp` claim 확인 + 자동 refresh 호출 추가.

### M18. Frontend middleware.ts no-op (Palette)

- **파일**: `frontend/src/middleware.ts`
- **상세**: localStorage 기반 인증이므로 서버 미들웨어에서 토큰 확인 불가. 모든 요청 통과.
- **권장**: 제거하거나 의미 있는 로직 추가.

### M19. Grafana emptyDir → Pod 재시작 시 설정 소실 (Architect)

- **파일**: `infra/k3s/monitoring/grafana.yaml:55`
- **상세**: `emptyDir: {}` — 사용자 정의 대시보드, 알림 설정 소실.
- **권장**: PVC 연결 또는 Grafana provisioning 코드화.

### M20. Loki/Prometheus liveness/readiness probe 미설정 (Architect)

- **파일**: `infra/k3s/monitoring/loki-config.yaml`, `prometheus-config.yaml`
- **상세**: Loki/Prometheus 모두 probe 없음. 서비스 장애 시 자동 복구 불가.
- **권장**: Loki `httpGet: /ready (3100)`, Prometheus `httpGet: /-/healthy (9090)`.

---

## 핵심 요약

### 가장 심각한 3가지

1. **Identity 서비스 전체 재작성 필요** — email/password 코드 제거, User 엔티티를 OAuth 스키마로 교체, 관련 테스트 재작성 (C1+C2, 4명 교차 검증)

2. **GitHub Worker ↔ Submission 콜백 미구현** — POST 4개 + Gateway 스터디 조회 1개 = **5개 엔드포인트 누락**으로 코드 제출 → GitHub Push → AI 분석 전체 파이프라인이 동작 불가 (C3+C4, 3명 교차 검증)

3. **SSE 보안 취약점** — 인증 없이 타인의 제출 상태 감시 가능, 타임아웃 없이 Redis 구독 누적 (H1+H16, 3명 교차 검증)

### Sprint 3-2 범용 Agent 피해 범위

Identity 서비스 코드(C1,C2), Submission 테스트 mock 누락, MetricsService 하드코딩(H2), 구조화 로거 미적용(H10), 콜백 엔드포인트 미구현(C3,C4) 등 광범위한 영향 확인.

### 통계

| 심각도 | 건수 |
|--------|------|
| CRITICAL | 8건 |
| HIGH | 16건 |
| MEDIUM | 20건 |
| **총계** | **44건** |

### 양호 사항 (정상 확인)

1. JWT none 알고리즘 차단 (algorithms: ['HS256'] 고정)
2. JWT 만료 검증 (ignoreExpiration: false)
3. Authorization 헤더 내부 전달 차단
4. Internal API Key timing-safe 비교 (개선 여지 있으나 동작)
5. Rate Limit Redis 기반 (IP당 60건/분, 제출 10건/분)
6. IDOR 방지 — 알림 (userId 소유권 검증), 스터디 RBAC
7. 로그 보안 유틸 (sanitize.ts — Authorization, IP, 이메일 마스킹)
8. Sealed Secrets 11개, 평문 Secret Git 커밋 없음
9. Dockerfile 멀티스테이지 빌드, non-root, ARM64
10. CI/CD secret-scan → detect → quality → test → build → trivy → deploy 정상
11. TypeScript any 타입 0건 (전체 코드베이스)
12. Problem 서비스 studyId 스코핑으로 cross-study IDOR 차단
13. Dual Write expand 모드 fire-and-forget 패턴 정상
14. Saga Orchestrator 멱등성 순서 (DB 먼저 → MQ 나중) 정상
15. Circuit Breaker (AI Analysis) 상태 전이 + Prometheus 연동 정상
