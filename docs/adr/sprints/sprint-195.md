---
sprint: 195
title: "submission CacheModule 순환 의존성 핫픽스 + StudyMemberGuard Redis 통합"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["operations"]
tldr: "Sprint 194에서 추가된 submission CacheModule의 NestJS DI 순환 의존성(cache.module.ts ↔ stats-cache.service.ts 양방향 import)으로 신규 이미지가 부트스트랩 26ms 만에 결정론적으로 throw → CrashLoopBackOff → 롤아웃 차단. REDIS_CLIENT 토큰을 cache.constants.ts로 분리해 사이클을 구조적으로 차단하고, 실제 모듈 그래프를 컴파일하는 cache.module.spec.ts 회귀 테스트를 신설(단위 테스트가 못 잡던 갭 차단). 부수로 StudyMemberGuard의 독립 ioredis 인스턴스를 글로벌 REDIS_CLIENT DI 주입으로 통합(연결 풀 2→1). build 0·ESLint 0 errors·jest 379 pass·Critic(Codex gpt-5.5) 0건·CI #343 36 pass / 0 fail. 머지 후 클러스터 재배포는 서버 측."
---
# Sprint 195 — submission CacheModule 순환 의존성 핫픽스 + StudyMemberGuard Redis 통합

## 목표

- Sprint 194 신규 코드가 유발한 submission-service 부트스트랩 실패(NestJS DI 순환 의존성)를 해소해 **롤아웃 블로커를 제거**한다.
- 동일 클래스 버그(모듈 그래프 컴파일 실패)가 CI에서 잡히도록 **회귀 방어 테스트**를 추가한다.
- (부수) `StudyMemberGuard`의 독립 ioredis 인스턴스를 글로벌 `REDIS_CLIENT`로 통합해 연결 풀을 2→1로 줄인다.

## 배경

- Sprint 194에서 Submission 서비스에 글로벌 `CacheModule`(REDIS_CLIENT) + `StatsCacheService`를 신설했다(대시보드 통계 Cache-Aside).
- 머지 후 신규 이미지가 **CrashLoopBackOff**에 빠졌다. 서버 에이전트 진단 + 코드 교차검증으로 원인을 확정: 부트스트랩 26ms 만에 `A circular dependency has been detected inside CacheModule` throw → 프로세스 종료. 결정론적이라 재시도해도 100% 같은 지점에서 실패.
- **사용자 영향 없음**: 구버전 ReplicaSet(2 Pod)이 정상 서빙 중. 롤아웃만 막혀 신규 기능(통계 캐시)이 배포되지 않은 상태였다.
- **OOM/Redis 장애 아님**: Last State Terminated `Exit Code 1`(137 OOMKilled 아님), memory limit 1Gi 여유, init `db-migrate` Exit 0, Redis Pod 73일 무중단. 기존 인계서의 "lazy connect 비차단" 분석은 맞으나, throw는 그 이전 DI 그래프 빌드 단계에서 발생.

## 결정

### D1. 스코프 — 핫픽스 + 가드 Redis 통합 (사용자)

- AskUserQuestion으로 확정. ① 순환 의존성 핫픽스 ② `StudyMemberGuard`의 독립 ioredis를 `CacheModule`의 `REDIS_CLIENT`로 통합까지 한 PR에. 원래 Sprint 195 예정이던 `problem.tags` JSON 전환은 **Sprint 196으로 이월**.

### D2. 롤아웃 처리 — 머지 후 서버 재배포 (사용자)

- 구버전이 정상 서빙 중이라 긴급 롤백 불필요. 코드 핫픽스 + PR + CI green까지는 본 워크플로우에서, **머지 후 클러스터 재배포·CrashLoopBackOff 알림 해제는 서버 측(사용자)**.

### D3. 순환 차단 방식 — 토큰 별도 파일 분리

- 근본 원인: `cache.module.ts`가 `REDIS_CLIENT` 토큰을 **정의**(`:13`)하면서 동시에 `StatsCacheService`를 **import**(`:11`)하고, `stats-cache.service.ts`는 그 토큰을 `cache.module`에서 **역참조**(`:10`) → 모듈 평가 시점에 `StatsCacheService`가 `undefined`로 들어가 Nest가 throw.
- `REDIS_CLIENT`를 `cache/cache.constants.ts`로 분리하고 `cache.module.ts`·`stats-cache.service.ts`가 모두 거기서 import → 두 파일 간 양방향 참조 소멸. 결과 그래프: module→service, module→constants, service→constants (사이클 0).

### D4. 회귀 방어 — 실제 모듈 그래프 컴파일 테스트

- 기존 `stats-cache.service.spec.ts`는 실제 `CacheModule`을 import하지 않고 provider를 수동 조립 → 사이클을 일으키는 DI 그래프를 한 번도 컴파일하지 않아 throw를 못 잡았다.
- `cache.module.spec.ts` 신설: `Test.createTestingModule({ imports: [LoggerModule, CacheModule] }).overrideProvider(REDIS_CLIENT).useValue(mockRedis).compile()`로 **실제 모듈 그래프를 컴파일**하고 `StatsCacheService`/`REDIS_CLIENT` resolve를 단언. 수정 전이면 throw(실패), 후엔 통과 → 동일 클래스 회귀를 CI가 차단. (`LoggerModule`이 `@Global`이라 `StructuredLoggerService` 제공, REDIS_CLIENT override로 실 Redis 연결 회피, afterEach `close()`로 open handle 방지.)

### D5. 가드 Redis 통합 — @Inject(REDIS_CLIENT)

- `StudyMemberGuard` 생성자의 `new Redis(redisUrl)` 직접 생성을 제거하고 `@Inject(REDIS_CLIENT) redis: Redis`로 주입. 중복 `redis.on('error')` 핸들러는 `cache.module` 팩토리가 중앙화하므로 제거. `ConfigService`는 `GATEWAY_INTERNAL_URL`/`INTERNAL_KEY_GATEWAY` 용도로 유지. 가드는 submission/review/study-note 3개 컨트롤러에서 `@UseGuards`로 사용 — `CacheModule`이 `@Global`이라 `REDIS_CLIENT`가 전역 resolve되어 provider 등록 변경 불필요.

## 구현

### 구현 커밋 (2커밋, PR #343 squash → `2e1502e`)

- `d050b9a` fix(submission) — cache module 순환 의존성 해소 (토큰 분리) + 부트스트랩 회귀 테스트
  - 신규: `cache/cache.constants.ts`(REDIS_CLIENT 토큰) · `cache/cache.module.spec.ts`(DI 그래프 컴파일 회귀 테스트 3건)
  - 수정: `cache.module.ts`(로컬 토큰 정의 제거 → constants import) · `stats-cache.service.ts`·`stats-cache.service.spec.ts`(import 출처 → constants)
- `60f2e1f` refactor(submission) — StudyMemberGuard를 CacheModule REDIS_CLIENT로 통합 (ioredis 인스턴스 2→1)
  - 수정: `common/guards/study-member.guard.ts`(`new Redis()` 제거 → `@Inject(REDIS_CLIENT)` 주입, 중복 핸들러 제거) · `study-member.guard.spec.ts`(`jest.mock('ioredis')` 제거 → DI mock 주입)

## 검증

- **타입/빌드**: `tsc --noEmit` 에러 0. `npm run lint`(eslint `{src,test}/**/*.ts`) **error 0**, warning 9건(전부 기존 `no-unused-vars`, 이번 변경 무관). `mockRedis as any`는 spec 파일 한정 — `.eslintrc.js` overrides가 `*.spec.ts`에 `no-explicit-any: 'off'`(Sprint 194의 소스 파일 `as any`와 다름).
- **테스트**: jest **379 passed / 0 failed**(24 suites). 커버리지 threshold 전부 통과(statements 98%+·branches 94%+·functions 96%+). 신규 `cache.module.spec.ts` 3건이 실제 DI 그래프 컴파일·StatsCacheService/REDIS_CLIENT resolve를 검증.
- **Critic**: `codex review --base main`(gpt-5.5) — **Critical/High/Medium/Low 0건**. "The StudyMemberGuard's new shared Redis injection is backed by the global CacheModule in the application module, and the added tests cover the intended DI regression."
- **CI #343**: **36 pass / 14 skip / 0 fail** — Quality·Coverage Gate·Build Submission·Test Submission·E2E·Trivy 전부 pass.
- **운영**: 구버전 서빙 중이라 다운타임 없음. 머지 후 재배포로 신규 ReplicaSet 정상 기동 + CrashLoopBackOff 해소(서버 측).

## 교훈 / 패턴

- ① **단위 테스트가 모듈 DI 그래프를 컴파일하지 않으면 순환 의존성을 못 잡는다** — provider를 수동 조립한 spec(`stats-cache.service.spec.ts`)은 14건 전부 green이었지만 부트스트랩은 100% 실패했다. 신규 모듈은 **실제 `imports: [Module]` + `.compile()`** 회귀 테스트로 그래프 빌드를 한 번은 검증해야 "테스트 green = 부트스트랩 가능"이 성립한다.
- ② **토큰을 정의하는 파일과 그 토큰을 import하는 파일이 서로를 import하면 순환** — DI 토큰/상수는 **의존성 없는 별도 파일**(`*.constants.ts`)에 두는 것이 NestJS에서 순환을 구조적으로 예방하는 표준. 모듈 파일은 provider 정의(서비스 import)를, 상수 파일은 토큰만.
- ③ **"진단 가설"을 코드로 끝까지 교차검증** — stale 알림/OOM/Redis 장애 가설을 모두 배제하고 (Exit 1·init Exit 0·메모리 여유·Redis 73일 가동) 실제 crash 로그의 throw 메시지 + 양방향 import를 코드로 확인한 뒤 수정에 착수 → 잘못된 원인에 시간 낭비 회피.

## 신규 패턴

- **DI 토큰은 의존성 없는 constants 파일로 분리** — 모듈(provider 정의)과 토큰 소비처(서비스)가 같은 토큰을 참조하되 서로 import하지 않도록. NestJS 순환 의존성 표준 예방책.
- **신규 모듈은 "DI 그래프 컴파일" 회귀 테스트 필수** — `Test.createTestingModule({ imports: [RealModule] }).compile()`로 부트스트랩 동등 검증. provider 수동 조립 spec만으론 그래프 빌드 throw를 못 잡는다. 외부 연결(Redis 등)은 `overrideProvider().useValue(mock)`로 회피.

## 이월 항목

- **problem.tags JSON 컬럼 전환 + seed 데이터 확충** → Sprint 196 (원래 195 예정, D1로 이월).
- (선택) **app.module 부트스트랩 스모크 테스트** — 전체 DI 그래프를 한 번에 방어(TypeORM/Postgres mock 필요, 본 회귀 테스트보다 무거움).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (Dockerfile 정합) — Sprint 192~194에서 분리, 별도 스프린트.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~195 누적.
