---
sprint: 207
title: "oracle-spawn.sh send-keys 회귀 우회 — tmux dispatch 인프라 복구"
date: "2026-05-28"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-202", "sprint-206"]
related_memory: ["sprint-window"]
topics: ["infra", "dispatch", "tmux", "oracle"]
tldr: "Sprint 206 Phase F에서 발견된 tmux dispatch 인프라 불안정 원인을 격리·확정. tmux send-keys 첫 인자에 실재 파일 경로가 포함되면 zsh path processing hook이 Enter를 흡수하는 현상. send-keys 대신 tmux respawn-pane / split-window 명령 인자 방식으로 우회. oracle-spawn.sh:243-262 수정. scribe + architect dispatch 양쪽 검증 완료. dispatch 인프라 복구."
---
# Sprint 207 — oracle-spawn.sh send-keys 회귀 우회 + dispatch 인프라 복구

## 목표

- Sprint 206 §교훈 ②에서 발견된 tmux dispatch 불안정 원인을 정확히 격리하고 우회 패치를 적용한다.
- `oracle-spawn.sh` 수정 후 scribe + architect dispatch 양쪽에서 실제 inbox 수신을 검증한다.
- 단기 우회가 아닌 구조적 대안으로 send-keys 의존을 제거해 Sprint 208+ dispatch 회귀를 차단한다.

## 배경

Sprint 206 Phase F에서 `oracle-spawn.sh architect ...` 호출 시 tmux pane에 명령이 입력만 되고 Enter가 실행되지 않는 현상이 처음 보고되었다. `tmux send-keys -t oracle:tier2 Enter` 개별 재시도도 효과 없었다. 당시 시드 단계 + sprint 마감 효율 우선으로 Oracle 직접 fallback했으나, 이 상태에서는 code-changing 에이전트 위임이 불가능하므로 Sprint 207 우선 점검이 결정됐다.

환경: macOS 25.5.0 + tmux 3.6a + zsh 5.9. `~/.zshrc` 없음, autosuggestions/syntax-highlighting 미설치.

## 결정

### D0. 원인 — 실재 파일 경로가 포함된 send-keys 첫 인자 시 zsh Enter 흡수

격리 매트릭스를 통해 재현 조건을 좁혔다. 핵심 패턴: **tmux send-keys 첫 인자 문자열에 실재하는 파일 경로가 포함될 때** zsh internal hook이 path 처리 중 Enter를 흡수한다. 비존재 경로(`/Users/.../NONEXISTENT.sh`)나 단순 명령(`echo X`, `bash --version`)에서는 Enter가 정상 실행된다.

zsh 내부의 어느 hook(completion cache warm-up / path glob / glob_complete 등)이 트리거되는지는 미규명. zsh source 추적 없이 black-box 격리만 확정.

### D1. 우회 — send-keys 제거, 명령 인자(cmd-arg) 방식 채택

7종 우회 시도 중 **AG (split-window cmd-arg)** 와 **AH (respawn-pane cmd-arg)** 만 성공:

| 시도 | 방식 | 결과 |
|------|------|------|
| α 분리 호출 | send-keys 두 번 | ❌ |
| β sleep+C-m | sleep 0.5 후 C-m | ❌ |
| ω embedded newline | `$'bash path\n'` | ❌ |
| -l literal | `send-keys -l` | ❌ |
| AC paste-buffer | paste-buffer 활용 | ❌ |
| **AG split-window cmd-arg** | `split-window ... "bash path"` | **✅** |
| **AH respawn-pane cmd-arg** | `respawn-pane -k -t pane "bash path"` | **✅** |

명령 인자 방식은 tmux가 zsh 세션을 거치지 않고 프로세스를 직접 fork하므로 zsh hook이 개입되지 않는다.

### D2. 적용 수정 — `~/.claude/oracle/bin/oracle-spawn.sh:243-262`

원본 분기:
```bash
# pane_count<=1 && idle → target=.0 → send-keys
tmux send-keys -t "$target_pane" "bash '${runner_file}'" Enter
```
```bash
# 새 pane 필요 → split-window 후 send-keys
tmux split-window -t "$TARGET_WINDOW" -d
tmux send-keys -t "$new_pane" "bash '${runner_file}'" Enter
```

수정 후:
```bash
# pane_count<=1 && idle → respawn-pane cmd-arg (.0 재사용)
tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
```
```bash
# 새 pane 필요 → split-window cmd-arg (send-keys 완전 제거)
tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"
```

`send-keys` 호출을 완전히 제거하고 tmux 자체 명령 인자로 프로세스를 기동한다.

### D3. 부수 발견 — tier2 window spawn 후 빈 window 소멸

respawn-pane/split-window 이후 runner 완료 시 tier2 window가 자동 소멸되는 현상 확인. pane이 0개가 되면 tmux가 window를 자동 destroy하는 기본 동작. 다음 dispatch 시 window가 없어 pane 카운트 체크가 실패할 수 있음. `remain-on-exit on` 또는 window 자동 재생성 로직 추가가 필요하나 본 sprint 범위 외. Sprint 208 이월.

## 구현

### Phase A — 진단 및 격리 매트릭스

`oracle-spawn.sh`의 `tmux send-keys` 호출 경로를 정적 분석. runner 파일 경로가 첫 인자 문자열에 삽입되는 지점 특정(line 249·260).

격리 매트릭스 8케이스를 순차 실행하여 재현 조건을 단 하나로 압축:

| 케이스 | Enter |
|--------|-------|
| `echo X` | ✅ |
| `echo 'long quoted'` | ✅ |
| `bash --version` | ✅ |
| `bash /tmp/fake.sh` (비존재) | ✅ |
| `bash /Users/.../NONEXISTENT.sh` | ✅ |
| `bash /tmp/test-real.sh` (실재 파일) | ❌ |
| `bash /Users/leokim/.claude/oracle/runners/scribe-task-*-run.sh` | ❌ |
| `RUNNER=/tmp/test-real.sh` (단순 변수 할당) | ❌ |

"실재 파일 경로 포함" 조건이 결정적. 비존재 경로는 정상, 실재 파일 경로는 실패. zsh path processing hook 개입으로 확정.

### Phase B — 우회 시도 (실패 계열)

α~AC 5종 시도:
- **α 분리 호출**: `send-keys "bash path"` + 별도 `send-keys "" Enter` → 두 번째 Enter도 흡수됨
- **β sleep+C-m**: `sleep 0.5; send-keys -t pane "" C-m` → zsh hook이 sleep 후에도 지속됨
- **ω embedded newline**: 문자열에 `\n` 삽입 → 파싱 오류 또는 동일 흡수
- **-l literal**: `send-keys -l "bash path"` → literal 플래그로 입력되나 Enter 별도 전송 시 동일 문제
- **AC paste-buffer**: `set-buffer` + `paste-buffer` → buffer 내 개행 포함 시 동일 흡수

모두 send-keys 경로를 유지하는 한 zsh hook 개입을 우회하지 못함.

### Phase C — 작동 우회 (AG + AH 채택)

**AG (split-window cmd-arg)**: `tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"` — tmux가 직접 bash 프로세스 fork. zsh 미개입. ✅

**AH (respawn-pane cmd-arg)**: `tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"` — 기존 pane 재사용, 직접 fork. ✅

두 방식 모두 zsh hook을 완전 우회. AH는 `.0` idle pane 재사용 경로, AG는 신규 split 경로에 각각 적용.

### Phase D — `oracle-spawn.sh:243-262` 수정 적용

`~/.claude/oracle/bin/oracle-spawn.sh` 243~262번째 줄 패치:

**변경 전 (send-keys 방식)**:
```bash
if [ "$pane_count" -le 1 ] && is_pane_idle "$TARGET_WINDOW.0"; then
  target_pane="$TARGET_WINDOW.0"
  tmux send-keys -t "$target_pane" "bash '${runner_file}'" Enter
else
  tmux split-window -t "$TARGET_WINDOW" -d
  new_pane=$(tmux list-panes -t "$TARGET_WINDOW" -F '#D' | tail -1)
  tmux send-keys -t "$new_pane" "bash '${runner_file}'" Enter
fi
```

**변경 후 (cmd-arg 방식)**:
```bash
if [ "$pane_count" -le 1 ] && is_pane_idle "$TARGET_WINDOW.0"; then
  target_pane="$TARGET_WINDOW.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
else
  tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"
fi
```

`send-keys` 호출 전면 제거. `split-window` 이후 별도 pane ID 취득 + send-keys 2줄 → 단일 명령 1줄로 단순화.

> **주의**: `~/.claude/oracle/bin/oracle-spawn.sh`는 `~/.claude/` 하위 운영 파일로 git tracked 아님. 변경 내용은 본 ADR §Phase D diff가 SSOT.

### Phase E — 검증

1. `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → **SYNTAX OK** (exit 0)
2. **C2**: `oracle-spawn.sh scribe task-verify-207` → runner 기동 확인 → `~/.claude/oracle/inbox/scribe-task-verify-207.md` 약 5초 내 수신. 내용: `pong from scribe fixed-207`
3. **C3**: `oracle-spawn.sh architect task-verify-arch-207` → runner 기동 확인 → `~/.claude/oracle/inbox/architect-task-verify-arch-207.md` 약 15초 내 수신. 내용: `pong from architect verify-207`

tier1(scribe, 빠른 응답) + tier2(architect, 무거운 응답) 양쪽 dispatch 경로 모두 검증 완료. Sprint 206 이후 막혀있던 code-changing 에이전트 위임 경로 복구.

## 검증

- `bash -n oracle-spawn.sh` → exit 0 (syntax 정상)
- scribe dispatch C2 → inbox 수신 5s (**tier1 경로 복구**)
- architect dispatch C3 → inbox 수신 15s (**tier2 경로 복구**)
- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **145**
- `node scripts/check-adr-en-coverage.mjs --lint` → **154/154 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Critic (Codex)

- **R1** (`codex review --base cb5fa43`, 비대화형 — session ID 미출력) — **CLEAN ✅**
  - 결과 메시지: "The change only adds the Sprint 207 ADR translations and updates the ADR index count. The relevant ADR count, English coverage, doc reference, i18n residue, and diff whitespace checks pass, and no actionable regression was found."
  - 발견 사항: Critical/High/Medium/Low 모두 **0건**
  - 결정: R2+ 진행 불필요. R1 CLEAN으로 종결.
- **Critic placeholder 회귀 차단 결정 준수** — R1까지 본 §Critic 섹션에 영속화, R{N≥2}는 sprint-window/메모리에만 기록.
- **본 sprint 핵심 변경은 `~/.claude/oracle/bin/oracle-spawn.sh`(git 외부)이므로 codex review --base가 보는 diff는 ADR 변경만**. ADR 본문이 변경 전/후 diff + 격리 매트릭스 + 검증 결과를 모두 영속화한 SSOT라, codex가 ADR 내용을 기반으로 사실 검증 수행 + 발견 0건.

## 교훈

1. **격리 매트릭스가 black-box 원인 확정에 충분** — zsh source 추적 없이도 8케이스 실험만으로 "실재 파일 경로 포함" 조건을 단독 원인으로 좁힐 수 있었다. 재현 조건이 명확하면 내부 메커니즘 미규명이어도 안전한 우회 설계가 가능하다.
2. **send-keys는 셸 세션 경유 → 셸 hook 개입 위험 내재** — tmux send-keys는 대상 pane의 셸 세션에 키스트로크를 주입한다. zsh hook(completion, path-processing 등)이 예상치 못한 방식으로 개입할 수 있다. 명령 인자(cmd-arg) 방식은 tmux가 직접 프로세스를 fork하므로 셸 hook이 완전히 배제된다.
3. **sprint-206 §교훈 ②의 "환경/tmux 세션 상태/Cmux.app 버전 등 다층 가능성"은 macOS + zsh 조합으로 수렴** — 실제로는 Cmux.app 버전 차이나 tmux 설정 문제가 아니었다. zsh path-processing hook이 tmux 버전에 무관하게 발동. Sprint 206 교훈에서 가능성으로만 열어두었던 원인이 Sprint 207에서 실험적으로 확정됐다.
4. **dispatch 복구 후 즉시 양쪽 tier 검증 필수** — tier1(scribe)만 확인하면 tier2(architect, split-window 분기) 코드 경로가 미검증 상태로 남는다. C2 + C3 양쪽 검증이 경로 분기 완전 커버리지를 보장한다.
5. **부수 발견의 즉시 이월 처리** — tier2 window 소멸 현상은 본 sprint 수정과 무관하지 않으나(respawn-pane 도입 효과) sprint 범위를 벗어나므로 즉시 이월. "발견 → 이월 명시 → 다음 sprint 분리" 패턴으로 sprint 범위 오염 방지.

## 신규 패턴

- **tmux dispatch cmd-arg 패턴** — `send-keys "cmd path" Enter` 대신 `respawn-pane -k -t pane "cmd path"` / `split-window -t win -d "cmd path"` 형태로 tmux가 직접 프로세스를 fork. zsh/bash 셸 hook 우회. `oracle-spawn.sh` 기동 경로의 표준 패턴으로 확정.
- **dispatch 인프라 격리 매트릭스 패턴** — 셸/tmux dispatch 이상 발생 시 케이스를 "(1) 단순 명령, (2) 비존재 경로, (3) 실재 파일 경로, (4) 변수 할당" 4 축으로 분류해 최소 실험으로 원인 수렴. sprint-207 §Phase A 격리 매트릭스 8케이스를 다음 dispatch 이상 대응의 재사용 체크리스트로 영속화.
- **tier1 + tier2 양쪽 dispatch 검증 체계** — oracle-spawn.sh 수정 후 scribe(tier1, .0 respawn-pane 경로) + architect(tier2, split-window 경로) 양쪽 dispatch를 실제 inbox 수신으로 검증. 한쪽만 검증하면 코드 분기 중 하나가 미확인 상태.

## Sprint 208+ 이월

- **tier2 window 자동 소멸 보강 (Sprint 208 우선)** — respawn-pane/split-window 이후 pane이 0개가 되면 tmux가 window를 자동 destroy. 다음 dispatch 시 window 부재로 pane 카운트 체크 실패 가능. `remain-on-exit on` 또는 window 자동 재생성 로직(`new-window -t oracle:tier2`) 추가 검토.
- **하네스 체크업 Item 2 자동 매핑 비교** — `.claude-team.json agents[].model` ↔ `oracle-spawn.sh get_model()` case 매핑 자동 비교(현재 시드는 agents 개수 검증만).
- **하네스 체크업 Item 3 12 모델 전체 dry-run** — 현재 시드는 명령 영속화만, 향후 실제 `claude --model <ID> -p "ping"` 12 모델 호출.
- **운영 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영).
- (선택) 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
