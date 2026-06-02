---
sprint: 216
title: "광범위 문항 은행 + 출제 UX (3-스프린트 로드맵 2/3)"
date: "2026-06-02"
status: completed
agents: [Oracle, Curator, Architect, Librarian, Critic]
related_adrs: ["sprint-215"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "quiz", "content", "ci"]
tldr: "Sprint 215 퀴즈 미니게임 코어 위에 콘텐츠를 채우고 출제 UX를 다양화한 3-스프린트 로드맵 2/3. 215가 QuizCategory enum(NETWORK/OS/DATABASE)·i18n categories 키·QuizStart 동적 카테고리 렌더·getRandomQuestions 셔플·difficulty 필드를 전방 선언해 둔 덕에, 216은 신규 추상화 없이 (1)콘텐츠 채우기 (2)이미 깔린 difficulty를 출제 UX로 노출 (3)콘텐츠 품질 자동 검증 (4)채점 정규화 엣지 보강만으로 완성했다. 5분야(자료구조/알고리즘/네트워크/운영체제/데이터베이스) 각 30문항 = 총 150문항으로 확장(DS/ALGO 12→30 균등 보강 포함), 분야+난이도 필터를 추가했다. getQuestionsByFilter(category, difficulty) 헬퍼를 신설하고 getRandomQuestions 시그니처에 difficulty('ALL' 기본)를 추가하되 rng를 4번째 인자로 밀어 테스트 주입을 보존했다. best 기록 키는 카테고리 단위를 유지(난이도별 분기는 storage 스키마 변경이라 217로 이월). 문항 은행이 커지므로 check-quiz-content.mjs 콘텐츠 lint(7개 규칙)를 신설해 CI quality-frontend 잡에 연동했고, 채점 정규화는 파이프라인 맨 앞에 .normalize('NFKC')를 추가해 전각 문자만 보강했다. 백엔드 0·프론트엔드 only. Critic 교차 리뷰는 머지 게이트에서 codex review --base d431dcf로 실행 예정."
---
# Sprint 216 — 광범위 문항 은행 + 출제 UX (3-스프린트 로드맵 2/3)

## 목표

- Sprint 215 미니게임 코어 위에 **광범위 문항 은행**을 채운다 — 5분야 각 30문항 = 총 150문항.
- 215가 전방 선언해 둔 `difficulty` 필드를 **출제 UX(난이도 필터)** 로 노출한다.
- 문항 은행이 커지므로 **콘텐츠 품질을 코드로 게이트**한다 — 스키마/중복/누락 검증 lint를 CI에 연동.
- 채점 정규화의 **실제 갭**을 검증 후 최소 보강한다(추측 보강 금지).

## 배경

[Sprint 215](./sprint-215.md)는 CS 퀴즈 미니게임의 코어 플레이 루프를 완성하면서, 후속 스프린트를 염두에 두고 다음을 **전방 선언**해 두었다.

- `QuizCategory` enum에 `NETWORK` / `OS` / `DATABASE` 포함 (콘텐츠는 미충전)
- i18n `categories` 키 (전 분야 라벨 ko/en)
- `QuizStart`의 **동적 카테고리 렌더** (enum 순회 → 추가 분야가 자동 노출)
- `getRandomQuestions`의 셔플 로직
- 문항 타입의 `difficulty` 필드 (값만 존재, UX 미노출)

따라서 216은 **신규 코드를 발명하는 스프린트가 아니다**. 이미 깔린 골격 위에 (1)콘텐츠를 채우고, (2)이미 존재하는 `difficulty`를 출제 UX로 노출하고, (3)커지는 콘텐츠의 품질을 자동 검증하고, (4)채점 정규화의 엣지를 보강하는 것이 전부다. 백엔드 기록 연동은 [[sprint-window]]에 정리된 로드맵대로 Sprint 217로 이월하며, 216은 **프론트엔드 전용**이다.

3-스프린트 로드맵([[feedback-sprint-scoping]]) 상의 위치:

- **Sprint 215**: 프론트 미니게임 코어 (단답형 채점 + 게임 루프 + PoC 2분야 24문항).
- **Sprint 216 (본 스프린트)**: 광범위 문항 은행(5분야 150문항) + 출제 UX(난이도 필터) + 콘텐츠 lint + 채점 정규화 보강.
- **Sprint 217**: 로그인 사용자 기록 연동(QuizRecord 엔티티 + 마이그레이션). `storage.ts` 추상화를 서버 API로 교체.

## 결정

### D0. 콘텐츠 볼륨 — 5분야 각 30문항(150), 전 분야 균등 보강

5분야(자료구조/알고리즘/네트워크/운영체제/데이터베이스) **각 30문항, 총 150문항**으로 확장한다. 215에서 PoC로 12문항씩 담았던 자료구조·알고리즘도 **12→30으로 균등 보강**하여 전 분야가 동일한 깊이를 갖도록 한다. 사용자가 (a)30/분야, (b)전 분야 균등 보강, (c)난이도 필터 추가를 명시 선택했다.

### D1. 난이도 필터 — 전방 선언된 difficulty를 출제 UX로 노출

`types.ts`에 215부터 존재하던 `difficulty` 필드를 출제 UX로 노출한다.

- `getQuestionsByFilter(category, difficulty)` 헬퍼를 신설한다(기존 `getQuestionsByCategory` 패턴 계승).
- `getRandomQuestions` 시그니처에 `difficulty`(`'ALL'` 기본)를 추가하되, **`rng`를 4번째 인자로 이동**하여 테스트의 결정적 rng 주입을 보존한다. 기본값 `'ALL'` 덕에 기존 호출·테스트는 무회귀.
- `QuizStart`에 난이도 `fieldset`을 추가한다(기존 `aria-pressed` 토글 패턴 재사용, **신규 ui 0** — Palette 권한 보존).

### D2. best 기록 키 — 카테고리 단위 유지(난이도별 분기 없음)

best 기록 키는 **카테고리 단위**를 유지하고, 난이도별로 분기하지 않는다. 난이도별 best는 `storage` 스키마 변경을 수반하므로, **Sprint 217 서버 연동 시 함께 설계**한다. 216은 `storage.ts`를 무변경으로 두어 215에서 정한 217 이월 경계를 준수한다.

### D3. 콘텐츠 lint — check-quiz-content.mjs 신설 + CI 연동

문항 은행이 150문항으로 커지면 수동 검수의 한계가 명확하다. 품질 자동 검증 스크립트 `frontend/scripts/check-quiz-content.mjs`를 신설하고 CI `quality-frontend` 잡에 연동한다.

- **텍스트 파싱 방식** — `.ts`를 직접 import할 수 없으므로(빌드 의존성 회피), node 빌트인만으로 데이터 파일을 텍스트 파싱한다.
- **7개 규칙** — ① 중복 id ② id 네이밍 ③ 빈 `acceptedAnswers` ④ ko/en 누락 ⑤ category enum 일치 ⑥ difficulty 허용값 ⑦ 분야별 최소 30문항.
- `--strict` 위반 시 `exit 1`로 CI hard gate화.

### D4. 채점 정규화 — NFKC 전각 폴딩만 보강(추측 보강 금지)

현 `normalizeAnswer`는 하이픈/언더스코어/복수공백을 **이미 흡수한다**(정규식이 한/영/숫자 외 문자를 제거하므로). 따라서 이들은 회귀 고정 테스트만 추가하고 로직은 손대지 않는다. 실제 갭은 **전각(full-width) 문자**다 — 파이프라인 **맨 앞**에 `.normalize('NFKC')`를 추가하여 전각 영숫자/기호/공백을 폴딩한다(예: `ＳＱＬ` → `sql`). 자동 동의어 매핑은 과적합 위험이 있어 추가하지 않고, 입력 흔들림은 `acceptedAnswers` 명시 배열로 흡수한다(215 결정 계승).

## 구현

브랜치 `feat/sprint-216-quiz-content-bank`, start commit `d431dcf`, 4 atomic commit. 프론트엔드 only(백엔드 0).

### 데이터 (`src/data/quiz/`)

- `data-structure.ts` / `algorithm.ts` — 12 → **30문항**으로 균등 보강
- `network.ts` / `os.ts` / `database.ts` — 신규 분야 각 **30문항**
- `index.ts` — 신규 분야 병합 + `getQuestionsByFilter` 추가

5분야 총 **150문항**.

분야별 난이도 분포:

| 분야 | Easy | Medium | Hard |
|------|------|--------|------|
| 자료구조 (DS) | 10 | 11 | 9 |
| 알고리즘 (ALGO) | 6 | 6 | 6 |
| 네트워크 (NET) | 12 | 13 | 5 |
| 운영체제 (OS) | 10 | 15 | 5 |
| 데이터베이스 (DB) | 9 | 13 | 8 |

> 분포 편차는 lint의 최소 수(분야별 30) 기준과 무관하며, CS 기초 개념의 자연 분포 결과로 허용한다.

### 로직 / UI

- `getQuestionsByFilter(category, difficulty)` 헬퍼 (D1)
- `getRandomQuestions(category, count, difficulty='ALL', rng)` — `difficulty` 추가 + `rng` 4번째 인자로 이동 (D1)
- `QuizStart` 난이도 `fieldset` (기존 토글 패턴 재사용, 신규 ui 0) + `page.tsx` 필터 전달 + i18n 키

### 콘텐츠 lint / CI

- `frontend/scripts/check-quiz-content.mjs` — 7개 규칙 텍스트 파서, `--strict` 위반 시 exit 1 (D3)
- `.github/workflows/ci.yml` `quality-frontend` 잡에 lint 스텝 추가

### 채점 정규화

- `grade.ts` `normalizeAnswer` 파이프라인 맨 앞에 `.normalize('NFKC')` 추가 + 전각/하이픈/언더스코어/복수공백 회귀 테스트 (D4)

### 커밋

| 해시 | 내용 |
|------|------|
| `1b3095a` | Wave A — 5분야 150문항 (DS/ALGO 12→30, network/os/database 신규 30씩) + index 병합 |
| `51230d9` | Wave B — 난이도 필터 UX (getQuestionsByFilter, QuizStart fieldset, page.tsx, i18n) + 테스트 갱신 |
| `680d4af` | Wave C — check-quiz-content.mjs 콘텐츠 lint + ci.yml quality-frontend 스텝 |
| `7197d0b` | Wave D — grade.ts NFKC 정규화 + 회귀 테스트 |

## 검증

Oracle 직접 검증:

- `tsc --noEmit` → 0
- `next lint` → 0 errors / 0 warnings
- `node frontend/scripts/check-quiz-content.mjs --strict` → **150문항 PASS (exit 0)**, 분야별 30 확인
- `jest --coverage` → **1470 tests PASS / 0 fail** (JEST EXIT 0, 임계값 충족), 글로벌 lines **87.44%** · branches **78.86%** (게이트 83% / 71% 충족)
- **quiz 컴포넌트 5종 · `grade` · `storage` · `data/quiz` index 모두 커버리지 100%**
- `next build` → ✓ Compiled 8.1s, `ƒ /[locale]/quiz` 36.8kB (215의 12.4kB → 150문항 반영 증가)

## 교훈

1. **전방 선언이 후속 스프린트 비용을 낮춘다** — 215가 enum/i18n/동적 렌더/`difficulty` 필드를 미리 깔아둔 덕에, 216은 콘텐츠 채우기 + UX 노출만으로 완성되었다(신규 추상화 0). 로드맵을 분할할 때 다음 스프린트가 채워 넣을 골격을 앞 스프린트에서 미리 선언해 두면, 후속 비용이 구조적으로 낮아진다.
2. **시그니처 확장 시 테스트 주입 인자를 보존한다** — `getRandomQuestions`에 `difficulty`를 추가하되 `rng`를 뒤로 밀어 기본값(`'ALL'`)으로 기존 호출·테스트가 무회귀하도록 했다. 결정적 테스트를 위해 주입하던 인자(rng)는 시그니처 확장 시 항상 마지막 위치를 보존한다.
3. **정규화 갭은 추측 말고 검증 후 최소 보강한다** — 하이픈/언더스코어/복수공백은 기존 정규식이 **이미** 흡수하고 있어 회귀 고정만 추가했고, 실제 갭(전각 문자)만 `NFKC`로 보강했다. 파이프라인의 현 동작을 먼저 확인한 뒤 빠진 케이스만 최소로 채우는 것이 과적합·중복 보강을 막는다.
4. **콘텐츠가 커지면 품질을 코드로 게이트한다** — 150문항은 수동 검수의 한계를 넘어선다. `check-quiz-content.mjs`로 스키마·중복·누락을 CI에서 강제하여, 향후 콘텐츠 추가가 무결성을 깨뜨릴 수 없게 회귀 차단한다.

## 신규 패턴

- **콘텐츠 품질 lint 게이트 패턴** — 데이터가 커지는 정적 콘텐츠 은행은 스키마·무결성 검증 스크립트를 CI에 연동해 회귀를 차단한다. `.ts` 직접 import 대신 node 빌트인 텍스트 파싱으로 빌드 의존성을 회피하고, `--strict`로 hard gate화하여 콘텐츠 추가가 스키마/중복/누락/최소 수 규칙을 위반하면 CI에서 막는다.

## Sprint 217+ 이월

- **Sprint 217 — 로그인 사용자 기록 연동** (계획): `QuizRecord` 엔티티 + 마이그레이션, Identity 확장 유력. `storage.ts` 추상화를 서버 API로 교체. **난이도별 best**도 이때 storage 스키마 변경과 함께 설계(D2).
- **서버 재배포 + 라이브 `/quiz`·SEO 검증** (사용자/운영): merge ≠ 라이브, 재배포 후 라이브 `/quiz` 플레이 + `curl https://algo-su.com/sitemap.xml`·`robots.txt`로 도메인 정합 확인 <!-- doc-ref-lint: ignore -->
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF + 프로덕션 page_view UAT** (사용자, Sprint 210/211/212 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**R1 — 검토 예정** (Codex, `codex review --base d431dcf`)

Critic 교차 리뷰는 머지 게이트에서 `codex review --base d431dcf`로 실행 예정이다. 본 ADR 작성 시점에는 아직 미실행이며, R1 결과(발견 등급·조치)는 Oracle이 머지 게이트 통과 후 본 섹션에 채워 넣는다.
