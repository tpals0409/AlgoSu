---
sprint: 200
title: "github-worker main.ts 부트스트랩 스모크 + require.main 가드"
date: "2026-05-22"
status: completed
agents: [Oracle, Postman, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "bootstrap", "nodejs"]
tldr: "Sprint 197~199에서 NestJS 4개 서비스에 정착시킨 부트스트랩/라이프사이클 스모크 패턴을, app.module이 없는 순수 Node.js 서비스 github-worker로 확장. main()의 진입점 조립(startMetricsServer → CircuitBreakerManager → GitHubWorker → worker.start() → SIGTERM/SIGINT 핸들러)을 한 번에 실행하는 부트스트랩 스모크를 추가해 '테스트 green = 부트스트랩 가능'을 github-worker로 완성. 컴포넌트별 단위 spec(worker/config/circuit-breaker/metrics)은 광범위했으나 main()이 이들을 함께 조립하는 경로는 미커버였던 유일한 갭. NestJS .compile() 패턴이 적용 불가하므로 방식 B 채택 — main을 export하고 void main() 호출을 require.main === module 가드로 분리(진입점 직접 실행 동작 보존 + 테스트 import 시 자동 실행 차단), 반환값을 { worker, cbManager }로 바꿔 teardown 핸들 노출. main.init.spec.ts는 jest.mock(ioredis/config/amqplib) 재사용 + metrics는 requireActual 후 startMetricsServer만 no-op으로 실 포트 listen만 차단. 음성검증은 자원 생성 이전 단계(startMetricsServer) throw를 골라 opossum 타이머 누수 없이 main() reject 입증. 탐색 발견으로 ai-analysis(FastAPI)는 이미 TestLifespan/TestStartupShutdownEvents + test_config.py import-time 음성검증으로 부트스트랩 완비 → 순수 중복이라 제외. tsc 0·ESLint 0·jest 9 suites 181 pass(funcs 100%·lines 100%, main.ts는 collectCoverageFrom 제외라 threshold 무영향)·open handle 0·CI #353 CLEAN·Critic(Codex) Critical/High 0건. PR #353 squash → 40ad681."
---
# Sprint 200 — github-worker main.ts 부트스트랩 스모크 + require.main 가드

## 목표

- Sprint 197~199에서 NestJS 4개 서비스(gateway·submission·problem·identity)에 정착시킨 부트스트랩/라이프사이클 스모크 패턴을, **app.module이 없는 순수 Node.js 서비스 github-worker**로 확장한다.
- github-worker `main.ts`의 진입점 조립(`startMetricsServer` → `CircuitBreakerManager` → `GitHubWorker` → `worker.start()` → SIGTERM/SIGINT 핸들러)을 **한 번에 실행하는 부트스트랩 스모크**를 추가해 "테스트 green = 부트스트랩 가능"을 github-worker로 완성한다.

## 배경

- github-worker는 RabbitMQ 소비자 워커(Node.js + amqplib + ioredis + Octokit + opossum + prom-client)로, **NestJS가 아니며 app.module도 없다**. 따라서 Sprint 197~199의 `Test.createTestingModule({imports:[AppModule]}).compile()/.init()` 패턴을 그대로 적용할 수 없다.
- 기존 테스트 자산은 컴포넌트별로 광범위했다 — `worker.spec.ts`(GitHubWorker.start/stop/메시지 처리), `config.spec.ts`(필수 env 누락 throw 음성검증), `circuit-breaker.spec.ts`, `metrics.spec.ts` 등. 그러나 **`main.ts`의 `main()`이 이들을 함께 조립하는 경로**는 전용 spec이 없어 미커버였다(`main.ts`는 `collectCoverageFrom`에서 제외 — `jest.config.ts:10` `'!**/main.ts'`).
- 즉 각 컴포넌트는 개별 mock으로 검증되나, `startMetricsServer()` + `new CircuitBreakerManager(registry)` + `new GitHubWorker(cbManager)` + `await worker.start()` + 시그널 핸들러 등록이 **함께** 실행될 때 throw가 없는지는 한 번도 검증되지 않았다 — 이번 스프린트의 유일한 실제 갭.
- 기술 난관: `main.ts`는 top-level `void main().catch()` fire-and-forget 패턴이라 import만 해도 `main()`이 자동 실행된다. 또한 `startMetricsServer()`는 실제 포트를 listen(`metrics.ts:97`)하고, `GitHubWorker` 생성자는 `new Redis()`(`worker.ts:96`), `worker.start()`는 `amqplib.connect`(`worker.ts:154`)를 호출하므로 외부 I/O를 mock해야 한다. opossum breaker는 stats 갱신용 `setInterval`을 보유해 teardown으로 정리하지 않으면 테스트가 행(hang)한다.

## 결정

### D0. 스코프 — github-worker만 (탐색 기반 재조정)

- 당초 "github-worker + ai-analysis 부트스트랩 스모크 확장"으로 시작했으나, 착수 전 탐색에서 **ai-analysis(FastAPI)는 이미 부트스트랩 스모크가 사실상 완비**됨을 확인했다:
  - `tests/test_main.py`의 `client` fixture(`from src.main import app` → config import + app 조립), `TestStartupShutdownEvents`(`startup_event()` 직접 호출 → Worker/Redis 초기화), `TestLifespan`(TestClient context로 lifespan startup/shutdown 전체 실행)
  - `tests/test_config.py`의 import-time `ValidationError` 음성검증 3종(빈 문자열/누락/공백 → `INTERNAL_API_KEY`)
- 신규 추가는 순수 중복이므로 **ai-analysis는 제외**하고 github-worker `main.ts` 갭에 집중(사용자 AskUserQuestion으로 확정).

### D1. 방식 B 채택 — export + require.main 가드 (사용자 추천 승인)

- `async function main()` → `export async function main()`로 바꾸고, top-level `void main().catch()`를 `if (require.main === module) { ... }` 가드로 래핑한다.
- 근거: 진입점으로 **직접 실행될 때만** 부트스트랩하므로 프로덕션 동작은 동일하되, 테스트에서 `import { main }` 시 `main()`이 자동 실행되지 않아 `await main()`으로 조립 완료를 명확히 검증할 수 있다. `@ci-measurement: sprint-105-post-baseline` 앵커 주석은 import 위쪽이라 보존된다.
- 대안 A(소스 무변경 fire-and-forget): `await import('./main')`로 자동 실행시키되 `process.exit` mock + microtask flush로 완료를 추론해야 하고, `main()` 내부의 `cbManager`/`worker` 참조를 테스트가 얻지 못해 opossum `setInterval` 정리(teardown)가 곤란 → open handle 위험으로 미채택.

### D2. main() 반환값을 { worker, cbManager }로 변경 — teardown 핸들 노출

- `main()` 시그니처를 `Promise<void>` → `Promise<{ worker; cbManager }>`로 변경. 프로덕션 진입점(`void main().catch()`)은 반환값을 무시하므로 무해하고, 테스트는 반환된 핸들로 `worker.stop()` + `cbManager.shutdown()`을 호출해 MQ 연결과 opossum `setInterval`을 정리할 수 있다. JSDoc에 "반환 핸들은 graceful shutdown 및 테스트 teardown용"임을 명시.

### D3. metrics 부분 mock — requireActual + startMetricsServer만 no-op

- `jest.mock('./metrics', () => ({ ...jest.requireActual('./metrics'), startMetricsServer: jest.fn() }))`. `startMetricsServer`만 no-op으로 실제 포트 listen을 차단하고, `registry`/Counter는 **실제 prom-client 인스턴스**를 사용한다(`new CircuitBreakerManager(registry)`가 registry를 실제로 사용하므로). jest의 파일별 모듈 격리로 prom-client 중복 등록 충돌은 없다(Sprint 197 교훈).
- ioredis/config/amqplib는 `worker.spec.ts`의 mock 패턴을 그대로 재사용(`jest.mock('ioredis')`, `jest.mock('./config')` 고정 config, `jest.mock('amqplib')` connect → mock channel). config 로드/누락 throw 검증은 `config.spec.ts`가 이미 담당하므로 본 스모크는 조립 흐름에 집중.

### D4. 음성검증 throw 지점 — 자원 생성 이전 단계(startMetricsServer)

- 음성검증은 "조립 단계 결함이 스모크에 포착됨"을 입증하되, throw 지점을 **`startMetricsServer`**(조립 첫 단계)로 골랐다. `(startMetricsServer as jest.Mock).mockImplementationOnce(() => { throw ... })` → `main()` reject.
- 근거: startMetricsServer는 `cbManager`/`worker` 생성보다 **앞서** 실행되므로, 여기서 throw하면 opossum breaker가 아직 생성되지 않아 `setInterval` 누수가 없다. `worker.start()`의 `amqplib.connect`를 reject시키는 대안은 그 시점에 이미 `cbManager`/`worker`(opossum 타이머 보유)가 생성되었으나 `main()` reject로 참조를 얻지 못해 정리 불가 → teardown 누수가 발생하므로 미채택.

## 구현

### 구현 커밋 (1커밋, PR #353 squash → `40ad681`)

- `fb2c733` test(github-worker): main.ts 부트스트랩 스모크 + require.main 가드 (+134/-5)
  - **`main.ts`**: `export async function main()` + 반환값 `{ worker, cbManager }` + `if (require.main === module)` 가드. `@ci-measurement` 앵커 보존. main() JSDoc 추가.
  - **`main.init.spec.ts`** (신규): `jest.mock('ioredis'|'./config'|'amqplib')` + metrics는 `requireActual` 후 `startMetricsServer`만 no-op. logger stdout 억제. 2개 it:
    - `main()` throw 없이 조립 완료 + `startMetricsServer` 1회 호출 + SIGTERM/SIGINT 핸들러 등록 검증 → teardown(`worker.stop()` + `cbManager.shutdown()`).
    - `[음성검증]` `startMetricsServer` throw → `main()` reject(`SP200_NEGATIVE_CHECK`).
  - afterEach: `process.removeAllListeners('SIGTERM'|'SIGINT')` + `jest.clearAllMocks()`로 시그널 핸들러 누수 방지.

## 검증

- **타입/빌드**: `tsc --noEmit` 0. ESLint **0**(`main.ts` + `main.init.spec.ts`).
- **테스트**: 새 spec 단독 통과(`--detectOpenHandles` 경고 0) + 전체 회귀 **9 suites / 181 pass**. 커버리지 stmts 99.8% / branch 97.61% / **funcs 100% / lines 100%** → threshold(92/100/98/98) 전부 통과. **`main.ts`는 `collectCoverageFrom` 제외(`!**/main.ts`)라 커버리지 표에 미포함 → threshold 무영향**.
- **Critic**: `codex review --base main`(Codex, 세션 `019e4e41-1294-7fc0-8f1f-797af6106b85`) — Critical/High **0건**("The changes cleanly expose the bootstrap function for testing while preserving direct execution behavior via the CommonJS entrypoint guard. The added smoke test mocks external I/O and typechecking succeeds; no actionable correctness issues were found in the diff"). ✅ 머지 가능.
- **CI #353**: `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`, Failed **0**(github-worker Quality/Audit/Test + E2E Programmers pass, path filter로 미변경 영역은 skipping) → Squash merge.

## 교훈 / 패턴

- ① **순수 Node.js 진입점은 `require.main === module` 가드로 테스트 가능하게 분리** — NestJS `.compile()`/`.init()` 패턴이 적용되지 않는 서비스(app.module 부재)의 부트스트랩 스모크 표준. main을 export하고 자동 실행을 가드로 감싸면 프로덕션 동작 보존 + 테스트에서 `await main()`으로 조립 완료를 검증할 수 있다.
- ② **음성검증 throw 지점은 자원 생성 이전 단계를 골라 teardown 누수를 회피** — opossum 타이머처럼 생성 시 부수효과(setInterval)를 갖는 자원이 있으면, throw가 그 자원 생성 **이후**에 나면 reject된 main()이 핸들을 반환하지 못해 정리 불가. throw 지점을 자원 생성 **이전**(여기선 startMetricsServer)으로 옮기면 누수 없이 동일한 입증력을 얻는다.
- ③ **부분 mock은 `requireActual` + 특정 export만 override** — metrics처럼 일부(registry/Counter)는 실제 인스턴스가 필요하고 일부(startMetricsServer)만 실 I/O를 차단해야 하면, 모듈 전체 auto-mock 대신 `{ ...requireActual, target: jest.fn() }`로 실 I/O만 정밀 차단한다.
- ④ **"이미 완비됨"도 스코프 결정 — 착수 전 탐색으로 중복을 제거** — ai-analysis는 기존 `TestLifespan`/`TestStartupShutdownEvents` + import-time 음성검증으로 부트스트랩이 이미 커버되어, 신규 추가는 순수 중복이었다. 작업 전 탐색이 불필요한 스프린트 비대를 막았다.

## 신규 패턴

- **순수 Node.js 진입점 부트스트랩 스모크** — main을 export + `require.main === module` 가드로 분리, 반환값으로 teardown 핸들(worker/manager) 노출, 외부 I/O(metrics listen/RabbitMQ/Redis)는 mock(부분 mock은 `requireActual` + 특정 export override), 부수효과 자원(opossum setInterval)은 반환 핸들로 teardown. NestJS가 아닌 서비스(github-worker)의 `app.module.spec` 대응물.
- **자원 생성 이전 음성검증** — 조립 첫 단계(startMetricsServer)에 일시 throw를 심어 `main()` reject를 확인하면, opossum 타이머 등 부수효과 자원을 만들지 않고도 "조립 결함이 스모크에 포착됨"을 입증할 수 있다.

## 이월 항목

- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run`(jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
