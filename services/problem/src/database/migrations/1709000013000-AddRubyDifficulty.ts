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
