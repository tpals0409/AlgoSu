/**
 * @file review_replies.deletedAt soft-delete 필터용 인덱스 추가
 * @domain review
 * @layer migration
 * @related ReviewReply
 *
 * 기존 마이그레이션(1709000010000)에서 review_comments.deletedAt 인덱스만 생성됨.
 * review_replies에도 soft-delete 조회 성능을 위해 동일 인덱스 추가.
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReplyDeletedAtIndex1709000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_review_replies_deleted" ON "review_replies" ("deletedAt")`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_review_replies_deleted"`);
  }
}
