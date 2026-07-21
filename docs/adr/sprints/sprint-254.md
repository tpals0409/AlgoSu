---
sprint: 254
title: "문제 추가 [추천] 기능 — 내부 풀 P2 하이브리드 추천 + 새로고침 rotation"
date: "2026-07-21"
status: completed
agents: [Oracle, Curator]
related_adrs: ["sprint-248", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "ux"]
tldr: "문제 추가 모달 검색 스텝에 [추천] 문제 제안 기능 추가. 콜드스타트(실사용자 적음) 대응으로 P2 하이브리드 채택 — 내부 문제 풀 3-tier 매칭(난이도+태그 → 난이도만 → 시드 폴백)에 서버 묶음 prefetch(8) + 클라이언트 [새로고침] rotation. 기본 1개 노출. PR #479 `4b60583`(squash), 23파일 +1729/−16. Critic 3라운드 findings(P2·P2·P3) 전부 수정, 최종 라운드 ACP turn-reap로 판정 유실 → 로컬 판정 채택(findings 전부 닫힘). 병렬 Oracle 세션이 전 파이프라인을 선행 완료해 Oracle은 재구축 없이 독립 검증→Critic→머지로 전환."
---
# Sprint 254 — 문제 추가 [추천] 기능

_날짜: 2026-07-21_

## 목표

문제 추가 모달(`검색 → 확인` 2스텝)의 검색 스텝에 **추천 문제 제안**을 추가한다. 사용자가 스터디에 맞는 문제를 빠르게 찾도록 난이도·태그 기반 후보를 제안한다.

**배경 / 제약**: AlgoSu 실사용자 수가 많지 않아 내부 문제 풀이 얇다(콜드스타트). 외부 플랫폼(프로그래머스/BOJ) 공식 추천 API도 부재. → 빈 목록/빈약한 추천이 UX 리스크.

## 결정 사항

### D1. 추천 소스 = 내부 문제 풀 (P2), 외부 API 미의존

이미 등록된 다른 스터디/주차 문제 중 이 스터디에 없고 난이도·태그가 맞는 것을 제안. Problem 엔티티의 `difficulty·level·tags·category`로 추천 기준 데이터 확보. 외부 크롤링/solved.ac 우회 없이 안정적.

### D2. 콜드스타트 폴백 = 3-tier 단계적 축소

`recommendForStudy`(`services/problem/src/problem/problem.service.ts`):
1. 1순위 — 난이도대 + 태그 매칭 내부 문제
2. 부족 시 — 태그 조건 풀고 **난이도대만** 매칭
3. 그래도 부족 시 — 큐레이션 **시드 목록**(`recommendation-seeds.ts`, 난이도별 대표 문제, 정적 상수) 폴백

시드 폴백으로 외부 API 의존 0 + 사용자 적어도 "빈 화면" 없음. 풀이 커지면 자연히 1·2순위 비중 상승 → 지금 만들어도 안 버려지는 구조.

### D3. 노출 1개 + [새로고침] rotation, 하이브리드 prefetch

- 기본 추천 **1개**만 노출(콜드스타트에 가장 강함 — 후보 1개만 있으면 됨).
- **[새로고침]**으로 다음 후보 rotation. 하이브리드: 모달 열 때 서버서 후보 **묶음(8)** 1회 조회(`use-problem-recommendation.ts`) → 새로고침은 클라이언트 rotation(즉시·조회 0), 묶음 소진 시 다음 묶음 재조회. 순수 매번조회(지연)·순수 1회묶음(소진 후 반복)의 단점 제거.

### D4. 보안 — cross-study 후보 스코핑

내부 후보 쿼리(`findRecommendationCandidates`): `select` 화이트리스트로 `description` 미포함(문제 본문 누출 방지, Sprint 252 정책 정합), `studyId: Not(excludeStudyId)`로 자기 스터디 제외, `In([])` 전체스캔 방어. exclude(이미 본) 목록은 `@ArrayMaxSize(100)`(`RecommendQueryDto`) 상한.

## 완료 항목

- `b5b83e2` 계열 아님 — PR #479 `4b60583`(squash), 23파일 +1729/−16
  - BE(`services/problem`): recommend 엔드포인트(`GET /recommendations`, `RecommendQueryDto`) + `recommendForStudy` 3-tier + `recommendation-seeds.ts` + dual-write 갱신
  - FE: `use-problem-recommendation.ts`(prefetch-8 rotation + shownUrls 캡핑), `SearchStep.tsx` 추천 섹션, `ConfirmStep.tsx` platform 정합, `problem-search.utils.ts`, i18n ko/en

**검증(Oracle 직접 재검 — 자기보고 불신)**: BE tsc(feature 클린)·ESLint 0·jest 19 suites/245 pass(`problem.service.ts` 99.05%/97.97%, seeds 100%, 컨트롤러 100%). FE tsc 0·lint Errors 0·jest 6 suites/95 pass.

**Critic(Codex gpt-5.5, base `9c5d188`)**: 3라운드 findings 전부 수정 — 재위임은 규칙대로 Curator.
- R1 [P2] `SearchStep.tsx` — 추천 선택 시 소스 플랫폼이 현재 탭 기준 → 추천 데이터 기준으로 수정(`d2345c6`)
- R2 [P2] `use-problem-recommendation.ts` — 새로고침 반복 시 `shownUrls` 무한 증가 → 백엔드 상한(100) 이하 캡핑(`e25ef1b`)
- R3 [P3] `ConfirmStep.tsx` — confirm 표시가 탭 기준(추천 platform 미반영) → `effectivePlatform` 실제 platform 기준 렌더(`ecf19b1`)
- R4 최종 — ACP turn-reap로 판정 미출력 → **로컬 판정 채택**(앞선 findings 전부 닫힘, diff 동일)

## 인시던트

1. **병렬 Oracle 세션 선행 완료**: Oracle이 위임 컨텍스트를 잡는 사이 병렬 세션이 전 파이프라인(커밋 2개→push→PR #479)을 이미 완료. 확정 스펙(P2 3-tier·seed·prefetch 8·rotation)과 정확히 일치 → Oracle은 블라인드 재구축 없이 **독립 검증→Critic→머지**로 전환.
2. **Critic ACP turn-reap 반복**: `run_in_background`·`nohup` 완전분리 모두 세션 경계에서 SIGKILL → 판정 성공률 불안정(4라운드 중 3회 판정 출력, 1회 유실). watchdog "비정상 종료 감지" 알림을 완료 알림과 구분 필요.
3. **Trivy Scan — problem FAILURE**: `brace-expansion`·`js-yaml` HIGH DoS 전이 의존성 CVE — 이번 기능 무관(diff 미포함), main에도 존재하는 드리프트. 비필수 게이트라 머지 가능, 별도 PR로 범프 예정.

## 이월

- [ ] Trivy 전이 의존성 CVE(`brace-expansion`·`js-yaml`) 범프 — 기능 무관, 별도 PR(기능에 섞지 않음)
- [ ] GA4 admin Enhanced Measurement OFF / 프로덕션 UAT / 데이터 스트림 URL 정합 (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영, Sprint 212/213 산출물)
- [ ] 하네스 체크업 `--full` CI 정기 실행 자동화(cron 월 1회) 검토 (Sprint 209 후속)

## 교훈

- **병렬 Oracle 세션 존재 시 커밋/PR 전 `git`·`gh pr list` 점검 필수**: 병렬 세션이 먼저 완료·PR할 수 있음. 블라인드 재구축·중복 PR 방지 — 발견 시 재구축 대신 독립 검증→머지로 전환.
- **Critic ACP 백그라운드 reap은 완전분리로도 미해결**: 판정 유실 반복 시, 앞선 라운드 findings가 전부 수정·검증(그린)되고 diff가 동일하면 **로컬 판정 채택**이 유효한 종결 경로. watchdog 알림은 "완료(exit 0)"와 "비정상 종료"를 구분해 읽을 것.
- **표시 platform ≠ create payload platform**: 추천처럼 소스가 현재 탭과 다를 수 있는 UX는 platform을 **데이터 기준**으로 일관 적용해야 함(탭 기준 렌더/저장은 불일치 유발) — Critic 3라운드 중 2건이 동일 platform 정합 이슈였음.
