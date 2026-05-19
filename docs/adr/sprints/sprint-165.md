---
sprint: 165
title: "PR 단계 Trivy 보안 게이트 정착 — 옵션 C tarball + --input (Sprint 164 Phase A 본질 재설계)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-164", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 165 — PR 단계 Trivy 보안 게이트 정착: 옵션 C tarball + `--input`

## 목표

- Sprint 164 Phase A 이월 회수 — PR 단계 Trivy scan 을 보안 게이트로 정착하기 위한 본질 재설계
- 단순 `if` 조건 변경(Sprint 164 Phase A close 사유) 이 image registry 정책과 충돌하므로, build job 자체 + Trivy 스캔 방식을 함께 재설계
- 3안 비교 (옵션 A `load: true` / 옵션 B PR-specific tag push / 옵션 C buildx tarball + fs scan) 후 본질 결정
- 단일 sprint 4 phase 완결 (Sprint 161~163 3-sprint 분할 정책을 본질 재설계 단일 사례에 한해 통합 적용)

## 결정

### D0. 옵션 C 채택 (사용자 결정)

- **옵션 C (buildx tarball + `--input`)** — build job 이 `outputs: type=docker,dest=*.tar` 로 tarball export → `actions/upload-artifact@v6` 로 업로드 → trivy-scan job 이 `download-artifact` 로 받아 `trivy image --input <tarball>` local scan
- **채택 사유**:
  - GHCR push 0건 (storage 비용 zero, cleanup workflow 불필요)
  - `linux/arm64` 단일 platform 정책 무변경 (옵션 A 충돌 회피)
  - matrix 구조 유지 (Sprint 160 per-service deploy gate 패턴 무변경)
- **반려 사유**:
  - 옵션 A (`load: true` + local scan): buildx `load` 는 single-platform daemon 필요 → `linux/arm64` build + GHA host `linux/amd64` runner 와 충돌. tarball 변형으로 사실상 옵션 C 로 수렴
  - 옵션 B (PR-specific tag push): PR 마다 8 이미지 GHCR push → storage 증가 + retention/cleanup workflow 필요 → 운영 부채

### D1. buildx multi-output 양립 — `outputs:` 단일 build

`docker/build-push-action@v7` 는 `outputs:` 와 별도 `push:` 가 충돌. `outputs:` 정의 시 push 도 outputs 안에 명시:

```yaml
# 이전 (Sprint 164 close 사유의 인접 원인)
push: ${{ github.ref == 'refs/heads/main' }}
tags: ${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}

# Sprint 165 신규
outputs: |
  type=image,push=${{ github.ref == 'refs/heads/main' }},name=${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}
  type=docker,dest=/tmp/image-${{ matrix.service }}.tar
```

채택 근거: 보수적 최소 변경 (build 1회) + 캐시 scope 무변경. 캐시 hit rate 회귀 시 Sprint 165 내 step 분리로 forward-fix 옵션 보유.

### D2. tarball 포맷 — `type=docker` (uncompressed) + GHA 기본 zip 압축

- `type=docker`: docker save 호환 tar. Trivy `--input` reference 구현, 호환성 100%
- `actions/upload-artifact@v6` 의 기본 zip 압축이 docker save tarball 의 layer 메타데이터에 효과적
- `type=oci,compression=zstd` 는 이중 압축 비효율 우려 → 실측 후 forward-fix 보유

### D3. Trivy `--platform` 옵션 — 제거

tarball 은 `linux/arm64` 단일 manifest 이므로 `--platform` 옵션은 무의미. `--input` 사용 시 platform 매칭 실패 위험 차단.

### D4. deploy gate 패턴 (Sprint 160) — 무변경

`deploy` job 은 `if: github.ref == 'refs/heads/main'` 가드로 PR 단계 자동 차단. trivy-status artifact 는 PR 에서도 생성되지만 deploy 가 lookup 안 함 → 비용 zero, 회귀 zero.

## 구현 (1 PR, 33 스프린트 연속 브랜치 규율 준수)

| PR | Phase | 브랜치 | 결과 |
|----|-------|--------|------|
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | A — build tarball export | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase A `b8c6918` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | B — Trivy `--input` 전환 | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase B `1f9c364` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | C — Critic R1 P2 fix (SARIF fork PR 가드) | `feat/sprint-165-pr-trivy-tarball` | ✅ Phase C `8068806` |
| [#290](https://github.com/tpals0409/AlgoSu/pull/290) | D — Sprint 165 ADR | `feat/sprint-165-pr-trivy-tarball` | 본 ADR |

### Phase A — build job tarball export (`b8c6918`)

- **변경 파일**: `.github/workflows/ci.yml` (+31 -6)
- **변경 범위**: 3개 build job (`build-services` / `build-frontend` / `build-blog`)
- **핵심 변경**:
  - `push:`/`tags:` 키 제거 → `outputs:` multi-line (image push 조건부 + docker tarball 무조건)
  - `actions/upload-artifact@v6` step 신규 (name: `image-tar-${service}`, retention-days: 1, `skip` 가드 동일)
  - `platforms` / `cache-from` / `cache-to` / `build-args` / `context`: **무변경**
- **검증**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` PASS, diff stat +31 -6

### Phase B — Trivy `--input` 전환 (`1f9c364`)

- **변경 파일**: `.github/workflows/ci.yml` (+11 -11)
- **핵심 변경**:
  - `if: github.ref == 'refs/heads/main' && !cancelled()` → `if: ${{ !cancelled() }}`
  - Checkout 직후 `actions/download-artifact@v6` step 신규 (name: `image-tar-${matrix.service}`, path: `/tmp`)
  - `trivy image` 2회 호출 (table + SARIF): `--platform linux/arm64` 제거, registry ref → `--input /tmp/image-${service}.tar`
  - `TRIVY_USERNAME`/`TRIVY_PASSWORD` env 제거 (registry 인증 불필요)
  - `.trivyignore` / `--severity CRITICAL,HIGH` / `--exit-code 1` / `--ignore-unfixed` / SARIF format/output / `upload-sarif@v4` / status artifact: **무변경**
- **검증**: YAML parse PASS, trivy-scan steps 9 (신규 download-artifact 1건 추가), Sprint 160 per-service gate 패턴 무변경

### Phase C — Critic R1 P2 fix + 실측

**Codex Critic R1** (codex review --commit `1f9c364`, session via `codex exec`):
- **P0/P1: 0건** ✅
- **P2 1건**: fork/Dependabot PR 에서 `upload-sarif@v4` 권한 부족으로 fail 가능
  - 원인: GitHub fork PR 의 `GITHUB_TOKEN` 은 read-only 라 `security-events: write` 미허용
  - 영향: Trivy table scan 은 성공하나 SARIF 업로드만 실패 → Sprint 164 "noisy CI red" 패턴 재발 가능 (sprint 목표 부분 자기 모순)
  - 권장 조치: SARIF upload step 의 `if` 에 same-repo PR 가드 추가
- **Focused Checks 5건 모두 OK**: buildx multi-output 양립 / Trivy `--input` + arm64 tarball / deploy gate 회귀 / registry 인증 제거 / PR-commit 설명 일치

**Phase C P2 fix** (commit `8068806` + R2 forward-fix `<TBD-FORWARDFIX-SHA>`):
- `.github/workflows/ci.yml:895` "Upload Trivy SARIF" step 의 `if` 조건 확장 (R1 + R2 P2 통합):
  ```yaml
  if: >
    always() &&
    steps.check.outputs.skip == 'false' &&
    (github.event_name != 'pull_request' ||
     (github.event.pull_request.head.repo.full_name == github.repository &&
      github.event.pull_request.user.login != 'dependabot[bot]'))
  ```
- table scan (PR gate) 은 그대로 유지 → 보안 게이트 효과 100% 보존
- SARIF 업로드만 same-repo non-Dependabot PR + main 으로 제한 → fork/Dependabot noisy red 차단
- R2 P2 검출: GitHub Docs "Dependabot on GitHub Actions" 에 따르면 same-repo Dependabot PR 도 read-only `GITHUB_TOKEN` 적용 → 기존 `head.repo.full_name == repository` 단일 가드는 부분적. `pull_request.user.login != 'dependabot[bot]'` 결합 필요

**실측 결과 (PR #290 run 26087105241, ci.yml + sprint-165.md 변경 PR)**:
- detect-changes: services 6건 changed=false (코드 변경 없음), blog/docs changed=true (`docs/adr/**` 매칭)
- build-services 6건 SUCCESS (각 4-9 sec — `Skip if not changed` step 만 실행)
- build-frontend SKIPPED, build-blog 는 본 ADR commit 후 실행 예정
- Trivy Scan 8 matrix 모두 SUCCESS (skip step 정상 작동, 매트릭스 회귀 zero)
- **본 PR 한정 한계**: ci.yml 자체는 paths-filter 매칭 안 됨 → tarball + `--input` 실증 검증은 다음 코드 변경 PR (e.g., 시드 #신규4~7 회수) 에서 자연 발생. UAT 항목으로 이월

### Phase D — ADR 기록 (본 PR)

- **신규 파일**: `docs/adr/sprints/sprint-165.md` (KR) + `docs/adr-en/sprints/sprint-165.md` (EN)
- **갱신 파일**: `docs/adr/README.md` count 104 → 105, range 62~164 → 62~165
- **메모리 갱신**: `sprint-window.md` Sprint 164 → Sprint 165 슬라이딩 (Phase D 완료 후 Oracle 직접)

## 위험/회귀 차단 (Critic R1 사전 예측 3건)

### 예측 1: buildx multi-output 캐시 hit rate 저하

- **원인 가설**: `cache-to: type=gha,mode=max` 와 `outputs: type=image,push=... + type=docker,dest=...` 조합에서 layer 캐시 효율 저하 보고 사례
- **사전 차단**: D1 채택 + `cache-from`/`cache-to` scope 무변경
- **Critic R1 결과**: ✅ OK — "cache key나 hit rate를 직접 망가뜨리는 변경은 아닙니다. retention-days: 1이라 저장소 할당량 리스크는 낮습니다"

### 예측 2: Trivy `--input` + `--platform` 매칭 실패

- **원인 가설**: `linux/arm64` 단일 manifest tarball 에 `--platform linux/arm64` 명시 시 매칭 실패 보고
- **사전 차단**: D3 — `--platform` 옵션 제거. Phase B diff 명시
- **Critic R1 결과**: ✅ OK — "Trivy `--platform` 제거는 단일 이미지 tarball scan에 맞습니다. Trivy 문서도 tar archive scan용 `--input`을 지원"

### 예측 3: deploy gate artifact 회귀

- **원인 가설**: trivy-scan 이 PR 단계에도 status artifact 생성 → deploy job 이 PR artifact 를 잘못 lookup 할 가능성
- **사전 차단**: D4 — deploy 의 `github.ref == 'refs/heads/main'` 가드가 자동 차단
- **Critic R1 결과**: ✅ OK — "PR에서 생성된 `trivy-status-*` artifact는 deploy job이 실행되지 않으므로 lookup되지 않습니다"

### 신규 검출: fork/Dependabot PR SARIF 업로드 실패 (Critic R1 P2)

- **원인**: fork/Dependabot PR 의 `GITHUB_TOKEN` 은 read-only 라 `security-events: write` 권한 차단 → `upload-sarif@v4` fail
- **영향**: Trivy table scan 은 성공해도 SARIF 업로드만 실패 → Sprint 164 noisy CI red 패턴 재발 가능 (sprint 목표 부분 자기 모순)
- **Phase C fix 적용**: SARIF upload step `if` 조건 확장 — same-repo PR + main 만 허용, fork/Dependabot PR 자동 skip. table scan 은 그대로 유지하여 보안 게이트 효과 100% 보존

## 검증

- [x] CI 35 checks PASS (run 26087105241, mergeStateStatus CLEAN)
- [x] PR Checks 탭 `Trivy Scan — {service}` 8 matrix 표시 (gateway/identity/submission/problem/github-worker/ai-analysis/frontend/blog)
- [x] `deploy` job 자동 skip 확인 (PR 단계 trigger 안 됨, `github.ref == 'refs/heads/main'` 가드)
- [x] Codex Critic R1: P0/P1 0건, P2 1건 (fork PR SARIF) — Phase C 즉시 fix
- [ ] Codex Critic R2 PASS — Phase C fix 후 push + 호출 예정
- [ ] check-adr-en-coverage --strict 114/114 (100.0%) PASS
- [ ] check-doc-refs 0 broken refs
- [ ] **이월 UAT**: tarball + `--input` 실증 검증 (다음 코드 변경 PR 에서 자연 발생)
- [ ] **이월 UAT**: Security 탭 SARIF code scanning alert 시각 확인 (main merge 후)
- [ ] **이월 UAT**: cache hit rate 실측 (multi-output 회귀 차단 검증)

## 결과

- **origin/main**: `ecfe954` → **`<TBD-MERGE-SHA>`** (PR #290 squash merge 후 sprint-window.md 갱신)
- **commits**: Phase A `b8c6918` + Phase B `1f9c364` + Phase C `8068806` + Phase D `de38d62` + R2 P2/P3 forward-fix `<TBD-FORWARDFIX-SHA>` (총 5 commit → squash merge)
- **ci.yml 변경 누적**: +50 -18 (3 build job multi-output + trivy --input + SARIF fork 가드)

## 신규 패턴

- **본질 재설계 1-sprint 통합 vs 분할 패턴 비교**: Sprint 161~163 분할(P0/P1/P2 sprint별) vs Sprint 165 단일 통합. 옵션 비교 → 본질 결정 → 단일 PR 의 단순 dependency-graph 가 분할의 회귀 격리 효과보다 우선
- **buildx multi-output 명시 패턴**: `outputs: | type=image,push=...,name=... + type=docker,dest=...` 두 줄. `push:` 와 `tags:` 키를 outputs 안 `type=image` 한 줄에 통합. push 정책 분기는 outputs 내부의 `push=<expression>` 로 일관 처리
- **upload-artifact + download-artifact 페어 매트릭스 명명**: build job 의 `name: <prefix>-${matrix.service}` 가 trivy-scan job 에서 `name: <prefix>-${matrix.service}` 로 1:1 매칭. matrix 다른 두 job 간 artifact transfer 표준 패턴
- **`--platform` 제거 = tarball scan 안전 패턴**: 단일 manifest tarball 은 `--platform` 명시 시 매칭 실패 위험. Trivy `--input` 사용 시 `--platform` 제거가 디폴트 (registry pull 과 차이 명문화)
- **Critic R1 P2 즉시 forward-fix 패턴**: P0/P1 0건 + P2 1건 자기 모순 검출 → 동일 PR 동일 일자 same-repo 가드로 차단. Sprint 164 Phase B blog Dockerfile fix 패턴 재현 + R2 에서 same-repo Dependabot 도 동일 권한 제약 발견 → 가드 확장 (point-fix 진화 사례)

## 교훈

- **본질 재설계는 단일 sprint 통합 가능 — 단 옵션 비교가 사용자 시각 1회로 수렴할 때**: Sprint 164 Phase A close 사유의 인접 원인(image registry 정책 그래프) 이 옵션 C 로 명확 수렴. AskUserQuestion 1회로 결정 → 분할 회귀 격리 효과보다 단일 sprint 통합 비용이 낮음
- **`outputs:` 와 `push:` 키 동시 사용 불가**: `docker/build-push-action@v7` 의 buildx multi-output 모드는 `push:`/`tags:` 키를 무시함. 정책 분기는 outputs 내부 `push=<expr>` + `name=<ref>` 로 통합. PR 본문/주석 에 명문화 필수
- **PR 단계 보안 게이트는 build artifact transfer 패턴이 표준 해법**: registry push 회피 (외부 PR 신뢰 경계) + storage 비용 zero + matrix 구조 보존. tarball + upload-artifact 가 ARM-only 단일 platform 환경에서 가장 보수적
- **Sprint 164 Critic R1 P1 자기 모순 검출의 가치 재확인**: Codex gpt-5 가 단순 1줄 변경의 image registry 정책 충돌을 본질 결함으로 검출 → Sprint 165 본질 재설계 유발. 단일 모델 가족 맹점 보완 패턴 확장
- **Trivy `--input` 은 registry 인증 불필요 — env 정리 의무**: `TRIVY_USERNAME`/`TRIVY_PASSWORD` 가 tarball scan 시 무의미한데 잔존 시 cleanup 부채. registry → tarball 전환 시 env 정리 체크리스트 정착
- **fork PR + same-repo Dependabot PR SARIF 업로드 권한 구조적 한계**: `security-events: write` 가 fork PR 뿐 아니라 same-repo Dependabot PR 에서도 차단됨 (GitHub Docs "Dependabot on GitHub Actions"). `head.repo.full_name == repository` 가드만으로는 불완전 → `pull_request.user.login != 'dependabot[bot]'` 결합 필요. R2 P2 검출이 R1 가드의 부분성을 노출 — Critic 2회전 누적 가치 재확인

## 이월 항목 (Sprint 166+)

- **Sprint 166 정기 정리 sprint 후보**:
  - tarball 크기 모니터링 자동화 (cache hit rate + artifact size GHA step summary 추가)
  - zstd 압축 forward-fix 비교 (옵션 D2 alternative)
- **Sprint 164 이월 시드 (계속)**:
  - 시드 #신규4/5/6/7 (CI 가시성): PR deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR / `$GITHUB_STEP_SUMMARY` 표준화 / envelope 확장
  - 시드 #30/#31 (Sprint 158): 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트
  - 시드 #24/#18: plan 템플릿 i18n 양면 의무 / 블로그 cross-check
  - 시드 #26/27/28 (Sprint 157): README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지
- **UAT 22 스프린트 누적**:
  - 시드 #5/#9 + Sprint 160~164 신규
  - Sprint 165 신규: PR Checks 탭 `Trivy Scan — {service}` matrix 시각 + Security 탭 SARIF code scanning alert
- **이월 유지**: 시드 #23 (plan 템플릿 rebase 카운트 fix)
- **후속 (선택)**: Sprint 162 R1 P3, Sprint 163 추가 (H3-only PR 표 추출 등), `.claude-tools/` Phase 2 실제 삭제, `(adr)` layout 분할, post-merge pre-deploy gate
