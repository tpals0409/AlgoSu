/**
 * @file 1709000012000-AddLevelToProblems.ts — problems 테이블에 level(난이도 숫자) 컬럼 추가
 * @domain problem
 * @layer migration
 * @related problem.entity.ts, 1709000015000-BackfillLevelFromDifficulty.ts
 */
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
