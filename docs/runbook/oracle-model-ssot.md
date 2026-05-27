# Oracle 모델 SSOT 통합 + Cmux PATH 우선순위 (Sprint 202)

> **대상**: `~/.claude/oracle/bin/oracle-spawn.sh` (repo 외부, `.claude` config)
> **작성 배경**: Sprint 202 하네스 정기점검에서 발견한 2건의 결함을 동시 정비.
> **관련 RUNBOOK**: [oracle-tmux-path.md](./oracle-tmux-path.md) — Sprint 141 PATH export 패치 (본 문서의 선행 패치)

---

## 1. 배경

Sprint 202 정기점검에서 2건의 결함을 확인했다.

1. **모델 ID SSOT 분기 (심각)** — `.claude-team.json` `agents[].model` 필드는 데드 코드였다. 실제 모델 ID는 `oracle-spawn.sh:28-33` `get_model()` 함수에 하드코딩되어 있어 JSON 갱신만으로는 모델 전환이 불가능했다. Opus 모델 ID는 4-6에 고정되어 있어 최신 4-7을 활용하지 못했다.
2. **Cmux/Homebrew claude PATH 우선순위 불일치 (중간)** — Cmux.app(`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.152)이 사용자 시스템 PATH 1순위이나, Sprint 141 패치는 runner export PATH에 `/opt/homebrew/bin`을 1순위로 명시했다. tmux pane이 부모 셸 PATH를 상속하면 Cmux.app이, 미상속하면 Homebrew가 사용되어 runner의 의도와 실제 동작이 갈렸다.

## 2. 사전 조건

```bash
brew install jq   # macOS 기본 미설치, A1 jq lookup의 사전 조건
```

`jq` 미설치 머신에서는 fallback case가 작동하므로 안전망은 보장된다. 단 SSOT 통합 효과(JSON 갱신만으로 모델 전환)는 jq 설치 머신에서만 발효된다.

## 3. 패치 A1 — `get_model()` jq lookup 리팩토링

**위치**: `~/.claude/oracle/bin/oracle-spawn.sh` 라인 28-33.

**Before**:

```bash
get_model() {
  case "$1" in
    conductor|gatekeeper|librarian|palette) echo "claude-opus-4-6" ;;
    *) echo "claude-sonnet-4-6" ;;
  esac
}
```

**After**:

```bash
get_model() {
  # Sprint 202 — .claude-team.json agents[].model을 SSOT로 사용. jq 미설치 또는 JSON 누락 시 fallback case 적용.
  local agent="$1"
  local team_file
  team_file="$(detect_project_dir)/.claude-team.json"
  if [[ -f "$team_file" ]] && command -v jq >/dev/null 2>&1; then
    local m
    m=$(jq -r --arg n "$agent" '.agents[] | select(.name == $n) | .model // empty' "$team_file" 2>/dev/null)
    if [[ -n "$m" && "$m" != "null" ]]; then
      echo "$m"
      return
    fi
  fi
  case "$agent" in
    conductor|gatekeeper|librarian|palette) echo "claude-opus-4-7" ;;
    *) echo "claude-sonnet-4-6" ;;
  esac
}
```

### 작동 원리

1. `detect_project_dir()` (라인 52~65)를 재사용해 `.claude-team.json` 경로를 결정.
2. JSON 존재 + jq 가용 시 `.agents[] | select(.name == "<agent>") | .model` 로 모델 ID lookup.
3. lookup 실패(빈 문자열/null) 또는 사전 조건 미충족 시 fallback case 적용.
4. fallback의 opus도 4-7로 동기 갱신해 JSON 손상 시에도 최신 모델 사용 보장.

### 효과

이후 모델 전환은 `.claude-team.json` 한 군데 갱신으로 완결. 예:

```json
{ "name": "conductor", "model": "claude-opus-4-7" }
```

## 4. 패치 B1 — runner PATH export Cmux 경로 명시

**위치**: `~/.claude/oracle/bin/oracle-spawn.sh` 라인 131-134 (runner heredoc 내부).

**Before**:

```bash
# Sprint 141 — tmux pane이 부모 셸 PATH를 상속하지 않는 경우 대비 명시적 export.
# Sprint 139 P1 재발 차단: tmux pane에서 \`env: claude: No such file or directory\` 즉시 실패.
# Homebrew (macOS arm64), MacPorts, /usr/local 모두 커버.
export PATH="/opt/homebrew/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
```

**After**:

```bash
# Sprint 141 — tmux pane이 부모 셸 PATH를 상속하지 않는 경우 대비 명시적 export.
# Sprint 139 P1 재발 차단: tmux pane에서 \`env: claude: No such file or directory\` 즉시 실패.
# Sprint 202 — Cmux.app 번들 claude를 1순위로 명시 (사용자 시스템 PATH 우선순위와 일치).
# Homebrew (macOS arm64), MacPorts, /usr/local 모두 커버. Cmux.app 미설치 머신은 토큰만 무시되고 부작용 없음.
export PATH="/Applications/cmux.app/Contents/Resources/bin:/opt/homebrew/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
```

### 효과

- Cmux.app 설치 머신: 사용자 시스템 PATH 우선순위와 runner 의도가 일치, 항상 Cmux 번들 claude 사용.
- Homebrew-only 머신: Cmux.app 토큰이 디렉토리 부재로 무시되어 다음 토큰부터 검색, Sprint 141 동작 보존.
- 모든 머신에서 Sprint 141의 fail-fast `command -v claude` 가드(라인 137~142)는 그대로 유지.

## 5. 다른 머신 적용 절차

본 RUNBOOK이 추적하는 변경은 모두 **repo 외부**(`~/.claude/oracle/bin/`)이라 PR diff에 잡히지 않는다. 새 머신 셋업 시 본 절차를 수동으로 적용해야 한다.

```bash
# 0. 사전 조건
brew install jq

# 1. oracle-spawn.sh 백업
cp ~/.claude/oracle/bin/oracle-spawn.sh ~/.claude/oracle/bin/oracle-spawn.sh.bak-pre-sp202

# 2. §3 패치 A1 적용 (라인 28~33 교체)
# 3. §4 패치 B1 적용 (라인 134 한 줄 교체)

# 4. 문법 검증
bash -n ~/.claude/oracle/bin/oracle-spawn.sh

# 5. 모델 매핑 sanity check
jq -r '.agents[] | "\(.name)\t\(.model)"' /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-team.json
# 기대 출력 (Sprint 202 시점):
# conductor    claude-opus-4-7
# gatekeeper   claude-opus-4-7
# librarian    claude-opus-4-7
# palette      claude-opus-4-7
# (나머지 8개) claude-sonnet-4-6

# 6. (선택) 모델 lookup 동작 검증 — 함수 정의 블록 추출 후 source
sed -n '17,77p' ~/.claude/oracle/bin/oracle-spawn.sh > /tmp/sp202-fns.sh
bash -c 'source /tmp/sp202-fns.sh; for a in conductor gatekeeper librarian palette architect scribe critic herald scout sensei postman curator; do printf "%-12s %s\n" "$a" "$(get_model "$a")"; done'
rm -f /tmp/sp202-fns.sh
# → conductor/gatekeeper/librarian/palette → claude-opus-4-7
# → 나머지 8개 → claude-sonnet-4-6
```

## 6. 검증

```bash
# 문법
bash -n ~/.claude/oracle/bin/oracle-spawn.sh

# 모델 ID Cmux 호환성 dry-run (사전 검증, 본 패치 적용과 무관하게 한 번)
claude --model claude-opus-4-7 -p "ping"   # → pong, exit 0 기대
claude --model claude-sonnet-4-6 -p "ping" # → pong, exit 0 기대

# 라이프사이클 dry-run (tmux 세션 필요)
bash ~/.claude/oracle/bin/oracle-init.sh
ID=$(bash ~/.claude/oracle/bin/oracle-create-task.sh --gen-id)
bash ~/.claude/oracle/bin/oracle-create-task.sh --simple "$ID" "Sprint 202 SSOT 검증" "scribe"
bash ~/.claude/oracle/bin/oracle-spawn.sh scribe "$ID" "Sprint 202 SSOT 검증"
tail -20 ~/.claude/oracle/logs/scribe-${ID}.out
# → __AGENT_DONE__ 마커 + claude-sonnet-4-6 모델 invoke
```

## 7. 롤백 절차

본 패치로 인해 spawn이 실패하는 경우:

```bash
mv ~/.claude/oracle/bin/oracle-spawn.sh.bak-pre-sp202 ~/.claude/oracle/bin/oracle-spawn.sh
```

`.claude-team.json` opus 모델은 PR 단위로 4-6 롤백 가능(Sprint 202 ADR 참조).

## 8. 향후 시드

- jq 의존 제거 — 모델 lookup을 순수 bash로 (예: case 문 자동 생성기) 옮기면 사전 조건 0건.
- oracle-build-prompts.sh 등 다른 스크립트도 `.claude-team.json`을 SSOT로 사용하는지 점검.
- `codeChangingAgents` 동기화는 Sprint 202 시점 ✅ 정합 확인 — 차후 자동 검증 스크립트 도입 검토.
