---
type: convention
domain: code-annotations
---
# 어노테이션 사전 (Annotation Dictionary)

AlgoSu 코드베이스의 JSDoc/Python docstring 어노테이션 catalog. 신규 태그/이벤트/가드 추가 시 본 문서 갱신 의무 (`agents:scribe` 페르소나).

## 파일 헤더 어노테이션

| 태그 | 의미 | 예시 |
|------|------|------|
| `@file` | 파일 한 줄 요약 | `@file Submission domain — Saga orchestration entry point` |
| `@domain` | 비즈니스 도메인 | `@domain submission` (목록 ↓) |
| `@layer` | 아키텍처 레이어 | `controller` / `service` / `repository` / `entity` / `dto` / `module` |
| `@related` | 관련 파일/문서 | `@related docs/conventions/monitoring-logging.md, services/gateway/...` |

### `@domain` enum

`ai` · `auth` · `common` · `event-log` · `feedback` · `gateway` · `github` · `github-worker` · `identity` · `identity-client` · `notification` · `problem` · `review` · `share` · `study` · `submission`

## `@guard` (인가/접근 제어)

API 엔드포인트가 통과시키는 인가 가드. controller / service 메서드 JSDoc에 명시.

| guard | 검증 대상 | 위치 |
|-------|----------|------|
| `cookie-auth` | HTTP-only 쿠키 JWT 인증 | gateway/auth |
| `jwt-auth` | Bearer JWT (API key 외) | gateway/auth |
| `jwt` | (legacy) 동일 | — |
| `internal-key` | `X-Internal-Key` 서비스 간 인증 (`timingSafeEqual`) | gateway → submission/problem/identity |
| `study-admin` | 스터디 관리자 권한 | gateway/study |
| `study-member` | 스터디 멤버 권한 | gateway/study |
| `closed-study` | 종료된 스터디 차단 | gateway/study |
| `submission-owner` | 제출 소유자만 접근 | gateway/sse, gateway/submission |
| `problem-deadline` | 문제 마감 이전만 허용 | gateway/problem |
| `invite-code-lock` | 초대 코드 잠금 검증 | gateway/study |
| `circuit-breaker` | Circuit Breaker OPEN 시 차단 | ai-analysis |
| `ai-quota` | 사용자별 AI 분석 쿼터 | gateway/ai |
| `demo-write` | demo mode write 차단 | gateway |

## `@event` (도메인 이벤트)

서비스 간 발행/구독 이벤트 (RabbitMQ exchange 기반).

| 이벤트 | 발행 서비스 | 구독 서비스 |
|--------|-----------|-----------|
| `STUDY_CLOSED` | gateway | notification |
| `STUDY_MEMBER_JOINED` | gateway | notification |
| `STUDY_MEMBER_LEFT` | gateway | notification |
| `ROLE_CHANGED` | gateway | notification |
| `PROBLEM_CREATED` | gateway / problem | notification, github-worker |
| `DEADLINE_REMINDER` | scheduler | notification |
| `AI_ANALYSIS_COMPLETED` | ai-analysis | submission, gateway |
| `AI_ANALYSIS_FAILED` | ai-analysis | submission |

> 이벤트 페이로드는 [`monitoring-logging.md §5`](./monitoring-logging.md#5-saga-확장-필드) Saga 확장 필드 형식을 따름.

## 메트릭 / 로그 식별자

코드 어노테이션은 아니지만 동일 범주로 본 문서에서 catalog 유지:

- 메트릭 명명: `algosu_{service}_{snake_case}` — [`monitoring-logging.md §9-2`](./monitoring-logging.md#9-2-메트릭-명명)
- 에러 코드: `{SERVICE}_{CATEGORY}_{NNN}` — [`monitoring-logging.md §7`](./monitoring-logging.md#7-에러-코드-명명-규칙)

## 신규 추가 절차

1. 신규 `@guard` / `@event` / `@domain` 도입 시 본 문서의 해당 표에 추가
2. 신규 태그 자체(예: `@deprecated`) 도입은 ADR 또는 sprint ADR에서 결정 후 본 문서 신규 섹션 추가
3. PR 머지 시 `agents:scribe` 페르소나가 본 문서 동기화 검수 (Sprint 122 ADR §운영 결정)

## 관련 문서

- [monitoring-logging](./monitoring-logging.md) — 로그/메트릭 필드 규칙
- [`agents:scribe`](../../.claude/commands/agents/scribe.md) — 본 문서 갱신 책임 페르소나
- [`agents:_base`](../../.claude/commands/agents/_base.md) — 모든 agent 공통 참조 SSOT
