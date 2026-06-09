#!/bin/bash
# ============================================================
# @file    scripts/deploy.sh
# @domain  ci
# @layer   shared/helper
# @related infra/DEPLOYMENT.md, docs/conventions/ci-cd.md, docs/adr/ADR-029-infra-ssot-consolidation.md
#
# AlgoSu — 긴급 복구 배포 스크립트 (ADR-029: 배포 SSOT = aether-gitops)
#
# 운영 정상 배포는 ArgoCD가 aether-gitops를 자동 sync한다. 본 스크립트는
# ArgoCD 장애 등 긴급 상황에서 aether-gitops 매니페스트를 직접 적용하는
# 안전망이다. AlgoSu 레포 내 평행 매니페스트 정의(구 infra/k3s)는 폐기되어,
# 매니페스트 SSOT는 aether-gitops 하나로 일원화되었다.
#
# 사용법:
#   GITOPS_TOKEN=<pat> ./scripts/deploy.sh               # private repo clone
#   GITOPS_LOCAL=/path/to/aether-gitops ./scripts/deploy.sh   # 로컬 클론 재사용
#
# 환경변수:
#   GITOPS_TOKEN    aether-gitops clone용 PAT (GITOPS_LOCAL 미사용 시 필수)
#   GITOPS_LOCAL    로컬 aether-gitops 경로 (있으면 clone 생략)
#   GITOPS_OVERLAY  적용할 overlay (기본: algosu/overlays/prod)
# ============================================================
set -euo pipefail

NS="algosu"
GITOPS_REPO="${GITOPS_REPO:-github.com/tpals0409/aether-gitops.git}"
GITOPS_OVERLAY="${GITOPS_OVERLAY:-algosu/overlays/prod}"
GITOPS_DIR="${GITOPS_DIR:-/tmp/algosu-gitops}"

# 인프라 롤아웃 확인 (자동 롤백 불가 — 수동 개입 필요)
infra_rollout_check() {
  local name="$1"
  local timeout="${2:-120s}"
  echo "  → infra check: $name (timeout: $timeout)"
  if ! kubectl -n "$NS" rollout status "deployment/$name" --timeout="$timeout"; then
    echo "::error::인프라 $name rollout 실패 — 자동 롤백 불가, 수동 개입 필요"
    exit 1
  fi
  echo "  ✓ $name"
}

# 서비스 롤아웃 + 실패 시 자동 롤백
rollout_or_rollback() {
  local name="$1"
  local timeout="${2:-90s}"
  echo "  → rollout: $name (timeout: $timeout)"
  if ! kubectl -n "$NS" rollout status "deployment/$name" --timeout="$timeout"; then
    echo "  [ROLLBACK] $name 실패 — undo 실행"
    kubectl -n "$NS" rollout undo "deployment/$name"
    kubectl -n "$NS" rollout status "deployment/$name" --timeout=60s || true
    echo "::error::Deploy failed at $name — rollback executed"
    exit 1
  fi
  echo "  ✓ $name"
}

# ── 매니페스트 소스 결정: 로컬 클론 우선, 없으면 토큰으로 clone ──
if [ -n "${GITOPS_LOCAL:-}" ] && [ -d "$GITOPS_LOCAL" ]; then
  SRC="$GITOPS_LOCAL"
  echo "[Source] 로컬 aether-gitops: $SRC"
else
  : "${GITOPS_TOKEN:?GITOPS_TOKEN 또는 GITOPS_LOCAL 필요}"
  rm -rf "$GITOPS_DIR"
  git clone --depth 1 "https://x-access-token:${GITOPS_TOKEN}@${GITOPS_REPO}" "$GITOPS_DIR"
  SRC="$GITOPS_DIR"
  echo "[Source] aether-gitops clone: $SRC"
fi

OVERLAY_PATH="$SRC/$GITOPS_OVERLAY"
[ -d "$OVERLAY_PATH" ] || { echo "::error::overlay 경로 없음: $OVERLAY_PATH"; exit 1; }
REV="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "========================================="
echo "[Deploy] aether-gitops=${REV} overlay=${GITOPS_OVERLAY} NS=${NS}"
echo "========================================="

# 전체 매니페스트 일괄 적용 (kustomize 렌더 — 단일 SSOT)
echo ""
echo "[Apply] kubectl apply -k ${GITOPS_OVERLAY}"
kubectl apply -k "$OVERLAY_PATH"

# 일괄 apply는 순서를 보장하지 않으므로, layer 순으로 rollout 대기(schema mismatch 방지 안전망)
echo ""
echo "[Layer 0] 인프라 (PostgreSQL / Redis / RabbitMQ)"
infra_rollout_check postgres 120s
infra_rollout_check redis 60s
infra_rollout_check rabbitmq 120s

echo ""
echo "[Layer 1] Identity (인증)"
rollout_or_rollback identity-service 90s

echo ""
echo "[Layer 2] Problem + Submission (비즈니스)"
rollout_or_rollback problem-service 90s
rollout_or_rollback submission-service 90s

echo ""
echo "[Layer 3] GitHub Worker + AI Analysis (비동기)"
rollout_or_rollback github-worker 60s
rollout_or_rollback ai-analysis-service 60s

echo ""
echo "[Layer 4] Gateway (라우팅)"
rollout_or_rollback gateway 60s

echo ""
echo "[Layer 5] Frontend"
rollout_or_rollback frontend 60s

echo ""
echo "[모니터링] Prometheus / Grafana / Loki / Promtail"
kubectl -n "$NS" rollout status deployment/grafana --timeout=120s || true
kubectl -n "$NS" rollout status deployment/loki --timeout=60s || true
# Prometheus TSDB lock: Recreate 전략이므로 rollout 실패 가능
kubectl -n "$NS" rollout status deployment/prometheus --timeout=120s || \
  echo "[WARNING] Prometheus rollout 비정상 — 수동 확인 필요"

echo ""
echo "========================================="
echo "[완료] Deploy aether-gitops=${REV} 성공"
echo "========================================="
