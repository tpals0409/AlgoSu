/**
 * @file submissions 테이블에 publicId UUID v4 컬럼 추가
 * @domain submission
 * @layer migration
 * @related Submission
 *
 * Expand-Contract 패턴:
 * 1. nullable UUID 컬럼 추가
 * 2. 기존 데이터에 gen_random_uuid() 생성
 * 3. NOT NULL 제약 추가
 * 4. COMMIT → CREATE UNIQUE INDEX CONCURRENTLY → BEGIN
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicIdToSubmissions1709000004000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. nullable UUID 컬럼 추가 (IF NOT EXISTS — idempotent)
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "publicId" uuid`,
    );

    // 2. 기존 데이터에 UUID 생성
    await queryRunner.query(
      `UPDATE "submissions" SET "publicId" = gen_random_uuid() WHERE "publicId" IS NULL`,
    );

    // 3. NOT NULL 제약 추가
    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "publicId" SET NOT NULL`,
    );

    // 4. UNIQUE 인덱스 (CONCURRENTLY는 트랜잭션 외부 실행)
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_submissions_publicId" ON "submissions" ("publicId")`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_submissions_publicId"`,
    );
    await queryRunner.dropColumn('submissions', 'publicId');
  }
}
