/**
 * @file 1709000015000-AddSagaRetryCount.ts — submissions에 saga_retry_count 컬럼 추가
 * @domain submission
 * @layer migration
 * @related submission.entity.ts, saga-orchestrator.service.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSagaRetryCount1709000015000 implements MigrationInterface {
  name = 'AddSagaRetryCount1709000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN "saga_retry_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP COLUMN "saga_retry_count"`,
    );
  }
}
