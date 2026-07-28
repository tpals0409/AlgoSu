---
sprint: 259
title: "AI 재분석 요청 경로 + 분석 한도·서킷 상향 + 분석완료-saga 상태 정합 복구"
date: "2026-07-25"
status: completed
agents: [Oracle]
related_adrs: ["sprint-258", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["submission", "ai-analysis", "saga", "frontend"]
tldr: "AI 분석 신뢰성·복구성 4건을 묶어 처리. (1) 한도 초과로 aiSkipped=true DONE 직행한 제출을 한도 초기화 후 다시 분석할 수단이 없던 문제 → submission POST /:id/reanalyze 신설(본인·aiSkipped 검증 후 saga를 GITHUB_QUEUED로 원자 되돌림 + advanceToAiQueued 재실행, 여전히 초과면 다시 skipped) + FE 'skipped' 상태 블록·재분석 버튼. (2) 서킷 브레이커 실패 임계값 5→10(config.py SSOT)로 조기 차단(무음 장애) 완화. (3) AI 일일 분석 한도 5→10(config.py SSOT, quota 배지 데이터 구동). (4) aiAnalysisStatus는 종단(completed/failed)인데 sagaStep이 AI_QUEUED에 잔류해 스터디룸은 '분석중'·상세는 '완료'로 갈리던 불일치 → updateAiResult가 sagaStep=DONE을 단일 row-write로 원자 저장 + saga-timeout reconcileTerminalAnalysis(2분 주기 잔류행 DONE 복구). PR #494 `b6b67942` / #490 `9e1c8f9f` / #491 `b60694de` / #492 `7c2ff43c`·#493 `a476f27b`."
---
# Sprint 259 — AI 재분석 요청 + 분석 한도·서킷 상향 + saga 상태 정합 복구

_날짜: 2026-07-25_

## 목표

AI 코드 분석의 신뢰성·복구성 결함 4건을 한 스프린트로 묶어 처리한다. 핵심 문제는 (a) 한도 초과로 분석이 스킵된 제출을 사후 재분석할 경로 부재, (b) 서킷 브레이커·일일 한도의 과도하게 보수적인 임계값, (c) 분석 완료와 saga 상태 간 불일치로 스터디룸이 영영 "분석중"에 잔류하는 버그다.

**대상**
- PR #494 `b6b67942` — AI 한도 초과 스킵 제출 재분석 요청 경로
- PR #490 `9e1c8f9f` — 서킷 브레이커 실패 임계값 5→10
- PR #491 `b60694de` — AI 일일 분석 한도 5→10
- PR #492 `7c2ff43c` · #493 `a476f27b` — 분석완료-saga 상태 불일치 복구

## 결정 사항

### D1. 재분석 요청 경로 신설 — saga 원자 되돌림 (#494)

한도 초과 상태로 제출하면 saga가 `DONE(aiSkipped=true, aiAnalysisStatus='skipped')`로 직행하는데, 한도 초기화 후 다시 분석을 요청할 수단이 없었다. **`POST /:id/reanalyze`** 를 신설한다: 본인·`aiSkipped` 검증 후 saga를 **`GITHUB_QUEUED`로 원자적으로 되돌리고** 기존 `advanceToAiQueued`(한도 재확인 + 큐잉)를 재실행한다. 한도가 여전히 초과면 다시 skipped 처리하고 응답의 `aiSkipped`로 구분한다. Gateway/ai-analysis는 무변경(catch-all 프록시 + 기존 워커 재사용)이며 FE는 분석 페이지에 'skipped' 상태 블록과 [재분석 요청] 버튼을 신설(성공 시 pending 전환·폴링 재개).

### D2. 서킷·한도 임계값 상향으로 조기 차단·조기 소진 완화 (#490, #491)

Claude API 일시적 실패에 대한 내성을 강화한다. **서킷 브레이커 실패 임계값을 5→10**으로(`cb_failure_threshold`), **AI 일일 분석 한도를 5→10**으로(`ai_daily_limit`) 상향한다. 두 값 모두 `config.py`의 pydantic 기본값을 SSOT로 두고 환경변수 재정의를 허용한다. 두 값은 정합적으로 함께 올려(서킷 10 ↔ 한도 10) 조기 차단(무음 장애)과 조기 소진을 동시에 완화한다. quota 값은 `/api/analysis/quota`가 내려주는 데이터를 FE 배지가 그대로 반영하므로 프론트 변경은 불필요.

### D3. 분석완료-saga 상태 불일치 원자 복구 + 주기 리컨사일 (#492, #493)

`aiAnalysisStatus`는 종단(completed/failed)인데 `sagaStep`이 `AI_QUEUED`에 잔류하면, 스터디룸(sagaStep 판정)은 영영 "분석중", 분석 상세(aiAnalysisStatus 판정)는 "완료"로 갈리는 불일치가 발생했다. 원인은 `advanceToDone`의 낙관적 락 `affected=0` 시 조용히 return하여 `updateAiResult`가 completed만 커밋하던 것. 복구책:
- `updateAiResult`: 완료/실패 시 **`sagaStep=DONE`을 엔티티에 실어 단일 row-write로 원자 저장**
- saga-timeout: **`reconcileTerminalAnalysis`** 추가 — 종단인데 AI_QUEUED 잔류 행을 2분 주기로 DONE 복구(자가 치유)
- `advanceToDone`: 비-QR 성공 경로에서 stats 캐시 무효화(분석 완료 수 정합)

## 구현

- **#494**: `submission.controller.ts` `POST /:id/reanalyze` + `submission.controller.spec.ts`; FE `analysis/page.tsx` skipped 블록·재분석 버튼 + `page.test.tsx`; `lib/api/submission.ts`·`types.ts`; i18n `analysis.skipped`/`analysis.reanalyze`(ko/en)
- **#490/#491**: `services/ai-analysis/src/config.py` `cb_failure_threshold` 5→10 · `ai_daily_limit` 5→10 + `tests/test_config.py` 기본값 단정 동기화
- **#492/#493**: `saga-orchestrator.service.ts`·`submission.service.ts` `updateAiResult` 원자 저장 + `saga-timeout.service.ts` `reconcileTerminalAnalysis` + 각 spec

**검증(Oracle 직접 재검 — 자기보고 불신)**: submission jest(controller reanalyze·saga-timeout reconcile·service 원자저장) green, ai-analysis pytest(config 기본값) green. 관련 PR 전부 origin/main 머지(squash). (#492·#493은 동일 내용 재머지 — 상태 불일치 복구의 이중 반영.)

## 인시던트

1. **분석완료-saga 상태 불일치(스터디룸 분석중 잔류)**: 낙관적 락 실패를 조용히 무시하는 코드 경로가 종단 상태와 saga 단계를 갈라놓아, 사용자에게 "분석중"과 "완료"가 화면별로 다르게 보였다. 단일 row-write 원자 저장 + 2분 주기 리컨사일로 자가 치유하도록 복구.

## 이월

- (없음 — 후속 스프린트에서 AI 일일 한도 추가 상향(#506 10→20)으로 이어짐)

## 교훈

- **스킵도 복구 경로가 있어야 한다**: 한도 초과 스킵은 종단이 아니라 일시 상태 — saga를 안전 단계로 원자 되돌리는 재진입 경로를 제공해 사용자 자력 복구를 가능케 한다.
- **낙관적 락 실패의 조용한 무시는 상태 분기를 만든다**: `affected=0`을 삼키면 종단 상태와 saga 단계가 갈린다. 종단 전이는 단일 row-write로 원자화하고, 주기 리컨사일로 잔류 행을 자가 치유한다.
- **정합적 임계값은 함께 조정**한다: 서킷 임계값과 일일 한도를 같은 값으로 올려 조기 차단·조기 소진을 동시에 완화한다.
