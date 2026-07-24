---
sprint: 261
title: "피드백 → GitHub 이슈 자동 동기화 + 마이그레이션 타임스탬프 CI 가드"
date: "2026-07-24"
status: completed
agents: [Oracle]
related_adrs: ["ADR-031", "sprint-260"]
related_memory: ["sprint-window"]
topics: ["identity", "feedback", "github", "migration", "ci", "typeorm"]
tldr: "두 건의 운영 개선을 Sprint 261로 마감. (1) #497 — identity 피드백 저장 시 전체 맥락을 담아 중앙 레포에 GitHub 이슈를 직접 생성(GithubIssueService 신규, fine-grained PAT + REST fire-and-forget), Discord는 도착 알림+이슈 링크만 싣는 단순 알림으로 강등. 개발 환경 피드백 재입력 병목 해소. `feedbacks.github_issue_number/url` 컬럼 + 마이그레이션. 실패 격리(이슈/Discord 실패는 피드백 저장에 무영향). 결정 근거는 ADR-031(DB 경계 외부 반출 + PII 최소화). (2) #498 — TypeORM은 마이그레이션을 `parseInt(className.substr(-13))`로 정렬하는데, 14자리 타임스탬프는 절단되어 base 테이블보다 앞서 정렬돼 fresh-DB migrate를 깨뜨린다. `scripts/check-migration-timestamps.mjs`(--strict CI 게이트 + quality-migrations job)로 신규 >13자리 마이그레이션 파일명을 차단(기존 7개 prod 적용 14자리 파일은 grandfathered). #498은 #497 Critic P1(타임스탬프 절단 버그)의 구조적 재발 방지. Critic 게이트는 ACP 제약(연속 SIGTERM 중단)으로 이번 스프린트 스킵 후 Sprint 262 이월 — CI green + mergeable CLEAN 확인 후 머지. #497 `552afc3`(jest 302/302) · #498 `317efeb`(CI 37/37)."
---
# Sprint 261 — 피드백 → GitHub 이슈 자동 동기화 + 마이그레이션 타임스탬프 CI 가드

_날짜: 2026-07-24_

## 목표

Sprint 260 종료 이후 정식 `/sprint-open` 없이 머지된 운영 개선 2건을 **Sprint 261로 소급 마감**한다. 두 작업은 논리적으로 연결돼 있다 — #497이 도입한 마이그레이션에서 드러난 TypeORM 정렬 함정(#497 Critic P1)을 #498이 CI 가드로 구조화 차단한다.

**대상**
- #497 `552afc3` — `services/identity` 피드백 저장 → GitHub 이슈 자동 동기화 + Discord 단순 알림 강등
- #498 `317efeb` — `.github/workflows/ci.yml` + `scripts/check-migration-timestamps.mjs` 마이그레이션 타임스탬프 13자리 강제

## 결정 사항

### D1. 피드백 맥락을 DB 경계 밖 GitHub 이슈로 반출 (#497, ADR-031)

개발 환경에서 피드백을 다시 옮겨 적는 병목을 없애기 위해, 피드백 저장 시 전체 맥락(본문·pageUrl·browserInfo·publicId·스터디)을 담아 중앙 레포에 GitHub 이슈를 직접 생성한다. `GithubIssueService`를 신설하되 Octokit 없이 기존 Discord fire-and-forget `fetch` 패턴을 복제해 REST를 직접 호출하고, fine-grained PAT(issues:write, 단일 레포)로 권한을 최소화한다. DB 경계 외부 반출·PII 최소화 근거는 ADR-031(KR+EN)에 별도 기록한다.

### D2. Discord는 도착 알림으로 강등, 실패 격리 (#497)

기존 Discord 전체 맥락 전송은 GitHub 이슈로 대체하고, Discord는 도착 알림 + 이슈 링크만 싣는 단순 알림으로 강등한다. 스크린샷은 GitHub data URI 미렌더 문제로 대시보드 링크만 싣는다. 이슈 생성·Discord 전송 실패는 피드백 저장 트랜잭션에 영향을 주지 않도록 격리한다.

### D3. 마이그레이션 타임스탬프 오정렬을 CI로 구조 차단 (#498)

TypeORM은 마이그레이션을 클래스명 끝 13자리(`parseInt(className.substr(-13))`)로 정렬한다. 14자리 `YYYYMMDDHHMMSS`(예: `20260723000000`)는 `260723000000`으로 절단돼 base 테이블 생성 마이그레이션(`1709000017000`)보다 **앞서** 정렬되고, fresh DB에서 `ALTER TABLE`이 테이블 생성 전에 실행돼 깨진다. #497이 해당 파일 하나를 13자리 epoch-ms(`1784851200000`)로 정정했으나, 개별 수정만으론 재발을 막지 못하므로 CI 게이트(`--strict`, quality-migrations job)로 신규 >13자리 파일명을 차단한다. 기존 7개 prod 적용 14자리 파일은 rename 시 재실행을 유발하므로 grandfather 처리한다.

## 구현

- **#497** (`services/identity`):
  - `GithubIssueService` 신규(171줄) + `github-issue.module.ts` — fine-grained PAT + REST 직접 호출
  - `feedback.entity.ts` `github_issue_number`/`github_issue_url` 컬럼(중복 방지) + 마이그레이션 `1784851200000-AddFeedbackGithubIssueColumns.ts`
  - `feedback.service.ts` 저장 후 이슈 생성 트리거 + 실패 격리 · `discord-webhook.service.ts` 단순 알림 강등
  - `infra/sealed-secrets/sealed-secrets-template.yaml` `GITHUB_FEEDBACK_ISSUE_TOKEN`/`REPO` 키 추가
  - `docs/adr/ADR-031`(KR+EN) 신규
- **#498** (CI):
  - `scripts/check-migration-timestamps.mjs`(236줄) — 신규 마이그레이션 파일명 13자리 강제, 기존 14자리 grandfather 리스트
  - `.github/workflows/ci.yml` quality-migrations job + `--strict` 게이트 추가

**검증(물리적 사실)**: #497 `552afc3` jest 302/302, 커버리지 99.87%/99.56%/100%/100%, ADR EN 206/206. #498 `317efeb` CI 37/37 green, mergeable=CLEAN. 두 PR 모두 origin/main 머지 완료(squash).

**Critic**: ACP 백엔드에서 Critic(Codex) 실행이 코드베이스 grep 도중 연속 SIGTERM(15)으로 중단 — 판정 미산출. 서비스 안정성 판단하에 **이번 스프린트 Critic 게이트 스킵**, CI green + mergeable CLEAN 확인 후 머지. Critic 인프라 제약 규명은 Sprint 262로 이월(사용자 결정 2026-07-24). 단, #497은 머지 前 별도 Critic 라운드에서 P1(타임스탬프 절단)·P2(AbortController 10s 타임아웃)·P3(issueUrl 저장 순서) findings를 이미 반영한 상태였다.

## 인시던트

1. **Critic 게이트 연속 미완료**: PR #498 Critic이 `/tmp/critic-pr498.log` 코드베이스 탐색 도중 `SIGTERM(15)`로 종료 — 판정·`.done` 마커 미산출. ACP 환경 반복 제약(Sprint 251·254·260 동형). 사용자 결정으로 이번 스프린트 스킵 + Sprint 262 이월.
2. **소급 스프린트 마감**: #497·#498 모두 정식 `/sprint-open` 없이 머지 — Sprint 260 종료 이후 어느 스프린트에도 미기록. 종료 절차에서 Sprint 261로 소급 번들 마감(사용자 확인).
3. **마이그레이션 배포 경로 확인**: 신규 마이그레이션 수동 실행 필요 여부 조사 결과, identity 매니페스트의 `db-migrate` initContainer가 앱 기동 前 `migration:run`을 자동 실행 → GitOps 재배포 = 마이그레이션. 로컬 Docker/k3d 무관, 수동 실행 불필요. 단 실제 적용 검증(initContainer 로그)은 프로덕션 클러스터 접근이 전제라 Oracle 로컬에서 불가(사용자 몫).
4. **EN ADR 수기 작성**: `ANTHROPIC_API_KEY` 미설정으로 `translate-adr.mjs`(Claude API) 실행 불가 → sprint-261 EN ADR은 구조·기술 용어 보존하여 수기 작성. 키 재로테이션은 사용자 지시로 폐기 상태(2026-07-21).

## 이월

- [ ] Critic 게이트 ACP SIGTERM 연속 중단 원인 규명 및 해결 — **Sprint 262** (사용자 명시 이월)
- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Sprint 255~260 이월 지속)
- [ ] 256~259 회고 ADR 공백 — 병렬 Oracle 세션 소관(본 세션 관할 아님)

## 교훈

- **TypeORM 마이그레이션 정렬은 클래스명 끝 13자리 정수**다. 14자리 타임스탬프는 절단돼 base 테이블보다 앞서 정렬 → fresh DB migrate가 깨진다. 개별 파일 수정만으론 재발을 못 막으므로 **CI 가드로 구조적 차단**한다(개별 수정 #497 → 구조 차단 #498).
- **개발 병목이 되는 수동 반복 작업(피드백 재입력)은 DB 경계 밖으로 오프로드**하되, 권한 최소화(fine-grained PAT 단일 레포)·PII 최소화·실패 격리를 필수 게이트로 둔다.
- **Critic 게이트가 인프라 제약으로 연속 실패**할 때, 서비스 안정성 우선 원칙하에 게이트 스킵 + 이월 결정이 가능하다 — 단 CI green + mergeable CLEAN 확인은 대체 불가한 최소 게이트다.
