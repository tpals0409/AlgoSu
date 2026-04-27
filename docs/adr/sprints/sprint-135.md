---
sprint: 135
title: "Circuit Breaker 단독 스프린트 — opossum 도입 + 5개 호스트 단일 CB + Grafana 대시보드"
date: "2026-04-27"
status: completed
agents: [Oracle, Architect, Postman, Scribe, Critic]
related_adrs: ["ADR-026"]
---

# Sprint 135: Circuit Breaker 단독 스프린트

## Sprint Goal

NestJS HTTP 호출부에 Circuit Breaker 패턴을 도입하여 외부 서비스 장애 전파를 차단한다. Wave A(PoC) → Wave B(github-worker 확대) → Wave A 동기화(별건 PR) → Wave C(submission 추가) → Wave D(Grafana 대시보드) 순으로 단계 진행.

## 최종 결과 요약 (Wave E 종합)

| 항목 | 결과 |
|------|------|
| **머지된 PR** | 5건 (#167 / #168 / #169 / #170 / #171) |
| **CB 인스턴스** | 5개 (호스트 단일 격리) |
| **보호된 외부 서비스** | 4개 (AI Analysis / submission internal / Gateway / Problem Service) |
| **신규 NestJS 모듈** | 2개 (`CircuitBreakerModule@Global`, `ProblemServiceClientModule`) |
| **신규 라이브러리** | opossum v8 (Node.js TypeScript), 기존 Python `circuit_breaker.py` 유지 |
| **누적 테스트** | submission 343 + github-worker 175 = **518 tests** |
| **Critic 교차 리뷰** | 17 라운드 (PR별 3/4/3/5/3) — P1 8건 + P2 9건 모두 해결 후 머지 |
| **Grafana 대시보드** | 1식 (12 panels, uid `algosu-cb`) |

### 호스트 단일 CB 인스턴스

| 서비스 | CB 이름 | 외부 호출 | fallback 정책 |
|--------|---------|-----------|---------------|
| submission | `aiQuotaCheck` | AI Analysis `/quota/check` | `() => true` (fail-open, `errorFilter: () => false` override — 고정 endpoint이므로 default 화이트리스트 무력화) |
| submission | `problem-service-internal` | Problem Service (2 op via dispatcher) | op별 (`undefined` / `{isLate: false, weekNumber: null}`) |
| github-worker | `submission-internal` | submission internal API (5 op via dispatcher) | throw 전파 (DLQ 처리) |
| github-worker | `gateway-getUserGitHubInfo` | Gateway `/internal/users/.../github-encrypted-token` | throw 전파 |
| github-worker | `problem-getProblemInfo` | Problem Service `/internal/{id}` | 기본값 + try/catch 안전망 |

### PR 별 머지 commit

| PR | Wave | Squash commit | 핵심 변경 |
|----|------|---------------|----------|
| [#167](https://github.com/tpals0409/AlgoSu/pull/167) | A | `459cd8a` | submission `aiQuotaCheck` PoC + opossum 도입 + Prometheus 메트릭 3종 |
| [#168](https://github.com/tpals0409/AlgoSu/pull/168) | B | `c561488` | github-worker plain class 래퍼 + 호스트 단일 CB 3개 + errorFilter 화이트리스트 |
| [#169](https://github.com/tpals0409/AlgoSu/pull/169) | A 동기화 | `1f40247` | Wave B 정책 동기화 + errorFilter wrapper + WeakSet 마커 (P2 정확 해결) |
| [#170](https://github.com/tpals0409/AlgoSu/pull/170) | C | `7d4c539` | `ProblemServiceClient` + `CircuitBreakerModule@Global` + `isConfigReady` |
| [#171](https://github.com/tpals0409/AlgoSu/pull/171) | D | `2c5d8e3` | Grafana CB 대시보드 (12 panels, TypeScript + Python schema 분리) |

## Decisions

### D1: opossum 라이브러리 채택 (Wave A)
- **Context**: Python 참조 구현(`services/ai-analysis/src/circuit_breaker.py`)은 자체 구현 (threading.Lock 기반 3-상태 머신). TypeScript 포팅 시 자체 구현 vs 라이브러리 도입 선택 필요
- **Options**: (A) opossum — Node.js 대표 CB 라이브러리, Netflix Hystrix 패턴, 이벤트 기반 메트릭 연동 / (B) 자체 구현 — Python 참조 1:1 포팅
- **Choice**: (A) opossum v8. 이유: 이벤트 기반 상태 전이로 Prometheus 메트릭 연동 간편, 검증된 sliding window 통계, NestJS DI 호환, 유지보수 부담 최소화
- **Code Paths**: `services/submission/package.json` (opossum@8, @types/opossum@8)

### D2: CB 임계값 — Python 참조 일관성 (Wave A)
- **Context**: Python CB의 `failure_threshold=5`, `recovery_timeout=30`, `half_open_requests=2`를 opossum 옵션에 매핑
- **Choice**: `volumeThreshold: 5` (최소 5회 요청 후 판단), `errorThresholdPercentage: 50` (실패율 50%+), `resetTimeout: 30000` (30초 후 HALF_OPEN), `rollingCountTimeout: 60000` (60초 집계 윈도우), `timeout: 10000` (fetch 10초 타임아웃)
- **Rationale**: Python과 동일한 "5회 실패 → OPEN → 30초 대기 → HALF_OPEN" 흐름 유지. 프로덕션 운영 데이터 축적 후 조정 예정

### D3: Prometheus 메트릭 설계 (Wave A)
- **Choice**: 3개 메트릭, 기존 MetricsService Registry 공유
  - `algosu_submission_circuit_breaker_state` (Gauge, label: name) — 0=CLOSED / 1=HALF_OPEN / 2=OPEN
  - `algosu_submission_circuit_breaker_failures_total` (Counter, label: name)
  - `algosu_submission_circuit_breaker_requests_total` (Counter, labels: name, result) — result: success/failure/reject/timeout
- **Architecture**: MetricsModule에서 `METRICS_REGISTRY` 커스텀 provider로 prom-client Registry 공유. CircuitBreakerModule → MetricsModule import → 동일 Registry에 CB 메트릭 등록 → /metrics 엔드포인트에서 Prometheus 수집
- **Code Paths**: `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts`, `services/submission/src/common/metrics/metrics.module.ts`

### D4: AI Quota Check fallback 전략 — fail-open (Wave A)
- **Context**: `saga-orchestrator.service.ts:checkAiQuota` 기존 동작: API 실패 시 `return true` (AI 분석 허용). CB OPEN 시에도 동일하게 허용해야 Saga 보상 트랜잭션과 충돌 없음
- **Choice**: `fallback: () => true` (fail-open). CB OPEN 시 AI Analysis Service 호출 자체를 스킵하고 즉시 허용 반환 → Saga 흐름 무중단
- **Rationale**: checkAiQuota는 비핵심 guard (한도 체크). 실패 시 AI 분석이 한도 없이 진행되지만, 서비스 중단보다 낫다. Python 참조의 "DELAYED + 분석 지연 중" fallback과 맥락은 다르나, 이 호출부는 quota pre-check이므로 fail-open이 적합
- **Code Paths**: `services/submission/src/saga/saga-orchestrator.service.ts:110-133` (createBreaker), `services/submission/src/saga/saga-orchestrator.service.ts:324-332` (checkAiQuota)

### D5: retry vs Circuit Breaker 우선순위 (설계 원칙)
- **Context**: retry와 CB가 공존할 때 순서 결정 필요
- **Choice**: Retry 3회 → CB 판단 (retry 실패가 CB failure count에 반영). 현재 Wave A 대상인 checkAiQuota는 retry 없이 CB만 적용 (기존 코드에도 retry 없었음). Wave B+ 확대 시 retry가 있는 호출부는 "retry → CB" 순서 적용
- **Rationale**: retry는 일시적 네트워크 오류 복구, CB는 지속적 장애 감지. retry가 외부에서 CB를 감싸면 retry 소진 후에야 CB failure로 기록되어 불필요한 지연 발생. retry를 CB 내부에 두면 빠른 차단 가능

## Wave A 산출물

| 항목 | 결과 |
|------|------|
| PR | feat/sprint-135-cb-poc (13 files, +661/-58) |
| 커밋 | 3 atomic (모듈 생성 → 호출부 적용 → 테스트) |
| 테스트 | 21 suites / 283 tests (기존 268 + 신규 15) |
| typecheck | 0 errors |
| lint | 0 errors (9 pre-existing warnings) |

## Wave A 메모리 정정

- sprint-window.md "github-worker 5곳" → "7곳 (status-reporter 5 + worker.ts 2)": 실제 `grep -n fetch services/github-worker/src/status-reporter.ts services/github-worker/src/worker.ts` 결과 7개 호출부 확인

### D6: github-worker CB 확대 — plain class 래퍼 (Wave B)
- **Context**: github-worker는 NestJS 아닌 standalone TS. NestJS DI 패턴 미적용 환경에서 CB 도입 필요
- **Choice**: `CircuitBreakerManager` plain class로 opossum 래핑. main.ts에서 인스턴스 1개 생성 → GitHubWorker/StatusReporter 생성자 주입
- **호스트별 CB 인스턴스 3개 (Critic 3차 P1 통합 후)**: submission-internal 1개 (5개 메서드 통합 — generic dispatcher), gateway-internal 1개 (gateway-getUserGitHubInfo), problem-service 1개 (problem-getProblemInfo). 호스트 1개 = CB 1개 원칙으로 host-isolation 강화 (dead host 부하 증폭 차단)
  - 초기 설계는 5개 메서드별 별도 CB였으나 같은 host를 공유하는 reporter들이 부하 분산 효과 없이 dead host hammering 위험만 증가시킨다는 Critic 3차 지적으로 호스트 단일 CB로 통합
- **fallback 전략**: StatusReporter 5곳은 throw 전파 (DLQ/멱등성 처리), gateway-getUserGitHubInfo는 throw 전파 (token 없으면 push 불가), problem-getProblemInfo는 fallback으로 기본값 반환 + 외부 try/catch 안전망 유지 (기존 catch 동작 유지 → 회귀 0건)
- **메트릭 prefix**: `algosu_github_worker_circuit_breaker_*` (서비스 prefix만 다르고 라벨/구조는 Wave A와 동일)
- **Code Paths**: `services/github-worker/src/circuit-breaker.ts` (신규 + spec), `services/github-worker/src/main.ts`, `services/github-worker/src/worker.ts`, `services/github-worker/src/status-reporter.ts`, `services/github-worker/src/metrics.ts` (registry export)

### D7: errorFilter 정책 + 호스트 단일 CB (Wave B Critic 1~3차 통합)
- **Context (1차)**: Critic 1차 리뷰 P1 2건 — 4xx 영구 에러(404 not found 등)가 CB failure로 카운트되어 회로 OPEN. 정상 메시지까지 reject되어 워커가 30초간 마비되는 광범위 outage 위험 (Critic 1차 P1)
- **Context (2차)**: 1차 수정으로 모든 4xx(`>=400 && <500`)를 errorFilter로 제외했으나, 401/403까지 통과 → X-Internal-Key 회전/오설정으로 영구 401/403 발생 시 internal-auth outage 보호 실패. 또한 opossum errorFilter 통과 시 emit되는 `success` 이벤트 첫 인자가 Error 인스턴스(filtered된 에러 객체)인데 `result="success"` 라벨로 카운트 → 메트릭 부정확 (Critic 2차 P1+P2)
- **Context (3차)**:
  - status-reporter의 5개 메서드별 CB(`submission-getSubmission` 외 4개)가 같은 submission-service host를 공유. submission-service 장애 시 `submission-getSubmission`만 OPEN되고 다른 4개는 CLOSED 유지 → dead host에 계속 callback 호출 → host-isolation 목적 무력화 + 부하 증폭 (Critic 3차 P1)
  - `FILTERED_BUSINESS_STATUS`에 400 포함 → DTO/contract regression(header missing, validation drift, schema mismatch) 발생 시 CB OPEN 안되어 dead dependency 무한 hammering (Critic 3차 P2)
- **Choice (1·2차 유지)**:
  - errorFilter 범위를 명시적 비즈니스 4xx 화이트리스트로 축소 — 401/403/408/429 등은 CB failure로 정상 카운트하여 인증/권한/timeout/overload outage 보호 유지
  - opossum errorFilter 통과 시 emit되는 success 이벤트에서 result가 Error 인스턴스인 경우를 분기하여 `requests_total{result="filtered"}`로 분리 카운트 (메트릭 정확성)
  - `result` 라벨 enum 확장: `success | failure | reject | timeout | filtered`
- **Choice (3차)**:
  - status-reporter를 **호스트 단일 CB(`submission-internal`)** 로 통합. generic dispatcher(`_dispatch` + `_resolveEndpoint`)로 5개 op(get/reportSuccess/reportFailed/reportTokenInvalid/reportSkipped) 공유. SubmissionRequest payload(`{ op, submissionId, body? }`) 1개로 호출 통일. host 경계에서 OPEN되면 5개 메서드 모두 동시 차단되어 dead host 보호.
  - `FILTERED_BUSINESS_STATUS = {404, 410, 422}` — 400 제거. 400은 contract regression 시그널이므로 CB failure로 카운트하여 회로 OPEN + 알람 트리거.
  - StatusReporter public API 시그니처 무변경 — 기존 호출부(worker.ts) 무영향
- **Rationale**:
  - host-isolation의 본질은 "장애 호스트에 계속 호출하지 않기" — 같은 호스트 내 메서드별 분리는 부하 증폭만 유발. 호스트 1개 = CB 1개 원칙으로 통합
  - 400 Bad Request는 영구 비즈니스 에러처럼 보이지만 contract drift(header missing, schema mismatch) 일 수 있어 회로 보호 대상. 진짜 영구 비즈니스 에러는 404(없음)/410(영구 제거)/422(룰 위반)로 충분
- **Code Paths**:
  - `services/github-worker/src/status-reporter.ts` (5개 CB → 1개 host CB + dispatcher / `_dispatch` + `_resolveEndpoint` SRP 분리)
  - `services/github-worker/src/circuit-breaker.ts` (`FILTERED_BUSINESS_STATUS`에서 400 제거)
  - `services/github-worker/src/status-reporter.spec.ts` (호스트 단일 CB 검증 + `_resolveEndpoint`/`_dispatch` 단위 테스트 신규)
  - `services/github-worker/src/circuit-breaker.spec.ts` (400 보호 OPEN 케이스 신규 + 화이트리스트 정의/단위 동작 갱신)
  - `services/github-worker/src/worker.spec.ts` (5개 CB 등록 검증 → 1개 host CB 검증)
- **테스트 갱신/추가 (3차)**: status-reporter.spec.ts 호스트 단일 CB 등록 검증 + `_resolveEndpoint` 5건(op별 endpoint 매핑) + `_dispatch` 4건(get/reportSuccess/reportFailed/non-ok status 첨부) + circuit-breaker.spec.ts 400 OPEN 전이 1건 신규. jest 169 → **175** (+6 net), coverage stmts 99.79% / branches 97.45% / functions 100% / lines 100% (threshold 98/92/100/98 충족)
- **Wave A 호환**: `submission/circuit-breaker.service.ts`에도 동일 화이트리스트 정책(400 제외 포함) + filtered 메트릭 분리 시드 → Sprint 135 Wave C 또는 별건 PR. 현재 fetchAiQuota는 fallback `() => true`이므로 사용자 영향은 없으나, 일관성·메트릭 정확성·인증/contract 장애 보호를 위해 후속 정정 권장

## Wave B 산출물

| 항목 | 결과 |
|------|------|
| 브랜치 | feat/sprint-135-cb-worker |
| CB 인스턴스 | 3개 (submission-internal / gateway-getUserGitHubInfo / problem-getProblemInfo) — Critic 3차 P1로 7개 → 3개 통합 |
| 커밋 | 5 atomic (deps+manager → status-reporter → worker → tests → ADR) + 2 (1차 errorFilter fix + ADR D7) + 2 (Critic 2차 화이트리스트+filtered 라벨 fix + ADR D7 갱신) + 2~3 (Critic 3차 호스트 단일 CB + 400 제거 + ADR D7 갱신) |
| 테스트 | 8 suites / 175 tests (Wave B 146 + D7 1차 +17 + Critic 2차 +6 + Critic 3차 +6 net: 호스트 단일 CB 검증 +2 / `_resolveEndpoint` op별 +5 / `_dispatch` 4건 / 400 OPEN 전이 +1 / 메서드별 CB 검증 5건 통합 후 -7 정도 — 자세한 diff는 코드 참조) |
| coverage | stmts 99.79% / branches 97.45% / functions 100% / lines 100% (threshold 98/92/100/98 충족) |
| typecheck | 0 errors |
| lint | 0 errors |

### D8: Wave A submission CB에 Wave B 정책 동기화 (별건 PR)
- **Context**: Wave A의 `services/submission/src/common/circuit-breaker/` 모듈에 Wave B(D7)에서 정착된 errorFilter 화이트리스트 정책이 미적용. 메트릭 정확성 + contract regression 보호 일관성을 위해 동기화 필요. fetchAiQuota는 `fallback: () => true`로 사용자 영향 0이지만 contract regression / auth outage 시 dead dependency hammering 위험은 동일
- **Choice**:
  - `FILTERED_BUSINESS_STATUS = {404, 410, 422}` 화이트리스트 적용 (Wave B 동일, 400 제외)
  - `DEFAULT_ERROR_FILTER` 추가 — `createBreaker`에서 기본 적용, 호출자 override 가능
  - success 이벤트에서 `result instanceof Error` 분기 → `requests_total{result="filtered"}` 라벨 분리 (success 카운트 오염 방지)
  - `fetchAiQuota` non-2xx throw 시 `error.status` 첨부 → errorFilter가 분기 가능
  - `buildHttpError(message, status)` 헬퍼를 `circuit-breaker.constants.ts`에 추가 (재사용성 + 일관성)
- **Rationale**: 두 모듈(submission/github-worker)의 CB 정책이 일관되어야 운영/모니터링 일관성 확보. 영구 5xx/401/403 발생 시 CB OPEN → fallback 발동(fail-open 유지) → dead dependency hammering 차단. Public API 시그니처 무변경(createBreaker/getBreaker/getState/onModuleDestroy 모두 유지) — 호출부(saga-orchestrator) 회귀 0건
- **Code Paths**:
  - `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts` (FILTERED_BUSINESS_STATUS / DEFAULT_ERROR_FILTER / errorFilter option / success 핸들러 filtered 분기)
  - `services/submission/src/common/circuit-breaker/circuit-breaker.constants.ts` (`buildHttpError` 헬퍼)
  - `services/submission/src/saga/saga-orchestrator.service.ts` (`fetchAiQuota`에서 buildHttpError 사용)
  - `services/submission/src/common/circuit-breaker/circuit-breaker.service.spec.ts` (errorFilter 단위 + 통합 + buildHttpError 검증, +15 tests)
  - `services/submission/src/saga/saga-orchestrator.service.spec.ts` (fetchAiQuota status 첨부 2건 추가)
- **테스트**: 21 suites / 290 → **305 tests** (+15 net), coverage threshold 충족 (stmts 97.91% / branches 92.82% / functions 96.34% / lines 97.98% — 임계 97/92/96/97 전부 통과)

#### D8 Critic 1차 후속 정정 (P1+P2)

- **P1 — `aiQuotaCheck` CB에 `errorFilter: () => false` override 적용**:
  - `fetchAiQuota`는 고정 endpoint(`/quota/check`)만 호출 → 404/410/422도 resource-not-found가 아닌 "AI Analysis Service 라우트 misconfig 또는 서비스 부재" 시그널
  - default 화이트리스트(`{404,410,422}`)를 그대로 적용하면 dead service에 무한 호출 + CB OPEN 미발동 + 알람 미발화 위험
  - `errorFilter: () => false`로 모든 비-2xx를 CB failure로 카운트하여 `volumeThreshold` 도달 시 OPEN → fallback `() => true`로 사용자 영향 0 + 알람 시그널 확보
  - **Code Paths**: `services/submission/src/saga/saga-orchestrator.service.ts:onModuleInit` createBreaker 호출
  - **테스트**: `saga-orchestrator.service.spec.ts`에 `errorFilter` option 검증 + override 동작 단위 검증 2건 신규
- **P2 정확 해결 (Critic 2차)**:
  - errorFilter wrapper + WeakSet 마커 패턴으로 정확한 success/filtered 분기 도입
  - wrapper에서 filtered 시 (a) `requests_total{result="filtered"}` 카운트 + (b) WeakSet에 마커 추가
  - success 핸들러에서 result가 객체이고 WeakSet에 마커 있으면 skip (중복 카운트 방지)
  - 기존 `instanceof Error` 휴리스틱이 부정확했던 두 케이스(Error resolve / non-Error throw)를 모두 해결
  - **남은 한계**: primitive(string/number) throw는 WeakSet 추가 불가 → primitive errorFilter 통과 시 success 1건 추가 카운트 (실용적 영향 0, 본 프로젝트는 Error/객체만 throw)
  - **Code Paths**: `services/submission/src/common/circuit-breaker/circuit-breaker.service.ts` createBreaker(wrapper + WeakSet) + success 핸들러(마커 조회) + onModuleDestroy(WeakSet 정리)
  - **테스트 추가**: plain object throw + filtered (1건) / WeakSet 재사용 안전성 (1건) / primitive 한계 명시 (1건) / 객체 resolve 회귀 방지 (1건) — 총 +4건
  - **Sprint 136+ 시드 갱신**: Wave B(`services/github-worker/src/circuit-breaker.ts`)에 동일 wrapper 패턴 적용 (현재 `instanceof Error` 휴리스틱)

### D9: Wave C — submission 서비스 Problem Service 호출 2곳 CB 적용

- **Context**: submission 서비스의 Problem Service HTTP 호출 2곳(`saga-orchestrator.fetchSourcePlatform`, `submission.service.checkLateSubmission`)이 CB 미보호 상태. dead host 시 무한 호출 가능 + 마감 시간 조회 실패 시 graceful degradation은 되지만 dead host hammering 차단 부재
- **Choice**:
  - 호스트 단일 CB(`problem-service-internal`) — Wave B status-reporter dispatcher 패턴 동일
  - `ProblemServiceClient` NestJS 서비스로 캡슐화 — 두 호출 op(`getSourcePlatform`, `getDeadline`)를 dispatcher로 통합 (`_dispatch` + `_doGetSourcePlatform` + `_doGetDeadline` SRP 분리)
  - op별 fallback(`getSourcePlatform: undefined`, `getDeadline: {isLate: false, weekNumber: null}`) — 기존 graceful degradation 유지
  - 4xx 화이트리스트 default 적용(`{404, 410, 422}`) — Problem Service의 dynamic endpoint(`/internal/{problemId}`)이므로 404 = "problem not found" 자연스러운 비즈니스 에러로 간주, 5xx/auth/timeout만 CB failure 카운트
  - non-2xx 시 `buildHttpError(message, status)` 사용해 status 첨부 → DEFAULT_ERROR_FILTER가 화이트리스트 분기 가능
- **Code Paths**:
  - `services/submission/src/common/problem-service-client/` (신규 모듈 — module/client/index/spec)
  - `services/submission/src/saga/saga-orchestrator.service.ts` (`fetchSourcePlatform` private 메서드 제거 → client 위임, problemServiceUrl/Key 필드 제거)
  - `services/submission/src/submission/submission.service.ts` (`checkLateSubmission` 본체 client 위임 1줄로 단순화, ConfigService 의존성 제거)
  - `services/submission/src/submission/submission.module.ts` (`ProblemServiceClientModule` import)
- **호스트 단일 CB 인스턴스 (Sprint 135 종합)**:
  - submission 서비스: `aiQuotaCheck` (1) + `problem-service-internal` (1) = 2개
  - github-worker: `submission-internal` (1) + `gateway-getUserGitHubInfo` (1) + `problem-getProblemInfo` (1) = 3개
  - 총 5개 CB 인스턴스로 4개 외부 서비스(AI Analysis / submission internal / Gateway / Problem Service) 보호
- **테스트**: `problem-service-client.spec.ts` 24건 신규 + saga-orchestrator/submission.service/ai-satisfaction spec 갱신. 전체 334 tests pass, coverage stmts 98.46% / branches 94.53% / functions 96.59% / lines 98.55% (threshold 97/92/96/97 충족)
- **Public API 시그니처 무변경**: SagaOrchestratorService.advanceToAiQueued / SubmissionService.create 호출자 영향 0
- **Critic 1차 P2 후속 정정**: env(`PROBLEM_SERVICE_KEY`) 미설정 시 fetch slow path(timeout 5초 → CB OPEN) 회귀 차단. public 메서드(`getSourcePlatform`/`getDeadline`) 시작에 key 검증 → 즉시 fallback 반환으로 sub-millisecond 회복. 기존 `submission.service.checkLateSubmission`의 `getOrThrow` 즉시 fallback 동작 보존. `problem-service-client.spec.ts`에 env 미설정 fallback 검증 2건 추가 (fetch 미발생 + hostBreaker.fire 미호출 + 기본값 반환)
- **Critic 2차 P1 후속 정정**: `CircuitBreakerModule`을 `@Global()`로 마킹 + `ProblemServiceClientModule.imports`에서 제거. NestJS가 module scope별로 `CircuitBreakerService`를 별도 인스턴스화하여 prom-client duplicate metric registration 에러로 submission 서비스 boot 실패하는 회귀 차단. AppModule 또는 SubmissionModule에서 1회 import만으로 전역 사용
- **Critic 3차 P1 후속 정정 — 방어 코드 추가**: `getSourcePlatform`/`getDeadline`의 `hostBreaker.fire` 결과에 `instanceof Error` 검사 추가. 현재 opossum 8.x는 errorFilter 통과 시 `reject(error)` 호출되어 catch에서 fallback 반환되지만, 명시적 검사로 (1) 향후 opossum 동작 변경 대비 + (2) 코드 의도 명확화 + (3) Error 객체가 비즈니스 로직(`sourcePlatform: Error`, `isLate: Error`)에 도달하지 않도록 보장. defense in depth. 테스트 2건 신규(getSourcePlatform/getDeadline 각 1건 — Error를 resolve로 mock하여 fallback 반환 검증). 전체 336 → **338 tests** pass, problem-service-client.ts coverage stmts/branches/functions/lines 모두 100% 유지
- **Critic 4차 P2 후속 정정 — URL 검증 추가**: 1차 P2 수정에서 `problemServiceKey`만 검증하고 `problemServiceUrl`은 default 값(`'http://problem-service:3002'`)으로 fallback되어 누락. URL 미설정 + KEY 설정 시 default 호스트로 fetch 5초 timeout → CB OPEN 회귀 가능. constructor에서 default 제거(`?? ''`로 빈 문자열 보존) + `isConfigReady()` private helper로 URL/KEY 둘 다 검증 + public 메서드(`getSourcePlatform`/`getDeadline`)의 가드를 `if (!this.problemServiceKey)` → `if (!this.isConfigReady())`로 통합. `getOrThrow` 미사용(boot 시점 throw 회귀 위험) — get + 빈 문자열 fallback 패턴 유지. 테스트 5건 신규(URL 미설정 / URL+KEY 둘 다 미설정 각 getSourcePlatform/getDeadline + ConfigService.get이 undefined 반환 시 default 미적용 검증). 전체 338 → **343 tests** pass, problem-service-client.ts stmts/branches/lines 100% 유지(functions 91.66%은 index.ts 빈 re-export 한정 — 본 파일 100%)

### D10: Wave D — Grafana CB 대시보드
- **Context**: Sprint 135 Wave A/B/C로 5개 호스트 단일 CB가 운영 환경에 도입됨. CB 상태 변화/요청 처리량/실패율을 한눈에 파악할 운영 대시보드 부재
- **Choice**:
  - 신규 ConfigMap `grafana-cb-dashboard` (`infra/k3s/monitoring/grafana-cb-dashboard.yaml`) 생성
  - `grafana.yaml`의 projected volume에 ConfigMap mount 추가 → 자동 provisioning
  - 패널 5종: State Matrix(현재 상태) + Request Rate by Result(처리량) + Failure Rate(실패율) + State Timeline(상태 추이) + Distribution(누적 통계) + 통계 Table
  - submission + github-worker 양쪽 메트릭 통합 (`algosu_submission_circuit_breaker_*` + `algosu_github_worker_circuit_breaker_*`)
  - Template variable `name` (multi-select, includeAll) — `label_values({__name__=~"algosu_(submission|github_worker)_circuit_breaker_state"}, name)` 쿼리로 5개 CB 인스턴스 자동 노출 + 패널 필터링
  - Dashboard uid: `algosu-cb`, refresh: 30s, schemaVersion: 39, links: SLO Overview / Service Debug
- **Code Paths**:
  - `infra/k3s/monitoring/grafana-cb-dashboard.yaml` (신규)
  - `infra/k3s/monitoring/grafana.yaml` (projected sources 1줄 추가)
- **운영 가치**: CB OPEN 시 즉시 시각 알람 + result 라벨로 인프라 장애(failure/timeout/reject)와 비즈니스 4xx(filtered) 분리 관찰
- **검증**: yaml.safe_load 통과 + ConfigMap 안의 JSON `json.loads` 통과 + Deployment의 projected sources 3개(slo/service/cb) 정합
- **Critic 1차 P2 후속 정정 — AI Analysis 추가 + schema 차이 인정**:
  - 초기 D10 구현은 TypeScript CB 5개(submission 2 + github-worker 3)만 시각화 → Sprint 135 원본 참조 구현인 ai-analysis Python CB(`services/ai-analysis/src/circuit_breaker.py`, 메트릭 `algosu_ai_analysis_circuit_breaker_state`)가 운영 환경에서 동작하나 대시보드에 누락 → Claude API 장애 시 "모두 정상"으로 표시되는 관찰 누락
  - **Schema 차이**: TypeScript(0=CLOSED/1=HALF_OPEN/2=OPEN, name label 있음, failures_total + requests_total{result} 존재) vs Python(0=CLOSED/0.5=HALF_OPEN/1=OPEN, name label 없음, state 메트릭만 노출) — 단순 regex 통합 불가
  - **State Matrix 패널 분리**: 기존 Panel id=1 폭 24→18 (`Circuit Breaker State (TypeScript)`), 신규 Panel id=7 폭 6 (`AI Analysis CB State (Python)`, mappings 0/0.5/1, thresholds green→yellow at 0.5→red at 1)
  - **State Timeline 분리**: 기존 Panel id=4 폭 24→18 (`Circuit Breaker State Timeline (TypeScript)`), 신규 Panel id=8 폭 6 (`AI Analysis CB Timeline (Python schema)`, 동일 0/0.5/1 mappings)
  - **Request Rate / Failure Rate / Distribution / 통계 Table**: ai-analysis는 `failures_total`/`requests_total{result}` 메트릭 부재 → 변경 없이 description으로 안내 추가 ("AI Analysis Python CB는 ... 메트릭 부재 — Sprint 136+ schema 통일 시 추가 예정")
  - **검증**: yaml.safe_load 통과 + json.loads 통과 + 12 panel IDs(100/1/7/101/2/3/102/4/8/103/5/6) 충돌 없음 + gridPos 행별 24폭 정합 (y:1 18+6 / y:17 18+6)
  - **Sprint 136+ 시드**: ai-analysis Python CB 메트릭 schema를 TypeScript와 통일 (state value 0/1/2 + `name` label + `failures_total` + `requests_total{result}`) → 단일 Grafana query regex로 통합 가능. `services/ai-analysis/src/metrics.py` + `circuit_breaker.py` 갱신 + 운영 알람 룰 동시 갱신 필요

## Carryover (Wave E 종합 — 모두 완료)

### Sprint 135 내부 작업 (전체 완료 ✅)

- [x] **Wave A**: submission `aiQuotaCheck` PoC + opossum 도입 (D1~D5) — PR #167 `459cd8a`
- [x] **Wave B**: github-worker 7곳 CB 적용 + 호스트 단일 CB 패턴 (D6~D7) — PR #168 `c561488`
- [x] **Wave A 후속 정정 (별건 PR)**: errorFilter wrapper + WeakSet 마커로 P2 정확 해결 (D8) — PR #169 `1f40247`
- [x] **Wave C**: submission 2곳 추가 (`ProblemServiceClient` + `CircuitBreakerModule@Global`) (D9) — PR #170 `7d4c539`
- [x] **Wave D**: Grafana CB 대시보드 (TypeScript + Python schema 분리) (D10) — PR #171 `2c5d8e3`
- [x] **Wave E**: Sprint 135 ADR 종합 갱신 + sprint-window.md 최종 정리 — 본 ADR `status: completed` 전환

### Sprint 136+ 이월 시드

#### CB 일관성 개선
- [ ] **github-worker errorFilter wrapper 동기화**: `services/github-worker/src/circuit-breaker.ts`에 errorFilter wrapper + WeakSet 마커 패턴 적용 (현재 `instanceof Error` 휴리스틱 → Wave A와 동일한 정확 분기). 본 Sprint Wave A 동기화 PR #169에서 submission만 적용됨, 두 모듈 일관성 회복 필요
- [ ] **ai-analysis Python CB 메트릭 schema 통일**: state value 0/1/2 + `name` label + `failures_total` + `requests_total{result}` 추가하여 TypeScript와 정합. `services/ai-analysis/src/metrics.py` + `circuit_breaker.py` + 운영 알람 룰 동시 갱신. 통일 후 Grafana 대시보드의 분리된 패널(Python schema)을 단일 query regex로 통합 가능

#### 별건 시드 (CB 외)
- [ ] **CLAUDE.md L11 명명 불일치 정정**: 문서상 "ai-feedback" → 실제 디렉토리 `services/ai-analysis/`. 본 Sprint Wave A 진행 중 발견된 메타 정합성 이슈
- [ ] **E2E 자동 PR CI 통합** (Sprint 134 이월): `e2e-full.sh`(657줄)를 `.github/workflows/ci.yml`의 PR 트리거에 통합. 현재 workflow_dispatch 수동 실행만 가능
