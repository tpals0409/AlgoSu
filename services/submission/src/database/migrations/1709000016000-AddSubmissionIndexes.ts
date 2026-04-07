import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionIndexes1709000016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX idx_submissions_study_user ON submissions (study_id, user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_submissions_study_problem ON submissions (study_id, problem_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_submissions_study_problem`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_submissions_study_user`);
  }
}
