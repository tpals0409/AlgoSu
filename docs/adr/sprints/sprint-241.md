---
sprint: 241
title: "BE 분해 — ADR-030 Q-1(BE) + Q-2"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-240", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["refactoring", "code-quality", "backend"]
tldr: "ADR-030 처리 로드맵 3순위 스프린트. 동작 불변 리팩토링 2건 완료 — coverage threshold 유지 + Critic auto 2라운드 → 발견 4건 전수 수정. Q-1(BE): gateway study.service.ts(823줄·28메서드) → 도메인별 5서비스(StudyMemberService·StudyStatsService·StudyAccessService·MembershipCacheService·study.service 잔존) + 공유 타입으로 분리. StudyController가 3서비스 직접 주입(위임 보일러플레이트 0). 신규 5서비스 + controller 전부 100% coverage. Q-2: saga-orchestrator.service.ts(516줄) → SagaQuotaService(AI 한도·CB 소유)·SagaTimeoutService(재개·타이머·lifecycle)·잔존 Orchestrator(advance*/compensate*)의 3서비스 분해. 소비자 6곳 호출부 변경 0. Critic auto-critic R1(gatekeeper 산출물, base 241af57): M-1 redis.keys O(N)·L-1 structured logging 패턴 불일치 발견. Critic R1(conductor 산출물, base 606edb1): app.module.init.spec 주석 드리프트·fake timer 격리 패턴 불일치 발견. 4건 전수 수정 후 R2(base 3dc4b13) CLEAN. gateway coverage 98.66/96.94/96.83/98.93(threshold 98/95/96/98), submission coverage 98.69/94.13/98.93/99.04(threshold 97/92/96/97) 전부 유지."
---
# Sprint 241 — BE 분해 (ADR-030 Q-1 BE + Q-2)

## 목표

- ADR-030 처리 로드맵 3순위 — 백엔드 코드 품질 2건(Q-1 BE, Q-2)을 단일 스프린트에서 처리한다.
- 동작 불변 리팩토링 — API 응답·에러 타입·로그 메시지 텍스트·캐시 키 규격 전부 불변.
- coverage threshold(gateway 98/95/96/98, submission 97/92/96/97) 하향 금지 + Critic 머지 게이트 필수.

## 배경

- `/start` 인자: ADR-030 §결정 로드맵 3순위 Q-1(BE) + Q-2 처리.
- **Q-1 BE**: `study.service.ts` 823줄·28메서드 — CRUD·멤버·통계·접근 검증이 단일 파일에 혼재. Sprint 238 감사에서 대형 모듈 1위로 식별됨.
- **Q-2**: `saga-orchestrator.service.ts` 516줄 — 상태 전이·할당량·타임아웃 재개 책임이 한 파일에 집중. 동작은 검증됨(Sprint 238 §오판 정정).

## 작업 요약 (Gatekeeper + Conductor + Scribe, 총 4 commit + Critic 수정)

### Q-1 BE — study.service 도메인 분리 (Gatekeeper, commit `606edb1`)

**분리 구조 (StudyController 직접 주입, facade 없음)**

| 신규 파일 | 책임 | 의존성 |
|-----------|------|--------|
| `study.types.ts` | `StudyData`/`MemberData`/`InviteData` 공유 인터페이스 | — |
| `membership-cache.service.ts` | Redis 클라이언트 단독 소유 + `invalidate`/`invalidateAll` + OnModuleDestroy | configService, logger |
| `study-access.service.ts` | `verifyMembership`/`verifyAdmin` (private→public 승격) | identityClient |
| `study-stats.service.ts` | `getStudyStats`/`fetchActiveProblemIds` + fetch/map 헬퍼 분할(20줄 규칙) | configService, logger, identityClient |
| `study-member.service.ts` | getMembers/updateNickname/changeMemberRole/leaveStudy/removeMember + `findTargetMember`/`ensureNotLastAdmin` 헬퍼 DRY | identityClient, notificationService, access, cache, logger |
| `study.service.ts` (잔존) | CRUD 5종 + closeStudy/updateGroundRules + 초대 3종 + notifyProblemCreated | identityClient, notificationService, inviteThrottle, access, cache, logger |

- **StudyController가 StudyService/StudyMemberService/StudyStatsService를 직접 주입** — 멤버/통계 엔드포인트는 해당 서비스로 직접 라우팅. 위임 보일러플레이트 0 (notification/ 선례 스타일).
- `study.module.ts` providers에 신규 4서비스 등록. exports는 기존 `StudyService` 유지.
- 의존 방향: core/member → {access, cache} 단방향, 순환 없음.
- StudyService에서 `OnModuleDestroy`/Redis 소유 제거 → MembershipCacheService로 이관.
- 함수 20줄 규칙: `joinByInviteCode`(assertInviteUsable/assertJoinable/notifyAdminsOnJoin), `changeMemberRole`·`removeMember`(findTargetMember/ensureNotLastAdmin 공유), `leaveStudy`(notifyMemberLeft).
- spec: 1310줄 단일 spec → 서비스별 5개로 분할. 경계 케이스 보강 포함, 케이스 손실 0.

**동작 불변 검증**: API 응답 형태·구조화 로그 메시지·에러 타입(Forbidden/NotFound/Conflict/BadRequest)·캐시 키 규격(`membership:{studyId}:{userId}[:denied]`)·invalidate 호출 시점 전부 불변. StudyController 외부 소비자 없음 확인.

### Q-2 — saga-orchestrator helper 분리 (Conductor, commit `3dc4b13`)

**분해 설계 (의존 단방향: Timeout → Orchestrator → Quota)**

| 파일 | 책임 | 의존성 |
|------|------|--------|
| `saga-quota.service.ts` (신규 ~125줄) | `fetchAiQuota`/`checkAiQuota` + `aiQuotaCheck` CB 등록(생성자에서) + AI URL/Key config 소유 | configService, cbService |
| `saga-timeout.service.ts` (신규 ~210줄) | 부팅 미완료 Saga 재개 + `checkSagaTimeouts` 2분 타이머 + `resumeSaga` + lifecycle(onModuleInit/Destroy) | submissionRepo, mqPublisher, problemClient, **SagaOrchestratorService** |
| `saga-orchestrator.service.ts` (잔존 ~285줄) | `advance*`/`compensate*` 상태 전이만 잔존 | submissionRepo, mqPublisher, problemClient, statsCache, **SagaQuotaService** |

- **CB 등록을 onModuleInit → 생성자로 이동**: NestJS 초기화 순서 의존 자체를 제거.
- **소비자 6곳 호출부 변경 0**: `submission.service.ts:118,279` + `submission-internal.controller.ts:156,170,184,198`의 `advance*`/`compensate*` 시그니처·소속 불변.
- spec 분할: orchestrator spec(1047줄)에서 quota·timeout 케이스 분리. 경계 케이스 2건 보강(aiSkipped 낙관적 락 affected=0, 2분 타이머 발화 → checkSagaTimeouts). 케이스 손실 0.
- `submission.module.ts` providers에 `SagaQuotaService`/`SagaTimeoutService` 등록.

**동작 불변 검증**: `advance*`/`compensate*` 외부 시그니처 불변. 의존 단방향(Timeout→Orchestrator→Quota, 순환 없음). timeout spec이 실 DI 그래프 3서비스 compile 성공으로 입증.

### Critic auto-critic R1 수정 — gatekeeper 산출물 (commit `16fc2c4`)

Codex gpt-5.5 교차 리뷰(`--base 241af57`, commit `606edb1`): **✅ 머지 가능, 발견 2건**.

**M-1 (Gatekeeper 수정)**: `membership-cache.service.ts:59` `redis.keys('membership:{studyId}:*')` O(N) 블로킹 명령 → `do…while` 커서 루프(`redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)`) + 페이지별 배치 `del`로 교체. 동작(패턴 매칭 키 전부 삭제) 불변. 완화 요인: `MAX_MEMBERS=50` 하드 제한으로 즉각 위험 제한적이었으나 명시적 교체로 미래 한계 확장에 무관하게 안전.

**L-1 (Gatekeeper 수정)**: `membership-cache.service.ts:28` `this.logger.error(\`Redis 연결 오류: ${err.message}\`)` → `this.logger.error('Redis 연결 오류', err)`. `StructuredLoggerService` 2번째 인자 Error 직렬화 패턴(name/message/stack)에 정합. 인라인 보간 제거로 stack trace 보존.

spec: `membership-cache.service.spec.ts` scan 모킹 + 다중 커서 순회(cursor '42'→'0') 신규 케이스 추가(루프 분기 커버리지 확보). `study.service.spec.ts` deleteStudy 경로 ioredis 모킹도 scan 전환.

### Critic auto-critic R1 수정 — conductor 산출물 (commit `22a3a70`)

Codex gpt-5.5 교차 리뷰(`--base 606edb1`, commit `3dc4b13`): **✅ 머지 가능, 발견 2건**.

**(3) app.module.init.spec.ts 주석 드리프트 (Conductor 수정)**: `onModuleInit`/`onModuleDestroy`+setInterval 타이머가 `SagaOrchestratorService` → `SagaTimeoutService`로 이동했으나 주석이 구설계를 언급. `@related`에 `saga-timeout.service.ts` 추가, 라이프사이클 담당 언급을 `SagaTimeoutService`로 정정 (3곳).

**(4) saga-timeout.service.spec.ts fake timer 격리 (Conductor 수정)**: `jest.useFakeTimers()` 테스트 4건이 본문 끝에서만 `useRealTimers()` 복원 → 중간 assertion throw 시 fake timer가 다음 테스트로 누수되는 케이스. `afterEach`에 `jest.useRealTimers()` 추가(결과와 무관하게 일괄 보장) + 개별 `useRealTimers()` 4건 제거(복원 책임 afterEach 단일화).

### Critic auto-critic R2 — 전체 브랜치 (base `3dc4b13`, commits `16fc2c4` + `22a3a70`)

Codex gpt-5.5 교차 리뷰(`--base 3dc4b13`): **✅ CLEAN**.
- SCAN 구현 정확성 확인: `do...while(cursor !== '0')` 완전 순회 보장, off-by-one 없음.
- DEL 스프레드: COUNT 100 hint 기준 배치 한계 내, argument 오버플로우 없음.
- 인접 파일 Low 발견(범위 외): `invite-throttle.service.ts`·`deadline-reminder.service.ts`·`notification.service.ts`에 동일 Redis on-error 문자열 보간 패턴 잔존 → 후속 Gatekeeper/Herald 흡수 권장.

## 핵심 결정

1. **StudyController 직접 주입 vs facade**: facade 계층을 두면 StudyService → StudyFacade → N개 서비스로 간접화가 생기고 보일러플레이트가 증가한다. Controller가 업무 로직 없이 라우팅만 담당하므로 직접 3서비스 주입이 notification/ 선례와 일치하고 더 명확하다.
2. **CB 등록 생성자 이동**: `onModuleInit`에서 CB를 등록하면 NestJS 초기화 순서(SagaOrchestratorService가 SagaQuotaService보다 먼저 onModuleInit를 실행하는 경우)에 따라 CB 미등록 상태에서 할당량 체크가 호출될 수 있다. 생성자 이동으로 provider 인스턴스화 완료 시점에 CB가 보장된다.
3. **SCAN 전환은 50-member cap에도 선행 적용**: 현재 하드 제한으로 실 위험이 낮아도 Critic이 지적한 패턴 불일치는 이번 스프린트에서 직접 교체가 옳다 — 미래 한계 조정 시 별도 수정 없이 안전.
4. **fake timer 복원 afterEach 단일화**: 개별 테스트 끝의 `useRealTimers()` 4건 제거 후 `afterEach` 하나로 관리. assertion throw 시에도 복원이 보장되어 테스트 간 격리 신뢰성이 증가한다.

## 검증

- **gateway**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` 62 suites / **854 tests 전부 통과**
  - coverage: Statements **98.66** / Branches **96.94** / Functions **96.83** / Lines **98.93** (threshold 98/95/96/98 충족)
  - 신규 5서비스 + study.controller.ts: 전부 **100%**
  - membership-cache.service.ts (SCAN 수정 후): **100/100/100/100**
- **submission**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` 28 suites / **387 tests 전부 통과**
  - coverage: Statements **98.69** / Branches **94.13** / Functions **98.93** / Lines **99.04** (threshold 97/92/96/97 충족)
  - saga-quota.service.ts: **100/100/100/100** · saga-timeout.service.ts: **100/90/100/100** · saga-orchestrator.service.ts: **97.5/89.47/100/100**
- Critic auto-critic: gatekeeper 산출물 R1(발견 M-1/L-1) → 수정 → conductor 산출물 R1(발견 주석/timer) → 수정 → **R2 CLEAN** (base `3dc4b13`)
- 변경 파일(총 4 commit, 22 files):
  - Q-1 BE: `study.types.ts`(신규), `membership-cache.service.ts`(신규), `study-access.service.ts`(신규), `study-stats.service.ts`(신규), `study-member.service.ts`(신규), `study.service.ts`(수정), `study.controller.ts`(수정), `study.module.ts`(수정), 관련 spec 6종(신규/수정)
  - Q-2: `saga-quota.service.ts`(신규), `saga-quota.service.spec.ts`(신규), `saga-timeout.service.ts`(신규), `saga-timeout.service.spec.ts`(신규), `saga-orchestrator.service.ts`(수정), `saga-orchestrator.service.spec.ts`(수정), `submission.module.ts`(수정)
  - Critic 수정: `membership-cache.service.ts`(수정), `membership-cache.service.spec.ts`(수정), `study.service.spec.ts`(수정), `app.module.init.spec.ts`(수정), `saga-timeout.service.spec.ts`(수정)

## 교훈

1. **Critic이 "리팩토링 전 코드에서 이전된 패턴"도 지적한다**: `redis.keys()` O(N)은 분리 전 `study.service.ts`에 동일 로직이 있었으나 리팩토링 후 `membership-cache.service.ts`로 옮겨지면서 Critic의 시야에 들어왔다. 리팩토링은 기존 패턴의 재검토 기회이기도 하다.
2. **fake timer 격리는 afterEach에서 보장해야 한다**: 개별 테스트 본문 끝의 `useRealTimers()` 패턴은 assertion throw 시 복원을 건너뛴다. 이는 다음 테스트에 fake timer가 누수되는 간헐적 실패의 원인이 된다. lifecycle hook(afterEach/afterAll)으로 복원 책임을 단일화하는 것이 정석.
3. **분리 직후 주석 드리프트는 예측 가능하다**: 서비스를 분리할 때 라이프사이클 훅(onModuleInit/Destroy)이 이동하면 spec의 @related, 주석에서 이동 대상을 참조하는 모든 곳을 함께 갱신해야 한다. 기능 테스트는 통과해도 주석이 구설계를 기술하면 후속 개발자에게 오도가 된다.
4. **StudyController 직접 주입이 facade보다 명확하다**: 중간 계층이 업무 로직 없이 위임만 한다면 제거가 맞다. notification/ 선례를 찾아 검증하는 것이 아키텍처 결정의 재발명을 막는다.

신규패턴: **리팩토링 연동 Critic 발견 흡수 패턴**(분리 직후 Critic R1 → 동일 브랜치 수정 → R2 CLEAN으로 수렴) + **fake timer afterEach 단일화 패턴**(lifecycle hook 복원 책임 단일화).

## 이월

- Sprint 242 확정: Q-1(FE) + Q-7 — `AddProblemModal.tsx`(805줄)·`studies/[id]/settings/page.tsx`(844줄)·`problems/[id]/edit/page.tsx`(748줄) 분해 + 신규 컴포넌트 테스트 동반 작성.
- 인접 Redis on-error 로깅 패턴 정합 (`invite-throttle.service.ts`·`deadline-reminder.service.ts`·`notification.service.ts`): Critic R2 Low — Gatekeeper/Herald 후속 스프린트 흡수.
- 기존 이월: 하네스 점검 별도 슬롯(oracle-spawn 가드 항구화+윈도우 이름 장식 근본 해소+harness-checkup `--full`+Codex 모델 핀) · GA4 콘솔 3건 · 라이브 SEO · 하네스 cron · webhook regenerate · 누적 UAT · 블로그 후속 소재(CS 퀴즈/지운 것들/zstd).
