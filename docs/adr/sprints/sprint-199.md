---
sprint: 199
title: "app.module 라이프사이클(.init) 부트스트랩 스모크 확장 (4개 NestJS 서비스)"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "dependency-injection", "lifecycle"]
tldr: "Sprint 197의 .compile() 부트스트랩 스모크(4개 NestJS 서비스)를 .init()/.close() 라이프사이클 검증으로 확장. moduleRef.init()으로 onModuleInit + onApplicationBootstrap까지 부트스트랩 동등 수준에서 실행해, .compile()이 못 잡는 라이프사이클 단계 throw(saga onModuleInit의 incompleteSubmissions.length, MqPublisher의 amqplib.connect, env 누락)를 조기 차단. 별도 spec 파일(app.module.init.spec.ts)로 분리 — compile spec 실패=DI 그래프 / init spec 실패=라이프사이클 진단. submission은 jest.mock('amqplib')로 MqPublisher.onModuleInit 연결 차단 + mockRepository.find→[](saga onModuleInit TypeError 회피). 실측 발견: close()는 단일 TypeORM 연결(submission/identity/gateway)에선 정상 동작하나, problem의 이중 TypeOrmCoreModule(default + new-problem-db)에선 onApplicationShutdown이 mock DataSource를 strict resolve하다 throw — ScheduleModule cron 타이머는 그 앞 onModuleDestroy에서 이미 정리되므로(detectOpenHandles 0) 해당 quirk만 좁게 catch하고 나머지 teardown 에러는 re-throw. forceExit는 submission만 보유 → 나머지 3개는 close() 필수. 음성 검증(saga onModuleInit throw → compile 통과/init 실패)으로 라이프사이클 실행 입증. Critic(Codex)이 problem quirk를 독립 재현해 대응 정확성 교차 검증 — Critical/High 0건. tsc 0·ESLint 0·커버리지 threshold 통과(submission 381/problem 185/gateway 785/identity 265)·CI #351 FAIL 0. PR #351 squash → 4853cf2."
---
# Sprint 199 — app.module 라이프사이클(.init) 부트스트랩 스모크 확장 (4개 NestJS 서비스)

## 목표

- Sprint 197의 `.compile()` 부트스트랩 스모크 테스트(DI 그래프 빌드만 검증)를 `.init()/.close()`까지 확장해, **라이프사이클 훅**(`onModuleInit` + `onApplicationBootstrap`)을 부트스트랩 동등 수준에서 실행한다.
- `.compile()`이 못 잡는 **라이프사이클 단계 throw**(예: saga `onModuleInit`의 `incompleteSubmissions.length`, RabbitMQ 연결, 라이프사이클에서만 요구되는 env)를 조기 차단한다.
- Sprint 197이 별도 범위로 미룬 "amqplib mock으로 RabbitMQ 연결 단계까지 검증"을 완료한다.

## 배경

- Sprint 197은 `Test.createTestingModule({imports:[AppModule]}).compile()`로 4개 서비스(gateway·submission·problem·identity)의 DI 그래프를 검증했다. 그러나 `.compile()`은 graph build + `useFactory`만 실행하고 **`onModuleInit`/`onApplicationBootstrap`은 호출하지 않는다**(그것은 `.init()` 전용). 따라서 MqPublisher의 `amqplib.connect`, saga의 미완료 Saga 재개 로직 등 라이프사이클 단계 결함은 여전히 미방어였다.
- 대상 라이프사이클 (`.init()`이 추가로 실행):
  - **submission**: MqPublisherService.onModuleInit(`amqplib.connect`), SagaOrchestratorService.onModuleInit(`submissionRepo.find()` 후 `.length` 접근, CircuitBreaker 등록, `setInterval` 타임아웃 타이머), ProblemServiceClient.onModuleInit(CB 등록), MetricsService.onModuleInit(`collectDefaultMetrics`)
  - **problem**: DualWriteService/ReconciliationService.onModuleInit(`getDualWriteMode()` 읽기), MetricsService, ScheduleModule onApplicationBootstrap(@Cron reconcile 타이머)
  - **gateway**: MetricsService, ScheduleModule(@Cron 3개: event-log·notification·deadline-reminder)
  - **identity**: MetricsService, ScheduleModule(@Cron 1개: feedback)
- 기술 난관: `.init()`은 실 인프라 연결을 시도하는 라이프사이클을 실행하므로 RabbitMQ(amqplib)까지 mock해야 하고, 라이프사이클이 등록한 타이머(@Cron, saga `setInterval`)를 `.close()`로 정리해야 한다 — 그런데 **`forceExit`는 submission만 보유**, 나머지 3개는 타이머가 누수되면 테스트가 행(hang)한다.

## 결정

### D1. 별도 spec 파일로 분리 (사용자, AskUserQuestion)

- 각 서비스에 `src/app.module.init.spec.ts`를 **신규** 생성. Sprint 197의 `app.module.spec.ts`(`.compile()`)는 그대로 유지.
- 근거: ① 진단 분리 — **compile spec 실패 = DI 그래프(순환 의존성/누락 provider)**, **init spec 실패(compile 통과) = 라이프사이클(onModuleInit/bootstrap)**. ② jest는 테스트 파일별로 모듈 레지스트리를 격리하므로 `prom-client` 전역 상태 교차오염을 구조적으로 차단(`collectDefaultMetrics`가 파일마다 새 모듈 상태에서 1회만 실행). ③ Sprint 197의 빠른 `.compile()` 회귀 신호를 독립 보존.
- 대안(기존 it에 추가 / 기존 it를 .init()으로 교체)은 같은 파일 내 2회 인스턴스화 시 prom-client 충돌 위험 또는 compile-only 독립 신호 소멸이라 미채택.

### D2. 스코프 — 4개 NestJS 서비스 전부

- gateway·submission·problem·identity 모두에 init spec 추가(Sprint 197 일관). gateway/identity의 `onModuleInit`은 `collectDefaultMetrics`로 거의 trivial하나, `.init()`은 `onApplicationBootstrap`(ScheduleModule cron 등록, 전체 모듈 런타임 와이어링)까지 실행하므로 부트스트랩 동등 검증 가치가 있다.

### D3. amqplib mock — submission MqPublisher.onModuleInit 차단

- `jest.mock('amqplib')`(호이스팅)로 `connect → mockConnection`(`createChannel → mockChannel`: assertExchange/assertQueue/bindQueue/publish/close, `on`), `connection.on` 제공. 기존 `mq-publisher.service.spec.ts` mock 패턴 계승.
- env `RABBITMQ_URL` 세팅(`MqPublisher.onModuleInit`의 `getOrThrow('RABBITMQ_URL')` 충족). 이로써 RabbitMQ 연결 단계("RabbitMQ 연결 및 Exchange/Queue 설정 완료" 로그)까지 부트스트랩 동등 실행.

### D4. saga onModuleInit — mockRepository.find → []

- `SagaOrchestratorService.onModuleInit`이 `submissionRepo.find(...)` 결과의 `.length`를 읽으므로, `find`는 반드시 배열을 resolve해야 한다(bare `jest.fn()`은 `undefined` 반환 → `TypeError`). `find: jest.fn().mockResolvedValue([])`로 "미완료 Saga 없음 -- 정상 시작" 경로를 통과시킨다.

### D5. close() teardown 전략 (실측 기반)

- **실측 발견**: `moduleRef.init()` 후 `moduleRef.close()`는 단일 TypeORM 연결(submission/identity)·TypeORM 없음(gateway)에선 **throw 없이 정상 동작**(CircuitBreaker/saga/mq/ScheduleModule이 각자 onModuleDestroy로 정리). → Sprint 197이 우려한 "close() 시 override된 DataSource 재resolve 실패"는 **단일 연결에선 미발생**.
- **problem만 예외**: 이중 `TypeOrmCoreModule`(default + `new-problem-db`) 환경에서 `onApplicationShutdown`이 `moduleRef.get(getDataSourceToken(this.options))`로 default `DataSource`를 strict resolve하다 `UnknownElementException`을 throw(teardown 한정 Nest 내부 quirk, 실 인프라가 아닌 mock이라 무해).
- **타이머 안전성**: close() 시퀀스는 `onModuleDestroy`(ScheduleModule cron 타이머 정리) → `onApplicationShutdown`(여기서 throw) 순. 즉 타이머는 throw **전에** 정리됨 → `--detectOpenHandles`로 잔여 핸들 0 확인.
- **대응**: problem init spec만 `await moduleRef.close().catch(...)`로 **알려진 quirk(`'could not find DataSource'`)만 좁게 무시**하고, 그 외 teardown 에러(미래 `onModuleDestroy` 회귀 등)는 `throw e`로 그대로 노출. 전역 `forceExit` 추가는 다른 테스트에 영향을 주므로 미채택.

### D6. forceExit 부재 서비스는 close() 필수

- `forceExit:true`는 submission jest.config만 보유. problem/gateway/identity는 `.init()`이 등록한 @Cron 타이머(CronJob)가 누수되면 테스트가 행하므로 반드시 `.close()`로 정리한다.

## 구현

### 구현 커밋 (1커밋, PR #351 squash → `4853cf2`)

- `fd63c09` test — AppModule 라이프사이클(.init) 부트스트랩 스모크 4종 추가
  - 신규 `services/{submission,problem,gateway,identity}/src/app.module.init.spec.ts` (+389)
  - 공통: 단일 `it`, `.compile() → moduleRef.init() → moduleRef.close()`. `init()`은 HTTP 어댑터 없이 onModuleInit + onApplicationBootstrap만 실행.
  - submission: 최상단 `jest.mock('amqplib')`(connect → mockConnection/mockChannel) + `getDataSourceToken()`·`getEntityManagerToken()`·`REDIS_CLIENT`(`./cache/cache.constants`) override + `find→[]` + env `RABBITMQ_URL`
  - problem: 기본 + `NEW_DB_CONNECTION` named DataSource/EntityManager + `REDIS_CLIENT`(`./cache/cache.module`) override + `DUAL_WRITE_MODE='off'` + close() 좁은 catch(D5)
  - gateway: 최상단 `jest.mock('ioredis')`(직접 `new Redis()` 차단) + JWT/INTERNAL_KEY env + TypeORM 없음
  - identity: DataSource/EntityManager override + `NODE_ENV='test'`(TokenEncryptionService 키 검증 회피)

## 검증

- **타입/빌드**: `tsc --noEmit` 0 (4개 서비스). ESLint **0** (4개 서비스, spec override로 `no-explicit-any` off).
- **테스트**: 4종 단독 통과 + 전체 회귀 통과. open handle/hang 0(`--detectOpenHandles`로 problem close() quirk 후에도 잔여 핸들 0 확인). 서비스별 커버리지 threshold 통과(`jest --coverage` exit 0): submission 381 / problem 185 / gateway 785 / identity 265 pass.
- **음성 검증**: submission `SagaOrchestratorService.onModuleInit` 최상단에 `throw`를 일시 삽입 → `app.module.spec.ts`(`.compile()`)는 **통과**(onModuleInit 미실행), `app.module.init.spec.ts`(`.init()`)는 **실패**(`SP199_NEGATIVE_CHECK`) → init spec이 라이프사이클을 **실제로 실행**함을 입증(원복 완료).
- **Critic**: `codex review --base main`(Codex, 세션 `019e4e0d-06d9-7592-b433-677efcae4b06`) — Critical/High **0건**("lifecycle smoke tests with appropriate infrastructure mocks and teardown handling. I did not identify a discrete regression introduced by the patch"). 주목: Codex가 자체 node 스크립트로 **problem의 close() quirk를 독립 재현**(submission/identity는 clean close, problem만 `UnknownElementException`)하여 좁은 catch 대응의 정확성을 교차 검증. ✅ 머지 가능.
- **CI #351**: FAIL **0** (Quality/Test/Build/Audit/Coverage Gate/E2E Programmers/Trivy 전부 pass, skipping은 미변경 영역) → Squash merge.

## 교훈 / 패턴

- ① **`.init()`은 `.compile()`의 strict superset(+ onModuleInit + onApplicationBootstrap)** — 별도 spec 파일로 분리하면 "무엇이 깨졌나"를 진단 분리할 수 있다(compile 실패=그래프 / init 실패=라이프사이클). jest 파일별 모듈 격리가 prom-client 전역 상태 교차오염도 함께 차단.
- ② **close() teardown 동작은 연결 토폴로지에 따라 다르다** — 단일 TypeORM 연결은 `close()`가 깨끗하나, 이중 `TypeOrmCoreModule`(named 연결 동반)은 `onApplicationShutdown`이 mock DataSource를 strict resolve하다 throw한다(teardown 한정 Nest quirk). 타이머 정리는 그 앞 `onModuleDestroy`에서 끝나므로, **알려진 quirk만 좁게 catch하고 나머지는 re-throw**해 미래 teardown 회귀 탐지력을 보존한다.
- ③ **`forceExit` 부재 서비스는 `.init()` 후 반드시 `close()`로 타이머를 정리** — `.init()`은 `onApplicationBootstrap`에서 @Cron(CronJob) 타이머를 등록하므로, `forceExit`가 없으면 누수된 타이머가 테스트를 행시킨다. `--detectOpenHandles`로 잔여 핸들 0을 검증.
- ④ **교차 리뷰(Codex)가 teardown quirk를 독립 재현** — Critic이 자체 스크립트로 동일 현상(problem만 close throw)을 재현해 대응의 정확성을 검증했다. 비-Claude 모델의 독립 재현은 "내 분석이 맞다"의 강한 신호.

## 신규 패턴

- **AppModule 라이프사이클 스모크 테스트** — `.compile() → moduleRef.init() → moduleRef.close()`. 인프라 provider(DataSource·REDIS_CLIENT)는 override, 직접 `new`하는 클라이언트(gateway ioredis)는 모듈 mock, RabbitMQ는 `jest.mock('amqplib')`, 라이프사이클이 repo를 읽으면 `find→[]`. 단일 TypeORM은 `close()` 그대로, 이중 연결은 teardown quirk만 좁게 catch. `forceExit` 부재 서비스는 close() 필수. Sprint 197 `.compile()` 스모크와 **별도 파일**로 병존해 진단 분리.
- **라이프사이클 실행 음성 검증** — `onModuleInit`에 일시 `throw`를 심어 `.compile()` spec은 통과 / `.init()` spec은 실패함을 확인하면, init spec이 라이프사이클을 실제로 실행함을 입증할 수 있다(mock이 load-bearing임을 보이는 Sprint 197 음성 검증의 라이프사이클판).

## 이월 항목

- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run` (jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- (선택) **app.module 스모크 추가 확장** — github-worker(순수 Node, app.module 부재) / ai-analysis(FastAPI) 부트스트랩 스모크 등 잔여 서비스.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
