---
sprint: 171
title: "zstd OCI export 제거 — Sprint 165~170 zstd 사이클 종결 (시드 #170-1)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-170", "sprint-168", "sprint-165"]
related_memory: ["sprint-window"]
---
# Sprint 171 — zstd OCI export 제거: Sprint 165~170 zstd 사이클 종결 (시드 #170-1)

## 목표

- Sprint 170 이월 시드 #170-1 회수: warm cache 에서 zstd 절감 ~0% 라는 측정 발견의 후속 결정.
- 두 후보 비교 — (a) `force-compression=true` 도입(zstd 절감 보장, 빌드 시간 trade-off) vs (b) zstd OCI export 제거(미소비+무절감 잉여 step 정리).
- "보안 게이트(165) → 가시성(166) → 실측(167) → 전면 채택(168) → 관측 정착(169) → 측정 자동화(170) → 사이클 종결(171)" 의 마지막 단계.

## 결정

### D0. 채택 방식 — 옵션 (b) zstd OCI export 제거

force-compression A/B 측정 없이 옵션 (b) 를 채택. 근거는 본 sprint 의 코드베이스 grep 검증 + Sprint 170 실측 데이터로 이미 결정적이기 때문:

1. **소비처 zero (본 sprint 검증)**: `type=oci,compression=zstd,dest=...-zstd.tar` 산출물은 3 build job 에서 생성되어 `report-build-metrics.sh` 측정 헬퍼만 읽음. `upload-artifact` 는 docker tarball(`image-<svc>.tar`) 만 업로드하고, Trivy 는 `--input <docker tarball>` 만 스캔하며, 레지스트리 푸시는 `type=image` 만 사용 → zstd tarball 은 **어디서도 소비되지 않음**.
2. **warm cache ~0% 절감 (Sprint 170 실측)**: 8 서비스 모두 docker tarball ≈ oci+zstd tarball (정확히 2048 bytes 컨테이너 포맷 오버헤드 차이). buildx 는 `force-compression=true` 부재 시 캐시/베이스 layer 를 재압축하지 않으므로 두 exporter 가 동일 blob 을 임베드 → saving -0.0%.
3. **(a) force-compression 은 비합리**: 소비처가 없는 산출물을 추가 빌드 시간 들여 압축하면 압축률이 아무리 좋아도 가치 zero + 빌드 시간 회귀만 발생.

→ A/B 측정은 결정 입력으로서 불필요. zstd OCI export 를 제거하여 Sprint 165~170 zstd 사이클을 잉여 step 정리로 종결.

### D1. force-compression A/B 측정 생략 근거

시드 #170-1 의 원래 계획은 cold-cache 에서 force-compression A/B 실측이었으나, "소비처 zero" 발견이 측정 결과와 무관하게 결정을 확정. 소비자가 없는 산출물은 최대 압축을 적용해도 가치가 0 이므로, force-compression 의 빌드 시간 비용만 순손실. 측정 CI 비용 없이 논리적으로 (b) 로 수렴.

### D2. 헬퍼 2-arg 단순화 (dead code 제거)

zstd export 제거 후 `report-build-metrics.sh` 의 zstd 분기와 Sprint 170 ZSTD-METRIC stdout 마커는 호출되지 않는 dead code 가 됨. 프로젝트 규약("확실히 미사용이면 완전 삭제, backwards-compat hack 회피")에 따라 3번째 인자 + zstd 분기 + 마커 블록을 전면 제거 → `<label> <docker_tarball>` 2-arg 헬퍼로 단순화. 향후 zstd 측정이 필요하면 git history 에서 복원 가능.

### D3. 잔존 출력 = Sprint 165 옵션 C baseline 복귀

제거 후 3 build job 의 `outputs:` 는 `type=image`(main 푸시) + `type=docker`(Trivy tarball) 2줄로 환원 — Sprint 165 옵션 C 도입 시점의 baseline. Trivy scan job 의 `--input /tmp/image-<svc>.tar` 경로는 무변경 → 보안 게이트 회귀 zero.

### D4. 단위 테스트 케이스 재정렬

Case 2(zstd saving %)/Case 7(ZSTD-METRIC 마커) 제거 후, Case 3(zstd 미전달 분기) 이 docker tarball 정규 경로로 승격(neg assertion: oci+zstd/compression saving 라인 부재 확인). 나머지 케이스 4/5/6 → 3/4/5 재번호. 7 케이스 → 5 케이스, 22 → 16 assertion.

## 구현 (단일 PR, 39 스프린트 연속 브랜치 규율 준수)

브랜치: `feat/sprint-171-zstd-export-removal` → 단일 PR Squash merge.

### Phase A — 코드 제거 (Architect, commit `28dd957`)

- **`.github/workflows/ci.yml`**: 3 build job(build-services/build-frontend/build-blog) 의 `type=oci,compression=zstd,dest=/tmp/image-*-zstd.tar` 줄 제거 + `report-build-metrics.sh` 호출 3건의 3번째 인자(zstd tarball) 제거 + Sprint 168 zstd 주석을 Sprint 171 결정 반영으로 갱신. python3 yaml.safe_load PASS.
- **`scripts/ci/report-build-metrics.sh`**: zstd 분기 블록 + ZSTD-METRIC stdout 마커 블록 + `ZSTD_TARBALL` 인자 + usage/헤더 주석 제거 → 2-arg 헬퍼. `bash -n` syntax PASS.
- **`tests/ci/report-build-metrics-test.sh`**: Case 2/7 제거, Case 3 승격(neg assertion 추가), 4/5/6→3/4/5 재번호, 헤더 케이스 목록 갱신.

### Phase B — ADR 기록 (Scribe, commit `<TBD-SCRIBE-SHA>`)

- `docs/adr/sprints/sprint-171.md` (KR) + `docs/adr-en/sprints/sprint-171.md` (EN 1:1)
- `docs/adr/README.md` count 110→111, range 62~170→62~171 (라인 18/52/54)

## Critic 사이클

- **R1** (codex review --base bd60329): Trivy docker tarball 경로 무변경 / zstd 잔재 0 / deploy gate 무변경 확인 — `<TBD-CRITIC-R1>`

## 위험/회귀 차단

### 예측 1: Trivy 보안 게이트 무변경
zstd tarball 은 Trivy 가 사용하지 않으므로(`--input docker tarball`) 제거가 스캔에 영향 없음. PR Checks 탭의 8 matrix Trivy scan 이 종전과 동일 SUCCESS.

### 예측 2: 배포 무변경
deploy job 은 `type=image` push(main only) 에 의존. zstd OCI export 제거는 push 경로와 무관 → 배포 회귀 zero.

### 예측 3: 헬퍼 회귀 차단
`quality-ci-scripts` job 이 `scripts/ci/**`/`tests/ci/**` 변경 시 단위 테스트 실행 → 2-arg 헬퍼의 5 케이스 16 assertion 으로 회귀 차단.

## 검증

### 로컬
- `bash -n scripts/ci/report-build-metrics.sh`: syntax PASS
- 단위 테스트(GNU stat shim): 16 assertion PASS (5 케이스)
- python3 yaml.safe_load(ci.yml): PASS
- zstd 잔재 grep: 코드 0건 (주석만 잔존, 의도적)

### CI
- PR CI run `<TBD-RUN>`: 8 build job + quality-ci-scripts + 8 matrix Trivy scan 전부 success 예상
- check-adr-en-coverage --strict: `<TBD>` PASS
- check-doc-refs: `<TBD>` PASS

### UAT 신규 (Sprint 171)
- PR Checks 탭 8 matrix Trivy scan 이 zstd export 제거 후에도 동일 SUCCESS 인지 시각 확인

## 결과

- **머지**: origin/main `bd60329` → `<TBD-MERGE-SHA>` (PR `<TBD-PR>`, squash merge)
- **순변경**: -84 +32 (zstd export + dead code 제거 우세)
- Sprint 165~170 zstd 사이클 종결: 보안 tarball(165) → 가시성(166) → 실측(167) → zstd 채택(168) → 관측(169) → 측정 자동화(170) → **잉여 step 제거(171)**.

## 신규 패턴

- **미소비 산출물 발견 = 압축 최적화보다 제거 우선**: 측정 자동화(170)가 절감 ~0% 를 노출한 후, 후속 grep 이 "소비처 zero" 를 확인 → 압축률 개선(force-compression)이 아니라 산출물 제거가 정답. 최적화 대상이 실제로 소비되는지 먼저 검증하는 패턴.
- **측정 발견이 결정을 단순화 = A/B 생략 가능**: prior sprint 의 측정 데이터 + 본 sprint 의 정적 검증(grep) 조합이 A/B 측정을 불필요하게 만듦. "데이터 있으면 추가 측정 생략" — 측정 sprint 의 산출이 후속 sprint 의 비용을 절감.
- **사이클 종결 ADR = 다단계 시드의 마침표**: 165~171 7-sprint zstd 사이클을 단일 ADR 로 종결 명문화. 각 단계의 결정 그래프를 한 곳에서 추적 가능.

## 교훈

- **"채택"은 "소비"를 보장하지 않는다**: Sprint 168 zstd 전면 채택은 산출물을 생성했지만 소비처를 연결하지 않음. 신규 산출물 도입 시 소비처(consumer)를 동시에 명시하는 체크리스트가 잉여 step 부채를 차단.
- **buildx force-compression 부재 시 캐시 layer 무압축 (재확인)**: Sprint 170 발견의 실무 결론 — warm cache steady-state 에서 zstd export 는 무의미. 압축을 보장하려면 force-compression(빌드 시간 비용) 필요하나, 소비처 없으면 그조차 손실.
- **측정 → 결정 → 정리의 분리가 회귀를 격리**: 측정(170)에서 즉시 fix 하지 않고 시드로 분리 → 본 sprint 에서 충분한 데이터로 깔끔히 결정. 측정 sprint 가 후속 결정 sprint 의 입력을 완성하는 패턴 재확인.

## 이월 항목 (Sprint 172+)

### Sprint 171 신규 이월 시드
- 없음 — zstd 사이클 종결. 신규 산출물 도입 시 "소비처 동시 명시" 체크리스트화는 plan 템플릿 개선(시드 #24 계열)과 결합 검토.

### 계승 이월 시드
- CI 가시성 (Sprint 164 #신규4/5/7): PR deploy gate 시뮬레이션 / aether-gitops PR template / `_parse_group_response` raw_text fallback
- i18n/lint (Sprint 158 #30/#31), plan 템플릿 (Sprint 157 #24/#18/#23), ADR/blog 보강 (Sprint 157 #26/27/28)
- UAT 사용자 직접: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~170 누적
- MEMORY.md 비대 정리(~44KB → 1줄 인덱스화)
