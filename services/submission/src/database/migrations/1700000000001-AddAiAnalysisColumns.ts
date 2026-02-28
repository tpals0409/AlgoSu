import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI 분석 결과 컬럼 추가 — Expand 단계
 * - ai_feedback: AI 분석 피드백 텍스트
 * - ai_score: AI 점수 (0-100)
 * - ai_optimized_code: AI 제안 최적화 코드
 * - ai_analysis_status: 분석 상태 (pending/completed/delayed/failed)
 */
export class AddAiAnalysisColumns1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions
        ADD COLUMN ai_feedback text,
        ADD COLUMN ai_score integer,
        ADD COLUMN ai_optimized_code text,
        ADD COLUMN ai_analysis_status varchar(20) DEFAULT 'pending'
    `);

    await queryRunner.query(`
      CREATE INDEX idx_submissions_ai_analysis_status
      ON submissions (ai_analysis_status)
      WHERE ai_analysis_status != 'completed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_submissions_ai_analysis_status`);
    await queryRunner.query(`
      ALTER TABLE submissions
        DROP COLUMN IF EXISTS ai_feedback,
        DROP COLUMN IF EXISTS ai_score,
        DROP COLUMN IF EXISTS ai_optimized_code,
        DROP COLUMN IF EXISTS ai_analysis_status
    `);
  }
}
