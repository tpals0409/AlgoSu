import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Librarian(기록관리자) — Day 2
 * profiles 테이블: 사용자 인증 프로필, 역할 관리, GitHub 연동 상태
 *
 * DB: identity_db (identity_user 전용)
 *
 * 보안 주의사항:
 * - github_token은 애플리케이션 레벨에서 AES-256-GCM 암호화 후 저장
 * - 복호화 키는 k3s Secret으로 관리 (코드/로그 노출 금지)
 *
 * Expand-Contract 패턴 준수
 */
export class CreateProfilesTable1700000200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_role ENUM
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM (
        'ADMIN',
        'MEMBER'
      )
    `);

    // github_token_status ENUM
    await queryRunner.query(`
      CREATE TYPE github_token_status_enum AS ENUM (
        'VALID',
        'INVALID',
        'NOT_CONNECTED'
      )
    `);

    // profiles 테이블
    await queryRunner.createTable(
      new Table({
        name: 'profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Supabase Auth UID or external identity provider ID',
          },
          { name: 'email', type: 'varchar', length: '320', isNullable: false },
          { name: 'display_name', type: 'varchar', length: '100', isNullable: false },
          { name: 'avatar_url', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'role',
            type: 'user_role_enum',
            isNullable: false,
            default: "'MEMBER'",
          },
          { name: 'github_username', type: 'varchar', length: '100', isNullable: true },
          {
            name: 'github_token_encrypted',
            type: 'text',
            isNullable: true,
            comment: 'AES-256-GCM encrypted OAuth token — NEVER log or expose',
          },
          {
            name: 'github_token_status',
            type: 'github_token_status_enum',
            isNullable: false,
            default: "'NOT_CONNECTED'",
          },
          { name: 'last_login_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // external_id 유니크 인덱스
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_profiles_external_id
      ON profiles (external_id)
    `);

    // email 유니크 인덱스
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_profiles_email
      ON profiles (email)
    `);

    // GitHub 연동 상태 필터 인덱스
    await queryRunner.query(`
      CREATE INDEX idx_profiles_github_status
      ON profiles (github_token_status)
      WHERE github_token_status != 'NOT_CONNECTED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('profiles', true);
    await queryRunner.query(`DROP TYPE IF EXISTS github_token_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum`);
  }
}
