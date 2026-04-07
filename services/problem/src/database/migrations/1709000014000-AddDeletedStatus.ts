import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * problem_status_enum에 DELETED 값 추가
 * 마감(CLOSED)과 삭제(DELETED)를 구분하기 위한 마이그레이션
 *
 * Expand-Contract: ENUM 값 추가는 비파괴적 — 기존 CLOSED 행 영향 없음
 */
export class AddDeletedStatus1709000014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE problem_status_enum ADD VALUE IF NOT EXISTS 'DELETED'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support DROP VALUE from enum — manual intervention required
    void 0;
  }
}
