import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Librarian(기록관리자) — Day 2
 * problems 테이블: 주차별 문제 관리, 마감 시간 제어
 *
 * DB: problem_db (problem_user 전용)
 *
 * Expand-Contract 패턴 준수:
 * - 롤백 가능한 down() 함수 필수
 * - 인덱스: CONCURRENTLY 옵션 적용
 */
export class CreateProblemsTable1700000100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // difficulty ENUM
    await queryRunner.query(`
      CREATE TYPE difficulty_enum AS ENUM (
        'BRONZE',
        'SILVER',
        'GOLD',
        'PLATINUM',
        'DIAMOND'
      )
    `);

    // problem_status ENUM
    await queryRunner.query(`
      CREATE TYPE problem_status_enum AS ENUM (
        'ACTIVE',
        'CLOSED',
        'DRAFT'
      )
    `);

    // problems 테이블
    await queryRunner.createTable(
      new Table({
        name: 'problems',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'week_number', type: 'integer', isNullable: false },
          {
            name: 'difficulty',
            type: 'difficulty_enum',
            isNullable: true,
          },
          { name: 'source_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'source_platform', type: 'varchar', length: '50', isNullable: true },
          {
            name: 'status',
            type: 'problem_status_enum',
            isNullable: false,
            default: "'ACTIVE'",
          },
          { name: 'deadline', type: 'timestamptz', isNullable: true },
          {
            name: 'allowed_languages',
            type: 'varchar',
            length: '500',
            isNullable: true,
            comment: 'JSON array of allowed language codes, e.g. ["python","java","cpp"]',
          },
          {
            name: 'study_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Logical FK -> identity_db.studies(id) -- cross-DB, no physical FK',
          },
          { name: 'created_by', type: 'varchar', length: '255', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // 주차별 조회 인덱스
    await queryRunner.query(`
      CREATE INDEX idx_problems_week_number
      ON problems (week_number)
    `);

    // 스터디별 + 주차별 복합 인덱스
    await queryRunner.query(`
      CREATE INDEX idx_problems_study_week
      ON problems (study_id, week_number)
    `);

    // 마감 시간 조회 인덱스 (활성 문제만)
    await queryRunner.query(`
      CREATE INDEX idx_problems_deadline_active
      ON problems (deadline)
      WHERE status = 'ACTIVE' AND deadline IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('problems', true);
    await queryRunner.query(`DROP TYPE IF EXISTS problem_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS difficulty_enum`);
  }
}
