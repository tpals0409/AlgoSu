import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeekNumberToVarchar1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions ALTER COLUMN week_number TYPE varchar(20) USING week_number::text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions ALTER COLUMN week_number TYPE integer USING week_number::integer`,
    );
  }
}
