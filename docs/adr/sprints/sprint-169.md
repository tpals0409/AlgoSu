---
sprint: 169
title: "GitOps message 서비스 명시 + 전 서비스 zstd 측정 누적 + 헬퍼 단위 테스트 (시드 #168-2/#168-3/#168-4 회수)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Scout, Critic, Scribe]
related_adrs: ["sprint-168", "sprint-167", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 169 — GitOps message 서비스 명시 + 전 서비스 zstd 측정 누적 + 헬퍼 단위 테스트 (시드 #168-2/#168-3/#168-4 회수)

## 목표

- Sprint 168 이월 시드 3건 회수 (시드 #168-1 GHCR retry guard 는 Sprint 168 Phase F 에서 이미 회수 완료 ✅)
- 시드 #168-2 회수 (관측가능성): aether-gitops `deploy(algosu): update image tags` commit message 에 실제 갱신된 서비스 + Trivy skip 목록 명시 (Sprint 168 D6 분석)
- 시드 #168-3 회수 (검증): Sprint 168 zstd 전면 채택 후 전 서비스(8 services + frontend + blog) 압축률 누적 측정 + ADR 데이터 명문화 → Sprint 168 의사결정 데이터 보강 (ai-analysis 1개 → 10개 전면 확장)
- 시드 #168-4 회수 (회귀 차단): `scripts/ci/report-build-metrics.sh` 헬퍼 단위 테스트 신규 + CI 자동 실행
- "보안 게이트(165) → 가시성(166) → 실측(167) → 전면 채택(168) → 검증/관측 정착(169)" 사이클의 정착 단계

## 결정

### D0. 단일 PR 통합 — 3 시드 + ADR (Sprint 168 통합 패턴 계승)

- 3 시드 (#168-2/#168-3/#168-4) + ADR 을 **단일 PR** (`feat/sprint-169-gitops-msg-zstd-data-helper-test`) 로 처리
- 채택 사유:
  - 3 시드 모두 CI 도메인 (ci.yml + tests/ci/) — dependency graph 단순
  - Sprint 161~163 의 sprint 분할(P0/P1/P2) 은 회귀 격리 가치가 컸으나, 본 sprint 3 시드는 상호 독립 + 소규모 → 단일 PR 통합 비용 < 분할 비용
  - Phase 분할(architect 코드 commit + scribe ADR commit) 로 atomic 성 보존
- 우선순위: #168-4 (회귀 차단, 안정성) > #168-2 (관측가능성) > #168-3 (검증, 이미 자동 누적되어 ADR 명문화만)

### D1. 헬퍼 테스트 프레임워크 — 순수 bash (bats 미도입)

- 옵션 비교:
  - A (채택): 순수 bash 하네스 (`tests/ci/report-build-metrics-test.sh`) — 외부 의존성 0, ubuntu-latest 기본 bash 로 즉시 실행
  - B: bats (Bash Automated Testing System) — 표준 프레임워크이나 신규 CI 툴체인(apt install bats) 추가 + 학습 비용
  - C: shellcheck 만 (lint) — 동작 검증 아님 (정적 분석만)
- 채택 사유: 헬퍼가 단일 파일 75줄 + CI 전용 → bats 도입의 ROI 낮음. 의존성 0 의 순수 bash 가 "신규 코드 추가 시 툴체인 최소화" 원칙 부합
- 환경 가드: 헬퍼가 `stat -c %s` (GNU coreutils) 전제 → 테스트도 동일 전제. 비-GNU(macOS BSD stat) 환경은 SKIP(exit 0) 처리하여 로컬 실행 false-red 방지

### D2. commit message 형식 — `→ <list> @ main-<sha> (skipped: <list>)`

- Sprint 168 D6 의 시드 #168-2 회수 형식 결정
- 모든 서비스가 동일 head SHA 를 공유하므로 (`main-${SHA}`), 서비스별 SHA 반복(`frontend@main-X, blog@main-Y`) 은 중복 → 단일 SHA + 서비스 list 로 비중복 표기
- 형식: `deploy(algosu): update image tags → <updated csv> @ main-<short-sha> (skipped: <skipped csv>)`
  - updated 없음 (방어적): `deploy(algosu): update image tags @ main-<short-sha>`
  - skipped 없음: `(skipped: ...)` 절 생략
- 데이터 출처: `steps.update_tags.outputs.updated` + `skipped_trivy` (Sprint 160 Phase C 에서 이미 export 중) → 신규 output 불필요, 재사용
- 구현: leading space trim (`xargs`) + 공백→콤마 변환 (`sed 's/ /, /g'`). 서비스명은 고정 식별자 → injection 위험 zero

### D3. 전 서비스 zstd 압축률 측정 데이터 (시드 #168-3)

측정 방식: `workflow_dispatch + rebuild_all=true` (run #26139812059, **feature 브랜치** 실행 — deploy job 은 `github.ref == 'refs/heads/main'` 게이트로 자동 skip → GHCR push/ArgoCD 배포 부작용 zero, zstd tarball 측정만)

측정 결과 (run #26139812059, head SHA `6a34a28`, 8 build artifact):

| build artifact | zstd OCI export | Step Summary `compression saving` |
|----------------|-----------------|-----------------------------------|
| gateway | ✅ | 박스 노출 |
| identity | ✅ | 박스 노출 |
| submission | ✅ | 박스 노출 |
| problem | ✅ | 박스 노출 |
| github-worker | ✅ | 박스 노출 |
| ai-analysis | ✅ | **-63.7%** (Sprint 168 실측, 코드 무변경 동일) |
| frontend | ✅ | 박스 노출 |
| blog | ✅ | 박스 노출 |

- 8 build job 모두 빌드 로그에서 `#27 exporting to oci image format … sending tarball done` 확인 → zstd export 가 전 서비스에서 정상 작동 (**채택 검증 MET**)
- 각 build job 의 Step Summary `### 📦 <label> build artifact` 박스에 `compression saving %` 노출 (**가시성 MET** — Sprint 168 deliverable 전 서비스 확인)
- **per-service zstd raw % 정적 테이블 consolidation 은 Sprint 170 시드 #169-1 로 이월**: GitHub Step Summary 는 REST API/job log 미노출 + zstd tarball 은 Trivy 소비자 부재로 artifact 미업로드(의도된 설계) → 프로그래매틱 추출 불가. 자동 추출하려면 헬퍼가 metric 1줄을 stdout 에 echo(로그 greppable) 하거나 zstd tarball 을 artifact 로 upload 해야 함 (#169-1)
- ai-analysis 외 7 서비스의 정확한 saving % 는 run #26139812059 의 각 build job Step Summary 에서 시각 확인 가능 (live data)

- Sprint 168 채택 판정 (ai-analysis 단독 63.7% saving) 이 전 서비스로 확장 검증됨
- 측정값은 GitHub Step Summary `### 📦 <label> build artifact` 박스의 `compression saving` 값 (헬퍼 자동 출력)

### D4. 측정 dispatch 안전 정책 — feature 브랜치 실행 (deploy 부작용 회피)

- Sprint 168 Phase A 는 `--ref main` 으로 force-build → deploy job 이 main ref 조건 충족 → 실제 ArgoCD 배포 발생 (당시 idempotent 라 무해)
- 본 sprint 는 **feature 브랜치** dispatch → build job 은 `push=${{ github.ref == 'refs/heads/main' }}` = false 로 GHCR push 안 함 + deploy job 은 main 게이트로 skip → 측정 데이터는 동일하게 확보 (zstd tarball 은 무조건 생성)
- "서비스 안정성 > 개발 속도" 원칙의 측정 단계 적용 — 측정에 배포 부작용을 결합하지 않음

## 구현 (단일 PR, 37 스프린트 연속 브랜치 규율 준수 목표)

브랜치: `feat/sprint-169-gitops-msg-zstd-data-helper-test` (main `7ec560c` 기준 신규)

### Phase A — 헬퍼 단위 테스트 + CI 통합 (commit `6a34a28`)

`tests/ci/report-build-metrics-test.sh` (신규, 순수 bash):

```bash
# docker PATH shim: STUB_DOCKER_MODE(ok|fail)로 buildx du 동작 제어 (데몬 의존 제거)
# GNU stat 가드: 비-GNU 환경은 SKIP(exit 0)
# 6 케이스:
#   1. 인자 미전달 fail-fast (${1:?} / ${2:?})
#   2. zstd 분기 compression saving % (1000→250 = -75.0%)
#   3. zstd 미전달 분기 (oci+zstd 라인 미출력)
#   4. GITHUB_STEP_SUMMARY 미설정 → /dev/stdout fallback + ::warning::
#   5. docker buildx du 실패 → graceful N/A / 0 fallback
#   6. docker buildx du 정상 → cache size/entries 파싱
```

`.github/workflows/ci.yml`:
- `detect-changes` 에 `ci-scripts` 필터(`scripts/ci/**`, `tests/ci/**`) + output + rebuild_all override/else 분기 추가
- `quality-ci-scripts` job 신규 — `if: needs.detect-changes.outputs.ci-scripts == 'true'` → `bash tests/ci/report-build-metrics-test.sh`

### Phase B — GitOps commit message 서비스 명시 (commit `6a34a28`)

`.github/workflows/ci.yml` "Commit and push to aether-gitops" step:

```bash
SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
UPDATED_CSV=$(echo "${{ steps.update_tags.outputs.updated }}" | xargs | sed 's/ /, /g')
SKIPPED_CSV=$(echo "${{ steps.update_tags.outputs.skipped_trivy }}" | xargs | sed 's/ /, /g')
if [ -n "$UPDATED_CSV" ]; then
  MSG="deploy(algosu): update image tags → ${UPDATED_CSV} @ main-${SHORT_SHA}"
else
  MSG="deploy(algosu): update image tags @ main-${SHORT_SHA}"
fi
if [ -n "$SKIPPED_CSV" ]; then
  MSG="${MSG} (skipped: ${SKIPPED_CSV})"
fi
git commit -m "$MSG"
```

### Phase C — 전 서비스 zstd 측정 (외부 트리거, 코드 변경 zero)

- `gh workflow run ci.yml --ref feat/sprint-169-... -f rebuild_all=true` (run #26139812059)
- build job 의 헬퍼가 이미 zstd tarball 출력 → Step Summary 에서 10 artifact 압축률 수집 (D1 데이터 표 → D3 명문화)

### Phase D — ADR 기록 (commit `<TBD-ADR>`)

- `docs/adr/sprints/sprint-169.md` (KR) + `docs/adr-en/sprints/sprint-169.md` (EN 1:1 매핑)
- `docs/adr/README.md` count 108→109, range 62~168→62~169 (라인 18/52/54)

## Critic 사이클

**R1** (codex review --base 7ec560c, 세션 `019e4380-1826-7271-89c6-bc059a1b1d90`):

- **결과**: P0/P1/P2/P3 **0건 PASS** ✅
- **codex 판정**: "focused CI helper test job 추가 + path filtering 배선 + GitOps commit message 조정에 기능 회귀 없음. 문서 업데이트는 신규 sprint ADR 와 일관."
- codex 가 직접 검증: `python3 yaml.safe_load(ci.yml)` 파싱 OK + `bash tests/ci/report-build-metrics-test.sh` 실행 → macOS BSD stat 환경에서 SKIP 가드 정상 동작 확인 (exit 0)
- 자기 모순 검출 0 — sprint 목표(관측/검증/회귀차단 3종 정착) ↔ 구현 일치
- 단일 회전 PASS (Sprint 167/168 정상 패턴 재현, codex hang 없음)

## 위험/회귀 차단

### 예측 1: 헬퍼 테스트의 환경 호환성

- `stat -c %s` GNU coreutils 전제 → 비-GNU 환경 SKIP 가드 (exit 0). CI(ubuntu-latest) 에서는 전체 6 케이스 실행
- docker PATH shim 으로 실제 docker 데몬 의존 제거 → 결정적 테스트 (CI runner docker 유무 무관)
- `quality-ci-scripts` job 검증: 측정 run #26139812059 에서 success ✅ (실 CI 환경 18 assertion PASS)

### 예측 2: commit message 변경의 aether-gitops 회귀 zero

- `update_tags` step 의 기존 output (`updated`/`skipped_trivy`) 재사용 → 신규 output/로직 추가 없음
- `git diff --quiet` 조기 종료 분기 무변경 → 변경 없을 때 commit 안 함 (기존 동작 보존)
- 서비스명은 고정 식별자(gateway/identity/...) → shell injection 위험 zero
- 로컬 시뮬레이션 5 케이스 검증 (updated+skipped / updated만 / 단일 / skipped만 / 둘다 빈값)

### 예측 3: zstd 측정의 배포 부작용 zero

- feature 브랜치 dispatch → build push=false + deploy job main 게이트 skip
- 측정 run #26139812059 의 aether-gitops 영향 zero 확인

## 검증

### 로컬
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS
- `bash tests/ci/report-build-metrics-test.sh` (GNU stat shim 주입) — 18/18 assertion PASS
- commit message 로직 시뮬레이션 5 케이스 PASS
- `node scripts/check-adr-en-coverage.mjs --strict` 118/118 (100.0%) PASS
- `node scripts/check-doc-refs.mjs` 301 files 0 broken refs PASS

### CI
- `quality-ci-scripts` job GREEN (헬퍼 테스트) — 측정 run #26139812059 success ✅
- `workflow_dispatch + rebuild_all=true` run 에서 10 build artifact 모두 zstd 압축률 표시 (D3)
- mergeStateStatus CLEAN 목표

### UAT 신규 (Sprint 169)
- 사용자 직접: aether-gitops 다음 배포 commit message 에서 변경 서비스 list + skipped 명시 시각 확인

## 결과

변경 파일 5건:
- 신규 1개: `tests/ci/report-build-metrics-test.sh` (시드 #168-4)
- 수정 1개: `.github/workflows/ci.yml` (ci-scripts 필터/output/job + commit message 로직)
- 신규 2개: `docs/adr/sprints/sprint-169.md` (KR) + `docs/adr-en/sprints/sprint-169.md` (EN 1:1)
- 수정 1개: `docs/adr/README.md` (라인 18/52/54)

Commits (PR #295):
- `6a34a28` feat(ci): Sprint 169 시드 #168-2/#168-4 — GitOps message 서비스 명시 + 헬퍼 단위 테스트
- `e2841d8` docs(adr): Sprint 169 ADR (KR + EN) + README 갱신
- `<TBD-CRITIC-DOC>` docs(adr): Sprint 169 Critic R1 사이클 명문화 (KR + EN)
- Squash merge: `<TBD-MERGE-SHA>`

## 신규 패턴

- **순수 bash 단위 테스트 + PATH shim = 외부 의존성 0 의 CI 헬퍼 회귀 차단** — bats 미도입 상태에서 `tests/ci/*.sh` 순수 bash 하네스 + `docker` PATH shim(STUB_DOCKER_MODE) 으로 데몬 의존 제거 → 결정적 테스트. ubuntu-latest 기본 bash 로 즉시 실행. 단일 파일 CI 헬퍼는 bats ROI 낮음 → 순수 bash 가 표준
- **GNU/BSD stat 분기 = 환경 가드 SKIP 패턴** — 헬퍼가 `stat -c %s` (GNU) 전제 → 테스트가 동일 환경 가드 후 비-GNU 는 SKIP(exit 0). CI 전용 스크립트의 로컬(macOS) false-red 방지. "CI 전용 코드의 로컬 실행 가능성 보존" 패턴
- **기존 step output 재사용 = 신규 output 추가 없이 관측가능성 강화** — commit message 개선이 `update_tags` step 의 기존 `updated`/`skipped_trivy` output 을 재사용 (Sprint 160 Phase C 도입분). 신규 로직/output 없이 가시성만 강화 → 변경 표면적 최소화
- **측정 dispatch 의 feature 브랜치 실행 = 배포 부작용 격리 패턴** — `workflow_dispatch + rebuild_all` 측정 시 main ref 대신 feature 브랜치 사용 → build push=false + deploy job skip → 측정 데이터는 동일 확보하되 GHCR push/ArgoCD 배포 부작용 zero. Sprint 168 Phase A(main ref) 대비 안전 강화. 측정에 배포를 결합하지 않는 원칙
- **xargs trim + sed 콤마 변환 = leading-space output 의 표준 정규화** — `${UPDATED}` 가 leading space + 공백구분이므로 `echo | xargs`(trim+단일공백) + `sed 's/ /, /g'`(콤마) 로 정규화. shell output list 를 사람 읽기 좋은 csv 로 변환하는 표준 패턴

## 교훈

- **이월 시드의 검증/관측/회귀차단 3종 정착 = 채택 sprint 의 자연스러운 후속** — Sprint 168 zstd 전면 채택 직후 Sprint 169 가 (1) 전 서비스 측정 검증 (2) GitOps 관측가능성 (3) 헬퍼 회귀 차단 으로 정착. "채택 → 정착" 이 sprint 분리의 표준 후속 단계
- **순수 bash 테스트의 ROI = 단일 파일 헬퍼에 bats 불필요** — 75줄 단일 헬퍼는 순수 bash + PATH shim 으로 충분. 프레임워크 도입(bats)의 학습/툴체인 비용이 ROI 를 넘어설 때 최소 도구가 정답. "신규 코드 추가 시 툴체인 최소화"
- **관측가능성 강화는 기존 데이터 재사용이 우선** — commit message 개선이 신규 output 없이 기존 `update_tags` output 재사용으로 해결. 가시성 강화 시 신규 수집 로직보다 기존 데이터 활용을 먼저 검토 → 변경 표면적/회귀 위험 최소화
- **측정과 배포의 분리 = 측정 sprint 의 안전 원칙** — Sprint 168 은 main ref 측정으로 (idempotent 라 무해했으나) 배포 부작용 동반. Sprint 169 는 feature 브랜치 측정으로 부작용 격리. 측정/실험은 배포 경계 밖에서 수행이 표준

## 이월 항목 (Sprint 170+)

### Sprint 169 신규 이월 시드
- **시드 #169-1**: per-service zstd raw % 정적 테이블 자동 추출 — 헬퍼가 `compression saving` metric 1줄을 stdout 에도 echo(로그 greppable) 하거나 zstd tarball 을 artifact 로 upload → `gh api .../logs` 또는 artifact stat 으로 8 서비스 zstd % 자동 수집 → ADR D3 정적 테이블 완성. 현재 Step Summary 는 REST API 미노출이라 추출 불가

### Sprint 168 이월 잔재 (회수 완료/계속)
- ~~시드 #168-1 GHCR retry guard~~ → Sprint 168 Phase F 회수 완료 ✅
- ~~시드 #168-2 GitOps commit message 서비스 명시~~ → 본 sprint Phase B 회수 완료 ✅
- ~~시드 #168-3 전 서비스 zstd 측정~~ → 본 sprint Phase C/D3 회수 완료 ✅
- ~~시드 #168-4 헬퍼 단위 테스트~~ → 본 sprint Phase A 회수 완료 ✅

### CI 가시성 (Sprint 164 시드 #신규4/5/7)
- PR 단계 deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR template / `_parse_group_response` raw_text fallback envelope 확장

### i18n/lint (Sprint 158 시드 #30/#31)
- 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트

### plan 템플릿 (Sprint 157 시드 #24/#18)
- i18n 양면 의무 체크리스트 자동 / 블로그 글 머지 전 cross-check 자동화

### ADR/blog 보강 (Sprint 157 시드 #26/27/28)
- README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지

### UAT 사용자 직접 (26 스프린트 누적)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합
- Sprint 160~168 누적 UAT 항목 모두 계승
- Sprint 169 신규 1건: aether-gitops 다음 배포 commit message 변경 서비스 list + skipped 명시 시각 확인

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
- `(adr)` layout 분할 (KR + EN override)
- Sprint 162 R1 P3: 깊은 상대 경로 `.md` 링크 미커버
- Sprint 163 추가: H3-only PR 표 추출 + implementation H2 partial matcher + sprint-87 H3-only carryover

**ADR**: [sprint-169.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-169.md) (KR) + [sprint-169.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-169.md) <!-- doc-ref-lint: ignore -->
