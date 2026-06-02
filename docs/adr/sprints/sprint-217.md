---
sprint: 217
title: "로그인 사용자 기록 연동 (3-스프린트 로드맵 3/3)"
date: "2026-06-02"
status: completed
agents: [Oracle, Librarian, Architect, Postman, Critic]
related_adrs: ["sprint-215", "sprint-216"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "backend", "identity", "gateway", "quiz", "migration"]
tldr: "CS 퀴즈 3-스프린트 로드맵의 마무리(3/3). 215(미니게임 코어)·216(150문항+난이도 필터)에서 프론트 localStorage에만 남던 best 기록을, 로그인 사용자 단위로 백엔드(identity_db)에 영속화했다. 게스트는 그대로 localStorage, 로그인 사용자는 서버로 분기하고, 로그인 전환 시 localStorage 기록을 서버로 1회 merge-up한다. best 단위는 216이 출시한 난이도 필터에 맞춰 (user_id, category, difficulty) 복합 유니크로 확장했다. 도메인 위치는 신규 quiz 서비스(부트스트랩 비용 과함)·submission_db(경계 흐림) 대신 identity 서비스로 확정 — User와 같은 DB라 userId 정합이 자연스럽고 Gateway BFF 라우팅이 기존 /auth·/studies 인근이다. 아키텍처는 study 도메인 BFF 패턴을 그대로 답습했다(Frontend fetchApi httpOnly Cookie → Gateway JWT 미들웨어 X-User-ID 주입 → Gateway QuizRecords BFF → IdentityClient X-Internal-Key → Identity QuizRecords InternalKeyGuard → TypeORM identity_db). upsert는 ON CONFLICT(user_id,category,difficulty) DO UPDATE WHERE best_score_percent < EXCLUDED 단일 원자 쿼리로 TOCTOU race를 회피하고 higher-only를 보장한다. 215의 QuizRecordStore 인터페이스 추상화 덕에 동기→async 전환만으로 구현체를 서버 API로 무중단 교체했다. 4 atomic commit. 검증 Identity 99.87%stmt·Gateway 98.49%·Frontend 87.6%lines 게이트 충족. Critic 백엔드 R1 CLEAN, 프론트 R1 P2 1건(실패 캐싱) 수정 후 해소. start commit 6e00ce6."
---
# Sprint 217 — 로그인 사용자 기록 연동 (3-스프린트 로드맵 3/3)

## 목표

- 215·216에서 프론트 `localStorage`에만 남던 CS 퀴즈 best 기록을 **로그인 사용자 단위로 백엔드에 영속화**한다.
- best 단위를 216이 출시한 난이도 필터에 맞춰 **(category, difficulty) 복합 키**로 확장한다.
- 게스트는 `localStorage`, 로그인 사용자는 서버로 분기하고, 로그인 전환 시 **1회 merge-up**으로 끊김 없이 잇는다.
- 215가 깔아둔 `QuizRecordStore` 추상화를 **서버 API 구현체로 무중단 교체**한다.

## 배경

[Sprint 215](./sprint-215.md)는 CS 퀴즈 미니게임 코어를 완성하며 기록 영속화를 `QuizRecordStore` 인터페이스 + `createLocalStorageQuizStore` 구현으로 추상화해 두었고, [Sprint 216](./sprint-216.md)은 문항 은행을 150문항으로 확장하면서 **난이도 필터 UX**를 출시했다(단, best 기록 키는 카테고리 단위 유지 — 난이도별 분기는 storage 스키마 변경이라 217로 명시 이월).

따라서 217은 3-스프린트 로드맵([[feedback-sprint-scoping]])의 **마무리**다.

- **Sprint 215**: 프론트 미니게임 코어 (단답형 채점 + 게임 루프 + `QuizRecordStore` 추상화).
- **Sprint 216**: 광범위 문항 은행(5분야 150문항) + 난이도 필터 + 콘텐츠 lint.
- **Sprint 217 (본 스프린트)**: 로그인 사용자 기록 연동 — `QuizRecord` 엔티티 + 마이그레이션(identity_db), Gateway BFF, 프론트 storage 서버 교체(게스트/로그인 분기 + merge-up), 난이도별 best.

215의 인터페이스 추상화가 217 서버 교체를 **무중단**으로 만든 것이 핵심이다 — 인터페이스를 동기에서 async(`Promise`)로 전환하고, 구현체를 `createLocalStorageQuizStore`에서 `createApiQuizStore`로 갈아끼우는 것만으로 백엔드 연동이 끝난다.

## 결정

### D0. 도메인 위치 — identity 서비스 확장(identity_db)

퀴즈 기록 도메인을 **identity 서비스로 확장**한다(`identity_db`). 후보였던 신규 quiz 서비스는 서비스 부트스트랩 비용(Dockerfile/CI/배포/모니터링)이 기능 규모 대비 과하고, `submission_db`는 제출 도메인과 경계가 흐려진다. identity는 `User`와 **같은 DB**라 `userId` 정합이 자연스럽고, Gateway BFF 라우팅이 기존 `/auth`·`/studies` 인근에 자연히 들어선다. (사용자 확정)

### D1. best 키 단위 — (user_id, category, difficulty) 복합 유니크

best 기록 키를 **(user_id, category, difficulty) 복합 유니크**로 확장한다. 216이 난이도 필터 UX를 출시했으므로, 기록도 난이도별로 분리해야 "Network·Hard·5문항"의 최고 기록과 "Network·Easy·10문항"의 최고 기록이 섞이지 않는다. 215/216의 카테고리 단위 키는 본 스프린트에서 난이도 차원을 더해 마무리한다. (사용자 확정)

### D2. 스코프 — 백엔드 도메인 + 서버 API + Gateway BFF + 프론트 storage 서버 교체 일괄

스코프를 (a)Identity 백엔드 도메인, (b)서버 API, (c)Gateway BFF, (d)프론트 storage 서버 교체(게스트/로그인 분기 + merge-up)까지 **일괄 처리**한다. 로드맵 3/3의 마무리이므로, 부분만 연동하면 기록이 어느 층에서 끊겨 사용자에게 노출되지 않는다. (사용자 확정)

### D3. 아키텍처 — study 도메인 BFF 패턴 답습

기존 `study` 도메인의 BFF 패턴을 그대로 답습한다. 신규 통신 규약을 발명하지 않고 검증된 경로를 재사용하여 보안(내부 키)·인증(JWT) 계층을 일관되게 유지한다.

```
Frontend  fetchApi (httpOnly Cookie)
   │
Gateway   JWT 미들웨어 → X-User-ID 주입
   │      QuizRecordsController (req.headers['x-user-id'])
   │      → Gateway QuizRecords service → IdentityClient.request (X-Internal-Key 자동 주입)
   │
Identity  QuizRecordsController (@UseGuards InternalKeyGuard)
          → service.upsertBest / findByUser → TypeORM identity_db
```

- **인증**: 프론트는 httpOnly Cookie만 보내고, Gateway JWT 미들웨어가 검증 후 `X-User-ID`를 주입한다. 프론트는 userId를 모른다(신뢰 경계 보존).
- **내부 보안**: Gateway→Identity 구간은 `X-Internal-Key`로 보호하고 Identity는 `InternalKeyGuard`로 외부 직접 호출을 차단한다.

### D4. upsert 동시성 — ON CONFLICT WHERE 단일 원자 쿼리(TOCTOU 회피)

best 갱신은 "조회 후 비교 후 갱신"의 3단계 race(TOCTOU)를 피하기 위해 **단일 원자 쿼리**로 처리한다.

```sql
INSERT INTO quiz_records (...) VALUES (...)
ON CONFLICT (user_id, category, difficulty)
DO UPDATE SET best_score_percent = EXCLUDED.best_score_percent, ...
WHERE quiz_records.best_score_percent < EXCLUDED.best_score_percent
```

`WHERE ... < EXCLUDED`로 **higher-only**(기존보다 높은 점수만 갱신)를 DB 레벨에서 보장하고, 동시 제출이 와도 복합 유니크 제약 + ON CONFLICT가 한 행으로 수렴시킨다.

## 구현

브랜치 `feat/sprint-217-quiz-record-sync`, start commit `6e00ce6`, 4 atomic commit. 백엔드(Identity + Gateway) + 프론트.

### 커밋

| 해시 | 내용 |
|------|------|
| `f431843` | feat(identity) — quiz-record 도메인: entity + 마이그레이션 + service(upsertBest/findByUser) + controller(InternalKeyGuard) + DTO + module + app.module 등록 + spec |
| `d06ad07` | feat(gateway) — quiz-record BFF: controller(X-User-ID 추출/401 방어) + service(IdentityClient 위임) + IdentityClient 메서드 추가 + DTO + module + app.module(ProxyModule catch-all 앞 등록) + spec |
| `f12991a` | feat(frontend) — QuizRecordStore 동기→async 전환 + difficulty 추가 + 복합 키 + `createApiQuizStore` + 게스트/로그인 분기 + 로그인 전환 merge-up + 테스트 |
| `f938ae4` | fix(frontend) — Critic P2: api-store `getAllBest` catch에서 실패를 캐싱하지 않도록 수정 + 회귀 테스트 |

### Identity (`f431843`)

- **entity** `quiz_records`: `id` uuid PK / `user_id` uuid `@Index` / `category` varchar(30) / `difficulty` varchar(10) `ALL|EASY|MEDIUM|HARD` / `best_score_percent` int / `played_at` timestamptz / `created_at`·`updated_at`. **복합 UNIQUE** `uq_quiz_records_user_category_difficulty(user_id, category, difficulty)`.
- **마이그레이션** `20260602000000-SP217-CreateQuizRecords.ts` — `up`/`down` 양방향, `synchronize:false` 준수. (운영측 `migration:run`은 본 스프린트 범위 밖 — [[sprint-window]] 이월)
- **service** `upsertBest` — `INSERT ... ON CONFLICT DO UPDATE WHERE best_score_percent < EXCLUDED` 단일 원자 쿼리(D4, TOCTOU 회피·higher-only) + `findByUser`.
- **controller** `@Controller('api/quiz-records')` `@UseGuards(InternalKeyGuard)` — `POST` / `GET by-user/:userId`, `{ data }` 래핑.
- `UpsertQuizRecordDto`(class-validator) + module + `app.module` 등록 + spec.

### Gateway (`d06ad07`)

- **controller** `@Controller('api/quiz-records')` — `POST` / `GET`. `extractUserId()`가 `X-User-ID` 미존재/비-UUID 시 **401**로 방어(프론트는 userId를 모르고 헤더는 Gateway JWT 미들웨어만 주입).
- **service** — `IdentityClient` 위임.
- `identity-client.service.ts`에 `saveQuizRecord`/`findQuizRecordsByUserId` 추가(`X-Internal-Key` 자동 주입, `{ data }` unwrap).
- `SaveQuizRecordDto` + module + `app.module`에 **`ProxyModule` catch-all 앞** 등록(구체 라우트 우선) + spec.

### Frontend (`f12991a`, `f938ae4`)

- `QuizRecordStore` 인터페이스를 **동기 → async(`Promise`)** 로 전환(215 추상화 위에서 구현체 교체만으로 서버 연동).
- `QuizPlayResult.difficulty` 추가, best 키를 `${category}::${difficulty}` 복합으로, localStorage 키를 `algosu.quiz.records.v2`로(스키마 변경 격리).
- `api-store.ts` 신규 `createApiQuizStore`(`POST`/`GET` `fetchApi`, 응답 snake_case `best_score_percent`/`played_at` → camelCase 변환, 메모리 캐시, best-effort).
- `page.tsx` — `useAuth`로 게스트/로그인 분기. 로그인 전환 시 **1회 merge-up**(localStorage → 서버, `Promise.allSettled`, higher-only 멱등, `ref` 플래그로 중복 방지). `finish`/`start` async화.
- 테스트 — storage / storage-ssr / api-store(신규) / page.

### API 계약

**Gateway (프론트, httpOnly Cookie):**

| 메서드 | 경로 | 요청 | 응답 |
|--------|------|------|------|
| POST | `/api/quiz-records` | `{ category, difficulty, scorePercent, playedAt }` | `QuizRecord` (raw) |
| GET | `/api/quiz-records` | — | `QuizRecord[]` (raw) |

- `userId`는 `X-User-ID` 헤더(Gateway JWT 미들웨어 주입). 미인증 시 **401**.
- 응답은 snake_case(프론트에서 camelCase 변환).

**Identity (내부, X-Internal-Key):**

| 메서드 | 경로 | 요청 | 응답 |
|--------|------|------|------|
| POST | `/api/quiz-records` | `{ userId, category, difficulty, scorePercent, playedAt }` | `{ data: QuizRecord }` |
| GET | `/api/quiz-records/by-user/:userId` | — | `{ data: QuizRecord[] }` |

## 검증

Oracle 직접 검증(Critic 프론트 P2 수정 반영 후):

**Identity**

- `tsc --noEmit` → 0 / `lint` → 0 / `nest build` → 0
- `jest --coverage` → **271 suites PASS**, 게이트(98%) 충족 — All files **99.87% stmt / 99.53% branch / 100% func / 100% line**, quiz-record **100%**

**Gateway**

- `tsc --noEmit` → 0 / `lint` → 0 / `build` → 0
- `jest --coverage` → **PASS**, 게이트(branch 95 / func 96 / line 98 / stmt 98) 충족 — All **98.49 / 95.65 / 96.71 / 98.86**, quiz-record **100%**

**Frontend**

- `tsc --noEmit` → 0 / `next lint` → 0 errors / 0 warnings
- `jest --coverage` → **147 suites · 1484 tests PASS / 0 fail**, `lib/quiz` storage·api-store·grade **100%**, 글로벌 lines **87.6%**(게이트 83) · branches **78.96%**(게이트 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` 37.5kB(216의 36.9kB → 서버 연동 반영)

## 교훈

1. **인터페이스 추상화가 후속 서버 교체를 무중단으로 만든다** — 215가 `QuizRecordStore` 인터페이스 + localStorage 구현으로 영속화를 추상화해 둔 덕에, 217은 인터페이스를 동기→async로 전환하고 구현체를 `createApiQuizStore`로 갈아끼우는 것만으로 백엔드 연동이 끝났다. 미래의 저장소 교체가 예상되는 경계는 인터페이스로 격리해 두면 후속 비용이 구조적으로 낮아진다.
2. **검증된 BFF 패턴을 답습하면 신규 도메인이 빠르게 붙는다** — `study` 도메인의 Frontend→Gateway(JWT)→Identity(Internal-Key) 경로를 그대로 재사용하여, 보안·인증 계층을 새로 설계하지 않고 일관되게 유지했다. 통신 규약은 발명하지 말고 검증된 경로를 답습한다.
3. **best-effort 캐시는 "실패를 캐싱하지 말 것"** — `api-store`의 `getAllBest` catch에서 실패 폴백값(빈 맵)을 캐시에 쓰면, 일시 네트워크 실패가 영속화되어 재조회가 막히고 낮은 점수도 "최고 기록 갱신!"으로 오탐된다(Critic P2). 성공만 캐싱하고 실패 시에는 값을 캐시에 쓰지 않아 다음 호출에서 재조회되게 한다.
4. **upsert 동시성은 ON CONFLICT WHERE 단일 원자 쿼리로** — "조회→비교→갱신" 3단계는 TOCTOU race에 노출된다. `ON CONFLICT(...) DO UPDATE ... WHERE best_score_percent < EXCLUDED` 단일 쿼리로 higher-only를 DB 레벨에서 보장하면 동시 제출에도 한 행으로 수렴한다.

## 신규 패턴

- **인터페이스 추상화 기반 저장소 무중단 교체 패턴** — 영속화를 Store 인터페이스 + 초기 구현(localStorage)으로 분리해 두면, 후속 스프린트에서 인터페이스를 async로 전환하고 서버 API 구현체로 갈아끼우는 것만으로 무중단 백엔드 연동이 가능하다. best-effort 캐시는 **성공만 캐싱**(실패 폴백값은 캐시에 쓰지 않음)하여 일시 실패가 영속화되지 않게 한다.

## Sprint 218+ 이월

- **운영측 `identity_db` `migration:run` 실행 + 서버 재배포** (사용자/운영): merge ≠ 라이브. `20260602000000-SP217-CreateQuizRecords`를 운영 `identity_db`에 적용(런북 패턴, [Sprint 196] 마이그레이션과 동일 절차)하고 재배포한다.
- **라이브 `/quiz` 서버 기록 동작 검증** (사용자/운영): 재배포 후 로그인 상태에서 `/quiz` 플레이 → 서버 기록 저장/조회 + 게스트→로그인 전환 시 merge-up 동작 확인.
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF + 프로덕션 page_view UAT** (사용자, Sprint 210/211/212 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**백엔드 R1 — CLEAN** (Codex gpt-5.5, `codex review --base 6e00ce6`, codex-cli 0.130.0, session `019e85f4-3742-7300-bfcc-2301521906f9`)

> No actionable correctness issues; the quiz-record domain and BFF routing are wired consistently across Identity and Gateway.

- Critical / High / Medium / Low **0건**.

**프론트 R1 — P2 1건** (Codex gpt-5.5, `codex review --base d06ad07`, session `019e8602-c95f-7421-9725-13341667d73c`)

> `api-store.ts`의 `getAllBest` catch가 `cache = {}`로 네트워크 실패를 성공처럼 캐싱한다. 일시 실패 후 빈 맵이 영속화되어 재조회가 막히고, 이후 낮은 점수도 "최고 기록 갱신!"으로 오탐될 수 있다.

- **조치**: 작성자 수정 `f938ae4` — catch에서 `cache`에 기록하지 않고 `return {}`만 한다(실패는 캐싱하지 않으므로 다음 호출에서 재조회). 회귀 테스트 1건 추가. 수정이 Critic 권장안과 정확히 일치하고 국소적이라 R2를 생략(크레딧 절약), P2 해소.
- Critical / High **0건**.

**최종 — CLEAN**. 백엔드 R1 CLEAN, 프론트 R1 P2 수정(`f938ae4`) 반영 후 회귀 없음.
