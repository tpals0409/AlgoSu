#!/usr/bin/env bash
# ============================================================
# @file    tests/ci/harness-checkup-test.sh
# @domain  ci
# @layer   test/helper
# @related scripts/harness-checkup.sh, docs/runbook/harness-checkup.md
#
# Sprint 209 A2: harness-checkup.sh 의 회귀 차단용 순수 bash 단위 테스트.
# harness-checkup.sh --full 은 로컬 sprint마감 전용(API 호출·~/.claude/oracle 의존)이라
# CI 게이트에 부적합 — 본 테스트는 CI portable한 로직(소스 가드 / dry-run / Item 5 3-way
# 정합 / Item 5 degrade / Item 6 dormant·로드맵)만 검증한다.
#
# CI 의 quality-ci-scripts job 에서 scripts/** 또는 tests/ci/** 변경 시 실행.
# 환경 의존: bash + coreutils + git + jq (GitHub ubuntu-latest 기본 제공).
#   - ~/.claude/oracle/* (git 외부) 부재해도 통과해야 함 (degrade 경로 검증이 목적).
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HARNESS="${REPO_ROOT}/scripts/harness-checkup.sh"
TEAM_JSON="${REPO_ROOT}/.claude-team.json"
BASE_MD="${REPO_ROOT}/.claude/commands/agents/_base.md"

if [ ! -f "$HARNESS" ]; then
  echo "FAIL: harness not found at $HARNESS"
  exit 1
fi

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; return 0; }

# === Case 1: --dry-run smoke (모든 항목 명령 영속화, exit 0) ===
echo "[Case 1] --dry-run smoke → exit 0 + 6 항목 출력"
OUT=$(bash "$HARNESS" --dry-run 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then pass "dry-run exit 0"; else fail "dry-run should exit 0" "got ${rc}"; fi
for item in "Item 1/6" "Item 2/6" "Item 3/6" "Item 4/6" "Item 5/6" "Item 6/6"; do
  if echo "$OUT" | grep -qF "$item"; then pass "dry-run 출력에 ${item}"; else fail "dry-run 출력 ${item} 누락"; fi
done

# === Case 2: 소스 가드 — source 시 main 미실행 (함수만 로드) ===
echo "[Case 2] 소스 가드 → source 시 main 미실행"
OUT=$(source "$HARNESS"; echo "loaded=$(declare -F check_item_5_autocritic_sync >/dev/null && echo yes)" 2>&1)
if echo "$OUT" | grep -qx "loaded=yes"; then pass "source 시 함수 로드됨"; else fail "함수 미로드" "$OUT"; fi
if echo "$OUT" | grep -q "결과:"; then fail "source 시 main 이 실행됨 (가드 실패)" "$OUT"; else pass "source 시 main 미실행"; fi

# === Case 3: Item 5 3-way SSOT 정합 invariant (FAIL 없어야 함) ===
echo "[Case 3] Item 5 — tracked SSOT(json ↔ _base.md) 정합"
OUT=$(source "$HARNESS"; check_item_5_autocritic_sync 2>&1)
if echo "$OUT" | grep -q "\[FAIL\]"; then fail "Item 5 FAIL 발생 — tracked SSOT 불일치" "$OUT"; else pass "Item 5 FAIL 없음"; fi
# 스크립트와 독립적으로 invariant 재검증: json ↔ _base.md 동일 9-에이전트
JSON_LIST=$(jq -r '.dispatch.codeChangingAgents[]' "$TEAM_JSON" 2>/dev/null | tr ' ,' '\n' | grep -v '^$' | sort | tr '\n' ' ' | sed 's/ $//')
BASE_LIST=$(grep -oE 'code-changing 에이전트\([^)]*\)' "$BASE_MD" | head -1 | sed -E 's/.*\(([^)]*)\).*/\1/' | tr ' ,' '\n' | grep -v '^$' | sort | tr '\n' ' ' | sed 's/ $//')
if [ -n "$JSON_LIST" ] && [ "$JSON_LIST" = "$BASE_LIST" ]; then pass "json ↔ _base.md 9-에이전트 정합 ($JSON_LIST)"; else fail "json ↔ _base.md 불일치" "JSON='$JSON_LIST' BASE='$BASE_LIST'"; fi

# === Case 4: Item 5 degrade — oracle-auto-critic.sh 부재 시 WARN (CI portable) ===
echo "[Case 4] Item 5 degrade → oracle-auto-critic.sh 부재 시 WARN(FAIL 아님)"
OUT=$(source "$HARNESS"; ORACLE_BIN="/tmp/nonexistent-oracle-bin-$$"; check_item_5_autocritic_sync 2>&1)
if echo "$OUT" | grep -q "\[FAIL\]"; then fail "degrade 경로에서 FAIL 발생" "$OUT"; else pass "degrade 경로 FAIL 없음"; fi
if echo "$OUT" | grep -q "\[WARN\].*2-way"; then pass "oracle-auto-critic.sh 부재 → 2-way degrade WARN"; else fail "degrade WARN 미발생" "$OUT"; fi

# === Case 5: Item 6 portable (dormant·tracked·로드맵, FAIL 없어야 함) ===
echo "[Case 5] Item 6 — dormant·tracked·정리 로드맵 (FAIL 없음)"
OUT=$(source "$HARNESS"; check_item_6_dormant_residue 2>&1)
if echo "$OUT" | grep -q "\[FAIL\]"; then fail "Item 6 FAIL 발생" "$OUT"; else pass "Item 6 FAIL 없음"; fi
if echo "$OUT" | grep -q "dormant 키워드 잔재 0건"; then pass "dormant 키워드 0건"; else fail "dormant 0건 미확인" "$OUT"; fi
if echo "$OUT" | grep -q "정리 로드맵 삭제 작업 Phase 전체 ✅"; then pass "§4 로드맵 삭제 Phase 전체 완료"; else fail "§4 로드맵 점검 미통과" "$OUT"; fi

# === Case 6: dormant 키워드 invariant 독립 재검증 ===
echo "[Case 6] dormant 키워드 git grep invariant (0건)"
PATTERN='dis''cord-send|or''acle-respond|dis''cord-receiver'
HITS=$(cd "$REPO_ROOT" && git grep -n -E "$PATTERN" -- ':!docs/' ':!.claude/commands/agents/_base.md' ':!scripts/harness-checkup.sh' ':!tests/ci/harness-checkup-test.sh' 2>/dev/null | wc -l | tr -d ' ')
if [ "$HITS" -eq 0 ]; then pass "dormant 키워드 live caller 0건"; else fail "dormant 키워드 ${HITS}건 잔존"; fi

# === 결과 ===
echo ""
echo "=========================================="
echo "  PASS: ${PASS}  /  FAIL: ${FAIL}"
echo "=========================================="
[ "$FAIL" -eq 0 ] || exit 1
