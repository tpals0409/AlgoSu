/**
 * @file studies 테이블에 avatar_url 컬럼 추가
 * @domain identity
 * @layer migration
 * @related sprint-52 스터디 아바타 기능 확장
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarUrlToStudies1709000016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'studies' AND column_name = 'avatar_url'
    `);
    if (hasColumn.length === 0) {
      await queryRunner.query(
        `ALTER TABLE studies ADD COLUMN avatar_url VARCHAR(500) NOT NULL DEFAULT 'preset:study-default'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE studies DROP COLUMN IF EXISTS avatar_url`,
    );
  }
}
