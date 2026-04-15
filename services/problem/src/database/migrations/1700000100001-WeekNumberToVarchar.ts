/**
 * @file 1700000100001-WeekNumberToVarchar.ts — week_number 컬럼 integer→varchar 변환
 * @domain problem
 * @layer migration
 * @related problem.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeekNumberToVarchar1700000100001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE problems ALTER COLUMN week_number TYPE varchar(20) USING week_number::text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE problems ALTER COLUMN week_number TYPE integer USING week_number::integer`,
    );
  }
}
