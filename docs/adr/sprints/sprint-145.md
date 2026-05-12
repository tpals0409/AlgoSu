---
sprint: 145
title: Prometheus Rules + Grafana Dashboard 자동 검증 CI
status: completed
period: 2026-05-09 (단일 일자)
start_commit: c27232c
end_commit: f0affd4
prs:
  - https://github.com/tpals0409/AlgoSu/pull/207 (PR 1 — promtool check rules CI)
  - https://github.com/tpals0409/AlgoSu/pull/208 (PR 2 — grafana dashboard ↔ service code cross-check + Critic R2 P2 fix)
related_sprints:
  - sprint-144 (회귀 차단 자동화 — 본 스프린트 시드 #7 식별)
  - sprint-143 (이월 시드 일괄 정리 — 시드 #7 원형)
  - sprint-142 (프롬프트 최적화 — Critic 다중 라운드 패턴 원형)
---

# Sprint 145 — Prometheus Rules + Grafana Dashboard 자동 검증 CI

## 컨텍스트

Sprint 143 회고에서 식별된 monitoring stack 정합성 부채 처리. `prometheus-rules.yaml`과 grafana dashboard 3개의 정합성을 사람의 주의력에 의존 — schema 변경 시 alert/dashboard 동시 갱신 누락 회귀 위험. Sprint 144에서 동일 패턴(SSOT/CI 자동화)으로 mock factory + 가중치 SSOT 회귀 차단 검증 → 이번엔 monitoring stack 정합성을 구조적으로 차단.

본 스프린트는 Sprint 143~144에서 **이월된 시드 3건** 중 **시드 #7**(monitoring CI 자동화)만 처리. 시드 #5/#9는 사용자 직접 UAT라 코드 작업 0건이며 사용자 시점에 별도 검증.

### 처리 범위

| 시드 | 위치 | 우선순위 | 상태 |
|------|------|---------|------|
| A | promtool check rules CI (syntax 검증) | P2 | ✅ PR #207 |
| B | grafana dashboard ↔ service code cross-check | P2 | ✅ PR #208 (Critic R2까지 fix) |

### Sprint 146 이월 (Sprint 143~144 잔여 2건)

- 시드 #5: UAT — 프로그래머스 재제출 채점 통과 확인 (사용자 직접)
- 시드 #9: UAT — 영문 환경 캘린더 + production Grafana CB dashboard ai-analysis 정합 (사용자 직접)

## 결정

### Plan 가정 깨짐 + 사용자 결정

**초기 plan 가정**: prometheus-rules.yaml이 metric SSOT — dashboard expr가 참조하는 algosu metric이 rules에 정의되어 있는지 cross-check.

**실제 데이터 검증 결과**: rules에서 사용 metric 6개 vs dashboard 사용 32개 → **false positive 26건**. rules는 alert/recording 정의만 담아 metric SSOT 역할 못 함 (exporter metric은 service 코드가 직접 노출).

**사용자 결정 (2단계)**:
1. 옵션 B/C/D 중 → **C (service code SSOT)** 채택
2. C-light(prefix 검증) vs C-strict(완전 metric set) → **C-strict** 채택

### 시드 A — promtool 설치 위치 (CI install vs Docker image)

**GitHub Actions step 다운로드 (채택)**: `prometheus/prometheus` v2.55.0 binary를 `quality-monitoring` job에서 `curl | tar xz` 후 `/usr/local/bin/`으로 이동.
- 장점: 외부 Docker image 의존 0건, 버전 명시 가능, ubuntu-latest 직접 실행.
- 단점: 매 CI 실행마다 다운로드 비용 (~30초). monitoring 변경 시만 트리거되므로 누적 비용 미미.

### 시드 B — metric SSOT 정의 추출 휴리스틱

**Static analysis (채택)**: regex 기반 service 코드 정적 분석으로 정의 metric set 구성.
- NestJS 4 service: `process.env['SERVICE_NAME'] ?? 'xxx'` default 값 검증 + `${prefix}_yyy` backtick interpolation 추출 + `collectDefaultMetrics` 호출 시 prom-client v15.x default 28개 prefix prepend
- github-worker: `PREFIX = 'algosu_github_worker'` 상수 + circuit-breaker 추가 metric
- 추가 TS 파일 (submission/circuit-breaker, problem/dual-write): `name: 'algosu_xxx'` literal 추출
- ai-analysis: Python `name="algosu_ai_analysis_xxx"` literal 추출 (Python default metric은 prefix 없이 등록 → dashboard 검증 대상 외)
- Histogram: `_bucket` / `_count` / `_sum` suffix 자동 등록
- Recording rules (보조 SSOT): `prometheus-rules.yaml`의 `record:` 필드 → `algosu:*` metric 추가

**Runtime probe (미채택)**: service를 띄워 `/metrics` endpoint hit하여 노출 metric 추출 — e2e 영역, CI 시간 폭증.

### 시드 B — `__name__` selector 처리 (R1 P2 #1 fix)

dashboard expr가 `{__name__=<op>"<pattern>"}` selector로 metric을 참조할 때:

| Operator | Pattern | 처리 |
|----------|---------|------|
| `=` / `!=` | exact metric name | strict (정확 1개 정의 필수) |
| `=~` / `!~` | union `algosu_(a\|b\|c)_xxx` | strict (3개 모두 정의 필수) |
| `=~` / `!~` | wildcard `algosu_.+_xxx` | **least-one match** — KNOWN_SERVICE_PREFIXES 6개 expansion 후 1+ 정의되면 OK |
| `=~` / `!~` | 기타 정규식 | 보수적 무시 (false positive 회피) |

wildcard를 strict로 다루면 일부 service가 metric 미노출하는 정상 케이스도 fail (github-worker는 일반 HTTP 처리 안 함, ai-analysis는 Python이라 nodejs metric 없음). dashboard 의도("있는 service만 보여줘") 보존 필요.

## 변경 요약

### PR #207 — Sprint 145 시드 A (squash merge `6bfb10a`)

- 신규: `scripts/check-prometheus-rules.mjs` (+102)
- 변경: `.github/workflows/ci.yml` (+26) — `detect-changes` outputs `monitoring` + paths filter `infra/k3s/monitoring/**` + `quality-monitoring` job (promtool 설치 + script 실행)
- 합계: **2 files / +128**
- Critic 미호출 — Sprint 144 시드 A 동일 정책 (CI 인프라 추가 + 표준 도구 의존).

### PR #208 — Sprint 145 시드 B (squash merge `f0affd4`)

- 신규: `scripts/check-grafana-metrics.mjs` (+365 누적, R1+R2 commit)
- 변경: `.github/workflows/ci.yml` (+9) — paths filter에 service metric 정의 파일 추가 + `quality-monitoring` job에 step 1개
- 합계: **2 files / +374**
- Critic 호출 (Codex gpt-5):
  - **R1** (session `019e0d1c-b153-7732-95eb-8b38d385e60c`): P0/P1 0건, **P2 2건 적발**
    - P2 #1 — `__name__=~` selector 통째 마스킹 → false negative 17건
    - P2 #2 — `algosu:` recording rule이 service code SSOT에 없어 미래 dashboard 사용 시 false positive
  - **R2**: P0/P1 0건, **P2 1건 적발**
    - P2 — source-code extractor regex `[a-z_]+` → digit 미허용. 미래 `algosu_gateway_http_2xx_total` 같은 metric에 false positive 위험
  - **R3 미호출** — 단순 character class widening (4글자 변경)으로 새로운 결함 가능성 없음

## 검증

- **CI 전체 GREEN**: PR #207 + #208 모두 Quality + Test 전 서비스 + Coverage Gate + E2E Programmers Full Flow 통과 (28 checks).
- **로컬 회귀 시나리오 3건** (시드 B):
  - strict literal typo (`algosu_submission_circuit_breaker_TYPO`) → 정확 1건 metric 출력 + exit 1 ✅
  - wildcard `.+` 패턴 모든 service 미정의 → 4개 panel 모두 검출 + 모든 expand metric 출력 ✅
  - union one-miss (rename된 service) → 정확 검출 + exit 1 ✅
- **Final state**: 정의 metric 204개 / dashboard strict 32개 / wildcard groups 15개 모두 통과.

## 브랜치 규율

- 신규 브랜치 + PR + Squash merge — **11 스프린트 연속 준수** (Sprint 134 위반 이후)
- 본 스프린트 PR 2건 모두 main 직접 commit 0건

## 신규 패턴

### Wildcard expansion least-one match
dashboard `__name__=~"algosu_.+_xxx"` 패턴은 known service prefix expansion 후 1+ service만 정의되어 있으면 OK. union `(a|b|c)` 패턴은 strict (모두 정의 필수). dashboard 의도("있는 service만 보여줘") 보존하면서 prefix 자체 오타는 검출.

### Multi-source SSOT 결합
service code(주 SSOT, exporter metric) + prometheus-rules.yaml(보조 SSOT, recording rules)를 함께 사용. 단일 SSOT 환상 폐기 — 각 metric type의 정의 위치 SSOT가 다르다는 현실 반영. recording rule은 prometheus-rules.yaml이 정의 SSOT이므로 거기서 추출하는 것이 정확.

### Plan 가정 검증 단계
plan 채택 직전 실제 데이터로 SSOT 가정 sanity check 필수. 본 스프린트에서 "rules가 metric SSOT" 가정이 26건 false positive로 검증 → plan 재정의 + 사용자 결정. 가정 깨짐을 발견했을 때 진행보다 재정의가 우선.

### Critic 다중 라운드 P2 해소 (R3 임계값)
Sprint 142(5라운드) 패턴 단축 적용. R1 P2 2건 → R2 P2 1건 → R3 미호출. R3 미호출 임계값: "단순 character class 변경 + 새 결함 가능성 없음" 같이 변경의 위험도가 정의역적으로 0에 가까울 때.

## 교훈

### Plan 가정의 즉시 검증 의무
plan 작성 시 SSOT 가정은 실제 데이터로 sanity check 필수. 본 스프린트에서 plan에 명시된 "rules SSOT" 가정이 plan 작성 단계에서 검증되지 않아 작업 중반에 발견 → 사용자 재결정 흐름. **가정이 깨질 때 plan 재정의 + 사용자 결정 받는 것이 진행보다 우선**.

### Critic R1만 호출하는 것은 회귀 차단 본질에 부족할 수 있음
plan에 "Critic 1라운드"로 명시했으나 R1에서 P2 2건 적발 (false negative 17건 + 미래 false positive 위험) → fix 후 R2에서 새로운 P2 1건 적발. **단일 라운드만 호출했으면 false negative 17건 회귀를 만들었을 것**. P2도 회귀 차단 본질에 직결되는 결함이면 라운드 추가 정당화.

### Regex character class consistency
같은 도메인(prometheus metric 이름)에서 source/dashboard side regex가 일관된 character class 사용 의무. Sprint 145 R2 P2 사례: dashboard side가 `[a-zA-Z0-9_:]+` 사용하나 source side는 `[a-z_]+`였음 — Critic R2 적발 후 통일. **character class inconsistency는 미래 false positive 회귀 시드**.

### Default metric 목록의 stale 위험
prom-client v15.x default 28개 metric을 script에 하드코딩. 라이브러리 메이저 버전 업그레이드 시 기존 metric 제거 / 신규 metric 추가 가능 — 본 script가 stale될 위험. **CHANGELOG 검토 + Sprint 단위 sync 점검** 필요 (Sprint 146+ 시드 후보).

## Sprint 146 이월

Sprint 143~145 잔여 2건 그대로 이월:

- **시드 #5** (UAT — Sprint 143 이월): 사용자가 실제 프로그래머스에 optimizedCode 재제출 → 채점 통과 확인
- **시드 #9** (UAT — Sprint 143 이월): 영문 환경 캘린더 + production Grafana CB dashboard ai-analysis 정합

본 스프린트 신규 시드:

- **시드 #10** (Sprint 145 신규): prom-client/prometheus_client default metric 목록 stale 점검 — 라이브러리 버전 업그레이드 시 sync 자동화 또는 Sprint 단위 manual 점검
