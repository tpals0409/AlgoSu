---
sprint: 147
title: Sprint 146 회귀 차단 후속 확장 — Panel title + Variable usage 검증
status: completed
period: 2026-05-12 (단일 일자)
start_commit: 7fca904
end_commit: 9d303ac
prs:
  - https://github.com/tpals0409/AlgoSu/pull/217 (PR #3 — Sprint 144~146 ADR 일괄 housekeeping, Critic 미호출)
  - https://github.com/tpals0409/AlgoSu/pull/218 (PR #1 — Panel title ↔ metric 정합 검증, Critic R1+R2 P2 3건 해소)
  - https://github.com/tpals0409/AlgoSu/pull/219 (PR #2 — Dashboard 변수 미사용 검출, Critic R1+R2 P2 1건 해소)
related_sprints:
  - sprint-146 (회귀 차단 자동화 — Grafana metric/label 검증 entry point 직접 확장 대상)
  - sprint-145 (Prometheus Rules + Grafana Dashboard 검증 인프라 — 본 스프린트 누적 차원 확장 기반)
  - sprint-144 (회귀 차단 자동화 — Critic 적발 패턴 → CI 자동화 후보 원형)
  - sprint-141 (그룹 분할 PR 패턴 — 본 스프린트 3 PR 분할 직접 적용)
  - sprint-142 (Critic 다중 라운드 패턴 원형)
---

# Sprint 147 — Sprint 146 회귀 차단 후속 확장 — Panel title + Variable usage 검증

## 컨텍스트

Sprint 146에서 `scripts/check-grafana-metrics.mjs`를 553라인으로 확장하여 dashboard expr의 **metric name + label name** 정합성을 service code SSOT 기준으로 자동 검증하는 인프라를 구축했음 (PR #209). 본 스프린트는 동일한 entry point에 **검증 차원을 누적**하는 Sprint 146 패턴을 그대로 계승하여:

1. **Panel title ↔ metric 정합성**: panel 이름 리팩토링 시 expr 미갱신 회귀를 사전 차단 (예: "Circuit Breaker State" panel 유지 + expr만 `algosu_*_http_requests_total`로 교체 시 검출)
2. **사용되지 않는 dashboard 변수 검출**: 변수 정의 후 expr 삭제 시 발생하는 고아 변수를 사전 차단
3. **ADR housekeeping**: git tree에 누적된 Sprint 144~146 untracked ADR 부채 일괄 머지

이월 시드 2건(시드 #5 UAT 프로그래머스 / 시드 #9 UAT 시각 정합)은 **본질적으로 사용자 환경 의존**이라 Oracle 작업 대상 외 — Sprint 143~147 누적 이월. Sprint 146의 "UAT → 자동 검증 구조 전환" 패턴대로 회귀 시드는 본 스프린트로 차단망 추가 완료.

3 PR 분할 패턴(Sprint 141 그룹 분할 직접 적용)으로 squash merge 종료.

## 결정

### 1) Scope 결정 (B+ADR housekeeping = C안)
- 사용자 선택: C안 (Panel title + Variable usage + ADR housekeeping)
- 후보 D안(+ Recording rule 라벨 검증)은 현재 결함 0건 + ROI 낮음 → Sprint 148+ 시드로 보류

### 2) Panel title ↔ metric 매칭 알고리즘 = Keyword whitelist
- 사용자 선택: 명시적 keyword 사전(`PANEL_TITLE_KEYWORD_MAP`) 기반 매칭
- 대안 (Substring lax / Panel-level annotation)은 false positive 위험 또는 마이그레이션 비용 큼
- **신규 panel 추가 시 본 SSOT를 명시적으로 확장 의무** — JSDoc 주석으로 명문화

### 3) Plan의 "scribe" 매핑 → 실제 "architect" 재라우팅
- 초기 plan은 PR #1/#2를 scribe에 위임했으나 Scribe가 즉시 거부 ("문서/메모리/Skill만 담당, 코드 작성 금지")
- 재라우팅: `scripts/check-grafana-metrics.mjs`는 CI 파이프라인 + Grafana monitoring 도메인 → **Architect** (`.claude/commands/agents/architect.md`의 "GitHub Actions CI 파이프라인 + Prometheus/Grafana" 책임)
- **결정**: plan의 에이전트 매핑은 도메인 매뉴얼 cross-check 필수. 향후 plan 단계에서 `.claude/commands/agents/{name}.md`의 책임 범위를 명시적으로 확인.

### 4) Critic 호출 정책
- PR #1: Auto-Critic 2회 (R1 + 재commit 후 R2 = 사실상 R2 강제 호출) — 정규식 매칭 + 신규 SSOT 도입으로 다중 라운드 정당화 (Sprint 146 학습)
- PR #2: 초기 plan은 "Critic 미호출" 명시였으나 Auto-Critic이 자동 큐잉 → P2 1건 적발. 즉시 fix + Auto-Critic R2 클린 통과
- PR #3: 코드 변경 0건 → Critic 미호출 (Sprint 141 동일 정책)

### 5) DIRTY mergeStateStatus 동시 해소 정책 (신규)
- PR #2 (PR #219)는 첫 push 시 `mergeStateStatus: DIRTY` 발생 (PR #218 머지로 main 갱신 → 브랜치 stale)
- **결정**: Critic R1 P2 fix와 main rebase를 **단일 dispatch로 묶어** cycle time 단축. force-with-lease push로 PR 갱신.

## 패턴

### 회귀 차단 본질의 누적 차원 확장 (Sprint 145~146 패턴 계승)
- 단일 entry point `check-grafana-metrics.mjs`에서 검증 차원 누적:
  - Sprint 145: metric name (service code ↔ dashboard expr)
  - Sprint 146: label name (TS labelNames + Python labelnames ↔ dashboard expr labels)
  - **Sprint 147: panel title + dashboard variable**
- 결과: 553라인 (Sprint 146 end) → 741라인 (시드 #1) → 823라인 (시드 #2). CI job 추가 부담 0 (`quality-monitoring` job 그대로).

### Plan 가정 깨짐 즉시 보고 + 재라우팅
- Sprint 146에서 도입한 "탐색 단계에서 plan 가정 깨졌을 때 진행보다 보고 우선" 원칙을 **Scribe 도메인 거부** 시점에 적용. 즉시 architect로 재라우팅 결정 → 머지 cycle 영향 0.
- 일반화: 에이전트가 작업을 거부할 때(`status: failed`로 inbox 회신) Oracle은 (a) 도메인 재라우팅 (b) 작업 범위 조정 (c) 사용자 결정 중 선택. 본 스프린트는 (a) 선택.

### Critic 다중 라운드 R2 강제 → R3 미호출 임계값
- Sprint 146 패턴 ("R2 강제 호출, R3는 P2 잔존 시")을 PR #1에 적용
- R2 Codex 판정: "no discrete regression introduced" → R3 미호출 (R3 클린 임계값 = "discrete introduced bug 없음")
- **임계값 명시화**: R2 결과가 "신규 도입 결함 없음 + 기존 결함 모두 해소" 두 조건 동시 충족 시 R3 미호출

### Regex 강건성 P2 패턴 누적 (Sprint 145 → 147)
- Sprint 145 P2: dashboard regex `__name__=~` selector 통째 마스킹 → false negative
- Sprint 146 P2: `5[0-9]{2}` quantifier가 selector wrapper 정규식 끊음
- **Sprint 147 P2-2**: `/algosu:[a-z_:]*availability|success_rate/` 연산자 우선순위로 `success_rate`가 prefix 없이 단독 매칭 → future false negative
- **공통 패턴**: PromQL/dashboard 정규식 작성 시 (a) `|` 우선순위 (b) character class 일관성 (c) quantifier 처리 (d) prefix anchoring 4가지를 매번 점검. 시드 누적 → Sprint 148+ "regex 강건성 lint 룰" 고려 가능.

### 검증 대상 외 panel의 silent skip 정책 + JSDoc 주의 명문화
- `PANEL_TITLE_KEYWORD_MAP`에 등록되지 않은 panel은 `matchedKeywords.length === 0` 조건으로 silent skip
- 이 정책의 함정: SLO dashboard "Claude API Request Rate" panel처럼 실제 `algosu_*` metric을 참조하지만 keyword 미등록 시 검증 대상 외로 빠짐 → **Critic R1에서 즉시 적발 + 'request rate' 추가 fix**
- **신규 panel 추가 시 본 SSOT를 명시적으로 확장 의무**를 JSDoc 주석으로 명문화 (운영 문서화)

### Grafana 포맷 구문 인식 정규식 (PR #2 P2)
- Grafana multi-value 변수는 `${service:regex}` / `${name:pipe}` / `${name:csv}` 포맷으로 panel expr에 주입
- `extractVariableReferences()` 정규식에 `(?::[^}]*)?` optional capture 추가하여 colon + format specifier 부분 인식
- 현재 dashboard 3개에서 미사용이지만 향후 도입 시 false positive 차단

## 교훈

### 1. Plan의 에이전트 매핑은 도메인 cross-check 필수
- 본 스프린트 plan은 "scribe"에 PR #1/#2를 위임했으나 Scribe는 코드 작성 금지가 명시된 도메인
- 향후 plan 단계: `.claude/commands/agents/{name}.md`의 `## 역할 & 핵심 책임` + `## 금지 사항` 섹션 확인 의무
- 회귀 차단: plan 작성 시 에이전트 도메인 매뉴얼 1줄 인용

### 2. Auto-Critic은 plan의 "Critic 미호출" 명시와 무관하게 자동 큐잉됨
- PR #2 plan은 "Critic 미호출"이었으나 code-changing 에이전트가 commit하면 `oracle-auto-critic.sh`가 자동 트리거 (`_base.md` Sprint 117~ 정책)
- 결과적으로 P2 1건 적발 + 즉시 해소 → 회귀 차단 본질에 이로움
- **교훈**: plan의 Critic 호출 정책은 "수동 R2 추가 호출 여부"만 영향. Auto-Critic은 기본값으로 모든 code-changing 작업에 적용.

### 3. DIRTY merge state는 단순 base mismatch만 의미하지 않음
- PR #219 DIRTY는 base가 main 자체로 따라가지만 브랜치 stale (PR #218 머지 결과 미반영)
- gh API는 `baseRefOid: be76c43`(main 최신)을 정확히 표시하나 mergeable 계산은 브랜치 stale 감지
- **교훈**: 연속 PR 분할 시 N+1번째 PR은 N번째 머지 후 main rebase 필수. P2 fix와 함께 묶어 dispatch하면 cycle time 절약.

### 4. 회귀 시드 누적 → CI 자동화 후보 식별 신호
- Sprint 144 PR #205 (mock coverage CI script): Critic 적발 패턴 → 자동화
- Sprint 145~146 PR #207~209 (prometheus + grafana 검증): 누적 시드 → 자동화
- **Sprint 147 신규 시드 후보**: regex 강건성 P2가 3 스프린트 연속 발견 → Sprint 148+ "regex 강건성 lint 룰" 또는 정규식 작성 가이드 RUNBOOK 후보

## 시드 (Sprint 148+ 이월)

### UAT 사용자 직접 (Sprint 143~147 누적, 본 스프린트 작업 외)
- **시드 #5**: 프로그래머스 재제출 채점 통과 확인 (사용자 직접 UAT)
- **시드 #9**: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합 확인 (사용자 직접 UAT)
- 회귀 시드는 본 스프린트와 Sprint 146 자동 차단망으로 차단 완료. UAT 자체만 사용자 책임.

### 자동화 후보 (Sprint 148+ Oracle 작업 대상)
- **신규 시드 #11**: Recording rule (`algosu:*`) 라벨 정의 ↔ service code 정합 검증 (현재 결함 0건, 선제적, 난이도 Low)
- **신규 시드 #12**: Dashboard datasource 일관성 + 빈 panel + 중복 panel id 검증 (현재 결함 0건, 선제적)
- **신규 시드 #13**: Regex 강건성 lint 룰 또는 정규식 작성 가이드 RUNBOOK (Sprint 145~147 P2 3건 누적 패턴 차단)
- **신규 시드 #14**: ai-analysis problem context 후속 (Sprint 143 PR #200 미해소 — frontend에서 problem context 활용 / submission 응답 schema 확장 / saga payload 흐름 검증)

## 검증

- 모든 PR: CI **28 SUCCESS / 11 SKIPPED**, mergeStateStatus CLEAN (force-with-lease push 후 재검증)
- `scripts/check-grafana-metrics.mjs` baseline 최종: 204 metrics / 32 strict / 15 wildcard / **124 labels** / **41 panel title pairs** / **2 vars / 0 unused**
- 회귀 시나리오: PR #1 4건 (시나리오 1: title 유지 + expr metric prefix 변경 / 시나리오 2: title-expr 도메인 mismatch / 시나리오 3: row type skip / 시나리오 4 Critic R1 후속: Claude API Request Rate panel TYPO expr 검출) + PR #2 1건 (templating.list unused_test_var 추가 → FAIL 검출) 모두 정상
- 브랜치 규율: **13 스프린트 연속 준수** ✅ — 3 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건 (Sprint 134 위반 이후)

## ADR 참조

- 본 ADR: `docs/adr/sprints/sprint-147.md`
- Sprint 146 ADR: `docs/adr/sprints/sprint-146.md` (회귀 차단 자동화 직접 확장 대상)
- Sprint 145 ADR: `docs/adr/sprints/sprint-145.md` (prometheus/grafana 검증 인프라 기반)
- Sprint 141 ADR: `docs/adr/sprints/sprint-141.md` (그룹 분할 PR 패턴 직접 적용)
