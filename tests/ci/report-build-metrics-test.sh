#!/usr/bin/env bash
# ============================================================
# @file    tests/ci/report-build-metrics-test.sh
# @domain  ci
# @layer   test/helper
# @related scripts/ci/report-build-metrics.sh
#
# Sprint 169 시드 #168-4: report-build-metrics.sh 헬퍼의 회귀 차단용
# 순수 bash 단위 테스트 (외부 의존성 0 — bats 미사용).
# CI 의 quality-ci-scripts job 에서 scripts/ci/** 또는 tests/ci/** 변경 시 실행.
#
# 검증 케이스:
#   1. 인자 미전달 fail-fast (${1:?} / ${2:?})
#   2. zstd 분기 compression saving % 계산
#   3. zstd 미전달 분기 (oci+zstd 라인 미출력)
#   4. GITHUB_STEP_SUMMARY 미설정 → /dev/stdout fallback + ::warning::
#   5. docker buildx du 실패 → graceful N/A / 0 fallback (build job fail 금지)
#   6. docker buildx du 정상 → cache size/entries 파싱
#
# 환경 의존:
#   - GNU coreutils (stat -c %s) — 헬퍼가 ubuntu-latest 를 전제. 비-GNU(예: macOS
#     BSD stat) 환경에서는 SKIP(exit 0) 처리하여 로컬 실행이 false-red 되지 않도록 함.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELPER="${REPO_ROOT}/scripts/ci/report-build-metrics.sh"

# --- 환경 가드: 헬퍼가 GNU stat -c 전제 (CI ubuntu-latest 전용) ---
if ! stat -c %s "${BASH_SOURCE[0]}" >/dev/null 2>&1; then
  echo "SKIP: report-build-metrics.sh 는 GNU coreutils(stat -c) 전제 — CI(ubuntu-latest) 전용 테스트. 현재 환경 스킵."
  exit 0
fi

if [ ! -f "$HELPER" ]; then
  echo "FAIL: helper not found at $HELPER"
  exit 1
fi

PASS=0
FAIL=0
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# --- docker PATH shim: STUB_DOCKER_MODE(ok|fail)로 buildx du 동작 제어 ---
# 실제 docker 데몬 의존을 제거해 테스트를 결정적으로 만든다.
STUB_BIN="${WORKDIR}/bin"
mkdir -p "$STUB_BIN"
cat > "${STUB_BIN}/docker" <<'STUB'
#!/usr/bin/env bash
if [ "${STUB_DOCKER_MODE:-fail}" = "ok" ]; then
  case "$*" in
    "buildx du --verbose") printf 'Total:\t123MB\t100MB\n' ;;
    "buildx du")           printf 'ID\tRECLAIMABLE\nabc\ttrue\ndef\tfalse\n' ;;
    *) : ;;
  esac
  exit 0
fi
exit 1
STUB
chmod +x "${STUB_BIN}/docker"
export PATH="${STUB_BIN}:${PATH}"

# --- assertion helpers ---
pass() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; return 0; }

mk_file() { head -c "$1" /dev/zero > "$2"; }

DOCKER_TAR="${WORKDIR}/image.tar"
mk_file 1000 "$DOCKER_TAR"

# === Case 1: 인자 미전달 fail-fast ===
echo "[Case 1] 인자 미전달 fail-fast"
STUB_DOCKER_MODE=fail bash "$HELPER" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ]; then pass "no args → exit ${rc} (nonzero)"; else fail "no args should fail" "got exit 0"; fi
STUB_DOCKER_MODE=fail bash "$HELPER" "label-only" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ]; then pass "missing docker tarball arg → exit ${rc}"; else fail "missing \$2 should fail" "got exit 0"; fi

# === Case 2: zstd 분기 compression saving % ===
echo "[Case 2] zstd 분기 compression saving %"
ZSTD_TAR="${WORKDIR}/image-zstd.tar"
mk_file 250 "$ZSTD_TAR"
OUT="${WORKDIR}/summary2.md"
GITHUB_STEP_SUMMARY="$OUT" STUB_DOCKER_MODE=fail BUILD_START=$(( $(date +%s) - 65 )) \
  bash "$HELPER" "ai-analysis" "$DOCKER_TAR" "$ZSTD_TAR"; rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if grep -qF -- "-75.0%" "$OUT"; then pass "compression saving -75.0% (1000→250)"; else fail "saving % wrong" "$(grep -i saving "$OUT" || true)"; fi
if grep -qF -- "(250 bytes)" "$OUT"; then pass "zstd bytes shown"; else fail "zstd bytes missing"; fi
if grep -qF -- "### 📦 ai-analysis build artifact" "$OUT"; then pass "H3 label header"; else fail "header missing"; fi

# === Case 3: zstd 미전달 분기 ===
echo "[Case 3] zstd 미전달 분기"
OUT="${WORKDIR}/summary3.md"
GITHUB_STEP_SUMMARY="$OUT" STUB_DOCKER_MODE=fail bash "$HELPER" "frontend" "$DOCKER_TAR"; rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if grep -qF -- "(1000 bytes)" "$OUT"; then pass "docker bytes shown"; else fail "docker bytes missing"; fi
if ! grep -qF -- "oci+zstd" "$OUT"; then pass "no oci+zstd line (arg 미전달)"; else fail "oci+zstd should be absent"; fi

# === Case 4: GITHUB_STEP_SUMMARY 미설정 → stdout fallback ===
echo "[Case 4] GITHUB_STEP_SUMMARY 미설정 → stdout fallback"
OUT="${WORKDIR}/stdout4.txt"
( unset GITHUB_STEP_SUMMARY; STUB_DOCKER_MODE=fail bash "$HELPER" "blog" "$DOCKER_TAR" ) > "$OUT" 2>&1; rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if grep -qF -- "::warning::GITHUB_STEP_SUMMARY is not set" "$OUT"; then pass "warning emitted"; else fail "warning missing"; fi
if grep -qF -- "### 📦 blog build artifact" "$OUT"; then pass "summary to stdout"; else fail "stdout summary missing"; fi

# === Case 5: docker buildx du 실패 → graceful fallback ===
echo "[Case 5] docker buildx du 실패 → N/A / 0 graceful fallback"
OUT="${WORKDIR}/summary5.md"
GITHUB_STEP_SUMMARY="$OUT" STUB_DOCKER_MODE=fail bash "$HELPER" "gateway" "$DOCKER_TAR"; rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0 (telemetry 실패가 build job fail 유발 안 함)"; else fail "should exit 0" "got ${rc}"; fi
if grep -qF -- "cache size: **N/A**" "$OUT"; then pass "cache size N/A fallback"; else fail "cache size fallback missing" "$(grep -i 'cache size' "$OUT" || true)"; fi
if grep -qF -- "cache entries: **0**" "$OUT"; then pass "cache entries 0 fallback"; else fail "cache entries fallback missing"; fi

# === Case 6: docker buildx du 정상 → cache 파싱 ===
echo "[Case 6] docker buildx du 정상 → cache size/entries 파싱"
OUT="${WORKDIR}/summary6.md"
GITHUB_STEP_SUMMARY="$OUT" STUB_DOCKER_MODE=ok bash "$HELPER" "submission" "$DOCKER_TAR"; rc=$?
if [ "$rc" -eq 0 ]; then pass "exit 0"; else fail "should exit 0" "got ${rc}"; fi
if grep -qF -- "cache size: **123MB 100MB**" "$OUT"; then pass "cache size parsed"; else fail "cache size parse wrong" "$(grep -i 'cache size' "$OUT" || true)"; fi
if grep -qF -- "cache entries: **2**" "$OUT"; then pass "cache entries counted (2)"; else fail "cache entries wrong" "$(grep -i 'cache entries' "$OUT" || true)"; fi

# === 결과 ===
echo ""
echo "=========================================="
echo "  PASS: ${PASS}  /  FAIL: ${FAIL}"
echo "=========================================="
[ "$FAIL" -eq 0 ] || exit 1
