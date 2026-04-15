/**
 * @file 1709000011000-AddStudyIdAndLinkToNotifications.ts — notifications에 study_id/link 컬럼 추가
 * @domain identity
 * @layer migration
 * @related notification.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudyIdAndLinkToNotifications1709000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // study_id 컬럼
    const hasStudyId = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'study_id'
    `);
    if (hasStudyId.length === 0) {
      await queryRunner.query(`ALTER TABLE notifications ADD COLUMN study_id UUID NULL`);
    }

    // link 컬럼
    const hasLink = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'link'
    `);
    if (hasLink.length === 0) {
      await queryRunner.query(`ALTER TABLE notifications ADD COLUMN link VARCHAR(500) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS link`);
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS study_id`);
  }
}
