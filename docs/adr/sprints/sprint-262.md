---
sprint: 262
title: "스터디 카드 어포던스 개선 + 문제 카드 딥링크 (피드백 #5)"
date: "2026-07-27"
status: completed
agents: [Oracle, Palette]
related_adrs: ["sprint-261"]
related_memory: ["sprint-window"]
topics: ["frontend", "ux", "affordance", "navigation", "i18n", "deeplink"]
tldr: "algosu-feedback 이슈 큐 #5를 사용자 인터뷰로 재정의해 Sprint 262로 마감. 원래 요청은 '문제 리스트 클릭 시 문제로 이동'이었으나, 인터뷰 결과 근본 원인은 내 스터디 화면의 스터디 카드 어포던스 문제로 드러남 — 카드 본체(→대시보드)는 hover 반응이 있으나 전폭 primary '자세히 보기' 버튼이 시각적으로 압도해 사용자가 대시보드 대신 스터디 상세로 잘못 유입. 해법: (1) 전폭 '자세히 보기' 버튼 제거 → 우상단 텍스트 버튼으로 축소(설정 진입은 상세 페이지 내 기어로 이미 가능), 카드 본체를 유일한 큰 클릭영역으로. (2) 문제 카드에 cursor/hover 어포던스 + 클릭 시 스터디룸 딥링크(`/studies/{id}/room?problemId={pid}` — 스터디룸이 이미 problemId 쿼리로 해당 문제 자동선택하는 진입점 보유, 백엔드/신규 라우트 변경 0). FE 4파일(studies/page.tsx, studies/[id]/page.tsx, ko/en studies.json). Critic CLEAN(findings 0), CI 39/39 green, jest 1822/1822, tsc 신규에러 0, ESLint Errors 0. PR #507 `29eac0e`(squash)."
---
# Sprint 262 — 스터디 카드 어포던스 개선 + 문제 카드 딥링크 (피드백 #5)

_날짜: 2026-07-27_

## 목표

`tpals0409/algosu-feedback` 이슈 큐 **#5** ("내 스터디 → 자세히 보기 → 문제 리스트의 문제 클릭 시 해당 문제로 바로 이동")를 사용자 인터뷰로 범위를 재정의해 마감한다. 인터뷰 과정에서 표면 요청(네비게이션 배선)이 아니라 **어포던스(클릭 가능함의 시각적 단서)** 문제가 근본 원인임이 드러났고, 목적지도 문제 상세(`/problems/{id}`)가 아니라 스터디룸의 해당 문제 뷰로 확정됐다.

**대상**
- #507 `29eac0e` — 스터디 카드 어포던스 재설계 + 문제 카드 스터디룸 딥링크 (FE 4파일)

## 결정 사항

### D1. 전폭 "자세히 보기" 버튼 제거 → 우상단 텍스트 버튼으로 축소 (어포던스 재배치)

내 스터디 화면(`studies/page.tsx`)의 스터디 카드는 본체 클릭 시 대시보드로 이동(`setCurrentStudy` + `/dashboard`)하도록 설계됐으나, 카드 하단의 **전폭 primary 채움 "자세히 보기" 버튼**이 카드 내 가장 강한 시각 요소로 작동해 대시보드로 갈 클릭을 흡수했다. 사용자 관찰: "카드가 버튼인지 모른다 — hover 반응은 있으나 자세히 보기 버튼이 너무 크고 눈길이 가서 그쪽을 누른다."

해법으로 전폭 버튼을 제거하고 "자세히 보기"를 우상단 텍스트 버튼으로 축소한다. 카드 본체가 유일한 큰 클릭영역이 되어 대시보드 유도가 명확해진다.

### D2. 설정 진입점은 상세 페이지 내 기어로 유지 (경로 무손실 검증)

기존 우상단 기어(설정, ADMIN 전용)를 텍스트 "자세히 보기"로 교체하되, 상세 페이지(`/studies/{id}`)에 이미 존재하는 설정 기어(ADMIN 전용, `router.push('/studies/{id}/settings')`)로 설정 접근 경로가 유지됨을 코드로 사전 검증했다(실패 모드 스캔 B2). 카드 → 자세히 보기 → 상세 → 설정 기어. ADMIN 설정 경로 단절 없음.

### D3. 문제 카드 목적지 = 스터디룸 딥링크 (백엔드 변경 0)

문제 카드(`studies/[id]/page.tsx` `ProblemCard`)는 클릭 동작 자체가 없었다(`onClick`·`cursor`·`hover` 전무). 목적지를 문제 상세가 아니라 **스터디룸의 해당 문제 뷰**로 확정한다. 스터디룸(`studies/[id]/room/page.tsx`)은 문제 클릭이 라우트 이동이 아니라 상태 전환(`handleSelectProblem`)이지만, 이미 `?problemId=` 쿼리를 읽어 해당 문제를 자동 선택하는 딥링크 진입점을 보유한다. 따라서 문제 카드에서 `/studies/{id}/room?problemId={problem.id}`로만 보내면 스터디룸이 열리며 해당 문제 제출현황으로 진입한다 — **백엔드 변경·신규 라우트 0**.

## 구현

- **`studies/page.tsx`**: 전폭 "자세히 보기" 버튼 제거, 우상단 텍스트 버튼으로 이전. 인라인 `var(--primary)` 하드스타일 제거 → Tailwind 토큰 클래스로 대체. 카드 본체 `/dashboard` 유지.
- **`studies/[id]/page.tsx`** (`ProblemCard`): `cursor-pointer` + hover 어포던스 추가, 클릭 시 로케일 인식 `useRouter`로 `/studies/{id}/room?problemId={problem.id}` 이동. `studyId` prop 전달.
- **`messages/ko/studies.json`·`messages/en/studies.json`**: 자세히 보기 텍스트 버튼 라벨 ko/en 대칭 추가.

**검증(물리적 사실)**: PR #507 `29eac0e` — CI 39/39 green, jest 172 suites / 1822 tests pass(`JEST_EXIT=0`, 커버리지 임계치 위반 0), tsc 신규에러 0(기존 `layout.tsx` globals.css 로컬 아티팩트만 — 클린 트리 동일), ESLint Errors 0(인라인 style 1건 제거로 경고 감소). Critic(Codex gpt-5.5) 판정 CLEAN — "No actionable correctness issues were found in the diff", findings 0. squash 머지 완료.

**Critic**: 이번 스프린트는 Critic 게이트가 정상 완료(exit 0, CLEAN) — Sprint 251·254·260·261에서 반복된 ACP SIGTERM 중단이 재현되지 않음. 대신 게이트 인프라의 별도 순서 결함이 실제로 걸림(인시던트 2).

## 인시던트

1. **CI Lint Commit Messages 일시 실패(인프라)**: 유일한 실패 job은 `wagoid/commitlint-github-action` Docker 이미지 pull이 docker.io registry 타임아웃(`request canceled while waiting for connection`)으로 3회 재시도 전부 실패한 것. 커밋 메시지 자체는 Conventional Commits 준수. 실패 job만 재실행 → 통과. 코드 무관 transient.
2. **Critic 게이트 순서 갭(재발성 인프라 버그) 발견·수정**: `watch-critic.sh` watchdog이 `.done` 마커 감지→텔레그램 보고 후 `.done`/`.started`/`.pid`를 삭제(send-once)하는데, 그 뒤 `critic-clean.sh`가 요구하는 `.done`이 사라져 CLEAN 마커 생성이 영구 거부됐다. `.verdict`(exit 0일 때만 기록)로 Critic 정상완료를 확증하고 게이트를 통과시킴. 구조 차단: watchdog이 `.done`을 삭제 대신 `.done.reported`로 보존, `critic-clean.sh`가 양쪽을 인정(로그 5대 증거검증은 유지), `run-critic-gate.sh`가 재실행 시 stale `.done.reported` 정리. (대상은 Oracle 프로파일 운영 스크립트 — 본 레포 밖.)
3. **EN ADR 수기 작성**: `ANTHROPIC_API_KEY` 미설정으로 `translate-adr.mjs`(Claude API) 실행 불가 → sprint-262 EN ADR은 구조·기술 용어 보존하여 수기 작성(Sprint 261 동형). 키 재로테이션은 사용자 지시로 폐기 상태.

## 이월

- [ ] Critic 게이트 ACP SIGTERM 연속 중단 **근본 원인** 규명 — 이번 스프린트엔 재현되지 않았으나 원인 미규명 지속(Sprint 261→262→263 이월)
- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Sprint 255~261 이월 지속)
- [ ] algosu-feedback 잔여 피드백 이슈(#2·#3·#4·#7~#14 중 미해결분) — **다음 스프린트(263) 대상**
- [ ] 256~259 회고 ADR 공백 — 병렬 Oracle 세션 소관(본 세션 관할 아님)

## 교훈

- **피드백의 표면 요청과 근본 원인은 다를 수 있다.** #5는 "클릭하면 이동 안 됨"으로 접수됐으나, 인터뷰 결과 실제 원인은 어포던스 경쟁(전폭 버튼이 카드 본체 클릭을 흡수)이었다. 표면 요청대로 문제 카드에 `onClick`만 배선했다면 "버튼인지 모름" 문제를 그대로 재현했을 것 — **관찰→가설→증거 수집 인터뷰가 스코프를 바로잡았다.**
- **기존 딥링크 배관을 먼저 확인하면 백엔드 변경을 0으로 만들 수 있다.** 스터디룸은 이미 `?problemId=` 쿼리 자동선택 진입점을 보유했다 — 새 라우트/데이터 배관 없이 쿼리스트링만으로 목적지 달성.
- **어포던스 재설계 시 대체 진입점 무손실을 코드로 사전 검증한다(B2).** 설정 기어를 카드에서 제거하기 전에 상세 페이지 내 설정 진입점 존재를 확인 — ADMIN 경로 단절 방지.
- **게이트 인프라의 send-once 소비는 후속 게이트를 굶길 수 있다.** watchdog이 `.done`을 소비 후 삭제하면 `critic-clean.sh`가 영구 거부 — 소비 이벤트는 삭제 대신 `.reported` 보존으로 구조 차단(개별 우회 → 구조 수정).
