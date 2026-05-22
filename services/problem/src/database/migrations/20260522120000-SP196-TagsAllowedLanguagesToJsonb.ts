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
 * - ALTER TYPE은 테이블 rewrite 유발 → SET LOCAL statement_timeout=0 설정 필수
 * - CREATE INDEX CONCURRENTLY는 트랜잭션 외부 실행(COMMIT/BEGIN 패턴, AddPublicIdToProblems 선례)
 * - 순수 DDL (데이터 보정 없음 — 현 seed는 NULL 또는 유효 JSON뿐이라 안전)
 * - BackfillSqlCategory(1709000017000)는 varchar 시점에 이미 실행 → 순서 안전
 *
 * down(): best-effort — jsonb::text 정규화로 500자 초과 가능 (BackfillSqlCategory.down 스타일 계승)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagsAllowedLanguagesToJsonb20260522120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // statement_timeout 해제 — ALTER TYPE은 테이블 rewrite 유발, 200ms 초과 가능
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);

    // tags: varchar(500) → jsonb (NULL 명시 보존)
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN tags TYPE jsonb
        USING CASE WHEN tags IS NULL THEN NULL ELSE tags::jsonb END
    `);

    // allowed_languages: varchar(500) → jsonb (NULL 명시 보존)
    await queryRunner.query(`
      ALTER TABLE problems
        ALTER COLUMN allowed_languages TYPE jsonb
        USING CASE WHEN allowed_languages IS NULL THEN NULL ELSE allowed_languages::jsonb END
    `);

    // GIN 인덱스는 CONCURRENTLY → 트랜잭션 외부 실행 (AddPublicIdToProblems 패턴 답습)
    await queryRunner.query('COMMIT');
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
  }
}
