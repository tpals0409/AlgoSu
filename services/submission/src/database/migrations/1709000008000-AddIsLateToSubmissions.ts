/**
 * @file submissions 테이블에 is_late BOOLEAN 컬럼 추가
 * @domain submission
 * @layer migration
 * @related Submission
 *
 * 마감 후 제출 여부를 표시하는 플래그
 * default false + NOT NULL — 기존 데이터 즉시 적용
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsLateToSubmissions1709000008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "is_late" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('submissions', 'is_late');
  }
}
