/**
 * @file 20260602000000-SP217-CreateQuizRecords.ts — quiz_records 테이블 신설
 * @domain identity
 * @layer migration
 * @related quiz-record.entity.ts
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 217 — CS 퀴즈 로그인 사용자 기록 연동
 * quiz_records 테이블 신설: (user_id, category, difficulty) 복합 best 기록
 *
 * DB: identity_db (identity_user 전용)
 *
 * 설계:
 * - best 단위 = (user_id, category, difficulty) 복합 UNIQUE — upsert 단위, IDOR 방지
 * - user_id 인덱스: findByUser 조회 성능
 *
 * Expand-Contract 패턴 준수:
 * - 롤백 가능한 down() 함수 필수
 */
export class CreateQuizRecords20260602000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // quiz_records 테이블
    await queryRunner.query(`
      CREATE TABLE quiz_records (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             UUID NOT NULL,
        category            VARCHAR(30) NOT NULL,
        difficulty          VARCHAR(10) NOT NULL,
        best_score_percent  INTEGER NOT NULL,
        played_at           TIMESTAMPTZ NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_quiz_records_user_category_difficulty
          UNIQUE (user_id, category, difficulty)
      )
    `);

    // user_id 조회 인덱스 (findByUser)
    await queryRunner.query(`
      CREATE INDEX idx_quiz_records_user_id
      ON quiz_records (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS quiz_records`);
  }
}
