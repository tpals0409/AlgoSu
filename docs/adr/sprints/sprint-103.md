---
sprint: 103
title: "CI 개선 — Prepare 파일럿 + Coverage 강제 (Sprint 102 이어가기)"
date: "2026-04-21"
status: in-progress
scope: "PR2+PR3 통합 (ci/composite-action-pilot 브랜치)"
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
| 커밋 | 담당 | 내용 |
|---|---|---|
| `14f71c1` | Architect | Composite action setup-node-service 신설 + github-worker 파일럿 (Sprint 103-1) |
| `50fb35e` | Architect | coverage-gate 잡 신설 + 60% 글로벌 임계치 강제 (Sprint 103-1) |

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
| CI 실환경 검증 | ⏳ PR 푸시 후 확인 필요 |
| Branch Protection 등록 | ⏳ Oracle gh API 호출 필요 |

## github-worker 전후 소요 시간 비교
> ⏳ PR 머지 후 2회차부터 측정 예정. 캐시 적중 상태에서 5회 샘플 수집.

| 잡 | 변경 전 평균 | 변경 후 평균 | 차이 |
|---|---|---|---|
| quality-nestjs (github-worker) | TBD | TBD | TBD |
| audit-npm (github-worker) | TBD | TBD | TBD |
| test-node (github-worker) | TBD | TBD | TBD |

## 주요 교훈
> 스프린트 종료(`/stop`) 시 채움.

## 이월 (Sprint 104)
- 전 Node 서비스 composite action 확산 (matrix.service != 'github-worker' 조건 제거)
- L2 캐시 레이어 (build output 캐시)
- Frontend 빌드 최적화
- ai-analysis coverage 통합 (lcov 리포터 또는 별도 게이트)
- 글로벌 coverage threshold 70% 상향 검토
- (선택) Oracle `__AGENT_DONE__` 마커 버그 수정

## 레퍼런스
- 채널톡 백엔드 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sprint 102 ADR: docs/adr/sprints/sprint-102.md
- CI 리팩토링 4스프린트 로드맵: ~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-ci-refactoring-roadmap.md
