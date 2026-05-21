---
sprint: 194
title: "Redis 통계 캐시 — 대시보드 DB 직접 집계 → 캐시 전환"
date: "2026-05-22"
status: completed
agents: [Oracle, Architect, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["data", "operations"]
tldr: "Submission 서비스의 getStudyStats() 대시보드 통계 조회를 매 요청 9~12개 GROUP BY/COUNT/DISTINCT 집계에서 Redis Cache-Aside로 전환한다. 신규 글로벌 CacheModule(REDIS_CLIENT) + StatsCacheService(get/set/SCAN 무효화/Fail-Open), 캐시 키 stats:{studyId}:w={week}:u={user}:p={SHA256 fingerprint}, TTL 300초 안전망 + 이벤트 무효화(create/updateAiResult + Saga DONE 3경로). Critic 3R로 P2 3건 전부 해소(activeProblemIds fingerprint·빈배열 guard·Saga 외부 DONE 경로), CI 1차 실패(no-explicit-any) → StudyStatsResult 타입 추출로 해소. tsc 0·jest 376 pass·CI #341 36 pass / 0 fail·Critic 최종 0건."
---
# Sprint 194 — Redis 통계 캐시 (대시보드 DB 직접 집계 → 캐시 전환)

## 목표

- Submission 서비스의 `getStudyStats()` 대시보드 통계 조회를 **Redis Cache-Aside**로 전환한다.
- 매 요청마다 9~12개 GROUP BY/COUNT/DISTINCT 집계가 실행되던 구조를, 캐시 히트 시 0 쿼리로 줄인다.
- 캐시 미스/무효화 정책을 명확히 정의하고, 제출 직후 대시보드 반영 체감(staleness 최소화)을 보장한다.

## 배경

- 대시보드(`/dashboard`)·Analytics 페이지가 호출하는 통계는 Gateway `GET /api/studies/:id/stats` → Submission `GET /internal/stats/:studyId` → `submission.service.ts getStudyStats()`로 흐른다. 캐시가 없어 매 요청 9~12개 집계 쿼리가 실행되었다.
- Redis 인프라는 이미 완비(ioredis 5.10.1, `infra/k3s/redis.yaml`, `docker-compose.dev.yml`, `REDIS_URL`). Problem 서비스는 글로벌 `cache.module.ts`(REDIS_CLIENT) + `deadline-cache.service.ts`(Cache-Aside + Fail-Open) 패턴을 운영 중이었다.
- 그러나 **Submission 서비스엔 글로벌 Redis 모듈이 없었다** — `study-member.guard.ts`가 `new Redis()`로 독립 인스턴스만 보유. 이번에 Submission용 글로벌 캐시 모듈 신설이 필요했다.

## 결정

### D1. 무효화 전략 — TTL + 이벤트 무효화 (사용자)

- AskUserQuestion으로 확정. **TTL(안전망 300초) + 이벤트 무효화**. 제출 생성·분석 완료·Saga DONE 전환 시 해당 `studyId` 통계 캐시를 즉시 삭제 → "방금 제출한 게 대시보드에 즉시 반영" 보장. TTL은 누락 경로에 대한 안전망.
- 대안(짧은 TTL-only)은 최대 TTL만큼 stale 가능 → UX 약점으로 기각.

### D2. 캐시 키 입도 — 단일 키 + 파라미터 반영 (사용자)

- AskUserQuestion으로 확정. 전체 응답을 단일 키로 캐싱하되 `weekNumber`·`userId` 파라미터를 키에 반영. 무효화는 `stats:{studyId}:*` SCAN 패턴 삭제로 모든 조합 일괄 제거.
- 키 형식: `stats:{studyId}:w={weekNumber|'-'}:u={userId|'-'}:p={fingerprint|'-'}`.

### D3. activeProblemIds fingerprint 포함 (Critic R1 P2)

- 착수 설계에서 `activeProblemIds`는 "시점 결정적이므로 키 제외"로 판단했으나, Critic이 정합성 결함을 지적: `activeProblemIds`로 필터된 결과가 키에 반영되지 않으면, 다른 active 목록(또는 unfiltered) 요청이 잘못된 캐시를 받을 수 있다(TTL 동안). → **정렬 후 SHA-256 앞 8자 fingerprint**를 키에 포함해 해소. 순서 무관 동일 fingerprint 보장.

### D4. 빈 배열 fast-path를 캐시 조회 전으로 이동 (Critic R2 P2)

- `activeProblemIds`가 빈 배열([])이면 `buildProblemFingerprint([])`이 `-`를 반환 → unfiltered 키와 충돌. 빈 배열은 "ACTIVE 문제 없음 → 빈 결과" fast-path이므로, **캐시 조회 이전**으로 이동해 충돌을 원천 차단.

### D5. Saga 외부 DONE 전환 경로에서도 무효화 (Critic R2 P2)

- `saga_step='DONE'` 파생 통계(uniqueAnalyzed·doneCount·analyzedCount 등)는 `SubmissionService` 외부의 `SagaOrchestratorService`에서도 변경된다. AI 한도 초과 DONE 직행·TOKEN_INVALID DONE·compensateAiFailed DONE 3경로에 `statsCache.invalidate(studyId)`를 추가(studyId 미보유 경로는 `findOne(select: ['studyId'])`로 조회).

## 구현

### 구현 커밋 (4커밋, PR #341 squash → `91f50b3`)

- `d028e78` feat(submission) — Redis stats cache 기본 구현 (7 files)
  - 신규: `cache/cache.module.ts`(REDIS_CLIENT @Global, ConfigService REDIS_URL, 재시도/에러 핸들링) · `cache/stats-cache.service.ts`(get/set JSON+EX 300/invalidate SCAN+DEL/Fail-Open) · `cache/stats-cache.service.spec.ts`
  - 수정: `app.module.ts`(CacheModule import) · `submission.service.ts`(StatsCacheService 주입 + cache-aside + create/updateAiResult invalidate) · `submission.service.spec.ts` · `ai-satisfaction.spec.ts`(DI mock)
- `dc41511` fix(submission) — activeProblemIds fingerprint를 캐시 키에 포함 (Critic R1 P2). `createHash('sha256')` import, `buildProblemFingerprint()` 헬퍼, get/set 시그니처 확장 + 테스트 보강.
- `23bd5ce` fix(submission) — 빈 배열 guard를 캐시 전 이동 + SagaOrchestrator 3경로 무효화 (Critic R2 P2 ×2). saga-orchestrator.service.ts/spec.ts에 StatsCacheService 주입.
- `[CI 수정]` fix(submission) — `getStudyStats` 인라인 반환 타입을 `StudyStatsResult` 인터페이스로 추출, 캐시 히트 반환의 `as any`를 `as StudyStatsResult`로 교체(`@typescript-eslint/no-explicit-any` 해소).

## 검증

- **타입/빌드**: `tsc --noEmit` 에러 0. `eslint src` **error 0**(잔존 9건은 기존 코드 warnings, 이번 변경 무관).
- **테스트**: jest **376 passed / 0 failed**(23 suites). 커버리지 threshold 통과(statements 98.40%·branches 94.40%·functions 96.22%). StatsCacheService 14건(히트/미스/설정/SCAN 무효화/Fail-Open/fingerprint), SubmissionService cache-aside 3건, SagaOrchestrator 47건(StatsCacheService mock 주입).
- **CI 1차 실패 → 해결**: `Quality — submission`에서 `submission.service.ts:328 Unexpected any` 에러. 원인은 로컬 검증이 `tsc`만 돌리고 ESLint를 빠뜨림. `StudyStatsResult` 타입 추출로 수정 → 2차 CI.
- **Critic**: `codex review --base main`(gpt-5.5) **3 라운드**. R1 P2 1건(activeProblemIds fingerprint), R2 P2 2건(빈배열 guard·Saga 외부 DONE 경로) → 전부 반영. **최종 0건**("the added invalidation/cache-aside paths appear consistent with the existing stats logic. I did not identify any discrete correctness, security, or performance regression").
- **CI #341 (2차)**: **Passed 36 / Failed 0** — Quality submission·Coverage Gate·Build Submission·E2E Programmers·Trivy 전부 pass.

## 교훈 / 패턴

- ① **캐시 키는 결과를 결정하는 모든 입력을 반영해야 한다** — `getStudyStats(studyId, weekNumber, userId, activeProblemIds)`의 4번째 입력(`activeProblemIds`)을 "시점 결정적"이라 키에서 뺐다가 Critic이 정합성 결함 포착. 배열 입력은 **정렬 후 해시 fingerprint**로 키에 안정적으로 포함하고, 빈 배열은 fast-path를 캐시 앞으로 빼 키 충돌을 차단. "캐시 키 누락 = 조용한 잘못된 응답"이므로 입력 누락을 끝까지 의심.
- ② **파생 데이터 무효화는 그 데이터를 바꾸는 모든 코드 경로를 추적** — `saga_step='DONE'` 파생 통계는 `SubmissionService`뿐 아니라 `SagaOrchestratorService`의 보상/스킵 경로에서도 변경된다. "주 변경 지점"만 무효화하면 외부 전환 경로에서 stale이 TTL 동안 남는다. Critic이 외부 경로를 짚어 3경로 추가 무효화.
- ③ **로컬 품질 게이트는 CI와 동일하게 — tsc만으론 부족** — `as any`는 `tsc`는 통과하지만 ESLint `no-explicit-any`에서 막힌다. 커밋 전 로컬 검증에 **ESLint도 반드시 포함**(CLAUDE.md 품질 게이트에 명시됨)해야 CI 1차 실패를 예방. 이번엔 누락 → CI 실패 → 재수정으로 학습.

## 신규 패턴

- **배열 입력은 정렬 + 해시 fingerprint로 캐시 키화** — 순서 무관 동일 키 보장 + 키 길이 고정. 빈 배열은 별도 fast-path로 분리.
- **파생 통계 무효화 = 변경 코드 경로 전수 추적** — 주 서비스 + 오케스트레이터의 모든 상태 전환 지점에서 invalidate. studyId 미보유 경로는 최소 select 조회로 보강(실패/예외 경로라 추가 SELECT 부담 무시 가능).
- **Submission 글로벌 CacheModule** — Problem 서비스 패턴(REDIS_CLIENT @Global + Fail-Open)을 차용해 서비스 간 캐시 인프라 일관성 확보.

## 이월 항목

- (선택 이월) **CI PYTHON_VERSION 3.12 → 3.13 상향** (Dockerfile 3.13 정합) — Sprint 192/193에서 분리, 별도 스프린트 검토.
- (후속) Redis 통계 캐시 → **완료**(본 스프린트).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~194 누적.
