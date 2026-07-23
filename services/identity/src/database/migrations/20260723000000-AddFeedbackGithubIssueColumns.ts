/**
 * @file feedbacks 테이블에 GitHub 이슈 연동 컬럼 추가
 * @domain identity
 * @layer migration
 * @related feedback.entity.ts, github-issue.service.ts
 *
 * github_issue_number / github_issue_url — 피드백↔GitHub 이슈 연결 및 중복 생성 방지.
 * 둘 다 nullable: 토큰 미설정·생성 실패 시 null 유지(피드백 저장 무영향).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackGithubIssueColumns20260723000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS github_issue_number INTEGER NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS github_issue_url VARCHAR(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedbacks DROP COLUMN IF EXISTS github_issue_url`,
    );
    await queryRunner.query(
      `ALTER TABLE feedbacks DROP COLUMN IF EXISTS github_issue_number`,
    );
  }
}
