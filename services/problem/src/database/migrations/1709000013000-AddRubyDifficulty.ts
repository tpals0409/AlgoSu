/**
 * @file 1709000013000-AddRubyDifficulty.ts — difficulty_enum에 RUBY 값 추가
 * @domain problem
 * @layer migration
 * @related problem.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRubyDifficulty1709000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE difficulty_enum ADD VALUE IF NOT EXISTS 'RUBY'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support DROP VALUE from enum — manual intervention required
    void 0;
  }
}
