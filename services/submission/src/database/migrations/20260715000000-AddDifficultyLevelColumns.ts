/**
 * @file 20260715000000-AddDifficultyLevelColumns.ts — submissions 테이블에 difficulty, level 컬럼 추가
 * @domain submission
 * @layer migration
 * @related submission.entity.ts, submission.service.ts
 *
 * Sprint 249 Wave C:
 * AI 분석 난이도 컨텍스트 풍부화 — 제출 생성 시 Problem Service에서 difficulty/level을 조회하여 저장.
 * ai-analysis worker가 난이도 기반 채점 루브릭 보정을 수행할 수 있도록 컨텍스트 제공.
 * 기존 row는 nullable로 유지.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDifficultyLevelColumns20260715000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS level SMALLINT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions DROP COLUMN IF EXISTS level`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions DROP COLUMN IF EXISTS difficulty`,
    );
  }
}
