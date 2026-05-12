---
sprint: 146
title: UAT 의존 시드 → 회귀 차단 자동화 전환
status: completed
period: 2026-05-10 (단일 일자)
start_commit: f0affd4
end_commit: 7fca904
prs:
  - https://github.com/tpals0409/AlgoSu/pull/209 (PR 1 — Grafana labelnames 정합 검증 확장 + Critic 3 라운드)
  - https://github.com/tpals0409/AlgoSu/pull/210 (PR 2 — Calendar 영문 locale 매핑 단위 테스트)
related_sprints:
  - sprint-145 (Prometheus Rules + Grafana Dashboard 자동 검증 — 본 스프린트 시드 B 직접 확장)
  - sprint-144 (회귀 차단 자동화 — Critic 적발 결함 → CI 자동화 후보 패턴 원형)
  - sprint-141 (Calendar useLocale 동적 매핑 도입 — 본 스프린트 PR #210 보호 대상)
  - sprint-142 (Critic 다중 라운드 패턴 원형)
---

# Sprint 146 — UAT 의존 시드 → 회귀 차단 자동화 전환

## 컨텍스트

Sprint 143~145에서 누적 이월된 UAT 시드 2건은 본질적으로 **사용자 환경 의존 검증**(시드 #5: 프로그래머스 OJ 채점 / 시드 #9: production Grafana 시각 확인 + 영문 i18n 환경)이라 매번 사람의 주의력에 의존했음. 사용자 요청 "Claude 안에서 모든 작업 완료" → **Sprint 144 신규 패턴**("Critic이 자주 적발하는 결함 패턴 → CI 자동화 후보 식별") 직접 적용. UAT 자체는 외부 시스템 의존이라 불가능하지만, **UAT가 실패할 수 있는 회귀 시드를 정적/단위 검증으로 차단**하는 구조 전환은 가능.

본 스프린트는 5개 자동화 후보 중 ROI + 구현 난도 + Sprint 145 단일 일자 머지 패턴을 고려하여 **3 PR 분할 → 1 PR 스킵 + 2 PR 머지** 처리.

### 처리 범위

| PR | 시드 | 위치 | 결과 |
|----|-----|------|------|
| #1 | #5 | ai-analysis 회귀 차단 테스트 강화 | ⏭️ **스킵** (Plan 가정 깨짐 — Sprint 142~144에서 이미 covered) |
| #209 | #9 | Grafana dashboard labelNames ↔ service code labelnames 정합 검증 | ✅ Critic 3 라운드 통과 |
| #210 | #9 | Calendar 영문 locale 매핑 단위 테스트 | ✅ 4 테스트 PASS |

### Sprint 147 이월

- 시드 #5: UAT — 프로그래머스 재제출 채점 통과 확인 (사용자 직접). Sprint 142 프롬프트 강화 후 미검증
- 시드 #9: UAT — 영문 환경 + production Grafana CB dashboard ai-analysis 시각 확인 (사용자 직접). 회귀 시드는 자동 차단 완료, 시각 검증만 잔존

## 결정

### Plan 가정 깨짐 즉시 보고 (PR #1 스킵)

PR #1 탐색 단계에서 보고된 "테스트 누락" 항목 3건이 모두 **이미 존재**:

| Plan에서 가정한 누락 | 실제 위치 | 도입 스프린트 |
|---|---|---|
| `TestIsExplicitFalse` | test_claude_client.py:1220-1259 | Sprint 142 (9 케이스 추가) |
| `TestComputeTotalScoreLanguageBranch` | test_prompt.py:324-365 | Sprint 144 (Python/SQL/누락) |
| `TestPlatformContextInjection` | test_prompt.py:413-492 (TestPlatformContextImperative) | Sprint 142 (모든 분기) |

탐색 보고서가 outdated 정보 기반. PR #1을 그대로 진행하면 중복 테스트만 추가됨 (회귀 차단 가치 0). Sprint 145 신규 패턴("Plan 가정 깨짐 시 즉시 재정의 + 사용자 결정") 즉시 적용 → 사용자 결정으로 PR #1 스킵, Sprint 146 범위 = PR #209 + #210 2건으로 축소.

### 시드 #9 — 단일 SSOT 검증 entry point 유지 (Sprint 145 시드 B 확장)

**옵션**:
- A. 신규 스크립트 `scripts/check-grafana-labels.mjs` 추가
- B. `scripts/check-grafana-metrics.mjs` 확장 (Sprint 145 시드 B에 라벨 차원 추가)

**B 채택**: dashboard ↔ service code 정합 검증의 단일 entry point 유지. CI `quality-monitoring` job 변경 없이 동일 검증 강도 증가. 신규 검증 차원이 추가될 때마다 스크립트 수가 증가하면 발견성/유지보수성 저하.

### Critic 호출 정책

- **PR #209**: R1 호출 필수. 회귀 차단 본질에 직결 (false negative/false positive 차단). R1 P0/P1 적발 시 R2까지.
- **PR #210**: 미호출. 테스트 추가만, 프로덕션 동작 0건 변경. PR #1 패턴(테스트만 추가)과 동일.

실제 결과:
- PR #209 R1: P0/P1 0건, **P2 1건** (quoted brace)
- PR #209 R2: P0/P1 0건, **P2 2건** (le 글로벌 면제, Histogram suffix labels)
- PR #209 R3: 클린 통과 ✅

회귀 차단 본질에 직결되는 P2는 라운드 추가하여 모두 해소 (Sprint 145 패턴 직접 적용).

## 변경 핵심

### PR #209 — Grafana dashboard labelnames 정합 검증 확장

**대상**: `scripts/check-grafana-metrics.mjs` (Sprint 145 시드 B 365라인 → 553라인, +216 -28)

**핵심 추가**:

1. **`metricLabels: Map<metricName, Set<labelName>>`** — source code 정의 metric의 라벨 set 등록. prom-client default + recording rule은 검증 skip.

2. **자동 라벨 분리 (Critic R2 P2-1 fix)**:
   - `ALWAYS_AUTO_LABELS`: 모든 metric에서 면제 (job/instance/pod/namespace/node/container/service/kind/version/__name__)
   - `HISTOGRAM_BUCKET_LABEL = 'le'`: `_bucket` suffix metric에서만 면제 (Histogram bucket 자동 차원)
   - `SUMMARY_QUANTILE_LABEL = 'quantile'`: 본 프로젝트 Summary 미사용 → 항상 strict
   - `isLabelExempt(metric, label)` 헬퍼로 metric별 조건부 적용

3. **`extractLabelsFromBlock()`** — metric `name:` 매치 위치부터 다음 metric 정의 시작 직전까지 슬라이스에서 `labelNames` (TS) / `labelnames` (Python) 정규식 추출. Histogram의 `_bucket`/`_count`/`_sum` suffix metric에도 동일 라벨 등록 (P2-2 fix로 labels 크기 무관하게 항상 등록).

4. **`collectLiteralMetricsAndLabels()`** — dashboard expr 안의 literal `algosu_xxx{label=...}` 패턴에서 라벨 사용 수집.

5. **`collectNameSelectorMetrics()` 확장** — `{__name__=~"...", label=...}` selector 처리 시 expansion된 모든 metric에 대해 labelUsage 추가 (wildcard expansion 포함).

6. **`normalizeExprForSelectorParse()`** — 두 가지 false negative 차단:
   - Grafana 변수 `${service}`의 inner `}` → `__GRAFANA_VAR__` placeholder 치환
   - PromQL regex quantifier `5[0-9]{2}` 같은 quoted value 내부 brace → `_` 치환 (Critic R1 P2 fix)

**검증 (회귀 시나리오 6건 모두 정확 검출 + baseline 통과)**:
- baseline: defined metrics 204 / dashboard label usages 124 / wildcard groups 15 / 모두 정의됨
- 시나리오 1 (Python labelnames typo): ai-analysis CB metric 변경 → 3건 검출
- 시나리오 2 (TS labelNames typo): gateway http_requests_total 변경 → 2건 검출 (service-debug + slo)
- 시나리오 3 (dashboard side typo): submission CB selector 변경 → 1건 검출
- 시나리오 4 (R1 P2: quoted brace + label typo): 1건 검출
- 시나리오 5 (R2 P2-1: 일반 metric에 le selector): 1건 검출
- 시나리오 6 (R2 P2-2: Histogram _count metric에 잘못된 라벨): 1건 검출
- 시나리오 7 (bucket metric + le 면제): 정상 통과

### PR #210 — Calendar 영문 locale 매핑 단위 테스트

**대상**: `frontend/src/components/ui/__tests__/Calendar.test.tsx` 신규 (+82, 프로덕션 코드 0건 변경)

**테스트 4건 (모두 PASS)**:
1. `props.locale={enUS}` 명시 → `<th aria-label="Sunday">` 영문 풀이름
2. `<NextIntlClientProvider locale="en">` mock → useLocale() 정상 → `LOCALE_MAP["en"]=enUS` 적용
3. provider 부재 (useLocale throw) → ko fallback → `<th aria-label="일요일">` (Sprint 141 PR #193 try-catch 의도 보호)
4. `props.locale` 우선순위 — provider `"en"`이라도 `props={ko}` 우선

**검증 차원**: react-day-picker v9는 weekday를 `<th aria-label="Sunday">Su</th>` 형태로 렌더링하므로 **aria-label 풀이름**이 가장 견고한 locale 검증 차원 (영문 vs 한국어 명확 구별).

## 검증

- **PR #209**: CI 38 checks SUCCESS (Quality + Test 전 서비스 + Coverage Gate + E2E + quality-monitoring)
- **PR #210**: CI 38 checks SUCCESS (Test Frontend + Quality frontend + Coverage Gate + E2E)
- **brokenless ✅**: jest UI suite 205 PASS (회귀 0건), tsc clean (0 errors)
- **Critic 3 라운드** (PR #209 only): R1 P2 1건 + R2 P2 2건 모두 해소, R3 클린 통과

## 브랜치 규율

✅ **12 스프린트 연속 준수** (Sprint 134 위반 이후): 2 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건.
- `feat/sprint-146-grafana-labelnames-check` → PR #209 (squash merge `1699851`)
- `test/sprint-146-calendar-en-locale` → PR #210 (squash merge `7fca904`)

## 신규 패턴

### 1. UAT → 자동 검증 구조 전환

UAT 항목이 누적 이월될 때 "UAT가 실패할 수 있는 회귀 시드"를 식별하여 정적/단위 검증으로 차단. UAT 자체는 사용자 책임으로 남기되 차단망을 두텁게.
- 사용자 환경 의존 (OJ 채점 / production Grafana / 영문 i18n)이 UAT 잔존 원인
- "사용자가 UAT 안 하면 회귀 발견 못 함"을 "회귀가 발생할 수 있는 시드를 PR/CI 단계에서 차단"으로 전환
- UAT 사용자 시점 부담 감소 + 회귀 발생률 저하 양립

### 2. 회귀 차단 본질의 차원 확장 패턴

신규 스크립트 신설 대신 기존 자동 검증 스크립트의 검증 차원 확장. 단일 SSOT 검증 entry point 유지하며 검증 강도 증가.
- Sprint 145 시드 B (metric 이름) → Sprint 146 (라벨 차원) → 미래 시드 (라벨 값 / Prometheus type 호환성)
- CI job 추가 부담 0, 발견성/유지보수성 보존
- 검증 entry point가 분산되면 신규 검증 누락 발견 어려움 → 단일 entry point로 strict하게 유지

### 3. Grafana 변수/PromQL quantifier placeholder 치환 패턴

Dashboard selector 정규식 매칭에서 inner curly brace가 매칭 경계를 끊는 false negative 회피.
- `${service}` Grafana variable inner `}` → placeholder
- `5[0-9]{2}` PromQL regex quantifier inner `{}` → underscore (quoted value 내부)
- 라벨 name은 따옴표 외부에서 추출되므로 quoted value 내부 변환은 검증 정확도 영향 없음
- 정규식 wrapper `[^{}]*`을 강건하게 만드는 것보다 입력 normalize가 단순/안전

### 4. Plan 가정 즉시 보고 + 사용자 결정 패턴 (Sprint 145 직접 적용)

탐색 단계에서 plan 가정이 깨졌을 때 진행보다 보고가 우선. 사용자가 (a) 스킵 (b) 범위 좁히기 (c) 다른 영역으로 재정의 중 결정.
- Sprint 145는 plan 채택 직전 가정 검증 (코드 작성 전)
- Sprint 146은 코드 시작 직후 가정 깨짐 발견 (탐색 완료 시점)
- 두 시점 모두 사용자 결정이 진행보다 우선

## 교훈

### 1. 탐색 보고서의 outdated 위험

Explore agent가 보고한 "누락" 항목이 실제로는 이미 존재하는 경우가 발생. 탐색 보고서는 시점 한계가 있으며 plan에 반영 전 실제 코드 grep으로 cross-check 필요. Sprint 146 PR #1은 plan 가정 깨짐을 작업 시작 직후 발견하여 즉시 스킵 결정 가능했음.

### 2. Critic R1만으로 부족 — 3 라운드 가치 입증

본 스프린트 PR #209는 R1에서 P2 1건만 보고되었으나, R2에서 P2 2건 추가 적발 (le 글로벌 면제 false negative + Histogram suffix label 검증 누락). R1 클린 통과 가정 시 두 회귀 패턴이 본 스크립트 도입 자체로 새로 만들어졌을 것. 회귀 차단 본질에 직결되는 P2는 라운드 추가 정당화.

### 3. 회귀 차단 자동화는 본질적으로 검증 차원의 누적

Sprint 144 (가중치 SSOT + mock factory) → Sprint 145 (metric 이름 정합) → Sprint 146 (라벨 정합) — 같은 monitoring/검증 영역이 반복적으로 차원을 추가하며 강화. 한 번에 모든 차원을 차단하는 것이 아니라 회귀 발생 시점마다 새 차원을 추가하는 incremental 강화 패턴이 ROI 최적.

### 4. UI 테스트 selector 견고성 — aria-label 우선

react-day-picker v9는 weekday를 `<th aria-label="Sunday">Su</th>` 형태로 렌더링. textContent abbreviation("Su") 검증은 abbreviation 길이 변경(예: locale variant) 회귀 위험. aria-label 풀이름("Sunday"/"일요일")은 locale 명세에 직결되어 가장 견고. UI 회귀 차단 테스트 작성 시 시각 표시 vs accessibility label 둘 중 후자 우선 검증.

## Sprint 147 이월

| 시드 | 출처 | 처리 방식 |
|------|------|----------|
| #5 | Sprint 143~146 누적 | UAT — 사용자 직접 (프로그래머스 재제출 → 채점 통과 확인) |
| #9 시각 검증 | Sprint 143~146 누적 | UAT — 사용자 직접 (영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합) — 회귀 시드는 본 스프린트 자동 차단 완료 |

두 시드 모두 Claude 측 추가 작업 없음. UAT는 사용자 임의 시점에 수행 가능 (자동 차단망이 회귀 발생률 낮춤).
