/**
 * @file share_links 테이블 생성 마이그레이션
 * @domain share
 * @layer migration
 * @related sprint-48-guest-mode-public-profile.md §W1-1
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShareLinksTable1709000014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE share_links (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token       VARCHAR(64) NOT NULL,
        study_id    UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
        created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TIMESTAMP NULL,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    /* 토큰 조회용 UNIQUE 인덱스 (CONCURRENTLY: 락 최소화) */
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY "IDX_share_links_token" ON share_links (token)`,
    );
    await queryRunner.query('BEGIN');

    /* 스터디별 활성 링크 조회용 부분 인덱스 */
    await queryRunner.query(
      `CREATE INDEX "IDX_share_links_study_active" ON share_links (study_id, is_active, expires_at) WHERE is_active = TRUE`,
    );

    /* 생성자별 조회용 인덱스 */
    await queryRunner.query(
      `CREATE INDEX "IDX_share_links_created_by" ON share_links (created_by)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_share_links_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_share_links_study_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_share_links_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS share_links`);
  }
}
