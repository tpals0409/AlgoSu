import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Librarian(기록관리자) — 핵심 스키마
 * submissions: saga_step ENUM 포함
 * drafts: (user_id, problem_id) UNIQUE 제약
 *
 * Expand-Contract 패턴 준수:
 * - 컬럼 삭제/rename은 별도 마이그레이션으로 분리
 * - 롤백 가능한 down() 함수 필수
 */
export class CreateSubmissionsAndDrafts1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // saga_step ENUM 타입 생성
    await queryRunner.query(`
      CREATE TYPE saga_step_enum AS ENUM (
        'DB_SAVED',
        'GITHUB_QUEUED',
        'AI_QUEUED',
        'DONE',
        'FAILED'
      )
    `);

    // github_sync_status ENUM ('SKIPPED' 추가 — github_repo 미연결 스터디 대응)
    await queryRunner.query(`
      CREATE TYPE github_sync_status_enum AS ENUM (
        'PENDING',
        'SYNCED',
        'FAILED',
        'TOKEN_INVALID',
        'SKIPPED'
      )
    `);

    // submissions 테이블
    await queryRunner.createTable(
      new Table({
        name: 'submissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'study_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Logical FK -> identity_db.studies(id) -- cross-DB, no physical FK',
          },
          { name: 'user_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'problem_id', type: 'uuid', isNullable: false },
          { name: 'language', type: 'varchar', length: '50', isNullable: false },
          { name: 'code', type: 'text', isNullable: false },
          {
            name: 'saga_step',
            type: 'saga_step_enum',
            isNullable: false,
            default: "'DB_SAVED'",
          },
          {
            name: 'github_sync_status',
            type: 'github_sync_status_enum',
            isNullable: false,
            default: "'PENDING'",
          },
          { name: 'github_file_path', type: 'varchar', length: '500', isNullable: true },
          { name: 'idempotency_key', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // idempotency_key 유니크 인덱스
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_submissions_idempotency_key
      ON submissions (idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);

    // study_id 기반 조회 인덱스 (스터디별 제출 조회)
    await queryRunner.query(`
      CREATE INDEX idx_submissions_study_id
      ON submissions (study_id)
    `);

    // saga_step 조회용 인덱스 (startup hook 재개 쿼리 최적화)
    await queryRunner.query(`
      CREATE INDEX idx_submissions_saga_step_created_at
      ON submissions (saga_step, created_at)
      WHERE saga_step != 'DONE' AND saga_step != 'FAILED'
    `);

    // drafts 테이블
    await queryRunner.createTable(
      new Table({
        name: 'drafts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'study_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Logical FK -> identity_db.studies(id) -- cross-DB, no physical FK',
          },
          { name: 'user_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'problem_id', type: 'uuid', isNullable: false },
          { name: 'language', type: 'varchar', length: '50', isNullable: true },
          { name: 'code', type: 'text', isNullable: true },
          { name: 'saved_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        uniques: [
          {
            name: 'uq_drafts_study_user_problem',
            columnNames: ['study_id', 'user_id', 'problem_id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('drafts', true);
    await queryRunner.dropTable('submissions', true);
    await queryRunner.query(`DROP TYPE IF EXISTS github_sync_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS saga_step_enum`);
  }
}
