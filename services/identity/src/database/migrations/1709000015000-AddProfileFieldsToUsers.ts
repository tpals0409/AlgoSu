/**
 * @file users 테이블에 퍼블릭 프로필 필드 추가
 * @domain identity
 * @layer migration
 * @related sprint-48-guest-mode-public-profile.md §W1-1
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFieldsToUsers1709000015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /* profile_slug: 커스텀 프로필 URL (nullable, unique) */
    const hasSlug = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'profile_slug'
    `);
    if (hasSlug.length === 0) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN profile_slug VARCHAR(20) NULL`,
      );
    }

    /* is_profile_public: 프로필 공개 여부 (default false) */
    const hasPublic = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_profile_public'
    `);
    if (hasPublic.length === 0) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN is_profile_public BOOLEAN NOT NULL DEFAULT FALSE`,
      );
    }

    /* slug UNIQUE 인덱스 (CONCURRENTLY: 락 최소화) */
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY "IDX_users_profile_slug" ON users (profile_slug) WHERE profile_slug IS NOT NULL`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_profile_slug"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS is_profile_public`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS profile_slug`);
  }
}
