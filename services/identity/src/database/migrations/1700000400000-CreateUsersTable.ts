import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Librarian(기록관리자) — Phase A
 * users 테이블 신설: OAuth 인증 + GitHub 2단계 연동 지원
 *
 * DB: identity_db (identity_user 전용)
 *
 * 보안 주의사항:
 * - github_user_id, github_username은 GitHub OAuth 연동 완료 후에만 저장
 * - github_connected = FALSE인 사용자는 제출 차단 (Conductor에서 검증)
 *
 * Expand-Contract 패턴 준수:
 * - 롤백 가능한 down() 함수 필수
 */
export class CreateUsersTable1700000400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // oauth_provider ENUM
    await queryRunner.query(`
      CREATE TYPE oauth_provider_enum AS ENUM ('google', 'naver', 'kakao')
    `);

    // users 테이블
    await queryRunner.query(`
      CREATE TABLE users (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email             VARCHAR(255) NOT NULL UNIQUE,
        name              VARCHAR(100),
        avatar_url        VARCHAR(500),
        oauth_provider    oauth_provider_enum NOT NULL,
        github_connected  BOOLEAN NOT NULL DEFAULT FALSE,
        github_user_id    VARCHAR(100),
        github_username   VARCHAR(100),
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // GitHub username 조회 성능 인덱스 (부분 인덱스)
    await queryRunner.query(`
      CREATE INDEX idx_users_github_username
      ON users (github_username)
      WHERE github_username IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS oauth_provider_enum`);
  }
}
