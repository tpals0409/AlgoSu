---
sprint: 221
title: "quiz UI 개편 (본격 개편) — 분야 accent 토큰 + 3화면 재설계"
date: "2026-06-06"
status: completed
agents: [Oracle, Palette, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "design-tokens", "quiz", "accessibility"]
tldr: "Sprint 215~219로 기능 완성된 CS 퀴즈(/quiz)의 시작·진행·결과 3화면 UI를 디자인 토큰 기반으로 본격 개편한 프론트엔드 전용 스프린트. 분야별(DS/Algo/Network/OS/DB) 전용 accent 색상 토큰 --quiz-cat-*를 globals.css :root+.dark 양쪽 20개 신규 등록(전 색 WCAG AA 4.5:1+ 실측 — light 4.95~6.05, dark 7.03~10.59)하고, 신규 data/quiz/category-meta.ts SSOT에 분야→{lucide 아이콘, 색상 토큰 var()} 매핑을 모아 5개 컴포넌트가 일관 소비한다. 핵심 절제 결정 3가지: 난이도(EASY/MEDIUM/HARD)는 신규 토큰을 만들지 않고 기존 semantic(success/warning/error) 재사용 → 토큰 0 추가; 신규 components/ui/ 컴포넌트 0(기존 Card/Button/Badge/Progress/Input/ScoreGauge + 인라인 var() 조합); 신규 keyframe 0(기존 fade-in/glow-pulse 재사용). 분야 색은 --diff-*/--lang-* 선례대로 @theme 매핑 없이 raw CSS 변수로 두고 인라인 style var()로 소비(bg-[#...] 하드코딩 금지 준수, react/forbid-dom-props warn은 선례 허용). 분야 pill·진행 칩 아이콘은 전부 aria-hidden으로 accessible name 보존 → getByRole(name) 회귀 0. 테스트 1498→1504(+6), quiz 컴포넌트 5종+category-meta 100/100/100/100, 글로벌 lines 87.67%/branches 79.02%(게이트 83/71). Critic R1 CLEAN(0건). 코드/스키마는 라이브 무관(merge≠라이브, 별도 운영 이월)."
---
# Sprint 221 — quiz UI 개편 (본격 개편)

## 목표

- Sprint 215~219로 **기능 완성·검증**된 CS 퀴즈(`/quiz`)의 **시작·진행·결과 3화면 UI를 디자인 토큰 기반으로 본격 재설계**한다.
- 사용자 확정 범위: (1) 3화면 전체 개편, (2) **분야별(DS/Algo/Network/OS/DB) 전용 accent 색상 토큰 신규 도입 + lucide 아이콘 매핑**.
- 프론트엔드 전용 — 데이터/스키마/백엔드 무변경. `/quiz` 라우트는 인증 게이트이므로 라이브 검증은 별도 운영 이월(merge ≠ 라이브).

## 배경

215(미니게임 코어)·216(150문항+난이도 필터 UX)·217(로그인 기록 서버 영속화)·218(회귀 안전망)·219(lint 정리)로 퀴즈는 **기능적으로 완성**됐으나, UI는 기능 구현 위주라 시각적으로 평이했다 — 분야·난이도 선택이 단색 텍스트 pill, 결과 화면이 게이지+텍스트로 밋밋, AlgoSu UI v2(분야/난이도 시각 구분·glassmorphism·애니메이션)를 충분히 활용하지 못했다. 본 스프린트는 토큰 등록 규율(**Palette 확정 → Herald 등록 → 소비**)을 지키며 3화면을 개편한다.

## 결정

### D1. 분야 색상 = 신규 raw CSS 변수 토큰 (`@theme` 매핑 없음)

분야 5종 accent를 `--quiz-cat-{slug}-color`/`-bg`로 `globals.css` `:root`(light)+`.dark`(dark) 양쪽 등록(20개). `--diff-*`·`--lang-*` 선례대로 **`@theme inline` Tailwind 매핑은 생략**하고 raw CSS 변수로만 둔다 — categorical 다값 색은 Tailwind 유틸 클래스가 아니라 인라인 `style={{ color: 'var(--quiz-cat-*-color)' }}`로 소비한다(`DifficultyBadge` 패턴). 이로써 `bg-[#...]` 하드코딩 금지 규율을 지키면서 라이트/다크 자동 전환을 얻는다.

색상·WCAG AA(텍스트 대비 4.5:1+) 실측:

| 분야 | Light(on #FAFAF8) | Dark(on #0F0F12) | 아이콘 |
|---|---|---|---|
| DATA_STRUCTURE | `#2563EB` (4.95:1) | `#60A5FA` (7.53:1) | `Boxes` |
| ALGORITHM | `#7C3AED` (5.45:1) | `#A78BFA` (7.03:1) | `GitBranch` |
| NETWORK | `#0E7490` (5.13:1) | `#22D3EE` (10.59:1) | `Network` |
| OS | `#A21CAF` (6.05:1) | `#E879F9` (7.78:1) | `Cpu` |
| DATABASE | `#047857` (5.25:1) | `#34D399` (9.95:1) | `Database` |

soft bg는 base 색의 light 0.10 / dark 0.14 opacity. 난이도 semantic(success/warning/error)과 hue가 겹치지 않게 blue/violet/cyan/fuchsia/emerald 5색으로 분산.

### D2. 난이도 색상 = 기존 semantic 재사용 (신규 토큰 0)

난이도 EASY/MEDIUM/HARD는 신규 토큰을 만들지 않고 **기존 semantic 토큰을 재사용**한다: EASY→`success`, MEDIUM→`warning`, HARD→`error`, ALL→`primary`(중립). 근거: 이미 light/dark + WCAG 검증된 토큰이고 의미 매핑이 직관적이며, 토큰 sprawl을 막는다. 이 결정으로 난이도용 Palette wave 자체가 불필요해졌다.

### D3. 신규 ui 컴포넌트 0 · 신규 keyframe 0

기존 `Card/Button/Badge/Progress/Input/ScoreGauge` + 인라인 `var()` 조합으로 3화면을 모두 커버 → `components/ui/` 신규 생성 트리거(Palette UI 가이드) 회피. 애니메이션도 기존 `.animate-fade-in`·`@keyframes glow-pulse`(인라인 `style={{ animation: 'glow-pulse ...' }}` 선례) 재사용 → 신규 keyframe 0. `prefers-reduced-motion`은 globals.css 전역 미디어쿼리가 이미 모든 CSS 애니메이션을 무력화하므로 추가 가드 불필요.

## 구현

### 산출물 (Wave 순서)

| Wave | 에이전트 | 파일 | 내용 |
|---|---|---|---|
| W0 | Palette | (가이드) | 분야 5색 확정 + WCAG AA 실측 |
| W1 | Herald | `frontend/src/app/globals.css` | `--quiz-cat-*` 토큰 20개 등록(light 10 + dark 10) |
| W2 | Scribe | `frontend/src/data/quiz/category-meta.ts`(신규) | 분야→{lucide 아이콘, colorVar, bgVar} SSOT + `index.ts` 재노출 |
| W2 | Scribe | `frontend/src/components/quiz/{QuizStart,QuizPlay,QuizQuestion,QuizFeedback,QuizResult}.tsx` | 3화면 재설계 |
| W3 | Scribe | `__tests__/{QuizStart,QuizPlay}.test.tsx`, `data/quiz/__tests__/category-meta.test.ts`(신규) | 회귀 테스트 +6 |
| W4 | Librarian | `docs/adr/sprints/sprint-221.md`(본 문서) + EN + `docs/adr/README.md` | ADR + 인덱스 158→159 |

### 컴포넌트별 변경

- **category-meta.ts (신규 SSOT)**: `QUIZ_CATEGORY_META: Record<QuizCategory, { icon, colorVar, bgVar }>` + `getQuizCategoryMeta()`. 색상은 `var(--quiz-cat-*)` 문자열(하드코딩 hex 0). 아이콘 `Boxes/GitBranch/Network/Cpu/Database`.
- **QuizStart**: 분야 pill에 아이콘(**aria-hidden**)+선택 시 accent 색(인라인 `style` var: color/bg/border), 난이도 pill을 semantic 톤(`DIFFICULTY_TONE` 정적 클래스 맵), 헤더 아이콘 칩, 카드 `animate-fade-in`. `resolveCountOptions` 로직 불변.
- **QuizPlay**: 진행 헤더에 분야 칩(아이콘 aria-hidden + accent 색), `animate-fade-in`. Progress 바는 primary 유지(ui 미수정).
- **QuizQuestion**: 프롬프트를 카드(`bg-bg-alt` 보더)로 강화. 폼 제출/autoFocus/빈입력 무시 로직 불변.
- **QuizFeedback**: 정답/오답에 따라 컨테이너 톤(`success-soft`/`error-soft` + 좌측 4px accent 보더), `animate-fade-in`. `role="status"`·아이콘·Badge·해설 박스 구조 유지.
- **QuizResult**: 신기록 시 `Trophy` 배지 + 게이지 래퍼 `glow-pulse` 축하 연출(인라인 style), `animate-fade-in`. ScoreGauge·정답수·best score 텍스트 유지.

## 검증

- **tsc**: 0 errors. **next lint**: 0 errors(인라인 `var()` style `react/forbid-dom-props` warn 3건은 `DifficultyBadge` 등 기존 459건 선례와 동일 — `next lint`는 warn에 비실패, CI 동일).
- **test:coverage**: 148 suites / **1504 tests** PASS(1498→+6). 글로벌 lines **87.67%** / branches **79.02%**(게이트 83/71). quiz 컴포넌트 5종 + `category-meta.ts` **100/100/100/100**.
- **next build**: ✓. `ƒ /[locale]/quiz` **39.3 kB**(217 기준 37.5kB → +1.8kB, lucide 6아이콘+메타).
- **ADR 게이트**: index count(sprint 159, --strict) / adr-en coverage(sprint-221 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **categorical 다값 색은 raw CSS 변수 + 인라인 `var()`가 정석** — Tailwind `@theme` 매핑은 단일 의미 토큰(primary/success)용이고, 분야/언어/난이도처럼 N개로 늘어나는 색군은 `--diff-*`/`--lang-*` 선례대로 raw 변수로 두고 인라인 `style`로 소비한다. `react/forbid-dom-props` warn은 이 경우 의도된 예외(하드코딩 hex가 아니라 토큰 참조)다.
2. **절제가 곧 설계 품질** — 난이도 색을 신규 토큰 대신 semantic 재사용, 신규 ui 컴포넌트 0, 신규 keyframe 0. "본격 개편"이라도 기존 자산으로 목표를 달성하면 토큰/컴포넌트/애니메이션 sprawl과 Palette UI-가이드 트리거를 피한다. 추가가 아니라 재조합으로 푼다.
3. **장식 요소는 전부 `aria-hidden`** — pill·칩에 아이콘을 넣을 때 accessible name이 오염되면 `getByRole('button', { name })` 테스트가 전부 깨진다. lucide 아이콘에 `aria-hidden`을 강제해 라벨 텍스트만 name에 남기면 시각 강화와 회귀 0을 동시에 얻는다.
4. **SSOT 한 곳에 아이콘+색을 묶으면 소비처가 단순해진다** — `category-meta.ts`가 분야→{아이콘, 색 토큰}을 한 번 정의하니 QuizStart(pill)·QuizPlay(칩)가 같은 매핑을 `getQuizCategoryMeta(category)`로 일관 소비하고, 분야 추가 시 한 곳만 고치면 된다.

신규패턴: **분야 categorical accent 토큰 패턴** — `--quiz-cat-{slug}-color/-bg`(raw var, @theme 미매핑) + `category-meta.ts` SSOT(아이콘+토큰) + 인라인 `var()` 소비 + 장식 아이콘 `aria-hidden`. (`--diff-*`/`DifficultyBadge` 선례의 quiz 도메인 적용.)

## Sprint 222+ 이월

- **(운영 실행) SP217 컷오버 — `sp217-quiz-records-cutover.md` 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 검증** (사용자/운영, 중요).
- 라이브 `/quiz` UI 개편 육안 확인(라이트/다크 분야 색·아이콘·애니메이션) — 재배포 후.
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

- **대상**: `frontend/` 11파일 (base `6c2c128`..HEAD, 코드+테스트)
- **Codex 명령**: `codex review --base 6c2c128 -c model=gpt-5.5`
- **세션 ID**: `019e9bf6-e285-79a3-84d8-55f3d73a626b`

**R1 — Critical/High/Medium/Low 0건 (CLEAN)**: *"The changes are UI-focused and the new category metadata mapping is consistently wired into the quiz components with corresponding tokens and tests. I did not identify any discrete correctness, accessibility, or build-breaking issue introduced by the patch."*

**종합 판정**: ✅ 머지 가능 — 단일 라운드 CLEAN. UI 개편 + 메타 매핑이 토큰·테스트와 일관 연결, 접근성/빌드 회귀 없음.
