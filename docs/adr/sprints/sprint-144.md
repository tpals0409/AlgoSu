---
sprint: 144
title: 회귀 차단 자동화 — Sprint 143 회고 신규 시드 SSOT/CI 보강
status: completed
period: 2026-05-08 (단일 일자, 21분)
start_commit: 738ff7d
end_commit: c27232c
prs:
  - https://github.com/tpals0409/AlgoSu/pull/205 (PR 1 — ServiceClient mock 팩토리 커버리지 CI 검증)
  - https://github.com/tpals0409/AlgoSu/pull/206 (PR 2 — ai-analysis 점수 가중치 SSOT 단일화 + 재계산 TC 자동 정합)
related_sprints:
  - sprint-143 (이월 시드 일괄 정리 — 회고에서 본 스프린트 신규 시드 2건 식별)
  - sprint-141 (이월 시드 일괄 정리 — 회고 시드 → 다음 스프린트 자동 연계 패턴 원형)
---

# Sprint 144 — 회귀 차단 자동화

## 컨텍스트

Sprint 143 회고에서 다음 두 회귀를 직접 경험:

1. **PR #200 R1 P1**: `ProblemServiceClient.getProblemInfo()` 추가 시 3개 spec mock 팩토리 누락. 컴파일은 통과(메서드 호출 부재 → 타입 오류 미발생)하나 런타임 TypeError. **CI는 green이었고 Critic 호출이 없었다면 머지되었을 것**.
2. **PR #198 후속 commit**: ai-analysis correctness 가중치 30→40% 변경 시 `test_claude_client.py`의 가중 평균 TC 3건(totalScore=68→70 / 64→66 / 62→65)이 별도 파일에서 수동 재계산 필요. 가중치 SSOT 부재로 분포 변경마다 grep으로 의존 TC 추적 의무화.

두 사례 모두 **사람의 주의력**(Critic / grep 의무)에 의존하는 구조 → 자동 검출/단일화로 구조적 차단.

본 스프린트는 Sprint 143에서 **이월된 UAT/모니터링 3건**(시드 #5, #7, #9)이 아닌, **회고에서 신규 식별된 2건**(시드 A, B)을 우선 처리. UAT 시드는 사용자 직접 검증 필요 + 시드 #7은 단독 PR 가치 → Sprint 145로 재이월.

### 처리 범위

| 시드 | 위치 | 우선순위 | 상태 |
|------|------|---------|------|
| A | submission ServiceClient mock 팩토리 CI 검증 | P1 | ✅ PR #205 |
| B | ai-analysis 점수 가중치 SSOT 단일화 | P2 | ✅ PR #206 |

### Sprint 145 이월 (Sprint 143 잔여 3건)

- 시드 #5: UAT — 프로그래머스 재제출 채점 통과 확인 (사용자 직접)
- 시드 #7: prometheus-rules / dashboard 자동 검증 CI (`promtool check rules` + grafana JSON cross-check)
- 시드 #9: UAT — 영문 환경 캘린더 + production Grafana CB dashboard 정합 (사용자 직접)

## 결정

### 시드 A — 검증 위치 (CI script vs lint rule)

**CI script (채택)**: 독립 Node 스크립트(`scripts/check-mock-coverage.mjs`) + `.github/workflows/ci.yml`에 step 추가.
- 장점: ESLint plugin 작성 부담 없음, 타 ServiceClient 추가 시 `CHECKS` 배열에 1 항목만 추가하면 자동 확장. AST 파싱 불필요(union type regex로 충분).
- 단점: 로컬 IDE 즉시 피드백 부재 (CI에서만 검증).

**ESLint plugin (미채택)**: rule로 작성 시 IDE 즉시 피드백 가능하나 plugin 작성/배포/유지보수 비용 > 검증 가치.

검증 대상 union type pattern: `^export type ProblemOp\s*=\s*(.+);$/m` → string literal 추출 후 각 spec 파일의 mock 팩토리에서 메서드 존재 검사.

### 시드 B — 가중치 단일화 위치 (Python 모듈 vs JSON config)

**Python module 상수 (채택)**: `prompt.py`에 `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` dict 정의 + `_format_weights_inline()` / `compute_total_score()` 헬퍼 export.
- 장점: 단일 import line, 모듈 로드 시 `SYSTEM_PROMPT` / `SQL_SYSTEM_PROMPT`의 placeholder를 동적 치환 가능 (프롬프트 본문이 가중치를 텍스트로 노출하는 부분 자동 동기화).
- 단점: 외부 운영 가시성 부재 (분포 변경 시 코드 수정 필요).

**JSON config (미채택)**: 운영 가시성은 좋으나 deploy 없이 분포 변경 시나리오 부재 + 스키마 검증 추가 부담.

### 신규 테스트 클래스 — `TestWeightsSSOTSync` (회귀 차단 본질)

`test_prompt.py`에 추가:
- 프롬프트 본문에 등장하는 가중치 표기가 `WEIGHTS` dict와 일치하는지 검증 (placeholder 치환 누락 차단).
- `compute_total_score(scores)` 결과가 수동 가중 평균과 일치하는지 검증 (헬퍼 자체 회귀 차단).

`test_claude_client.py`의 가중 평균 TC 3건은 hardcoded 점수(70/66/65) 대신 `compute_total_score()` 호출로 변경 → **가중치 변경 시 자동 정합**, 더 이상 grep 추적 불필요.

## 변경 요약

### PR #205 — Sprint 144 시드 A (squash merge `b957776`)

- 신규: `scripts/check-mock-coverage.mjs` (+110)
- 변경: `.github/workflows/ci.yml` (+3) — Quality job에 `node scripts/check-mock-coverage.mjs` step
- 합계: **2 files / +113 -0**
- Critic 미호출 — CI 인프라 단순 추가, 회귀 위험 낮음.

### PR #206 — Sprint 144 시드 B (squash merge `c27232c`)

- 변경: `services/ai-analysis/src/prompt.py` (+73 -35)
  - `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` dict 신규
  - `_format_weights_inline(weights)` / `compute_total_score(scores, weights)` 헬퍼 신규
  - `SYSTEM_PROMPT` / `SQL_SYSTEM_PROMPT` placeholder를 모듈 로드 시 동적 치환
- 변경: `services/ai-analysis/src/claude_client.py` (+7 -8) — 가중 평균 직접 계산 → `compute_total_score()` 호출
- 변경: `services/ai-analysis/tests/test_claude_client.py` (+33 -6) — 가중 평균 TC 3건 hardcoded → `compute_total_score()` 호출
- 신규: `services/ai-analysis/tests/test_prompt.py` (+81) — `TestWeightsSSOTSync` + `TestComputeTotalScore`
- 합계: **4 files / +194 -49**
- Critic 미호출 — refactoring 단일화, 동작 동등성 테스트로 보장 (totalScore 결과 비교).

## 검증

- jest/pytest 회귀 0건
- CI 전체 GREEN (Quality + Test 전 서비스 + Coverage Gate + E2E)
- 신규 테스트: test_prompt.py 2 클래스 (회귀 차단 본질)
- 머지 간격: 21분 (13:41 KST → 14:02 KST)

## 패턴 / 교훈

### 신규 패턴

1. **회고 시드 즉시 처리 패턴** — Sprint 141 원형(이월 시드 일괄 처리)에서 진화. 회고에서 식별된 신규 시드는 다음 스프린트 시작 즉시 처리하면 (a) 컨텍스트 fresh + (b) 회귀 사례 1건을 직접 경험한 직후이므로 우선순위 합의가 빠름. 단일 일자 21분 머지로 검증.

2. **CI script vs ESLint plugin 결정 기준** — 타 ServiceClient 확장 시 `CHECKS` 배열 1줄 추가로 충분한 경우 → CI script. AST 분석/cross-file refactoring 추적이 필요한 경우 → ESLint plugin. 본 스프린트는 union type → string literal regex로 충분 → CI script 선택.

3. **Python 모듈 상수 SSOT + placeholder 동적 치환** — 프롬프트 본문이 가중치를 텍스트로 노출하는 패턴(LLM에게 채점 기준 명시)에서 모듈 로드 시 dict → f-string 치환으로 자동 동기화. JSON config 대비 외부 가시성은 잃지만 deploy 없이 분포 변경 시나리오 부재 시 단순함이 우선.

4. **회귀 차단 본질 테스트 클래스 명명** — `TestWeightsSSOTSync` 같이 회귀가 차단하는 결함을 명시. 미래 변경자가 테스트 의도를 즉시 파악 가능 (테스트 이름이 회고 사례 자체를 인용).

### 교훈

1. **Critic 호출 누락 = 회귀 머지** — Sprint 143 PR #200 R1 P1은 Critic이 적발했으나 만약 미호출이었다면 CI green으로 머지. **Critic 의존 → CI 자동 검출 전환**이 본 스프린트 시드 A의 핵심 가치. 향후 "Critic이 자주 적발하는 결함 패턴"은 CI 자동화 후보로 식별.

2. **Hardcoded 의존 TC는 grep 추적 의무화 = 부채** — Sprint 143 PR #198 후속 commit은 가중치 분포 변경 시 별도 파일의 가중 평균 TC를 grep으로 찾아 수동 재계산. 본 스프린트로 **검증 함수 호출**로 전환 → grep 의무 폐지. 동일 패턴(hardcoded fixture가 SSOT 변경에 의존하는 경우)은 모두 자동화 후보.

3. **회고 → 신규 시드 → 다음 스프린트 즉시 처리 사이클** — Sprint 141~143이 "이월 시드 일괄 정리"로 누적 부채를 해소했다면, 본 스프린트는 "회고 시드 즉시 처리"로 부채 누적 자체를 차단. 두 패턴이 보완적.

## 브랜치 규율

- ✅ 신규 브랜치 + PR + Squash merge — **10 스프린트 연속 준수** (Sprint 134 위반 이후)
- main 직접 commit 0건

## ADR

- [sprint-144.md](sprint-144.md)
- 관련: [sprint-143.md](sprint-143.md) — 회고에서 본 스프린트 시드 식별
