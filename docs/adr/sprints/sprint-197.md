---
sprint: 197
title: "app.module 부트스트랩 스모크 테스트 (4개 NestJS 서비스)"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "dependency-injection"]
tldr: "Sprint 195(submission CacheModule 순환 의존성으로 부트스트랩 26ms 만에 CrashLoopBackOff, 단위 spec 14건은 provider 수동 조립이라 미포착) 교훈을 단일 모듈에서 AppModule 전체로 확장. 4개 NestJS 서비스(gateway·submission·problem·identity)에 Test.createTestingModule({imports:[AppModule]}).compile() 부트스트랩 스모크 테스트를 도입해 순환 의존성·누락 provider 등 DI 그래프 throw를 부트스트랩 동등 수준에서 조기 차단. TypeORM은 getDataSourceToken() override로 initialize() 차단(problem은 NEW_DB_CONNECTION named 연결 동반), Redis는 submission/problem REDIS_CLIENT override·gateway jest.mock('ioredis')(생성자 다수 new Redis()), RabbitMQ는 .compile()만 호출(.init() 미호출)로 onModuleInit 회피. 단일 it·분기 0·미호출 함수 리터럴 회피로 spec-collected 서비스(problem/identity/gateway) 커버리지 threshold 무영향. 음성 검증(빈 DataSource → repo factory TypeError)으로 그래프 실컴파일 입증. Critic(Codex gpt-5.x) 2R — R1 P2 1건(problem DUAL_WRITE_MODE env 누수) 해소 → R2 0건. 4종 단독+전체 회귀 통과·tsc 0·ESLint 0·CI #347 Passed 412/Failed 0. PR #347 squash → 5d1e5fc."
---
# Sprint 197 — app.module 부트스트랩 스모크 테스트 (4개 NestJS 서비스)

## 목표

- 전체 DI 그래프를 한 번에 컴파일하는 **부트스트랩 스모크 테스트**를 도입해, Sprint 195류 순환 의존성/모듈 그래프 throw를 부트스트랩 동등 수준에서 조기 차단한다.
- Sprint 195 핫픽스의 `cache.module.spec.ts`(단일 모듈 컴파일 회귀) 패턴을 **AppModule 전체**로 확장해, "테스트 green = 부트스트랩 가능"을 모든 NestJS 서비스에서 성립시킨다.

## 배경

- Sprint 195에서 submission 신규 코드가 `circular dependency inside CacheModule` throw로 부트스트랩 26ms 만에 CrashLoopBackOff를 일으켰다. 그런데 기존 단위 spec 14건은 **provider를 수동 조립**(`providers:[...]`)했기에 실제 모듈 DI 그래프를 컴파일하지 않았고, "테스트 green"인데도 부트스트랩이 100% 실패했다.
- Sprint 195 핫픽스는 `Test.createTestingModule({imports:[CacheModule]}).compile()` 회귀 테스트를 도입했지만 **단일 모듈 범위**였다 → AppModule 전체 그래프의 다른 사이클/누락은 여전히 미방어.
- 대상 NestJS 서비스: gateway·submission·problem·identity. (github-worker는 순수 Node.js·`app.module` 부재, ai-analysis는 FastAPI라 제외.)
- 기술 난관: `.compile()`은 graph build + `useFactory`(TypeORM/Throttler 등)를 실행하므로, 실 인프라(Postgres/Redis/RabbitMQ) 연결을 시도하는 provider를 차단해야 네트워크 없이 DI 그래프만 검증할 수 있다.

## 결정

### D1. 스코프 — 4개 NestJS 서비스 전부 (사용자, AskUserQuestion)

- gateway·submission·problem·identity 각각에 `src/app.module.spec.ts`를 추가. 모든 NestJS 서비스가 "테스트 green = 부트스트랩 가능"을 보장 → Sprint 195류 그래프 throw를 전 서비스에서 차단.

### D2. `.compile()`만 호출 (`.init()` 비목표)

- `.compile()`은 DI 그래프를 빌드·인스턴스화하지만 `onModuleInit`/`onApplicationBootstrap`은 호출하지 않는다(그것은 `.init()` 전용). 따라서 MqPublisherService의 `amqplib.connect`(onModuleInit)는 미실행 → RabbitMQ 연결 회피. 그러나 순환 의존성/누락 provider는 graph build 단계(compile)에서 throw되므로 그대로 포착(Sprint 195 cache.module.spec과 동일 근거).
- 라이프사이클 훅(onModuleInit) 검증 + amqplib mock은 별도 범위(향후 스프린트)로 분리.

### D3. 인프라 차단 메커니즘 (@nestjs/typeorm@10.0.2 소스 기준 검증)

| 인프라 | 차단 방법 |
|---|---|
| TypeORM 실 DB 연결 | `.overrideProvider(getDataSourceToken()).useValue(mockDataSource)` — TypeOrmCoreModule의 dataSourceProvider(useFactory가 `dataSource.initialize()` 호출)를 통째로 치환 → initialize 미실행. mock은 repository factory가 참조하는 `entityMetadatas:[]`·`options.type`·`getRepository`만 있으면 graph resolve. |
| Redis (`new Redis()`) | submission/problem: `.overrideProvider(REDIS_CLIENT)`. gateway: `jest.mock('ioredis')` — 생성자 다수(throttler 포함 ~10곳)가 `.compile()` 시점에 직접 `new Redis()`를 실행, 이는 DI 경유가 아니라 overrideProvider로 못 막으므로 모듈 자체 mock 필수. |
| RabbitMQ (`amqplib.connect`) | `.compile()`만 호출(D2). |

### D4. problem 이중 연결 — named DataSource 동반 override

- DualWriteModule이 기본 연결 외에 `NEW_DB_CONNECTION='new-problem-db'` named 연결을 추가하므로, `getDataSourceToken(NEW_DB_CONNECTION)`(=`'new-problem-dbDataSource'`)도 별도 override. `DUAL_WRITE_MODE=off`를 **명시**(D6)해 OFF 분기만 평가 → `NEW_DATABASE_*` 불요.

### D5. spec-collected 서비스 커버리지 무영향 (problem/identity/gateway)

- submission만 `jest.config.ts`에서 `!**/*.spec.ts`로 spec을 커버리지에서 제외. problem/identity/gateway는 spec도 커버리지 대상이므로, 신규 spec을 **단일 `it`·분기 0·미호출 함수 리터럴 회피**(bare `jest.fn()` 사용, `() => ...` 리터럴은 compile 시 실제 호출되는 것만)로 작성해 function/branch threshold(95~98%)에 영향을 주지 않게 함.

### D6. 테스트 env는 spread 보존이 아니라 명시 세팅 (Critic P2)

- `beforeAll`에서 `process.env`를 세팅하고 `afterAll`에서 spread 복원. 생성자/팩토리 시점 `getOrThrow`(submission: DATABASE_*·INTERNAL_KEY_AI_ANALYSIS, gateway: JWT_SECRET·OAUTH_CALLBACK_URL·INTERNAL_KEY_*) 충족. **problem은 `DUAL_WRITE_MODE='off'`를 명시** — spread만으로는 환경/로컬 `.env`의 expand·switch-read 값이 남아 active 분기로 새기 때문(Critic R1 포착).

## 구현

### 구현 커밋 (2커밋, PR #347 squash → `5d1e5fc`)

- `1c5f126` test — AppModule 부트스트랩 스모크 테스트 4종 추가
  - 신규 `services/{gateway,submission,problem,identity}/src/app.module.spec.ts`
  - submission: `getDataSourceToken()`·`getEntityManagerToken()`·`REDIS_CLIENT`(`./cache/cache.constants`) override
  - problem: 기본 + `NEW_DB_CONNECTION`(`./database/dual-write.config`) named DataSource/EntityManager + `REDIS_CLIENT`(`./cache/cache.module`) override
  - identity: DataSource/EntityManager override만 (모듈 레벨 Redis 없음, `NODE_ENV='test'`로 TokenEncryptionService 키 검증 회피)
  - gateway: 파일 최상단 `jest.mock('ioredis')`(default import 생성자 mock, `.on()` chainable) + TypeORM 없음
  - 공통: 단일 `it` + `compile()` 1회(MetricsModule/prom-client 중복 등록 회피) + `expect(moduleRef).toBeDefined()` + close() 미호출(teardown 시 TypeOrmCoreModule.onApplicationShutdown이 override된 DataSource 재resolve하려다 실패, 인프라 mock이라 정리할 실 핸들 없음)
- `8fcd15e` test — [Critic R1 P2] problem 스모크에 `DUAL_WRITE_MODE='off'` 명시 (env 누수 hermetic화)

## 검증

- **타입/빌드**: `tsc --noEmit` 0 (4개 서비스). ESLint **0** (4개 서비스, spec override로 `no-explicit-any` off).
- **테스트**: 4종 단독 통과 + 전체 회귀 통과. 서비스별 커버리지 threshold 통과(`jest --coverage` exit 0 — submission/problem/identity/gateway). open handle/hang 0(jest 정상 종료, gateway throttler setInterval은 `.unref()`).
- **음성 검증**: submission에서 DataSource override를 빈 객체로 일시 교체 → repo factory의 `dataSource.entityMetadatas.find(...)`가 `TypeError: Cannot read properties of undefined (reading 'find')`로 compile() 실패 → 테스트가 그래프를 **실제로 컴파일**하며 mock이 load-bearing임을 입증(원복 완료).
- **Critic**: `codex review --base main`(gpt-5.x) **2라운드** — Critical/High **0건**. R1 P2 1건(problem `DUAL_WRITE_MODE` env 누수) 해소 → R2 **0건**("no discrete introduced issue that would break existing behavior or tests"). ✅ 머지 가능.
- **CI #347**: Passed **412** / Failed **0** / `MERGEABLE`·`CLEAN` → Squash merge.

## 교훈 / 패턴

- ① **`.compile()`은 graph build + useFactory를 실행하지만 `onModuleInit`은 미실행** — 이 경계를 이용하면 RabbitMQ 등 라이프사이클 연결을 회피하면서 순환 의존성/누락 provider만 잡는 스모크 테스트가 성립한다. 단위 spec이 모듈 DI 그래프를 컴파일하지 않으면(provider 수동 조립) 순환을 못 잡는다는 Sprint 195 교훈의 직접 적용.
- ② **override는 DI 경유 provider만 막는다** — TypeORM DataSource/REDIS_CLIENT는 provider라 `overrideProvider`로 차단되지만, gateway처럼 factory/생성자 안에서 `new Redis()`를 직접 호출하면 DI 경유가 아니라 `overrideProvider`로 못 막고 `jest.mock('ioredis')`(모듈 레벨 mock)가 필요하다.
- ③ **테스트 env는 spread 보존이 아니라 명시 세팅** — `ORIGINAL_ENV` spread는 환경/로컬 `.env`의 분기 env(`DUAL_WRITE_MODE` 등)를 보존하므로, 분기 동작을 결정하는 env는 명시적으로 세팅해 hermetic하게 해야 한다(Critic 포착).
- ④ **spec-collected 서비스는 미호출 함수 리터럴이 function 커버리지를 깎는다** — spec을 커버리지에서 제외하지 않는 서비스에서는 mock의 `jest.fn(() => ...)` 리터럴이 compile 시 호출되지 않으면 uncovered function이 된다. bare `jest.fn()` + 단일 compile로 회피.

## 신규 패턴

- **AppModule 부트스트랩 스모크 테스트** — `Test.createTestingModule({imports:[AppModule]}).overrideProvider(getDataSourceToken()).useValue(mockDataSource)...compile()`. 인프라 provider(DataSource·REDIS_CLIENT)는 override, 직접 `new`하는 클라이언트(gateway ioredis)는 모듈 mock, RabbitMQ는 `.compile()` 한정으로 회피. 신규 NestJS 서비스/모듈은 이 스모크 테스트로 부트스트랩 그래프를 1회 검증("테스트 green = 부트스트랩 가능").
- **TypeORM DataSource mock 최소 형태** — `{ entityMetadatas:[], options:{type:'postgres'}, getRepository: jest.fn(()=>mockRepository), manager:{...} }`. repository provider factory가 참조하는 멤버만으로 graph resolve. named 연결은 `getDataSourceToken(name)` 별도 override.

## 이월 항목

- (선택) **app.module 스모크 `.init()` 확장** — 라이프사이클 훅(onModuleInit) 검증 + amqplib mock으로 RabbitMQ 연결 단계까지 부트스트랩 동등 검증 (별도 스프린트).
- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run` (jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~197 누적.
