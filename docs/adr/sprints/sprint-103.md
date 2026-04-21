---
sprint: 103
title: "CI 개선 — Prepare 파일럿 + Coverage 강제 (Sprint 102 이어가기)"
date: "2026-04-21"
status: completed
scope: "PR #111 (PR2+PR3 통합 squash merge)"
end_commit: 5fd8483
---

# Sprint 103 — CI 개선: Prepare 파일럿 + Coverage 강제

## 배경
Sprint 102는 Dependabot 운영 자동화(PR #102 + #104)와 잔재 정리(PR #103)만 완료하고, Composite action 파일럿(PR2)과 Coverage 강제(PR3)를 Sprint 103으로 이월했다. 이번 스프린트는 그 이월분을 완주하는 것이 목표다.

채널톡 CI 리팩토링 레퍼런스에서 차용한 원리:
- ① 공통 prepare 분리 — 매트릭스 노드마다 반복되던 준비 비용을 한 번만 수행
- ② 입력 해시 기반 단계별 캐시 — 의존성 lockfile 해시로 캐시 키 결정
- ⑤ 작은 서비스에서 먼저 검증 후 확장 — github-worker 파일럿 → Sprint 104 전 서비스 확산

## 목표
1. `setup-node + cache + npm ci` 반복 패턴을 Composite Action으로 추출, github-worker에서만 파일럿
2. Coverage artifact를 병합하고 글로벌 60% 임계치로 PR 머지를 차단
3. PR 코멘트로 서비스별 coverage 가시화

## 작업 요약
| 커밋 (squash 전) | 담당 | 내용 |
|---|---|---|
| `1cef57d` | Architect | Composite action setup-node-service 신설 + github-worker 파일럿 (Sprint 103-1) |
| `4f72c69` | Architect | coverage-gate 잡 신설 + 60% 글로벌 임계치 강제 (Sprint 103-1) |
| `3fc6078` | Scribe | Sprint 103 ADR 초안 |
| `1a7aede` | Scribe | Sprint 102 ADR 누락분 정리 |
| `ec4d96b` | Architect | coverage-gate 견고화 — 빈 artifact 허용 + PR 코멘트 가드 |

**Squash 결과**: `5fd8483` (PR #111, main 머지)

## 수정 내용

### PR2 — Composite Action 파일럿

**신규 파일:**
- `.github/actions/setup-node-service/action.yml` (+43줄)
  - 3개 inputs: `service-path` (필수), `node-version` (기본 20), `install-command` (기본 npm ci)
  - Steps: setup-node@v6 → actions/cache@v5 (lockfile 해시 키) → 조건부 install

**수정 파일:**
- `.github/workflows/ci.yml` (+46줄, -9줄)
  - `quality-nestjs`: github-worker → composite 호출, 나머지 서비스 → 기존 inline 유지 (`matrix.service != 'github-worker'` 조건)
  - `audit-npm`: 동일 패턴 + `install-command: 'npm ci --ignore-scripts'` 전달
  - `test-node`: 동일 패턴, 기본 npm ci

### PR3 — Coverage Gate

**신규 파일:**
- `scripts/check-coverage.mjs` (+112줄)
  - lcov.info 재귀 탐색 + 서비스별 lines/branches 파싱
  - Markdown 테이블 출력 (GITHUB_STEP_SUMMARY + GITHUB_OUTPUT)
  - 임계치 미달 시 exit 1
  - ESLint no-console 준수 (process.stdout.write/process.stderr.write 사용)

**수정 파일:**
- `.github/workflows/ci.yml` (+40줄)
  - `coverage-gate` 잡 신설 (test-node, test-frontend 완료 후)
  - `download-artifact@v4` pattern: coverage-* (ai-analysis의 cobertura XML은 lcov.info 미존재로 자동 제외)
  - sparse-checkout으로 스크립트만 체크아웃 (비용 최소화)
  - `marocchino/sticky-pull-request-comment@v2`로 PR 코멘트
  - build-services.needs에 미포함 (빌드 차단 없음, Branch Protection만)

## 결정

### D1: 파일럿을 github-worker로 한정
github-worker는 5개 Node 서비스 중 가장 단순한 구조(순수 Node.js, NestJS 미사용). 패턴 변경의 부작용을 최소 범위에서 검증한 후, Sprint 104에서 나머지 4개 NestJS 서비스 + frontend로 확산한다. 채널톡 원리 ⑤ "작은 서비스에서 먼저 검증 후 확장"의 스프린트 단위 적용.

### D2: Composite action에 checkout 미포함
checkout은 각 잡의 공통 첫 스텝이며 서비스 경로와 무관하게 항상 동일 (전체 repo checkout). Composite은 setup-node + cache + install의 "서비스별 분기점"만 추출. 이 결정으로 composite의 범용성이 높아진다 (checkout 방식을 잡 레벨에서 자유롭게 변경 가능, 예: sparse-checkout).

### D3: 글로벌 60% vs 서비스별 높은 threshold 이중 구조
개별 서비스의 Jest coverageThreshold(92~100%)는 "기존 코드 품질 유지"용. 글로벌 60%는 "새 서비스 추가 시 바닥 방어"용. 두 레이어의 역할이 다르므로 공존. Sprint 104에서 글로벌을 70%로 상향하는 승격 경로 열어둠.

### D4: ai-analysis를 글로벌 게이트에서 제외
ai-analysis(FastAPI)는 pytest --cov-report=xml (cobertura 형식)만 생성하며 lcov.info를 미생성. cobertura→lcov 변환 도구 추가는 복잡도 대비 이득이 낮음. Sprint 104에서 ai-analysis 전용 pytest threshold를 별도 게이트로 추가하거나, lcov 리포터를 pytest에 추가하는 방안 검토.

### D5: coverage-gate를 build-services.needs에 미포함
coverage 검증은 "PR 머지 차단"이 목적이지 "빌드 차단"이 아님. build-services가 coverage-gate를 기다리면 CI 전체 소요 시간이 불필요하게 증가. Branch Protection required check에 coverage-gate를 등록하여 머지 시점에만 차단.

### D6: lcov-result-merger 대신 커스텀 스크립트
lcov-result-merger는 npm 패키지로 supply chain 리스크가 존재. 각 서비스의 lcov.info를 "파일별 병합"할 필요 없이, LH/LF/BRH/BRF 합산으로 글로벌 비율만 계산하면 충분. 40줄 이내(실제 112줄, 주석/JSDoc 포함) 커스텀 스크립트로 외부 의존성 제로 달성.

## 검증 결과
| 항목 | 결과 |
|---|---|
| Composite action 문법 | ✅ action.yml 구조 정상 (using: composite, inputs 3개, steps 3개) |
| ci.yml 분기 조건 | ✅ github-worker만 composite, 나머지 기존 inline 유지 |
| coverage-gate 잡 구조 | ✅ needs/if/permissions/steps 정상 |
| check-coverage.mjs 로직 | ✅ lcov 파싱, 임계치 검증, Markdown 출력 |
| ESLint no-console | ✅ process.stdout.write/process.stderr.write 사용 |
| 파일 헤더 어노테이션 | ✅ @file, @domain, @layer, @related |
| CI 실환경 검증 | ✅ PR #111 CI 2회차 전체 통과 (27 pass / 8 skip, Coverage Gate 포함) |
| Branch Protection 등록 | ✅ Oracle gh API로 `Coverage Gate` required check 추가 완료 |
| Commitlint scope | ✅ filter-branch + force-push로 `ci(actions)`→`ci(github-worker)`, `ci(coverage)`→`ci(ci)` 복구 |

## github-worker 전후 소요 시간 비교

### CI 소요 시간 비교 — github-worker (Sprint 103 파일럿)

| 잡 | 변경 전 평균 (n=4) | 변경 후 평균 | 차이 | 비고 |
|---|---|---|---|---|
| Quality — github-worker | 22.2s (σ 5.8s) | 측정 불가¹ | — | n=4 (PR 런 기준) |
| Audit — github-worker | 19.8s (σ 3.7s) | 측정 불가¹ | — | n=4 |
| Test GitHub Worker | 19.2s (σ 1.9s) | 측정 불가¹ | — | n=4 |

¹ PR #111/#113 둘 다 `.github/workflows/ci.yml`만 수정되어 `detect-changes`가 github-worker 경로 변경을 감지하지 않았고, 결과적으로 composite action이 실제 설치·테스트 경로에서 실행된 런이 아직 관측되지 않음. **Sprint 104 이후 첫 github-worker 의존성 bump PR 또는 소스 변경 PR 머지 시 재측정 필요**(Sensei 후속 작업 티켓).

**표본 출처** (Pre 기준):
- `a45878e` (PR #90, feat/gateway-programmers-dataset, 2026-04-20) (run 24646611483)
- `4b72ac2` (dependabot @types/node, 2026-04-20) (run 24646785496)
- `6ec1c46` (dependabot ts-jest, 2026-04-21 00:56 UTC) (run 24698331881)
- `6fdc408` (dependabot minor-patch group #104, 2026-04-21 01:07 UTC) (run 24698653487)

**교훈**: 파일럿/확장 PR이 워크플로 파일만 수정할 경우 자기 자신의 실측 데이터가 생성되지 않는다. 차후 composite 변경 PR에는 `rebuild_all=true` workflow_dispatch 또는 더미 touch 커밋을 병행해 최소 1회 실측을 확보하는 프로세스를 표준화 권고.

## 주요 교훈

### 1. Commitlint scope-enum 위반은 PR 단계에서 뒤늦게 발견된다
`ci(actions)`/`ci(coverage)`는 직관적으로 보이지만 `commitlint.config.mjs` scope-enum에 없어 Lint Commit Messages 잡이 실패했다. 로컬 pre-commit 훅이 없으면 scope 오류는 PR CI에서만 잡힌다. **대응**: 커밋 메시지 작성 시 `commitlint.config.mjs` scope-enum 먼저 확인하는 루틴. Sprint 102에서 `ci(deps)`가 사용되었는데 Sprint 103에서 `ci(actions)`를 쓴 이유는 "actions 디렉토리"라는 물리적 이름에 끌린 오판. 앞으로 **기능 도메인**(`github-worker`/`ci`/`infra`) 기준으로 scope 선택.

### 2. 인프라 전용 PR에서 coverage-gate는 artifact 0개 시나리오를 반드시 처리해야 한다
이 PR은 `.github/workflows/ci.yml` + `scripts/` + `docs/` 만 수정했고 서비스 코드 불변 → detect-changes 모든 서비스 false → test-node matrix 전원 skip → coverage-* artifact 0건 업로드 → `download-artifact@v4`가 `coverage/` 디렉토리를 생성하지 않음 → `readdirSync` ENOENT 에러 → 연쇄로 PR 코멘트 스텝의 빈 message 에러. **대응**: 스크립트에 `existsSync` 가드 + PR 코멘트 스텝에 `coverage-body != ''` 조건 가드를 추가. "검증 환경(인프라 PR)이 실제 동작 환경(서비스 PR)과 다를 수 있음"을 항상 가정.

### 3. Scribe는 코드 작성 금지 — Architect가 CI 전담
Sprint 103 초기 플랜은 PR3를 Scribe에 배정했으나 `_base.md` 프로토콜상 Scribe는 "문서/메모리/Skill만 담당, 코드 작성 금지". Oracle이 디스패치 전 본업 재검증하여 PR2/PR3 모두 Architect 단독으로 재배정. **교훈**: Sprint 102의 "에이전트 본업 매칭 재검증" 교훈이 103에서도 재발 — 매 스프린트 시작 시 체크리스트화가 필요.

### 4. filter-branch + force-push는 feature 브랜치에서 안전한 복구 경로
커밋 메시지 오류 수정을 위해 `git rebase -i` 없이 `git filter-branch --msg-filter` + `git push --force-with-lease`로 비대화식 복구. `main` 미관여 feature 브랜치 + `--force-with-lease`로 안전성 확보. PR 본문/코멘트는 유지되고 커밋만 재작성.

### 5. Coverage Gate를 build-services.needs에 미포함한 결정이 유효함을 PR #111에서 검증
coverage-gate는 build-services와 병렬로 실행되어 전체 CI 소요 시간에 영향 없음. Branch Protection required check로만 PR 머지를 차단하므로 빌드 파이프라인은 지연 없이 진행. Sprint 104 확산 시에도 이 구조 유지.

### 6. github-worker 전후 소요 시간 측정 미수행 — Sprint 104로 이월
플랜상 "PR 머지 후 2회차부터 5회 샘플" 측정 예정이었으나 이번 스프린트 종료 시점까지 main 기준 실행이 1회뿐이라 의미 있는 비교 불가. Sprint 104 초반에 `gh run list` 5회 샘플 수집 후 본 ADR의 비교표를 소급 채움.

**상태 업데이트 (Sprint 104 시도 결과)**: Sprint 104에서 Sensei가 소급 측정을 시도했으나, PR #111/#113 둘 다 `.github/workflows/ci.yml`만 수정되어 `detect-changes`가 github-worker를 스킵 → **Post 표본 0건 확보 실패**. Pre 4건 평균만 소급 반영하고 Post는 "측정 불가¹" 각주 처리. 실측 완료는 Sprint 105로 재이월(다음 github-worker 실질 변경 PR 머지 시 트리거).

## 이월 (Sprint 104)
- 전 Node 서비스 composite action 확산 (matrix.service != 'github-worker' 조건 제거) — **우선**
- ai-analysis coverage lcov 통합 (pytest-cov --cov-report=lcov) — **우선**
- github-worker 전후 소요 시간 5회 샘플 측정 + 본 ADR 비교표 소급 채움 — **우선**
- Oracle `__AGENT_DONE__` 마커 버그 수정 (oracle-spawn.sh)
- L2 캐시 레이어 (build output 캐시) — 범위 정의 필요
- Frontend 빌드 최적화 — 범위 정의 필요
- 글로벌 coverage threshold 70% 상향 검토 — 실측 데이터 기반 결정

## 레퍼런스
- 채널톡 백엔드 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sprint 102 ADR: docs/adr/sprints/sprint-102.md
- CI 리팩토링 4스프린트 로드맵: ~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-ci-refactoring-roadmap.md
