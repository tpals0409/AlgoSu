#!/bin/bash
# ============================================================
# AlgoSu — Layer 순차 배포 스크립트 (ci-cd-rules.md §7-2)
#
# 사용법: DEPLOY_SHA=<sha> ./deploy.sh
# 서버에서 실행 (appleboy/ssh-action 통해 호출)
# ============================================================
set -euo pipefail

NS="algosu"
DEPLOY_DIR="${DEPLOY_DIR:-/tmp/algosu-deploy}"
SHA="${DEPLOY_SHA:-unknown}"
K3S_DIR="$DEPLOY_DIR/infra/k3s"
MON_DIR="$K3S_DIR/monitoring"

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

echo "========================================="
echo "[Deploy] SHA=${SHA:0:8} NS=$NS"
echo "========================================="

echo ""
echo "[Layer 0] 인프라 (PostgreSQL / Redis / RabbitMQ)"
kubectl apply -f "$K3S_DIR/namespace.yaml"
kubectl apply -f "$K3S_DIR/postgres.yaml" \
              -f "$K3S_DIR/redis.yaml" \
              -f "$K3S_DIR/rabbitmq.yaml"
infra_rollout_check postgres 120s
infra_rollout_check redis 60s
infra_rollout_check rabbitmq 120s

echo ""
echo "[Layer 1] Identity (인증)"
kubectl apply -f "$K3S_DIR/identity-service.yaml"
rollout_or_rollback identity-service 90s

echo ""
echo "[Layer 2] Problem + Submission (비즈니스)"
kubectl apply -f "$K3S_DIR/problem-service.yaml" \
              -f "$K3S_DIR/submission-service.yaml"
rollout_or_rollback problem-service 90s
rollout_or_rollback submission-service 90s

echo ""
echo "[Layer 3] GitHub Worker + AI Analysis (비동기)"
kubectl apply -f "$K3S_DIR/github-worker.yaml" \
              -f "$K3S_DIR/ai-analysis-service.yaml"
rollout_or_rollback github-worker 60s
rollout_or_rollback ai-analysis-service 60s

echo ""
echo "[Layer 4] Gateway (라우팅)"
kubectl apply -f "$K3S_DIR/gateway.yaml"
rollout_or_rollback gateway 60s

echo ""
echo "[Layer 5] Frontend + Ingress"
kubectl apply -f "$K3S_DIR/frontend.yaml" \
              -f "$K3S_DIR/ingress.yaml"
rollout_or_rollback frontend 60s

echo ""
echo "[모니터링] Prometheus / Grafana / Loki / Promtail"
kubectl apply -f "$MON_DIR/" 2>/dev/null || true
kubectl -n "$NS" rollout status deployment/grafana --timeout=120s || true
kubectl -n "$NS" rollout status deployment/loki --timeout=60s || true
# Prometheus TSDB lock: Recreate 전략이므로 rollout 실패 가능
kubectl -n "$NS" rollout status deployment/prometheus --timeout=120s || \
  echo "[WARNING] Prometheus rollout 비정상 — 수동 확인 필요"

echo ""
echo "========================================="
echo "[완료] Deploy ${SHA:0:8} 성공"
echo "========================================="
