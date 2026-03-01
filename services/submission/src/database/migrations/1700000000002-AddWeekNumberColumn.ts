import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * week_number 컬럼 추가 — H6 감사 이슈 대응
 * Problem 서비스의 weekNumber를 Submission에도 저장하여 주차별 조회 지원
 */
export class AddWeekNumberColumn1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions
        ADD COLUMN IF NOT EXISTS week_number integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions
        DROP COLUMN IF EXISTS week_number
    `);
  }
}
