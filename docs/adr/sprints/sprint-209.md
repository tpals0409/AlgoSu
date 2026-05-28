---
sprint: 209
title: "하네스 체크업 --full CI 통합 결정 + Item 5/6 강화"
date: "2026-05-28"
status: completed
agents: [Oracle]
related_adrs: ["sprint-206", "sprint-208"]
related_memory: ["sprint-window"]
topics: ["ci", "oracle", "harness", "runbook"]
tldr: "Sprint 208 §이월 — 하네스 체크업 시드 자산(Sprint 206~208)의 운영 성숙 단계. (1) --full(실제 LLM ping) CI 통합 여부를 결정: CI는 GitHub-hosted ubuntu-latest fresh clone이라 ~/.claude/oracle 인프라·claude/codex/tmux CLI·API 키가 모두 부재 → --full을 CI 게이트로 직접 돌리면 노이즈 → 로컬 sprint마감 전용으로 결정(CI 게이트 미통합). 대신 tests/ci/harness-checkup-test.sh로 스크립트 로직 회귀만 CI portable하게 검증(소스 가드 추가) + /stop 비블로킹 리마인더 + RUNBOOK §3 cadence 명문화. (2) Item 5 autoCritic 동기화를 2-way→3-way 확장(+_base.md §자동 Critic 리뷰, git 외부 oracle-auto-critic.sh 부재 시 2-way degrade WARN). (3) Item 6 dormant 검증 심화(.claude-tools/ git-tracked 잔재 0건 + claude-tools.md §4 정리 로드맵 삭제 Phase ✅ 점검)."
---
# Sprint 209 — 하네스 체크업 --full CI 통합 결정 + Item 5/6 강화

## 목표

- Sprint 208 §이월 — 정기 sprint 마감 게이트에 하네스 체크업 `--full` 실행 통합 여부를 결정한다(API 호출 비용 vs 모델 ID retirement 사전 감지 가치).
- Item 5(autoCritic 동기화) / Item 6(dormant 잔재) 검증을 시드 단계에서 심화한다.
- Sprint 206~208 하네스 체크업 시드 자산을 운영 성숙 단계로 끌어올린다.

## 배경

하네스 체크업은 Sprint 206에서 6-항목 스크립트로 시드되었고(`scripts/harness-checkup.sh`), Sprint 208에서 Item 2(자동 매핑)·Item 3(`--full` 실호출)·Item 4(window 상태)를 실제 검증 단계로 확장했다. 남은 시드 자산은 Item 5(2-way 비교)·Item 6(키워드 grep만)이며, `--full`의 운영 위치(CI 통합 여부)는 Sprint 208 §이월로 남았다.

`--full`은 `.claude-team.json`의 unique 모델에 실제 `claude --model <ID> -p "ping"`을 호출하여 모델 ID retirement(Cmux.app 업데이트로 인한 모델 폐기)를 사전 감지한다. 이 호출은 claude CLI + API 키 + `~/.claude/oracle/` 인프라에 의존한다.

## 결정

### D0. `--full` CI 통합 — 로컬 전용 (CI 게이트 미통합)

AlgoSu CI는 GitHub-hosted `ubuntu-latest` **fresh clone**에서 실행된다. 이 환경에는:
- `claude`/`codex`/`tmux` CLI 부재 → Item 1 FAIL
- `~/.claude/oracle/` (git 외부) 부재 → Item 2 degrade, Item 4 WARN, Item 5 degrade
- API 키 부재 → Item 3 `--full` ping 불가

따라서 `harness-checkup.sh --full`(또는 기본 실행)을 CI 게이트로 직접 돌리면 대부분 WARN/FAIL 노이즈가 된다. **결정: `--full`은 로컬 sprint마감/Cmux.app 업데이트 직후 전용으로 유지하고 CI 게이트로 통합하지 않는다.** 대신 스크립트 **로직 회귀**만 CI에서 portable하게 검증한다.

### D1. 통합 방식 비교

| 옵션 | 접근 | 장점 | 단점 | 선택 |
|------|------|------|------|------|
| **A** | `--full`을 CI job으로 추가 | 모델 retirement를 CI가 자동 감지 | oracle 인프라·API 키 부재로 전부 WARN/FAIL 노이즈, API 키를 CI에 노출하는 보안 부담 | ❌ |
| **B** | CI 단위테스트로 스크립트 로직만 검증 | API/인프라 불요, 회귀 차단, 기존 `quality-ci-scripts` 패턴 재사용 | 모델 retirement 자체는 감지 못 함(로직만) | ✅ |
| **C** | `/stop` 비블로킹 리마인더 (로컬 옵트인) | sprint마감마다 실행 유도, 비블로킹 | 강제성 없음(사용자 누락 가능) | ✅ (보완) |
| **D** | RUNBOOK §3 cadence 명문화만 | 가장 가벼움 | 자동화 없음 | ✅ (기반) |

**결정: B + C + D 조합.** B(CI 단위테스트)가 로직 회귀를 차단하고, C(`/stop` 리마인더)가 sprint마감마다 `--full` 로컬 실행을 유도하고, D(RUNBOOK cadence)가 권장 주기를 명문화한다. A는 회피 — CI에 API 키 노출 + 노이즈.

### D2. 위임 판단 — Oracle 직접

plan 매트릭스는 Architect(harness-checkup.sh/ci.yml)·Scribe(ADR/RUNBOOK/stop.md) 위임을 명시했다. 그러나:
1. **`stop.md`는 `.claude/commands/` 스킬 파일** — `_base.md:10`에 의해 Oracle 전용 수정 권한, Scribe 위임 불가.
2. **harness-checkup.sh는 git tracked + CI 게이트 영향**, ADR은 사실 정확성이 critical(Critic 검증 대상) — Sprint 208 §D2 선례(정확도 우선 작업은 직접 작성이 위임보다 효율).

따라서 본 sprint는 Oracle 직접 수행 + 머지 직전 Critic(Codex) 교차 리뷰로 진행한다. Sprint 207~208에서 dispatch 복구가 실증되었으므로 위임 가능성 자체는 확보되어 있으나, 본 sprint 작업 성격상 직접 수행이 효율적이다.

## 구현

### Phase A1 — `--full` 로컬 전용 결정 영속화

D0·D1 결정을 ADR(본 문서) + `docs/runbook/harness-checkup.md §3`에 영속화. RUNBOOK §3을 "기본 실행"과 "`--full` 실행"으로 분리하고, `--full`은 로컬 전용이며 CI 게이트로 통합하지 않음을 명시.

### Phase A2 — CI 단위테스트 + 소스 가드

`scripts/harness-checkup.sh` 말미에 소스 가드 추가:
```bash
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```
직접 실행 시에만 `main`을 호출하고, test에서 `source` 시 함수만 로드 가능하게 한다.

`tests/ci/harness-checkup-test.sh` 신규(17 케이스) — 기존 `tests/ci/*.sh` 순수 bash 패턴 계승:
- Case 1: `--dry-run` exit 0 + 6 항목 출력 smoke
- Case 2: 소스 가드 — `source` 시 `main` 미실행(함수만 로드)
- Case 3: Item 5 tracked SSOT(json ↔ _base.md) 정합 + invariant 독립 재검증
- Case 4: Item 5 degrade — `oracle-auto-critic.sh` 부재 시 WARN(FAIL 아님)
- Case 5: Item 6 portable(dormant·tracked·로드맵 FAIL 없음)
- Case 6: dormant 키워드 git grep invariant 0건

API/`~/.claude/oracle/` 불요 — CI portable. degrade 경로 검증이 핵심(oracle 인프라 부재해도 통과).

### Phase A3 — ci.yml step + 필터 보강

`.github/workflows/ci.yml`:
- `quality-ci-scripts` job에 step 추가: `bash tests/ci/harness-checkup-test.sh`
- `detect-changes` 필터의 `ci-scripts`에 `scripts/harness-checkup.sh` 추가 — 스크립트 단독 변경 시에도 테스트가 트리거되도록(기존 `tests/ci/**`는 이미 포함).

### Phase A4 — stop.md 비블로킹 리마인더

`.claude/commands/stop.md` 1단계에 비블로킹 권장 노트 추가 — sprint마감 시점에 `scripts/harness-checkup.sh --full` 1회 실행으로 모델 ID retirement 사전 감지. oracle 세션/CLI 부재 환경에서는 degrade 처리됨을 명시.

### Phase A5 — RUNBOOK §3 cadence 명문화

`docs/runbook/harness-checkup.md §3`을 "기본 실행"(API 없음)과 "`--full` 실행"(API 비용)으로 분리. `--full`은 sprint마감 1회 + Cmux.app 업데이트 직후 1회 권장, **로컬 전용(CI 게이트 미통합)** 명시. §1 실행 방법에 CI 테스트 명령 추가.

### Phase B — Item 5 autoCritic 동기화 3-way

기존 2-way(`json codeChangingAgents` ↔ `oracle-auto-critic.sh CODE_CHANGING_AGENTS`)를 **3-way**로 확장 — `_base.md §자동 Critic 리뷰`의 "code-changing 에이전트(...)" 괄호 안 9 에이전트 목록을 추가 파싱.

비교 순서:
1. tracked SSOT 2종(`.claude-team.json` ↔ `_base.md`)은 항상 비교 — CI/다른 머신 포함 portable. 불일치 시 FAIL.
2. git 외부 `oracle-auto-critic.sh` 부재 시 **2-way degrade WARN**(Sprint 208 Item 2 degrade 패턴 계승). 존재 시 3-way 정합 PASS.

3종 SSOT 목록 정규화는 공통 헬퍼 `normalize_agent_list`(공백/쉼표 → 정렬된 단일 라인)로 DRY 처리.

### Phase C — Item 6 dormant 검증 심화

기존 git grep 키워드 0건 검증에 2개 sub-check 추가:
- **(2) `.claude-tools/` git-tracked 잔재 0건** — `git ls-files .claude-tools/`. gitignore 정책상 untracked여야 함(`claude-tools.md §1`). 위반 시 WARN.
- **(3) `claude-tools.md §4 정리 로드맵` 진행 점검** — `awk`로 §4~§5 표에서 **'삭제'(deletion) 작업 Phase 행 중 ✅ 누락** 검출. 미완료 cleanup Phase 잔존 시 WARN. 명문화 단계(Phase 1)는 '삭제' 미포함이라 자연 제외.

### Phase E — ADR + README + RUNBOOK

본 ADR(KR+EN) + `docs/adr/README.md`·`docs/adr-en/README.md` 카운트 146→147·range 62~208→62~209 + `docs/runbook/harness-checkup.md` §1/§2/§3/§4/§5 갱신.

## 검증

### 게이트

- `bash -n scripts/harness-checkup.sh` → exit 0 / `bash -n tests/ci/harness-checkup-test.sh` → exit 0
- `bash scripts/harness-checkup.sh` → PASS=8 / WARN=1 / FAIL=0 (Item 5 3-way 정합 + Item 6 3 sub-check PASS)
- `bash tests/ci/harness-checkup-test.sh` → **17/17 PASS** (degrade·소스 가드·invariant 포함)
- Item 5 degrade 시뮬레이션(`ORACLE_BIN` → 비존재 경로) → 2-way degrade WARN (FAIL 아님)
- dormant grep 자기 매칭 회귀 0건(신규 test 파일이 Item 6 grep에 미적중)
- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **147**
- `node scripts/check-adr-en-coverage.mjs --lint` → **156/156 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Critic (Codex)

- **R1** (`codex review --base 24f4b55`, 비대화형 — session ID 미출력) — **CLEAN ✅**
  - 결과: "The added harness checkup logic and CI test appear consistent with the stated local-only/full-mode decision, and the new tests pass in the inspected environment. No actionable correctness issues were identified."
  - 발견 Critical/High/Medium/Low 모두 **0건**. R2+ 진행 불필요.
- **Critic placeholder 회귀 차단 결정 준수** — R1까지 본 §Critic에 영속화, R{N≥2}는 sprint-window/메모리에만 기록.
- **본 sprint 코드 변경 중 `~/.claude/oracle/bin/oracle-auto-critic.sh`(git 외부)는 codex diff에 없음**. git tracked 변경(`scripts/harness-checkup.sh` Item 5/6 + 소스 가드, `tests/ci/harness-checkup-test.sh`, `ci.yml`, `stop.md`, RUNBOOK, ADR)만 리뷰 대상. Item 5의 `oracle-auto-critic.sh` 의존은 부재 시 degrade WARN으로 처리되어 codex가 본 diff 기준 회귀 미발견.

## 교훈

1. **"통합하지 않기로 한 결정"도 영속화 가치가 있다** — `--full` CI 미통합 결정은 "아무것도 안 함"이 아니라 환경 제약(oracle 인프라·API 키 부재) 분석에 근거한 적극적 결정이다. ADR §D0·D1 + RUNBOOK §3에 근거를 명문화하면 다음 sprint에서 "왜 --full을 CI에 안 넣었지?" 재검토를 회피한다. NOT-to 결정은 근거와 함께 영속화해야 반복 비용을 막는다.
2. **git 외부 의존 항목의 tracked-우선 degrade로 CI portable 확보** — Item 5는 tracked SSOT 2종(json↔_base.md)을 먼저 비교(항상 가능)하고, git 외부 `oracle-auto-critic.sh`는 부재 시 2-way degrade WARN으로 처리한다. Sprint 208 Item 2 degrade 패턴 계승. tracked 자산만으로 의미 있는 검증을 우선 수행하고 git 외부는 보조 검증으로 분리하면 CI/다른 머신/로컬을 단일 스크립트로 커버한다.
3. **소스 가드 1줄로 시드 스크립트를 CI 로직 회귀 테스트화** — `[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main "$@"` 가드로 test가 함수를 격리 호출할 수 있게 된다. 시드 단계 스크립트도 소스 가드만 추가하면 black-box(dry-run)를 넘어 함수 단위 회귀 테스트가 가능하다. `--full`처럼 비용/인프라 의존이 큰 항목은 CI에서 제외하되 degrade 경로를 테스트로 고정.
4. **로드맵 진행 점검은 의미 마커로 자연 필터** — §4 정리 로드맵에서 모든 Phase 행의 ✅를 강제하면 명문화 단계(Phase 1, ✅ 없음)가 오탐된다. "'삭제'(deletion) 작업 Phase 행만 ✅ 강제" 규칙으로 의미 있는 cleanup Phase만 검사 → 문서 단계 자연 제외. 마커 하드코딩(Phase 번호 제외) 대신 의미 기반 필터가 미래 행 추가에 강건하다.

## 신규 패턴

- **"NOT-to 결정" ADR 영속화 패턴** — "X를 하지 않기로 한다"는 결정도 환경 제약·근거와 함께 ADR/RUNBOOK에 영속화. 다음 sprint의 재검토 반복 비용을 차단. Sprint 205 무한 이월 방지 명문화 패턴의 결정 버전.
- **git 외부 의존 항목 tracked-우선 degrade 패턴** — 검증 대상이 tracked + git 외부 혼합일 때, tracked 자산만으로 의미 있는 검증을 우선 수행하고 git 외부는 부재 시 degrade(WARN). 단일 스크립트로 CI/다른 머신/로컬 커버. Sprint 208 Item 2(oracle-spawn.sh feature-detect degrade) → Sprint 209 Item 5(oracle-auto-critic.sh 부재 degrade)로 일반화.
- **소스 가드로 시드 스크립트 CI 로직 회귀 테스트화** — `[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main "$@"` 가드 + `tests/ci/*-test.sh`(함수 source 호출)로 시드 스크립트의 함수 단위 회귀를 CI portable하게 검증. 비용/인프라 의존 항목(`--full`)은 제외하되 degrade 경로를 테스트로 고정.
- **로드맵 의미 마커 기반 진행 점검** — 로드맵 표의 진행 상태를 자동 점검할 때 모든 행에 완료 마커를 강제하지 않고, 작업 종류 마커('삭제' 등)로 검사 대상을 의미 기반 필터. 문서/명문화 단계 오탐 회피 + 미래 행 추가에 강건.

## Sprint 210+ 이월

- **운영 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영) — problem_db jsonb 전환 + GIN 인덱스.
- **누적 UAT** (사용자 직접) — 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
