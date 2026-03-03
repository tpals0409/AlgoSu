/**
 * @file studies 테이블에 publicId UUID v4 컬럼 추가
 * @domain study
 * @layer migration
 * @related Study
 *
 * Expand-Contract 패턴:
 * 1. nullable UUID 컬럼 추가
 * 2. 기존 데이터에 gen_random_uuid() 생성
 * 3. NOT NULL 제약 추가
 * 4. COMMIT → CREATE UNIQUE INDEX CONCURRENTLY → BEGIN
 *
 * DB: identity_db
 */
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPublicIdToStudies1709000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. nullable UUID 컬럼 추가
    await queryRunner.addColumn(
      'studies',
      new TableColumn({
        name: 'publicId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // 2. 기존 데이터에 UUID 생성
    await queryRunner.query(
      `UPDATE "studies" SET "publicId" = gen_random_uuid() WHERE "publicId" IS NULL`,
    );

    // 3. NOT NULL 제약 추가
    await queryRunner.query(
      `ALTER TABLE "studies" ALTER COLUMN "publicId" SET NOT NULL`,
    );

    // 4. UNIQUE 인덱스 (CONCURRENTLY는 트랜잭션 외부 실행)
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY "IDX_studies_publicId" ON "studies" ("publicId")`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_studies_publicId"`);
    await queryRunner.dropColumn('studies', 'publicId');
  }
}
