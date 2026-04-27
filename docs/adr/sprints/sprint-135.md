---
sprint: 135
title: "Circuit Breaker 단독 스프린트 — Wave A PoC (opossum + AI Quota Check)"
date: "2026-04-27"
status: in-progress
agents: [Oracle, Architect, Postman, Scribe]
related_adrs: ["ADR-026"]
---

# Sprint 135: Circuit Breaker 단독 스프린트

## Sprint Goal

NestJS HTTP 호출부에 Circuit Breaker 패턴을 도입하여 외부 서비스 장애 전파를 차단한다. Wave A(PoC)에서 submission 서비스의 AI Quota Check 1곳에 opossum 기반 CB를 적용하고, Wave B~D에서 github-worker 7곳 + submission 2곳 + 메트릭/대시보드로 확대한다.

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
- **호스트별 CB 인스턴스 7개**: submission-internal API 5개 (각 메서드별 별도 CB — getSubmission/reportSuccess/reportFailed/reportTokenInvalid/reportSkipped), gateway-internal 1개 (gateway-getUserGitHubInfo), problem-service 1개 (problem-getProblemInfo). 총 7곳 보호
- **fallback 전략**: StatusReporter 5곳은 throw 전파 (DLQ/멱등성 처리), gateway-getUserGitHubInfo는 throw 전파 (token 없으면 push 불가), problem-getProblemInfo는 fallback으로 기본값 반환 + 외부 try/catch 안전망 유지 (기존 catch 동작 유지 → 회귀 0건)
- **메트릭 prefix**: `algosu_github_worker_circuit_breaker_*` (서비스 prefix만 다르고 라벨/구조는 Wave A와 동일)
- **Code Paths**: `services/github-worker/src/circuit-breaker.ts` (신규 + spec), `services/github-worker/src/main.ts`, `services/github-worker/src/worker.ts`, `services/github-worker/src/status-reporter.ts`, `services/github-worker/src/metrics.ts` (registry export)

## Wave B 산출물

| 항목 | 결과 |
|------|------|
| 브랜치 | feat/sprint-135-cb-worker |
| 커밋 | 5 atomic (deps+manager → status-reporter → worker → tests → ADR) |
| 테스트 | 8 suites / 146 tests (기존 113 + 신규 33: CB 16 + status-reporter +9 + worker +8) |
| coverage | stmts 99.38% / branches 97.31% / functions 100% / lines 99.57% (threshold 92/100/98/98 충족) |
| typecheck | 0 errors |
| lint | 0 errors |

## Carryover (Wave C~E)

- [x] Wave B: github-worker 7곳 CB 적용 (status-reporter 5 + worker.ts 2, 메서드별 별도 CB — 단일 host에 다양한 action 공존하므로 메서드별 분리가 reject/failure label 분리에 유리)
- [ ] Wave C: submission 2곳 추가 (fetchSourcePlatform L257 + submission.service L504)
- [ ] Wave D: Grafana 대시보드 1식
- [ ] Wave E: Sprint 135 ADR 종합 갱신 + sprint-window.md 최종 정리
- [ ] 별건 시드: CLAUDE.md L11 "ai-feedback" → 실제 "ai-analysis" 명명 불일치 (Sprint 136+)
- [ ] 별건 시드: E2E 자동 PR CI 통합 (Sprint 134 이월)
