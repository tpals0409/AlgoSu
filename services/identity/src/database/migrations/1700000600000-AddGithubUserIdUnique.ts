import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * github_user_id 부분 UNIQUE 인덱스 추가
 *
 * 1계정 = 1 GitHub 원칙을 DB 레벨에서 보장.
 * PostgreSQL은 NULL에 대해 UNIQUE를 허용하므로 부분 인덱스 사용.
 * github_user_id가 NOT NULL인 행만 UNIQUE 제약 적용.
 */
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
