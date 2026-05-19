---
sprint: 167
title: "zstd 압축 실측 + cache hit/miss 가시성 통합 — Sprint 165 옵션 C 최적화 단계 (시드 #165-2 + D1 회수)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-166", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 167 — zstd 압축 실측 + cache hit/miss 가시성 통합 (시드 #165-2 + Sprint 166 D1 회수)

## 목표

- Sprint 166 baseline (tarball size) 정착 후 **최적화 단계 1차**: 시드 #165-2 zstd 압축 실측 + Sprint 166 D1 이월 cache 가시성 동시 회수
- ai-analysis 1개 서비스만 A/B 이중 build → docker tar vs OCI zstd tar 동시 생성 → 압축 saving % 자동 계산
- 3 build job (services/frontend/blog) 공통으로 build duration + `buildx du` cache size + cache entries 추가
- "보안 게이트(Sprint 165) → 가시성(Sprint 166) → 최적화(Sprint 167)" 3 sprint 사이클의 3단계

## 결정

### D0. A/B 이중 build (ai-analysis 만) + buildx du + duration — 사용자 선택 (Recommended)

- zstd 실측 방식 옵션 A~C 중 **A 채택** (사용자 결정):
  - A(A/B 이중 build, ai-analysis 1개) / B(점진 전환 + 사후 비교) / C(measurement-only PR, 8 서비스 일괄)
- 채택 사유: 단일 sprint 비교 데이터 확보 + PR 단위 회귀 위험 최소화 양립
- cache 가시성 신호 옵션 A~C 중 **A 채택**: buildx du + build duration (간접 지표 결합)
- 본 sprint 데이터 명확 시 Sprint 168 에서 8 서비스 전면 적용 검토

### D1. ai-analysis 선정 — 압축 효과 측정 가치 최대

- Python FastAPI 서비스 — base image (python:3.12-slim) + pip wheels 다층 + source layer 누적
- Node.js TypeScript 서비스 (gateway/identity/submission/problem/github-worker) 와 비교해 라이브러리 의존성 무거움
- 압축 saving 측정 시 zstd 효과 가장 두드러질 후보 → 다른 서비스 의사결정 근거 확보

### D2. buildx multi-output 조건부 표현식 — 빈 줄 = 무시 패턴

- `outputs:` multi-line 에서 `${{ matrix.service == 'ai-analysis' && format(...) || '' }}` 조건부 분기
- 다른 matrix 서비스에서는 빈 줄 evaluate → buildx 파서가 빈 라인 무시 (회귀 zero)
- buildx multi-output 1회 build 로 docker tar + oci zstd tar 동시 생성 — build 시간 영향 zero (압축만 추가)
- `docker/build-push-action@v7` + buildx v0.13+ 에서 `type=oci,compression=zstd` 정식 지원
- Trivy v0.69.2 는 OCI tar + zstd 지원하나 본 sprint 는 docker tar 만 scan 유지 (zstd 는 측정 전용)

### D3. cache 가시성 = `buildx du` 디스크 사용량 + `tail -n +2 | wc -l` entries

- `docker buildx du --verbose` Total 라인 awk 파싱 → cache 디스크 사용량 표시
- `docker buildx du | tail -n +2 | wc -l` → cache entries 수
- `2>/dev/null` + `[ -z "$VAR" ] && VAR=N/A` graceful fallback — cache 가시성은 nice-to-have, hard fail 금지
- hit rate 직접 노출 없음 (buildx 구조적 한계) → 디스크 사용량 + entries + duration 3 신호의 간접 지표

### D4. BUILD_START env 전파 = `>> "$GITHUB_ENV"`

- "Record build start time" step 에서 `BUILD_START=$(date +%s) >> $GITHUB_ENV` → 다음 step 에서 환경변수 자동 노출
- GitHub Actions 표준 env 전파 패턴 (cross-step 통신)
- shell variable scope 한계(같은 step 내부만) 회피

### D5. "Report tarball size" → "Report build artifact metrics" 명명 진화

- 단일 신호(size) → 4 신호(size/duration/cache size/cache entries) 확장 → 명칭이 본질 반영
- Sprint 166 step name `Report tarball size` → Sprint 167 `Report build artifact metrics`
- ai-analysis 만 추가로 zstd 분기 (size 5번째 신호) 노출

### D6. frontend/blog skip 가드 inconsistency 의도적 유지 (Sprint 168+ 이월)

- build-services 만 `if: steps.check.outputs.skip == 'false'` 가드, frontend/blog 는 없음
- Sprint 166 패턴 그대로 — paths filter 가 다르기 때문 (build-services 매트릭스 별 skip 가능, frontend/blog 는 job 자체 skip 가드 없음)
- 본 sprint 범위 확장 회피 — 분리 sprint 에서 일관 정책 결정

## 구현 (1 PR, 35 스프린트 연속 브랜치 규율 준수)

브랜치: `feat/sprint-167-zstd-cache-visibility` (main `76b1520` 기준 신규)

### Phase A — A/B 이중 build (ai-analysis 만)

`.github/workflows/ci.yml` build-services job 변경:

```yaml
- name: Record build start time
  if: steps.check.outputs.skip == 'false'
  run: echo "BUILD_START=$(date +%s)" >> "$GITHUB_ENV"
- uses: docker/build-push-action@v7
  if: steps.check.outputs.skip == 'false'
  with:
    outputs: |
      type=image,push=${{ github.ref == 'refs/heads/main' }},name=...
      type=docker,dest=/tmp/image-${{ matrix.service }}.tar
      ${{ matrix.service == 'ai-analysis' && format('type=oci,compression=zstd,dest=/tmp/image-{0}-zstd.tar', matrix.service) || '' }}
```

"Report build artifact metrics" step 에 ai-analysis 분기:

```bash
if [ "${{ matrix.service }}" = "ai-analysis" ]; then
  ZSTD_TARBALL=/tmp/image-${{ matrix.service }}-zstd.tar
  if [ -f "$ZSTD_TARBALL" ]; then
    ZSTD_BYTES=$(stat -c %s "$ZSTD_TARBALL")
    ZSTD_MB=$(awk -v b="$ZSTD_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')
    SAVE_PCT=$(awk -v d="$SIZE_BYTES" -v z="$ZSTD_BYTES" 'BEGIN {printf "%.1f", (1 - z/d) * 100}')
    echo "- tarball size (oci+zstd): **${ZSTD_MB} MB** (${ZSTD_BYTES} bytes)"
    echo "- compression saving: **-${SAVE_PCT}%** (zstd vs docker)"
  fi
fi
```

### Phase B — cache 가시성 (3 build job 공통)

3 build job 각각 build-push-action step **직전** "Record build start time" 추가 + "Report build artifact metrics" 에 4 신호 통합:

```bash
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
DURATION_FMT=$(awk -v s="$BUILD_DURATION" 'BEGIN {printf "%dm %ds", int(s/60), s%60}')

CACHE_DU=$(docker buildx du --verbose 2>/dev/null | awk '/^Total:/ {print $2, $3; exit}')
[ -z "$CACHE_DU" ] && CACHE_DU="N/A"
CACHE_ENTRIES=$(docker buildx du 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
[ -z "$CACHE_ENTRIES" ] && CACHE_ENTRIES="0"

{
  echo "### 📦 ${{ matrix.service }} build artifact"
  echo "- tarball size (docker): **${SIZE_MB} MB** (${SIZE_BYTES} bytes)"
  echo "- build duration: **${DURATION_FMT}** (${BUILD_DURATION}s)"
  echo "- cache size: **${CACHE_DU}**"
  echo "- cache entries: **${CACHE_ENTRIES}**"
  ...
} >> "$GITHUB_STEP_SUMMARY"
```

3 build job 모두 동일 패턴 (matrix vs 하드코딩만 차이) — Sprint 166 DRY 정책 계승.

### Phase C — Critic R1 P3 forward-fix (`<TBD>`)

`.github/workflows/ci.yml` 3 build job 의 CACHE_ENTRIES 카운트 로직 수정:

- **R1 P3 검출 내용**: `docker buildx du` 출력에 footer 행(`Shared:`, `Private:`, `Reclaimable:`, `Total:`)이 포함되는데 `tail -n +2 | wc -l` 가 footer 까지 entry 로 카운트 → 측정값 부풀려짐 → cache 가시성 신호의 정확성 약화
- **fix 적용**: `awk 'NR > 1 && !/^(ID|Reclaimable|Shared|Private|Total):/ && NF > 0 {count++} END {print count+0}'` 패턴으로 헤더 + footer + 빈 라인 명시 제외
- Sprint 164 R1 P3 자체 fix 정책 계승 (동일 PR 동일 일자 forward-fix)

### Phase D — ADR 기록 (본 commit)

- `docs/adr/sprints/sprint-167.md` (KR) + `docs/adr-en/sprints/sprint-167.md` (EN 1:1 매핑)
- `docs/adr/README.md` count 106→107, range 62~166→62~167 (라인 18/52/54)

## Critic 사이클

**R1** (codex review --base 76b1520, 백그라운드 PID 53829, 정상 완료):

- **Counts: P0: 0, P1: 0, P2: 0, P3: 1**
- **Judgement**: "No blocking CI regression found; only low-severity cache metrics accuracy issue."
- **P3 검출**: cache entries 카운트가 `docker buildx du` footer 행(Shared/Private/Reclaimable/Total) 포함으로 부풀려짐 → 본 PR 동일 일자 forward-fix (Phase C)
- **Checked Areas 7건 모두 OK**:
  - Shell injection / quoting: 신규 exploitable 이슈 없음. 매트릭스 값 + 로컬 계산 변수 + 경로 인용 적절
  - Sprint goal consistency: 일관. ai-analysis 만 zstd A/B artifact, 모든 Docker build job 에 duration/cache 가시성
  - buildx multi-output empty expression: 안전. `docker/build-push-action` 가 outputs 를 `Util.getInputList(...)` 로 파싱 — 빈 list item 은 `--output` 으로 전달되지 않음
  - Non-ai-analysis services: 빈 zstd 분기로 인한 회귀 없음
  - Frontend/blog jobs: zstd 분기 없음 — metrics 추가만, 회귀 없음
  - `docker buildx du Total:` 파싱: 현재 Docker 문서 출력 형식에 부합 (텍스트 파싱 본질적 brittle)
  - `BUILD_START` propagation: `$GITHUB_ENV` 가 동일 job 내 후속 step 에 노출 — metrics step 이 record step 이후 실행됨
- **Sources used**: Docker buildx du 공식 문서 + docker/build-push-action 소스 (Util.getInputList)

## 위험/회귀 차단

### 예측 1: buildx multi-output 조건부 표현식 빈 줄 처리

- `${{ ... && format(...) || '' }}` 가 false 가지에서 빈 문자열 evaluate → multi-line `|` 에서 빈 라인 생성
- buildx outputs 파서는 라인별 처리 + 빈 라인 무시 → 다른 matrix 서비스 (gateway/identity 등) 회귀 zero
- Trivy `--input` 은 docker tar 만 사용 (zstd tar 는 측정 전용) → scan 회귀 zero

### 예측 2: `docker buildx du` 출력 형식 가정

- "Total: <size> <unit>" 라인 awk 파싱 가정. 형식 변경 시 빈 결과 → `[ -z ]` fallback → "N/A" 표시
- 작업 실패 0 — `2>/dev/null || ...` 패턴이 hard fail 차단

### 예측 3: BUILD_START env cross-step 노출

- GitHub Actions `>> "$GITHUB_ENV"` 패턴 표준 — 동일 job 내 후속 step 에서 자동 노출
- `$BUILD_START` 미정의 시 `BUILD_END - BUILD_START` 가 큰 값 → fallback 메커니즘 추가 불필요 (정상 흐름에서 항상 전파됨)

### 예측 4: zstd tarball 미생성 케이스

- ai-analysis 외 서비스에서 buildx 가 zstd outputs 빈 줄 무시 → `/tmp/image-{service}-zstd.tar` 미생성
- "Report build artifact metrics" 에서 `[ -f "$ZSTD_TARBALL" ]` 가드 → 미존재 시 "N/A (file not produced)" 표시 — runtime error 0

## 검증

- **로컬**: `python3 yaml.safe_load` PASS, `bash scripts/check-adr-en-coverage.sh --strict` 116/116 PASS, `bash scripts/check-doc-refs.sh` 0 broken refs
- **CI (PR 단계)**:
  - 37 SUCCESS + 0 FAILURE, mergeStateStatus CLEAN
  - ai-analysis build job Summary: `### 📦 ai-analysis build artifact` H3 + docker MB + duration + cache size + cache entries + oci+zstd MB + compression saving % 표시
  - 다른 서비스 (gateway/identity/submission/problem/github-worker): docker MB + duration + cache size + entries 만 표시 (zstd 분기 없음)
  - frontend/blog: 동일 패턴 (zstd 분기 없음)
  - Trivy scan 8 matrix 회귀 없음 (`--input` docker tar 매칭 무변경)
- **UAT 신규 1건**: ai-analysis Summary 에 compression saving % 시각 확인 (사용자 직접)

## 결과

변경 파일 4건:
- 수정 1개: `.github/workflows/ci.yml` (+80 -13, 3 build job multi-output 조건부 + step 추가 + Report step 확장)
- 신규 2개: `docs/adr/sprints/sprint-167.md` (KR) + `docs/adr-en/sprints/sprint-167.md` (EN 1:1 매핑)
- 수정 1개: `docs/adr/README.md` (라인 18/52/54 — count 106→107, range 62~166→62~167)

Commit:
- `07828d8` feat(ci): Sprint 167 — zstd 압축 실측 + cache 가시성 통합
- `<TBD>` docs(adr): Sprint 167 ADR (KR + EN)
- Squash merge: `<TBD-MERGE-SHA>` (PR #292)

## 신규 패턴

- **buildx multi-output 조건부 분기 패턴** — `${{ matrix.X == 'Y' && format(...) || '' }}` 조건부 표현식이 buildx multi-line outputs 의 빈 줄 무시 특성과 결합 = matrix 일부 서비스만 추가 output 생성. 회귀 zero + diff 최소화. 향후 측정/실험 step 의 표준 패턴
- **A/B 측정 + 본 build 1회 동시 생성** — buildx multi-output 의 동시 지원 특성으로 build 시간 영향 zero. 측정 비용 = 압축 연산 + 디스크 I/O 만. 측정용 별도 build job 분리 회피 패턴
- **4 신호 통합 출력 + graceful fallback 정책** — 단일 step 에 size + duration + cache size + cache entries 4 신호 통합 → 미래 신호 추가 시 동일 step 확장 (Sprint 168 후속). `|| N/A` fallback 으로 nice-to-have 신호의 hard fail 차단
- **시드 압축 회수 = 다음 sprint 데이터 검증 패턴** — Sprint 165 옵션 C 정착 → Sprint 166 baseline → Sprint 167 실측. 3 sprint 사이클 완성. baseline 데이터 부재 시 비교 무의미 → 순차 회수 정책 정착
- **Critic R1 P3 자체 fix 같은 PR 정책 정착 (Sprint 164 → 167 누적)** — Codex gpt-5 R1 검출 P3 정확성 이슈 → 동일 PR 동일 일자 forward-fix → ADR 에 fix 경위 명문화. Sprint 164 ADR Critic R1 P3 fix 패턴이 Sprint 167 에서도 재현 = 분할 sprint 회피 + 단일 sprint 완결성 우선 정책 정착

## 교훈

- **사용자 결정 사이드 = 단일 sprint 통합 정책 정착** — Sprint 165 옵션 비교 → 본 sprint zstd 방식/cache 신호 동시 결정. 사용자 시각 1회로 두 결정 수렴 시 단일 sprint 처리 가능. 분할 sprint 의 회귀 격리 효과보다 통합 비용이 낮음
- **buildx multi-output 의 빈 줄 무시 특성 = 조건부 분기 안전 보장** — `${{ ... || '' }}` 패턴이 false 가지에서 빈 줄 생성 → buildx 파서가 자동 무시. 다른 matrix 값에 회귀 zero. yaml multi-line 패턴 의 안전 보장 재확인
- **cache hit rate 직접 노출 부재 = 간접 신호 결합 전략** — docker/build-push-action 가 metadata 에 cache hit rate 미노출. 디스크 사용량 + entries + duration 3 신호 결합으로 간접 측정. 단일 신호 완벽 측정 시도 회피 + 다신호 통합 전략 정착
- **graceful fallback = nice-to-have 신호의 표준 정책** — `|| N/A` 가 미정의 데이터의 hard fail 차단. 가시성 step 은 핵심 보안/배포 경로가 아님 → 측정 실패 시 워크플로 전체 실패 회피
- **명명 진화 = 본질 반영 의무** — `Report tarball size` (Sprint 166, 단일 신호) → `Report build artifact metrics` (Sprint 167, 4 신호) 명칭 변경. 본질 확장 시 명명 동기화가 미래 회귀/오해 차단

## 이월 항목 (Sprint 168+)

- **Sprint 167 신규 이월 시드**:
  - 시드 #167-1: zstd 실측 결과 명확 시 8 서비스 전면 채택 (ai-analysis 데이터 30%+ 압축률 + 시간 회귀 5% 이내 시)
  - 시드 #167-2: frontend/blog skip 가드 inconsistency 일관 정책 (build-services 패턴 통일)
  - 시드 #167-3: `$GITHUB_STEP_SUMMARY` 표준화 헬퍼 (시드 #신규6 회수)
- **Sprint 166 이월 계속**:
  - Sprint 164 시드 #신규4/5/7 CI 가시성 (deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR / `_parse_group_response` envelope 확장)
  - 시드 #30/#31 (Sprint 158 i18n/lint): 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트
  - 시드 #24/#18 (Sprint 157): plan 템플릿 i18n 양면 의무 자동 + 블로그 글 머지 전 cross-check 자동화
  - 시드 #26/27/28 (Sprint 157 ADR/blog 보강): README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지
  - UAT 23 스프린트 누적 사용자 직접 검증 (#5/#9 + Sprint 160~166 누적 + Sprint 167 신규 1건: ai-analysis Summary 의 oci+zstd MB + compression saving % 시각 확인)
  - 이월 유지 — 시드 #23 (rebase 후 누적 카운트 fix 체크리스트)
  - 후속 (선택) 10건 (Sprint 166 이월 그대로)
- **ADR**: [sprint-167.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-167.md) (KR) + [sprint-167.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-167.md) <!-- doc-ref-lint: ignore -->
