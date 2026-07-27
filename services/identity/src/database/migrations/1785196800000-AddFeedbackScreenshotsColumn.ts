/**
 * @file feedbacks 테이블에 다중 스크린샷 컬럼(screenshots) 추가
 * @domain identity
 * @layer migration
 * @related feedback.entity.ts, feedback.service.ts
 *
 * 피드백폼 사진 다중 첨부(feedback #14) 지원. 기존 단일 `screenshot`(TEXT)은
 * 하위호환을 위해 유지하고, 다중 첨부는 jsonb 배열 컬럼 `screenshots`에 저장한다.
 * additive + nullable → 백필 불필요, 기존 행 무영향(저위험).
 *
 * 타임스탬프 규칙(scripts/check-migration-timestamps.mjs --strict, Critic PR#497 P1):
 *   파일명 앞 13자리 epoch-ms 필수. 1785196800000(2026-07-27)은 기존 최신 13자리
 *   1784851200000(github 이슈 컬럼)보다 뒤로 정렬된다.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackScreenshotsColumn1785196800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS screenshots JSONB NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedbacks DROP COLUMN IF EXISTS screenshots`,
    );
  }
}
