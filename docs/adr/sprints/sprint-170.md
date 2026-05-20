---
sprint: 170
title: "zstd 절감률 stdout 자동 추출 + 측정 발견: warm cache 에서 zstd ~0% (시드 #169-1 회수)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Scout, Critic, Scribe]
related_adrs: ["sprint-169", "sprint-168", "sprint-167"]
related_memory: ["sprint-window"]
---
# Sprint 170 — zstd 절감률 stdout 자동 추출 + 측정 발견: warm cache 에서 zstd ~0% (시드 #169-1 회수)

## 목표

- Sprint 169 이월 시드 #169-1 회수: `report-build-metrics.sh` 헬퍼가 `compression saving %` 를 `$GITHUB_STEP_SUMMARY` 외에 **stdout(job 로그)** 에도 greppable 마커로 출력 → `gh run view --log | grep` 으로 8 서비스 zstd % **자동 수집** → Sprint 169 ADR D3 의 미완 정적 테이블(ai-analysis 1개만 raw %) 완성
- 헬퍼 변경에 맞춰 `quality-ci-scripts` 단위 테스트 동시 확장 (회귀 차단 의무)
- "보안 게이트(165) → 가시성(166) → 실측(167) → 전면 채택(168) → 검증/관측 정착(169) → 측정 자동화(170)" 사이클의 측정 자동화 단계

## 결정

### D0. 채택 방식 — 옵션 A (stdout echo)

- 옵션 비교:
  - A (채택): 헬퍼가 절감률 metric 1줄을 stdout(job 로그)에도 echo → `gh run view --log | grep` 으로 추출. storage 비용 0, 로그 관측성 보너스
  - B: zstd tarball 을 `upload-artifact` → `gh run download` + stat 으로 정확 bytes 수집. 단 storage 비용 + Trivy 소비자 부재로 artifact 무의미
- 채택 사유: Step Summary 는 GitHub REST API/`gh run view --log` 에 미노출이라 프로그래매틱 추출 불가(Sprint 169 D3 이월 사유). 옵션 A 가 storage 0 + 로그에서 8 서비스 한 번에 grep 가능 → 우월

### D1. 마커 형식 — 평문 greppable 라인 (`::notice::` 미사용)

- 형식: `ZSTD-METRIC service=<label> docker_bytes=<n> zstd_bytes=<n> saving_pct=-<pct>`
- `::notice::` annotation 대신 평문 마커 채택 — grep 견고성 + GitHub annotation 한도/노이즈 회피
- 출력 위치: `} >> "$GITHUB_STEP_SUMMARY"` 블록 **직후** stdout. 그룹 명령 `{ }` 은 서브셸이 아니므로 zstd 분기에서 설정한 `ZSTD_BYTES`/`SAVE_PCT` 가 블록 이후에도 유효 → 재계산 불필요(최소 변경)
- zstd 파일 부재(N/A) 시 마커 미출력 — 현행 8 서비스는 zstd 무조건 생성하므로 success-only 로 충분

### D2. 단위 테스트 Case 7 (회귀 차단 의무)

- `tests/ci/report-build-metrics-test.sh` Case 7 추가 — 헬퍼 변경 시 `quality-ci-scripts` job 회귀 차단 의무 (Sprint 169 시드 #168-4 정착)
- 검증 3종: (1) stdout 마커 값 정확성 (`docker=1000 zstd=250 saving=-75.0`) (2) 마커가 Summary 파일에 미혼입 (stdout 분리) (3) zstd 미전달 시 마커 부재
- 기존 GNU stat 가드 계승 — macOS 로컬 SKIP(exit 0), CI(ubuntu-latest) 전체 실행 (18 → 22 assertion)

### D3. 측정 결과 — warm cache 에서 zstd ~0% (핵심 발견)

측정 방식: **PR #296 의 CI run #26140657480** (별도 `workflow_dispatch` 불필요). 헬퍼 파일이 `detect-changes` 의 모든 서비스 필터에 포함(`'scripts/ci/report-build-metrics.sh'`)되어 헬퍼 변경 PR 이 8 build job 을 전부 트리거 → PR run 자체가 측정 run. PR 은 `push=${{ github.ref == 'refs/heads/main' }}` = false → GHCR push/ArgoCD 배포 부작용 zero (Sprint 169 D4 격리 원칙을 PR run 으로 자연 충족).

`gh run view 26140657480 --log | grep ZSTD-METRIC` 자동 수집 결과 (head SHA `12b3535`, 8 build artifact):

| build artifact | docker tarball | oci+zstd tarball | compression saving |
|----------------|----------------|------------------|--------------------|
| gateway | 94.8 MB (99,382,272 B) | 94.8 MB (99,380,224 B) | **-0.0%** |
| identity | 77.4 MB (81,171,456 B) | 77.4 MB (81,169,408 B) | **-0.0%** |
| submission | 77.8 MB (81,590,272 B) | 77.8 MB (81,588,224 B) | **-0.0%** |
| problem | 77.5 MB (81,282,560 B) | 77.5 MB (81,280,512 B) | **-0.0%** |
| github-worker | 64.0 MB (67,122,688 B) | 64.0 MB (67,120,640 B) | **-0.0%** |
| ai-analysis | 55.8 MB (58,486,784 B) | 55.8 MB (58,484,736 B) | **-0.0%** |
| frontend | 94.0 MB (98,544,640 B) | 94.0 MB (98,543,104 B) | **-0.0%** |
| blog | 30.8 MB (32,316,928 B) | 30.8 MB (32,315,392 B) | **-0.0%** |

**발견**: 8 서비스 모두 docker tarball 과 oci+zstd tarball 의 크기 차이가 정확히 **2048 bytes**(컨테이너 포맷 manifest/index 오버헤드) → layer blob 이 두 exporter 에서 **byte-identical** → zstd 압축이 layer 에 실제 적용되지 않음(절감 ~0%).

**원인 (cold vs warm cache)**:
- 빌드 로그에 `#7 importing cache manifest from gha:...` 확인 → `cache-from: type=gha` warm cache 적중
- buildx 는 `force-compression=true` 부재 시 캐시/베이스 이미지의 기존 압축 layer blob 을 **재압축하지 않고 그대로 재사용** → `type=docker` 와 `type=oci,compression=zstd` 두 export 가 동일 blob 을 임베드 → 크기 동일
- Sprint 168 의 ai-analysis -63.7% (docker 66.9 MB → zstd 24.3 MB)는 **zstd 최초 도입 빌드(cold/fresh layer)** 의 일회성 측정 + zstd 값을 사용자가 UI 에서 수동 입력한 것 → steady-state 를 대표하지 않음

**의미**:
- 현행 zstd OCI export 는 warm cache 정상 빌드에서 절감 ~0% + Trivy 가 소비하는 것은 docker tarball(zstd tarball 은 미업로드, 소비자 부재) → **현재 zstd export 는 사실상 미소비 + 무절감의 잉여 export step**
- 본 발견은 #169-1 자동 측정이 의도대로 작동한 결과 — Step Summary 수동 확인으로는 "전 서비스 박스 노출"까지만 확인됐으나(Sprint 169 D3), 자동 추출이 raw bytes 비교로 ~0% 사실을 드러냄
- 후속 결정은 **시드 #170-1 로 분리** (스코프 비대화 회피, 측정 sprint 원칙)

### D4. PR run = 측정 run (Sprint 169 D4 의 자연 진화)

- Sprint 169 D4 는 측정을 위해 별도 `workflow_dispatch + rebuild_all=true` 를 feature 브랜치에 실행
- 본 sprint 는 헬퍼 파일이 모든 서비스 detect-changes 필터에 등록되어 있어 **헬퍼 변경 PR 이 자동으로 8 build job 전체 트리거** → 별도 dispatch 없이 PR run 이 측정 run 이 됨 → CI 비용 1회 절감
- PR run 의 build `push=false` + deploy job main 게이트 → 배포 부작용 zero (D4 격리 원칙 동일 충족)

## 구현 (단일 PR, 38 스프린트 연속 브랜치 규율 준수)

브랜치: `feat/sprint-170-zstd-metric-stdout` (main `c8f6cb6` 기준 신규)

### Phase A — 헬퍼 stdout 마커 (commit `12b3535`)

`scripts/ci/report-build-metrics.sh` 의 Summary 블록 직후:

```bash
# Sprint 170 시드 #169-1: zstd 절감률을 stdout(job 로그)에도 greppable 마커로 출력.
if [ -n "$ZSTD_TARBALL" ] && [ -f "$ZSTD_TARBALL" ]; then
  echo "ZSTD-METRIC service=${LABEL} docker_bytes=${SIZE_BYTES} zstd_bytes=${ZSTD_BYTES} saving_pct=-${SAVE_PCT}"
fi
```

### Phase B — 단위 테스트 Case 7 (commit `12b3535`)

`tests/ci/report-build-metrics-test.sh` Case 7 — stdout 캡처 후 마커 값/Summary 미혼입/zstd 미전달 부재 검증 + 헤더 주석 검증케이스 7번 추가.

### Phase C — 측정 자동 수집 (외부 트리거, 코드 변경 zero)

- PR #296 CI run #26140657480 (8 build job success) → `gh run view --log | grep ZSTD-METRIC` 로 8 서비스 raw bytes 자동 수집 → D3 정적 테이블 완성

### Phase D — ADR 기록 (commit `<TBD-ADR>`)

- `docs/adr/sprints/sprint-170.md` (KR) + `docs/adr-en/sprints/sprint-170.md` (EN 1:1 매핑)
- `docs/adr/README.md` count 109→110, range 62~169→62~170 (라인 18/52/54)

## Critic 사이클

**R1** (codex review --base c8f6cb6, 세션 `<TBD-SESSION>`):

- **결과**: `<TBD>`

## 위험/회귀 차단

### 예측 1: 마커 출력의 부작용 zero

- 마커는 build job step 의 stdout 1줄 → 다운스트림 파서 부재(순수 로그). build/deploy 로직 무변경
- `quality-ci-scripts` job success (run #26140657480) → 실 CI 22 assertion PASS

### 예측 2: 측정 정확성

- 헬퍼는 실제 파일 크기(`stat -c %s`)를 비교 → 측정 자체는 정확. ~0% 는 측정 오류가 아닌 buildx 동작(force-compression 부재)의 실제 결과
- 2048 bytes 일정 차이 = OCI/docker 컨테이너 포맷 오버헤드 (layer blob 동일성 방증)

## 검증

### 로컬
- `bash tests/ci/report-build-metrics-test.sh` (GNU stat shim 주입) — 22/22 assertion PASS / macOS 기본 SKIP(exit 0)
- `bash -n` 구문 검사 PASS (helper + test)
- `node scripts/check-adr-en-coverage.mjs --strict` 119/119 (100.0%) PASS
- `node scripts/check-doc-refs.mjs` 303 files 0 broken refs PASS

### CI
- PR #296 run #26140657480: success — 8 build job + `quality-ci-scripts` 모두 success
- `gh run view 26140657480 --log | grep ZSTD-METRIC` → 8 서비스 마커 자동 추출 확인 (D3)
- mergeStateStatus CLEAN 목표

### UAT 신규 (Sprint 170)
- 사용자 직접: PR run 또는 main run 의 `gh run view --log | grep ZSTD-METRIC` 로 8 서비스 마커 로그 노출 시각 확인

## 결과

변경 파일 (PR #296):
- 수정 1개: `scripts/ci/report-build-metrics.sh` (stdout 마커)
- 수정 1개: `tests/ci/report-build-metrics-test.sh` (Case 7)
- 신규 2개: `docs/adr/sprints/sprint-170.md` (KR) + `docs/adr-en/sprints/sprint-170.md` (EN 1:1)
- 수정 1개: `docs/adr/README.md` (라인 18/52/54)

Commits (PR #296):
- `12b3535` feat(ci): zstd 절감률 stdout greppable 마커 + 단위 테스트 Case 7 (시드 #169-1)
- `<TBD-ADR>` docs(adr): Sprint 170 ADR (KR + EN) + README 갱신
- Squash merge: `<TBD-MERGE-SHA>`

## 신규 패턴

- **stdout greppable 마커 = Step Summary 의 프로그래매틱 추출 우회** — GitHub Step Summary 는 REST API/job log 미노출이므로 자동 수집 불가. 헬퍼가 동일 metric 을 stdout 에 평문 마커로 echo 하면 `gh run view --log | grep` 으로 추출 가능. storage 0 + 로그 관측성 보너스. Summary(사람용 렌더) + stdout 마커(기계 수집) 이중 출력 패턴
- **그룹 명령 변수 지속성 활용 = 재계산 없는 최소 변경** — `{ ... } >> file` 은 서브셸이 아니므로 블록 내 설정 변수가 블록 이후에도 유효. 마커 출력 시 zstd bytes/saving 재계산 불필요
- **헬퍼 파일의 전 서비스 필터 등록 = PR run 의 측정 run 화** — 공유 헬퍼(`scripts/ci/report-build-metrics.sh`)가 모든 서비스 detect-changes 필터에 등록되어 헬퍼 변경 PR 이 8 build job 전체를 자동 트리거 → 별도 측정 dispatch 불필요. PR run = 측정 run (CI 비용 1회 절감, Sprint 169 D4 의 자연 진화)
- **자동 측정이 수동 확인의 맹점을 드러냄** — Sprint 169 D3 는 Step Summary 박스 "노출 여부"만 수동 확인 가능했으나, raw bytes 자동 추출이 8 서비스 ~0% 절감 사실을 정량 노출. 수동 시각 확인 → 자동 정량 측정 전환의 가치 입증

## 교훈

- **측정 자동화는 prior 의사결정의 가정을 검증한다** — Sprint 168 zstd 전면 채택은 ai-analysis 단일 cold-cache 측정(-63.7%, 수동 입력)에 근거. #169-1 자동 측정이 steady-state(warm cache) 에서 ~0% 절감을 드러냄 → "1회 측정 + 수동 입력"의 대표성 한계를 자동 측정이 교정. 의사결정 데이터는 자동 + 반복 측정으로 검증해야 함
- **buildx 는 force-compression 부재 시 캐시 layer 를 재압축하지 않는다** — `compression=zstd` 는 신규 layer 에만 적용되고, 캐시/베이스 이미지의 기존 압축 blob 은 그대로 재사용(`type=docker` 와 `type=oci,zstd` 가 동일 blob 임베드 → 크기 동일). zstd 절감을 보장하려면 `force-compression=true` 필요(단 빌드 시간 trade-off, 별도 측정 필요)
- **cold vs warm cache 는 측정 결과를 좌우한다** — 압축/시간 측정은 cache 상태를 명시해야 재현 가능. cold(첫 빌드)와 warm(캐시 적중)의 수치가 본질적으로 다름. 측정 ADR 은 cache 상태를 기록 의무화
- **측정 sprint 는 발견을 분리한다** — ~0% 발견의 후속(force-compression 도입 vs zstd export 제거)은 별도 측정 + 결정이 필요 → 시드 #170-1 로 분리. 측정 sprint 에서 발견을 즉시 fix 로 확장하지 않음(스코프 비대화 회피, "측정과 변경의 분리")

## 이월 항목 (Sprint 171+)

### Sprint 170 신규 이월 시드
- **시드 #170-1 (최우선)**: zstd ~0% 발견 후속 결정 — 옵션 (a) `force-compression=true` 추가(zstd 절감 보장, 단 빌드 시간 cold-cache A/B 측정 필요) vs (b) zstd OCI export 제거(미소비 + warm-cache 무절감의 잉여 step 제거, Trivy 는 docker tarball 만 사용). 결정 전 cold-cache 빌드에서 force-compression A/B 실측 권장. 본 sprint stdout 마커 + Case 7 이 측정 인프라로 재사용 가능

### Sprint 169 이월 (회수 완료)
- ~~시드 #169-1 zstd raw % 자동 추출~~ → 본 sprint 회수 완료 ✅ (+ 측정 발견 D3)

### CI 가시성 (Sprint 164 시드 #신규4/5/7)
- PR 단계 deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR template / `_parse_group_response` raw_text fallback envelope 확장

### i18n/lint (Sprint 158 시드 #30/#31)
- 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트

### plan 템플릿 (Sprint 157 시드 #24/#18)
- i18n 양면 의무 체크리스트 자동 / 블로그 글 머지 전 cross-check 자동화

### ADR/blog 보강 (Sprint 157 시드 #26/27/28)
- README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지

### UAT 사용자 직접 (27 스프린트 누적)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합
- Sprint 160~169 누적 UAT 항목 모두 계승
- Sprint 170 신규 1건: `gh run view --log | grep ZSTD-METRIC` 로 8 서비스 마커 로그 노출 시각 확인

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
- **MEMORY.md 비대 정리** (시스템 경고 43.6KB): 초장문 inline sprint 엔트리 → 간결 1줄 인덱스 + 상세는 ADR 참조

**ADR**: [sprint-170.md](../../../../Desktop/leo.kim/AlgoSu/docs/adr/sprints/sprint-170.md) (KR) + [sprint-170.md EN](../../../../Desktop/leo.kim/AlgoSu/docs/adr-en/sprints/sprint-170.md) <!-- doc-ref-lint: ignore -->
