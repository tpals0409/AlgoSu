/**
 * @file 20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts — tags·allowed_languages varchar(500) → jsonb 전환 + GIN 인덱스
 * @domain problem
 * @layer database/migration
 * @related problem.entity.ts, 1709000017000-BackfillSqlCategory.ts
 *
 * Sprint 196: Problem 서비스 tags·allowed_languages 컬럼을 varchar(500)에서 PostgreSQL native jsonb로 전환.
 * - tags: GIN 인덱스(jsonb_path_ops) 추가 → @> containment 필터 성능 확보
 * - allowed_languages: 타입 전환만, 인덱스 불필요(필터 대상 아님)
 *
 * 주의사항:
 * - ALTER COLUMN TYPE은 행 데이터(USING)뿐 아니라 컬럼의 기존 DEFAULT 식도 새 타입으로 자동 cast 시도함.
 *   tags는 1700000100002-AddTagsColumn에서 `varchar(500) DEFAULT NULL`로 생성 → 카탈로그 DEFAULT 식
 *   `NULL::character varying`을 jsonb로 변환할 할당 cast가 없어 PostgreSQL ERROR 42804
 *   (default for column "tags" cannot be cast automatically to type jsonb) 발생.
 *   → TYPE 변경 직전에 `ALTER COLUMN <col> DROP DEFAULT`로 DEFAULT를 먼저 제거(Sprint 230 운영 fix).
 *   entity(problem.entity.ts)가 jsonb 컬럼에 default를 선언하지 않으므로 변환 후 SET DEFAULT 불필요
 *   (컬럼 기본값은 암묵적 NULL = entity 정합).
 * - ALTER TYPE은 테이블 rewrite 유발 → 트랜잭션 내 SET LOCAL statement_timeout=0 설정 필수
 * - CREATE INDEX CONCURRENTLY는 트랜잭션 외부 실행(COMMIT/BEGIN 패턴, AddPublicIdToProblems 선례)
 *   SET LOCAL은 COMMIT 시 소멸 → CONCURRENTLY 인덱스 빌드 보호 위해 COMMIT 직후 세션 레벨 재설정 필수
 *   (SET statement_timeout = 0, LOCAL 없이 — 세션 전체에 적용, CONCURRENTLY 완료 후 BEGIN으로 트랜잭션 재진입)
 * - 순수 DDL (데이터 보정 없음 — 현 seed는 NULL 또는 유효 JSON뿐이라 안전)
 * - BackfillSqlCategory(1709000017000)는 varchar 시점에 이미 실행 → 순서 안전
 *
 * down(): best-effort — jsonb::text 정규화로 500자 초과 가능 (BackfillSqlCategory.down 스타일 계승)
 *         DROP INDEX는 빠름(비-CONCURRENTLY) + 트랜잭션 내 ALTER TYPE → SET LOCAL으로 충분
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagsAllowedLanguagesToJsonb20260522120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // statement_timeout 해제 — ALTER TYPE은 테이블 rewrite 유발, 200ms 초과 가능
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);

    // tags: varchar(500) → jsonb (NULL 명시 보존)
    // 기존 DEFAULT NULL(::varchar)이 jsonb로 자동 cast 불가(ERROR 42804) → TYPE 변경 전 DEFAULT 제거
    await queryRunner.query(`ALTER TABLE problems ALTER COLUMN tags DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN tags TYPE jsonb
        USING CASE WHEN tags IS NULL THEN NULL ELSE tags::jsonb END
    `);

    // allowed_languages: varchar(500) → jsonb (NULL 명시 보존)
    // 본래 DEFAULT 없음이나 방어적으로 DROP DEFAULT(no-op) 후 전환 — 환경별 DEFAULT 잔존 대비
    await queryRunner.query(`ALTER TABLE problems ALTER COLUMN allowed_languages DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN allowed_languages TYPE jsonb
        USING CASE WHEN allowed_languages IS NULL THEN NULL ELSE allowed_languages::jsonb END
    `);

    // GIN 인덱스는 CONCURRENTLY → 트랜잭션 외부 실행 (AddPublicIdToProblems 패턴 답습)
    await queryRunner.query('COMMIT');
    // SET LOCAL은 COMMIT 시 소멸 → CONCURRENTLY 인덱스 빌드가 프로덕션 200ms timeout으로
    // 취소되지 않도록 세션 레벨(LOCAL 없이)로 재설정. BEGIN 재진입 후에도 세션값 유지.
    await queryRunner.query(`SET statement_timeout = 0`);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_tags_gin
        ON problems USING GIN (tags jsonb_path_ops)
    `);
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // GIN 인덱스 DROP (DROP은 빠름 — CONCURRENTLY 불필요)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_problems_tags_gin`);

    // statement_timeout 해제 — ALTER TYPE rewrite 가능
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);

    // best-effort 롤백: jsonb::text → varchar(500)
    // 주의: jsonb::text 정규화(키 정렬·공백 제거 등)로 원본 텍스트와 달라질 수 있음.
    //       배열 원소 합산 길이가 500자를 초과하면 truncation 오류 발생 가능.
    //       (BackfillSqlCategory.down 동일 best-effort 계승)
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN tags TYPE varchar(500)
        USING CASE WHEN tags IS NULL THEN NULL ELSE tags::text END
    `);
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN allowed_languages TYPE varchar(500)
        USING CASE WHEN allowed_languages IS NULL THEN NULL ELSE allowed_languages::text END
    `);

    // up()에서 제거한 tags의 원래 DEFAULT NULL 복원 (1700000100002-AddTagsColumn 카탈로그 상태 = 완전 가역)
    await queryRunner.query(`ALTER TABLE problems ALTER COLUMN tags SET DEFAULT NULL`);
  }
}
