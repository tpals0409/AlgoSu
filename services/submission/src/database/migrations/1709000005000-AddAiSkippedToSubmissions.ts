/**
 * @file submissions 테이블에 ai_skipped BOOLEAN 컬럼 추가
 * @domain submission
 * @layer migration
 * @related Submission
 *
 * AI 분석 건너뜀 여부 플래그
 * default false + NOT NULL — 기존 데이터 즉시 적용
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiSkippedToSubmissions1709000005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "ai_skipped" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP COLUMN IF EXISTS "ai_skipped"`,
    );
  }
}
