/**
 * @file 1700000600000-AddGithubUserIdUnique.ts — github_user_id 부분 UNIQUE 인덱스 추가
 * @domain identity
 * @layer migration
 * @related user.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubUserIdUnique1700000600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_users_github_user_id
      ON users (github_user_id)
      WHERE github_user_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_users_github_user_id`);
  }
}
