import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRubyDifficulty1709000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE difficulty_enum ADD VALUE IF NOT EXISTS 'RUBY'`,
    );
  }

  public async down(): Promise<void> {
    console.warn(
      'Cannot remove enum value RUBY from difficulty_enum — PostgreSQL does not support DROP VALUE. Manual intervention required.',
    );
  }
}
