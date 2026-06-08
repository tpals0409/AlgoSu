---
sprint: 230
title: "problem-service SP196 마이그레이션 fix (tags jsonb DEFAULT cast 실패 — ERROR 42804)"
date: "2026-06-08"
status: completed
agents: [Oracle, Scribe, Librarian, Critic]
related_adrs: ["sprint-196"]
related_memory: ["sprint-window"]
topics: ["problem", "database", "migration", "operations"]
tldr: "운영 cluster(OCI ARM k3s) f4493ac 롤아웃에서 problem-service만 db-migrate init container가 Init:CrashLoopBackOff(restart 4+). SP196 마이그레이션 20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts의 첫 쿼리 `ALTER COLUMN tags TYPE jsonb`가 PostgreSQL ERROR 42804(default for column \"tags\" cannot be cast automatically to type jsonb)로 실패. 근본 원인: 1700000100002-AddTagsColumn이 `tags varchar(500) DEFAULT NULL`로 생성 → ALTER COLUMN TYPE이 행 데이터(USING)뿐 아니라 카탈로그에 저장된 DEFAULT 식(NULL::character varying)도 새 타입으로 cast 시도하나 varchar→jsonb 할당 cast가 없어 42804. allowed_languages는 DEFAULT 없으나 tags에서 먼저 죽어 도달조차 못 함. 운영 DB는 트랜잭션 롤백으로 미적용(tags 여전히 varchar(500), 마이그레이션 미기록) → 수정 후 재실행 안전. 표준 DEFAULT 보존 type-change 순서로 수정: up()은 각 컬럼 TYPE 변경 직전 DROP DEFAULT 추가(tags 필수·allowed_languages 방어적 no-op), entity가 jsonb 컬럼에 default 미선언이라 SET DEFAULT 재설정 안 함; down()은 varchar 역변환 후 tags SET DEFAULT NULL 복원(완전 가역). timestamp/클래스명 불변. 신규 spec(QueryRunner mock SQL 순서 단언). 검증: tsc 0·eslint 0 error·jest 191 PASS(신규 6)·커버리지 99.14/96.68/98.48/99.05(게이트 98/96/98/98 통과). 머지 후 CI build→ArgoCD 롤아웃으로 8/8 서비스 최신 이미지 반영."
---
# Sprint 230 — problem-service SP196 마이그레이션 fix (tags jsonb DEFAULT cast 실패 — ERROR 42804)

## 목표

- 운영 cluster(OCI ARM k3s)의 f4493ac 롤아웃에서 **problem-service만** `Init:CrashLoopBackOff`로 막혀 7/8 서비스만 최신 이미지가 반영된 상태를 해소한다.
- SP196 jsonb 전환 마이그레이션의 `ALTER COLUMN tags TYPE jsonb` 실패(PostgreSQL **ERROR 42804**)를 표준 DEFAULT 보존 type-change 순서로 근본 수정한다.
- 머지 → CI build → ghcr → aether-gitops → ArgoCD 롤아웃으로 problem-service 신규 SHA가 Running 되어 **8/8 서비스 최신 이미지 운영 반영**을 완료 조건으로 한다.

## 배경

- 운영 롤아웃 점검에서 `problem-service-78d985598f-7q8db` pod가 `Init:CrashLoopBackOff`(db-migrate init container, restart 4+). 다른 7개 서비스(ai-analysis·blog·frontend·gateway·github-worker·identity·submission)는 f4493ac 최신 이미지로 정상 롤아웃, 구버전 problem-service만 Running 유지.
- 실패 쿼리(init container 로그): `ALTER TABLE problems ALTER COLUMN tags TYPE jsonb USING CASE WHEN tags IS NULL THEN NULL ELSE tags::jsonb END` → `ERROR 42804: default for column "tags" cannot be cast automatically to type jsonb` (tablecmds.c:12655, ATExecAlterColumnType).
- 이 마이그레이션(`20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`)은 Sprint 196에 머지됐으나 운영 DB에는 미적용 이월 상태였고, f4493ac 롤아웃에서 처음 실행되며 실패했다.

## 근본 원인 (코드로 확정)

1. `1700000100002-AddTagsColumn.ts`가 `tags`를 `ALTER TABLE problems ADD COLUMN tags varchar(500) DEFAULT NULL`로 생성 → 카탈로그(`pg_attrdef`)에 DEFAULT 식 `NULL::character varying`가 저장됨.
2. `ALTER COLUMN ... TYPE`는 행 데이터(USING 절)뿐 아니라 **컬럼에 저장된 DEFAULT 식도 새 타입으로 자동 cast** 시도한다. `USING`은 행 데이터에만 적용되고 DEFAULT 식에는 적용되지 않는다.
3. `NULL::character varying`을 jsonb로 변환할 **할당(assignment) cast가 없어** PostgreSQL이 42804를 던진다.
4. `allowed_languages`는 `1700000100000-CreateProblemsTable.ts`에서 DEFAULT 절 없이 생성 → 본래 안전하나, 마이그레이션이 tags에서 먼저 죽어 도달조차 못 했다.
5. 마이그레이션 첫 ALTER가 실패하면 트랜잭션이 롤백되어 운영 `problems.tags`는 **여전히 varchar(500)**이고 TypeORM `migrations` 테이블에도 미기록 → **수정 후 재실행이 안전**하다.

## 결정

### D1. 표준 DEFAULT 보존 type-change 순서 (up)

각 컬럼 TYPE 변경 **직전에 `ALTER COLUMN <col> DROP DEFAULT`를 추가**한다.
- `tags`: DEFAULT NULL이 42804를 유발하므로 **필수**.
- `allowed_languages`: 본래 DEFAULT 없음이나 **방어적으로 DROP DEFAULT(no-op)** 후 전환 — 환경별 DEFAULT 잔존 가능성 대비, tags와 대칭.
- USING NULL 가드·`SET LOCAL statement_timeout=0`·COMMIT/`CREATE INDEX CONCURRENTLY`/BEGIN 골격은 **그대로 유지**.

### D2. SET DEFAULT 재설정 안 함

`problem.entity.ts`의 `tags`·`allowedLanguages`는 `@Column({ type: 'jsonb', nullable: true })`로 **default를 선언하지 않는다** → 컬럼 기본값은 암묵적 NULL = entity 정합. `DEFAULT NULL` 재부여는 무의미하므로 up()에서 SET DEFAULT를 발행하지 않는다.

### D3. down() 완전 가역화

varchar(500) 역변환 후 `ALTER COLUMN tags SET DEFAULT NULL`을 추가해 **AddTagsColumn의 원본 카탈로그 상태를 복원**한다. up()이 DROP한 DEFAULT를 down이 되돌려 round-trip 무결성을 보장한다. allowed_languages는 본래 DEFAULT가 없으므로 복원 대상 아님.

### D4. timestamp/클래스명 불변

`20260522120000` / `TagsAllowedLanguagesToJsonb20260522120000`는 **변경 금지**. TypeORM은 마이그레이션 name으로 적용 여부를 추적하므로, 다른 환경(로컬·CI)에 이미 적용됐을 가능성을 고려해 식별자를 보존하고 **body만 수정**한다.

### D5. USING 가드는 NULL만 (데이터 보정 없음)

entity가 `string[] | null`을 JSON 직렬화하므로 물리값은 NULL 또는 유효 JSON 텍스트뿐(빈 문자열 불가). 빈 문자열→`'[]'` 같은 데이터 보정은 추가하지 않는다(SP196 "순수 DDL, 데이터 보정 없음" 의도 존중).

## 구현

2 atomic commit (start `f4493ac`):

| 커밋 | 내용 |
|------|------|
| `6a4cbf4` | `20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts` — up() tags·allowed_languages TYPE 변경 직전 DROP DEFAULT 추가, down() tags SET DEFAULT NULL 복원, @file 헤더 42804 사유 명문화 / 신규 `*.spec.ts` — QueryRunner mock으로 DROP-DEFAULT-before-TYPE 순서·CONCURRENTLY 골격·down 대칭 단언(6 테스트) |
| (ADR) | `sprint-230.md` KR+EN, README index 167→168 |
| (Critic P1) | spec을 `migrations/` → `src/database/__tests__/`로 이동 — 아래 D6 참조 |

### D6. spec을 migrations glob 밖으로 이동 (Critic R1 P1)

Critic(Codex)이 **[P1] 차단 결함**을 지적: 이 서비스는 `tsconfig.build.json`이 없어 `nest build`가 `*.spec.ts`까지 dist에 컴파일하고(기존 dist에 `*.spec.js` 다수 존재 확인), `data-source.ts`의 마이그레이션 glob `migrations/*{.ts,.js}`이 `migrations/` 직속 `.spec.js`를 매칭한다. spec을 `migrations/`에 두면 `migration:run`이 컴파일된 spec을 require → Jest 글로벌 없이 top-level `describe()` 실행 → **db-migrate init container 크래시**(정확히 본 스프린트가 고치려는 롤아웃 경로 재파손). → spec을 `src/database/__tests__/`(glob 미매칭 형제 디렉토리)로 이동하고 import를 `../migrations/...`로 수정. 실증: 새 `nest build` 후 `dist/src/database/migrations/`에 spec.js 없음 확인.

## 검증

- **tsc**: 오류 0 (`npm run typecheck`).
- **eslint**: 변경 파일 0 issue, 전체 0 error.
- **jest**: **191 PASS / 0 FAIL** (신규 마이그레이션 spec 6 포함, 17 suites).
- **커버리지**: lines **99.14%** / branches **96.68%** / functions **98.48%** / statements **99.05%** (게이트 98/96/98/98 통과). 마이그레이션 파일은 jest `collectCoverageFrom`의 `!**/database/**`로 커버리지 제외 — spec은 실행되어 회귀를 차단하나 게이트 산정에는 무영향.
- **실 DB dry-run 불가**(작업 환경 제약: docker 미실행·로컬 postgres 없음·kubectl이 로컬 미가동 클러스터를 가리킴, 운영 OCI는 별개 레이어) → in-env 검증은 정적(tsc/lint) + SQL 순서 단언 spec으로 구성. 실 롤아웃 검증은 머지 후 운영 측에서 수행.
- **ADR 게이트**: index count (sprint **168**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **`ALTER COLUMN ... TYPE`는 행 데이터뿐 아니라 컬럼 DEFAULT 식도 새 타입으로 cast한다** — `USING`은 행에만 적용되고 카탈로그 DEFAULT에는 적용되지 않는다. 타입을 바꿀 때는 항상 **DROP DEFAULT → TYPE 변경 → (필요 시) SET DEFAULT** 순서를 따른다.
2. **`DEFAULT NULL`도 42804를 유발한다** — NULL 리터럴 default가 `NULL::<원타입>`으로 카탈로그에 저장되어, 새 타입으로의 할당 cast가 없으면 cast 불가. "DEFAULT가 NULL이니 괜찮다"는 직관은 틀리다.
3. **타입 변경 마이그레이션은 DB 미가용 환경에서도 SQL 순서 단언 spec으로 회귀를 잡을 수 있다** — QueryRunner를 mock해 "DROP DEFAULT가 TYPE 변경보다 먼저 발행되는가"를 결정적으로 검증한다(실 DB 없이).
4. **이미 머지됐으나 미적용 이월된 마이그레이션은 body만 안전하게 고칠 수 있다** — 트랜잭션 롤백으로 스키마·migrations 테이블이 변경되지 않았다면, timestamp/클래스명을 보존한 채 body 수정 후 재실행하면 된다.

신규패턴:
- **DEFAULT 보존 type-change 마이그레이션 패턴** — 컬럼 타입 전환 시 `DROP DEFAULT → ALTER TYPE(USING) → (entity가 default 선언 시) SET DEFAULT`, down은 원본 DEFAULT 복원으로 완전 가역.

## Sprint 231+ 이월

- **(운영 검증) 머지 후 problem-service 롤아웃 확인** — `kubectl get pods -n algosu -l app=problem-service`에서 신규 SHA pod Running 확인 = 8/8 서비스 최신 이미지 반영 완료.
- (운영 실행) 라이브 `/quiz` 검증(`quiz-ui-verification` 런북, 221~229) / SP217 컷오버 / GA4 admin 설정·UAT / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli 0.130.0 (`codex review --base f4493ac -c model=gpt-5.5` — 기본 gpt-5.3-codex는 ChatGPT 계정 미지원이라 gpt-5.5 명시).
- **R1 [P1]**: spec을 `migrations/` 디렉토리에 배치 → 빌드된 `*.spec.js`가 마이그레이션 glob에 매칭돼 `migration:run`이 require → init container 크래시 위험(롤아웃 경로 재파손). → D6대로 `src/database/__tests__/`로 이동 + 실증.
- **R2 CLEAN**: 결함 0 — "drops defaults before changing varchar columns to jsonb and keeps the test outside the migrations glob, addressing the rollout failure without introducing an evident regression."
