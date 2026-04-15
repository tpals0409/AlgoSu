/**
 * @file 20260408120000-SP61-CreateAiSatisfaction.ts — ai_satisfaction 테이블 생성 (좋아요/싫어요)
 * @domain submission
 * @layer migration
 * @related ai-satisfaction.entity.ts, create-ai-satisfaction.dto.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiSatisfaction20260408120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_satisfaction (
        id              SERIAL PRIMARY KEY,
        submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL,
        rating          SMALLINT NOT NULL CHECK (rating IN (1, -1)),
        comment         VARCHAR(500),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_ai_satisfaction_submission_user UNIQUE (submission_id, user_id)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_satisfaction_submission ON ai_satisfaction (submission_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_satisfaction;`);
  }
}
