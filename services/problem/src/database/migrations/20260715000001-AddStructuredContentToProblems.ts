/**
 * @file 20260715000001-AddStructuredContentToProblems.ts — problems 테이블에 구조화 필드 추가
 * @domain problem
 * @layer migration
 * @related problem.entity.ts, crawler.service.ts
 *
 * Sprint 249 Wave D: Programmers 크롤링 결과 구조화 저장 지원.
 * constraints(제한 사항)와 examples(입출력 예) 필드를 추가한다.
 * 기존 행은 NULL 기본값 적용 — 무중단 Expand-Contract 패턴.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * problems 테이블에 구조화 컬럼 2개를 추가한다.
 *
 * up:   ALTER TABLE ADD COLUMN constraints TEXT NULL,
 *       ALTER TABLE ADD COLUMN examples JSONB NULL
 * down: DROP COLUMN examples, DROP COLUMN constraints
 */
export class AddStructuredContentToProblems20260715000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE problems ADD COLUMN IF NOT EXISTS constraints text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE problems ADD COLUMN IF NOT EXISTS examples jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN IF EXISTS examples`);
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN IF EXISTS constraints`);
  }
}
