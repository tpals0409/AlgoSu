#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# /internal 외부 접근 차단 실 테스트
# Ingress ipAllowList(127.0.0.1/32) + InternalKeyGuard 이중 방어 검증
#
# 사용법:
#   ./scripts/test-internal-access.sh [EXTERNAL_URL]
#
# EXTERNAL_URL 미지정 시 NodePort / kubectl port-forward로 테스트
# ─────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} $label (HTTP $actual)"
    ((PASS++))
  else
    echo -e "  ${RED}[FAIL]${NC} $label — expected HTTP $expected, got HTTP $actual"
    ((FAIL++))
  fi
}

# ── 대상 URL 결정 ──
EXTERNAL_URL="${1:-}"

if [[ -z "$EXTERNAL_URL" ]]; then
  # NodePort 자동 탐지 (Traefik web entryPoint)
  NODEPORT=$(kubectl get svc -n kube-system traefik -o jsonpath='{.spec.ports[?(@.name=="web")].nodePort}' 2>/dev/null || true)
  if [[ -n "$NODEPORT" ]]; then
    EXTERNAL_URL="http://localhost:${NODEPORT}"
  else
    echo -e "${YELLOW}[INFO]${NC} Traefik NodePort 미탐지. port-forward 시도 중..."
    kubectl port-forward -n kube-system svc/traefik 8888:80 &>/dev/null &
    PF_PID=$!
    trap "kill $PF_PID 2>/dev/null || true" EXIT
    sleep 2
    EXTERNAL_URL="http://localhost:8888"
  fi
fi

echo "========================================"
echo " /internal 외부 접근 차단 테스트"
echo " 대상: ${EXTERNAL_URL}"
echo "========================================"
echo ""

# ── 1. 외부에서 /internal 경로 접근 → 403 기대 ──
echo "[테스트 1] 외부 /internal 경로 차단"

INTERNAL_PATHS=(
  "/internal/health"
  "/internal/submissions"
  "/internal/study-all/test"
  "/internal/stats/test"
)

for path in "${INTERNAL_PATHS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${EXTERNAL_URL}${path}" 2>/dev/null || echo "000")
  # 403 (ipAllowList) 또는 404 (경로 미존재) 모두 차단 성공
  if [[ "$STATUS" == "403" || "$STATUS" == "404" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${path} → HTTP ${STATUS} (차단됨)"
    ((PASS++))
  else
    echo -e "  ${RED}[FAIL]${NC} ${path} → HTTP ${STATUS} (차단 실패!)"
    ((FAIL++))
  fi
done

echo ""

# ── 2. 대소문자 우회 시도 → 차단 기대 ──
echo "[테스트 2] 대소문자 우회 시도 (/Internal, /INTERNAL)"

BYPASS_PATHS=(
  "/Internal/health"
  "/INTERNAL/health"
  "/iNtErNaL/health"
)

for path in "${BYPASS_PATHS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${EXTERNAL_URL}${path}" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "403" || "$STATUS" == "404" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${path} → HTTP ${STATUS} (차단됨)"
    ((PASS++))
  else
    echo -e "  ${RED}[FAIL]${NC} ${path} → HTTP ${STATUS} (차단 실패!)"
    ((FAIL++))
  fi
done

echo ""

# ── 3. 이중 슬래시 / 경로 조작 우회 → 차단 기대 ──
echo "[테스트 3] 경로 조작 우회 시도"

TRAVERSAL_PATHS=(
  "//internal/health"
  "/internal/../internal/health"
  "/internal%2Fhealth"
)

for path in "${TRAVERSAL_PATHS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${EXTERNAL_URL}${path}" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "403" || "$STATUS" == "404" || "$STATUS" == "400" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${path} → HTTP ${STATUS} (차단됨)"
    ((PASS++))
  else
    echo -e "  ${RED}[FAIL]${NC} ${path} → HTTP ${STATUS} (차단 실패!)"
    ((FAIL++))
  fi
done

echo ""

# ── 4. 정상 경로 접근 가능 확인 (대조군) ──
echo "[테스트 4] 정상 경로 접근 확인 (대조군)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${EXTERNAL_URL}/health" 2>/dev/null || echo "000")
if [[ "$STATUS" == "200" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} /health → HTTP ${STATUS} (접근 가능)"
  ((PASS++))
else
  echo -e "  ${YELLOW}[WARN]${NC} /health → HTTP ${STATUS} (서비스 미기동 가능성)"
fi

echo ""

# ── 5. localhost에서 /internal 접근 (클러스터 내부 시뮬레이션) ──
echo "[테스트 5] localhost /internal 접근 (허용 확인)"

# 직접 Gateway Pod로 접근 시도 (ClusterIP 경유)
GATEWAY_POD=$(kubectl get pod -n algosu -l app=gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$GATEWAY_POD" ]]; then
  INTERNAL_STATUS=$(kubectl exec -n algosu "$GATEWAY_POD" -- \
    curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    "http://localhost:3000/internal/health" 2>/dev/null || echo "000")
  if [[ "$INTERNAL_STATUS" != "403" && "$INTERNAL_STATUS" != "000" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} Pod 내부 /internal/health → HTTP ${INTERNAL_STATUS} (접근 가능)"
    ((PASS++))
  else
    echo -e "  ${YELLOW}[WARN]${NC} Pod 내부 /internal/health → HTTP ${INTERNAL_STATUS}"
  fi
else
  echo -e "  ${YELLOW}[SKIP]${NC} Gateway Pod 미탐지 — 클러스터 내부 테스트 생략"
fi

echo ""
echo "========================================"
echo -e " 결과: ${GREEN}PASS ${PASS}${NC} / ${RED}FAIL ${FAIL}${NC}"
echo "========================================"

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}⚠ /internal 차단 실패 항목이 있습니다. Ingress 설정을 확인하세요.${NC}"
  exit 1
fi

echo -e "${GREEN}모든 /internal 차단 테스트를 통과했습니다.${NC}"
exit 0
