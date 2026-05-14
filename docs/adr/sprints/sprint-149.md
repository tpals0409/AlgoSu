---
sprint: 149
title: Regex 강건성 lint 룰 자동화 — Sprint 145~148 P2 4건 누적 해소 (시드 #17)
status: completed
period: 2026-05-13 (단일 일자)
start_commit: 60d2ede
end_commit: d1fe387
prs:
  - https://github.com/tpals0409/AlgoSu/pull/224 (PR #1 — scripts/check-regex-robustness.mjs 신설 + CI 통합, 시드 #17, Critic R1+R2+R3 P2 3건 해소 → R4 클린)
  - https://github.com/tpals0409/AlgoSu/pull/225 (PR #2 — RUNBOOK §5 매트릭스 + §6 ADR + §7 FAQ + §8 신설, Critic 미호출)
related_sprints:
  - sprint-148 (회귀 차단 5차원째 — rule-label + dashboard-structure + RUNBOOK 문서화 — 본 스프린트 자동화 직접 선행)
  - sprint-147 (panel title + variable usage 검증 + `|` 우선순위 P2)
  - sprint-146 (quantifier inner brace P2 + Critic 3 라운드)
  - sprint-145 (character class P2 + SSOT 가정 검증 + 회귀 차단 자동화 원형)
  - sprint-142 (Critic 5 라운드 패턴 원형 — 본 스프린트는 4 라운드에서 클린)
---

# Sprint 149 — Regex 강건성 lint 룰 자동화 (시드 #17)

## 목표 & 배경

Sprint 145~148에서 **regex 강건성 P2가 4 스프린트 연속 Critic R1/R2에 적발**됨:

| Sprint | PR | P2 결함 | 분류 |
|--------|----|---------|------|
| 145 | #208 | `[a-z_]+` digit 누락 → `2xx` metric 미매칭 | Character class 일관성 |
| 146 | #209 | `{2}` quantifier로 `[^{}]*` selector 끊김 | Quantifier inner brace |
| 147 | #218 | `\|` 우선순위 미그룹화 → `success_rate` 전역 매칭 | `\|` 연산자 우선순위 |
| 147 | #219 | `${var:format}` format suffix optional 누락 | Prefix anchoring |

Sprint 148에서 `docs/runbook-regex-robustness.md` 260라인 4종 체크리스트를 문서화했으나 사람 주의력 의존. 본 스프린트는 RUNBOOK §2.1~2.4 체크리스트를 **정적 검증 스크립트**로 자동 차단.

**회귀 차단 누적 차원 확장 6차원째**:
- Sprint 145: metric name 정합 (entry point 원형)
- Sprint 146: label 정합 (Grafana label collector)
- Sprint 147: panel title + variable usage
- Sprint 148: rule label + dashboard structure (datasource/empty/duplicate id)
- **Sprint 149: regex 강건성 정적 검증 (4종 룰)**

## PR 단위 요약

### PR #224 — `scripts/check-regex-robustness.mjs` 신설 + CI 통합 (시드 #17)

- **변경**: `scripts/check-regex-robustness.mjs` 신설 (337→357라인, Critic 누적 +20) + `.github/workflows/ci.yml` paths filter + step (총 3 commits squashed)
- **4종 룰 구현 (RUNBOOK §2.1~2.4 1:1 매핑)**:
  - **Rule 1 (§2.1)**: depth-0 `|` alternative 분리 후 anchor(`\b`/`^`/`\$`/`${`/`\{`/`(`/`(?:`) 없는 alternative 검출
  - **Rule 2 (§2.2)**: `metricNamePattern`/`metricPattern`/`__name__` 컨텍스트(현재 라인)에서 alpha-only character class 단독 또는 비-인접 digit class와 결합 — Prometheus 명세 `[a-zA-Z_][a-zA-Z0-9_]*` 인접 결합 + 두 번째 class alphanumeric 요건
  - **Rule 3 (§2.3)**: 파일 레벨 `[^{}]*` selector wrapper + `{N}` quantifier 동시 존재 + `normalizeExprForSelectorParse`/`__QUANTIFIER__`/`__GRAFANA_VAR__` 헬퍼 미존재
  - **Rule 4-A (§2.4)**: Grafana variable 추출 `\$\{(...)\}` 에 `(?::[^}]*)?` format suffix optional capture 누락 (단 `name:` JS template literal skip)
  - **Rule 4-B (§2.4)**: wildcard `.+` 패턴에 metric 컨텍스트에서 `^algosu_`/`^`/`\b` prefix anchor 없음
- **자체 검증 (`runRegressionFixtures()`)**: Sprint 145~148 P2 4건 결함 패턴을 인라인 fixture로 분석. 미검출 시 exit 2 self-test 실패.
- **면제 메커니즘**: 라인 끝 `// regex-lint: allow-rule-N` 또는 `// regex-lint: allow-rule-1,2` 주석.
- **TARGET_FILES**: `scripts/check-grafana-metrics.mjs`, `check-prometheus-rules.mjs`, `check-mock-coverage.mjs`, `check-coverage.mjs` (자기 자신 제외).
- **CI 통합**: `quality-monitoring` job step + `detect-changes` monitoring paths filter에 신규 스크립트 추가 (1차 push에서 누락 → 즉시 fix commit).

#### Critic 4 라운드 P2 해소

| 라운드 | 세션 ID | P2 결함 | Fix |
|--------|---------|---------|-----|
| **R1** | `019e1e74-a309-7483-808a-2075849856a0` | `pattern.match()[0]`로 첫 character class만 검사 → valid Prometheus 패턴 `/[a-zA-Z_][a-zA-Z0-9_]*/` 의 leading class `[a-zA-Z_]` digit 없어서 false positive | 모든 alpha-only class 수집 + 하나라도 digit 포함하면 OK |
| **R2** | `019e1e8c-e198-7d81-8453-4ae9232d00ad` | R1 fix가 무관 digit class도 면제 → `/algosu_[a-z_]+_status_[0-9]{3}/` 같이 사이에 `_status_` 토큰이 있는 비-인접 패턴도 OK 처리 (false negative) | Prometheus 명세 인접 결합 강제 — 첫 alpha class 직후 quantifier(`*`/`+`/`?`)만 사이에 두고 digit class 인접해야 OK |
| **R3** | `019e1e91-6780-77c0-a548-da72c4bec77b` | R2 fix가 직후 digit-only class `[0-9]` 도 면제 → `/algosu_[a-z_]+[0-9]{3}/` 같이 metric name 부분 alpha-only인 패턴도 OK 처리 (false negative) | 직후 class가 **alphanumeric** (alpha + digit 동시 포함) 일 때만 OK — Prometheus 명세 `[a-zA-Z0-9_]` 정확 일치 |
| **R4** | `019e1e94-829a-7541-8462-eb44e26eb6bf` | **클린 통과** ✅ — Codex 인용: *"narrows Rule-2's exemption so digit-only adjacent classes are no longer treated as valid Prometheus metric-name continuations. I did not find a discrete introduced bug."* | — |

- **검증 매트릭스 (R3 fix 후)**:
  - baseline 4 스크립트 → exit 0 ✅
  - `/algosu_[a-z_]+[0-9]{3}/` (R3 P2 회귀) → exit 1 ✅ 검출
  - `/[a-zA-Z_][a-zA-Z0-9_]*/` (Prometheus 명세) → exit 0 ✅ no FP
  - `/algosu_[a-z_]+_status_[0-9]{3}/` (R2 P2 회귀) → exit 1 ✅ 검출
  - `/[a-z_]+/` (Sprint 145 P2 회귀) → exit 1 ✅ 검출
  - `runRegressionFixtures()` 4 fixture self-test → OK ✅

- **CI**: 38 SUCCESS / SKIPPED, mergeStateStatus CLEAN

### PR #225 — RUNBOOK §5 매트릭스 + §6 ADR + §7 FAQ + §8 신설 (docs-only)

- **변경**: `docs/runbook-regex-robustness.md` +50 -3 (260 → 307라인)
- **§5 책임 매트릭스**: "Regex 강건성 정적 검증" 행 신규 + SSOT 확장 의무 2건 추가 (TARGET_FILES 갱신 / Rule 2 컨텍스트 정규식 검토)
- **§6 ADR 기록**: `sprint-148` + `sprint-149` 참조 추가
- **§7 FAQ 갱신**: "향후 자동화 시?" → "어떻게 자동화되었는가?" (도입 완료 명시 + ESLint custom rule 대신 독립 Node 스크립트 채택 근거)
- **§8 신설**: lint 룰 ↔ 체크리스트 매핑 — Rule 1~4 각각 검출 조건 + 위반 예 + 회귀 시드 + 면제 메커니즘 + 자체 검증
- **Critic**: 미호출 (docs-only)
- **CI**: 27 SUCCESS, mergeStateStatus CLEAN

## 결정 사항

### D-149-1: ESLint custom plugin 대신 독립 Node 스크립트 채택

**검토 옵션**:
- A안: ESLint custom plugin (`eslint-plugin-regex-robustness`)
- B안: 독립 Node 스크립트 (`scripts/check-regex-robustness.mjs`)
- C안: 혼합

**채택**: B안

**근거**:
1. **lint 범위 정합**: 검증 대상이 `scripts/check-*.mjs` 4개. 현재 `scripts/` 디렉토리는 ESLint 대상 외 (services별 NestJS / frontend Next.js만 lint). Plugin 채택 시 `scripts/` lint 환경 신설 부담.
2. **Sprint 145~148 단일 entry point 누적 차원 패턴 계승**: monitoring 검증의 모든 차원이 `quality-monitoring` CI job에 누적. 본 스프린트도 동일 job에 step 추가만으로 통합.
3. **자체 검증 자유도**: `runRegressionFixtures()` 함수를 스크립트 내부에 인라인으로 작성 가능. Plugin은 별도 테스트 인프라 필요.
4. **AST 의존성 회피**: regex 리터럴 line-based 추출이 4개 스크립트 패턴 충분 (멀티라인 regex 0건 관측). Plugin은 ESTree AST 의존성 강제.

**대안 미채택 사유**:
- A안: 위 4가지 모두 부담. `scripts/` lint 활성화 시 false positive 폭발 위험.
- C안: 과잉. B안이 모든 요구 충족.

### D-149-2: Rule 2 "Prometheus 명세 인접 결합" 정의를 alphanumeric continuation으로 정밀화

**배경**: R1~R3 P2가 모두 Rule 2 검출 경계의 점진적 정밀화. 4번째 라운드(R4)에서 클린.

**최종 정의**:
- 안전: 첫 alpha-only class **직후** 인접 (사이 quantifier `*`/`+`/`?` 만 허용) + 두 번째 class가 **alphanumeric** (alpha 와 digit 동시 포함)
- 위반:
  - 첫 alpha-only class 단독 (직후 class 없음)
  - 첫 alpha-only class + 비-인접 (사이에 `_status_` 같은 리터럴 토큰)
  - 첫 alpha-only class + 인접 digit-only class `[0-9]`

**근거**: Prometheus metric name 명세 `[a-zA-Z_][a-zA-Z0-9_]*` 의 두 character class 중 **두 번째**는 alphanumeric (alpha + digit + underscore). digit-only `[0-9]` 는 명세 매칭이 아니라 별도 패턴(status code suffix 등).

### D-149-3: detect-changes paths filter는 신규 monitoring 스크립트 추가 시 동시 갱신 의무

**계기**: 1차 push (commit `f748f0b`)에서 `scripts/check-regex-robustness.mjs` paths filter 미포함 → `Quality — monitoring` SKIPPED → CI에서 실제 lint 실행 안 됨 (회귀 차단 본질 무효화). 즉시 fix commit으로 해소.

**정책**: 신규 `scripts/check-*.mjs` 추가 시 `.github/workflows/ci.yml` `detect-changes` job의 `monitoring` paths filter에 동시 등록 의무. RUNBOOK §5 SSOT 확장 의무에 명문화.

## 신규 패턴

### P1: Critic 4 라운드 P2 해소 → R4 클린 임계값 도달

Sprint 142 (5 라운드) / Sprint 148 (3 라운드) 패턴의 중간. R3에서 클린되지 않고 R4까지 갔으나 R4에서 "no discrete introduced bug" 클린.

**핵심 관찰**: 각 fix가 **단일 조건 변경**만 수행하면서 정밀화 — 이전 fix의 정의역적 코너 케이스를 다음 라운드에서 발견 → 단일 조건 추가로 해소. 4 라운드 모두 코드 변경은 합계 +47 -10 (Rule 2 함수 단일 함수).

**R3 → R4 클린 임계값 충족 신호**:
1. 단일 조건 추가 (`&& /[a-zA-Z]/.test(next[0])`)
2. 정의역적 코너 케이스 모두 처리됨 (alpha-only / digit-only / alphanumeric 모든 케이스)
3. Codex 명시: "no discrete introduced bug"

### P2: 회귀 차단 본질의 6차원 자동화 완성 (Sprint 145~149 5 스프린트 누적)

Sprint 145 metric → Sprint 146 label → Sprint 147 panel-title+variable → Sprint 148 rule-label+dashboard-structure → **Sprint 149 regex-robustness**

본 스프린트는 monitoring 변경 자체가 아닌 **monitoring 검증 스크립트의 강건성**을 자동화. 메타 차원의 회귀 차단. RUNBOOK 4종 체크리스트의 정적 검증 전환.

### P3: 단일 entry point vs 신규 entry point 결정 기준

Sprint 145~148은 모두 `scripts/check-grafana-metrics.mjs` **단일 스크립트에 누적**. 본 스프린트는 **신규 스크립트 `check-regex-robustness.mjs`** 채택.

**신규 entry point 채택 조건**:
- 검증 대상이 기존 SSOT와 도메인이 다름 (기존: metric 정의 일치 / 본건: 검증 스크립트 자체 강건성)
- 검증 로직이 기존 함수와 재사용 무 (regex 리터럴 추출 / 룰별 검사 등)
- RUNBOOK 체크리스트와 1:1 매핑이 더 명확

**단일 entry point 누적 채택 조건** (Sprint 145~148 패턴):
- 검증 대상이 기존 SSOT와 동일 도메인 (dashboard 정합성)
- 기존 함수 재사용 가능 (label collector / variable collector 등)
- baseline counter가 누적 가시화

### P4: 자체 검증 (`runRegressionFixtures()`) 패턴

스크립트가 시작 시 자기 코드에 Sprint 145~148 P2 4건의 결함 패턴을 인라인 fixture로 분석. 미검출 시 exit 2 (self-test 실패).

**효과**:
1. baseline 무결성 자동 보호 — fix가 fixture 검출을 깨지 않는지 매 실행 검증
2. 회귀 시드를 코드 안에 명시적 보존 — ADR을 굳이 참조하지 않아도 결함 패턴 가시
3. CI 실패 모드 두 분리 — exit 1 (정책 위반) vs exit 2 (self-test 실패)

## 교훈

### L-149-1: R1 fix → R2 P2 → R3 P2 패턴 재확인 — 정책 분기 코너 케이스 동시 검토 의무

Sprint 147~148 ADR에서 이미 명문화된 패턴이 본 스프린트에서 3 라운드 연속 재현. 각 라운드 fix는 단일 조건 변경이었지만 정의역의 한 코너만 처리하고 다른 코너 케이스를 노출.

**Rule 2 컨텍스트 진화**:
- R1 fix 전: 첫 character class만 검사 (over-narrow)
- R1 fix 후: 모든 alpha class 중 하나라도 digit 있으면 OK (over-broad)
- R2 fix 후: 인접성 강제 (over-broad — digit-only adjacent)
- R3 fix 후: alphanumeric continuation 강제 (정확)

**개선 행동**: fix 시 fix 대상 조건과 **반대 방향** 코너 케이스(과도 면제 / 과소 면제)를 동시에 검토하는 self-review 체크리스트가 RUNBOOK §3 fixture 검증과 결합.

### L-149-2: paths filter는 신규 검증 스크립트 추가 시 SSOT 확장 의무 — RUNBOOK 명문화 필요

본 스프린트 1차 push에서 paths filter 누락 발견. **회귀 차단 자동화 자체가 CI에서 실행되지 않으면 무효**. RUNBOOK §5 SSOT 확장 의무로 명문화 완료.

### L-149-3: 정규식 추출 line-based가 4 스크립트에 충분

ESTree AST 의존성 없이 line-based regex 추출(`/(?:=\s*|[|(,;:[\s]\s*)\/((?:[^/\\\n]|\\.)+)\/[gimsuy]*/g`)이 4 스크립트의 모든 regex literal을 false negative 없이 추출. JSDoc 블록 주석 `/** */` 처리 + 단일 라인 주석 `//` skip만 추가하면 충분.

**한계**: `new RegExp('pattern')` 형태 / 멀티라인 regex는 false negative. 본 4 스크립트에 0건 관측 — 미래 사용 시 라인 단위 분석 한계 인정.

### L-149-4: 자체 검증 fixture가 fix 회귀 안전망 역할

R1~R3 fix를 거치며 `runRegressionFixtures()` 4 fixture가 매 실행 통과. fix가 회귀 시드 검출을 깨뜨릴 수 없음을 자동 보장 — Critic R1~R3 검토와는 **독립적인 안전망**.

## 이월 시드 (Sprint 150)

본 스프린트 신규 이월 0건. Sprint 148 잔여 시드 그대로 이월:

- **UAT 사용자 직접** (Oracle 작업 외):
  - 시드 #5: 프로그래머스 재제출 채점 통과 확인 (6 스프린트 누적)
  - 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

- **자동화 / 인프라** (Oracle 작업 대상):
  - 시드 #14: ai-analysis problem context 후속 (frontend 활용 / submission schema / saga payload)
  - 시드 #15: `extractInlineBlock()` 비대칭 처리 (현재 회귀 없음, 점진적 개선 후보)
  - 시드 #16: `.claude/` gitignore 정책 검토 — `.claude/commands/` tracked 전환

## 브랜치 규율

**15 스프린트 연속 준수** ✅:
- PR #224: `feat/sprint-149-regex-robustness-lint` (신규 브랜치) → Squash merge → 브랜치 삭제
- PR #225: `docs/sprint-149-runbook-section-8` (신규 브랜치) → Squash merge → 브랜치 삭제
- main 직접 commit 0건 (Sprint 134 위반 이후)

## 검증

| 검증 항목 | 결과 |
|----------|------|
| PR #224 CI | 38 SUCCESS / SKIPPED, CLEAN ✅ |
| PR #225 CI | 27 SUCCESS, CLEAN ✅ |
| baseline `node scripts/check-regex-robustness.mjs` | exit 0 ✅ |
| `runRegressionFixtures()` 4 Sprint P2 fixture | all detected ✅ |
| 4종 회귀 시나리오 inject | 모두 exit 1 ✅ |
| Valid Prometheus 명세 inject | exit 0 (no FP) ✅ |
| Critic 4 라운드 P2 해소 | R1→R2→R3 fix → R4 클린 ✅ |
| 브랜치 규율 | 2 PR 모두 신규 브랜치 + Squash merge ✅ |

## 참조

- PR #224: https://github.com/tpals0409/AlgoSu/pull/224
- PR #225: https://github.com/tpals0409/AlgoSu/pull/225
- Codex 세션 ID:
  - R1: `019e1e74-a309-7483-808a-2075849856a0`
  - R2: `019e1e8c-e198-7d81-8453-4ae9232d00ad`
  - R3: `019e1e91-6780-77c0-a548-da72c4bec77b`
  - R4: `019e1e94-829a-7541-8462-eb44e26eb6bf`
- 관련 문서: `docs/runbook-regex-robustness.md` §8 (lint 룰 ↔ 체크리스트 매핑)
- 직전 ADR: `docs/adr/sprints/sprint-148.md`
