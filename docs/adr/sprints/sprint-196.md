---
sprint: 196
title: "problem.tags/allowed_languages jsonb 전환 + 서버사이드 태그 필터 + seed 확충"
date: "2026-05-22"
status: completed
agents: [Oracle, Curator, Herald, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["data-modeling"]
tldr: "Problem 서비스의 tags·allowed_languages를 varchar(500)에서 PostgreSQL native jsonb로 전환(엔티티는 simple-json이나 물리 컬럼이 varchar라 정의-구현 불일치 해소)하고, jsonb @> containment + GIN 인덱스(jsonb_path_ops) 기반 서버사이드 태그 필터 API(GET /search/tags, OR 기본/mode=and 전환)를 풀 구현. frontend는 하이브리드(서버 태그 칩 + 기존 검색창 클라이언트 필터) UI로 연동, seed 6→15개 확충. Gateway는 순수 passthrough라 무변경. Critic(Codex gpt-5.5) 6라운드 — Critical/High 0, P2 5건(태그 필터 status 집합·정렬을 /all과 정합, CONCURRENTLY 인덱스 statement_timeout 보호, 추가 후 unfiltered 캐시 재검증, 스터디 전환 시 태그 초기화) 전부 해소 후 R6 0건. 백엔드 jest 183 pass·frontend 1374+ pass·tsc 0·ESLint 0·CI green. PR #345 squash → 41e2ca3."
---
# Sprint 196 — problem.tags/allowed_languages jsonb 전환 + 서버사이드 태그 필터 + seed 확충

## 목표

- Problem 서비스의 `tags`·`allowed_languages`를 `varchar(500)` → PostgreSQL native `jsonb`로 전환해 **엔티티(simple-json) ↔ 물리 컬럼(varchar) 정의 불일치를 해소**한다.
- jsonb `@>` containment + GIN 인덱스(`jsonb_path_ops`)로 **효율적 태그 쿼리 기반**을 마련하고, 서버사이드 태그 필터 API(`GET /search/tags`)를 풀 구현한다.
- frontend에 태그 필터를 연동하고, 태그 다양성을 가진 **seed 데이터를 6→15개로 확충**한다.

## 배경

- `problem.entity.ts`는 `tags`·`allowed_languages`를 `@Column('simple-json')`으로 선언 → TypeORM이 JSON 텍스트로 직렬화하므로 JS 레벨에서는 `string[]`로 작동했으나, **물리 DB 컬럼은 `varchar(500)`**(`1700000100002-AddTagsColumn.ts` 등)이라 정의-구현이 어긋나 있었다.
- API 응답·DTO·frontend는 모두 `string[]`로 일관 → simple-json이든 jsonb든 API 계약은 동일(`string[] | null`)하여 frontend 깨짐 위험 없음.
- **서버사이드 태그 필터는 부재**. frontend가 검색창 통합 클라이언트 필터(`p.tags?.some(...)`)로만 처리 → 목표의 "태그 기반 분류/필터 기반"이 미구현 영역.
- dual-write는 활성 구조(구 DB + 신 DB)이나 현재 `DUAL_WRITE_MODE=off`, `.env.example`상 신 DB가 구 DB와 동일 인스턴스를 가리킴 → 물리 분리/이중쓰기 비활성.
- `1709000017000-BackfillSqlCategory.ts`의 `tags ILIKE '%"sql"%'` 패턴은 **과거 마이그레이션**이라 jsonb 전환 마이그레이션(더 나중 타임스탬프)이 실행 순서상 안전.

## 결정

### D1. 스코프 — 전환 + 풀 필터 API (사용자, AskUserQuestion)

- ① 스코프 = 컬럼 전환 + GIN + **서버사이드 태그 필터 풀 구현 + frontend 연동** ② 컬럼 타입 = `jsonb` ③ `allowed_languages`도 동반 전환 ④ seed 12~15개 확충.

### D2. 신 DB 마이그레이션 — 런북 절차만 (사용자)

- `DUAL_WRITE_MODE=off`(신 DB = 구 DB 동일 인스턴스)라 당장 신 DB 쓰기 없음. `dual-write.module.ts`에 신 DB 자동 마이그레이션 경로 부재. → 코드 자동 경로/신 data-source 미도입, `docs/runbook/db-migration.md`에 "dual-write 활성 시 신 DB 동일 마이그레이션 적용 절차"만 명문화(향후 EXPAND/SWITCH_READ 전환 대비).

### D3. 엔드포인트 — 신규 GET /search/tags, OR 기본 (사용자)

- 신규 `GET /search/tags?tags=&mode=` — `@Get(':id')`보다 위에 선언(NestJS 선언순 매칭으로 `search` 리터럴이 UUID 파싱 400 회피). 기본 매칭 `or`(`mode=and`로 교집합 전환). 인코딩은 반복 `?tags=a&tags=b`(NestJS @Query 배열 관례, 한글 태그 URL 인코딩).

### D4. Frontend — 하이브리드 + 태그 칩 (사용자)

- plumbing(swr/api/hook) + 문제 목록에 태그 선택 칩 행(난이도 pills 패턴) 추가. **기존 검색창 클라이언트 필터 유지**(자유 텍스트 = 검색창, 이산 태그 선택 = 서버 필터, 동시 적용 시 교집합).

### D5. 태그 필터 정합성 — findAllByStudy와 status·정렬 일치 (Oracle 번복, Critic P2)

- 플랜은 태그 필터를 `ACTIVE`만·`weekNumber DESC`(findActiveByStudy 패턴)로 지정했으나, **frontend가 `/all`(findAllByStudy = ACTIVE+CLOSED, weekNumber ASC)을 대체하는 하이브리드 구조**임이 드러나 Critic이 정합성 결함 2건(P2) 지적. → 태그 필터 엔드포인트는 `findAllByStudy`와 **status 집합(ACTIVE+CLOSED) + 정렬(weekNumber ASC, createdAt ASC)을 완전히 일치**시키도록 번복. (번복 이유: 동일 UI가 태그 토글로 두 엔드포인트를 오가므로 데이터셋·순서가 일관돼야 함.)

## 구현

### 구현 커밋 (8커밋, PR #345 squash → `41e2ca3`)

- `45f7952` feat(problem) — Part A 백엔드
  - 신규 `migrations/20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`: tags·allowed_languages varchar(500)→jsonb(`USING CASE WHEN col IS NULL THEN NULL ELSE col::jsonb END`), GIN 인덱스 `idx_problems_tags_gin`(`jsonb_path_ops`, CONCURRENTLY 트랜잭션 외부), best-effort down()
  - `problem.entity.ts`: simple-json → jsonb (2컬럼, API 응답 `string[]` 불변)
  - `dual-write.service.ts`: `findByTagsContaining`(readRepo 경유, AND=단일 `@>`, OR=Brackets)
  - `problem.service.ts`: `findByTags` / `problem.controller.ts`: `GET /search/tags`(:id 앞) / 신규 `dto/query-problem.dto.ts`(`@Transform` 단일→배열, `mode @IsIn`)
  - `scripts/demo-seed-problem.sql`: 6→15개(태그 다양성, Week 1~5) / `docs/runbook/db-migration.md`: 신 DB 절차 / service·controller·dual-write spec
- `444b445` feat(frontend) — B1+B4 plumbing(swr cacheKeys URLSearchParams, api findAll(params?), use-problems tags 스레드) + 테스트
- `609f222` feat(frontend) — B2 태그 칩 UI + i18n(ko/en) + 하이브리드 필터(2-hook: allProblems + filtered)
- `a59c606` fix(problem) — [Critic R1 P2] findByTags status `[ACTIVE]` → `[ACTIVE, CLOSED]`(findAllByStudy 정합)
- `8e3e75b` fix(problem) — [Critic R2 P2] findByTagsContaining 정렬 `weekNumber DESC` → `ASC`(findAllByStudy 정합)
- `9bb477a` fix(problem) — [Critic R3 P2] 마이그레이션 COMMIT 후 세션 레벨 `SET statement_timeout=0` 재설정(SET LOCAL은 COMMIT 시 소멸 → CONCURRENTLY 인덱스 빌드 보호)
- `7ec0bb0` fix(frontend) — [Critic R4 P2] 문제 추가 시 `mutateAllProblems()` 추가(2-hook 중 unfiltered 캐시 stale 방지)
- `2f227c8` fix(frontend) — [Critic R5 P2] `useEffect(() => setSelectedTags([]), [activeSid])` — 스터디 전환 시 stale 태그 초기화

## 검증

- **타입/빌드**: `tsc --noEmit` 0 (problem + frontend). ESLint **0 errors**(양쪽).
- **테스트**: 백엔드 jest **183 pass / 0 fail** (커버리지 statements 99.14%·branches 96.69%·functions 98.48%·lines 99.05%, threshold 통과). frontend **1374+ pass / 0 fail** (lines 86.34%/branches 78.32%/functions 83.72%, threshold 83/71/82 통과).
- **Critic**: `codex review --base main`(gpt-5.5) **6라운드** — Critical/High **0건**. P2 5건(D5 status·정렬 ×2, 마이그레이션 timeout, 캐시 재검증, 스터디 전환 초기화) 전부 해소 → R6 최종 **0건**("no evident discrete bug that would break existing behavior, type checking passes").
- **CI #345**: 전 잡 pass/skip, **fail 0** (`MERGEABLE`/`CLEAN`) → Squash merge.
- **태그 필터 쿼리**: jsonb `@>` containment — AND=단일 `tags @> :tags::jsonb`(GIN 활용), OR=`Brackets`로 각 태그 `@>` OR. studyId+status 스코핑.

## 교훈 / 패턴

- ① **"X를 대체하는 신규 엔드포인트"는 X와 데이터셋·정렬을 완전히 일치시켜야 한다** — frontend가 태그 토글로 `/all`↔`/search/tags`를 오가는 하이브리드라, status 집합(ACTIVE+CLOSED)과 정렬(weekNumber ASC)이 다르면 토글 시 빈 목록/재정렬이 발생. Critic이 두 P2(R1·R2)로 연속 포착 → 백엔드 단독 관점(findActiveByStudy)과 frontend 사용 맥락(findAllByStudy 대체)의 괴리가 정합성 결함의 근원.
- ② **`SET LOCAL`은 COMMIT 시 소멸 — 트랜잭션 외부 작업(CONCURRENTLY)은 세션 레벨 재설정** — 마이그레이션 up()에서 `SET LOCAL statement_timeout=0`은 ALTER TYPE(트랜잭션 내)만 보호. `COMMIT` 후의 `CREATE INDEX CONCURRENTLY`는 원래 timeout(프로덕션 200ms)으로 실행되어 대형 테이블에서 취소될 수 있음 → COMMIT 직후 세션 레벨 `SET statement_timeout=0`(LOCAL 없이) 재설정 필요.
- ③ **2-hook(전체+필터) 패턴은 무효화도 양쪽** — 같은 데이터의 두 SWR 키(unfiltered allProblems + filtered)를 쓰면 mutation 후 둘 다 재검증해야 stale 방지. 또 필터 상태(selectedTags)는 컨텍스트(activeSid) 변경 시 초기화해 stale carry-over 차단.
- ④ **simple-json → jsonb는 API 계약 무변경** — TypeORM이 양쪽 모두 `string[]`로 노출하므로 frontend·gateway·DTO 변경 불필요. "JSON 전환"의 실체는 물리 컬럼 타입 + 인덱스/쿼리 능력.

## 신규 패턴

- **태그/배열 필터는 jsonb + GIN(jsonb_path_ops) + `@>` containment** — AND=단일 containment(인덱스 최대 활용), OR=`Brackets`로 단일 원소 `@>` OR 묶음. 필터 쿼리는 DualWriteService(readRepo) 경유로 dual-write 읽기 전환 정합 유지.
- **"대체 엔드포인트" 정합 체크리스트** — 신규 필터/검색 엔드포인트가 기존 목록 엔드포인트를 UI에서 대체하면, ⓐ status 집합 ⓑ 정렬 ⓒ 캐시 무효화 ⓓ 상태 carry-over를 기존과 대조.
- **CONCURRENTLY 인덱스 마이그레이션**: COMMIT → 세션 레벨 `SET statement_timeout=0` → `CREATE INDEX CONCURRENTLY` → BEGIN (트랜잭션 외부 작업은 LOCAL 보호 밖).

## 이월 항목

- **운영측 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run` → jsonb 전환 + GIN 인덱스 적용 (런북 `SET statement_timeout=0` 절차).
- (선택) **app.module 부트스트랩 스모크 테스트** → Sprint 197 (전 DI 그래프 방어, TypeORM mock).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~196 누적.
