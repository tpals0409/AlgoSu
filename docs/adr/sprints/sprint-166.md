---
sprint: 166
title: "tarball 크기 $GITHUB_STEP_SUMMARY 출력 — Sprint 165 옵션 C 운영 가시성 (시드 #165-1)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-165", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 166 — tarball 크기 `$GITHUB_STEP_SUMMARY` 출력: Sprint 165 옵션 C 운영 가시성 (시드 #165-1)

## 목표

- Sprint 165 옵션 C(buildx tarball + `trivy --input`) 정착 후 운영 가시성 zero 상태 회수
- PR 마다 8 image tarball 업로드/다운로드 비용 정량화 불가 → 3 build job `$GITHUB_STEP_SUMMARY` 출력 step 추가로 해소
- 향후 시드 #165-2 zstd 압축 비교를 위한 baseline 데이터 확보
- 사용자 선택 A: 시드 #165-1 단독 회수 (안전 점진 개선), #165-2 는 baseline 확보 후 Sprint 167+ 이월

## 결정

### D0. 시드 #165-1 단독 회수 — 사용자 선택 A (안전 점진 개선)

- Sprint 166 1차 범위 후보 A~D 중 **A 채택** (사용자 결정):
  - A(시드 #165-1 단독) / B(#165-1 + Sprint 164 #신규6 통합) / C(#165-1 + #165-2 zstd 실측) / D(UAT 시각 검증 우선)
- 채택 사유: baseline 데이터 없는 상태에서 zstd 비교(#165-2) 는 의미 zero — 단독 측정 후 다음 sprint 비교가 올바른 순서
- Sprint 165 옵션 C 정착(보안 게이트) → Sprint 166(가시성) → Sprint 167(최적화 비교) 3 sprint 사이클의 2단계

### D1. tarball 크기만 1차 도입 — cache hit/miss 정보는 Sprint 167+ 이월

- `docker/build-push-action@v7` metadata output(`containerimage.buildinfo`)이 cache hit/miss 를 직접 노출하지 않음
- `buildx du` 또는 `imagetools inspect` 별도 step 이 필요하나 본 sprint 비범위
- 1차로 `stat -c %s` 바이트 크기만으로도 PR artifact 업로드/다운로드 비용 baseline 확보 가능

### D2. `awk -v b="$SIZE_BYTES"` 변수 전달 패턴 — shell injection 차단

- `awk "BEGIN {... $SIZE_BYTES ...}"` 큰따옴표 expand 의존 대신 `awk -v key="$VAR"` 명시 전달 채택
- SIZE_BYTES 가 정수일 때만 큰따옴표 패턴 안전 → 향후 값 형태 변경 시 awk 문법 에러 가능
- `awk -v` 가 shell/awk 경계를 명확히 분리하는 표준 안전 패턴으로 정착

### D3. `stat -c %s` GNU coreutils — `ubuntu-latest` 환경 보장

- `stat -c %s` 는 GNU coreutils 전용 (macOS 는 `stat -f %z`)
- GitHub Actions `ubuntu-latest` 는 GNU coreutils 보장 → 플랫폼 차이 무관
- CI 전용 step 이므로 macOS 로컬 실행 불일치는 비용 없음

### D4. 3 build job 동일 패턴 (matrix vs 하드코딩만 차이) — DRY 자연 적용

- build-services: `${{ matrix.service }}` 변수 사용 + `if: steps.check.outputs.skip == 'false'` 가드
- build-frontend: `/tmp/image-frontend.tar` 하드코딩 (skip 가드 없음 — job 자체 skip 가드 없음)
- build-blog: `/tmp/image-blog.tar` 하드코딩 (skip 가드 없음)

## 구현 (1 PR, 34 스프린트 연속 브랜치 규율 준수)

브랜치: `feat/sprint-166-tarball-size-summary` (main `c0c48aa` 기준 신규)

### Phase A — ci.yml 3 step 추가 (`d172eea`)

`.github/workflows/ci.yml` `Upload image tarball for Trivy scan` step 직후 3 build job 각각 "Report tarball size" step 삽입 (+41 줄):
- line 690 (build-services, matrix + skip 가드), line 746 (build-frontend, 하드코딩), line 824 (build-blog, 하드코딩)

```yaml
- name: Report tarball size
  run: |
    TARBALL=/tmp/image-frontend.tar   # build-services는 ${{ matrix.service }}, 나머지 하드코딩
    SIZE_BYTES=$(stat -c %s "$TARBALL")
    SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')
    {
      echo "### 📦 frontend build artifact"
      echo "- tarball size: **${SIZE_MB} MB** (${SIZE_BYTES} bytes)"
      echo "- path: \`$TARBALL\`"
      echo "- retention: 1 day"
    } >> "$GITHUB_STEP_SUMMARY"
```

### Phase B — ADR 기록 (본 commit)

- `docs/adr/sprints/sprint-166.md` (KR) + `docs/adr-en/sprints/sprint-166.md` (EN 1:1 매핑)
- `docs/adr/README.md` count 105→106, range 62~165→62~166 (라인 18/52/54)

## 위험/회귀 차단

### 예측 1: `stat` 플랫폼 차이

`stat -c %s` (GNU) vs `stat -f %z` (macOS) 차이 → `ubuntu-latest` 는 GNU coreutils 보장. CI 전용 step 이므로 로컬 불일치는 비용 없음.

### 예측 2: `$GITHUB_STEP_SUMMARY` 크기 한계 1 MiB/job

본 step 추가량 ~200 bytes per job → 한계(1 MiB)와 무관. CI 표준 env var, 모든 step 자동 주입.

### 예측 3: tarball 미생성 상태에서 step 실행

build-services: `if: steps.check.outputs.skip == 'false'` 가드로 build-push-action 실행 후만 step 활성. frontend/blog: build-push-action 성공 시에만 tarball 존재 → step 도달 시점 항상 안전.

## 검증

- **로컬**: `python3 yaml.safe_load` PASS (`YAML OK`), `node scripts/check-adr-en-coverage.mjs --strict` 115/115 PASS, `node scripts/check-doc-refs.mjs` 0 broken refs
- **CI (PR 단계)**: build-services 6 matrix + build-frontend + build-blog job Summary 에 `### 📦 {service} build artifact` H3 + size MB 표시 (UAT 신규 1건)
- trivy-scan 8 matrix 회귀 없음 (`--input` tarball 매칭 무변경)

## 결과

변경 파일 4건:
- 수정 1개: `.github/workflows/ci.yml` +41 줄 (3 step 추가, build-services/frontend/blog)
- 신규 2개: `docs/adr/sprints/sprint-166.md` (KR) + `docs/adr-en/sprints/sprint-166.md` (EN 1:1 매핑)
- 수정 1개: `docs/adr/README.md` (라인 18/52/54 — count 105→106, range 62~165→62~166)

## 신규 패턴

- **build job Summary 가시성 패턴** — build artifact 생성 → upload 직후 `$GITHUB_STEP_SUMMARY` 출력 step 추가가 표준 모니터링 패턴. matrix vs 하드코딩 job 모두 동일 구조 적용. Sprint 165 옵션 C 정착 후 즉시 가시성 후속 step 추가 → 운영 관찰 기반 최적화(시드 #165-2) 사이클의 1단계
- **`awk -v` 변수 전달 = shell 안전 표준 패턴** — `awk "BEGIN {... $SHELL_VAR ...}"` 큰따옴표 expand 의존 대신 `awk -v key="$VAR"` 명시 전달. yaml run script 내 shell/awk 경계 명확화. 향후 CI yaml 스크립트 작성 시 표준 패턴으로 정착
- **baseline 데이터 확보 우선 + 비교 forward-fix 분할** — 시드 #165-2 zstd 비교는 baseline 없으면 의미 zero. 본 sprint 데이터 수집 → 다음 sprint 비교. 분할 회귀 격리 + 측정 가치 우선 패턴

## 교훈

- **Sprint 165 옵션 C 정착의 즉시 후속 모니터링이 운영 가치 보존** — 보안 게이트 정착(Sprint 165) 후 가시성 zero 상태가 1 sprint 만에 시드 #165-1 로 회수. 정착 sprint 가 후속 시드를 즉시 생성하는 패턴 가치 재확인. "보안 게이트 → 가시성 → 최적화" 3 sprint 사이클 시작
- **`awk` shell expansion 의존은 미래 회귀 리스크** — `awk "... $VAR ..."` 큰따옴표 패턴은 SIZE_BYTES 가 정수일 때만 안전. 향후 값 형태 변경(예: 경로 포함) 시 awk 문법 에러 가능. `awk -v` 가 표준 안전 패턴으로 정착
- **buildx metadata cache 정보 부재 = 다음 sprint 별도 도구 필요** — `docker/build-push-action@v7` metadata output 이 cache hit/miss 를 직접 노출하지 않음. `buildx du` 또는 `imagetools inspect` 별도 step 필요 → Sprint 167+ 별도 시드
- **본질 단순화 우선 — D2/D3 가 implementation detail 이지만 ADR 기록 가치 있음** — 작은 sprint 라도 결정 근거 명문화가 향후 회귀/오해 차단. D2(awk -v)/D3(stat -c) 가 PR 본문에만 있으면 6개월 후 이유를 모름

## 이월 항목 (Sprint 167+)

- **Sprint 166 신규 이월 시드**:
  - 시드 #165-2 zstd 압축 실측 비교 (본 sprint baseline 데이터 확보 후 `type=oci,compression=zstd` vs `type=docker` 크기/시간 측정)
  - cache hit/miss 가시성 (`buildx du` 또는 `imagetools inspect` 별도 step — Sprint 167+ 시드)
- **Sprint 165 이월 계속**:
  - Sprint 164 시드 #신규4~7 CI 가시성 (deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR / `$GITHUB_STEP_SUMMARY` 표준화 / `_parse_group_response` envelope 확장)
  - 시드 #30/#31 (Sprint 158 i18n/lint): 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트
  - 시드 #24/#18 (Sprint 157): plan 템플릿 i18n 양면 의무 자동 + 블로그 글 머지 전 cross-check 자동화
  - 시드 #26/27/28 (Sprint 157 ADR/blog 보강): README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지
  - UAT 22 스프린트 누적 사용자 직접 검증 (#5/#9 + Sprint 160~165 누적 + Sprint 166 신규 1건: tarball size Summary 시각 확인)
  - 이월 유지 — 시드 #23 (rebase 후 누적 카운트 fix 체크리스트)
  - 후속 (선택) 9건 (Sprint 165 이월 그대로)
- **ADR**: [sprint-166.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-166.md) (KR) + [sprint-166.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-166.md) <!-- doc-ref-lint: ignore -->
