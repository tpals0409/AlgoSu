# AlgoSu 전면 수정 실행 계획서

> 종합 기능 검토 보고서 기반 | TF 10명 전원 분석 결과 취합
> 2026.03.01 | Oracle(심판관) 작성

---

## 1. Executive Summary

종합 기능 검토 보고서(PP-01~14, 114 시나리오)를 기반으로 TF 10명이 코드베이스를 전수 분석한 결과:

- **보고서의 최우선 항목(PP-02 스터디 도메인)이 이미 완전 구현되어 있음** (Sprint 3-2)
- **실제 신규 작업량은 보고서 예상의 40~50%**
- **긴급 버그 C1 발견**: Admin 기능 전면 비활성화 상태 (OWNER vs ADMIN 불일치)
- **핵심 신규 작업**: 피어 코드 리뷰(PP-01/03), Monaco Editor(PP-04), AI 비용 제어(PP-05)

---

## 2. PP별 현재 상태 (Scout + Sensei 교차 검증)

| PP | 보고서 판정 | 실제 상태 | 남은 작업 |
|----|-----------|----------|----------|
| PP-02 스터디 도메인 | 미구현 | **완전 구현** (85%) | leaveStudy API + 고아 데이터 처리 |
| PP-09 멀티 스터디 | 미정의 | **완전 구현** | 없음 |
| PP-14 허용 언어 | 미정의 | **부분 구현** | 백엔드 @IsIn 화이트리스트 추가 |
| PP-12 에러 표준화 | 없음 | **부분 구현** | NestJS ExceptionFilter + 에러 카탈로그 |
| PP-01/03 피어 리뷰 | 미구현 | **0%** | review 테이블 + API 6개 + UI 2페이지 |
| PP-04 코드 에디터 | 미설계 | **textarea** | Monaco Editor 통합 (1파일 교체) |
| PP-05 AI 비용 제어 | 미구현 | **30%** (CB만) | Redis 카운터 + 한도 UI |
| PP-06 DLQ 운영 | 미구현 | **40%** (큐 선언만) | 관리자 재처리 API + Grafana |
| PP-07 GitHub 실패 UX | 미구현 | **부분** | 실패 유형별 액션 버튼 분기 |
| PP-08 마감 리마인더 | 미구현 | **0%** | Cron + 미제출자 API + 알림 |
| PP-11 테스트 전략 | 미명시 | **0%** | 단위/통합/부하 테스트 |
| PP-13 백업 전략 | 없음 | **0%** | pg_dump Cron + OCI Storage |
| PP-10 저장소 확장 | 미구현 | **0%** | Phase 4 모니터링 |

---

## 3. 긴급 버그 (C1~C5)

### C1 [CRITICAL] OWNER vs ADMIN 불일치 — Admin 기능 전면 차단

**근본 원인 (Conductor 분석)**:
- 결함 A: `getMyStudies()` 응답에 membership.role 누락
- 결함 B: 프론트 `'OWNER'` vs 백엔드 `'ADMIN'` 불일치

**영향**: 문제 생성/수정/삭제, 스터디 관리, 초대 코드, 멤버 관리 전부 차단

**수정 범위 (Palette 전수 스캔)**:

| 파일 | 수정 포인트 |
|------|-----------|
| `gateway/src/study/study.service.ts` | `getMyStudies()` 반환값에 role 포함 |
| `frontend/src/contexts/StudyContext.tsx` L21, L28, L88 | `'OWNER'` → `'ADMIN'` (3곳) |
| `frontend/src/lib/api.ts` L104 | Study 인터페이스 role 타입 |
| `frontend/src/app/problems/[id]/page.tsx` L31 | `=== 'ADMIN'` |
| `frontend/src/app/problems/[id]/edit/page.tsx` L126 | `!== 'ADMIN'` |
| `frontend/src/app/problems/create/page.tsx` L72 | `!== 'ADMIN'` |
| `frontend/src/app/studies/[id]/page.tsx` L31 | `=== 'ADMIN'` |

### C2 [MEDIUM] NotificationType ENUM 불일치
- `notification.entity.ts`에 `AI_FAILED` 있으나 DB에 없음
- **해결**: ENUM 확장 마이그레이션에 포함 (Architect 설계 완료)

### C3 [MEDIUM] SSE 채널 단일 구조
- 현재 `submission:status:{id}` 전용
- **해결**: `notification:{userId}` 병행 채널 신설 (Postman + Herald 설계 완료)

### C4 [LOW] 신규 라우팅 등록 필요
### C5 [LOW] GitHub Push 파일 경로 week_number 미포함

### 추가 발견 (Conductor)
- `getStudyStats()` ISO week vs Problem weekNumber 불일치 → 1줄 수정

---

## 4. 누락 시나리오 (Sensei 발견)

### HIGH (즉시 정의 필요)
1. **스터디 자발적 탈퇴 API** — leaveStudy() 미구현
2. **스터디 삭제 시 고아 데이터** — 크로스 DB CASCADE 없음
3. **AI 일일 한도 미구현** — Redis 카운터 없음
4. **초대 코드 재발급** — 유출 코드 무효화 불가

### MEDIUM
5. 멤버 0명 스터디 처리 정책
6. Draft + 마감 경과 처리 정책
7. 동일 사용자 동일 문제 재제출 멱등성
8. GitHub 미연동 Draft 정책

---

## 5. 기술 설계 요약 (Agent별)

### 5.1 DB 스키마 (Architect)

**신규 마이그레이션 4개:**

| # | 파일명 | DB | 내용 |
|---|--------|-----|------|
| 1 | `1700000000003-CreateReviewTables.ts` | submission_db | review_comments + review_replies (soft-delete, 인덱스 4개) |
| 2 | `1700000000004-AddAiAnalysisSkipped.ts` | submission_db | ai_analysis_skipped + ai_skip_reason 컬럼 |
| 3 | `1700000700000-ExtendNotificationTypeEnum.ts` | identity_db | ENUM 6개 추가 (AI_FAILED, REVIEW_COMMENT, REVIEW_REPLY, STUDY_LEAVE, DEADLINE_REMINDER, AI_LIMIT_REACHED) |
| 4 | `1700000700001-AddStudySoftDelete.ts` | identity_db | studies.deleted_at 컬럼 (soft-delete) |

**review_comments 설계 핵심:**
- `submission_id` → 물리 FK (CASCADE DELETE)
- `author_id` VARCHAR(255) — cross-DB logical FK
- `study_id` UUID — IDOR 방어용
- `is_deleted` BOOLEAN — soft-delete (대댓글 보존)
- `line_number` INTEGER nullable — 코드 라인 지정 (null=전체 코멘트)

### 5.2 API 엔드포인트 (Postman)

**신규 API 총 11개:**

| # | 메서드 | 경로 | 서비스 |
|---|--------|------|--------|
| 1 | POST | `/api/submissions/:id/reviews` | Submission |
| 2 | GET | `/api/submissions/:id/reviews` | Submission |
| 3 | PATCH | `/api/submissions/:id/reviews/:id` | Submission |
| 4 | DELETE | `/api/submissions/:id/reviews/:id` | Submission |
| 5 | POST | `/api/submissions/:id/reviews/:id/replies` | Submission |
| 6 | DELETE | `/api/submissions/:id/reviews/:id/replies/:id` | Submission |
| 7 | GET | `/api/studies/:sid/problems/:pid/submissions` | Gateway (오케스트레이션) |
| 8 | POST | `/api/studies/:id/leave` | Gateway |
| 9 | POST | `/api/admin/dlq/retry` | Gateway (RabbitMQ Mgmt 프록시) |
| 10 | GET | `/api/admin/dlq/messages` | Gateway (RabbitMQ Mgmt 프록시) |
| 11 | GET | `/api/analysis/quota` | AI Analysis |

**신규 Internal API 5개:**
- `POST /internal/notifications` (Gateway)
- `GET /internal/studies/:id/members` (Gateway)
- `GET /internal/studies/active` (Gateway)
- `GET /internal/submissions/submitted-users` (Submission)
- `POST /internal/submissions/consecutive-unsubmitted` (Submission)

### 5.3 알림 시스템 (Herald)

**NotificationType 6개 추가** (기존 5 → 11):
```
신규: REVIEW_COMMENT | REVIEW_REPLY | DEADLINE_REMINDER | AI_LIMIT_REACHED | STUDY_LEAVE | DLQ_ALERT
```

**SSE 병행 채널:**
- 기존: `submission:status:{submissionId}` (유지)
- 신규: `notification:{userId}` (범용 실시간 알림)
- 신규 엔드포인트: `GET /sse/notifications?token={jwt}`

**알림 흐름 4개:**
1. 코멘트 → Submission Service Redis PUBLISH → Gateway SSE + DB 저장
2. 마감 리마인더 → Problem Service Cron → Gateway 알림 생성
3. DLQ 적체 → AlertManager webhook → Gateway Admin 알림
4. AI 한도 → Redis INCR 후 80%/100% 알림

### 5.4 Problem 도메인 (Curator)

**신규 파일 2개:**
- `deadline-reminder.cron.ts` — 매시간 마감 체크, 24h/1h 전 미제출자 알림
- `cron.module.ts` — ScheduleModule + Cron 등록

**기존 파일 수정:**
- `create-problem.dto.ts` — 7개 언어 `@IsIn` 화이트리스트 추가
- `app.module.ts` — CronModule 임포트

### 5.5 UI/UX (Palette)

**Monaco Editor (PP-04):**
- `@monaco-editor/react` 패키지, SSR safe dynamic import
- `CodeEditor.tsx` 내 textarea → MonacoEditor 교체 (단 1파일)
- 다크모드 연동, 언어 맵핑, readOnly(제출 중)

**피어 코드 리뷰 (PP-01/03):**
- 풀이 목록 페이지: `/studies/[studyId]/problems/[problemId]/reviews`
- 코드 뷰어 + 코멘트 패널: `/studies/.../reviews/[submissionId]`
- Monaco ReadOnly + glyphMargin 라인 마커 + 우측 코멘트 패널

**추가 UI:**
- 스터디 탈퇴 UI (confirm 다이얼로그)
- 스터디 삭제 강화 (멤버 >1명: 스터디명 재입력)
- AI 한도 인디케이터 (미니 프로그레스 바)
- Draft 마감 경과 UI (복사 후 정리 / 정리)
- GitHub 실패 액션 버튼 분기

### 5.6 고아 데이터 전략 (Architect)

**Soft Delete + 이벤트 기반 비동기 정리:**
1. `studies.deleted_at = NOW()` (soft delete)
2. RabbitMQ `study.events` Exchange 신설 → `study.deleted` 이벤트
3. Problem Service: 해당 study problems → status CLOSED
4. Submission Service: review_comments → is_deleted = true
5. submissions/drafts 보존 (학습 이력)

### 5.7 문서 갱신 (Librarian)

**갱신 필요 문서 6개:**
1. `AlgoSu_MSA_Architecture_v3.md` → **v3.2** (PP 현황, v1.1/v1.2 병합, Roadmap)
2. `AlgoSu_종합_기능_검토_보고서.md` (PP-02 완전구현 반영)
3. `error-catalog.md` (신규 — 에러 코드 카탈로그)
4. `docs/adr/` (신규 — ADR-0006~0012)
5. `audit-report-2026-02-28.md` (해결 표기)
6. `phase3-db-separation-sprint.md` (현황 반영)

**ADR 7건:** 코드 에디터, SSE 채널, Review 위치, Gateway-Identity 해소, PgBouncer, Supabase, Notification 위치

---

## 6. Sprint 계획 (Conductor)

### [Hotfix] C1 버그 + leaveStudy + weekNumber (즉시)
- 11개 파일, ~80줄 변경
- 백엔드: getMyStudies() role 포함 + leaveStudy() 추가
- 프론트: OWNER→ADMIN 통일 (8곳) + 탈퇴 버튼
- 통계: getStudyStats() ISO week → weekNumber

### Phase 3 Sprint 3-2-A: 에디터 + 에러 표준화 + 안전장치
- Monaco Editor 통합 (Palette)
- NestJS ExceptionFilter (Gatekeeper)
- notification_type_enum ALTER (Architect)
- 고아 데이터 정리 로직 (Architect)
- AI 일일 한도 Redis 카운터 (Sensei) — 전진 배치

### Phase 3 Sprint 3-2-B: Submission DB 분리
- 기존 Phase 3 계획 유지

### Phase 3 Sprint 3-3: Identity DB 분리
- Gateway → Identity API 전환 포함

### Phase 4 Sprint 4-1: 피어 코드 리뷰 (핵심)
- review 마이그레이션 + Review 모듈 + API + UI + SSE 코멘트 알림

### Phase 4 Sprint 4-2: 운영 강화 (전부 병렬)
- AI 비용 제어 UI, DLQ 관리 API, GitHub 실패 UX, 마감 리마인더 Cron, pg_dump 백업

### Phase 4 Sprint 4-3: 테스트 + 안정화
- 커버리지 70%, 통합 테스트, 부하 테스트

### 의존 관계
```
[Hotfix] → [3-1 Contract] → [3-2-A] ──→ [4-1 피어 리뷰 UI]
                            → [3-2-B] → [3-3] → [4-1 리뷰 테이블]
                                                    → [4-2 병렬] → [4-3]
```

---

## 7. PM 결정 필요 사항 (Oracle 권고 포함)

### 필수 결정 5건

| # | 항목 | 선택지 | Oracle 권고 |
|---|------|--------|------------|
| D1 | C1 Hotfix 즉시 실행 | Yes / No | **Yes** — Admin 기능 전면 차단, 리스크 극히 낮음 |
| D2 | AI 한도 차단 시점 | A: 제출 차단 / B: AI 큐잉 차단 | **B** — 제출 허용, AI만 스킵. UX 보존 |
| D3 | 스터디 삭제 정책 | A: 멤버 >1명 차단 / B: 경고+confirm / C: 스터디명 재입력 | **C** — 최고 안전성 |
| D4 | 마감 후 Draft | A: 삭제 / B: 유지(읽기전용) / C: 복사후 정리 UI | **C** — 코드 유실 방지 + 정리 옵션 |
| D5 | 코드 에디터 | Monaco / CodeMirror 6 | **Monaco** — VS Code 친숙도, 설계 완료 |

### 추가 결정 7건

| # | 항목 | Oracle 권고 |
|---|------|------------|
| D6 | 고아 데이터 정리 | **이벤트 기반 비동기** (RabbitMQ study.events) — Soft Delete + 비동기 정리 |
| D7 | AI 한도 수치 | **일일 5회/스터디 50회** (보고서 원안 유지, 월 $0.225 수준) |
| D8 | ExceptionFilter | **각 서비스 복사** (모노레포 내 공통 패키지 생성은 과도) |
| D9 | 초대 가입 알림 타입 | **ROLE_CHANGED 재활용** (enum 비대화 방지) |
| D10 | leaveStudy Admin 탈퇴 | **차단** (마지막 Admin은 다른 멤버에게 위임 후 탈퇴) |
| D11 | REVIEW_REPLY 분리 | **분리 유지** (알림 세분화, 사용자가 코멘트/답글 구분 가능) |
| D12 | 데이터 보존 기간 | **soft-deleted 스터디 30일 보존 후 batch 삭제** |

---

## 8. 리소스 영향 (변경 없음)

보고서 §8 결론 재확인: **새로운 서비스나 인프라 추가 없음**. 기존 서비스 모듈 확장.
- RabbitMQ: `study.events` Exchange 1개 + Queue 2개 추가 (메모리 미미)
- Redis: 한도 카운터 + 리마인더 키 (메모리 미미)
- npm 패키지: `@monaco-editor/react`, `@nestjs/schedule` (2개)

---

## 9. Gatekeeper 보안 검증 (완료)

### 검증 완료 항목

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | review_comments IDOR 방어 | **안전** | study_id 스코핑 + author_id 이중 검증. 모든 쿼리 WHERE study_id 체크리스트 필수 |
| 2 | 풀이 열람 이중 조건 우회 | **우회 불가** | 6개 공격 벡터 전수 차단 확인 (시간 조작, 헤더 위조, studyId 교차, 빈 제출, timezone, race condition) |
| 3 | DLQ Admin API | **설계 변경** | GitHub Worker는 HTTP 서버 없음 → Gateway에서 RabbitMQ Management API(15672) 프록시로 변경 |
| 4 | SSE notification:{userId} | **원천 차단** | 채널명 = JWT userId 기반 (서버사이드 결정값) — 클라이언트 입력 아님 |

### D13: DLQ Admin API 아키텍처 변경 (Oracle 확정)
- Postman 원안(GitHub Worker HTTP 프록시) **폐기**
- Gateway에서 RabbitMQ Management API 직접 프록시로 변경
- `SystemAdminGuard` 도입 (환경변수 `SYSTEM_ADMIN_USER_IDS` 기반, DB 스키마 변경 없음)
- API 9/10번 경로 수정: `GET /admin/dlq/messages`, `POST /admin/dlq/retry`, `DELETE /admin/dlq/purge`
- 감사 로그 5W 필수 (monitoring-log-rules.md 준수)

### D14: 빈 제출 무임승차 방지 (Oracle 보류)
- 현행 최소 10자 검증 유지, `saga_step = 'DONE'` 조건 추가는 **보류** (AI 분석 실패 시 열람 차단 부작용)

### D15: 기존 SSE S6 해소 (Sprint 3-2-A 포함 확정)
- submission SSE에 소유권 검증(`submission.userId !== userId → 403`) 추가
- 피어 리뷰(Sprint 4-1) 도입 시 접근 조건 완화 검토

### S7 신규 취약점: 초대 코드 max_uses 미검증 (HIGH)
- `joinByInviteCode()`에서 `max_uses` 필드 존재하나 검증 로직 없음 → 무제한 사용 가능
- Sprint 3-2-A에서 수정 예정

### IDOR 방어 체계 (6계층)
```
Gateway JWT 인증 → X-Study-ID 형식 검증 → StudyMemberGuard 멤버십 검증
→ Service WHERE study_id 스코핑 → 코멘트 study_id 명시 저장 → 수정/삭제 author_id 검증
```

---

## 10. 참여 Agent 및 산출물

| Agent | Tier | 산출물 |
|-------|------|--------|
| Scout | 3 | 코드베이스 전수 탐색, 충돌 지점 5건, 구현 현황 분류 |
| Sensei | 3 | 시나리오 114개 검증, 누락 4건(HIGH), AI 비용 수치 검증 |
| Conductor | 1 | Sprint 재편성, C1 근본 원인 2중 결함, Sensei HIGH 반영 |
| Architect | 2 | 마이그레이션 4개, 에러 표준 포맷, Soft Delete + 이벤트 전략 |
| Postman | 2 | API 11개 + Internal 5개, SSE 채널 전략, 서비스 통신 흐름 |
| Curator | 2 | Cron 2개 설계, @IsIn 검증, 미제출자 API |
| Gatekeeper | 1 | 보안 검증 4건 완료, DLQ 설계 변경 발견, S7 신규 취약점, IDOR 6계층 방어 체계, SystemAdminGuard 설계 |
| Herald | 3 | NotificationType 6개, 알림 흐름 4개, SSE 병행 채널 |
| Palette | 3 | Monaco 설계, 리뷰 화면, C1 전수 스캔(8곳), 탈퇴/삭제/AI/Draft UI |
| Librarian | 1 | 문서 6개 갱신 계획, ADR 7건, 에러 카탈로그 구조 |
