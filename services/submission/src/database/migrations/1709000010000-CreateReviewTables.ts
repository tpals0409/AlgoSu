/**
 * @file review_comments + review_replies 테이블 생성 (soft-delete)
 * @domain review
 * @layer migration
 * @related ReviewComment, ReviewReply
 *
 * review_comments:
 *   - submissionId: int FK (submissions.id CASCADE) -- 주의: submissions PK가 uuid이므로 uuid 유지 불가, Oracle 지시에 따라 int
 *   - authorId: varchar(255), cross-DB logical FK (identity_db.users)
 *   - studyId: uuid, IDOR 방어용 스코핑 컬럼
 *   - lineNumber: nullable (전체 코멘트 vs 라인 코멘트)
 *   - deletedAt: soft-delete (@DeleteDateColumn)
 *
 * review_replies:
 *   - commentId: int FK (review_comments.id CASCADE)
 *   - authorId: varchar(255), cross-DB logical FK
 *   - deletedAt: soft-delete
 *
 * 인덱스 4개 (CONCURRENTLY):
 *   1. idx_review_comments_submission — submissionId 기반 조회
 *   2. idx_review_comments_study — studyId IDOR 스코핑
 *   3. idx_review_replies_comment — commentId 기반 조회
 *   4. idx_review_comments_deleted — deletedAt soft-delete 필터
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateReviewTables1709000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // review_comments 테이블
    await queryRunner.createTable(
      new Table({
        name: 'review_comments',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'publicId',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'submissionId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'authorId',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Logical FK -> identity_db.users -- cross-DB, no physical FK',
          },
          {
            name: 'studyId',
            type: 'uuid',
            isNullable: false,
            comment: 'IDOR 방어: studyId 스코핑으로 타 스터디 접근 차단',
          },
          {
            name: 'lineNumber',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // review_comments.submissionId → submissions.id FK (IF NOT EXISTS)
    const fk1Exists = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'FK_review_comments_submission'`,
    );
    if (!fk1Exists.length) {
      await queryRunner.createForeignKey(
        'review_comments',
        new TableForeignKey({
          name: 'FK_review_comments_submission',
          columnNames: ['submissionId'],
          referencedTableName: 'submissions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    // review_replies 테이블
    await queryRunner.createTable(
      new Table({
        name: 'review_replies',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'publicId',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'commentId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'authorId',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Logical FK -> identity_db.users -- cross-DB, no physical FK',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // review_replies.commentId → review_comments.id FK (IF NOT EXISTS)
    const fk2Exists = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'FK_review_replies_comment'`,
    );
    if (!fk2Exists.length) {
      await queryRunner.createForeignKey(
        'review_replies',
        new TableForeignKey({
          name: 'FK_review_replies_comment',
          columnNames: ['commentId'],
          referencedTableName: 'review_comments',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    // 인덱스 4개 (CONCURRENTLY — COMMIT/BEGIN 패턴, IF NOT EXISTS)
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_comments_submission" ON "review_comments" ("submissionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_comments_study" ON "review_comments" ("studyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_replies_comment" ON "review_replies" ("commentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_comments_deleted" ON "review_comments" ("deletedAt")`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_review_comments_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_review_replies_comment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_review_comments_study"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_review_comments_submission"`);

    // FK 삭제
    await queryRunner.query(
      `ALTER TABLE "review_replies" DROP CONSTRAINT IF EXISTS "FK_review_replies_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_comments" DROP CONSTRAINT IF EXISTS "FK_review_comments_submission"`,
    );

    // 테이블 삭제 (replies 먼저 — FK 의존)
    await queryRunner.dropTable('review_replies', true);
    await queryRunner.dropTable('review_comments', true);
  }
}
