---
sprint: 224
title: "quiz UX 심화 (radiogroup 격상 + 분야별 통계 시각화 + 전환 모션)"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222", "sprint-223", "sprint-217"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "Sprint 221~223으로 시각·a11y가 정석화된 CS 퀴즈(/quiz)의 추가 UX를 3개 독립 Wave로 심화한 프론트엔드 전용 스프린트. (Wave A) QuizStart의 분야·난이도·문항 수 3개 단일 선택 그룹을 button+aria-pressed에서 ARIA radiogroup 패턴(role=radiogroup/radio + aria-checked + roving tabindex + 화살표/Home/End 키)으로 격상 — 공유 패턴을 quiz 로컬 헬퍼 PillRadioGroup으로 추출, 기존 active 스타일 유지로 시각 무변경(Sprint 222 명시 이월). (Wave B) 시작 화면 하단에 분야별 최고 정답률을 accent 색 막대로 요약하는 '내 기록' 영역(QuizStats) 추가 — page.tsx가 idle 진입 시 store.getAllBest()를 aggregateCategoryBests(순수 함수)로 집계해 stats prop 전달, 로그인=API/게스트=local 자동 분기, api-store에 in-flight 디듀프 추가. (Wave C) 문항/피드백 전환에 기존 fadeInUp keyframe 재사용 유틸(.animate-fade-in-up)만 추가해 등장 모션 적용(신규 keyframe 0, reduced-motion 전역 무력화 존중). 신규 디자인 토큰 0·신규 components/ui 0·신규 i18n 키 2건(stats.title/scoreAria, ko+en). Critic 3라운드(R1 P2×2·R2 P2×1 → R3 CLEAN): 통계 키 프로토타입 매칭 차단 + 통계 GET을 merge-up 완료 게이트(인증 한정)로 막아 stale 표시·캐시 폴루션 제거. merge≠라이브(별도 운영 이월)."
---
# Sprint 224 — quiz UX 심화

## 목표

- Sprint 221~223으로 시각·접근성이 완성된 CS 퀴즈(`/quiz`)의 추가 UX를 심화한다.
- 사용자 확정 범위: **3개 영역 모두** — (A) 분야·난이도 pill의 radiogroup 격상, (B) 분야별 통계 시각화, (C) 전환 모션 심화.
- 프론트엔드 전용 — 데이터/스키마/백엔드 무변경. 신규 디자인 토큰·신규 `components/ui` 0. 회귀 테스트 동반, 커버리지 게이트(83/71) 유지. `/quiz`는 인증 게이트이므로 라이브 검증은 별도 운영 이월(merge ≠ 라이브).

## 배경

Sprint 222(D1)는 QuizStart의 분야·난이도 pill을 `button` + `aria-pressed`로 유지하고 radiogroup 격상은 회귀 위험 최소화 차원에서 후속으로 이월했다. Sprint 223은 공통 progress 래퍼의 a11y 갭을 정석화했다. 본 스프린트는 그 이월 항목(radiogroup)을 소화하고, 사용자 요청으로 통계 시각화·모션을 함께 심화한다.

## 결정

### Wave A — radiogroup 격상

- **D-A1**: 3개 단일 선택 그룹(분야·난이도·문항 수)을 ARIA radiogroup 패턴으로 격상. 컨테이너 `role="radiogroup"` + `aria-labelledby`(`useId` 라벨 연결), 각 pill `role="radio"` + `aria-checked`(`aria-pressed` 제거), **roving tabindex**(선택 항목만 `tabIndex=0`, 나머지 `-1`), 키보드 `←/→/↑/↓` 순환 이동 + 선택, `Home`/`End`.
- **D-A2**: 3곳이 공유하는 패턴을 quiz **로컬** 헬퍼 컴포넌트 `PillRadioGroup`(`components/quiz/`)로 추출 — `components/ui/`가 아니므로 Palette UI 가이드 트리거 회피. 시각 스타일(accent/semantic)은 소비처가 `className`/`style` 콜백으로 주입 → **시각 무변경**, 신규 토큰/keyframe 0.

### Wave B — 통계 시각화

- **D-B1**: 시작 화면(idle) 하단에 분야별 최고 정답률을 accent 색 막대로 요약하는 "내 기록" 영역(`QuizStats`, quiz 로컬). 막대는 `role="progressbar"`(aria-valuenow/min/max) + 분야별 `aria-label`, accent 색은 `var()` 토큰 인라인.
- **D-B2**: 집계는 순수 함수 `aggregateCategoryBests`(`lib/quiz/stats.ts`) — `getAllBest()`의 `${category}::${difficulty}` 복합 키를 분야 단위로 접어 난이도 across 최고 점수 산출, 점수 내림차순 정렬, 미등록/손상 키 무시. `page.tsx`가 idle 진입 시 조회해 `QuizStart`에 `stats` prop 전달(로그인=API/게스트=local 자동 분기). 기록 없으면 영역 미표시.
- **D-B3**: `api-store` `fetchAllBest`에 **in-flight 디듀프** 추가 — 시작 화면 통계 GET과 `getBest` GET이 동시 발생해도 서버 요청을 1회로 합친다.

### Wave C — 모션 심화

- **D-C1**: 문항(`QuizQuestion`)·채점 피드백(`QuizFeedback`) 전환에 살짝 위로 슬라이드되는 등장 모션 적용. **기존 `fadeInUp` keyframe을 재사용**하는 `.animate-fade-in-up` 유틸 클래스만 추가(신규 keyframe 0). `reduced-motion` 전역 미디어쿼리가 모션을 무력화하므로 접근성 안전.

### 절제

- 신규 디자인 토큰 0 · 신규 `components/ui` 0(전부 quiz 로컬) · 신규 keyframe 0 · 신규 i18n 키 2건(`stats.title`/`stats.scoreAria`, ko+en).

## 구현

### 산출물 (Wave 순서)

총 6 atomic commit (start `bdd989f`):

| Wave | 에이전트 | 커밋 | 내용 |
|---|---|---|---|
| A | Herald | `303b874` | `PillRadioGroup`(신규) + `QuizStart` 3그룹 radiogroup 격상 + `QuizStart.test` radio 시맨틱·roving tabindex·화살표 네비 회귀(13→16) |
| A 후속 | Herald | `933cf9f` | `PillRadioGroup` `moveTo` focus 옵셔널 체이닝 null 분기 `istanbul ignore`(ref always attached 관례) — branch 100% |
| B | Scribe | `25a4ea8` | `stats.ts`(집계 순수 함수)·`QuizStats`(신규)·`api-store` in-flight 디듀프·`page.tsx` idle 통계 조회·`QuizStart` stats prop·i18n 2키·테스트(stats +6, QuizStats +6, api-store +1, page 인증 경로 통계 GET 반영) |
| C | Herald | `5275bdd` | `globals.css` `.animate-fade-in-up`(fadeInUp 재사용)·`QuizQuestion`/`QuizFeedback` 전환 모션 |
| Critic R1 | Herald | `7b24be5` | [P2×2] `stats.ts` 분야 키 검사 `in`→own-key(프로토타입 키 차단)+회귀 테스트 / `page.tsx` 통계 GET을 merge-up 완료 게이트로 차단 |
| Critic R2 | Herald | `48a8a32` | [P2] 통계 게이트를 **인증 사용자 한정**(`isAuthenticated && !mergeUpDone`)으로 재설계 — 게스트→로그인 전환 시 조기 GET 차단(effect 스냅샷 안전) |

### 변경 상세

- **`PillRadioGroup.tsx` (신규, Wave A)**: 제네릭 단일 선택 pill 그룹. `role=radiogroup`/`radio` + `aria-checked` + roving tabindex + 화살표/Home/End 키 핸들링. 스타일은 소비처 콜백 주입.
- **`QuizStart.tsx` (Wave A·B)**: 3개 `<fieldset>` 수동 pill → `PillRadioGroup` 3개로 교체(시각 무변경). `stats` prop 수신 → `<QuizStats>` 렌더.
- **`stats.ts` (신규, Wave B)**: `aggregateCategoryBests` — 복합 키 → 분야별 최고 점수. own-key 검사로 손상 키 차단(Critic R1).
- **`QuizStats.tsx` (신규, Wave B)**: 분야 accent 막대 요약. 빈 배열이면 `null` 반환(부모 미표시).
- **`api-store.ts` (Wave B)**: `fetchAllBest` in-flight 디듀프(동시 GET 1회로 합침).
- **`page.tsx` (Wave B·Critic)**: idle 통계 조회 effect. 인증 사용자는 merge-up 완료(`mergeUpDone`) 게이트 후에만 조회(Critic R1/R2) — 게스트는 게이트 미적용으로 전환 안전.
- **모션 (Wave C)**: `.animate-fade-in-up` 유틸(globals.css) + `QuizQuestion`/`QuizFeedback` 적용.

## 검증

- **tsc**: 0 errors.
- **ESLint**(실제 `next lint` 바이너리): **0 errors / 487 warnings**(Sprint 222 483 → +4, 전부 `react/forbid-dom-props` — accent `var()` 토큰 인라인 style, DifficultyBadge 등 459건 기존 선례와 동일한 의도된 예외).
- **jest**: **1533 tests PASS**(Sprint 223 1514 → +19). quiz 컴포넌트·lib **100/100/100/100**(`PillRadioGroup`·`QuizStats`·`QuizStart`·`stats.ts`·`api-store` 전부). 글로벌 lines **88.01%**/branches **79.31%**(게이트 83/71).
- **next build**: ✓. `/[locale]/quiz` **40.2 kB**(Sprint 223 39.4 → +0.8 — QuizStats·PillRadioGroup·모션).
- **ADR 게이트**: index count(sprint **162**, --strict) / adr-en coverage(sprint-224 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **단일 선택 그룹의 radiogroup 격상은 공유 헬퍼로 추출하면 시각 무변경·회귀 최소화가 동시에 된다** — 3곳 반복 패턴을 `PillRadioGroup`로 모아 a11y(roving tabindex·화살표 키)를 한 번만 구현하고, 스타일은 콜백 주입으로 기존 active 톤을 그대로 유지했다. `components/ui`가 아닌 도메인 로컬(`components/quiz`)에 두어 Palette UI-가이드 트리거도 회피.
2. **미검증 저장소 키는 `in`이 아니라 own-key 검사로 화이트리스트해야 한다**(Critic R1) — `categoryStr in META`는 프로토타입 상속 키(`toString`·`__proto__`)까지 매칭해, 손상된 localStorage 키가 유효 분야로 통과한 뒤 메타 역참조에서 크래시한다. `Object.prototype.hasOwnProperty.call`로 own-key만 인정.
3. **백그라운드 동기화(merge-up)와 동시 조회는 게이트로 직렬화해야 stale 표시·캐시 폴루션이 없다**(Critic R1) — 통계 GET이 merge-up POST와 병렬 실행되면 병합 전 서버 상태를 읽어 표시하고, in-flight GET이 무효화된 캐시를 stale 값으로 재채울 수 있다. merge-up 완료 후에만 통계를 조회하도록 게이트.
4. **React effect 게이트는 "스냅샷"이라 같은 커밋 내 setState 리셋으로는 못 막는다**(Critic R2) — 전환 커밋에서 `setGate(false)`를 호출해도 그 커밋의 다른 effect는 이전 렌더의 게이트 값을 본다. 해결책은 리셋이 아니라 **게이트 조건을 게스트가 절대 열지 않도록 설계**하는 것 — `isAuthenticated && !mergeUpDone`로만 적용하면 게스트 동안 게이트는 계속 닫힌 상태(false)라 전환 직후에도 안전하다.
5. **동시 캐시 조회는 in-flight 디듀프로 1회 요청으로 합친다** — 시작 화면 통계 GET과 `getBest` GET이 캐시 미스 상태에서 동시 발생하면 중복 GET이 난다. `fetchAllBest`가 진행 중 프로미스를 공유하면 동시 호출이 단일 네트워크 요청으로 수렴한다.

신규패턴:
- **PillRadioGroup 패턴** — 제네릭 단일 선택 pill 그룹의 radiogroup + roving tabindex + 화살표 키 헬퍼(도메인 로컬, 스타일 콜백 주입).
- **merge-up 게이트(인증 한정) 패턴** — 백그라운드 동기화 완료 전 조회를 막되, 게이트 조건을 인증 사용자에만 적용해 전환 스냅샷 안전을 확보.

## Sprint 225+ 이월

- **(운영 실행) 재배포 후 라이브 `/quiz` 검증** — UI 개편(221)·a11y(222/223)·**UX 심화(224: radiogroup 키보드 네비·통계 막대·전환 모션)** 육안/스크린리더 확인. 같은 frontend 롤아웃으로 일괄 처리(merge ≠ 라이브).
- **(운영 실행) SP217 컷오버** — `sp217-quiz-records-cutover.md` 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 (사용자/운영, 중요).
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

- **도구**: Codex codex-cli 0.130.0, `codex review --base bdd989f -c model=gpt-5.5`
- **라운드**: 3

**R1 — Critical/High 0 · [P2] 2건**:
- [P2] `stats.ts:44` — `categoryStr in QUIZ_CATEGORY_META`가 프로토타입 상속 키(`toString::ALL`·`__proto__::ALL`)까지 매칭 → 손상 키가 유효 분야로 통과해 `getQuizCategoryMeta` undefined 역참조 위험. → `7b24be5` own-key 검사로 교체 + 회귀 테스트.
- [P2] `page.tsx:113-114` — 인증 사용자의 통계 GET이 merge-up POST와 병렬 실행돼 stale 표시·캐시 폴루션. → `7b24be5` merge-up 완료 게이트로 차단.

**R2 — 원 P2 2건 해소 확인 · 새 [P2] 1건**:
- [P2] `page.tsx:83-85` — 게스트→로그인 전환 시 게이트가 열린 채 남아 조기 GET 가능. → `48a8a32` 게이트를 인증 사용자 한정(`isAuthenticated && !mergeUpDone`)으로 재설계해 전환 스냅샷 안전 확보.

**R3 — CLEAN** (P-finding 0): *"I did not identify any discrete, introduced issues that would break existing behavior or tests. The new stats aggregation/display and API in-flight deduplication appear consistent with the surrounding quiz storage flow."*

**종합 판정**: ✅ 머지 가능 — 3라운드에 걸쳐 P2 3건(통계 키 프로토타입 차단·merge-up 게이트·게이트 인증 한정화) 전부 수정, Critical/High 0, 최종 CLEAN.
