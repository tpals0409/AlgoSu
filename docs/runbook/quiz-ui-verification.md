# CS 퀴즈 `/quiz` UI·접근성·UX 라이브 검증 런북 (Sprint 221~224)

> 대상: Sprint 221~224로 **코드측 완성·검증**된 CS 퀴즈(`/quiz`)의 **UI 개편(221)·접근성(222/223)·UX 심화(224)**를 라이브에서 사람이 육안/스크린리더로 검증한다.
> 작성: Sprint 226 (2026-06-07). 관련 런북: [`sp217-quiz-records-cutover.md`](./sp217-quiz-records-cutover.md) (기록 컷오버 + 기능 E2E 6항목 — 본 런북과 상호 보완).
> 실행 주체: **사용자/운영(ops)** — 라이브 `/quiz`는 로그인 필수(§0.1)이며, 시각·스크린리더 검증은 사람이 수행해야 한다. 본 런북은 실행 가능한 정확한 절차와 기대값(파일:라인 출처 포함)을 제공한다.

---

## 0. 핵심 사실 (먼저 이해할 것)

### 0.1 `/quiz`는 로그인 필수다

`frontend/src/middleware.ts`의 `PUBLIC_PATHS`(26~34행)에 `/quiz`가 **없다**. 미인증 사용자는 `/login?redirect=%2Fquiz`로 리다이렉트된다(98행, HTTP 307).

```text
$ curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://algo-su.com/quiz
307 -> https://algo-su.com/login?redirect=%252Fquiz
```

따라서 **라이브 검증은 로그인된 세션에서만 가능**하다. 비로그인 상태로는 `/quiz` 화면 자체를 볼 수 없다. (컴포넌트 내부에는 게스트/로컬 분기 로직이 있으나 — 만료 토큰 쿠키로 미들웨어만 통과한 경우 — 신규 비로그인 사용자는 라우트 진입 전 차단된다.)

### 0.2 merge ≠ 라이브

frontend 이미지 빌드는 머지 시 자동이지만 **롤아웃은 수동 ops**다. 본 런북은 **221~224가 이미 라이브에 롤아웃된 상태**를 전제로 한다. 롤아웃 전이라면 먼저 frontend를 재배포해야 한다(필요 시 SP217 컷오버 런북의 frontend 롤아웃과 일괄 처리 가능).

### 0.3 검증 매트릭스

각 검증 항목은 다음 축의 조합에서 확인한다:

- **테마**: 라이트 / 다크 (다크 토글 = DevTools에서 `<html>` 요소에 `class="dark"` 토글 — `next-themes` 기반. 다크 변수는 `frontend/src/app/globals.css:256~266` 등에 정의)
- **로케일**: ko (기본, prefix 없음) / en (`/en/quiz`)
- **입력 수단**: 마우스 / 키보드(Tab·화살표·Home·End·Space·Enter) / 스크린리더(VoiceOver(macOS) 또는 NVDA(Windows))

---

## 1. UI 개편 검증 (Sprint 221)

### 1.1 분야별 accent 색 + lucide 아이콘

분야 5종은 각자 전용 accent 색(CSS 변수)과 lucide 아이콘을 가진다.

| 분야(enum) | i18n 라벨(ko) | 아이콘 | 라이트 색 | 다크 색 |
|---|---|---|---|---|
| `DATA_STRUCTURE` | 자료구조 | `Boxes` | `#2563EB` (파랑) | `#60A5FA` |
| `ALGORITHM` | 알고리즘 | `GitBranch` | `#7C3AED` (보라) | `#A78BFA` |
| `NETWORK` | 네트워크 | `Network` | `#0E7490` (청록) | `#22D3EE` |
| `OS` | 운영체제 | `Cpu` | `#A21CAF` (마젠타) | `#E879F9` |
| `DATABASE` | 데이터베이스 | `Database` | `#047857` (초록) | `#34D399` |

- 출처: 색 변수 `frontend/src/app/globals.css:103~113`(라이트), `:256~266`(다크) / 아이콘 매핑 `frontend/src/data/quiz/category-meta.ts:26~50`
- 색은 `--quiz-cat-*-color` / `--quiz-cat-*-bg` 변수를 인라인 `var(...)`로 소비(`--diff-*`/`--lang-*` 선례 — 하드코딩 hex 아님).

**검증**:
- [ ] 시작 화면 분야 pill 5개가 위 표의 색/아이콘으로 표시되는가 (선택 시 해당 분야 색으로 텍스트·테두리·soft 배경 적용)
- [ ] 비선택 pill은 회색 톤(`border-border text-text-3`)인가
- [ ] **다크 모드**에서 색이 우측 열(더 밝은 톤)로 전환되는가
- [ ] 모든 분야 아이콘이 시각 장식이며 스크린리더에 읽히지 않는가(`aria-hidden`)

### 1.2 난이도 색 (semantic 토큰 재사용)

난이도는 신규 색을 만들지 않고 기존 semantic 토큰을 재사용한다(출처: `frontend/src/components/quiz/QuizStart.tsx:33~` `DIFFICULTY_TONE`).

| 난이도 | 토큰 | 색 계열 |
|---|---|---|
| `ALL`(전체) | primary | 보라 |
| `EASY`(쉬움) | success | 초록 |
| `MEDIUM`(보통) | warning | 주황 |
| `HARD`(어려움) | error | 빨강 |

**검증**:
- [ ] 난이도 pill 4개가 위 색으로 표시되는가
- [ ] 문항 수 pill은 primary 톤(보라)인가

### 1.3 3화면 애니메이션

| 화면/요소 | 애니메이션 | 출처 |
|---|---|---|
| 시작 카드 | `animate-fade-in` | `QuizStart.tsx` (카드 래퍼) |
| 진행 카드 | `animate-fade-in` | `QuizPlay.tsx:57` |
| 문항 폼 | `animate-fade-in-up` | `QuizQuestion.tsx:41` |
| 피드백 | `animate-fade-in-up` | `QuizFeedback.tsx:57` |
| 결과 카드 | `animate-fade-in` | `QuizResult.tsx` (카드 래퍼) |
| 신기록 게이지 | `glow-pulse 2.6s ease-in-out infinite` | `QuizResult.tsx:35` |

- keyframe 정의: `frontend/src/app/globals.css:464`(`.animate-fade-in-up`), `:493`(`@keyframes fadeInUp`), `:503`(`@keyframes glow-pulse`)

**검증**:
- [ ] 화면 전환 시 카드가 부드럽게 fade-in 되는가
- [ ] 문항/피드백 진입 시 아래→위 슬라이드(fade-in-up)가 보이는가
- [ ] **신기록 달성 시** 결과 점수 게이지에 glow(맥동) 효과가 보이는가

### 1.4 피드백 정답/오답 톤 + 신기록 Trophy

- 정답: 좌측 테두리 `border-l-success` + `bg-success-soft`(초록), 오답: `border-l-error` + `bg-error-soft`(빨강). 출처: `QuizFeedback.tsx:57~58`
- 신기록 시 `Trophy` 아이콘 배지(success variant). 출처: `QuizResult.tsx:94`

**검증**:
- [ ] 정답 제출 시 초록 톤 피드백, 오답 시 빨강 톤 피드백이 보이는가
- [ ] 신기록 시 결과 화면에 Trophy 배지 + "최고 기록 갱신!" 텍스트가 보이는가

---

## 2. 접근성 검증 (Sprint 222/223)

### 2.1 단계 전환 시 포커스 이동

- 피드백 진입 → "다음 문항"/"결과 보기" 버튼으로 포커스 이동(`QuizFeedback.tsx:45`,`51` — `nextButtonRef` + mount-effect `focus()`)
- 결과 진입 → "다시하기" 버튼으로 포커스 이동(`QuizResult.tsx:52`,`61` — `retryButtonRef`)

**검증**(키보드만 사용):
- [ ] 답 제출 후 피드백이 뜨면 **별도 Tab 없이** 포커스가 "다음 문항" 버튼에 있는가(바로 Enter로 다음 진행 가능)
- [ ] 마지막 문항 후 결과 화면 진입 시 포커스가 "다시하기" 버튼에 있는가

### 2.2 진행률 progressbar 시맨틱

QuizPlay의 진행률 바는 공통 래퍼 `Progress`(`frontend/src/components/ui/progress.tsx`)를 쓴다. Sprint 223에서 래퍼가 `value`를 `ProgressPrimitive.Root`에 전달하도록 정석화 → Radix가 `role="progressbar"` + `aria-valuenow` + `aria-valuemin=0` + `aria-valuemax=100`을 자동 부여한다. QuizPlay는 접근 이름·낭독 텍스트를 보강한다(`QuizPlay.tsx:71~74`):

- `aria-label` = `play.progressAria` → ko "퀴즈 진행률" / en "Quiz progress"
- `aria-valuetext` = `play.progress` → "{current} / {total}" (예: "3 / 10")

**검증**(스크린리더):
- [ ] 진행률 바에 포커스/탐색 시 "진행률바(progressbar)"로 인식되는가
- [ ] 접근 이름 "퀴즈 진행률"과 현재 위치 "N / total"이 낭독되는가
- [ ] `aria-valuenow`가 백분율(예: 30)로 노출되는가

### 2.3 결과 신기록 sr-only 라이브 공지

결과 화면에 전용 `sr-only` 라이브 영역이 항상 마운트되고(빈 문자열로 먼저), useEffect로 공지 문장이 주입된다(`QuizResult.tsx:55`,`61~69`,`80~81`):

```tsx
<div role="status" aria-live="polite" className="sr-only">{announce}</div>
```

- 신기록: `result.announceNewBest` → ko "퀴즈 완료, 정답률 {score}퍼센트, 최고 기록을 갱신했습니다." / en "Quiz complete, accuracy {score} percent, new best record."
- 일반: `result.announceDone` → ko "퀴즈 완료, 정답률 {score}퍼센트입니다." / en "Quiz complete, accuracy {score} percent."

**검증**(스크린리더 켠 상태로 결과 화면 진입):
- [ ] 결과 화면 진입 직후 정답률 공지가 음성으로 재생되는가(시각적으로는 보이지 않음 — sr-only)
- [ ] 신기록일 때 "최고 기록을 갱신했습니다"가 추가로 낭독되는가

---

## 3. UX 심화 검증 (Sprint 224)

### 3.1 PillRadioGroup — radiogroup 키보드 네비게이션

시작 화면의 3개 단일선택 그룹(분야·난이도·문항수)은 `PillRadioGroup`(`frontend/src/components/quiz/PillRadioGroup.tsx`)으로 ARIA radiogroup 격상됐다:

- 구조: `role="radiogroup"` + `aria-labelledby`(108행), 각 옵션 `role="radio"` + `aria-checked` + roving `tabIndex`(118~120행)
- 키보드(80~96행, `moveTo` 61행): `ArrowRight`/`ArrowDown` → 다음, `ArrowLeft`/`ArrowUp` → 이전, `Home` → 첫 항목, `End` → 마지막 항목. 선택 항목만 `tabIndex=0`(나머지 -1).
- 적용 그룹: 분야(`QuizStart.tsx:106`), 난이도(`:129`), 문항 수.

**검증**(키보드):
- [ ] 각 그룹에서 Tab으로 진입 시 **선택된 pill 하나**에만 포커스가 들어오는가(roving tabindex)
- [ ] 화살표 좌/우(또는 상/하)로 옵션 간 이동 + 선택이 동시에 일어나는가
- [ ] `Home`/`End`로 그룹의 첫/마지막 옵션으로 점프되는가
- [ ] (스크린리더) "라디오 그룹", 각 옵션 "선택됨/선택 안 됨"이 낭독되는가

### 3.2 "내 기록" (QuizStats) 분야별 통계 막대

시작 화면 하단에 분야별 최고 정답률 막대가 표시된다(`frontend/src/components/quiz/QuizStats.tsx`). 기록이 없으면 렌더되지 않는다(32행). 집계는 `frontend/src/lib/quiz/stats.ts`의 `aggregateCategoryBests`가 분야별 최고 점수를 **내림차순**으로 정렬.

- 섹션 `aria-label` = `stats.title` → ko "내 기록" / en "Your Records" (37행)
- 각 막대: `role="progressbar"` + `aria-valuenow={bestPercent}` + `aria-valuemin=0`/`aria-valuemax=100` + `aria-label`=`stats.scoreAria`("{category} 최고 정답률 {score}퍼센트") (58~62행)
- 막대 색 = 분야 accent 색, 확장 애니메이션(width transition).

**검증**(로그인=API 기록 / 게스트=로컬 기록):
- [ ] 퀴즈를 1회 이상 푼 뒤 시작 화면에 "내 기록" 섹션이 나타나는가
- [ ] 분야별 막대가 정답률 내림차순으로 정렬되고 분야 색을 쓰는가
- [ ] (스크린리더) 각 막대가 progressbar로 인식되고 "{분야} 최고 정답률 N퍼센트"가 낭독되는가

### 3.3 전환 모션 + reduced-motion

- 문항/피드백 전환에 `animate-fade-in-up` 적용(§1.3).
- `prefers-reduced-motion: reduce` 미디어쿼리가 전역에서 애니메이션을 무력화(`frontend/src/app/globals.css:583`).

**검증**:
- [ ] OS 설정에서 "동작 줄이기(Reduce Motion)"를 켠 뒤 `/quiz` 진입 시 fade/slide/glow 애니메이션이 사라지는가(즉시 표시)

---

## 4. i18n 검증 (ko ↔ en)

`/quiz`(ko) ↔ `/en/quiz`(en) 전환 시 라벨/공지가 번역되는지 확인. 핵심 키(출처: `frontend/messages/ko/quiz.json`, `frontend/messages/en/quiz.json`):

| 키 | ko | en |
|---|---|---|
| `start.categoryLabel` | 분야 선택 | Select Category |
| `start.difficultyLabel` | 난이도 | Difficulty |
| `start.countLabel` | 문항 수 | Questions |
| `play.progressAria` | 퀴즈 진행률 | Quiz progress |
| `stats.title` | 내 기록 | Your Records |
| `result.announceNewBest` | 퀴즈 완료, 정답률 {score}퍼센트, 최고 기록을 갱신했습니다. | Quiz complete, accuracy {score} percent, new best record. |
| `difficulties.EASY` | 쉬움 | Easy |

**검증**:
- [ ] ko/en 전환 시 위 라벨이 모두 번역되는가
- [ ] 분야명/난이도명/결과 공지가 로케일에 맞게 표시되는가

---

## 5. 결과 기록 템플릿

검증 수행 후 아래 표를 채워 PR/이슈/메모리에 기록한다.

| # | 영역 | 항목 | 라이트 | 다크 | ko | en | 비고 |
|---|---|---|---|---|---|---|---|
| 1 | UI(221) | 분야 5색 + 아이콘 (§1.1) | ☐ | ☐ | ☐ | ☐ | |
| 2 | UI(221) | 난이도/문항수 색 (§1.2) | ☐ | ☐ | ☐ | ☐ | |
| 3 | UI(221) | 3화면 애니메이션 (§1.3) | ☐ | ☐ | — | — | |
| 4 | UI(221) | 피드백 톤 + Trophy (§1.4) | ☐ | ☐ | — | — | |
| 5 | a11y(222) | 단계 전환 포커스 (§2.1) | — | — | — | — | 키보드 |
| 6 | a11y(222/223) | progressbar 낭독 (§2.2) | — | — | ☐ | ☐ | 스크린리더 |
| 7 | a11y(222) | 신기록 sr-only 공지 (§2.3) | — | — | ☐ | ☐ | 스크린리더 |
| 8 | UX(224) | radiogroup 키보드 (§3.1) | — | — | — | — | 키보드 |
| 9 | UX(224) | 내 기록 통계 막대 (§3.2) | ☐ | ☐ | ☐ | ☐ | |
| 10 | UX(224) | reduced-motion (§3.3) | ☐ | — | — | — | OS 설정 |
| 11 | i18n | ko↔en 라벨/공지 (§4) | — | — | ☐ | ☐ | |

> 범례: PASS=✅ / FAIL=❌ / N/A=— / 미확인=☐

**발견 이슈 → 후속 시드 양식**:

```
- [영역/§참조] 증상: <무엇이 기대와 다른가> / 재현: <단계> / 기대: <런북 §X 기준> / 실제: <관측>
```

FAIL 항목은 위 양식으로 정리해 다음 스프린트 시드(또는 GitHub 이슈)로 등록한다. 코드 수정이 필요하면 해당 컴포넌트(`frontend/src/components/quiz/*`)를 도메인 에이전트(Herald/Scribe)에 재위임한다.
