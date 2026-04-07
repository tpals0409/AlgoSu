/**
 * @file user_id / authorId 컬럼 타입을 varchar(255) → uuid로 변경
 * @domain submission, review
 * @layer migration
 * @related Submission, Draft, ReviewComment, ReviewReply
 *
 * 대상 컬럼 4개:
 *   1. submissions.user_id      varchar(255) → uuid
 *   2. drafts.user_id           varchar(255) → uuid
 *   3. review_comments.authorId varchar(255) → uuid
 *   4. review_replies.authorId  varchar(255) → uuid
 *
 * 모든 값이 이미 UUID 형식이므로 USING ::uuid 캐스팅.
 * non-UUID 값이 존재하면 마이그레이션 실패 (의도적 — 데이터 정합성 보장).
 *
 * Expand-Contract 패턴:
 *   - up(): varchar → uuid (USING 캐스팅)
 *   - down(): uuid → varchar(255) (USING ::text 캐스팅)
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeUserIdColumnsToUuid1709000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. submissions.user_id: varchar(255) → uuid
    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`,
    );

    // 2. drafts.user_id: varchar(255) → uuid
    await queryRunner.query(
      `ALTER TABLE "drafts" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`,
    );

    // 3. review_comments.authorId: varchar(255) → uuid
    await queryRunner.query(
      `ALTER TABLE "review_comments" ALTER COLUMN "authorId" TYPE uuid USING "authorId"::uuid`,
    );

    // 4. review_replies.authorId: varchar(255) → uuid
    await queryRunner.query(
      `ALTER TABLE "review_replies" ALTER COLUMN "authorId" TYPE uuid USING "authorId"::uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 역순 롤백: uuid → varchar(255)
    await queryRunner.query(
      `ALTER TABLE "review_replies" ALTER COLUMN "authorId" TYPE varchar(255) USING "authorId"::text`,
    );

    await queryRunner.query(
      `ALTER TABLE "review_comments" ALTER COLUMN "authorId" TYPE varchar(255) USING "authorId"::text`,
    );

    await queryRunner.query(
      `ALTER TABLE "drafts" ALTER COLUMN "user_id" TYPE varchar(255) USING "user_id"::text`,
    );

    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "user_id" TYPE varchar(255) USING "user_id"::text`,
    );
  }
}
