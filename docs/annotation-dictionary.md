# AlgoSu 어노테이션 사전

> **버전**: v1.0
> **최종 갱신**: 2026-03-02
> **목적**: TF Agent가 코드를 빠르게 탐색·이해할 수 있도록 구조화된 주석 체계를 정의한다.
> **적용 범위**: algosu-app 모노레포 전체 (백엔드 + 프론트엔드)
> **규칙**: 모든 파일·함수·컴포넌트에 주석 필수. 이 사전에 정의된 태그만 사용한다.

---

## 1. 파일 헤더 (필수)

모든 `.ts`, `.tsx`, `.py` 파일 최상단에 작성한다.

```ts
/**
 * @file 제출 내역 목록 페이지
 * @domain submission
 * @layer page
 * @related SubmissionService, AIResultView, Toast
 */
```

| 태그 | 필수 | 설명 |
|---|---|---|
| `@file` | O | 파일의 역할을 한 줄로 설명 |
| `@domain` | O | 소속 도메인 (아래 도메인 사전 참조) |
| `@layer` | O | 계층 (아래 레이어 사전 참조) |
| `@related` | △ | 연관 파일/클래스/컴포넌트 (없으면 생략 가능) |

---

## 2. 함수/컴포넌트 주석 (필수)

모든 export 함수, React 컴포넌트, 클래스 메서드에 JSDoc/docstring을 작성한다.

### TypeScript / React

```ts
/**
 * 주차별 제출 통계를 바 차트로 렌더링
 * @domain dashboard
 * @param stats - 주차별 통계 배열
 * @returns 바 차트 컴포넌트
 */
export function WeeklyChart({ stats }: WeeklyChartProps) { ... }
```

### NestJS Service

```ts
/**
 * 제출물의 GitHub 동기화를 실행
 * @domain github
 * @param submissionId - 제출 ID
 * @param userId - 사용자 ID
 * @throws GitHubSyncError 동기화 실패 시
 */
async syncToGitHub(submissionId: string, userId: string): Promise<void> { ... }
```

### Python (FastAPI)

```python
def analyze_code(submission: SubmissionPayload) -> AnalysisResult:
    """
    제출 코드에 대한 AI 분석을 수행

    @domain ai
    @param submission: 분석 대상 제출물
    @returns: 5개 카테고리별 점수 + 총평 + 최적화 코드
    @event AI_ANALYSIS_COMPLETED
    """
```

---

## 3. 어노테이션 태그 사전

### `@domain` — 도메인 식별

코드가 속한 비즈니스 도메인을 식별한다.
**검색**: `@domain submission`으로 grep 시 제출 관련 코드 전체 탐색 가능.

| 값 | 설명 | 대표 서비스 |
|---|---|---|
| `submission` | 코드 제출, 제출 내역, 제출 상태 | Submission Service |
| `problem` | 문제 등록, BOJ 연동, 문제 목록/상세 | Problem Service |
| `review` | 피어 코드 리뷰, 라인 댓글, AI 하이라이트 | Gateway (Review 모듈) |
| `study` | 스터디 생성/관리, 멤버, 초대, 통계 | Gateway (Study 모듈) |
| `identity` | 인증, OAuth, 사용자 프로필 | Identity Service |
| `github` | GitHub 연동, 레포 관리, 커밋 동기화 | GitHub Worker |
| `ai` | AI 코드 분석, 점수, 피드백 | AI Analysis Service |
| `dashboard` | 대시보드, KPI, 차트, 위젯 | Frontend |
| `notification` | 토스트, 알림 패널, 알림 타입 | Frontend + Gateway |
| `common` | 공통 유틸, 디자인 시스템, 공유 훅 | 전체 |

### `@layer` — 계층 식별

코드의 아키텍처 계층을 식별한다.
**검색**: `@layer hook`으로 grep 시 모든 커스텀 훅 탐색 가능.

| 값 | 설명 | 예시 파일 |
|---|---|---|
| `page` | Next.js 페이지 컴포넌트 | `app/dashboard/page.tsx` |
| `component` | React UI 컴포넌트 | `components/ui/Badge.tsx` |
| `hook` | React 커스텀 훅 | `hooks/useStudyRoom.ts` |
| `context` | React Context Provider | `contexts/AuthContext.tsx` |
| `api` | API 클라이언트 / 엔드포인트 정의 | `lib/submissionApi.ts` |
| `controller` | NestJS Controller | `submission.controller.ts` |
| `service` | NestJS Service / 비즈니스 로직 | `submission.service.ts` |
| `repository` | DB 접근 계층 | `submission.repository.ts` |
| `entity` | TypeORM Entity / Pydantic Model | `submission.entity.ts` |
| `dto` | Data Transfer Object | `create-submission.dto.ts` |
| `guard` | NestJS Guard / 인가 로직 | `jwt-auth.guard.ts` |
| `middleware` | 미들웨어 | `rate-limit.middleware.ts` |
| `migration` | DB 마이그레이션 | `1709-CreateSubmission.ts` |
| `config` | 설정, 환경변수, 상수 | `constants.ts`, `config.ts` |
| `util` | 유틸리티 함수 | `formatTimer.ts` |
| `test` | 테스트 코드 | `submission.service.spec.ts` |

### `@related` — 연관 코드 참조

현재 파일/함수와 밀접하게 연관된 코드를 명시한다.
Agent가 수정 영향 범위를 파악하는 데 활용.

```ts
/**
 * @related SubmissionService    — 제출 데이터 조회
 * @related AIResultView         — 분석 결과 표시 컴포넌트
 * @related useSubmissions       — 제출 목록 페치 훅
 */
```

**작성 규칙**:
- 클래스명, 컴포넌트명, 훅명 등 식별 가능한 이름 사용
- 옵션으로 `—` 뒤에 관계 설명 추가
- 3~5개 이내로 핵심 연관만 기재

### `@event` — 이벤트/메시지 핸들러

RabbitMQ 메시지, SSE, WebSocket 등 이벤트 기반 코드를 식별한다.
**검색**: `@event SUBMISSION_CREATED`로 해당 이벤트의 발행·구독 코드를 모두 찾을 수 있다.

```ts
/**
 * 제출 완료 이벤트를 RabbitMQ로 발행
 * @event SUBMISSION_CREATED (publish)
 */

/**
 * 제출 완료 이벤트 수신 후 AI 분석 큐잉
 * @event SUBMISSION_CREATED (subscribe)
 */
```

| 이벤트명 | 설명 |
|---|---|
| `SUBMISSION_CREATED` | 새 제출 생성 |
| `SUBMISSION_STATUS_CHANGED` | 제출 상태 변경 (PENDING→ANALYZING→COMPLETED) |
| `AI_ANALYSIS_COMPLETED` | AI 분석 완료 |
| `AI_ANALYSIS_FAILED` | AI 분석 실패 |
| `GITHUB_SYNC_COMPLETED` | GitHub 동기화 성공 |
| `GITHUB_SYNC_FAILED` | GitHub 동기화 실패 |
| `PROBLEM_CREATED` | 새 문제 등록 |
| `ROLE_CHANGED` | 멤버 역할 변경 |
| `STUDY_MEMBER_JOINED` | 스터디 멤버 가입 |
| `STUDY_MEMBER_LEFT` | 스터디 멤버 탈퇴 |
| `DEADLINE_REMINDER` | 마감 알림 (24h전 + 1h전, 미제출자 대상) |
| `STUDY_CLOSED` | 스터디 종료 (읽기 전용 전환) |

**표기법**: `(publish)` 발행 / `(subscribe)` 구독 / `(emit)` 프론트 emit / `(listen)` 프론트 수신

### `@guard` — 접근 제어/가드 로직

인가, 권한 검증, 비즈니스 가드 로직을 식별한다.

```ts
/**
 * GitHub 미연동 시 제출을 차단하는 가드
 * @guard C1-github-check
 * @related AuthContext.githubConnected
 */
```

| 가드 ID | 설명 |
|---|---|
| `C1-github-check` | GitHub 미연동 시 제출 차단 |
| `jwt-auth` | JWT 토큰 검증 |
| `study-member` | 스터디 멤버 여부 확인 |
| `study-admin` | 스터디 ADMIN 권한 확인 |
| `submission-owner` | 제출물 소유자 확인 (IDOR 방어) |
| `problem-deadline` | 마감 전/후 접근 제어 |
| `cookie-auth` | httpOnly Cookie JWT 검증 (UI v2) |
| `ai-quota` | AI 일일 한도 5회 체크 |
| `invite-code-lock` | 초대코드 brute force 5회/15분 잠금 |
| `closed-study` | CLOSED 스터디 쓰기 차단 (읽기 전용) |
| `review-deadline` | 마감 전 타인 코드리뷰 열람 차단 |
| `system-admin` | DLQ API 등 시스템 관리 접근 제어 |

**규칙**: 새로운 가드 추가 시 이 사전에 먼저 등록 후 코드에 적용한다.

### `@api` — API 엔드포인트

REST API 엔드포인트를 식별한다.
**검색**: `@api GET /submissions`로 해당 API의 Controller·Service·Client 전체 탐색 가능.

```ts
/**
 * 제출 내역 목록 조회 (페이지네이션)
 * @api GET /studies/:studyId/submissions
 * @guard jwt-auth, study-member
 */
```

**표기법**: `{METHOD} {path}` — NestJS Controller와 프론트 API Client 양쪽에 동일하게 표기.

### `@todo` — 미완료 작업

Agent별 남은 작업을 추적한다. 이슈 번호 또는 Agent명을 명시한다.

```ts
// @todo(Palette) 다크모드 hover 토큰 적용
// @todo(Herald) 에러 바운더리 추가
// @todo(Gatekeeper) Rate Limit 테스트 케이스
```

**규칙**:
- 반드시 `(담당 Agent명)` 또는 `(#이슈번호)` 포함
- 방치 금지 — Sprint 종료 시 전수 점검
- 완료 시 주석 삭제 (주석 처리 금지)

---

## 4. 섹션 구분자

파일이 50줄 이상일 때, 논리적 섹션을 구분자로 나눈다.

```ts
// ─── TYPES ────────────────────────────────

// ─── CONSTANTS ────────────────────────────

// ─── HOOKS ────────────────────────────────

// ─── HANDLERS ─────────────────────────────

// ─── HELPERS ──────────────────────────────

// ─── RENDER ───────────────────────────────
```

**사용 가능한 섹션명**:

| 섹션명 | 용도 |
|---|---|
| `TYPES` | 타입/인터페이스 정의 |
| `CONSTANTS` | 상수 정의 |
| `HOOKS` | React 훅 호출 (useState, useEffect 등) |
| `STATE` | 상태 관리 로직 |
| `HANDLERS` | 이벤트 핸들러 함수 |
| `HELPERS` | 내부 헬퍼 함수 |
| `API` | API 호출 로직 |
| `EFFECTS` | useEffect / 사이드이펙트 |
| `RENDER` | JSX 렌더링 |
| `EXPORTS` | 모듈 export |

**규칙**: 구분자 형식은 `// ─── {NAME} ` + `─` 반복으로 총 50자 맞춤.

---

## 5. 주석 작성 원칙

1. **모든 export 대상에 JSDoc 필수** — 함수, 클래스, 컴포넌트, 타입, 상수
2. **"왜"를 쓴다** — 코드가 "무엇"을 하는지는 코드 자체로, "왜" 이 방식인지를 주석으로
3. **한국어 허용** — 비즈니스 로직 설명은 한국어 OK, 태그 값은 영문
4. **주석도 코드** — 코드 변경 시 주석도 함께 갱신. 틀린 주석은 없는 것보다 나쁘다
5. **인라인 주석은 최소화** — 복잡한 로직, 비직관적 결정에만 사용

---

## 6. 검색 활용 가이드 (Agent용)

| 목적 | grep 패턴 |
|---|---|
| 제출 관련 코드 전체 | `@domain submission` |
| 모든 커스텀 훅 | `@layer hook` |
| 특정 이벤트 추적 | `@event SUBMISSION_CREATED` |
| 가드 로직 전체 | `@guard` |
| 특정 API 찾기 | `@api GET /submissions` |
| 내 할일 찾기 | `@todo(Palette)` |
| 특정 코드 영향 범위 | `@related SubmissionService` |
| 페이지 목록 | `@layer page` |
| 컴포넌트 목록 | `@layer component` |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.0 | 2026-03-02 | 초안 작성 — 7개 태그 + 섹션 구분자 + 검색 가이드 |
| v1.1 | 2026-03-02 | UI v2 반영 — 이벤트 2건 + 가드 6건 추가 |
