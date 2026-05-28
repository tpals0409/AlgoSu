#!/usr/bin/env bash
# @file scripts/harness-checkup.sh
# @domain local-dev/harness
# @layer ops
# @related docs/runbook/harness-checkup.md, docs/runbook/claude-tools.md, docs/runbook/oracle-model-ssot.md
# AlgoSu 하네스 정기점검 자동화 (Sprint 206 시드, Sprint 202 신규 패턴 영속화)
# 사용법: scripts/harness-checkup.sh [--dry-run]
set -uo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

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
    report_info "  [dry-run] sed -n '17,79p' ${ORACLE_BIN}/oracle-spawn.sh | grep -E 'opus|sonnet|haiku'"
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
  report_pass "Item 2 — agents ${agents_count}개 발견 (모델 매핑은 시드 단계 — 다음 sprint에서 spawn.sh get_model() 정합 자동 비교 추가)"
}

# Item 3: 환경 컨텍스트 모델 ID vs 설정 일치 (시드는 대표 1개)
check_item_3_model_id_compat() {
  report_info "Item 3/6 — 환경 컨텍스트 모델 ID 호환 (claude --model dry-run)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] claude --model claude-opus-4-7 -p 'ping'"
    return 0
  fi
  if ! command -v claude >/dev/null 2>&1; then
    report_warn "Item 3 — claude CLI 미발견 (Item 1과 중복 신호, 스킵)"
    return
  fi
  # 시드 단계: 대표 모델 1개만. 다음 sprint에서 12 에이전트 전체로 확장.
  report_warn "Item 3 — 시드 단계 (실제 LLM 호출은 정기점검 sprint에서 활성화). 명령 영속화만: claude --model claude-opus-4-7 -p 'ping'"
}

# Item 4: dispatch fire 흔적 (최근 7일 정상 종료 로그)
check_item_4_dispatch_traces() {
  report_info "Item 4/6 — dispatch fire 흔적 (~/.claude/oracle/logs/)"
  if [[ $DRY_RUN -eq 1 ]]; then
    report_info "  [dry-run] find ${ORACLE_LOGS} -name '*.out' -mtime -7"
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
