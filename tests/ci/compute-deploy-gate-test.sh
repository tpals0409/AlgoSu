#!/usr/bin/env bash
# ============================================================
# @file    tests/ci/compute-deploy-gate-test.sh
# @domain  ci
# @layer   test/helper
# @related scripts/ci/compute-deploy-gate.sh
#
# Sprint 173 시드 #신규4: compute-deploy-gate.sh 헬퍼의 회귀 차단용
# 순수 bash 단위 테스트 (외부 의존성 0 — bats/docker 미사용).
# CI 의 quality-ci-scripts job 에서 scripts/ci/** 또는 tests/ci/** 변경 시 실행.
#
# 검증 케이스:
#   1. 인자 미전달(status_dir 없음) → fail-fast (${1:?})
#   2. 모든 후보 pass → updated 전부, skipped 비어있음
#   3. 일부 fail → 해당만 skipped, 나머지 updated
#   4. status 파일 없음(missing) → skipped (fail-closed 핵심)
#   5. 혼합(pass/fail/missing) → 정확 분할
#   6. 후보 0개 → updated/skipped 모두 빈 문자열, exit 0
#   7. "pass" 유사값(passed, PASS) → skipped (정확 일치만 통과, fail-closed)
#
# 환경 의존: 순수 bash + coreutils(cat) 만 사용 — macOS/Linux 모두 동작.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELPER="${REPO_ROOT}/scripts/ci/compute-deploy-gate.sh"

if [ ! -f "$HELPER" ]; then
  echo "FAIL: helper not found at $HELPER"
  exit 1
fi

PASS=0
FAIL=0
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# --- assertion helpers ---
pass() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; return 0; }

# trivy-status 디렉토리에 <svc>.txt = <status> 작성
mk_status() { printf '%s' "$2" > "${WORKDIR}/$1.txt"; }
reset_dir() { rm -f "${WORKDIR}"/*.txt 2>/dev/null || true; }

# === Case 1: 인자 미전달 fail-fast ===
echo "[Case 1] 인자 미전달(status_dir 없음) fail-fast"
bash "$HELPER" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ]; then pass "no status_dir → exit ${rc} (nonzero)"; else fail "no args should fail" "got exit 0"; fi

# === Case 2: 모든 후보 pass ===
echo "[Case 2] 모든 후보 pass → updated 전부, skipped 비어있음"
reset_dir
mk_status gateway pass
mk_status submission pass
OUT=$(bash "$HELPER" "$WORKDIR" gateway submission 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated=gateway submission"; then pass "updated=gateway submission"; else fail "updated wrong" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy="; then pass "skipped empty"; else fail "skipped should be empty" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === Case 3: 일부 fail ===
echo "[Case 3] 일부 fail → 해당만 skipped"
reset_dir
mk_status gateway pass
mk_status problem fail
mk_status frontend pass
OUT=$(bash "$HELPER" "$WORKDIR" gateway problem frontend 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated=gateway frontend"; then pass "updated=gateway frontend"; else fail "updated wrong" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy=problem"; then pass "skipped_trivy=problem"; else fail "skipped wrong" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === Case 4: status 파일 없음(missing) → skipped (fail-closed 핵심) ===
echo "[Case 4] status 파일 없음(missing) → skipped (fail-closed)"
reset_dir
mk_status gateway pass
# blog.txt 의도적으로 미생성
OUT=$(bash "$HELPER" "$WORKDIR" gateway blog 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated=gateway"; then pass "updated=gateway"; else fail "updated wrong" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy=blog"; then pass "missing → skipped_trivy=blog"; else fail "missing should be skipped" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === Case 5: 혼합(pass/fail/missing) ===
echo "[Case 5] 혼합(pass/fail/missing) → 정확 분할"
reset_dir
mk_status gateway pass
mk_status submission fail
mk_status problem pass
# ai-analysis.txt 미생성 (missing)
OUT=$(bash "$HELPER" "$WORKDIR" gateway submission problem ai-analysis 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated=gateway problem"; then pass "updated=gateway problem"; else fail "updated wrong" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy=submission ai-analysis"; then pass "skipped=submission ai-analysis"; else fail "skipped wrong" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === Case 6: 후보 0개 ===
echo "[Case 6] 후보 0개 → updated/skipped 빈 문자열, exit 0"
reset_dir
OUT=$(bash "$HELPER" "$WORKDIR" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated="; then pass "updated empty"; else fail "updated should be empty" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy="; then pass "skipped empty"; else fail "skipped should be empty" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === Case 7: "pass" 유사값 → skipped (정확 일치만 통과) ===
echo "[Case 7] 유사값(passed, PASS) → skipped (정확 일치만 통과, fail-closed)"
reset_dir
mk_status gateway passed
mk_status submission PASS
mk_status problem pass
OUT=$(bash "$HELPER" "$WORKDIR" gateway submission problem 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if echo "$OUT" | grep -qx "updated=problem"; then pass "only exact 'pass' → updated=problem"; else fail "updated wrong" "$(echo "$OUT" | grep '^updated=')"; fi
if echo "$OUT" | grep -qx "skipped_trivy=gateway submission"; then pass "passed/PASS → skipped"; else fail "similar values should be skipped" "$(echo "$OUT" | grep '^skipped_trivy=')"; fi

# === 결과 ===
echo ""
echo "=========================================="
echo "  PASS: ${PASS}  /  FAIL: ${FAIL}"
echo "=========================================="
[ "$FAIL" -eq 0 ] || exit 1
