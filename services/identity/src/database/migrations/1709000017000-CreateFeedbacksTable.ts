/**
 * @file 1709000017000-CreateFeedbacksTable.ts — feedbacks 테이블 신설 마이그레이션
 * @domain identity
 * @layer migration
 * @related feedback.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbacksTable1709000017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE feedbacks (
        id            SERIAL PRIMARY KEY,
        "publicId"    UUID NOT NULL UNIQUE,
        user_id       UUID NOT NULL,
        category      VARCHAR(30) NOT NULL,
        content       TEXT NOT NULL,
        page_url      VARCHAR(500),
        browser_info  VARCHAR(300),
        screenshot    TEXT,
        status        VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at   TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_feedbacks_user_id
      ON feedbacks (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_feedbacks_status
      ON feedbacks (status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_feedbacks_category
      ON feedbacks (category)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS feedbacks`);
  }
}
