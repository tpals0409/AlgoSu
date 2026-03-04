/**
 * @file notification_type_enum에 4개 값 추가 (9종 완성)
 * @domain notification
 * @layer migration
 * @related Notification
 *
 * 추가 ENUM 값: DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED
 * ALTER TYPE ADD VALUE는 트랜잭션 내부 실행 불가 → COMMIT 후 실행
 *
 * DB: identity_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendNotificationTypeEnum91709000006000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ADD VALUE는 트랜잭션 내부 실행 불가
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'DEADLINE_REMINDER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'MEMBER_JOINED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'MEMBER_LEFT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'STUDY_CLOSED'`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ENUM 값 삭제 직접 불가 — forward-only 원칙
    // 운영에서는 down() 실행하지 않음
    // 개발 환경 롤백 시: 타입 재생성 필요 (수동 대응)
  }
}
