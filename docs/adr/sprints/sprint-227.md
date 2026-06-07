---
sprint: 227
title: "CS 퀴즈 문항 풀 대폭 확장 + 신규 5분야 + 'ALL'(전체 랜덤) 필터"
date: "2026-06-07"
status: completed
agents: [Oracle, Palette, Curator, Herald, Librarian, Critic]
related_adrs: ["sprint-224", "sprint-217", "sprint-215"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "content", "accessibility", "design-tokens"]
tldr: "CS 퀴즈(/quiz) 문항을 150→350(5분야×30 → 10분야×30+확장)으로 대폭 확장하고 분야 'ALL'(전체 랜덤) 필터를 추가했다. Wave A(인프라): QuizCategory enum 신규 5종 + Palette가 globals.css에 신규 5분야 CSS 변수(WCAG AA 직접 검증) 추가 + category-meta 아이콘/var 매핑. Wave B+C(콘텐츠): 신규 5분야 각 20문항 + 기존 5분야 각 30→50문항(HARD 불균형 보강), 전역 id 유니크 350, 병렬 Curator 10에이전트 산출. Wave D('ALL' 필터): getQuestionsByFilter/getRandomQuestions가 category: 'ALL' 수용, QuizStart PillRadioGroup 'ALL' prepend(신규 토큰 0). Wave E(테스트): +22 tests, 전역 1555 PASS. 교훈: 파일당 1에이전트 병렬화, 작은따옴표 내 영문 아포스트로피 구문 에러, within() 스코프 조회, 메타 필터 옵션 토큰 0 패턴. 프론트 전용, merge≠라이브."
---
# Sprint 227 — CS 퀴즈 문항 풀 대폭 확장 + 신규 5분야 + 'ALL' 필터

## 목표

- CS 퀴즈(`/quiz`) 문항을 **150 → 350개**로 대폭 확장한다 (5분야 × 30 → 10분야, 기존 5분야도 각 30→50문항 보강).
- 신규 5분야(컴퓨터 구조·디자인 패턴·웹·보안·AI)를 추가하고 각 분야 CSS 토큰·아이콘을 WCAG AA 기준으로 정립한다.
- 분야 선택에 **'ALL'(전체 랜덤) 필터**를 추가해 사용자가 모든 분야를 섞어 퀴즈를 풀 수 있게 한다.
- 프론트 전용, 순수 데이터/UI 확장 — merge ≠ 라이브(재배포 후 라이브 검증은 `quiz-ui-verification` 런북 이월에 합류).

## 배경

Sprint 215부터 구축된 CS 퀴즈는 Sprint 221~224에서 UI·접근성·UX가 정석화되었으나, 문항 풀은 여전히 **5분야 × 30문항 = 150개**로 제한적이었다. 사용자가 한 분야를 반복하면 금방 소진되고, 분야를 고정하지 않고 전체를 섞어 연습하는 시나리오도 불가했다.

Sprint 227은 이 두 갭을 동시에 해소한다:

1. **분야 확장**: 기존 네트워크·운영체제·데이터베이스·알고리즘·자료구조 5분야에 컴퓨터 구조·디자인 패턴·웹·보안·AI 5분야를 추가.
2. **'ALL' 필터**: 분야 선택 PillRadioGroup에 'ALL'(전체 랜덤) 옵션을 추가해 전 분야 350문항 풀에서 무작위 출제.

## 결정

### D1. 신규 5분야 enum·CSS 토큰·아이콘 (Wave A)

`QuizCategory` enum에 5종 추가:
- `COMPUTER_ARCHITECTURE` / `DESIGN_PATTERN` / `WEB` / `SECURITY` / `AI`

**Palette**가 `globals.css`에 신규 5분야 `--quiz-cat-*-color` / `--quiz-cat-*-bg` CSS 변수 20줄(라이트+다크)을 추가했다. WCAG AA 4.5:1+ 대비비를 직접 검증:

| 분야 | 라이트(전경) | 대비비 | 다크(전경) | 기존 5 hue와 구분 |
|------|------------|--------|-----------|----------------|
| arch | `#B45309` | 4.81 | `#FBBF24` | 앰버 톤 |
| dp | `#BE185D` | 5.78 | `#F472B6` | 핑크 톤 |
| web | `#4338CA` | 7.56 | `#818CF8` | 인디고 톤 |
| sec | `#B91C1C` | 6.19 | `#F87171` | 레드 톤 |
| ai | `#4D7C0F` | 4.78 | `#A3E635` | 라임 톤 |

`category-meta.ts`에 신규 5분야 lucide 아이콘(`CircuitBoard` / `Shapes` / `Globe` / `ShieldCheck` / `BrainCircuit`)과 var 슬러그 매핑 추가.

i18n `categories` 객체에 신규 5키(ko+en) + `categories.ALL` 키 추가.

### D2. 대규모 콘텐츠 병렬 생성 (Wave B+C)

**Curator 10에이전트를 병렬 구동**해 파일당 1에이전트 방식으로 문항을 생성했다:

- **신규 5분야 각 20문항** (7E/7M/6H): `computer-architecture.ts` / `design-pattern.ts` / `web.ts` / `security.ts` / `ai.ts`
- **기존 5분야 각 30→50문항** (+20): 특히 HARD 불균형 보강(network HARD 4→17, os 5→17, database 7→17, 각 16E/17M/17H 목표)

`index.ts` `ALL_QUESTIONS`에 5분야 합산 → `QUIZ_CATEGORIES` 10분야, 전역 id 유니크 350개 달성.

**통합 시 발견·수정**: `database.ts`·`os.ts` 영문 텍스트에서 작은따옴표 문자열 내 미이스케이프 아포스트로피(`Brewer's`, `process's`) 2건 → 쌍따옴표로 전환해 구문 에러 해소.

### D3. 'ALL' 필터 추가 (Wave D)

`index.ts` `getQuestionsByFilter` / `getRandomQuestions`가 `category: QuizCategory | 'ALL'`을 수용한다:
- `'ALL'`: `ALL_QUESTIONS` 전체 풀에서 출제 (기존 난이도 `'ALL'` 패턴 미러링)
- 기존 분야별 필터링 로직 무변경

`QuizStart` 분야 `PillRadioGroup`에 `'ALL'` 옵션을 prepend:
- `Shuffle` 아이콘 + primary 톤
- **신규 디자인 토큰 0** — `getOptionStyle`은 `'ALL'`에 `undefined` 반환(기존 분야 카테고리 메타에 없는 옵션이므로 가드 처리)
- 기본 선택값 `'ALL'`로 변경

`page.tsx` `Session.category` / `start` 파라미터에 `'ALL'` 전파. 저장 키는 `ALL::difficulty` 자동 생성. `stats` 집계는 `'ALL'` 키 무시(`QUIZ_CATEGORY_META` own-key 검증, 메타 모드).

### D4. 테스트 전면 갱신 (Wave E)

| 테스트 파일 | 변경 내용 |
|-----------|---------|
| `QuizStart.test` | 전면 갱신 — 분야·난이도 두 '전체' 라벨 중복 → `within()` radiogroup 스코프 조회, 기본 분야 `'ALL'` 반영, ALL 분야 신규 4테스트 |
| `index.test` | `+5` — ALL 필터 동작 검증 |
| `data-integrity.test` | 신규 `+12` — 350문항 유니크 id·카테고리·bilingual 무결성 |
| `category-meta.test` | 신규 5분야 var 슬러그 검증 |
| `page.test` | 키 갱신(ALL 기본 선택 반영) |

전역: **1533 → 1555 tests (+22)**.

## 구현

총 atomic commit (start `66820e0`):

| 커밋 | 에이전트 | 내용 |
|------|---------|------|
| `229da66` | Palette + Herald | Wave A — QuizCategory +5, globals.css 20줄, category-meta 아이콘/var, i18n 신규 5키+ALL |
| `f8660d1` | Curator×10 + Herald | Wave B+C — 신규 5분야 각 20문항, 기존 5분야 각 +20(HARD 보강), index.ts ALL_QUESTIONS 통합, 아포스트로피 2건 수정 |
| `09dc639` | Herald | Wave D — getQuestionsByFilter/getRandomQuestions 'ALL' 수용, QuizStart 'ALL' prepend, page.tsx 전파, stats 'ALL' 무시 |
| `2912955` | Herald + Librarian | Wave E — 테스트 전면 갱신 +22, data-integrity.test 신규, ADR sprint-227 KR+EN, README 164→165 |

## 검증

- **tsc**: 오류 0 (아포스트로피 수정 포함)
- **next lint** (rtk proxy 실측): **0 errors / 487 warnings** (전부 기존 인라인 토큰 `var()` 경고, 신규 0)
- **jest**: **152 suites / 1555 PASS** (+22, 전 실패 0)
- **글로벌 커버리지**: lines **88.03%** / branches **79.37%** (게이트 83/71 통과)
- **quiz 컴포넌트·데이터**: lines 100% / branches 98.59% (data-integrity `/* istanbul ignore */` 분기 제외)
- **next build**: ✓ `/[locale]/quiz` **84.8kB** (Sprint 224 40.2kB → 증가: 350문항 bilingual 데이터가 클라이언트 번들에 포함되는 기존 아키텍처 특성, 하단 교훈 ⑤ 참조)
- **ADR 게이트**: index count (sprint **165**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken

## 교훈

1. **대규모 콘텐츠는 "파일당 1에이전트" 병렬화로 충돌 0·검증 용이** — 10분야 문항 파일을 Curator 10에이전트가 동시에 생성하고, `index.ts` 배선만 통합 단계에서 처리했다. 파일 간 의존성이 없어 충돌 0, 각 파일이 독립 단위라 tsc·테스트도 분야별로 격리 검증 가능.
2. **작은따옴표 문자열 내 영문 아포스트로피(소유격/축약)는 구문 에러** — `'Brewer's'`, `'process's'`처럼 작은따옴표로 감싼 문자열 안에 영문 아포스트로피가 들어가면 파서가 문자열 종료로 인식한다. 영문 콘텐츠 대량 생성 시 **쌍따옴표 사용** 또는 통합 `tsc --noEmit`으로 조기 검출 필수.
3. **분야·난이도 두 radiogroup이 같은 '전체' 라벨을 쓰면 getByRole name 조회가 모호** — `getByRole('radio', { name: '전체' })`가 두 그룹에서 매칭된다. `within(categoryGroup)`·`within(difficultyGroup)`으로 radiogroup 스코프를 좁혀 조회해야 한다.
4. **'ALL' 메타 옵션은 신규 디자인 토큰 없이 기존 primary 톤+getOptionStyle undefined 가드로 추가** — 분야 카테고리 메타에 없는 'ALL'을 `getOptionStyle`이 `undefined` 반환으로 처리하면 기존 분야 스타일 로직을 건드리지 않고 안전하게 삽입할 수 있다. 난이도 'ALL' 패턴 재사용.
5. **클라이언트 번들 문항 데이터는 풀 확장이 번들 크기에 선형 반영** — 150→350문항(bilingual)이 클라이언트 번들에 포함되어 `/[locale]/quiz`가 40.2kB→84.8kB로 증가했다. 향후 분야별 lazy-load(동적 import)를 검토해 초기 번들을 줄일 수 있다(이월 시드).

신규패턴:
- **파일당 1에이전트 콘텐츠 병렬 생성 패턴** — 대규모 콘텐츠 파일을 에이전트 수만큼 병렬 생성하고 단일 `index.ts`에서 배선 통합.
- **메타 필터 옵션(토큰 0) 패턴** — 'ALL' 같은 메타 옵션은 `getOptionStyle undefined` 가드 + 기존 primary 톤으로 신규 디자인 토큰 없이 추가.

## Sprint 228+ 이월

- **(운영 실행) 재배포 후 라이브 `/quiz` 검증** — `docs/runbook/quiz-ui-verification.md` 따라 실행(이번 확장의 신규 5분야·ALL 필터 포함). SP217 컷오버와 같은 frontend 롤아웃으로 일괄 가능.
- **(선택) 분야별 문항 lazy-load로 번들 최적화** — `/[locale]/quiz` 84.8kB를 분야별 동적 import로 초기 번들 절감 검토(교훈 ⑤).
- SP217 컷오버 / GA4 / Sprint 196 problem_db / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli, `codex review --base 66820e0 -c model=gpt-5.5`
- **상태**: _머지 직전 실행 예정 (결과 반영 후 갱신)_
