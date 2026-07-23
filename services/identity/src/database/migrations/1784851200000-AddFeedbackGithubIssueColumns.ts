/**
 * @file feedbacks 테이블에 GitHub 이슈 연동 컬럼 추가
 * @domain identity
 * @layer migration
 * @related feedback.entity.ts, github-issue.service.ts
 *
 * github_issue_number / github_issue_url — 피드백↔GitHub 이슈 연결 및 중복 생성 방지.
 * 둘 다 nullable: 토큰 미설정·생성 실패 시 null 유지(피드백 저장 무영향).
 *
 * 타임스탬프 규칙(Critic PR#497 P1): TypeORM은 클래스명 뒤 13자리(.substr(-13))로
 *   마이그레이션 순서를 결정한다. YYYYMMDDHHMMSS(14자리)를 쓰면 앞 1자리가 잘려
 *   1709000017000(feedbacks 생성)보다 앞서 정렬 → 빈 DB에서 ALTER 실패.
 *   따라서 13자리 epoch-ms(1784851200000, 2026-07-23)로 지정해 feedbacks 뒤에 정렬.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackGithubIssueColumns1784851200000
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
