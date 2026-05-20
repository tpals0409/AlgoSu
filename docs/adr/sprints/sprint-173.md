---
sprint: 173
title: "PR deploy gate 시뮬레이션 + forward-fix PR 템플릿 (시드 #신규4/#신규5)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-164", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 173 — PR deploy gate 시뮬레이션 + forward-fix PR 템플릿 (시드 #신규4/#신규5)

## 목표

- Sprint 164 이월 CI 가시성 시드 2건 회수.
- **#신규4** — PR 단계에서 deploy gate 를 시뮬레이션하여 shift-left 가시성 제공: 어느 서비스가 deploy 될지(WOULD)/스킵될지(SKIP)를 main 머지 전에 PR Checks 에서 미리 노출.
- **#신규5** — aether-gitops push 실패 시 운영자가 즉시 붙여넣을 수 있는 forward-fix PR body 템플릿을 deploy summary 에 자동 생성.
- 시드 **#신규7**(`_parse_group_response` envelope 확장)은 Sprint 164 #신규3 의 raw 노출 차단 fix 를 건드릴 보안 회귀 위험이 있어 본 sprint 범위에서 분리 → Sprint 174 이월.

## 결정

### D0. deploy 게이트 fail-closed 판정 로직을 순수 헬퍼로 추출

deploy 게이트 fail-closed 판정 로직을 `scripts/ci/compute-deploy-gate.sh` 순수 헬퍼로 추출 → deploy job(main 전용)과 신규 deploy-simulation job(PR)이 동일 SSOT 를 공유. 근거: 동일 게이트를 두 곳에서 중복 구현하면 PR 시뮬레이션 예측과 실제 deploy 가 괴리될 위험 → 단일 헬퍼로 일치를 보장. 기존 helper 추출 패턴(Sprint 168 `report-build-metrics.sh`)을 답습.

### D1. 후보 목록(CANDIDATES) 계산은 헬퍼에 넣지 않음

후보 목록 계산은 GitHub Actions context(detect-changes outputs + build job result)에 의존하므로 헬퍼에 넣지 않음 — caller(ci.yml)가 계산해 인자로 전달. 헬퍼는 trivy-status 게이트 판정만 담당(단일 책임).

### D2. fail-closed 보존

각 후보의 `trivy-status/<svc>.txt` 가 정확히 `"pass"` 일 때만 UPDATED, 그 외(fail/missing/유사값) 전부 SKIPPED. Sprint 159 회귀 + Critic R1 P1 보안 게이트의 핵심 속성 — 헬퍼 추출 후에도 동일 보존.

### D3. PR 시뮬레이션 실현 가능 근거

trivy-scan job 이 PR 에서도 실행(Sprint 165 옵션 C, `if: !cancelled()`)되어 `trivy-status-<svc>` artifact 를 PR 에서도 업로드 → PR 시점에 시뮬레이션 입력(detect-changes/build 결과/artifact)이 전부 존재. 시뮬레이션 job 은 dry-run(clone/yaml 수정/push 없음) → Step Summary 출력만 수행.

### D4. #신규5 forward-fix 템플릿은 push 실패 분기에서만 출력

#신규5 는 deploy job 의 "Surface deploy summary" 의 push 실패 분기에서만 출력 — 운영자가 붙여넣을 forward-fix PR body(대상 image tag + kustomization overlays/prod 경로 + 실패 CI run 링크)를 `<details>` 접기 블록 + markdown 코드펜스로 생성. 정상 경로 동작은 불변.

### D5. detect-changes 필터 재활용

신규 헬퍼/테스트는 detect-changes 의 `ci-scripts` 필터(`scripts/ci/**` + `tests/ci/**` 글롭)에 이미 커버 → per-file 필터 추가 불필요. `quality-ci-scripts` job 에 테스트 실행 step 만 추가.

## 구현 (단일 PR, 브랜치 `feat/sprint-173-deploy-gate-visibility`)

### Phase A — 헬퍼 추출 + 단위 테스트 (Architect, commit `f7cda47`)

`feat(ci): compute-deploy-gate.sh 헬퍼 추출 + 단위 테스트 (Sprint 173 #신규4)`

- `scripts/ci/compute-deploy-gate.sh` 신규(58줄, fail-closed 순수 헬퍼, 헤더 어노테이션)
- `tests/ci/compute-deploy-gate-test.sh` 신규(순수 bash 7 케이스 19 assertion)

### Phase B — ci.yml 연동 + 시뮬 job + forward-fix (Architect, commit `3379f4d`)

`feat(ci): deploy 게이트 헬퍼 연동 + PR 시뮬 job + forward-fix 템플릿 (Sprint 173 #신규4/#신규5)`

- `quality-ci-scripts` job 에 테스트 실행 step 추가
- deploy job 의 `update_tags` 게이트 루프를 헬퍼 호출로 리팩토링 + 헬퍼 sparse-checkout step 추가(deploy job 은 AlgoSu repo 를 full checkout 하지 않고 aether-gitops 만 clone 하므로)
- deploy-simulation job 신규(PR 전용 `if: github.event_name == 'pull_request' && !cancelled()`, trivy-status-* 다운로드 continue-on-error, 헬퍼 dry-run → STEP_SUMMARY)
- #신규5 forward-fix 블록 추가

### Phase C — ADR 기록 (Scribe, 본 commit)

- `docs/adr/sprints/sprint-173.md` (KR) + `docs/adr-en/sprints/sprint-173.md` (EN 1:1)
- `docs/adr/README.md` count 111→112, range 62~171→62~173

## Critic 사이클

- **R1** (`codex review --base main`, codex-cli 0.130.0, 세션 ID `019e43cf-5c4e-7153-9dcc-1df410f5d5e9`): **P0/P1/P2/P3 0건 PASS** ✅ — "기능 회귀 없음, 머지 차단 버그 없음". deploy 게이트 동작 불변 + fail-closed 보존 확인.

## 위험/회귀 차단

### 예측 1: deploy 동작 불변
STATUS_DIR 정의/CANDIDATES 계산/python yaml 태그 수정/GITHUB_OUTPUT 기록이 전부 보존됨. 헬퍼는 절대경로(`$GITHUB_WORKSPACE/scripts/ci/...`) 호출이라 `cd aether-gitops/...` 후에도 동작. 헬퍼 출력은 leading space 가 남을 수 있으나 다운스트림이 어차피 xargs 로 정규화 → 동작 동일.

### 예측 2: 시뮬레이션 job production 무영향
시뮬레이션 job 은 PR 전용 + dry-run → production 무영향. docs-only PR(artifact 0건)도 continue-on-error + 방어적 mkdir 로 job 이 red 되지 않음.

### 예측 3: 헬퍼 회귀 차단
`quality-ci-scripts` 가 `scripts/ci/**` 또는 `tests/ci/**` 변경 시 19 assertion 실행 → 헬퍼 회귀 차단.

## 검증

### 로컬
- `bash tests/ci/compute-deploy-gate-test.sh`: 19/19 PASS (macOS, docker/GNU stat 미의존)
- `python3 yaml.safe_load(ci.yml)`: PASS
- shellcheck (헬퍼+테스트): CLEAN
- diff secret 스캔: 민감 패턴 0건
- fail-closed 엣지: missing→skip, 유사값(passed/PASS)→skip 단위 테스트로 검증

### CI (예상)
- PR CI 에서 `quality-ci-scripts`(19 assertion) success → deploy-simulation job 이 PR Step Summary 에 "Deploy preview" 출력
- `check-adr-en-coverage --strict` / `check-doc-refs` PASS 예상

### UAT 신규 (Sprint 173)
- 실 PR 에서 PR Checks 의 deploy-simulation job Step Summary 가 "🔮 Deploy preview" 로 WOULD deploy/SKIP 목록을 정확히 표시하는지 시각 확인

## 결과

- **머지**: origin/main `0739913` → `<TBD-MERGE-SHA>` (PR #<TBD>, squash merge)
- **순변경**: +304 -16 (신규 헬퍼+테스트+ci.yml 3파일)

## 신규 패턴

- **게이트 로직 SSOT 추출 → main/PR 양쪽 일치 보장**: deploy 결정 규칙을 헬퍼로 단일화하면 "PR 에서 본 예상"과 "실제 main deploy"가 구조적으로 일치. shift-left 가시성의 신뢰성은 동일 코드 공유에서 나옴.
- **보안 게이트 추출 시 fail-closed 단위 테스트 동반**: 추출은 회귀 위험을 동반 → 정확일치/missing/유사값 거부를 테스트로 고정해 추출 후에도 보안 속성을 보존.

## 교훈

- **시뮬레이션은 실제 경로와 코드를 공유해야 의미가 있다**: dry-run 이 별도 로직이면 곧 실제와 어긋난다. 동일 헬퍼 + 동일 입력(artifact)으로 PR 예측의 정확도를 확보.
- **추출 리팩토링의 "동작 불변"은 다운스트림 계약까지 확인해야 한다**: 헬퍼 출력 포맷(leading space trim)이 GITHUB_OUTPUT 소비자(xargs)와 호환되는지 확인해야 진짜 불변.
- **보안 민감 시드는 분리 이월이 정답**: #신규7 은 #신규3 보안 fix 를 건드릴 위험 → 묶지 않고 분리해 회귀를 격리.

## 이월 항목 (Sprint 174+)

### Sprint 173 분리 이월 시드
- **#신규7** `_parse_group_response` envelope 확장 (보안 신중 검토 필요 — #신규3 raw 노출 차단 fix 와 충돌 가능)

### 계승 이월 시드
- i18n/lint (Sprint 158 #30/#31), plan 템플릿 (Sprint 157 #24/#18/#23 + "신규 산출물 소비처 동시 명시" 체크리스트 = Sprint 171 교훈 결합), ADR/blog 보강 (Sprint 157 #26/27/28)
- UAT 사용자 직접: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~173 누적
- 기타 후속(선택): coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client Case B~D, .claude-tools Phase 2 삭제, (adr) layout 분할, 깊은 상대경로 .md 링크, H3-only PR 표 추출
