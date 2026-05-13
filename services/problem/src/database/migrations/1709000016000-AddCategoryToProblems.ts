/**
 * @file 1709000016000-AddCategoryToProblems.ts — problems 테이블에 category 컬럼 추가
 * @domain problem
 * @layer migration
 * @related problem.entity.ts, create-problem.dto.ts
 *
 * Sprint 151: 프로그래머스 SQL 카테고리 문제 자동 언어 선택 지원.
 * category 컬럼(problems_category_enum)을 추가하고, 기존 행은 기본값 'ALGORITHM' 적용.
 *
 * Expand-Contract: 신규 컬럼 + NOT NULL DEFAULT → 기존 행 영향 없음 (무중단)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * problems 테이블에 category enum 컬럼을 추가한다.
 *
 * up:   enum 타입 생성 → ALTER TABLE ADD COLUMN (NOT NULL DEFAULT 'ALGORITHM')
 * down: COLUMN DROP → enum 타입 DROP
 */
export class AddCategoryToProblems1709000016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE problems_category_enum AS ENUM ('ALGORITHM', 'SQL')`,
    );
    await queryRunner.query(
      `ALTER TABLE problems
       ADD COLUMN category problems_category_enum NOT NULL DEFAULT 'ALGORITHM'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN category`);
    await queryRunner.query(`DROP TYPE problems_category_enum`);
  }
}
