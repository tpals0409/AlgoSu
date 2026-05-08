/**
 * @file 20260508000000-AddProblemContextColumns.ts — submissions 테이블에 problem_title, problem_description 컬럼 추가
 * @domain submission
 * @layer migration
 * @related submission.entity.ts, submission.service.ts
 *
 * Sprint 143 시드 #4 (Option A):
 * ai-analysis worker가 문제 컨텍스트 없이 LLM을 호출하는 인프라 결함 근본 해결.
 * Submission 생성 시 Problem Service에서 title/description을 조회하여 저장.
 * 기존 row는 nullable로 유지 (backfill은 별도 처리).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProblemContextColumns20260508000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS problem_title VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS problem_description TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions DROP COLUMN IF EXISTS problem_description`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions DROP COLUMN IF EXISTS problem_title`,
    );
  }
}
