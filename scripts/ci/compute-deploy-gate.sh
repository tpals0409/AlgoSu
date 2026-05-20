#!/usr/bin/env bash
# ============================================================
# @file    scripts/ci/compute-deploy-gate.sh
# @domain  ci
# @layer   shared/helper
# @related .github/workflows/ci.yml (deploy / deploy-simulation jobs)
#
# Sprint 173 시드 #신규4: deploy 게이트의 fail-closed 판정 로직을 순수 함수로
# 추출. deploy job(main 전용) 과 deploy-simulation job(PR shift-left) 이 동일
# 헬퍼를 공유하여, PR 작성자가 머지 전에 "어떤 서비스가 배포/SKIP 되는지" 를
# 동일한 규칙으로 미리 볼 수 있게 한다.
#
# 보안 의미 (fail-closed — Sprint 159 회귀 + Critic R1 P1 보안 게이트 핵심):
#   각 후보 서비스의 trivy-status/<svc>.txt 값이 *정확히* "pass" 일 때만 UPDATED.
#   그 외(fail / 파일 누락(missing) / 유사값("passed","PASS") 등) 전부 SKIPPED.
#   "pass" 외 모든 경로는 차단 → 보안 게이트 우회 불가.
#
# 후보 서비스 목록은 GitHub Actions context(detect-changes outputs + build job
# result)에 의존하므로 caller(ci.yml)가 계산하여 인자로 넘긴다. 본 헬퍼는 그
# 후보들에 대해 trivy 게이트만 적용한다 (단일 책임).
#
# 출력 규약:
#   - 사람용 진행 로그(✓ / ⚠) 는 stderr 로 (step 로그에 그대로 보임)
#   - 기계 파싱용 결과는 stdout 에 정확히 두 줄:
#       updated=<공백구분 목록>
#       skipped_trivy=<공백구분 목록>
#
# 사용법:
#   compute-deploy-gate.sh <status_dir> [service ...]
#
# 인자:
#   $1        status_dir   trivy-status 디렉토리 (각 서비스 <svc>.txt 존재)
#   $2..$N    service ...  후보 서비스명 (0개 가능)
# ============================================================
set -euo pipefail

STATUS_DIR="${1:?usage: $0 <status_dir> [service ...]}"
shift

UPDATED=""
SKIPPED_TRIVY=""

# 후보 서비스별 Trivy 결과 lookup → 명시적 "pass" 만 통과 (fail-closed)
# 파일 누락 시 "missing" 으로 처리하여 SKIPPED 분류 (보안 게이트 우회 방지)
for SVC in "$@"; do
  STATUS=$(cat "${STATUS_DIR}/${SVC}.txt" 2>/dev/null || echo "missing")
  if [ "$STATUS" != "pass" ]; then
    SKIPPED_TRIVY="${SKIPPED_TRIVY} ${SVC}"
    echo "  ⚠ algosu-${SVC} SKIPPED (Trivy status: ${STATUS} — service-scoped security gate, 다른 service 는 정상 진행)" >&2
    continue
  fi
  UPDATED="${UPDATED} ${SVC}"
  echo "  ✓ algosu-${SVC} passed Trivy gate" >&2
done

# 앞뒤 공백 trim 후 기계 파싱용 두 줄 출력 (stdout)
echo "updated=$(echo "$UPDATED" | xargs)"
echo "skipped_trivy=$(echo "$SKIPPED_TRIVY" | xargs)"
