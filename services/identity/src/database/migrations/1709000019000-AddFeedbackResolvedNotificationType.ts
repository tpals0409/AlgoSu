/**
 * @file notification_type_enum에 FEEDBACK_RESOLVED 추가
 * @domain notification
 * @layer migration
 * @related Notification
 *
 * ALTER TYPE ADD VALUE는 트랜잭션 내부 실행 불가 → COMMIT 후 실행
 *
 * DB: identity_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackResolvedNotificationType1709000019000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'FEEDBACK_RESOLVED'`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ENUM 값 삭제 직접 불가 — forward-only 원칙
  }
}
