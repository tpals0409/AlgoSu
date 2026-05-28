#!/usr/bin/env bash
# @file scripts/harness-checkup.sh
# @domain local-dev/harness
# @layer ops
# @related docs/runbook/harness-checkup.md, docs/runbook/claude-tools.md, docs/runbook/oracle-model-ssot.md
# AlgoSu 하네스 정기점검 자동화 (Sprint 206 시드, Sprint 202 신규 패턴 영속화)
# 사용법: scripts/harness-checkup.sh [--dry-run]
set -uo pipefail

DRY_RUN=0
FULL_MODE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --full)    FULL_MODE=1 ;;  # Sprint 208 D' — Item 3 실제 LLM ping 호출 활성화
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORACLE_BIN="${HOME}/.claude/oracle/bin"
ORACLE_LOGS="${HOME}/.claude/oracle/logs"
TEAM_JSON="${REPO_ROOT}/.claude-team.json"

if [[ -t 1 ]]; then
  RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; BLUE='\033[34m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; RESET=''
fi

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

report_pass() { printf '%b[PASS]%b %s\n' "$GREEN" "$RESET" "$1"; PASS_COUNT=$((PASS_COUNT + 1)); }
report_fail() { printf '%b[FAIL]%b %s\n' "$RED"   "$RESET" "$1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
report_warn() { printf '%b[WARN]%b %s\n' "$YELLOW" "$RESET" "$1"; WARN_COUNT=$((WARN_COUNT + 1)); }
report_info() { printf '%b[INFO]%b %s\n' "$BLUE" "$RESET" "$1"; }

# Item 1: CLI 백엔드 가용성 (claude, codex, tmux)
check_item_1_cli_availability() {
  report_info "Item 1/6 — CLI 백엔드 가용성"
  local missing=""
  for cli in claude codex tmux; do
    if [[ $DRY_RUN -eq 1 ]]; then
      report_info "  [dry-run] which -a ${cli}"
    elif ! command -v "$cli" >/dev/null 2>&1; then
      missing="${missing}${cli} "
    fi
  done
  if [[ $DRY_RUN -eq 1 ]]; then
    return 0
  fi
  if [[ -n "$missing" ]]; then
    report_fail "Item 1 — 누락된 CLI: ${missing}"
  else
    report_pass "Item 1 — claude/codex/tmux 모두 발견"
  fi
}

# Item 2: SSOT 일치 (.claude-team.json model ↔ oracle-spawn.sh get_model())
check_item_2_ssot_alignment() {
  report_info "Item 2/6 — SSOT 일치 (.claude-team.json ↔ oracle-spawn.sh)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] jq -r '.agents[] | .name+\" \"+.model' ${TEAM_JSON}"
    report_info "  [dry-run] bash ${ORACLE_BIN}/oracle-spawn.sh --show-model <agent> (12 에이전트 매핑 비교)"
    return 0
  fi
  if [[ ! -f "$TEAM_JSON" ]]; then
    report_fail "Item 2 — .claude-team.json 미발견: $TEAM_JSON"
    return
  fi
  if [[ ! -f "${ORACLE_BIN}/oracle-spawn.sh" ]]; then
    report_fail "Item 2 — oracle-spawn.sh 미발견: ${ORACLE_BIN}/oracle-spawn.sh"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    report_fail "Item 2 — jq 미설치 (brew install jq)"
    return
  fi
  local team_models jq_exit
  team_models=$(jq -r '.agents[] | "\(.name) \(.model)"' "$TEAM_JSON" 2>/dev/null)
  jq_exit=$?
  if [[ $jq_exit -ne 0 ]]; then
    report_fail "Item 2 — jq 파싱 실패 (exit=${jq_exit}, .claude-team.json malformed?)"
    return
  fi
  if [[ -z "$team_models" ]]; then
    report_fail "Item 2 — .agents 배열 비어있거나 필드 누락 (jq 결과 empty)"
    return
  fi
  local agents_count
  agents_count=$(printf '%s\n' "$team_models" | wc -l | tr -d ' ')

  # Sprint 208 D' — 자동 매핑 정합 검증: .claude-team.json agents[].model ↔ oracle-spawn.sh get_model() 12 에이전트 전체 비교.
  # oracle-spawn.sh --show-model <agent> 비파괴 서브커맨드(lock/tmux/runner 회피)로 get_model() 출력만 취득.
  if [[ ! -f "${ORACLE_BIN}/oracle-spawn.sh" ]]; then
    report_warn "Item 2 — oracle-spawn.sh 미발견, 매핑 비교 스킵 (agents ${agents_count}개만 확인)"
    return
  fi
  # Sprint 208 R1 (Codex P2) — oracle-spawn.sh는 git 외부 파일이라 다른 머신/CI에서 Sprint 208 미적용 구버전일 수 있다.
  # 구버전은 --show-model을 일반 spawn 인자로 처리하여 빈 출력/에러를 반환 → 모든 에이전트 mismatch 오탐.
  # 알려진 에이전트로 feature-detect: 결과가 모델 ID 형식(claude-…)이 아니면 매핑 비교를 건너뛰고 count-only PASS로 degrade.
  local probe
  probe=$(bash "${ORACLE_BIN}/oracle-spawn.sh" --show-model architect 2>/dev/null || echo "")
  if [[ ! "$probe" =~ ^claude- ]]; then
    report_pass "Item 2 — agents ${agents_count}개 발견 (oracle-spawn.sh --show-model 미지원 구버전 — 매핑 비교 스킵, Sprint 208 미적용 환경)"
    return
  fi
  local mismatches="" team_model spawn_model agent
  while IFS=' ' read -r agent team_model; do
    [[ -z "$agent" ]] && continue
    spawn_model=$(bash "${ORACLE_BIN}/oracle-spawn.sh" --show-model "$agent" 2>/dev/null || echo "")
    if [[ "$team_model" != "$spawn_model" ]]; then
      mismatches="${mismatches}${agent}(team=${team_model},spawn=${spawn_model}) "
    fi
  done <<< "$team_models"
  if [[ -n "$mismatches" ]]; then
    report_fail "Item 2 — 모델 매핑 불일치: ${mismatches}"
  else
    report_pass "Item 2 — agents ${agents_count}개 + .claude-team.json ↔ oracle-spawn.sh get_model() 매핑 정합"
  fi
}

# Item 3: 환경 컨텍스트 모델 ID vs 설정 일치 (시드는 대표 1개)
check_item_3_model_id_compat() {
  report_info "Item 3/6 — 환경 컨텍스트 모델 ID 호환 (claude --model dry-run)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] --full 시: jq -r '.agents[].model' | sort -u → claude --model <ID> -p 'ping' (unique 모델 전체)"
    return 0
  fi
  if ! command -v claude >/dev/null 2>&1; then
    report_warn "Item 3 — claude CLI 미발견 (Item 1과 중복 신호, 스킵)"
    return
  fi
  # Sprint 208 D' — 기본은 명령 영속화만(정기점검 매번 API 호출 부담 회피). --full 플래그 시에만 실제 호출.
  if [[ $FULL_MODE -ne 1 ]]; then
    report_warn "Item 3 — 시드 단계 (실제 LLM 호출은 --full 플래그 시 활성화). 명령 영속화: claude --model <ID> -p 'ping' (.claude-team.json unique 모델)"
    return
  fi
  if [[ ! -f "$TEAM_JSON" ]] || ! command -v jq >/dev/null 2>&1; then
    report_warn "Item 3 — --full이나 .claude-team.json/jq 부재로 unique 모델 목록 취득 불가, 스킵"
    return
  fi
  # --full: .claude-team.json unique 모델 목록 전체에 ping 호출 (중복 제거로 호출 수 최소화)
  local unique_models
  unique_models=$(jq -r '.agents[].model' "$TEAM_JSON" 2>/dev/null | sort -u)
  local failed="" model
  while read -r model; do
    [[ -z "$model" ]] && continue
    if ! claude --model "$model" -p "ping" --output-format text >/dev/null 2>&1; then
      failed="${failed}${model} "
    fi
  done <<< "$unique_models"
  if [[ -n "$failed" ]]; then
    report_fail "Item 3 — 모델 ID 호환 실패 (ping 무응답): ${failed}"
  else
    local count
    count=$(printf '%s\n' "$unique_models" | wc -l | tr -d ' ')
    report_pass "Item 3 — unique 모델 ${count}개 모두 ping 응답 정상"
  fi
}

# Item 4: dispatch fire 흔적 (최근 7일 정상 종료 로그) + tmux oracle window 상태 (Sprint 208)
check_item_4_dispatch_traces() {
  report_info "Item 4/6 — dispatch fire 흔적 + tmux window 상태 (~/.claude/oracle/logs/ + tmux oracle 세션)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] find ${ORACLE_LOGS} -name '*.out' -mtime -7"
    report_info "  [dry-run] tmux list-windows -t oracle -F '#{window_name}' (control/tier1/tier2/tier3)"
    return 0
  fi
  if [[ ! -d "$ORACLE_LOGS" ]]; then
    report_fail "Item 4 — logs 디렉토리 미발견: $ORACLE_LOGS"
    return
  fi
  local recent_count
  recent_count=$(find "$ORACLE_LOGS" -name '*.out' -mtime -7 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$recent_count" -ge 1 ]]; then
    report_pass "Item 4 — 최근 7일 dispatch 로그 ${recent_count}개 발견"
  else
    report_warn "Item 4 — 최근 7일 dispatch 로그 0건 (디스패치 미사용 또는 cleanup 후)"
  fi

  # Sprint 208 — tmux oracle 세션 + control/tier1/tier2/tier3 4개 window 상태 검증.
  # tier2 window 자동 소멸(Sprint 207 cmd-arg 패턴 부수 효과) 회귀를 정기점검에서 사전 감지.
  # oracle-spawn.sh가 spawn 진입 시 자동 재생성하지만, 점검 단계에서 누락을 미리 알리는 운영 가치.
  if ! command -v tmux >/dev/null 2>&1; then
    report_warn "Item 4 — tmux 미발견, window 상태 검증 스킵"
    return
  fi
  if ! tmux has-session -t oracle 2>/dev/null; then
    report_warn "Item 4 — oracle 세션 부재 (oracle-init.sh 미실행 또는 종료됨, CI 환경 정상)"
    return
  fi
  local missing_windows=""
  local w
  for w in control tier1 tier2 tier3; do
    if ! tmux list-windows -t oracle -F '#{window_name}' 2>/dev/null | grep -qFx "$w"; then
      missing_windows="${missing_windows}${w} "
    fi
  done
  if [[ -n "$missing_windows" ]]; then
    report_fail "Item 4 — oracle window 누락: ${missing_windows}(oracle-spawn.sh가 자동 재생성하나 정기점검 사전 감지)"
  else
    report_pass "Item 4 — oracle 세션 + 4 window(control/tier1/tier2/tier3) 정상"
  fi
}

# Item 5: autoCritic 동기화 (oracle-auto-critic.sh CODE_CHANGING_AGENTS ↔ .claude-team.json codeChangingAgents)
check_item_5_autocritic_sync() {
  report_info "Item 5/6 — autoCritic 동기화 (.claude-team.json codeChangingAgents ↔ oracle-auto-critic.sh CODE_CHANGING_AGENTS)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] jq -r '.dispatch.codeChangingAgents | sort | join(\" \")' ${TEAM_JSON}"
    report_info "  [dry-run] grep '^CODE_CHANGING_AGENTS=' ${ORACLE_BIN}/oracle-auto-critic.sh"
    return 0
  fi
  if [[ ! -f "$TEAM_JSON" || ! -f "${ORACLE_BIN}/oracle-auto-critic.sh" ]]; then
    report_fail "Item 5 — SSOT 파일 미발견"
    return
  fi
  local json_list
  json_list=$(jq -r '.dispatch.codeChangingAgents | sort | join(" ")' "$TEAM_JSON" 2>/dev/null)
  local sh_list
  sh_list=$(grep -E '^CODE_CHANGING_AGENTS=' "${ORACLE_BIN}/oracle-auto-critic.sh" | sed -E 's/^CODE_CHANGING_AGENTS="([^"]*)"$/\1/' | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')
  if [[ "$json_list" == "$sh_list" ]]; then
    report_pass "Item 5 — codeChangingAgents 정합 ($json_list)"
  else
    report_fail "Item 5 — 불일치: JSON='$json_list' vs SH='$sh_list'"
  fi
}

# Item 6: dormant 잔재 live caller 검증 (Sprint 206 이후 0건 보장)
check_item_6_dormant_residue() {
  report_info "Item 6/6 — dormant 잔재 live caller 검증 (git grep)"
  # 패턴 문자열을 변수로 분리 (자기 매칭 회피: 본 스크립트 자체가 패턴을 literal로 포함)
  local pattern='dis''cord-send|or''acle-respond|dis''cord-receiver'
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] git grep -n -E '${pattern}' -- ':!docs/' ':!.claude/commands/agents/_base.md' ':!scripts/harness-checkup.sh'"
    return 0
  fi
  cd "$REPO_ROOT" || { report_fail "Item 6 — REPO_ROOT cd 실패"; return; }
  local hits
  hits=$(git grep -n -E "$pattern" -- ':!docs/' ':!.claude/commands/agents/_base.md' ':!scripts/harness-checkup.sh' 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$hits" -eq 0 ]]; then
    report_pass "Item 6 — dormant 키워드 잔재 0건"
  else
    report_fail "Item 6 — dormant 키워드 ${hits}건 잔존"
    git grep -n -E "$pattern" -- ':!docs/' ':!.claude/commands/agents/_base.md' ':!scripts/harness-checkup.sh' 2>/dev/null | head -5
  fi
}

main() {
  report_info "AlgoSu 하네스 정기점검 시작 (dry-run=${DRY_RUN}, repo=${REPO_ROOT})"
  echo ""
  check_item_1_cli_availability
  check_item_2_ssot_alignment
  check_item_3_model_id_compat
  check_item_4_dispatch_traces
  check_item_5_autocritic_sync
  check_item_6_dormant_residue
  echo ""
  report_info "결과: PASS=${PASS_COUNT}, WARN=${WARN_COUNT}, FAIL=${FAIL_COUNT}"
  if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main "$@"
