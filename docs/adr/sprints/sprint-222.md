---
sprint: 222
title: "quiz 접근성 심화 — 포커스 관리 + aria-live (Sprint 221 시각 개편의 후속)"
date: "2026-06-06"
status: completed
agents: [Oracle, Scribe, Herald, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220", "sprint-221"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "Sprint 215~221로 기능·시각이 완성된 CS 퀴즈(/quiz)의 키보드/스크린리더 접근성을 심화한 프론트엔드 전용 스프린트. 신규 디자인 토큰 0·신규 컴포넌트 0·신규 i18n 키 1건(play.progressAria)만 추가한 순수 a11y 로직 스프린트다. (D1 포커스 관리) 단계 전환 시 주요 액션 버튼으로 포커스를 이동하되, native autoFocus 대신 ref+useEffect focus() 패턴을 채택 — jsx-a11y/no-autofocus 회피 + 테스트 가능(toHaveFocus). QuizFeedback/QuizResult가 단계 전환 시 fresh mount되므로 빈 deps mount-effect로 충분하다. (D2 aria-live/접근 이름) QuizPlay Progress에 aria-label+aria-valuetext 보강(Radix가 role=progressbar/valuenow 자동 제공하므로 텍스트 라벨만), QuizResult 신기록 영역을 항상 DOM에 존재하는 role=status aria-live=polite div로 감쌈(조건부 렌더 아닌 내부 텍스트만 조건부 — 라이브 영역 안정성). (D3 절제) 신규 토큰 0·컴포넌트 0, 선택 pill은 button+aria-pressed 현행 유지(radiogroup 비격상 — 이미 WCAG 충족, 회귀 위험 최소). 회귀 테스트 +5(quiz 32→37), quiz 컴포넌트 5종 100/100/100/100. ref null 단락 분기는 도달 불가라 istanbul ignore(CodePanel.tsx 선례)로 브랜치 100% 복원. 코드는 라이브 무관(merge≠라이브, 별도 운영 이월)."
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

- **QuizPlay Progress**: `aria-label`("퀴즈 진행률") + `aria-valuetext`를 보강한다. Radix Progress가 `role="progressbar"`/`aria-valuenow`를 **자동 제공**하므로, 중복 `role` 부여 없이 텍스트 라벨/값 텍스트만 더한다.
- **QuizResult 신기록 영역**: 신기록 공지를 **항상 DOM에 존재하는** `role="status"` `aria-live="polite"` div로 감싼다. 영역 자체를 조건부 렌더하지 않고 **내부 텍스트만 조건부**로 둔다 — 라이브 영역이 DOM에 늦게 삽입되면 스크린리더가 공지를 놓칠 수 있으므로, 빈 라이브 영역을 미리 두고 내용만 채워 공지 안정성을 확보한다.

### D3. 절제 — 신규 토큰 0 · 신규 컴포넌트 0 · radiogroup 비격상

신규 디자인 토큰 0, 신규 컴포넌트 0, 신규 i18n 키는 `play.progressAria` **1건**만 추가한다. 선택 pill(분야·난이도)은 `button`+`aria-pressed`를 유지하고 **radiogroup으로 격상하지 않는다** — 이미 WCAG를 충족하므로, 격상은 키보드 화살표 내비게이션/roving tabindex 도입에 따른 회귀 위험만 키운다. 시각 개편(221)의 후속으로 a11y만 심화하는 범위를 지킨다.

## 구현

### 산출물 (Wave 순서)

| Wave | 에이전트 | 커밋 | 내용 |
|---|---|---|---|
| W1 | Scribe | `2887859` | QuizFeedback/QuizResult 포커스 이동 — `ref`+mount `useEffect focus()`, 주요 액션 버튼으로 |
| W2 | Scribe | `7d628a6` | QuizPlay Progress `aria-label`("퀴즈 진행률")+`aria-valuetext`, QuizResult 신기록 `role="status"` `aria-live` 영역, i18n `play.progressAria`(ko "퀴즈 진행률"/en "Quiz progress") |
| W3 | Herald | `cfab61d` | 회귀 테스트 +5 + 소스 2파일 `istanbul ignore`(ref null 단락 분기 도달 불가, `CodePanel.tsx` 선례)로 브랜치 100% 복원 |
| W4 | Librarian | (본 commit) | ADR sprint-222 KR+EN + `docs/adr/README.md` 인덱스 159→160 |

### 변경 상세

- **QuizFeedback / QuizResult (W1 `2887859`)**: 주요 액션 버튼에 `ref`를 달고, 빈 deps `useEffect`에서 `ref.current?.focus()`를 호출한다. 단계 전환 시 컴포넌트가 fresh mount되므로 마운트마다 포커스가 액션 버튼으로 자동 이동한다.
- **QuizPlay (W2 `7d628a6`)**: Progress에 `aria-label`(i18n `play.progressAria`)과 `aria-valuetext`를 보강한다. Radix가 제공하는 `role="progressbar"`/`aria-valuenow`는 그대로 두고 텍스트 라벨/값 텍스트만 더한다.
- **QuizResult (W2 `7d628a6`)**: 신기록 공지를 항상 렌더되는 `role="status"` `aria-live="polite"` div로 감싸고, 신기록일 때만 내부 텍스트를 채운다.
- **i18n (W2 `7d628a6`)**: `play.progressAria` 키 신규 — ko "퀴즈 진행률" / en "Quiz progress". 신규 키 1건만.
- **테스트 + 커버리지 복원 (W3 `cfab61d`)**: 회귀 테스트 +5 — QuizFeedback 포커스 2 · QuizResult 포커스+신기록 라이브 영역 2 · QuizPlay progressbar aria 1. `ref`가 null이 되는 단락 분기는 fresh mount에서 도달 불가하므로 소스 2파일에 `istanbul ignore` 주석(`CodePanel.tsx` 선례)을 달아 브랜치 100%를 복원한다.

## 검증

- **tsc**: 0 errors. **next lint**: 기존 대비 신규 error/warning 0건(`QuizResult.tsx`의 `react/forbid-dom-props` warn 1은 Sprint 221에서 도입한 인라인 토큰 참조 선례 — 신규 아님).
- **jest(quiz)**: **6 suites / 37 tests PASS**(32→37, +5). quiz 컴포넌트 5종 커버리지 **100/100/100/100**(stmts/branch/funcs/lines).
- **전역 커버리지 · next build · ADR 게이트**: Oracle 최종 검증.
- **ADR 게이트**: index count(sprint 160, --strict) / adr-en coverage(sprint-222 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **포커스 관리는 단계 전환 a11y의 핵심** — 단계가 바뀌면 키보드 사용자의 포커스가 갈 곳을 명시해야 한다. fresh mount되는 컴포넌트는 빈 deps mount-effect의 `focus()`로 간결하게 해결된다. native `autoFocus`는 lint(`jsx-a11y/no-autofocus`)·테스트(검증 시점 제어 어려움)에 불리하므로 `ref` 패턴이 정석이다.
2. **라이브 영역은 항상 DOM에 존재시키고 내부 텍스트만 조건부로** — 조건부로 라이브 영역(`role="status"`/`aria-live`) 자체를 렌더하면 영역이 DOM에 늦게 삽입돼 스크린리더 공지가 누락될 수 있다. 빈 라이브 영역을 미리 두고 내용만 채우면 공지 타이밍이 안정된다.
3. **헤드리스 컴포넌트(Radix 등)는 role/valuenow를 자동 제공** — Progress의 `role="progressbar"`/`aria-valuenow`는 라이브러리가 채우므로, 우리는 텍스트 라벨(`aria-label`/`aria-valuetext`)만 보강하면 된다. 중복 `role` 부여는 금물.
4. **절제** — 시각 개편(221)의 후속을 신규 토큰·컴포넌트 0으로 a11y만 심화했다. 선택 pill을 radiogroup으로 격상하지 않음으로써(이미 WCAG 충족) 키보드 화살표/roving tabindex 도입에 따른 회귀 위험을 최소화했다.

신규패턴: **단계 전환 포커스 이동 패턴** — fresh mount 컴포넌트에서 주요 액션 버튼에 `ref`를 달고 빈 deps `useEffect`로 `focus()`(native `autoFocus` 미사용, lint 회피 + `toHaveFocus` 테스트 가능) + **항상 존재하는 라이브 영역**(`role="status"`/`aria-live`, 내부 텍스트만 조건부)으로 동적 상태를 스크린리더에 안정 공지.

## Sprint 223+ 이월

- radiogroup 격상(선택) — 분야·난이도 pill을 radiogroup + roving tabindex로 격상.
- 모션 심화(선택).
- **(운영 실행) SP217 컷오버 — `sp217-quiz-records-cutover.md` 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 검증** (사용자/운영, 중요).
- 라이브 `/quiz` UI 개편(Sprint 221) 육안 확인(라이트/다크 분야 색·아이콘·애니메이션) — 재배포 후.
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

Oracle 머지 직전 Critic 수행 예정.
