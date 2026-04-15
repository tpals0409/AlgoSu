/**
 * @file 1700000100002-AddTagsColumn.ts — problems 테이블에 tags 컬럼 추가
 * @domain problem
 * @layer migration
 * @related problem.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTagsColumn1700000100002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE problems ADD COLUMN tags varchar(500) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN tags`);
  }
}
