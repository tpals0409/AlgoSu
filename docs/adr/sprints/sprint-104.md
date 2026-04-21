---
sprint: 104
title: "CI 개선 — 확산 + AI Coverage 통합 + 측정"
date: "2026-04-21"
status: completed
scope: "PR #113 (composite 확산 + AI coverage) + Oracle runner 로컬 수정 + 측정 시도"
end_commit: 00650bf
---

# Sprint 104 — CI 개선: 확산 + AI Coverage 통합 + 측정

## 배경
Sprint 103 "파일럿 후 확산" 결정의 연장선상에서, github-worker에만 적용됐던 `setup-node-service` composite action을 전 Node 서비스로 확장하고, ai-analysis(FastAPI/pytest)를 글로벌 coverage-gate에 통합하는 것이 이번 스프린트의 핵심 과제였다. 동시에 Sprint 102부터 이월된 Oracle `__AGENT_DONE__` 마커 버그도 Oracle 자가 수정으로 해결해, 에이전트 체인 자동화 신뢰성을 회복했다.

채널톡 CI 리팩토링 레퍼런스의 원리 ⑤(작은 서비스에서 먼저 검증 후 확장)의 확산 단계를 마무리하는 스프린트이기도 하다.

## 목표
1. `setup-node-service` composite action을 전 Node 서비스로 확산 (quality-nestjs / audit-npm / test-node 매트릭스 통합)
2. ai-analysis(Python/pytest) coverage를 글로벌 coverage-gate에 통합
3. Oracle 에이전트 체인의 `__AGENT_DONE__` 마커 누락 버그 수정으로 자동화 신뢰성 회복
4. Sprint 103 파일럿 실측 데이터 확보 (github-worker 전후 소요 시간 비교)

## 작업 요약

| 작업 | 담당 | 산출물 |
|---|---|---|
| composite action 전 서비스 확산 | Architect | PR #113 (`00650bf`) |
| ai-analysis coverage-gate 통합 | Architect | PR #113 (`00650bf`) |
| Oracle runner trap 수정 | Oracle (직접) | `~/.claude/oracle/bin/oracle-spawn.sh` |
| github-worker 소요 시간 측정 | Sensei | ✅ Sprint 105 소급 완료 | `sensei-sprint-105-timing.md` |
| ADR 반영 | Scribe | 본 문서 + sprint-103.md 소급 |

## 수정 내용

### 1. Composite action 확산 (ci.yml)
- quality-nestjs / audit-npm / test-node 3개 잡에서 `matrix.service != 'github-worker'` 조건 제거
- inline 3스텝(Setup Node + Cache + Install) × 3잡 = **67줄 삭제**
- 전 Node 서비스(gateway, identity, submission, problem, github-worker)가 composite 경유
- audit-npm은 `install-command: 'npm ci --ignore-scripts'` 유지 (보안 스캔 정책)

### 2. AI coverage-gate 통합 (ci.yml)
- `test-ai-analysis`: pytest에 `--cov-report=lcov:coverage/lcov.info` 추가
- artifact 경로 multi-line으로 확장 (xml + lcov)
- `coverage-gate` needs에 `test-ai-analysis` 추가, if 조건 확장
- `scripts/check-coverage.mjs`는 무수정 (재귀 탐색이 ai-analysis 자동 인식)

### 3. Oracle runner `__AGENT_DONE__` 마커 (로컬 인프라)
- `~/.claude/oracle/bin/oracle-spawn.sh:127-149` runner heredoc 재구성
- `set -euo pipefail` → `set -uo pipefail` (errexit 제거)
- `cleanup()` 함수 + `trap cleanup EXIT`: 마커 echo + lock 제거 + reap + dispatch를 어떤 종료 경로에서도 보장
- tee 파이프 SIGPIPE / 빈 출력 / tmux detached 4개 실패 모드 모두 커버
- 참고 메모리: `memory/issue-oracle-pipeline-agent-done-marker.md`

### 4. 측정 시도 (Sensei)
Sensei가 `gh run list` + jobs API로 Pre/Post 표본 수집을 시도. Pre 4건 평균(Quality 22.2s / Audit 19.8s / Test 19.2s) 확보에 성공했으나, PR #111/#113 둘 다 워크플로 파일만 수정되어 `detect-changes`가 github-worker를 스킵 → **Post 표본 0건**. composite action이 실제 설치·테스트 경로에서 실행된 런이 아직 관측되지 않음. 전문 보고서: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`

**Sprint 105 [B] 소급 실측 결과** (task-20260421-sp105-b3-finalize):

| 잡 | 변경 전 평균 (n=4) | 변경 후 평균 (n=3)² | 차이 | 실용 판정 |
|---|---|---|---|---|
| Quality — github-worker | 22.2s (σ 5.8s) | 22.3s (σ 2.5s) | +0.1s (+0.4%) | ✅ 변동 없음 |
| Audit — github-worker | 19.8s (σ 3.7s) | 18.0s (σ 3.0s) | -1.8s (-8.9%) | ✅ 변동 없음 |
| Test GitHub Worker | 19.2s (σ 1.9s) | 20.0s (σ 1.0s) | +0.8s (+3.9%) | ✅ 변동 없음 |

² Post n=3: 자연 2건(run 24702740418·24702828670) + 합성 1건(run 24703075569 rebuild_all). 상세: `~/.claude/oracle/inbox/sensei-sprint-105-timing.md`

## 주요 교훈 (4건)

### 1. CI 인프라 PR은 `detect-changes` skip으로 자기 자신의 실측 데이터를 생성하지 못한다
PR #111(Sprint 103)과 PR #113(Sprint 104) 모두 `.github/workflows/ci.yml`만 수정. `detect-changes`가 `services/github-worker/**` 변경을 감지하지 않아 matrix 전 skip. **대응**: composite/pipeline 변경 PR에는 `workflow_dispatch(rebuild_all=true)` 1회 병행 또는 더미 touch 커밋을 표준 프로세스화. Sprint 105 이월.

### 2. "파일럿 후 확산" 결정은 코드 중복 제거만으로도 정당화된다
67줄 삭제(25% 압축)로 유지보수성 확보. 성능 실측은 후행 검증이지 확산 결정 근거가 아님. Sprint 103 원 계획("PR 머지 후 2회차부터 측정")이 비동기 구조였음을 재확인.

### 3. `trap EXIT`은 shell runner의 4개 실패 모드를 한 번에 커버한다
`set -e` + `tee` 파이프라인은 정상 종료/claude 실패/SIGPIPE/signal 수신 중 하나만 빠져도 후속 cleanup이 실행되지 않음. `trap EXIT`은 **exit 경로 전체**를 가로채므로 단일 가드로 4개 케이스 모두 처리. 다른 dispatch 시스템 설계 시 차용 가능.

### 4. AI coverage 통합은 스크립트 무수정이 최선이다
`scripts/check-coverage.mjs`는 재귀 탐색 구조로 이미 확장 가능성을 내포. pytest에 lcov 리포터만 추가하면 자동 인식. 파이썬/노드 coverage를 한 스크립트로 다루는 단순함을 유지. Sprint 103 교훈 "인프라 PR은 artifact 0개 시나리오 테스트"가 이번에도 적용 가능.

## 이월 (Sprint 105)
- github-worker 실측 완료 — **재측정 트리거**: 다음 github-worker 실질 변경 PR 5건 확보 시
- `workflow_dispatch(rebuild_all=true)` 가드레일 도입 (Sensei 권고, Sprint 104 교훈 1 대응)
- L2 캐시 레이어 (build output) — 범위 정의 필요
- Frontend 빌드 최적화 — 범위 정의 필요
- 글로벌 coverage threshold 70% 상향 검토 — 실측 데이터 확보 후
- commitlint scope-enum 관리 자동화 (pre-commit hook 검토)

## 레퍼런스
- Sprint 103 ADR: `docs/adr/sprints/sprint-103.md`
- PR #113: composite 확산 + AI coverage (`00650bf`)
- 채널톡 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sensei 측정 보고서: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`
- Oracle 이슈 메모리: `~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/issue-oracle-pipeline-agent-done-marker.md`
