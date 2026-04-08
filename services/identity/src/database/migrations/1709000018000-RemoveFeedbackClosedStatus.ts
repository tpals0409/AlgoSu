/**
 * @file CLOSED→RESOLVED 변환 + studyId 컬럼 추가 마이그레이션
 * @domain identity
 * @layer migration
 * @related feedback.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveFeedbackClosedStatus1709000018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE feedbacks SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()) WHERE status = 'CLOSED'`,
    );
    await queryRunner.query(
      `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS study_id UUID NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedbacks DROP COLUMN IF EXISTS study_id`,
    );
  }
}
