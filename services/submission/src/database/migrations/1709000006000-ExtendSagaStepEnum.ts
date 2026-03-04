/**
 * @file saga_step_enum에 AI_SKIPPED 값 추가
 * @domain submission
 * @layer migration
 * @related Submission.sagaStep
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendSagaStepEnum1709000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(
      `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'saga_step_enum' AND e.enumlabel = 'AI_SKIPPED'`,
    );
    if (!exists.length) {
      // ALTER TYPE ADD VALUE는 트랜잭션 외부에서 실행
      await queryRunner.query('COMMIT');
      await queryRunner.query(
        `ALTER TYPE "saga_step_enum" ADD VALUE 'AI_SKIPPED' AFTER 'AI_QUEUED'`,
      );
      await queryRunner.query('BEGIN');
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL에서 enum 값 삭제는 불가 — down은 no-op
  }
}
