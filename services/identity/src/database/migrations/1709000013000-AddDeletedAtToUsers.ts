/**
 * @file 1709000013000-AddDeletedAtToUsers.ts — users 테이블 deleted_at 소프트 삭제 컬럼 추가
 * @domain identity
 * @layer migration
 * @related user.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToUsers1709000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'deleted_at'
    `);
    if (hasColumn.length === 0) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS deleted_at`);
  }
}
