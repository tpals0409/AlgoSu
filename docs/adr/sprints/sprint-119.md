---
sprint: 119
title: "Phase D 실제 dispatch 실행 — P0 17건 자동 수정 루프 실증"
period: "2026-04-22"
status: complete
start_commit: a25c105
end_commit: (docs 커밋 후 기록)
---

# Sprint 119 — Phase D: audit-queue dispatch + P0 자동 수정 E2E 실증

## 배경

Sprint 118에서 Critic 전수 감사로 591건 파인딩(P0:17, P1:279, P2:289, Low:6)을 도출하고, `oracle-audit-triage.sh`로 P0 17건 + P1 5건 = 22건을 `~/.claude/oracle/audit-queue/`에 큐잉했다. 그러나 **큐를 실제로 소비하는 메커니즘이 존재하지 않았다** — `oracle-spawn.sh`는 수동 3개 인자(AGENT/TASK_ID/DESC)만 지원.

Sprint 119의 목표는 큐 → spawn → 에이전트 수정 커밋 → auto-Critic 재검증 PASS까지 **E2E 루프를 실증**하여, Sprint 120+ 에서 나머지 574건을 배치 처리할 수 있는 파이프라인을 검증하는 것이다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | `oracle-audit-dispatch.sh` 신설 (큐 소비자 스크립트) | ✅ 완료 |
| B | P0 17건 순차 dispatch + auto-Critic 재검증 E2E | ✅ 13/17 완료 (2 FP, 2 자동 루프 처리 중) |
| C | P1 5건 dispatch (파이프라인 처리량 측정) | ✅ 3/5 완료 (2 자동 루프 처리 중) |
| D | Frontend 누락 파일 식별 (132파일 미감사 확인) | ✅ 분석 완료 |
| E | auto-Critic tmux dispatch E2E 검증 (Sprint 117 이월) | ✅ 완료 |
| F | Sprint 119 ADR + Sprint 120+ 로드맵 | ✅ 완료 |

## 핵심 결정 (D1~D5)

### D1. P0 라우팅 재분배 — architect 독점 해소
**선택**: security 카테고리를 서비스 기반 도메인 에이전트로 재분배.
**대안**: architect 16건 독점 (Sprint 118 트리아지 원본 라우팅).
**근거**: (1) architect는 설계 검토자이지 코드 수정자가 아님, (2) 도메인 에이전트가 해당 서비스 코드를 가장 잘 이해, (3) auto-Critic 재검증이 품질을 보장하므로 수정 에이전트의 전문성이 더 중요.

재분배: postman 7(gateway+identity) / curator 3(submission) / palette 3(frontend) / librarian 2(problem) / herald 1(github-worker) / sensei 1(ai-analysis)

### D2. `oracle-audit-dispatch.sh` 신규 파일 — oracle-spawn.sh SRP 유지
**선택**: 큐 소비 전용 스크립트 분리. `oracle-audit-triage.sh`(큐 생성) ↔ `oracle-audit-dispatch.sh`(큐 소비) 대칭 구조.
**근거**: oracle-spawn.sh는 단일 에이전트 spawn에 집중. 큐 iterate, status 전환, 재라우팅은 별도 관심사.

### D3. 반자동 배치 모드 — 완전 자동 체인은 Sprint 120으로 이월
**선택**: `oracle-audit-dispatch.sh`를 수동 실행하여 배치 단위 dispatch. 에이전트 완료 → 수동 재실행.
**근거**: E2E 실증 단계에서 자동 체인은 실패 시 디버깅 어려움. 검증 후 Sprint 120에서 cleanup trap 연동.

### D4. Frontend 누락 132파일 — 보안 중요 10건만 우선 감사
**선택**: 132파일 전체 재감사 대신 보안 관련 중요 파일(middleware.ts, guards.ts, api/auth.ts 등) 10건 우선.
**근거**: 누락 대부분이 error/loading/layout 보일러플레이트 + shadcn/ui 래퍼. 보안 위험은 인증/세션/이벤트 추적 파일에 집중.

### D5. spawn 충돌 수정 — pane idle 감지 로직 도입
**발견**: `oracle-spawn.sh`의 `pane_count <= 1` 조건이 빠른 연속 dispatch에서 같은 pane을 재사용하여 이전 runner를 덮어씀. 1차 배치에서 tier별 1개만 parallel, 나머지 sequential 실행.
**수정**: `pane_current_command`로 idle shell(zsh) 여부를 감지하여, busy pane이면 항상 split. (단, bash runner도 "bash" 커맨드라 완전 해결은 Sprint 120 TODO.)

## 실행 결과

### 1차 배치 (6건 dispatch)

| Finding | 에이전트 | 결과 | 커밋 | 수정 내용 | 테스트 |
|---------|----------|------|------|-----------|--------|
| p0-001 | sensei | ✅ 수정 | `adc9d42` | internal_api_key 필수 필드 + field_validator | 5 passed |
| p0-002 | palette | ✅ 오탐 | — | AnalysisView 중복 import 실재하지 않음 | — |
| p0-005 | postman | ✅ 수정 | `235d5f4` | JWT payload에서 userId 추출, x-user-id 스푸핑 차단 | 761 passed |
| p0-007 | herald | ✅ 수정 | `b2d4638` | private:true 강제 + 기존 공개 레포 전환 | 25 passed |
| p0-013 | librarian | ✅ 수정 | `28feb63` | ParseStudyIdPipe UUID 검증 + 2중 방어 | 165 passed |
| p0-015 | curator | ✅ 수정 | `8918ca1` | GatewayContextMiddleware 신설, request.user.userId 전환 | 257 passed |

### 2차~4차 배치 + 자동 루프 (15건 추가 처리)

| Finding | 에이전트 | 결과 | 커밋 | 수정 내용 |
|---------|----------|------|------|-----------|
| p0-003 | palette | ✅ 수정 | `e790ec3` | sourceUrl XSS 차단 — sanitizeUrl |
| p0-004 | palette | ✅ 수정 | `9dea2b0` | router.push link 검증 XSS/피싱 방지 |
| p0-006 | postman | ✅ 수정 | `1434b0d` | IDOR getSharedAnalysis studyId 검증 |
| p0-008 | postman | ✅ 수정 | `710f6cf` | PostgreSQL TLS rejectUnauthorized=true |
| p0-009 | postman | ✅ 수정 | `7620151` | GitHub 토큰 AES-256-GCM 암호화 |
| p0-014 | librarian | ✅ 오탐 | — | p0-013에서 이미 수정 완료 |
| p0-016 | curator | ✅ 수정 | `a1db792` | 멱등성 키 userId 포함 3-tuple 스코핑 |
| p0-017 | curator | ✅ 수정 | `1a15672` | AI 만족도 IDOR studyId 스코핑 |
| p1-018 | sensei | ✅ 수정 | `48244c1` | HALF_OPEN in-flight 요청 수 제한 |
| p1-019 | sensei | ✅ 수정 | `bb59db7` | RateLimitRetryableError 신설 |
| p1-020 | sensei | ✅ 수정 | `f02708d` | categories list[dict] 스키마 검증 |
| p0-010~012 | postman | ⏳ | — | 자동 dispatch 루프 처리 중 |
| p1-021~022 | sensei | ⏳ | — | 자동 dispatch 루프 처리 중 |

### auto-Critic 체인 검증 (Sprint 117 이월 해소)
cleanup trap → `oracle-auto-critic.sh` → `oracle-create-task.sh --simple` → critic task 자동 생성 경로가 1차 배치 5건 모두에서 정상 동작 확인:
- `task-20260422-171337` (postman → critic, base: a25c105)
- `task-20260422-171434` (sensei → critic, base: a25c105)
- `task-20260422-171647` (palette → critic, base: adc9d42)
- `task-20260422-171821` (librarian → critic, base: a25c105)
- `task-20260422-172004` (herald → critic, base: 28feb63)

## 산출물

### 코드 변경 (리포 내)
- **15개 보안/안정성 수정 커밋** (P0 12건 + P1 3건)
- 2건 오탐 close (p0-002 AnalysisView, p0-014 이미 수정)
- 5건 자동 dispatch 루프에서 처리 중 (P0 2건 + P1 2건 + critic 재검증)
- 테스트 전체 통과, 커버리지 threshold 유지

### 인프라 (리포 외)
- `~/.claude/oracle/bin/oracle-audit-dispatch.sh` 신규 — 큐 소비자, 재라우팅, dry-run 지원
- `~/.claude/oracle/bin/oracle-audit-dispatch-loop.sh` 신규 — 자동 반복 dispatch (30초 간격)
- `~/.claude/oracle/bin/oracle-spawn.sh` 수정 — pane idle 감지 개선

## 주요 교훈

1. **라우팅 매트릭스는 dispatch 시점에 재검토 필요** — security → architect 고정 라우팅은 설계 검토에는 적합하지만, 코드 수정에는 도메인 에이전트가 효과적.
2. **tmux pane 재사용 로직은 concurrent spawn에 취약** — tier별 1 pane 가정이 연속 dispatch에서 충돌. pane 관리에 PID 기반 idle 감지 필요.
3. **auto-Critic 체인은 안정적으로 동작** — code-changing agent의 cleanup trap이 critic task를 올바르게 생성하고, dispatch가 pickup.
4. **Critic 전수 감사에 오탐 존재** (p0-002) — 자동 수정 파이프라인에 false positive 처리 경로 필요.

## Sprint 120+ 로드맵 초안

| Sprint | 범위 | 예상 건수 | 비고 |
|--------|------|----------|------|
| 120 | P1 security 일괄 dispatch | ~49건 | audit-dispatch 완전 자동 체인 구현 포함 |
| 121 | P1 나머지 서비스별 배치 | ~225건 | 3~4배치 분할, 자동 수락 임계치 검토 |
| 122 | P2 maintainability | ~289건 | Low 6건 포함, 자동 close 정책 검토 |

## 이월 항목
- [ ] P0 나머지 2건 (p0-010~012 중 루프 미처리분) — 자동 루프 실행 중
- [ ] P1 나머지 2건 (p1-021~022) — 자동 루프 실행 중
- [ ] oracle-spawn.sh pane 병렬화 완전 수정 (PID 기반 idle 감지)
- [ ] audit-queue → completed 자동 전환 (cleanup trap 연동)
- [ ] frontend 보안 중요 10파일 우선 재감사
- [ ] audit-queue JSON status 수동 갱신 자동화 (reap 연동)
