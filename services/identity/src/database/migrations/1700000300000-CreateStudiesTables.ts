import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Librarian(기록관리자) — Phase A
 * studies, study_members, study_invites 테이블 신설
 *
 * DB: identity_db (identity_user 전용)
 *
 * Expand-Contract 패턴 준수:
 * - 롤백 가능한 down() 함수 필수
 * - 인덱스: CONCURRENTLY 옵션 적용
 */
export class CreateStudiesTables1700000300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // studies 테이블
    await queryRunner.query(`
      CREATE TABLE studies (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         VARCHAR(100) NOT NULL,
        description  TEXT,
        created_by   UUID NOT NULL,
        github_repo  VARCHAR(255),
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // study_members 테이블
    await queryRunner.query(`
      CREATE TABLE study_members (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_id   UUID NOT NULL REFERENCES studies(id),
        user_id    UUID NOT NULL,
        role       VARCHAR(10) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
        joined_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (study_id, user_id)
      )
    `);

    // study_invites 테이블
    await queryRunner.query(`
      CREATE TABLE study_invites (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_id    UUID NOT NULL REFERENCES studies(id),
        code        VARCHAR(20) NOT NULL UNIQUE,
        created_by  UUID NOT NULL,
        expires_at  TIMESTAMP NOT NULL,
        used_count  INTEGER NOT NULL DEFAULT 0,
        max_uses    INTEGER,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // study_members 조회 인덱스
    await queryRunner.query(`
      CREATE INDEX idx_study_members_user_id
      ON study_members (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_study_members_study_id
      ON study_members (study_id)
    `);

    // study_invites 만료 조회 인덱스
    await queryRunner.query(`
      CREATE INDEX idx_study_invites_expires_at
      ON study_invites (expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS study_invites`);
    await queryRunner.query(`DROP TABLE IF EXISTS study_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS studies`);
  }
}
