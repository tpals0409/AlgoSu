#!/usr/bin/env bash
# ============================================================
# @file    scripts/ci/report-build-metrics.sh
# @domain  ci
# @layer   shared/helper
# @related .github/workflows/ci.yml (build-services / build-frontend / build-blog)
#
# Sprint 168 시드 #167-3: 3 build job 의 "Report build artifact metrics" step
# 중복(약 30줄 × 3 = 90줄) 을 단일 헬퍼로 통합. ci.yml 의 호출은 1줄로 단축.
#
# Sprint 165 옵션 C (보안) → Sprint 166 baseline (가시성) → Sprint 167 실측 →
# Sprint 168 zstd 전면 채택 (compression saving 63.7%) 사이클의 운영 통합 단계.
#
# 사용법:
#   bash scripts/ci/report-build-metrics.sh <label> <docker_tarball> [zstd_tarball]
#
# 인자:
#   $1 label          섹션 제목용 식별자 (예: ai-analysis, frontend, blog)
#   $2 docker_tarball docker tarball 경로 (예: /tmp/image-ai-analysis.tar)
#   $3 zstd_tarball   (optional) zstd tarball 경로. 존재 시 compression saving % 출력
#
# 의존 환경변수:
#   BUILD_START         build step 직전 epoch (date +%s, ci.yml "Record build start time")
#   GITHUB_STEP_SUMMARY GitHub Actions 가 주입하는 Summary 파일 경로
#
# 안전 정책:
#   - awk -v 변수 전달 (shell expansion 의존 회피, Sprint 166 표준 패턴)
#   - || N/A graceful fallback (nice-to-have 신호의 hard fail 차단, Sprint 167 정책)
#   - docker buildx du 의 footer (Shared/Private/Reclaimable/Total) 명시 제외
#     (Sprint 167 Critic R1 P3 fix 의 entries 카운트 부풀려짐 차단)
# ============================================================
set -euo pipefail

LABEL="${1:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
DOCKER_TARBALL="${2:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
ZSTD_TARBALL="${3:-}"

if [ -z "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "::warning::GITHUB_STEP_SUMMARY is not set — running outside GitHub Actions, output to stdout instead"
  GITHUB_STEP_SUMMARY=/dev/stdout
fi

SIZE_BYTES=$(stat -c %s "$DOCKER_TARBALL")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')

BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - ${BUILD_START:-$BUILD_END}))
DURATION_FMT=$(awk -v s="$BUILD_DURATION" 'BEGIN {printf "%dm %ds", int(s/60), s%60}')

CACHE_DU=$(docker buildx du --verbose 2>/dev/null | awk '/^Total:/ {print $2, $3; exit}')
[ -z "$CACHE_DU" ] && CACHE_DU="N/A"

CACHE_ENTRIES=$(docker buildx du 2>/dev/null \
  | awk 'NR > 1 && !/^(ID|Reclaimable|Shared|Private|Total):/ && NF > 0 {count++} END {print count+0}')
[ -z "$CACHE_ENTRIES" ] && CACHE_ENTRIES="0"

{
  echo "### 📦 ${LABEL} build artifact"
  echo "- tarball size (docker): **${SIZE_MB} MB** (${SIZE_BYTES} bytes)"
  echo "- build duration: **${DURATION_FMT}** (${BUILD_DURATION}s)"
  echo "- cache size: **${CACHE_DU}**"
  echo "- cache entries: **${CACHE_ENTRIES}**"
  echo "- path: \`${DOCKER_TARBALL}\`"
  echo "- retention: 1 day"

  if [ -n "$ZSTD_TARBALL" ] && [ -f "$ZSTD_TARBALL" ]; then
    ZSTD_BYTES=$(stat -c %s "$ZSTD_TARBALL")
    ZSTD_MB=$(awk -v b="$ZSTD_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')
    SAVE_PCT=$(awk -v d="$SIZE_BYTES" -v z="$ZSTD_BYTES" 'BEGIN {printf "%.1f", (1 - z/d) * 100}')
    echo "- tarball size (oci+zstd): **${ZSTD_MB} MB** (${ZSTD_BYTES} bytes)"
    echo "- compression saving: **-${SAVE_PCT}%** (zstd vs docker)"
  elif [ -n "$ZSTD_TARBALL" ]; then
    echo "- tarball size (oci+zstd): N/A (file not produced at ${ZSTD_TARBALL})"
  fi
} >> "$GITHUB_STEP_SUMMARY"
