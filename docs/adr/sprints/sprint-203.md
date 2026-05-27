---
sprint: 203
title: "github-worker·ai-analysis 부트스트랩 스모크 재점검 — 이종 런타임 음성검증 사다리 정렬"
date: "2026-05-27"
status: completed
agents: [Oracle, Postman, Critic, Scribe]
related_adrs: ["sprint-197", "sprint-199", "sprint-200"]
related_memory: ["sprint-window"]
topics: ["testing", "bootstrap", "observability"]
tldr: "Sprint 200 완료 후 6개 서비스 부트스트랩 스모크 인벤토리를 재점검 — github-worker(Node.js)와 ai-analysis(FastAPI) 모두 스모크가 실재함을 확인(Sprint 200 가정 검증). 단, ai-analysis에 lifespan-runtime 음성검증(startup_event 내부 throw)이 부재함을 발견 → Phase A로 TestLifespanNegative 추가(sentinel SP203_NEGATIVE_CHECK). 이종 런타임(NestJS·Node.js·FastAPI)의 음성검증 사다리(import-time → assembly → lifecycle hook) 정렬 패턴을 신규 패턴으로 영속화."
---
# Sprint 203 — github-worker·ai-analysis 부트스트랩 스모크 재점검 — 이종 런타임 음성검증 사다리 정렬

## 목표

- Sprint 200 이후 6개 서비스 전체 부트스트랩 스모크 인벤토리를 **재점검**하여 Sprint 200 가정의 실제 코드 상태 일치 여부 검증.
- 음성검증 사다리(import-time → assembly → lifecycle hook)가 이종 런타임(NestJS·Node.js·FastAPI)에서도 정렬되어 있는지 확인하고, 발견된 갭을 보강.
- 재점검 결과와 신규 패턴을 ADR로 영속화.

## 배경

Sprint 197(.compile() DI 그래프 스모크) → Sprint 199(.init()/.close() 라이프사이클 스모크 확장) → Sprint 200(github-worker main.ts 조립 스모크 + ai-analysis 완비 확인 가정)으로 이어진 부트스트랩 스모크 도입 흐름이 완성되었다고 Sprint 200 ADR에 기록하였다. Sprint 203 착수 시점에서 "완비 가정이 실제 코드 상태와 정말 일치하는가"를 검증하고, 미정렬 항목이 있으면 같은 스프린트에서 보강하기로 결정.

특히 ai-analysis(FastAPI)는 NestJS 4개 서비스의 음성검증(onModuleInit throw, Sprint 199 패턴)에 대응하는 **lifespan-runtime 음성검증**이 있는지 불명확했다 — `test_config.py`의 import-time ValidationError 3종은 확인되었으나, startup_event 내부에서의 runtime throw 검증은 Sprint 200 ADR에 명시되지 않았다.

## 결정

### D0. 재점검 방식

Read 도구로 6개 서비스 부트스트랩 스모크 위치 + 음성검증 유무를 전수 확인하여 인벤토리 작성.

### D1. 실태 확인 결과

- Sprint 200 가정 — github-worker `main.init.spec.ts` 완비, ai-analysis `test_main.py` TestLifespan + TestStartupShutdownEvents 완비 — **코드 상태와 일치 ✅**
- **발견된 갭**: ai-analysis에 lifespan **runtime**(startup_event 내부 throw) 음성검증이 부재. import-time 음성검증(`test_config.py` INTERNAL_API_KEY ValidationError 3종)은 존재하나, FastAPI lifespan context 진입 시 첫 단계에서 throw가 전파되는 경로의 fail-fast 입증이 없음.
- github-worker는 `startMetricsServer` throw → `SP200_NEGATIVE_CHECK`로 assembly 단계 음성검증 완비.

### D2. 갭 보강 결정

TestLifespanNegative 클래스를 `tests/test_main.py`에 추가해 lifespan-runtime fail-fast 입증. sentinel `SP203_NEGATIVE_CHECK`. 패턴 정합성(github-worker SP200_NEGATIVE_CHECK ↔ ai-analysis SP203_NEGATIVE_CHECK) 완성.

## 구현

### Phase A — TestLifespanNegative 추가 (커밋 e5ff06a)

Postman 위임. `services/ai-analysis/tests/test_main.py` 끝에 `TestLifespanNegative` 클래스 추가(+33줄).

**throw 지점 선정 근거**: `startup_event` 내부 첫 단계인 `src.main.circuit_breaker.set_state_change_callback`에서 throw. 이 단계는 `redis.from_url` / `AIAnalysisWorker()` 생성 **이전**이라 worker_thread 누수 없음. 음성검증 throw 지점은 자원 생성 이전을 고르는 Sprint 200 원칙 적용.

**finally 블록**: 전역 상태(`worker_instance` / `worker_thread` / `redis_client`) = `None`으로 초기화해 다른 테스트와의 격리 보장.

**Python lambda throw 관용구**: `mocker.patch`의 `side_effect=lambda *a, **k: (_ for _ in ()).throw(RuntimeError("SP203_NEGATIVE_CHECK"))` — 비직관적이나 테스트 격리를 위해 허용.

## 검증

- `pytest services/ai-analysis/tests/test_main.py::TestLifespanNegative` → **1 PASSED**
- 전체 회귀: **328 passed**
- 커버리지: **99.09%** (실제 threshold: `pyproject.toml` `fail_under=97` / `addopts --cov-fail-under=97`)
  - **주의**: 커밋 메시지에 'threshold 98%'로 기재되었으나, 이는 위임 지시 시 사용된 수치로 실제 SSOT(`pyproject.toml`)는 97. 기능·CI 무영향. Sprint 202 교훈(history rewrite 회피)에 따라 history rewrite 없이 ADR에 정정 사실로 영속화.
- **Critic(Codex 세션 `019e6912-ee57-7622-92a8-817fe4d0a11a`)**: Critical/High/Medium **0건**, P3 1건(threshold 수치 오기 — 기능·CI 무영향).

## 부트스트랩 스모크 인벤토리 (Sprint 203 기준 최신)

| 서비스 | 런타임 | 부트스트랩 스모크 위치 | 검증 등급 | 도입 sprint | 음성검증 |
|--------|--------|----------------------|-----------|-------------|---------|
| gateway | NestJS | `app.module.spec.ts` (.compile) + `app.module.init.spec.ts` (.init/.close) | DI graph + lifecycle | 197/199 | ✅ (Sprint 199, raise-time) |
| submission | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle (amqplib mock) | 197/199 | ✅ saga onModuleInit throw (Sprint 199) |
| problem | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle (이중 DataSource teardown quirk catch) | 197/199 | ✅ (Sprint 199) |
| identity | NestJS | `app.module.spec.ts` + `app.module.init.spec.ts` | DI graph + lifecycle | 197/199 | ✅ (Sprint 199) |
| github-worker | Node.js (app.module 부재) | `src/main.init.spec.ts` | main() 조립 + signal handler + teardown 핸들 | 200 | ✅ startMetricsServer throw → SP200_NEGATIVE_CHECK |
| ai-analysis | FastAPI | `tests/test_main.py` — TestLifespan + TestStartupShutdownEvents + (Sprint 203) TestLifespanNegative | lifespan context + startup/shutdown 직접 호출 + lifespan-runtime 음성검증 | 200/203 | ✅ circuit_breaker.set_state_change_callback throw → SP203_NEGATIVE_CHECK |

> import-time 음성검증(ai-analysis): `test_config.py`의 INTERNAL_API_KEY ValidationError 3종(빈 문자열/미설정/공백만) — 위 표의 assembly 음성검증과 독립.

## 신규 패턴 — 이종 런타임 부트스트랩 스모크 사다리

### 매핑 원리

| 런타임 | 부트스트랩 동등 등급 | 음성검증 단계 |
|--------|---------------------|--------------|
| NestJS | `.compile()` (DI graph build + useFactory) | `.init()` → onModuleInit throw |
| Node.js | `main()` (진입점 조립) | 첫 단계 throw → main() reject |
| FastAPI | `lifespan` context 진입 | startup_event 첫 단계 throw |

### 음성검증 사다리 3등급

| 등급 | 검증 대상 | 예시 |
|------|----------|------|
| **import-time** | 설정 누락 시 프로세스 기동 불가 | `test_config.py` ValidationError |
| **assembly** | 부트스트랩 진입 시 첫 단계 throw 전파 | SP200_NEGATIVE_CHECK / SP203_NEGATIVE_CHECK |
| **lifecycle hook** | 라이프사이클 훅(onModuleInit) throw 전파 | Sprint 199 saga throw |

- github-worker: import-time(config) + assembly 보유.
- ai-analysis: import-time(config) + assembly 보유.
- NestJS 4개: import-time(config) + assembly(.compile) + lifecycle hook(.init) 보유.

## 교훈

1. **재점검은 가정 검증 + 갭 보강 + ADR 영속화 3단** — 가정만 검증하고 끝내면 발견된 갭이 다음 sprint 컨텍스트에서 사장된다. 보강까지 같은 sprint에서 처리해야 패턴이 완성된다.
2. **이종 런타임도 음성검증 등급은 동일하게** — Python의 lambda throw 관용구(`(_ for _ in ()).throw(...)`)는 비직관적이나, assembly 단계 fail-fast 입증이라는 역할은 NestJS/Node.js 패턴과 동일. 런타임이 달라도 "부트스트랩 진입 → 첫 단계 throw → 전파" 사다리를 동일하게 적용.
3. **커밋 메시지의 위임 지시값과 실제 SSOT 불일치는 history rewrite 회피** — Sprint 202 교훈 계승. ADR에 정정 사실을 명시해 영속화하는 것으로 충분.

## 이월

- **운영 측 Sprint 196 마이그레이션 실행 + 재배포** (사용자/운영 담당)
- (선택) `commitlint` scope-enum에 `oracle` 추가 (Sprint 202에서 `chore(oracle):` 시도 차단 경험)
- (선택) CI PYTHON 3.12 → 3.13
- (선택) Build Blog (SSG) required check 승격
- (시드) 하네스 정기점검 체크리스트 자동화 스크립트
- 누적 UAT (사용자 직접) → Sprint 204
