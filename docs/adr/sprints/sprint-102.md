---
sprint: 102
title: "CI 개선 — 운영 자동화 + Prepare 파일럿 (PR1)"
date: "2026-04-21"
status: completed
scope: "PR1만 (PR2/PR3는 Sprint 103 ADR에서 다룸)"
---

# Sprint 102 — CI 개선: 운영 자동화 + Prepare 파일럿 (PR1)

## 배경
채널톡 백엔드 CI 리팩토링 레퍼런스(36.6분 → 15분 38초) 분석 후 Sprint 102~105 4스프린트 로드맵을 수립했다. 원리 ⑤ "작은 서비스에서 먼저 검증 후 확장"을 스프린트 단위로 승격하여, 102는 파일럿·운영 자동화에 집중하고 103에서 전 서비스 확산한다.

이번 스프린트 개시 시점에 `.planning`에 누적된 문제는 두 가지였다:
1. **Dependabot 대기 PR 30건** — 주간 생성 PR이 수동 squash-merge 부담을 누적 중
2. **quality/audit/test 매트릭스 중복** — Node 서비스마다 `setup-node + cache + npm ci`가 3~4벌 반복

PR1은 (1)을 해결하고, PR2는 (2)를 해결하도록 설계했다. 본 ADR은 PR1 완료분만 기록한다. PR2/PR3는 Sprint 103에서 이어간다.

## 목표
1. Dependabot PR 운영 자동화 — 그룹화 + patch/minor 자동 병합
2. main 브랜치 보호 + 저장소 설정 강화로 자동 병합의 안전 경계 확립
3. 안전 3건 파일럿으로 auto-merge 경로 실증
4. 채널톡 원리 ⑤를 PR 단위에도 적용 — 30건 일괄이 아닌 3건 파일럿

## 작업 요약
| 커밋 | 담당 | 내용 |
|---|---|---|
| `46aeb73` (PR #102) | Architect + Scribe | Dependabot 그룹화 + patch/minor auto-merge 워크플로 신설 (Sprint 102-1) |
| `0d57816` (PR #104) | Dependabot + Auto-merge 워크플로 | `github-worker-minor-patch` 그룹 PR 자동 병합 (auto-merge 실증) |
| `f98ce25` (PR #103) | Scribe | Sprint 101 ADR status/교훈 확정 (잔재 정리) |

## 수정 내용

### 신규/변경 파일 (PR #102)
- `.github/dependabot.yml` — 8개 ecosystem에 `{service}-minor-patch` groups 블록 추가 (Docker 2건 제외)
- `.github/workflows/dependabot-automerge.yml` — 신규 생성
  - 트리거: `pull_request_target` (secrets 접근 필요, no-checkout 패턴으로 코드 인젝션 방어)
  - 조건 (AND): `github.actor == 'dependabot[bot]'` + `dependabot/fetch-metadata@v2` update-type이 patch/minor + `gh pr merge --auto` 예약
  - major는 명시적 `exit 0` 스킵
  - permissions: `contents: write`, `pull-requests: write` (최소 원칙)
- `.github/pull_request_template.md` — `## 변경 유형` 아래 Dependabot Auto-merge 조건 섹션 삽입

### 저장소 설정 변경 (Oracle 직접 gh API)
| 대상 | 설정 |
|------|------|
| `repos/tpals0409/AlgoSu` | `allow_auto_merge: true`, `delete_branch_on_merge: true` |
| `branches/main/protection` | `strict: true`, 필수 checks = `["Secret & Env Scan", "Detect Changed Services"]`, `allow_force_pushes: false`, `allow_deletions: false`, `required_conversation_resolution: true` |

### 잔재 정리 (PR #103)
- `docs/adr/sprints/sprint-101.md` — status `in-progress` → `completed`, 작업 요약 테이블에 실제 commit SHA 반영, 주요 교훈 섹션 추가

## 검증 결과
| 항목 | 결과 |
|---|---|
| PR #102 CI 전체 | ✅ 26 success / 10 skipped / 0 failure |
| PR #103 CI 전체 | ✅ 27 success / 9 skipped / 0 failure |
| Auto-merge 워크플로 실행 | ✅ 7/7 success (PR #104~#110) |
| **실제 자동 병합 실증** | ✅ **PR #104** (github-worker 3 updates) — `app/github-actions` merger 확인 |
| Dependabot 대기 PR | 30건 → 2건 (28건이 그룹 PR 7개로 재편, 1건 merge, 6건 auto-merge 예약) |
| Branch Protection 실효 | ✅ main 직접 push 차단, strict 모드에서 최신 base 요구 |

## 결정
- **Architect 주도 재매칭**: 초안은 Gatekeeper 중심이었으나 `.claude-team.json` 상 CI/CD는 Architect 본업. Gatekeeper(인증/API Gateway)는 영역 밖으로 판명. Oracle이 Sprint 102 전반을 Architect 주도로 재조정.
- **옵션 다 (안전 3건 파일럿)**: 30건 일괄 auto-merge 검증은 대량 merge 리스크·커밋 스팸·CI 분 소비 대비 이득이 낮음. 3건(#85 dev dep gateway patch · #80 dev dep github-worker patch · #65 dev dep frontend patch)만 rebase 트리거 후 나머지는 월요일 dependabot 스케줄에 위임. 실제로는 dependabot이 grouping을 감지하여 기존 PR 자동 close + 그룹 PR로 재생성하는 경로를 택했고, 이는 정상 동작.
- **pull_request_target + no-checkout 패턴 채택**: `pull_request`는 포크 PR에서 secrets 접근 불가. `pull_request_target`은 코드 인젝션 위험이 있으나 `actions/checkout` 제거로 PR 코드 실행을 zero로 만들고, job-level actor 검증 + step-level update-type 검증의 3중 방어로 상쇄.
- **Branch Protection 필수 체크 최소화**: 조건부 실행되는 Quality/Audit/Test/Build 잡은 skip 시 block되므로 필수에서 제외. 항상 실행되는 Secret Scan + Detect Changes만 지정.
- **enforce_admins=false 유지**: Oracle 긴급 수정 경로 보존. 단 이번 스프린트 내에서는 admin merge 우회 사용하지 않음.
- **PR2/PR3 이월**: 컨텍스트 관리 + 각 PR의 독립 가치 보존을 위해 Sprint 103으로 이어감.

## 주요 교훈
- **에이전트 본업 매칭 선행 확인 필요**: 플랜 단계에서 "CI는 Gatekeeper" 같은 추정 매칭은 `.claude-team.json` 실제 본업과 어긋날 수 있음. Oracle은 디스패치 전 본업 재검증.
- **Auto-merge는 Repo 설정 + Branch Protection의 합산**: 워크플로만 만들면 반쪽. `allow_auto_merge=true` + 필수 status checks가 함께 있어야 실효. 이번에 두 설정 누락 상태로 PR 진행하다 Oracle 직접 조정.
- **Dependabot grouping은 기존 PR을 자동 재편**: 안전 3건 `@dependabot rebase`가 실제로는 "기존 개별 PR close + 그룹 PR 재생성" 경로를 타서 30건이 7건 그룹 PR로 축소. 예상 이상의 정리 효과.
- **strict=true + 다중 PR 경쟁**: 그룹 PR이 연속 merge되면서 다른 PR이 `BEHIND` 반복. `update-branch` 후 즉시 merge 시도하거나 `--auto` 예약이 필수.
- **Oracle 파이프라인 `__AGENT_DONE__` 마커 누락**: runner의 `claude -p | tee` 파이프라인이 마커 echo를 실행하지 않아 수동 개입 2회 필요. Backlog 등록 ([issue-oracle-pipeline-agent-done-marker.md](../../../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/issue-oracle-pipeline-agent-done-marker.md)).

## 이월 (Sprint 103)
- **PR2**: Composite action 신설 + github-worker 파일럿 (Architect 주도, 전후 소요 측정 포함)
- **PR3**: Coverage artifact 병합 + PR 임계치 60% 강제 (Scribe 주도)
- **Oracle 파이프라인 버그 수정**: `__AGENT_DONE__` 마커 미기록 → `oracle-spawn.sh` runner 수정 (Sprint 103~105 어느 시점 또는 별도 긴급 스프린트)

## 레퍼런스
- 채널톡 백엔드 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- 4스프린트 로드맵: [project-ci-refactoring-roadmap.md](../../../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-ci-refactoring-roadmap.md)
