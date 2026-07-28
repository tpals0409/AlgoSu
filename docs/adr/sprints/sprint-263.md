---
sprint: 263
title: "남은 피드백 이슈 큐 처리 (#4·#7·#8·#9·#10·#11·#12·#13·#14)"
date: "2026-07-28"
status: completed
agents: [Oracle, Gatekeeper]
related_adrs: ["sprint-262"]
related_memory: ["sprint-window"]
topics: ["frontend", "submission", "gateway", "identity", "ux", "rate-limit", "critic-gate", "config"]
tldr: "algosu-feedback 이슈 큐 잔여분을 Sprint 263으로 일괄 마감. 피처 PR 6건 머지 — #509(#13 GitHub 동기화 실패 표시)·#510(#8·#9·#10·#12 스터디룸·사이드바 UX)·#511(#7 D-day 마감일 기준 정정)·#512(#2·#11 난이도 토글·배지 제거)·#514(#14 버그리포트 다중사진)·#513(#4 제출 rate limit 상향 + 429 UX). Critic 게이트가 실제 결함 3계열을 포착: (1) #514 스크린샷 4장(~2.8MB) data URL이 gateway·identity Express 기본 body limit 100KB에 걸려 413 → 양쪽 main.ts 5mb 상향. (2) #513 429 카피가 '정상 처리됨' 오정보 + variant 리셋 누락 → FE 문구 정정·variant 리셋. (3) #513 재리뷰가 rate-limit.middleware.ts `static readonly` 필드의 class-load 시점 process.env 조기 판독(ConfigModule .env 로딩 선행) 결함 포착 → ConfigService 생성자 주입으로 전환(prod 무영향, 로컬 .env 오버라이드 복구). 부수로 critic-clean.sh 가드가 diff 본문의 과거 findings 참조 주석을 오탐 → codex 판정 섹션만 스캔하도록 하드닝(#514·#513 실증). Critic 전 PR CLEAN, CI 39/39 green."
---
# Sprint 263 — 남은 피드백 이슈 큐 처리 (#4·#7·#8·#9·#10·#11·#12·#13·#14)

_날짜: 2026-07-28_

## 목표

`tpals0409/algosu-feedback` 이슈 큐의 잔여분을 Sprint 263으로 일괄 마감한다. Sprint 262에서 #5(어포던스)를 마친 뒤 남은 UX·정합성·안정성 피드백을 피처 PR 6건으로 처리하고, 각 PR을 Critic 게이트로 심사한다.

**대상 (머지 확정)**
- #509 `e5b7d81a` — #13 GitHub 동기화 실패를 제출 목록·스터디룸에 표시
- #510 `29d17198` — #8·#9·#10·#12 스터디룸·사이드바 UX 개선
- #511 `9a9564be` — #7 D-day 카운팅을 문제 풀이 마감일 캘린더 일수 기준으로 정정
- #512 `4d0ac0dd` — #2·#11 문제 난이도 가리기 토글 + 알고리즘 태그 배지 제거
- #514 `bc6f637a` — #14 버그 리포트 사진 다중 첨부(최대 4장) + body-limit 5mb
- #513 `14f839db` — #4 제출 rate limit 상향 + 429 UX 개선

## 결정 사항

### D1. 다중 스크린샷 첨부의 body limit — gateway·identity 5mb 상향 (#514)

버그 리포트 다중 사진(최대 4장, 장당 `dataUrl.length > 700_000` 컷 → 최악 ~2.8MB JSON)이 gateway·identity **양쪽**의 Express 기본 body parser 한도(약 100KB)에 걸려 정상 이미지에서도 413으로 거부됐다. 피드백 경로(`/api/feedbacks`)는 gateway 프록시 라우팅 테이블 밖이라 스트림 재구성 로직을 경유하지 않으므로, gateway·identity `main.ts` 두 곳의 `json`/`urlencoded` 한도를 동일하게 5mb로 상향했다. 교차 서비스지만 한도값 1개를 공유해야 하므로 Gatekeeper 단일 위임으로 양쪽을 한 번에 처리(값 불일치·push 경합 방지).

### D2. 429 rate-limit UX — 오정보 카피 정정 + variant 리셋 (#513)

제출 rate limit(429) 안내 문구가 "정상 처리됩니다 / still processed normally"라고 표기해, 실제로는 생성·추적되지 않는 막힌 제출을 사용자가 "수락됨"으로 오인하게 했다(P2). 실제 동작에 맞춰 오정보 괄호 문구를 en·ko 양쪽에서 제거했다. 아울러 429 후 `submitErrorVariant='warning'`이 잔존해 이후 빈 코드 제출 시 "Please enter your code"가 rate-limit 경고 스타일로 표시되던 결함(P3)을 empty-code 분기에 `setSubmitErrorVariant('error')` 추가로 차단하고 회귀 테스트를 넣었다.

### D3. rate-limit 한도의 설정 판독 시점 — static 필드 → ConfigService 주입 (#513)

`rate-limit.middleware.ts`의 한도 상수가 `static readonly`라 **클래스 로드 시점**에 `process.env['RATE_LIMIT_SUBMISSION']`을 읽어, NestJS `ConfigModule`의 `.env` 로딩보다 먼저 실행됐다. 결과적으로 `.env` 파일의 오버라이드가 무시되고 폴백값으로 고정됐다(로컬 `.env` 경로 한정 갭 — 프로덕션은 SealedSecret→컨테이너 env로 부모 프로세스에 export되어 static init에서도 정상 인식이라 무영향). gateway 관례(`invite-throttle.service.ts`)대로 `ConfigService`를 생성자 주입해 인스턴스 시점에 한도를 읽도록 전환하고, env 오버라이드가 실제 반영되는지 검증하는 회귀 테스트를 추가했다.

### D4. critic-clean.sh 가드 하드닝 — codex 판정 섹션만 스캔 (게이트 인프라)

CLEAN 마커 생성 가드가 Critic **로그 전체**를 스캔하면서 리뷰 대상 diff 본문에 포함된 과거 findings 참조 주석(예: `Critic PR#497 P1`, `Sprint 127 Wave-B P1`)을 신규 findings로 오탐해 CLEAN을 거부했다. 로그 구조가 `user`(리뷰 대상 diff) + `codex`(판정)로 분리됨을 확인하고, 가드가 **codex 판정 섹션만** 스캔하도록 하드닝했다(codex가 실제 P0/P1을 쓰면 그대로 검출 — 안전망 유지). #514에서 도입하고 #513 재실행에서 오탐 없이 재현 검증.

## 구현

- **#514**: `services/gateway/src/main.ts`·`services/identity/src/main.ts` — `express.json`/`urlencoded` limit 5mb. 커밋 `e955602`(수정) 포함 squash 머지 `bc6f637a`.
- **#513**: `frontend` `messages/{en,ko}/problems.json` 429 문구 정정, `page.tsx` empty-code 분기 variant 리셋 + 회귀 테스트(`131e32e4`); `services/gateway/src/rate-limit/rate-limit.middleware.ts` ConfigService 주입 + spec env-override 회귀 테스트(`4a9ecc0e`). squash 머지 `14f839db`.
- **가드 하드닝**: Oracle 프로파일 운영 스크립트 `critic-clean.sh`(본 레포 밖) — 판정 섹션 스코프 스캔.

**검증(물리적 사실)**: 피처 PR 6건 전부 Critic 판정 CLEAN, CI 39/39 green. #514 로컬 tsc exit 2는 `tsconfig.json` `baseUrl` deprecation(TS5101) 사전 노이즈로 커밋 무관 — CI `Quality — gateway`·`Quality — identity`(tsc+lint) pass가 확증. #513 게이트: gateway jest 10/10(env-override 회귀 포함), frontend jest 9/9(P3 회귀 포함), tsc exit 0, ESLint Errors 0.

## 인시던트

1. **#514 머지 차단 2단(리뷰→BEHIND)**: CI 8종 green·Critic CLEAN·auto-merge 예약 상태에서 `REVIEW_REQUIRED`로 차단 → 이후 브랜치 `BEHIND`로 전환. `gh pr update-branch`로 최신화 후 CI 재실행 green → 자동 머지. auto-merge는 브랜치 최신화·승인 요건을 전부 만족해야 발동함을 재확인.
2. **critic-clean.sh 가드 오탐(게이트 인프라)**: 위 D4. diff 본문의 과거 Critic 참조 주석을 findings로 오인 → 판정 섹션 스코프 스캔으로 구조 차단.
3. **#513 Critic 다단 findings**: 1차 P2(429 오정보)·P3(variant), 재실행 시 신규 P2(설정 판독 시점) 포착. 재리뷰가 앞선 수정을 재지적 없이 인정하고 다른 계층의 결함을 새로 잡아냄 — 게이트 반복이 실효.
4. **EN ADR 수기 작성**: `ANTHROPIC_API_KEY` 미설정으로 `translate-adr.mjs`(Claude API, exit 2) 실행 불가 → sprint-263 EN ADR은 구조·기술 용어 보존하여 수기 작성(Sprint 261·262 동형). 키 재로테이션은 사용자 지시로 폐기 상태.

## 이월

- [ ] Critic 게이트 ACP SIGTERM 연속 중단 **근본 원인** 규명 — Sprint 262·263엔 재현되지 않았으나 원인 미규명 지속(261→262→263) — **다음 스프린트(264) 대상**
- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 — **다음 스프린트(264) 대상**
- [ ] 256~259 회고 ADR 공백 — 병렬 Oracle 세션 소관(본 세션 관할 아님) — **다음 스프린트(264) 대상**

## 교훈

- **Critic 게이트 반복은 계층이 다른 결함을 순차로 드러낸다.** #513은 1차에서 UX 오정보(카피)·상태 잔존(variant)을, 수정 후 재실행에서 설정 판독 시점(static init vs ConfigModule)이라는 **런타임 초기화 순서** 결함을 새로 잡았다. 한 번의 CLEAN으로 만족하지 않고 수정 커밋마다 재기동한 것이 유효.
- **`static readonly` 필드는 DI 컨테이너 초기화 전에 실행된다.** 환경 설정은 `ConfigService` 주입(인스턴스 시점)으로 읽어야 `.env`/`ConfigModule` 로딩 순서와 무관하게 일관된다 — 클래스 로드 시점 `process.env` 직독은 프레임워크 부팅 순서에 종속된다.
- **교차 서비스 동일 한도값은 단일 위임으로 처리한다.** #514 body limit은 gateway·identity 양쪽이 같은 값을 공유해야 해서, 병렬 분할 시 값 불일치·push 경합 위험이 컸다 — 단일 에이전트가 한 브랜치에서 양쪽을 처리.
- **게이트 스캐너는 판정 출력만 봐야 한다(리뷰 대상 본문 제외).** critic-clean.sh가 로그 전체를 스캔해 diff 내 과거 findings 주석을 오탐 → codex 판정 섹션으로 스코프를 좁혀 구조적으로 차단(개별 우회 → 구조 수정).
