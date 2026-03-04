import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubTokenColumn1709000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'github_token'
    `);
    if (hasColumn.length === 0) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN github_token TEXT NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS github_token`);
  }
}
