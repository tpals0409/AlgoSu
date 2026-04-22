---
sprint: 120
title: "Sprint 119 이월 항목 처리 — P0/P1 잔여 수정 + oracle-spawn 병렬화 + frontend 보안 재감사"
period: "2026-04-22"
status: complete
start_commit: f2bde3e
end_commit: 940a746
---

# Sprint 120 — Sprint 119 이월 작업 마감

## 배경

Sprint 119에서 audit-queue 22건 중 P0 13건 + P1 3건을 완료하고 E2E 파이프라인을 실증했으나, 4건(P0 3 + P1 1)이 pending/in_progress 상태로 남았다. 또한 `oracle-spawn.sh`의 concurrent pane 경합, audit-queue 수동 status 전환 문제, frontend 보안 재감사가 이월되었다.

Sprint 120의 목표는 이 이월 항목들을 완전히 마감하고, 파이프라인 자동화 수준을 높여 Sprint 121+에서 P1 49건 배치 처리를 가능하게 하는 것이다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | audit-queue status 동기화 (4건 in_progress → completed) | ✅ 완료 |
| B | 잔여 보안 수정 4건 dispatch (P0 3 + P1 1) | ✅ 4/4 완료 |
| C | oracle-spawn.sh pane 병렬화 완전 수정 (spawn lock) | ✅ 완료 |
| D | audit-queue 자동 status 전환 (cleanup trap 연동) | ✅ 완료 |
| E | Frontend 보안 중요 10파일 재감사 | ✅ P1 3건 발견, 큐 등록 |
| F | Sprint 120 ADR | ✅ 완료 |

## 핵심 결정

### D1. audit-queue drift 해소 — git log 기반 역추적
**문제**: Sprint 119에서 자동 루프로 처리된 4건(p0-009, p1-019~021)의 커밋은 반영되었으나 audit-queue JSON의 status가 in_progress로 남아 있었다.
**수정**: git log에서 커밋 해시를 매핑하여 수동 동기화. Phase D의 cleanup trap 자동화로 재발 방지.

### D2. getGitHubTokenInfo 엔드포인트 분리
**선택**: 기존 `/github-token` → `{ has_token: boolean }` 반환 (토큰 미포함) + 새 `/github-encrypted-token` → `{ encrypted_token }` 반환 (내부 전용)
**대안**: 기존 엔드포인트에서 encrypted 접두사 필드명으로 반환
**근거**: 최소 권한 원칙 — 토큰 존재 확인만 필요한 호출자(oauth.service)와 실제 토큰이 필요한 호출자(github-worker)를 분리. 엔드포인트 수준에서 접근 범위를 명확히 구분.

### D3. atomicUpsert TOCTOU 방지 — PostgreSQL WHERE 절
**선택**: TypeORM `orUpdate` 대신 raw query + `WHERE users.oauth_provider = $4` 조건
**대안**: 애플리케이션 레벨 re-fetch + provider 재검증
**근거**: DB 레벨에서 원자적으로 차단해야 race window가 0. 프로젝트 내 softDeleteUser에서 이미 raw query 패턴 사용 중.

### D4. spawn lock — mkdir 기반 전역 직렬화
**선택**: `_lib.sh`에 `acquire/release_spawn_lock` 추가, pane allocation 전 구간(idle 감지 → send-keys)을 atomic으로 보호.
**대안**: PID 파일 기반 per-pane lock
**근거**: mkdir은 POSIX atomic이고 macOS flock 미지원 환경에서 이미 검증된 패턴(`panes_locked_update`). 전역 lock이 per-pane lock보다 구현 간단하며, spawn은 밀리초 단위라 병목 없음.

### D5. Frontend 재감사 결과 — P0 0건, P1 3건
**감사 범위**: 인증/인가/세션/API 통신/URL 처리 관련 10파일
**결과**: Sprint 119의 XSS/Open Redirect 수정(sanitizeUrl, sanitizeRedirect)이 잘 적용됨. P1 3건은 기능적 보안(shared 경로 누락, admin CSR 전용, callback 에러 표시)으로 데이터 유출 위험은 낮음.
**판정**: P1-023~025는 Sprint 121+ 큐에 적재. 현 스프린트는 이월 P0 마감에 집중.

## 실행 결과

### Phase B — 보안 수정 4건

| Finding | 에이전트 | 결과 | 커밋 | 수정 내용 | 영향 범위 |
|---------|----------|------|------|-----------|-----------|
| p0-010 | postman | ✅ | `973d709` | getGitHubTokenInfo → has_token 분리, encrypted 별도 엔드포인트 | identity, gateway, github-worker (12파일) |
| p0-011 | postman | ✅ | `fb10d51` | findBySlug 공개 프로필 whitelist 프로젝션 | identity controller (2파일) |
| p0-012 | postman | ✅ | `51c6295` | atomicUpsert WHERE provider 조건 + re-fetch 검증 | identity service (2파일) |
| p1-022 | sensei | ✅ | `acb7199` | problem_id/study_id/user_id UUID validator | ai-analysis (2파일) |

### Phase C-D — 인프라 개선 (리포 외부)

| 대상 | 수정 내용 |
|------|-----------|
| `_lib.sh` | `acquire/release_spawn_lock` 함수 추가 (mkdir 기반 atomic lock) |
| `oracle-spawn.sh` | pane allocation 구간 spawn lock 적용 + cleanup trap에 audit-queue 자동 status 전환 |

### Phase E — Frontend 재감사 결과

| Finding | 파일 | 내용 | 에이전트 |
|---------|------|------|----------|
| p1-023 | middleware.ts | /shared 경로 PUBLIC_PATHS 누락 | palette |
| p1-024 | admin/layout.tsx | admin 권한 CSR 전용 | palette |
| p1-025 | callback/page.tsx | OAuth error fragment 직접 표시 | palette |

## audit-queue 최종 현황

| 상태 | Sprint 119 종료 시 | Sprint 120 종료 시 |
|------|-------|-------|
| completed | 16 | 22 |
| false_positive | 2 | 2 |
| pending | 4 | 3 (신규 P1) |
| in_progress | 4 | 0 |
| **합계** | 22 + 4 = 26? → 22 | 22 + 3 = 25 |

- 기존 22건: 전부 completed(20) 또는 false_positive(2)로 해소
- 신규 3건(p1-023~025): Sprint 121+ 큐 대기

## 변경 통계

- **코드 커밋**: 4건 (14파일, +269/-83 lines)
- **인프라 수정**: 2파일 (`_lib.sh`, `oracle-spawn.sh`)
- **audit-queue 갱신**: 8건 (기존 4건 status 동기화 + 신규 3건 등록 + 4건 completed 전환)
- **테스트**: Identity 263 passed, Gateway 765 passed, GitHub Worker 118 passed

## Sprint 121+ 로드맵

1. **P1 보안 49건 배치 dispatch** — Sprint 118 트리아지에서 도출된 P1 279건 중 우선 49건
2. **Frontend P1 3건 처리** (p1-023~025)
3. **audit-queue 완전 자동화** — Phase D에서 cleanup trap 연동 완료, 실전 검증 필요
4. **MEMORY.md 잔여**: Redis 통계 캐시, problem.tags JSON, SWR 전환
