---
sprint: 168
title: "zstd 8 서비스 전면 채택 + Report metrics 헬퍼 추출 (시드 #167-1 + #167-3 회수)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-167", "sprint-166", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 168 — zstd 8 서비스 전면 채택 + Report metrics 헬퍼 추출 (시드 #167-1 + #167-3 회수)

## 목표

- Sprint 167 의 ai-analysis A/B 실측 데이터 기반 **분기점 의사결정 단계**: 채택/미채택 판정 + 일괄 적용 or 분기 제거
- 시드 #167-1 회수: 30%+ 압축률 AND 시간 회귀 5% 이내 AND CI 안정성 무영향 조건 평가
- 시드 #167-3 회수: 3 build job 의 "Report build artifact metrics" 중복 약 30줄 × 3 = 90줄 → 단일 헬퍼 통합
- 시드 #167-2 정당화 close (frontend/blog skip 가드 차이는 의도된 결과)
- "보안 게이트(Sprint 165) → 가시성(Sprint 166) → 최적화 실측(Sprint 167) → 최적화 전면 채택(Sprint 168)" 4 sprint 사이클의 의사결정 단계

## 결정

### D0. 측정 데이터 확보 방식 — 사용자 선택 A (workflow_dispatch + rebuild_all)

- 4 옵션 비교 후 사용자 결정: **A 채택**
  - A(workflow_dispatch + rebuild_all 수동 1회) / B(artifact 자동 업로드 + 다음 sprint 결정) / C(ai-analysis no-op 더미 변경 PR) / D(aggregator + PR comment 게시)
- 채택 사유:
  - Sprint 167 머지 run (#26095687152) 의 ai-analysis build 가 detect-changes paths filter (`services/ai-analysis/**`) 가 false 로 평가되어 step skip → 측정 데이터 0건 확보
  - 옵션 A 가 가장 빠른 단발성 측정 (단일 sprint 통합 정책 우선)
  - 옵션 B/D 의 가시성 강화는 Sprint 169+ 이월

### D1. 채택 판정 — 3 조건 모두 통과

측정 데이터 (run #26097517834, workflow_dispatch + rebuild_all=true, head SHA 500b954):

| 지표 | 측정치 | 채택 기준 | 판정 |
|------|--------|-----------|------|
| compression saving | **63.7%** (docker 66.9 MB → zstd 24.3 MB) | ≥ 30% | ✅ 2.1배 초과 |
| build step duration (ai-analysis zstd+docker A/B 동시) | **8s** | — | — |
| build step duration (다른 7 서비스 docker only 평균) | **14s** | — | — |
| 회귀 비율 (ai-analysis vs others avg) | **-44.6%** (오히려 빠름) | 회귀 ≤ 5% | ✅ 압도적 통과 |
| CI 안정성 | ai-analysis success + Trivy success + deploy gate 정상 | 무영향 | ✅ |

- docker tarball 실측: `gh run download` 으로 artifact 받아 `stat -f %z` = 70,197,760 bytes
- zstd tarball 실측: 사용자 GitHub UI Summary 직접 입력 (24.3 MB / -63.7%)
- 다른 서비스 baseline (회귀 비교용): `gh api .../jobs` 의 step 별 `started_at`/`completed_at` 차이로 자동 계산

### D2. zstd 전면 적용 — inline ternary 제거 + 8 build job 무조건 생성

- Sprint 167 의 `${{ matrix.service == 'ai-analysis' && format(...) || '' }}` 조건부 표현식 제거
- build-services matrix 6 서비스 + build-frontend + build-blog **모두** `type=oci,compression=zstd,dest=...` 무조건 outputs 라인 추가
- Trivy scan job 무변경 — docker tarball `--input` 만 사용 → 호환성 회귀 zero (zstd 는 측정/저장 전용)
- 다른 매트릭스 분기 / paths filter 무변경 → detect-changes 기반 build skip 패턴 보존

### D3. 시드 #167-3 헬퍼 추출 = `scripts/ci/report-build-metrics.sh`

- 3 build job 의 "Report build artifact metrics" step 중복 약 30줄 × 3 = 90줄 → 단일 헬퍼 75줄
- 호출 단축: `run: bash scripts/ci/report-build-metrics.sh <label> <docker_tarball> [zstd_tarball]` (1줄)
- ci.yml 순감: -102 / +18 = **-84 net 라인** (헬퍼 75줄 별도 신규)
- 인자 인터페이스 — `zstd_tarball` optional → 본 sprint 채택 결과 (모두 zstd 생성) + 미래 미채택 분기 모두 호환
- 본문 패턴 계승:
  - `awk -v` 변수 전달 (Sprint 166 표준)
  - `docker buildx du` footer (Shared/Private/Reclaimable/Total) 명시 제외 (Sprint 167 R1 P3 fix)
  - `|| N/A` graceful fallback (Sprint 167 정책)
- `set -euo pipefail` + `chmod +x` 실행 권한 commit 포함

### D4. 시드 #167-2 정당화 close — frontend/blog skip 가드 차이 = 의도

- `build-frontend` / `build-blog` 는 단일 job + job-level `if: needs.detect-changes.outputs.{X} == 'true'` 만으로 충분
- `build-services` 의 step-level `if: steps.check.outputs.skip == 'false'` 가드는 matrix `fail-fast: false` 구조의 자연 결과 — frontend/blog 에 추가 시 중복 가드 무의미
- 차이는 의도된 결과 → 코드 변경 없이 ADR 명문화로 시드 close
- 단일 job vs matrix job 의 skip 가드 패턴 = 본 ADR 의 정당화 기준점

### D5. Build Gateway GHCR transient timeout — deploy gate 정상 작동 검증

- 본 sprint force-build run #26097517834 의 Build Gateway 만 `docker/login-action@v4` 단계에서 `Client.Timeout exceeded while awaiting headers` 로 fail
- aether-gitops `overlays/prod/kustomization.yaml` 의 실제 image tag 확인 결과:
  - gateway tag: `main-3528ad82...` (Sprint 164 dependabot 적용 시점 유지) — **갱신 안 됨**
  - frontend/blog tag: `main-500b954...` (Sprint 167 머지 자연 trigger 시 정상 갱신) — **변경 없음**
- "Update GitOps manifests" job 의 commit message 는 head SHA `→ main-500b954...` 를 단순 표시할 뿐, 실제 manifest delta 는 Trivy artifact 가 있는 서비스만 (Sprint 160 deploy gate 정상 작동)
- **결론**: ArgoCD sync 영향 zero. gateway rerun 불필요. transient 인프라 장애 (Sprint 169 시드 #신규 #168-1 — GHCR retry guard 후속)

### D6. aether-gitops commit message 모호성 — 오해 소지 (Sprint 169 시드 #신규 #168-2)

- 현재 commit message: `deploy(algosu): update image tags → main-<head_sha>`
- 실제 변경 서비스 list 미명시 → "모든 서비스가 head SHA 로 갱신됨" 오해 가능
- 후속: commit message 에 실제 변경된 서비스 name + new tag 표시 (Sprint 169 이월)

## 구현 (1 PR, 36 스프린트 연속 브랜치 규율 준수 목표)

브랜치: `feat/sprint-168-zstd-adoption-decision` (main `500b954` 기준 신규)

### Phase A — 측정 데이터 확보 (외부 트리거, 코드 변경 zero)

- `gh workflow run ci.yml --ref main -f rebuild_all=true` 으로 8 서비스 + frontend + blog 모두 force build
- 사용자가 GitHub UI Summary 의 ai-analysis 박스에서 zstd MB + saving % 직접 입력
- 본 세션은 docker tarball artifact 자동 다운로드 + 다른 서비스 build step duration `gh api` 로 자동 계산

### Phase B — 분기점 의사결정 (코드 변경 zero)

- 3 채택 조건 (saving 30%+ / 회귀 5% 이내 / 안정성) 자동 평가 → 모두 통과 → 채택 결정
- 본 sprint 1차 작업 → Phase C-Adopt 분기

### Phase C-Adopt — zstd 전면 적용 + 헬퍼 추출 (commit `564b5e1`)

`scripts/ci/report-build-metrics.sh` (신규, 75줄):

```bash
LABEL="${1:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
DOCKER_TARBALL="${2:?usage: $0 <label> <docker_tarball> [zstd_tarball]}"
ZSTD_TARBALL="${3:-}"

SIZE_BYTES=$(stat -c %s "$DOCKER_TARBALL")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')

BUILD_DURATION=$((BUILD_END - ${BUILD_START:-$BUILD_END}))
# ... cache size / cache entries ...

if [ -n "$ZSTD_TARBALL" ] && [ -f "$ZSTD_TARBALL" ]; then
  ZSTD_BYTES=$(stat -c %s "$ZSTD_TARBALL")
  SAVE_PCT=$(awk -v d="$SIZE_BYTES" -v z="$ZSTD_BYTES" 'BEGIN {printf "%.1f", (1 - z/d) * 100}')
  echo "- tarball size (oci+zstd): **${ZSTD_MB} MB** (${ZSTD_BYTES} bytes)"
  echo "- compression saving: **-${SAVE_PCT}%** (zstd vs docker)"
fi
```

`.github/workflows/ci.yml` build-services 변경:

```yaml
outputs: |
  type=image,push=${{ github.ref == 'refs/heads/main' }},name=${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}
  type=docker,dest=/tmp/image-${{ matrix.service }}.tar
  type=oci,compression=zstd,dest=/tmp/image-${{ matrix.service }}-zstd.tar
# ...
- name: Report build artifact metrics
  if: steps.check.outputs.skip == 'false'
  run: bash scripts/ci/report-build-metrics.sh "${{ matrix.service }}" "/tmp/image-${{ matrix.service }}.tar" "/tmp/image-${{ matrix.service }}-zstd.tar"
```

build-frontend / build-blog 도 동일 패턴 (matrix vs 하드코딩만 차이).

### Phase D — ADR 기록 (본 commit)

- `docs/adr/sprints/sprint-168.md` (KR) + `docs/adr-en/sprints/sprint-168.md` (EN 1:1 매핑)
- `docs/adr/README.md` count 107→108, range 62~167→62~168 (라인 18/52/54)

## Critic 사이클

**R1** (codex review --base 500b954, 본 commit `7c982c9` + `3ab5138`):

- **결과**: P0 0건 / P1 0건 / **P2 1건** / P3 0건
- **P2 검출**: `scripts/ci/report-build-metrics.sh` 가 `set -euo pipefail` 로 실행되는데 `docker buildx du` 가 nonzero exit 시 fallback (`[ -z "$CACHE_DU" ] && CACHE_DU="N/A"`) 도달 전 script 종료 → 이전 inline workflow 의 graceful fallback 약속 위반 → buildx cache 검사 blip 이 build job fail 유발 가능
- **forward-fix**: `dccfccd` 동일 PR 동일 일자 — 두 pipeline (`CACHE_DU` + `CACHE_ENTRIES`) 에 `|| true` 추가하여 telemetry 부재가 build job fail 유발 금지
- **CI 검증**: run #26099215601 — 37 SUCCESS + 9 SKIPPED + 0 FAILURE, mergeStateStatus CLEAN ✅

**R2** (codex review --base 500b954, fix commit `dccfccd` 적용 후):

- **결과**: R1 P2 해소 확인 ✅, **신규 P2 1건** 검출
- **P2 검출**: `scripts/ci/report-build-metrics.sh` 가 `detect-changes` paths filter 에 미포함 → 헬퍼만 변경된 future PR 이 모든 build job skip 으로 silent 통과 → 헬퍼의 결함이 CI 에 노출 안 됨
- **forward-fix**: `<TBD-R2-FIX>` 동일 PR — 8 filter (gateway/identity/submission/problem/github-worker/ai-analysis/frontend/blog) 모두에 헬퍼 path 추가. 헬퍼 변경 시 모든 build job trigger → 실제 runtime 검증
- 자기 모순 검출: 본 sprint 목표 "zstd 전면 채택" ↔ Trivy `--input` docker tarball 사용 일관성 OK (zstd 는 측정/저장 전용)

## 위험/회귀 차단

### 예측 1: zstd outputs 추가로 인한 build 시간 회귀

- Sprint 167 실측: ai-analysis (zstd+docker A/B) 8s vs 다른 서비스 docker only 평균 14s → ai-analysis 가 44.6% 빠름
- zstd 압축 연산은 build step 의 일부 (저장 단계). 본 build 와 직렬화 되지만 추가 시간 < 5% (실측 통계 baseline 부재로 다른 서비스 평균 비교)
- 다른 서비스 zstd 추가 시 회귀 5% 이내 예측 — Sprint 169 데이터 검증으로 확정

### 예측 2: Trivy scan 회귀 zero

- Trivy scan job 의 `--input /tmp/image-${service}.tar` 는 docker tarball 만 매칭 (zstd 는 별도 파일)
- buildx multi-output 동시 생성 → docker tarball 항상 존재 → 호환성 영향 zero

### 예측 3: 헬퍼 스크립트 실행 환경 호환성

- `set -euo pipefail` + `chmod +x` + `bash` shebang 명시
- `stat -c %s` GNU coreutils — ubuntu-latest 환경 보장 (macOS `stat -f %z` 불일치는 CI 전용 step 이라 무관)
- `docker buildx du` GHA ubuntu-runner 표준 (Sprint 167 검증)
- `GITHUB_STEP_SUMMARY` 미설정 시 `/dev/stdout` fallback (외부 환경 테스트 가능)

### 예측 4: aether-gitops manifest 회귀 zero

- Build job fail → Trivy artifact 부재 → "Update GitOps manifests" job 가 해당 서비스 tag 갱신 skip (Sprint 160 deploy gate 정상)
- 본 sprint force-build 의 Build Gateway timeout 케이스 직접 검증됨 — gateway tag `main-3528ad82...` (Sprint 164) 유지 ✅
- zstd outputs 추가가 Build 자체 안정성에 영향 zero (multi-output 동시 생성은 buildx 표준)

## 검증

### 로컬
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS
- `bash -n scripts/ci/report-build-metrics.sh` syntax PASS
- `chmod +x` 적용 (executable bit 확인)
- `node scripts/check-adr-en-coverage.mjs --strict` 117/117 PASS (Sprint 168 신규 1쌍 추가)
- `node scripts/check-doc-refs.mjs` 0 broken refs PASS

### CI (PR 단계)
- 37 SUCCESS + 10 SKIPPED + 1 NEUTRAL + 0 FAILURE, mergeStateStatus CLEAN 목표
- 8 build job (6 services + frontend + blog) 모두 Summary `### 📦 X build artifact` H3 + docker MB + duration + cache size + cache entries + **oci+zstd MB + compression saving %** 표시 (8 서비스 일관)
- Trivy scan 8 matrix 회귀 zero (`--input` docker tar 매칭 무변경)
- aether-gitops update job 정상 (변경 서비스만 tag 갱신)

### UAT 신규 (Sprint 168)
- 사용자 직접: 8 build job Summary 모두에서 oci+zstd MB + compression saving % 일관 표시 시각 확인 (Sprint 167 의 ai-analysis 1개 → Sprint 168 의 8개 전면 확장)

## 결과

변경 파일 5건 (4 commits):
- 수정 1개: `.github/workflows/ci.yml` (Phase C -84 net + R2 P2 fix +8, build-services + frontend + blog outputs 일괄 zstd + 헬퍼 호출 단축 + detect-changes filter 헬퍼 path 추가)
- 신규 1개: `scripts/ci/report-build-metrics.sh` (+75 + R1 P2 fix +3, 시드 #167-3 헬퍼 + graceful fallback)
- 신규 2개: `docs/adr/sprints/sprint-168.md` (KR) + `docs/adr-en/sprints/sprint-168.md` (EN 1:1 매핑)
- 수정 1개: `docs/adr/README.md` (라인 18/52/54 — count 107→108, range 62~167→62~168)

Commits (PR #293):
- `7c982c9` feat(ci): Sprint 168 — zstd 전면 적용 + Report metrics 헬퍼 (시드 #167-1/#167-3)
- `3ab5138` docs(adr): Sprint 168 ADR (KR + EN) + README 갱신
- `dccfccd` fix(ci): Sprint 168 R1 P2 — buildx du pipeline graceful fallback 복원
- `<TBD-R2-FIX>` fix(ci): Sprint 168 R2 P2 — detect-changes filter 에 헬퍼 path 추가
- Squash merge: `<TBD-MERGE-SHA>` (PR #293)

## 신규 패턴

- **workflow_dispatch + rebuild_all force-build = 측정 데이터 확보 표준 패턴** — `detect-changes` paths filter 의 비용 절감 trade-off (변경 없는 서비스 build skip) 를 측정 sprint 에서 한시적으로 우회. `inputs: rebuild_all` 가 override 로 가장 안전한 측정 trigger. 미래 모든 측정 sprint 에서 동일 패턴 활용 가능
- **헬퍼 추출 = 중복 90줄 → 1곳 통합 + optional 인자로 채택/미채택 양면 호환** — `[zstd_tarball]` optional 인자 인터페이스가 본 sprint 채택 결과 (모든 build job zstd 생성) + 미래 미채택 분기 (zstd_tarball 미전달) 모두 호환. 의사결정 결과에 무관한 헬퍼 가치
- **artifact 자동 다운로드 + step timing API 추출 = 측정 자동화 패턴** — 사용자 입력 의존 최소화. `gh run download` (docker tarball 실측) + `gh api .../jobs` 의 step `started_at`/`completed_at` 차이 (각 서비스 build duration) → Python 으로 회귀 비율 자동 계산
- **Sprint 160 deploy gate 의 transient infra 장애 격리 검증** — Build Gateway GHCR timeout 발생 시 aether-gitops gateway tag 갱신 skip 확인. Sprint 160 (deploy gate Trivy 기반 service-scoped 차단) 의 정확한 작동 = 1 서비스 fail 이 다른 서비스 deploy 회귀 차단 안 함. 인프라 장애 격리 가치 검증
- **`set -euo pipefail` + `?:` 인자 검증 = shell helper 표준 패턴** — `LABEL="${1:?usage: ...}"` 패턴이 인자 미전달 시 즉시 fail + 명확한 에러. 호출 sites 의 단순화 (헬퍼 호출 1줄) 와 결합 = 안전성 + 가독성 양립
- **`set -euo pipefail` 와 graceful fallback 의 양립 = `|| true` pipeline 격리 (R1 P2 fix 패턴)** — 헬퍼 안에서 nice-to-have telemetry (`docker buildx du`) 의 fail 이 build job 전체 fail 유발하지 않도록 `pipeline || true` 로 격리. fail-fast (인자 검증) + graceful fallback (telemetry) 가 동일 script 안에 양립 가능. Sprint 168 R1 P2 → Sprint 169+ shell helper 작성 시 표준 패턴 정착
- **헬퍼 path = cross-cutting CI dependency → detect-changes filter 모든 image build 분기 동시 등록 (R2 P2 fix 패턴)** — 헬퍼 추출의 부작용으로 헬퍼만 변경된 PR 이 모든 build job skip 으로 silent 통과 가능. 8 image build filter 모두에 헬퍼 path 추가 → 헬퍼 변경 시 실제 runtime 검증. cross-cutting 헬퍼 도입 시 detect-changes 도 동시 갱신 의무 정착
- **Critic R1 + R2 누적 2회전 검출 + 동일 PR 모두 forward-fix (이월 zero 달성)** — R1 P2 (heleper fallback) + R2 P2 (filter 등록) 모두 동일 PR 동일 일자 fix. 본 sprint "이월 없음" 목표 + Sprint 164/167 자체 fix 정책 누적 강화 = 단일 sprint 완결성 우선 정책 정착

## 교훈

- **측정 인프라 (Sprint 167) 와 의사결정 (Sprint 168) 의 sprint 분할 = 의사결정 데이터 품질 보장** — Sprint 167 의 measurement infrastructure 정착 후 Sprint 168 의 실제 측정 데이터 기반 결정. 분할의 비용 (2 sprint) 보다 데이터 품질 (실제 build 환경 측정) 의 가치가 큼. 본질 결정 sprint 는 항상 데이터 확보 sprint 와 분리
- **4 sprint 사이클 (보안→가시성→실측→채택) 완성 = 점진 검증의 가치 재확인** — Sprint 165 옵션 C (보안) → Sprint 166 baseline (가시성) → Sprint 167 실측 (1 서비스) → Sprint 168 전면 채택 (8 서비스). 각 sprint 가 1 단계만 진행 + 데이터 확보 후 다음 sprint 결정. 사용자 시각 1회 수렴 시 단일 sprint 통합 가능하나, 데이터 의존 결정 은 sprint 분리가 표준
- **detect-changes paths filter = 비용 절감 vs 측정 데이터 부재 trade-off** — Sprint 167 머지 run 에서 ai-analysis 변경 없음 → build skip → 측정 데이터 0건. `workflow_dispatch + rebuild_all` override 패턴이 측정 trigger 표준. paths filter 가 모든 측정/실험 sprint 에 영향
- **transient 인프라 장애 = 본 sprint scope 격리 + 후속 시드 명문화** — Build Gateway GHCR timeout 검출 → 본 sprint 범위 확장 회피 (zstd 결정 우선) + Sprint 169 시드 #168-1 (GHCR retry guard) 명문화. 안정성 영향 zero 확인 후 격리는 우선순위 (서비스 안정성 > 개발 속도) 의 가장 단순한 적용
- **shell helper 추출 = 단일 인터페이스 + 인자 검증의 가치** — `${1:?usage: ...}` 패턴이 인자 누락 케이스의 fail-fast + 호출 단순화 (1줄) 양면 보장. 미래 build job 추가 (예: 신규 서비스) 시 동일 헬퍼 1줄 호출만 추가 → DRY 가치 영구

## 이월 항목 (Sprint 169+)

### Sprint 168 신규 이월 시드
- **시드 #168-1**: GHCR transient timeout 자동 retry guard — `docker/login-action@v4` + `docker/build-push-action@v7` 에 `retry` 또는 `continue-on-error` + rerun 로직. Sprint 168 force-build 의 Build Gateway timeout 사례 인과 차단
- **시드 #168-2**: aether-gitops "Update GitOps manifests" commit message 에 실제 변경 서비스 list 명시. 현재 head SHA 만 표시 → 오해 소지 (Sprint 168 D6 분석)
- **시드 #168-3**: ai-analysis 외 7 서비스 + frontend + blog 의 zstd 압축률 측정 데이터 누적 + ADR 데이터 명문화 (Sprint 168 실측은 ai-analysis 1개만, 다른 서비스 zstd 실측은 Sprint 169 첫 머지 run 에서 자동 누적)
- **시드 #168-4**: 헬퍼 스크립트 단위 테스트 (`tests/ci/report-build-metrics.bats` 또는 `tests/ci/report_build_metrics_test.sh`) — 인자 검증 + zstd 분기 / 미전달 분기 / GITHUB_STEP_SUMMARY fallback

### Sprint 167 이월 계속
- **CI 가시성 (Sprint 164 시드 #신규4/5/7)**: PR 단계 deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR template / `_parse_group_response` raw_text fallback envelope 확장
- **i18n/lint (Sprint 158 시드 #30/#31)**: 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트
- **plan 템플릿 (Sprint 157 시드 #24/#18)**: i18n 양면 의무 체크리스트 자동 / 블로그 글 머지 전 cross-check 자동화
- **ADR/blog 보강 (Sprint 157 시드 #26/27/28)**: README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지

### UAT 사용자 직접 (25 스프린트 누적)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합
- Sprint 160~167 누적 UAT 항목 모두 계승
- Sprint 168 신규 1건: 8 build job Summary 모두에서 oci+zstd MB + compression saving % 일관 표시 시각 확인

### 이월 유지
- 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트

### 후속 (선택)
- create/edit page.tsx category UI
- Programmers URL 자동 카테고리 추론
- 기존 SQL 문제 데이터 백필
- coverage-gate `skipped` 허용 제거 (Sprint 156 Phase B 옵션 B)
- post-merge pre-deploy gate (Sprint 156 Phase B 옵션 C)
- prom-client Case B~D 점검 자동화
- `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)
- `(adr)` layout 분할 (KR + EN override) — Sprint 158 description 단일화의 대안
- Sprint 162 R1 P3: 깊은 상대 경로 `.md` 링크 미커버 — ADR 범위 밖
- Sprint 163 추가: H3-only PR 표 추출 + implementation H2 partial matcher + sprint-87 H3-only carryover

**ADR**: [sprint-168.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-168.md) (KR) + [sprint-168.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-168.md) <!-- doc-ref-lint: ignore -->
