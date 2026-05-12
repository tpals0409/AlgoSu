---
sprint: 148
title: Sprint 147 회귀 차단 후속 확장 — Recording rule 라벨 + Dashboard 구조 + Regex RUNBOOK
status: completed
period: 2026-05-12 ~ 2026-05-13 (단일 사이클, 야간 작업 포함)
start_commit: 9d303ac
end_commit: c04b889
prs:
  - https://github.com/tpals0409/AlgoSu/pull/220 (PR #1 — Regex 강건성 RUNBOOK + Agent cross-ref, 시드 #13, Critic 미호출)
  - https://github.com/tpals0409/AlgoSu/pull/221 (PR #2 — Recording rule+Alert rule 라벨 정합 검증, 시드 #11, Critic R1+R2 P2 1건 해소)
  - https://github.com/tpals0409/AlgoSu/pull/222 (PR #3 — Dashboard 구조 3차원 검증, 시드 #12, Critic R1+R2+R3 P2 3건 해소)
related_sprints:
  - sprint-147 (회귀 차단 후속 확장 — Panel title + Variable usage 검증 — 본 스프린트 직접 확장 대상)
  - sprint-146 (회귀 차단 자동화 — Grafana metric/label 검증 entry point 원형)
  - sprint-145 (Prometheus Rules + Grafana Dashboard 검증 인프라 기반)
  - sprint-142 (Critic 다중 라운드 패턴 원형)
---

# Sprint 148 — Sprint 147 회귀 차단 후속 확장 — Recording rule 라벨 + Dashboard 구조 + Regex RUNBOOK

## 목표 & 배경

Sprint 147에서 `scripts/check-grafana-metrics.mjs`를 823라인으로 확장하여 dashboard의 **panel title ↔ metric 정합 + 미사용 변수** 차원을 추가했음. 본 스프린트는 Sprint 147 이월 자동화 후보 3건(시드 #11/#12/#13)을 묶음 처리한다:

1. **시드 #13 — Regex 강건성 RUNBOOK** (PR #220): Sprint 145~147에서 regex P2가 3 스프린트 연속 적발된 근본 원인 — PromQL/JavaScript 정규식 작성 시 공통 함정 4종(`|` 우선순위 / character class 불일치 / quantifier 처리 / prefix anchoring)을 사람의 주의력에 의존하던 구조를 **문서화된 체크리스트**로 차단. Agent cross-ref를 `.claude/commands/agents/`에 추가하여 리뷰 시 RUNBOOK 참조를 명문화.

2. **시드 #11 — Recording rule 라벨 정합 검증** (PR #221): `prometheus-rules.yaml`의 `record:` + `alert:` 표현식에서 사용된 라벨이 service code SSOT의 정의된 라벨과 정합하는지 자동 검증. YAML block scalar modifier(`|`/`|-`/`>` 등) 전 6종 지원. 외부 metric(`up`/`rabbitmq_*`/`kube_*`/`container_*`) skip 정책 명시화.

3. **시드 #12 — Dashboard 구조 검증** (PR #222): dashboard JSON의 datasource 일관성(Prometheus uid 강제) + 빈 targets panel 검출 + duplicate panel id 검출을 3차원으로 동시 검증. Loki(uid=loki) 면제 정책. target.datasource null = panel 상속(skip)과 variable.datasource null = top-level(violation)의 정책 분기를 JSDoc + 인라인 주석으로 명문화.

Sprint 145 metric → Sprint 146 label → Sprint 147 panel-title+variable → **Sprint 148 rule-label+dashboard-structure** 누적 차원 확장 패턴 5차원째.

## PR 단위 요약

### PR #220 — `docs/runbook-regex-robustness.md` 신규 (시드 #13)

- **변경**: `docs/runbook-regex-robustness.md` 신규 260라인 7섹션
- **내용**:
  - §1 배경: Sprint 145~147 regex P2 3건 누적 사례 분석
  - §2 체크리스트 4종: `|` 우선순위 / character class 일관성 / quantifier 처리 / prefix anchoring
  - §3 PromQL 관용 패턴 SSOT (label selector 마스킹 / `__name__` selector / union vs wildcard)
  - §4 JavaScript 정규식 관용 패턴 (sticky flag 주의 / source property / unicode)
  - §5 자동화 후보 목록 (Sprint 149+ 시드 #17 — lint rule 후보)
  - §6 과거 사례 인용 (Sprint 145~147 P2 세 건 상세)
  - §7 참조 링크
- **Agent cross-ref**: `.claude/commands/agents/critic.md` + `architect.md`에 RUNBOOK 참조 추가 (gitignored 로컬 전용)
- **Critic**: 미호출 (docs-only, Auto-Critic 제외 대상)
- **CI**: docs-only → 대부분 SKIPPED, mergeStateStatus CLEAN

### PR #221 — Recording rule + Alert rule 라벨 정합 검증 (시드 #11)

- **변경**: `scripts/check-grafana-metrics.mjs` 842→1023→1036라인 (+189 -1)
- **신규 함수 3개**:
  - `extractRulesWithExpr(yamlContent)` — YAML block scalar modifier `|`/`|-`/`|+`/`>`/`>-`/`>+` 전 6종 지원하여 record/alert 표현식 추출
  - `validateRuleExprLabels(expr, definedLabels, metricName)` — 추출된 PromQL 표현식의 라벨이 service code SSOT에 정의된 라벨 집합에 포함되는지 검증
  - `collectRecordingRuleExprViolations(rulesYaml, definedLabels)` — 전체 rules YAML에 대해 violations 수집
- **외부 metric skip 정책**: `up`/`rabbitmq_*`/`kube_*`/`container_*` 패턴 — Sprint 145 정책(service code SSOT 외 metric) 일관성 계승
- **baseline**: 15 rule pairs / 5 external skipped / 0 violations
- **Critic R1+R2**: R1 P2 1건(YAML block scalar modifier `|-`/`>` 미인식 → false negative) → fix(전 6종 지원으로 확장) → R2 클린 통과 ✅ ("no discrete introduced bug")
- **CI**: SUCCESS, mergeStateStatus CLEAN

### PR #222 — Dashboard 구조 3차원 검증 (시드 #12)

- **변경**: `scripts/check-grafana-metrics.mjs` 1030→1286→~1295라인 (+293 -2)
- **신규 함수 4개**:
  - `checkDatasourceAllowed(datasource, context)` — Prometheus(uid=prometheus) 강제, Loki(uid=loki) 면제, 그 외 violation
  - `isPanelTargetsEmpty(panel)` — targets 배열 없거나 빈 경우 검출
  - `walkPanelsForStructural(panels, violations, context)` — 재귀적 panel 순회 (row type → sub-panels 포함)
  - `collectDashboardStructuralViolations(dashboards)` — 3차원(datasource/empty-targets/duplicate-id) violations 수집
- **Loki 면제 정책**: `uid=loki` datasource는 logging 전용으로 면제
- **target vs variable null 정책 분기**:
  - `target.datasource === null` → panel 상속 = Grafana 표준 동작 → skip
  - `variable.datasource === null` → top-level 변수는 상속 의미 없음 → violation
  - 근거 JSDoc + 인라인 주석 양쪽 명문화
- **baseline**: 41 panels / 3 dashboards / 0 violations
- **Critic R1+R2+R3**:
  - R1 P2 2건: (1) target-level datasource override 미검증 (panel datasource가 override될 때 target datasource가 다른 source를 가리킬 수 있음) / (2) variable null skip false negative (variable.datasource null = top-level이라 violation)
  - R2 P2 1건: (1) R1 fix로 target.datasource null 체크 추가 → target null = panel 상속 false positive 위험 (skip이 맞음)
  - R3 클린 통과 ✅ ("no discrete regression introduced — target null skip is correct per Grafana spec")
- **CI**: SUCCESS, mergeStateStatus CLEAN

## 신규 패턴

### 1. 회귀 차단 본질 누적 차원 확장 — 5차원째

단일 entry point `scripts/check-grafana-metrics.mjs`의 검증 차원 누적:
- Sprint 145: metric name (service code ↔ dashboard expr)
- Sprint 146: label name (TS labelNames + Python labelnames ↔ dashboard expr labels)
- Sprint 147: panel title keyword + dashboard variable
- **Sprint 148: rule expression label + dashboard structure (datasource/empty/duplicate-id)**

결과: 823라인(Sprint 147 end) → 1036라인(시드 #11) → ~1295라인(시드 #12). CI job 추가 부담 0.

### 2. YAML block scalar modifier 전 6종 지원

Kubernetes ConfigMap에서 multi-line PromQL을 embed할 때 `|` 외에 `|-`/`|+`/`>`/`>-`/`>+` 5종이 관행적으로 사용됨. `extractRulesWithExpr()`는 6종 모두 지원하도록 설계:
- `|` (literal, trailing newline 보존)
- `|-` (literal, trailing newline strip) ← Critic R1 P2 적발 대상
- `|+` (literal, trailing newlines 보존)
- `>` (folded, trailing newline 보존)
- `>-` (folded, trailing newline strip) ← Critic R1 P2 적발 대상
- `>+` (folded, trailing newlines 보존)

RUNBOOK §2.2 character class 일관성 체크리스트의 **직접 적용 사례** (Sprint 147 regex P2 패턴이 즉시 방어됨).

### 3. target vs variable null 정책 분기 (PR #222 Critic 교훈)

- `panel.datasource = null` → panel이 dashboard default datasource를 상속 → Grafana 표준 동작 → **skip**
- `target.datasource = null` → target이 panel datasource를 상속 → Grafana 표준 동작 → **skip**
- `variable.datasource = null` → top-level 변수는 상속 체인의 시작 → 의미 없는 null → **violation**

정책 차이 근거를 JSDoc + 인라인 주석 **양쪽** 명문화. 미래 운영자가 null 처리 정책을 바꿀 때 반드시 두 곳을 모두 확인하도록 강제.

### 4. 외부 exporter metric skip 정책 명시화

Sprint 145에서 도입한 service code SSOT 원칙의 일관성 계승:
- `up` — Prometheus 기본 target health metric
- `rabbitmq_*` — RabbitMQ exporter (외부 의존)
- `kube_*` — kube-state-metrics exporter (외부 의존)
- `container_*` — cAdvisor exporter (외부 의존)

Sprint 148 기준 이 4개 패턴 외의 `algosu:*` recording rule은 service code SSOT에서 정의되어야 함.

### 5. Critic 3 라운드 패턴 재확인

Sprint 142(5라운드) → Sprint 146(3라운드) → Sprint 147(2라운드) → Sprint 148 PR #222(3라운드):
- R1 fix가 R2에서 새 P2를 유발하는 패턴 재현 (target override 추가 → target null false positive)
- 정책 분기 시 모든 코너 케이스(null/undefined/override)를 동시 검토하지 않으면 R2 P2 유발
- **R3 클린 임계값 재확인**: "discrete introduced bug 없음 + 단순 1줄 null-skip 추가"

## 교훈

### 1. R1 fix가 R2에서 새 P2를 유발할 수 있음

PR #222 R1 P2-1(target-level datasource override 미검증) → fix(target.datasource !== null 체크 추가) → R2 P2(target.datasource null = panel 상속 = skip인데 violation으로 처리하는 false positive). **정책 분기 코너 케이스(null/undefined/override)를 fix 시 모두 동시 검토 의무화**.

### 2. YAML block scalar modifier 7종은 검증 스크립트 6종 전 지원 의무

Prometheus 운영자가 `|` 대신 `|-` 또는 `>-`를 사용하면 `extractRulesWithExpr()`가 silent skip하여 검증 대상 외로 처리. **미래 규칙 추가 시 modifier 타입을 의식적으로 선택하거나, 스크립트 갱신 의무를 ADR에 명시**.

### 3. `.claude/` gitignored — agent cross-ref 수정은 로컬 전용

`.claude/commands/agents/` 디렉토리는 `.gitignore`에 포함되어 git tracked 안 됨. PR #220에서 critic.md/architect.md에 RUNBOOK cross-ref를 추가했으나 다른 머신/팀원에게 동기화 안 됨. **Sprint 149+ 시드 후보 #16**: `.claude/commands/`만 tracked로 전환하는 `.gitignore` 정책 검토.

### 4. Regex 강건성 체크리스트 = 자동화 후보 강화 (3+1 스프린트 누적)

Sprint 145~147 regex P2 3건 + Sprint 148 PR #221 R1 P2(block scalar modifier `|-`/`>` 미인식) 4건 누적. RUNBOOK 체크리스트가 사람의 주의력에 의존하는 한 재발 가능. **시드 #17**: ESLint custom rule 또는 custom regex linter로 4종 패턴 정적 검출 자동화.

## Sprint 149 이월 시드 (총 6건)

### UAT 사용자 직접 (Sprint 143~148 누적, Oracle 작업 외)
- **시드 #5**: 프로그래머스 재제출 채점 통과 확인 (사용자 직접 UAT, 5 스프린트 누적)
- **시드 #9**: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합 확인 (사용자 직접 UAT, Sprint 146 회귀 차단망 구축 완료)

### 자동화 / 인프라 (Oracle 작업 대상)
- **시드 #14**: ai-analysis problem context 후속 (Sprint 143 PR #200 미해소 — frontend에서 problem context 활용 / submission 응답 schema 확장 / saga payload 흐름 검증)
- **신규 시드 #15**: `extractInlineBlock()` 비대칭 처리 — 상위 호출자가 `includes(${key}: |)` 만 매치, `>`/`|-` 등 미검출 (Critic R2 추가 관찰, 현재 회귀 없음, 향후 점진적 개선 후보)
- **신규 시드 #16**: `.claude/` gitignore 정책 검토 — `.claude/commands/`만 tracked로 전환하여 agent cross-ref 다중 머신 동기화 가능
- **신규 시드 #17**: regex 강건성 lint 룰 자동화 — RUNBOOK §4 체크리스트 정적 검출 (Sprint 145~148 P2 4건 누적 → 자동화 후보 강화)

## 검증 결과

| PR | CI checks | mergeStateStatus | Critic |
|----|-----------|-----------------|--------|
| #220 (시드 #13) | SKIPPED (docs-only) | CLEAN | 미호출 |
| #221 (시드 #11) | SUCCESS | CLEAN | R1 P2 1건 → R2 클린 ✅ |
| #222 (시드 #12) | SUCCESS | CLEAN | R1 P2 2건 → R2 P2 1건 → R3 클린 ✅ |

- `scripts/check-grafana-metrics.mjs` 최종 라인: ~1295라인
- baseline (Sprint 148 end): 204 metrics / 32 strict / 15 wildcard / 124 labels / 41 panel title pairs / 2 vars / **15 rule pairs** / **5 external skipped** / **0 violations**

## 브랜치 규율

- **3 PR 모두 신규 브랜치 + Squash merge**
- **14 스프린트 연속 준수** ✅ (Sprint 134 위반 이후), main 직접 commit 0건
- PR #220: `docs/sprint-148-regex-runbook` → Squash merge
- PR #221: `feat/sprint-148-rule-label-validation` → Squash merge
- PR #222: `feat/sprint-148-dashboard-structure` → Squash merge

## ADR 참조

- 본 ADR: `docs/adr/sprints/sprint-148.md`
- Sprint 147 ADR: `docs/adr/sprints/sprint-147.md` (Panel title + Variable 직접 확장 원형)
- Sprint 146 ADR: `docs/adr/sprints/sprint-146.md` (회귀 차단 자동화 — label 차원 원형)
- Sprint 145 ADR: `docs/adr/sprints/sprint-145.md` (Prometheus/Grafana 검증 인프라 기반)
- RUNBOOK: `docs/runbook-regex-robustness.md` (Sprint 148 신규)
