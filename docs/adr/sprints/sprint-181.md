---
sprint: 181
title: "레거시 SQL 문제 category 백필"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-180", "sprint-178", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 181 — 레거시 SQL 문제 category 백필

## 목표

- Sprint 151이 `problems.category`(ALGORITHM/SQL) 컬럼을 추가했고, 문제 상세 페이지는 **저장된** `problem.category === 'SQL'`일 때만 에디터 언어를 자동 `'sql'`로 선택한다(`frontend/.../problems/[id]/page.tsx`). 그런데 컬럼 추가 마이그레이션 `AddCategoryToProblems(1709000016000)`가 기존 행 전부에 `DEFAULT 'ALGORITHM'`을 적용했다.
- category 입력 UI는 Sprint 178, Programmers 검색 결과 자동 전파는 Sprint 180에서야 들어왔으므로, **그 이전 등록된 레거시 Programmers SQL 문제는 전부 category=ALGORITHM으로 저장**되어 있다. → 레거시 SQL 문제를 풀려고 상세에 진입하면 에디터가 항상 python으로 떠 매번 수동 전환해야 하는 **실제 UX 버그**. (검색 결과 표시는 Sprint 180 dual-check 헬퍼의 태그 fallback이 가려주지만, 저장 category에 의존하는 상세 페이지 auto-select는 가려지지 않는다.)
- 백필 마이그레이션으로 레거시 SQL 문제의 저장 category를 SQL로 보정해 Sprint 151→178→180 category 기능 arc를 데이터까지 완성한다.

## 결정

### D1. 선례 패턴을 따른 단일 데이터 보정 마이그레이션

`BackfillLevelFromDifficulty(1709000015000)` 선례를 그대로 따른 순수 DML(UPDATE) 마이그레이션. 스키마 변경 없음(Expand-Contract). 타임스탬프 `1709000017000` > `AddCategoryToProblems`의 `...16000`이라 컬럼 생성 이후 실행이 보장된다. `migration-naming.md` 규칙(1 마이그레이션 = 1 변경 단위, DDL/DML 미혼합, up/down 필수)을 준수한다.

### D2. SQL 판정 신호 = frontend dual-check 헬퍼 미러링

백필의 SQL 판정은 시스템 자신의 정의(`isProgrammersSqlProblem`: `tags.some(t => t.toUpperCase() === 'SQL')`)와 **동일 신호**를 사용한다. `tags`는 `simple-json`(JSON 텍스트 `["SQL",...]`)으로 저장되므로 `tags ILIKE '%"sql"%'`로 배열 원소 `"SQL"`/`"sql"` 등을 case-insensitive 정확 매칭한다. JSON 따옴표를 패턴에 포함해 `"NoSQL"`·`"SQL injection"` 같은 부분문자열은 매칭되지 않으므로 헬퍼의 exact `=== 'SQL'` 의미를 보존한다.

### D3. Programmers 식별 = platform OR source_url dual 조건 (Critic 근거로 보강)

SQL Kit 출처는 Programmers뿐(solved.ac/BOJ/LeetCode에는 SQL 카테고리 개념 없음)이므로 거짓 양성 차단을 위해 Programmers 행으로 한정한다. 초기 구현은 `LOWER(source_platform) = 'programmers'` 단일 가드였으나, Critic R1이 **`sourcePlatform`이 optional(DTO `@IsOptional`)이라 platform 없이 `source_url`만 저장된 레거시 SQL 문제가 제외되어 버그가 잔존**함을 적발했다. → Programmers 식별을 `source_platform = programmers` **또는** `source_url ILIKE '%programmers.co.kr%'` dual 조건으로 보강해 URL-only 레거시 행도 포함하면서 Programmers 한정(거짓 양성 차단)은 유지했다.

## 구현

### PR (services/problem, 단일 작업 브랜치 `chore/sprint-181-backfill-sql-category`, 2 commits)

- `9c6c565` fix — 백필 마이그레이션 신규(`1709000017000-BackfillSqlCategory.ts`). up: `category='SQL'` where ALGORITHM + Programmers + 'SQL' 태그. down: best-effort 역보정.
- `1bfa9f1` fix (Critic R1 P2) — Programmers 식별을 platform OR source_url dual 조건으로 보강(URL-only 레거시 행 포함).

핵심 SQL (up):
```sql
UPDATE problems
SET category = 'SQL', updated_at = now()
WHERE category = 'ALGORITHM'
  AND tags ILIKE '%"sql"%'
  AND (LOWER(source_platform) = 'programmers' OR source_url ILIKE '%programmers.co.kr%')
```

down은 동일 휴리스틱으로 SQL→ALGORITHM 역보정한다. Sprint 178+ 폼으로 SQL 설정된 행도 동일 휴리스틱에 매칭되면 함께 되돌려지는 stateless 한계가 있으나, 선례 `BackfillLevelFromDifficulty.down`의 동일한 불완전성을 계승·문서화했다(롤백 시나리오 한정 best-effort).

## Critic 사이클

`codex review --base main` 2라운드.

- **R1** (session `019e47d1`): **P2** — `LOWER(source_platform)='programmers'` 단일 가드가 platform 누락 + Programmers `source_url`·'SQL' 태그를 가진 레거시 행을 제외해 버그 잔존(false-negative). → platform OR source_url dual 조건으로 해소.
- **R2** (session `019e47d4`): **0건** 통과 — "마이그레이션이 좁게 스코프되고 기존 스키마에 유효한 PostgreSQL 술어를 사용하며 명백한 기능 회귀가 없다. diff에서 조치 가능한 정확성 이슈 없음." 머지 가능.

## 검증

### 로컬
- `tsc --noEmit` 0 errors.
- ESLint 0 errors / 0 warnings (신규 마이그레이션 파일).
- jest 170 tests 전부 통과 / 0 fail (무회귀).

### 데이터 정합 (UAT 이월)
- `services/problem`은 테스트 DB 인프라(pg-mem/testcontainers)가 없고 `pg`만 사용하므로, 마이그레이션은 선례와 동일하게 무-단위테스트이며 배포 시점에 검증된다. SQL 휴리스틱(ILIKE 매칭 정확성·dual 가드 폭·down 한계)은 Critic Codex 교차 검증으로 보완했다.

### CI
- 작업 PR + ADR PR 전체 checks green(Build Blog 포함 — ADR `sprints/**` 트리거).

## 결과

- **머지**: origin/main `ed38eb5` → `b1b48aa` (PR #315 squash merge, 작업 브랜치 삭제).
- **순변경**: `services/problem/src/database/migrations/1709000017000-BackfillSqlCategory.ts` 신규 1파일 (브랜치 2 commits → squash).
- ADR sprint-181(KR+EN) + README sprint ADR count 119→120·범위 62~181 (별도 ADR PR).

## 신규 패턴

- **컬럼 default가 데이터 부채를 만든다**: `ADD COLUMN ... NOT NULL DEFAULT`는 무중단(Expand-Contract)이지만, 기존 행을 일괄 기본값으로 채워 "기능은 맞으나 데이터가 틀린" 부채를 남긴다. 그 컬럼의 **소비처**(여기서는 상세 페이지 auto-language-select)가 default 값으로 잘못 동작하면, 입력 UI 추가(Sprint 178)만으로는 부족하고 **레거시 데이터 백필**까지 해야 기능 arc가 완성된다.
- **백필 휴리스틱은 소비처의 판정 신호를 미러링한다**: 백필이 "무엇이 SQL 문제인가"를 독자 정의하면 frontend 표시 로직과 어긋난다. 시스템이 이미 가진 판정 헬퍼(`isProgrammersSqlProblem`)의 신호(태그)를 그대로 SQL로 옮겨 SSOT 일관성을 유지했다.

## 교훈

- **교차 리뷰가 nullable 컬럼의 false-negative를 적발**: Critic(Codex 교차 검증)이 `sourcePlatform` optional이라는 스키마 사실로부터, platform-only 가드가 URL-only 레거시 행을 놓쳐 **백필이 고치려던 바로 그 버그를 일부 행에 잔존**시킨다는 점을 적발했다. 보수적 가드(거짓 양성 차단)와 완전 커버리지(거짓 음성 차단)의 균형은, optional 식별 컬럼의 경우 단일 신호가 아니라 **대체 신호(URL)와의 OR 조건**으로 잡아야 함을 재확인했다.
- **DB 무테스트 환경에서 교차 리뷰가 검증 보완재**: 테스트 DB 인프라가 없는 마이그레이션은 SQL 술어의 정확성을 단위테스트로 잡을 수 없어, Codex 교차 리뷰가 ILIKE 패턴·가드 폭의 사실상 유일한 자동 검증 계층 역할을 했다.

## 이월 항목 (Sprint 182+)

- **UAT 사용자 직접**: 레거시 Programmers SQL 문제(Sprint 178 이전 등록) 상세 진입 시 에디터 언어가 자동 `sql`로 선택되는지 / 일반 ALGORITHM 문제는 영향 없는지(여전히 python 기본값) 확인 + Sprint 160~180 누적 UAT 계승.
- 후속: coverage-gate skipped 허용 제거(실제 skipped 0건이라 보류 가능), `(adr)` layout 분할, prom-client Case B~D 점검 자동화, `.claude-tools/` Phase 2 실제 삭제(trigger path 검증 후).
