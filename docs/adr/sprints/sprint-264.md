---
sprint: 264
title: "이월 작업 해소 (Critic SIGTERM 규명·seed 대표성·256~259 ADR 갭)"
date: "2026-07-28"
status: completed
agents: [Oracle, Curator, Scribe]
related_adrs: ["sprint-263", "sprint-262"]
related_memory: ["sprint-window"]
topics: ["critic-gate", "acp", "operations", "problem", "recommendation", "adr", "documentation"]
tldr: "255~263에 걸쳐 쌓인 이월 3건을 일괄 해소. (1) Critic 게이트 ACP SIGTERM 연속 중단의 근본 원인을 규명 — codex를 ACP 세션 '내부'에서 기동해 턴 종료 시 자식 프로세스가 reap(SIGTERM)당한 것으로, Sprint 262의 detached 크론 재설계로 이미 구조적 해소된 상태였다(재설계 후 8개 PR #507·#509~515 로그에 SIGTERM 0건 실증, 관측된 signal 13은 codex 내부 grep의 SIGPIPE 양성). 크론 유실 대비 ensure-critic-crons.sh 멱등 재등록 스크립트를 보강. (2) BOJ 추천 seed 대표성 재검토 → #521 `10e4c377`(12→23), Critic이 solved.ac 실측 대비 티어 오라벨 3건(15649 GOLD→SILVER, 1005·2098 PLATINUM→GOLD)을 포착해 실 PLATINUM 0건 노출 → 검증된 PLATINUM 3건(3653·11375·1761) 추가로 item2 목적 달성, Trivy brace-expansion 5.0.7→5.0.8 override. (3) 256~259 회고 ADR 갭 → #522 `eb338f75`(KR+EN, 인덱스 201). 진행 중 병렬 Oracle 세션이 동일 픽스를 선행 적용하는 충돌이 반복됨 — 실측으로만 판별하고 재작업 회피."
---
# Sprint 264 — 이월 작업 해소 (Critic SIGTERM 규명·seed 대표성·256~259 ADR 갭)

_날짜: 2026-07-28_

## 목표

255~263에 걸쳐 이월된 3건을 Sprint 264로 일괄 해소한다. 피처 개발이 아니라 **누적 부채 정리**가 범위다.

**대상 (사용자 확정 — 3건 전부)**
- item1 — Critic 게이트 ACP SIGTERM 연속 중단 **근본 원인** 규명 (261→263 이월)
- item2 — BOJ/프로그래머스 추천 seed 목록 실제 대표성 재검토 (255~261 이월)
- item3 — 256~259 회고 ADR 공백 처리 (4건 작성)

## 결정 사항

### D1. Critic SIGTERM 근본 원인 — ACP 세션 내부 기동 → 턴 reap (item1, 이미 구조 해소)

과거 Critic 게이트가 SIGTERM으로 연속 중단된 근본 원인은, codex를 **ACP 세션 프로세스 트리 내부**에서 기동해 세션 턴이 종료될 때 자식 프로세스가 함께 reap(signal 15)당한 것이다. 이는 **Sprint 262의 detached 크론 재설계**(`launch-critic.sh` → 큐 마커 → `critic-runner` 크론이 ACP 세션 밖에서 codex를 detached 기동)로 **이미 구조적으로 해소**된 상태였다. 재설계 이후 8개 PR(#507·#509~515) 로그를 실측한 결과 SIGTERM은 **0건**이며, 관측된 `signal 13`은 codex 내부 grep 파이프의 SIGPIPE(양성, 리뷰 정상 완료)였다. 즉 item1은 "미규명 잔존"이 아니라 "이미 해소됐으나 회고에 명문화되지 않은" 상태였고, 본 스프린트에서 실증으로 확정했다.

### D2. 크론 유실 대비 멱등 재등록 — ensure-critic-crons.sh (item1 잔여 리스크 보강)

detached 크론 3종(`critic-runner`·`critic-gate-watchdog`·`merge-watch`)이 어떤 이유로 미등록·유실되면 게이트가 **무음으로 정지**한다(SIGTERM보다 위험 — 알림조차 없음). 이 단일 실패점을 없애기 위해 Oracle 프로파일 운영 스크립트로 `ensure-critic-crons.sh`(멱등 재등록)를 추가했다. 본 레포 밖(프로파일 scripts)이라 PR 대상은 아니다.

### D3. seed 대표성 — solved.ac 실측 티어로 교정 + 실 PLATINUM 확보 (item2, #521)

BOJ 추천 seed를 12→23로 확장(GOLD/PLATINUM 폴백 보강 목적)했으나, Critic 게이트가 solved.ac 실측 대비 **티어 오라벨 3건(P2)**을 포착했다: `15649`(N과 M(1)) 실제 SILVER인데 GOLD 표기, `1005`(ACM Craft)·`2098`(외판원 순회) 실제 GOLD인데 PLATINUM 표기. 이 오라벨로 실 PLATINUM이 **0건**이 되어 item2 목적(고티어 폴백 확보) 자체가 미달이었다. → 실측 티어로 교정하고 검증된 PLATINUM 3건(`3653`·`11375`·`1761`)을 추가했다. 부수로 Trivy가 잡은 `brace-expansion` 5.0.7 CVE-2026-14257(트랜지티브 HIGH)을 5.0.8 override로 해소.

### D4. 256~259 회고 ADR 갭 해소 (item3, #522)

병렬 세션 소관이던 256~259 회고 ADR 공백을 본 스프린트 범위로 처리했다. Scribe 위임이 256만 생성하고 정지(ACP background 정지)해, 누락분(KR 257·258·259 + EN 256·257·258·259)을 커밋 팩트 수집 후 수기 완성했다. `docs/adr/README.md` 회고 ADR 카운트를 `197→201`로 보정(CI `Quality — docs` `--strict` 통과).

## 구현

- **item1**: 근본 원인 규명(문서·로그 분석) + `ensure-critic-crons.sh`(프로파일 scripts, 레포 밖). 코드 변경 없음.
- **item2 (#521 `10e4c377`)**: `services/problem/src/problem/recommendation-seeds.ts` — seed 12→23, 티어 실측 교정 3건 + PLATINUM 3건 추가; `package.json` brace-expansion 5.0.8 override. `tsc` exit 0 · jest 19 suites/266 tests 통과(Oracle 직접 재검).
- **item3 (#522 `eb338f75`)**: `docs/adr/sprints/sprint-{256,257,258,259}.md`(KR) + `docs/adr-en/sprints/…`(EN) + `docs/adr/README.md` 카운트. EN 213/213 · doc-refs 무결.

**검증(물리적 사실)**: #521·#522 둘 다 Critic 판정 **CLEAN**(Oracle 로그 직접 판독 확정), CI green, mergeState CLEAN 후 squash 머지 — #521 `10e4c377`, #522 `eb338f75` origin/main 반영 확인.

## 인시던트

1. **병렬 Oracle 세션 충돌(반복)**: (a) 263 회고 ADR을 push+PR하려던 중 병렬 세션이 이미 PR #520을 머지 완료한 것을 발견 — 되살린 stale 브랜치를 GitHub API로 삭제 정리. (b) #521 Critic 3픽스(티어 교정·PLATINUM 추가·Trivy)와 #522 README 보정을 내가 착수하기 전에 병렬 세션이 **전부 선행 적용·push** — 실측(원격 커밋 이력)으로 판별하고 재작업을 회피(내 로컬 브랜치는 원격보다 뒤처져 push 보류). 메모리의 병렬 세션 PR 충돌 패턴 그대로.
2. **자동 verdict 오탐(재확인)**: `.verdict` 자동 파서가 #521·#522를 "CLEAN-hint"로, 재리뷰 #521을 "REVIEW-NEEDED"로 표기했으나 로그 codex 판정부는 둘 다 CLEAN이었다. 자동 판정은 참고 힌트일 뿐 — Oracle 로그 직접 판독 확정이 게이트임을 재확인(로그 본문의 seed 조사 키워드가 스캐너를 오도).
3. **#522 BEHIND**: #521·Dependabot #517이 main에 먼저 들어가 #522 브랜치가 BEHIND로 자동머지 미발화 → `gh pr update-branch` 후 자동 머지.
4. **EN ADR 수기 작성**: `ANTHROPIC_API_KEY` 미설정으로 `translate-adr.mjs`(exit 2) 실행 불가 → EN ADR 수기 작성(Sprint 261~263 동형). 키 재로테이션은 사용자 지시로 폐기 상태.

## 이월

- 없음. (255~263 이월 3건 전부 해소)

## 교훈

- **이월 항목은 "미규명"과 "미명문화"를 구분해야 한다.** item1 SIGTERM은 미해결 부채로 261→263을 따라왔으나, 실측하니 Sprint 262 재설계가 **소급 해결**한 상태였다. 8개 PR 로그의 SIGTERM 0건이라는 물리적 사실이 "원인 미규명"을 "이미 구조 해소"로 뒤집었다 — 이월을 자동으로 "미해결"로 간주하지 말고 현 상태를 실측할 것.
- **병렬 세션 충돌은 실측으로만 판별한다(캐시 불신).** 같은 repo에 다른 Oracle 세션이 PR을 밀어붙이면 상태가 실시간 변한다. 편집·push 전 원격 커밋 이력·기존 PR을 매번 재확인해 재작업·중복·되살린 stale 브랜치를 피했다.
- **seed 대표성은 외부 SSOT(solved.ac) 실측이 필수다.** 자칭 티어를 신뢰하면 "PLATINUM 폴백 추가"가 실제로는 GOLD 중복이 되어 목적을 못 채운다 — Critic이 외부 사실 대조로 이를 잡았다. 데이터 시드는 코드 리뷰가 아니라 사실 검증이 관건.
- **자동 판정 힌트는 게이트가 아니다.** `.verdict` 파서가 CLEAN/REVIEW를 오표기해도 Oracle 로그 직접 판독이 최종 — 자동화는 알림·큐잉까지, 판정 확정은 사람(Oracle)이 유지.
