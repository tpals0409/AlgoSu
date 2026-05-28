---
sprint: 208
title: "tier2 window 자동 소멸 보강 + 하네스 체크업 확장"
date: "2026-05-28"
status: completed
agents: [Oracle]
related_adrs: ["sprint-206", "sprint-207"]
related_memory: ["sprint-window"]
topics: ["infra", "dispatch", "tmux", "oracle", "harness"]
tldr: "Sprint 207 cmd-arg 패턴(respawn-pane/split-window) 도입 부수 효과로 runner 종료 시 pane이 사라지고 마지막 pane이면 tmux가 window를 자동 destroy하는 현상(Sprint 207 §이월 1순위) 보강. oracle-spawn.sh에 (C) 명령 인자 끝 `; exec zsh -i`로 pane 유지 + (A) spawn 진입 시 window 존재 확인·자동 재생성 이중 방어. Phase C 5 시나리오(C1a 자동재생성·C1b respawn 재사용·C2 architect·C3 herald·C4 kill 복구) 전부 status: success. harness-checkup.sh Item 2 자동 매핑(--show-model 서브커맨드)·Item 3 --full 실호출·Item 4 window 상태 검증 확장(Sprint 206 시드 후속)."
---
# Sprint 208 — tier2 window 자동 소멸 보강 + 하네스 체크업 확장

## 목표

- Sprint 207 §교훈 ⑤ + §이월 1순위 — `tmux respawn-pane`/`split-window` 명령 인자(cmd-arg) 도입 후 runner 종료 시 pane이 사라지고 마지막 pane이면 window가 자동 destroy되는 부수 현상을 보강한다.
- dispatch 인프라 안정성을 단발 sprint 작업으로 복구하고, tier1+tier2 양쪽 경로를 실제 dispatch로 검증한다.
- 하네스 체크업(Sprint 206 시드) Item 2·3·4를 시드 단계에서 실제 검증 단계로 확장한다(Sprint 206 §이월).

## 배경

Sprint 207에서 `tmux send-keys` 회귀(첫 인자에 실재 파일 경로 포함 시 zsh path processing hook이 Enter 흡수)를 우회하기 위해 **cmd-arg 패턴**(`respawn-pane -k "<cmd>"` / `split-window "<cmd>"`)을 도입했다. 이 방식은 tmux가 셸을 거치지 않고 프로세스를 직접 fork하므로 zsh hook을 완전 배제하나, **runner 종료 시 그 pane도 함께 종료**되는 부수 효과가 있다. window의 마지막 pane이 사라지면 tmux가 window를 자동 destroy한다(`destroy-unattached off` 기본값과 무관 — 그것은 attached client 부재 시 session destroy 옵션).

본 sprint Phase A 첫 명령에서 `tmux list-windows -t oracle` → `control / tier1 / tier3`만 존재하고 `tier2` 누락을 즉시 확인했다. Sprint 207 §이월 1순위에서 예측한 현상 그대로다.

환경: macOS 25.5.0 + tmux 3.6a + zsh 5.9.

## 결정

### D0. 원인 — cmd-arg 패턴 runner 종료 시 pane 소멸 → 마지막 pane이면 window destroy

`oracle-spawn.sh`의 두 분기 모두 `bash '<runner>'` 단독을 명령 인자로 전달한다:
- `.0` 재사용 분기: `respawn-pane -k -t "$target_pane" "bash '${runner_file}'"`
- split 분기: `split-window ... "bash '${runner_file}'"`

runner가 끝나면 그 명령을 실행하던 pane도 종료된다. tier2 window에 다른 pane이 없으면(통상 1개) window 전체가 destroy된다. 영향: 다음 tier2(architect/scribe/postman/curator/critic) dispatch 시 `tmux list-panes -t "$SESSION:$window"`가 실패 → `pane_count=0` + `pane0_cmd=""` → split 분기 진입 → `split-window -t "$SESSION:$window"`도 window 부재로 실패 → spawn 자체 실패.

### D1. 수정 옵션 비교

| 옵션 | 접근 | 장점 | 단점 | 선택 |
|------|------|------|------|------|
| **A** | spawn 진입 시 window 존재 확인 + 자동 재생성 | 명시적·디버깅 용이, reap 로직과 무관 | spawn 호출마다 `tmux list-windows` 1회 추가 | ✅ (2차 방어) |
| **B** | `tmux set-window-option -g remain-on-exit on` | tmux 1줄 옵션 | dead pane 누적 · `panes.json` reap 로직과 미묘 충돌 · dashboard 시각 노이즈 | ❌ |
| **C** | 명령 인자 끝에 `; exec zsh -i` 추가 → pane 유지 | Sprint 207 cmd-arg 패턴 그대로 확장, send-keys 없음 | zsh prompt 유지(디버깅 시 장점) | ✅ (1차 방어) |

**결정: C 우선 + A 보강(이중 방어).** C는 통상 경로(정상 runner 종료) 보호, A는 비통상 경로(외부 `kill-window`·tmux 장애) 보호. B는 회피 — reap 로직(`panes.json`은 살아있는 pane만 추적)과 dead pane 상호작용이 미묘하고 dashboard 노이즈 누적.

### D2. 위임 판단 — Phase D·D'·E Oracle 직접

plan 매트릭스는 Phase D·D'(harness-checkup.sh)를 Architect 위임, Phase E(ADR)를 Scribe 위임으로 명시했다. 그러나 **Phase C에서 dispatch 복구를 5회 실증**(C1a/C1b/C2/C3/C4)하여 Sprint 207 §교훈 ⑥(dispatch 복구 후 정상 위임 실증) 목적이 이미 충족됐다. harness-checkup.sh는 git tracked + CI 게이트 영향이 있고 ADR은 사실 정확성이 critical(Critic 검증 대상)이라, 위임 시 명세 전달·정확도 검증 비용이 직접 작성보다 크다. 따라서 D·D'·E를 Oracle 직접 수행했다. dispatch 복구 실증은 Phase C가 단독으로 충족한다.

## 구현

### Phase A — 재현 + 원인 격리 ✅

`tmux list-windows -t oracle -F '#{window_name}'` → `control / tier1 / tier3` (tier2 누락 즉시 재현). `oracle-spawn.sh` cmd-arg 분기 정적 분석으로 runner 종료 → pane 종료 → 마지막 pane 시 window destroy 경로 확정. 추가 진단 불필요.

### Phase B1 — `; exec zsh -i` 우회 (옵션 C)

`~/.claude/oracle/bin/oracle-spawn.sh` cmd-arg 두 분기 모두 명령 끝에 `; exec zsh -i` 추가.

**변경 전**:
```bash
if [ "$pane_count" -le 1 ] && [[ "$pane0_cmd" == "zsh" || "$pane0_cmd" == "bash" ]]; then
  target_pane="$SESSION:$window.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
else
  target_pane=$(tmux split-window -t "$SESSION:$window" -h -P -F '...' "bash '${runner_file}'")
fi
```

**변경 후**:
```bash
if [ "$pane_count" -le 1 ] && [[ "$pane0_cmd" == "zsh" || "$pane0_cmd" == "bash" ]]; then
  target_pane="$SESSION:$window.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'; exec zsh -i"
else
  target_pane=$(tmux split-window -t "$SESSION:$window" -h -P -F '...' "bash '${runner_file}'; exec zsh -i")
fi
```

원리: tmux shell-command(`/bin/sh -c "..."`)가 `bash <runner>` 실행 후 `; exec zsh -i`를 이어서 실행 → runner 정상 종료(cleanup trap 완전 실행 포함) 후 대화형 zsh로 fallback → pane 유지 → window 보존. 다음 dispatch 시 `.0` pane의 `pane_current_command == "zsh"`라 respawn-pane -k 재사용 분기 정상.

### Phase B2 — window 존재 확인 + 자동 재생성 (옵션 A)

`acquire_spawn_lock` 직후, `pane_count` 추출 직전에 추가:

```bash
if ! tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qFx "$window"; then
  log "window 부재 — 자동 재생성: $SESSION:$window"
  tmux new-window -t "$SESSION" -n "$window"
  tmux select-pane -t "$SESSION:$window.0" -T "${window} (empty)"
fi
```

원리: `grep -qFx`로 정확한 문자열 일치(부분 매칭 회피 — `tier1`과 `tier1x` 구분). 신규 window는 `.0` pane이 zsh로 시작 → 기존 `.0` 재사용 분기로 자연 진입. `_lib.sh acquire_spawn_lock`이 spawn 전체 구간을 직렬화하므로 동시 호출 race 차단.

### Phase D' (oracle-spawn.sh) — `--show-model` 비파괴 서브커맨드

`main()` 최상단에 분기 추가:
```bash
if [[ "${1:-}" == "--show-model" ]]; then
  shift
  get_model "${1:?에이전트명 필요 (예: architect)}"
  exit 0
fi
```

원리: 정상 spawn 흐름(lock 생성·tmux 호출·runner 생성) 진입 전 분기. `bash oracle-spawn.sh --show-model <agent>` → `get_model()` 출력만(`.claude-team.json` jq fallback 포함). side effect 0. harness-checkup.sh Item 2가 안전하게 호출.

> **주의**: `~/.claude/oracle/bin/oracle-spawn.sh`는 `~/.claude/` 하위 운영 파일로 git tracked 아님. 변경 내용은 본 ADR §Phase B1·B2·D' diff가 SSOT.

### Phase D (harness-checkup.sh) — Item 4 window 상태 검증

`scripts/harness-checkup.sh` `check_item_4_dispatch_traces()`에 기존 dispatch 로그 7일 카운트는 유지하고 tmux oracle window 상태 검증 추가:
```bash
if ! tmux has-session -t oracle 2>/dev/null; then
  report_warn "Item 4 — oracle 세션 부재 (oracle-init.sh 미실행 또는 종료됨, CI 환경 정상)"
  return
fi
local missing_windows="" w
for w in control tier1 tier2 tier3; do
  if ! tmux list-windows -t oracle -F '#{window_name}' 2>/dev/null | grep -qFx "$w"; then
    missing_windows="${missing_windows}${w} "
  fi
done
[[ -n "$missing_windows" ]] && report_fail "Item 4 — oracle window 누락: ${missing_windows}..." || report_pass "Item 4 — oracle 세션 + 4 window 정상"
```

CI 환경(oracle 세션 부재)에서는 `report_warn`으로 처리하여 FAIL 회피 → CI 통과 유지.

### Phase D' (harness-checkup.sh) — Item 2 자동 매핑 + Item 3 --full 실호출

**Item 2**: `.claude-team.json agents[].model` ↔ `oracle-spawn.sh --show-model <agent>` 12 에이전트 전체 자동 비교. 불일치 시 어느 SSOT가 stale인지 `team=X,spawn=Y` 형식으로 표시.

**Item 3**: `--full` 플래그 시 `.claude-team.json` unique 모델 목록(`jq -r '.agents[].model' | sort -u`)에 `claude --model <ID> -p "ping"` 실호출. 기본은 명령 영속화만(정기점검 매번 API 호출 부담 회피). `main()`에 `--full` 플래그 파싱 추가.

### Phase E — ADR + README + RUNBOOK

본 ADR(KR+EN) + `docs/adr/README.md` 카운트 145→146·range 62~207→62~208 + `docs/runbook/harness-checkup.md` §1 `--full` 설명·§2 Item 2·3·4 갱신·§5 Sprint 208 이력.

## 검증

### Phase C — dispatch 5 시나리오 (전부 status: success)

| 시나리오 | 경로 | inbox 도착 | window | 결과 |
|---------|------|-----------|--------|------|
| **C1a** scribe (tier2) | window 부재 → **B2 자동 재생성** → spawn | ~5s | tier2 복구 | status: success |
| **C1b** scribe (tier2) | `.0` pane `zsh` 확인 → **B1 respawn-pane 재사용** | ~5s | tier2 유지 | status: success |
| **C2** architect (tier2) | `.0` respawn-pane 재사용 | ~5s | tier2 유지 | status: success |
| **C3** herald (tier3) | tier3 `.0` 재사용 | ~5s | tier3 유지 | status: success |
| **C4** architect (tier2) | `kill-window -t oracle:tier2` 후 → **B2 자동 재생성 로그** → spawn | ~5s | tier2 복구 | status: success |

각 dispatch 후 `panes.json` 빈 객체 `{}`로 reap 정상. C1b에서 `tmux display-message -t oracle:tier2.0 -p '#{pane_current_command}'` → `zsh` 확인(B1 `exec zsh -i` 효과 실증). C4에서 `[spawn] window 부재 — 자동 재생성: oracle:tier2` 로그 출력(B2 효과 실증).

### 게이트

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → exit 0 (syntax)
- `bash oracle-spawn.sh --show-model architect` → `claude-sonnet-4-6` / `--show-model conductor` → `claude-opus-4-7` (매핑 정상)
- `bash scripts/harness-checkup.sh` → PASS=6 / WARN=1 / FAIL=0 (Item 2 매핑 정합 + Item 4 4 window 정상)
- `bash scripts/harness-checkup.sh --full` → Item 3 unique 모델 2개 모두 ping 응답 정상
- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **146**
- `node scripts/check-adr-en-coverage.mjs --lint` → **155/155 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Critic (Codex)

- **R1** (`codex review --base 95b5e3a`, 비대화형 — session ID 미출력) — **P2 1건 발견 → 해소**
  - 발견: `scripts/harness-checkup.sh:103` Item 2가 git 외부 `oracle-spawn.sh`의 `--show-model` 서브커맨드에 의존. Sprint 208 미적용 구버전 oracle-spawn.sh를 가진 다른 머신/CI에서는 `--show-model`이 일반 spawn 인자로 처리되어 빈 출력/exit 1 → 12 에이전트 전원 mismatch 오탐 → `harness-checkup.sh` FAIL.
  - 해소: feature-detect 추가 — 알려진 에이전트(architect)로 probe 호출 후 결과가 모델 ID 형식(`^claude-`)이 아니면 매핑 비교를 건너뛰고 count-only PASS로 degrade. 신버전은 매핑 비교 진행, 구버전/파일 부재는 안전 degrade. Critical/High **0건**, P2 1건 해소.
- **Critic placeholder 회귀 차단 결정 준수** — R1까지 본 §Critic 섹션에 영속화, R{N≥2}(해소 후 CLEAN 재확인)는 sprint-window/메모리에만 기록.
- **본 sprint 코드 변경 중 `~/.claude/oracle/bin/oracle-spawn.sh`(git 외부)는 codex diff에 없음**. git tracked 변경은 `scripts/harness-checkup.sh`(Item 2·3·4 + `--full`) + ADR + README + RUNBOOK. oracle-spawn.sh 변경은 본 ADR §Phase B1·B2·D' diff가 SSOT라 codex가 ADR 기반 사실 검증 수행.

## 교훈

1. **예측된 부수 발견의 N+1 sprint 종결** — Sprint 207 §교훈 ⑤(부수 발견 즉시 이월)에서 명시한 tier2 window 자동 소멸을 본 sprint Phase A 첫 명령에서 재현하고 즉시 보강했다. "발견 → 이월 명시 → 다음 sprint 종결" 패턴의 완결 사례. 이월 항목에 재현 명령·예상 원인을 충분히 적어두면 N+1 sprint 착수가 즉시 가능하다.
2. **이중 방어의 역할 분리** — C(`exec zsh -i`)는 통상 경로(정상 runner 종료), A(window 자동 재생성)는 비통상 경로(외부 kill·장애)를 각각 담당한다. 하나로는 한쪽 경로만 커버 — C만이면 외부 kill-window 복구 불가, A만이면 매 dispatch마다 window 신규 생성 비용. 두 방어가 직교적 경로를 커버할 때 단발 sprint로 100% 복구가 가능하다.
3. **dispatch 검증이 위임 실증을 대체** — plan은 Phase D·E를 위임으로 dispatch 복구를 실증하려 했으나, Phase C의 5회 dispatch가 이미 충분한 실증이었다. 검증 단계에서 자연스럽게 발생하는 dispatch 호출이 별도 위임 실증보다 강한 신호다. 위임은 정확도가 우선인 작업(코드·ADR)에서는 비용 대비 효익을 재고할 가치가 있다.
4. **비파괴 서브커맨드로 SSOT 교차 검증** — `oracle-spawn.sh --show-model`은 spawn 흐름(lock·tmux·runner) 진입 전 분기하여 side effect 0으로 `get_model()` 출력만 반환한다. SSOT 함수의 출력을 외부 스크립트가 안전하게 호출하려면 본체 로직과 격리된 비파괴 진입점을 두는 것이 깔끔하다(매핑 테이블 hardcode 복제 회피).
5. **--full 플래그로 비용 있는 검증을 옵트인화** — Item 3 실제 LLM ping 4회는 정기점검 매 실행에 부담이다. `--full` 옵트인으로 기본 실행(명령 영속화)과 분리하여, 평시 체크업은 무비용·sprint 마감/모델 retirement 점검 시에만 실호출. 비용 있는 검증을 게이트에 강제하지 않고 필요 시점에만 켜는 패턴.

## 신규 패턴

- **cmd-arg 패턴 pane 유지 보강** — `respawn-pane`/`split-window` 명령 인자 끝에 `; exec zsh -i`를 붙여 runner 종료 후 대화형 셸로 fallback → pane·window 보존. Sprint 207 cmd-arg 패턴(zsh hook 우회)과 호환되며 window 자동 소멸을 차단하는 표준 보강.
- **spawn 진입 window 자가 복구** — spawn 시작 시 `tmux list-windows | grep -qFx "$window"`로 대상 window 존재를 확인하고 부재 시 `new-window`로 자동 재생성. 외부 kill·tmux 장애에 대한 dispatch 인프라 자가 복구.
- **비파괴 서브커맨드 SSOT 교차 검증 패턴** — SSOT를 정의하는 함수(`get_model()`)를 외부에서 검증할 때, 본체 흐름에 진입하지 않는 비파괴 서브커맨드(`--show-model`)를 두어 출력만 노출. 매핑 테이블 복제 없이 단일 SSOT 유지.
- **비용 있는 검증의 --full 옵트인 패턴** — 실제 API 호출처럼 비용 있는 검증 항목은 `--full` 플래그로 분리하여 기본 실행에서 제외. 평시 무비용·필요 시점 옵트인.

## Sprint 209+ 이월

- **운영 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영) — problem_db jsonb 전환 + GIN 인덱스.
- **누적 UAT** (사용자 직접) — 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
- **하네스 체크업 `--full` 모드 CI 통합 검토** (선택) — 정기 sprint 마감 게이트에 `--full` 실행 추가 여부. API 4회 호출 비용 vs 모델 ID retirement 사전 감지 가치 비교.
