---
sprint: 222
title: "quiz 접근성 심화 — 포커스 관리 + aria-live (Sprint 221 시각 개편의 후속)"
date: "2026-06-06"
status: completed
agents: [Oracle, Scribe, Herald, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220", "sprint-221"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "Sprint 215~221로 기능·시각이 완성된 CS 퀴즈(/quiz)의 키보드/스크린리더 접근성을 심화한 프론트엔드 전용 스프린트. 신규 디자인 토큰 0·신규 컴포넌트 0·신규 i18n 키 3건(play.progressAria / result.announceDone / result.announceNewBest)만 추가한 순수 a11y 로직 스프린트다. (D1 포커스 관리) 단계 전환 시 주요 액션 버튼으로 포커스를 이동하되, native autoFocus 대신 ref+useEffect focus() 패턴을 채택 — jsx-a11y/no-autofocus 회피 + 테스트 가능(toHaveFocus). QuizFeedback/QuizResult가 단계 전환 시 fresh mount되므로 빈 deps mount-effect로 충분하다. (D2 aria-live/접근 이름) QuizPlay Progress에 aria-label+aria-valuetext 보강 + progressbar aria-valuenow 명시 노출(로컬 progress.tsx 래퍼가 value를 Root에 미전달해 Radix aria-valuenow가 undefined였던 갭을 QuizPlay에서 직접 전달로 보정 — Critic R2 P2). QuizResult 신기록 공지는 전용 sr-only role=status aria-live=polite 영역을 빈 채로 먼저 마운트하고 useEffect로 공지 문장을 주입('존재 후 변경' 정석 — Critic R1 P2), 시각 점수/배지는 순수 시각 요소로 환원. (D3 절제) 신규 토큰 0·컴포넌트 0, 선택 pill은 button+aria-pressed 현행 유지(radiogroup 비격상 — 이미 WCAG 충족, 회귀 위험 최소). 회귀 테스트 +6(전역 1504→1510), quiz 컴포넌트 5종 100/100/100/100, 글로벌 lines 87.71%/branches 79.04%(게이트 83/71). ref null 단락 분기는 도달 불가라 istanbul ignore(CodePanel.tsx 선례)로 브랜치 100% 복원. Critic 3라운드(R1·R2 각 P2 → 5163fdc·93ca2a7로 해소, R3 런타임 CLEAN + P3 ADR i18n 키 수 정정). 코드는 라이브 무관(merge≠라이브, 별도 운영 이월)."
---
# Sprint 222 — quiz 접근성 심화

## 목표

- Sprint 215~221로 **기능·시각이 완성**된 CS 퀴즈(`/quiz`)의 **키보드/스크린리더 접근성을 심화**한다.
- 사용자 확정 범위: 핵심 축 = **접근성 심화 집중**. 선택 pill(분야·난이도)은 현행 `button`+`aria-pressed`를 유지(**radiogroup 격상 안 함** — 이미 WCAG 충족, 회귀 위험 최소화).
- 프론트엔드 전용 — 데이터/스키마/백엔드 무변경. 신규 디자인 토큰·컴포넌트 0(순수 a11y 로직). `/quiz`는 인증 게이트이므로 라이브 검증은 별도 운영 이월(merge ≠ 라이브).

## 배경

Sprint 221이 분야 accent 토큰·3화면 시각 개편으로 `/quiz`의 외형을 끌어올렸으나, 단계 전환(문제 → 피드백 → 결과) 시 포커스가 이전 위치에 머물러 키보드 사용자가 다음 액션을 찾기 어렵고, 진행률·신기록 같은 동적 상태가 스크린리더에 충분히 공지되지 않았다. 본 스프린트는 시각 개편 직후, 신규 토큰/컴포넌트를 만들지 않고 **포커스 관리 + 접근 이름/라이브 영역**만 보강해 a11y를 심화한다.

## 결정

### D1. 포커스 관리 = `ref + useEffect focus()` (native `autoFocus` 미사용)

단계 전환 시 주요 액션 버튼으로 포커스를 이동한다. native `autoFocus` 속성 대신 **`ref` + `useEffect`의 빈 deps mount-effect에서 `ref.current?.focus()`** 패턴을 채택한다.

근거:
- `jsx-a11y/no-autofocus` lint 규칙을 회피한다.
- 테스트 가능 — `expect(button).toHaveFocus()`로 회귀 검증이 가능하다.
- QuizFeedback/QuizResult는 단계 전환 시 **fresh mount**되므로, 의존성 배열 없이 마운트 1회만 실행하는 빈 deps mount-effect로 충분하다(재마운트마다 자동 재실행).

### D2. aria-live / 접근 이름 보강

- **QuizPlay Progress**: `aria-label`("퀴즈 진행률") + `aria-valuetext`를 보강하고, **`aria-valuenow={percent}`를 명시 노출**한다. Radix Progress는 통상 `role="progressbar"`/`aria-valuenow`를 자동 제공하지만, **로컬 `progress.tsx` 래퍼가 `value`를 `ProgressPrimitive.Root`에 전달하지 않고 스타일에만 써서** Radix `aria-valuenow`가 `undefined`로 비어 있었다(Critic R2 P2). QuizPlay에서 `aria-valuenow`를 명시 전달하면 Radix가 user props를 마지막에 spread하므로 override되어 값이 노출된다. 중복 `role` 부여는 하지 않는다. 공통 `progress.tsx` 자체는 미수정(스코프 규율) — 래퍼 전역 수정은 후속 이월.
- **QuizResult 신기록 공지**: 시각 점수/배지를 감싸던 `role="status"` 래퍼를 제거해 **시각 콘텐츠는 순수 시각 요소로 환원**하고, 공지는 **전용 `sr-only` `role="status"` `aria-live="polite"` div를 빈 채로 먼저 마운트한 뒤 `useEffect`로 공지 문장을 주입**한다(Critic R1 P2). 라이브 영역이 마운트 시 이미 채워진 채로 DOM에 삽입되면 스크린리더가 공지를 놓칠 수 있으므로, **"먼저 빈 영역으로 존재 → 이후 텍스트 변경"** 정석을 따라 공지 안정성을 확보한다.

### D3. 절제 — 신규 토큰 0 · 신규 컴포넌트 0 · radiogroup 비격상

신규 디자인 토큰 0, 신규 컴포넌트 0, 신규 i18n 키는 **3건**(`play.progressAria` / `result.announceDone` / `result.announceNewBest`)만 추가한다. 선택 pill(분야·난이도)은 `button`+`aria-pressed`를 유지하고 **radiogroup으로 격상하지 않는다** — 이미 WCAG를 충족하므로, 격상은 키보드 화살표 내비게이션/roving tabindex 도입에 따른 회귀 위험만 키운다. 시각 개편(221)의 후속으로 a11y만 심화하는 범위를 지킨다.

## 구현

### 산출물 (Wave 순서)

총 6 atomic commit (start `68740f2`):

| Wave | 에이전트 | 커밋 | 내용 |
|---|---|---|---|
| W1 | Scribe | `2887859` | QuizFeedback/QuizResult 단계 전환 시 주요 액션 버튼 포커스 이동 — `ref`+mount `useEffect focus()` |
| W2 | Scribe | `7d628a6` | QuizPlay Progress `aria-label`("퀴즈 진행률")+`aria-valuetext`, QuizResult 신기록 라이브 영역(초기 구현), i18n `play.progressAria`(ko "퀴즈 진행률"/en "Quiz progress") |
| W3 | Herald | `cfab61d` | 회귀 테스트 +5 + 소스 2파일 `istanbul ignore`(ref null 단락 분기 도달 불가, `CodePanel.tsx` 선례)로 브랜치 100% 복원 |
| W4 | Librarian | `990ff89` | ADR sprint-222 KR+EN + `docs/adr/README.md` 인덱스 159→160 |
| P2-1 | Scribe (Critic R1) | `5163fdc` | QuizResult 신기록 라이브 영역 **sr-only 정석화** — 시각 콘텐츠 감싸던 `role="status"` 래퍼 제거→순수 시각 환원, 전용 `sr-only role="status" aria-live="polite"` div를 빈 채로 먼저 마운트 후 `useEffect`로 공지 문장 주입("존재 후 변경"). i18n `result.announceDone`/`result.announceNewBest` 2키 추가. 테스트 2건 async(`waitFor`) 교체 |
| P2-2 | Scribe (Critic R2) | `93ca2a7` | QuizPlay progressbar **`aria-valuenow={percent}`** 명시 노출 — 로컬 래퍼 `progress.tsx`가 `value`를 삼켜 Radix `aria-valuenow`가 `undefined`였던 갭을 QuizPlay에서 직접 전달로 보정(Radix가 user props 마지막 spread → override). 공통 `progress.tsx` 미수정(스코프 규율), 래퍼 전역 수정은 후속 이월. 테스트 `aria-valuenow='33'` 단언 추가 |

### 변경 상세

- **QuizFeedback / QuizResult (W1 `2887859`)**: 주요 액션 버튼에 `ref`를 달고, 빈 deps `useEffect`에서 `ref.current?.focus()`를 호출한다. 단계 전환 시 컴포넌트가 fresh mount되므로 마운트마다 포커스가 액션 버튼으로 자동 이동한다.
- **QuizPlay (W2 `7d628a6` → P2-2 `93ca2a7`)**: Progress에 `aria-label`(i18n `play.progressAria`)과 `aria-valuetext`를 보강한다. 로컬 래퍼 `progress.tsx`가 `value`를 `Root`에 전달하지 않아 Radix `aria-valuenow`가 비어 있던 갭을, QuizPlay에서 `aria-valuenow={percent}`를 명시 전달해 보정한다(`93ca2a7`).
- **QuizResult (W2 `7d628a6` → P2-1 `5163fdc`)**: 초기 구현은 시각 콘텐츠를 `role="status"` div로 감쌌으나, Critic R1 P2 반영으로 시각 콘텐츠는 순수 시각 요소로 환원하고 신기록/완료 공지는 전용 `sr-only role="status" aria-live="polite"` 영역을 빈 채로 먼저 마운트한 뒤 `useEffect`로 공지 문장을 주입한다(`5163fdc`).
- **i18n (W2 `7d628a6` + P2-1 `5163fdc`)**: 신규 키 **3건** — `play.progressAria`(ko "퀴즈 진행률" / en "Quiz progress"), `result.announceDone`(ko "퀴즈 완료, 정답률 {score}퍼센트입니다." / en "Quiz complete, accuracy {score} percent."), `result.announceNewBest`(ko "퀴즈 완료, 정답률 {score}퍼센트, 최고 기록을 갱신했습니다." / en "Quiz complete, accuracy {score} percent, new best record.").
- **테스트 + 커버리지 복원 (W3 `cfab61d`)**: 회귀 테스트 +5 — QuizFeedback 포커스 2 · QuizResult 포커스+신기록 라이브 영역 2 · QuizPlay progressbar aria 1. `ref`가 null이 되는 단락 분기는 fresh mount에서 도달 불가하므로 소스 2파일에 `istanbul ignore` 주석(`CodePanel.tsx` 선례)을 달아 브랜치 100%를 복원한다. 이후 P2-1에서 QuizResult 라이브 영역 테스트 2건을 async(`waitFor`)로 교체, P2-2에서 progressbar `aria-valuenow='33'` 단언을 추가한다.

## 검증

- **tsc**: 0 errors. **ESLint**(실제 바이너리, `.eslintrc.json`): **0 errors / 483 warnings** — 전부 기존 `forbid-dom-props`/`exhaustive-deps` baseline이며, quiz 디렉토리 3건은 모두 Sprint 221에서 도입한 인라인 `var()` 토큰 참조 선례다. **신규 lint error/warning 0**. (RTK wrapper의 "Errors:1"은 아티팩트로 실제 에러 아님.)
- **jest**: **148 suites / 1510 tests PASS**(1504→1510, +6). quiz 컴포넌트 5종 커버리지 **100/100/100/100**(stmts/branch/funcs/lines). 글로벌 커버리지 lines **87.71%** / branches **79.04%**(게이트 83/71 통과).
- **next build**: ✓. `ƒ /[locale]/quiz` **39.3 kB**(Sprint 221 동일 — a11y는 속성/ref만이라 번들 무증가).
- **ADR 게이트**: index count(sprint **160**, --strict) / adr-en coverage(sprint-222 EN, --strict — 169/169) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **포커스 관리는 단계 전환 a11y의 핵심** — 단계가 바뀌면 키보드 사용자의 포커스가 갈 곳을 명시해야 한다. fresh mount되는 컴포넌트는 빈 deps mount-effect의 `focus()`로 간결하게 해결된다. native `autoFocus`는 lint(`jsx-a11y/no-autofocus`)·테스트(검증 시점 제어 어려움)에 불리하므로 `ref` 패턴이 정석이다.
2. **라이브 영역은 항상 DOM에 존재시키고 내부 텍스트만 조건부로** — 조건부로 라이브 영역(`role="status"`/`aria-live`) 자체를 렌더하면 영역이 DOM에 늦게 삽입돼 스크린리더 공지가 누락될 수 있다. 빈 라이브 영역을 미리 두고 내용만 채우면 공지 타이밍이 안정된다.
3. **헤드리스 컴포넌트(Radix 등)는 role/valuenow를 자동 제공** — Progress의 `role="progressbar"`/`aria-valuenow`는 라이브러리가 채우므로, 우리는 텍스트 라벨(`aria-label`/`aria-valuetext`)만 보강하면 된다. 중복 `role` 부여는 금물.
4. **절제** — 시각 개편(221)의 후속을 신규 토큰·컴포넌트 0으로 a11y만 심화했다. 선택 pill을 radiogroup으로 격상하지 않음으로써(이미 WCAG 충족) 키보드 화살표/roving tabindex 도입에 따른 회귀 위험을 최소화했다.
5. **라이브 영역은 "빈 채로 먼저 마운트 → 이후 텍스트 주입"이어야 안정 공지** — fresh-mount 컴포넌트에서 이미 채워진 채 `role="status"`를 삽입하면 스크린리더가 변경을 감지하지 못해 공지를 놓친다(Critic R1). 전용 `sr-only` 영역을 빈 채로 먼저 두고 `useEffect`로 텍스트를 주입하는 것이 정석이다.
6. **헤드리스 래퍼가 prop을 소비(destructure)하면 그 prop 기반 ARIA가 사라질 수 있다** — `progress.tsx`가 `value`를 스타일에만 쓰고 `Root`에 전달하지 않아 `aria-valuenow`가 누락됐다(Critic R2). 래퍼 추상화가 접근성 속성을 삼키지 않는지 확인해야 한다.

신규패턴: **단계 전환 포커스 이동 패턴** — fresh mount 컴포넌트에서 주요 액션 버튼에 `ref`를 달고 빈 deps `useEffect`로 `focus()`(native `autoFocus` 미사용, lint 회피 + `toHaveFocus` 테스트 가능) + **항상 존재하는 라이브 영역**(`role="status"`/`aria-live`, 내부 텍스트만 조건부)으로 동적 상태를 스크린리더에 안정 공지.

## Sprint 223+ 이월

- **(후속, 선택) 공통 `progress.tsx` 래퍼가 `value`를 `ProgressPrimitive.Root`에 전달하도록 전역 수정** — 현재 앱 내 모든 progressbar가 `aria-valuenow` 미노출인 잠재 a11y 갭. 이번 스프린트는 quiz 로컬만 보정(스코프 규율).
- radiogroup 격상(선택) — 분야·난이도 pill을 radiogroup + roving tabindex로 격상.
- 모션 심화(선택).
- **(운영 실행) SP217 컷오버 — `sp217-quiz-records-cutover.md` 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 검증** (사용자/운영, 중요).
- 라이브 `/quiz` UI 개편(Sprint 221) 육안 확인(라이트/다크 분야 색·아이콘·애니메이션) — 재배포 후.
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

- **도구**: Codex codex-cli 0.130.0, `codex review --base 68740f2 -c model=gpt-5.5`
- **라운드**: 3

**R1 — [P2]**: QuizResult 라이브 영역이 mount 시 이미 채워진 채 DOM에 삽입돼 신기록 공지 누락 위험 → `5163fdc`로 sr-only 빈 영역 선마운트 + `useEffect` 주입 정석화로 해소.

**R2 — [P2]**: 원 P2 해소 확인. 새 [P2] — QuizPlay progressbar가 `aria-valuenow`를 미노출(로컬 래퍼 `progress.tsx`가 `value`를 `Root`에 미전달) → `93ca2a7`로 `aria-valuenow` 명시 노출하여 해소.

**R3 — 런타임 코드 CLEAN**: *"changes appear consistent and should not break existing behavior."* [P3] 비차단 — ADR i18n 키 수 부정확(키 1→3) 지적 → 본 최종화 커밋으로 정정.

**종합 판정**: ✅ 머지 가능 — 코드 Critical/High 0, P2 2건 전부 수정 반영, R3 런타임 CLEAN, P3 ADR 정정 완료.
