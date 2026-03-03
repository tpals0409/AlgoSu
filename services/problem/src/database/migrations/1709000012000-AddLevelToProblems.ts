import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLevelToProblems1709000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'problems' AND column_name = 'level'
    `);
    if (has.length > 0) return;
    await queryRunner.query(`ALTER TABLE problems ADD COLUMN level SMALLINT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN IF EXISTS level`);
  }
}
