---
sprint: 141
title: 이월 시드 일괄 정리 — 인프라 부채 해소 + 운영 자동화 보강
status: completed
period: 2026-05-07 ~ 2026-05-08
start_commit: 2e37d1d
end_commit: fc18639
prs:
  - https://github.com/tpals0409/AlgoSu/pull/190 (그룹 A — docs/infra housekeeping)
  - https://github.com/tpals0409/AlgoSu/pull/191 (그룹 B-1 — github-worker WeakSet)
  - https://github.com/tpals0409/AlgoSu/pull/192 (그룹 B-2 — ai-analysis CB schema + monitoring)
  - https://github.com/tpals0409/AlgoSu/pull/193 (그룹 C — calendar locale)
  - https://github.com/tpals0409/AlgoSu/pull/194 (그룹 D-1 — PR pre-flight checklist)
  - https://github.com/tpals0409/AlgoSu/pull/195 (그룹 D-2 — Oracle PATH runbook)
  - https://github.com/tpals0409/AlgoSu/pull/196 (그룹 D-3 — E2E 라벨 트리거)
related_sprints:
  - sprint-134 (E2E 자동 PR CI 통합 — 7 스프린트 누적 이월 마감)
  - sprint-135 (CB 인프라 — github-worker WeakSet 백포팅 + ai-analysis schema 통일 시드 발행)
  - sprint-139 (Oracle PATH P1 + react-day-picker 회귀 패턴 시드 발행)
  - sprint-140 (sealed-secrets/ outdated + ADMIN_EMAILS runbook 시드 발행)
---

# Sprint 141 — 이월 시드 일괄 정리

## 컨텍스트

Sprint 134~140 누적 이월 시드 9건이 누적된 상태로 Sprint 141 진입. 시드별 성격이 매우 다양 (인프라/문서/코드 정합성/CI 정책)하여 단일 PR 묶음 대신 **그룹별 PR 분할 전략**으로 진행:

| 그룹 | 시드 | 성격 |
|------|------|------|
| A | #3 #4 #8 | docs/infra housekeeping (저위험) |
| B-1 | #6 | github-worker 코드 정합성 (Critic 호출) |
| B-2 | #7 | ai-analysis CB schema 통일 + monitoring 갱신 (Critic 호출) |
| C | #5 | frontend i18n (UI) |
| D-1 | #2 | PR pre-flight 정책 |
| D-2 | #1 | Oracle 인프라 (외부 파일) |
| D-3 | #9 | E2E CI 정책 |

## 결정

### 그룹별 PR 분할 + 병렬 진행
- 7개 PR을 모두 main에서 직접 fork → 병렬 진행 (각 그룹 의존성 0)
- Critic 호출 정책: 코드 변경(B-1, B-2, C) + 사용자 입력 흐름 변경 시에만 호출. 문서/인프라 정리(A, D-1, D-2, D-3)는 Sprint 131~138 동일 정책으로 미호출

### 그룹 A — sealed-secrets/ 옵션 A 채택
- aether-gitops를 SSoT로, AlgoSu 본 레포 `infra/sealed-secrets/generated/`는 historical artifact (ArgoCD watch 대상 아님) → **디렉토리 제거** 결정
- README에 SSoT 위치 명시
- 옵션 B (디렉토리 유지 + outdated 경고)는 SSoT 충돌 잔존 위험으로 기각

### 그룹 B-2 — schema 변경 시 운영 stack 동시 갱신
- ai-analysis CB schema 변경 시 다음 4개 소비자를 **단일 PR**에서 동시 갱신:
  1. `prometheus-rules.yaml` — `CircuitBreakerOpen` alert (`state==1` → `state==2`)
  2. `grafana-cb-dashboard.yaml` — Python panel 2개
  3. `grafana-service-dashboard.yaml` id=13
  4. `grafana-slo-dashboard.yaml` id=11
- Critic 1차에서 4개 소비자 중 alert(P0) + 2개 dashboard(P1) 미반영 적발 → 동일 PR에 fix-up 추가
- legacy unlabeled series 차단을 위해 `{name=~".+"}` matcher 적용 (transitional 안전성)

### 그룹 C — useLocale 동적 매핑 + ko fallback
- `props.locale` (override) → `LOCALE_MAP[currentLocale]` → `ko` fallback의 3단 우선순위
- routing.ts에 locale 추가 시 LOCALE_MAP 미갱신이어도 ko fallback 안전 (defensive default)

### 그룹 D-2 — repo 외부 파일은 runbook으로 보존
- `~/.claude/oracle/bin/oracle-spawn.sh`는 git 추적 대상 아님 → 본 머신 직접 적용 + 변경 절차/패치 코드를 `docs/runbook-oracle-tmux-path.md`로 보존
- 다른 머신/재구성 시 동일 패치 적용 가능

### 그룹 D-3 — E2E full integration opt-in 정책
- `e2e-programmers`는 모든 PR 자동 실행 (~3분, 이미 통합)
- `e2e-test` (full, ~10분)는 비용 부담 → `run-e2e-full` 라벨 부착 시에만 자동 실행 (큰 변경 명시 트리거)

## 패턴

### Critic 호출 정책 강화 — schema 변경 시 운영 소비자 일괄 점검
schema/메트릭 라벨 변경 시 다음 4개 카테고리 소비자를 모두 점검:
1. **Alert rule** (prometheus-rules.yaml) — 임계값 비교 로직
2. **Grafana dashboard** — mappings/thresholds/queries
3. **Recording rules** — derived metric 정의
4. **Application code** — 직접 metric set/labels 호출

Critic 1차가 P0(alert 오발화) + P1 2건(stale dashboards) 적발 → schema 변경 시 단일 코드 파일 검증으로는 부족하다는 강력한 신호.

### Transitional 호환성 — `{name=~".+"}` matcher 패턴
Prometheus label 추가 시 legacy unlabeled series가 새 mapping에서 잘못 해석되는 회귀 차단. 모든 dashboard/alert 쿼리에 `{name=~".+"}` 또는 `{name=~"$name"}` matcher 추가 → labeled series만 매치.

### 외부 파일 변경의 PR 보존 패턴
git 추적 대상이 아닌 파일(`~/.claude/`, `/etc/`, sealed cluster cert 환경) 변경 시:
1. 본 머신/환경 직접 적용 (Bash/Edit)
2. repo 내 runbook으로 절차/패치 코드 보존 (PR 머지 가능)
3. PR body에 "외부 파일 변경 사실" 명시

## 교훈

### Critic 6 라운드 — 운영 회귀 사전 차단의 정량적 가치
- 6 라운드 호출(B-1: 2 / B-2: 3 / C: 1)에서 **P0 1건 + P1 2건 + P2 3건** 적발 및 해소
- B-2 P0(alert state==1 → state==2)는 prod 배포 시 **HALF_OPEN에서 critical alert 오발화 + 실제 OPEN에서 alert 미발화** 회귀를 사전 차단 — Critic 호출의 정량적 ROI 입증
- 단일 코드 파일(`metrics.py`) 검증만으로는 절대 발견 불가능했던 운영 stack 정합성 이슈

### 의존성 major 회귀 패턴은 정책으로만 차단 가능
- Sprint 139/140에서 react-day-picker v8→v9 미대응 회귀 5건 발생 (className 매핑 8개 + root relative 누락 + locale 영문 + nav 위치 + 클릭 불가)
- tsc/lint clean이어도 잡히지 않는 className/CSS/i18n 회귀
- Sprint 141에서 PR pre-flight checklist 정책화 — 사용자 시각 검증을 명시 단계로 끌어올림

### 7 스프린트 연속 브랜치 규율 준수
Sprint 134 main 직접 push 위반 이후 Sprint 135~141 모두 신규 브랜치 + PR + Squash merge 경로 준수 (총 7 스프린트). 본 스프린트는 7 PR로 단일 스프린트 최다 PR 갱신 — 분할 전략이 규율 준수와 양립 가능함을 입증.

### 이월 시드 누적 패턴 — 정기 정리 스프린트의 가치
- Sprint 134부터 시드 누적 (E2E PR CI), Sprint 135 (CB 패턴 동기화), Sprint 137 (작은 housekeeping), Sprint 139/140 (Oracle PATH + sealed-secrets)
- Sprint 141 단일 스프린트로 9건 일괄 처리 — 누적된 부채를 잘게 분할(7 PR)하여 머지 부담 분산
- 다음 정기 정리 스프린트 권장 주기: 5~7 스프린트마다 또는 누적 시드 8건 도달 시

## 후속 처리

### 사용자 시각 검증 (Sprint 142+)
- 그룹 C: 영문 환경에서 캘린더 영문 월/요일 표시 확인 (en locale 동적 매핑 동작 검증)
- 그룹 B-2 운영 검증: production 배포 후 Grafana CB dashboard에서 ai-analysis Python CB 정상 표시 + alert 정합 확인

### Sprint 142+ 시드
- **Calendar provider 의존성 방어** (Sprint 141 그룹 C P2): NextIntlClientProvider 외부 사용 가능성에 대한 방어 로직 + 실컴포넌트 테스트 (현재 사용처 한정 안전)
- **prometheus-rules / dashboard 자동 검증 CI** (Sprint 141 그룹 B-2 교훈): schema 변경 시 소비자 자동 점검 lint 도입 가능성 검토
- **E2E full integration UX 보강** (그룹 D-3 후속): 라벨 부착 시 자동 코멘트 + 실패 시 로그 링크 자동 작성

## 산출물

### 코드 변경
- `services/github-worker/src/circuit-breaker.ts` — errorFilter wrapper + WeakSet 마커 (+47/-7)
- `services/github-worker/src/circuit-breaker.spec.ts` — 회귀 보호 테스트 3건 (+108/-2)
- `services/ai-analysis/src/metrics.py` — schema + name label (+22/-7)
- `services/ai-analysis/tests/test_metrics.py` — Gauge 값 직접 검증 + wiring 테스트 (+58/-9)
- `frontend/src/components/ui/calendar.tsx` — useLocale 동적 매핑 (+24/-7)

### 인프라/CI 변경
- `infra/k3s/monitoring/prometheus-rules.yaml` — alert state==2 + name matcher
- `infra/k3s/monitoring/grafana-cb-dashboard.yaml` — Python panel 2개 schema 통일 + templating 변수 정규식 확장
- `infra/k3s/monitoring/grafana-service-dashboard.yaml` id=13 — schema 통일
- `infra/k3s/monitoring/grafana-slo-dashboard.yaml` id=11 — schema 통일
- `infra/sealed-secrets/generated/` — 12 파일 제거 (outdated artifact)
- `.github/workflows/ci.yml` — e2e-test 라벨 트리거 추가
- `.github/pull_request_template.md` — 의존성 major 체크리스트 섹션 신규

### 문서
- `CLAUDE.md` — `ai-feedback` → `ai-analysis` 명명 정정
- `docs/runbook-admin-emails.md` — 신규 (Sprint 140 운영 작업 절차화)
- `docs/runbook-dependency-major-upgrade.md` — 신규 (의존성 major 5단계 가이드)
- `docs/runbook-oracle-tmux-path.md` — 신규 (Oracle PATH 패치 절차)
- `docs/runbook-e2e-pr-label.md` — 신규 (E2E 라벨 트리거 가이드)
- `infra/sealed-secrets/README-sealed-secrets.md` — SSoT 위치 명시

### Critic 검증 합계
- B-1 (PR #191): 2 라운드 (P2 1건 → 회귀 보호 테스트 + 코멘트 정정)
- B-2 (PR #192): 3 라운드 (P0 1건 alert + P1 2건 stale dashboards + P2 1건 wiring → 모두 해소)
- C (PR #193): 1 라운드 (P2 1건 비차단 — provider 의존성)
- 총 6 라운드 / P0 1 + P1 2 + P2 3 = **6건 적발 후 모두 해소**
