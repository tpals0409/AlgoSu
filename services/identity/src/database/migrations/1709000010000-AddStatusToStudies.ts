/**
 * @file 1709000010000-AddStatusToStudies.ts — studies 테이블 status 컬럼 추가
 * @domain identity
 * @layer migration
 * @related study.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToStudies1709000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // idempotent: 이미 존재하면 skip
    const hasColumn = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'studies' AND column_name = 'status'
    `);
    if (hasColumn.length > 0) return;

    await queryRunner.query(`
      ALTER TABLE studies
      ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE studies DROP COLUMN IF EXISTS status`);
  }
}
