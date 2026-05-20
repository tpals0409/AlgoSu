/**
 * @file 1709000017000-BackfillSqlCategory.ts — 레거시 Programmers SQL 문제 category 보정
 * @domain problem
 * @layer database/migration
 * @related problem.entity.ts, 1709000016000-AddCategoryToProblems.ts
 *
 * Sprint 181: AddCategoryToProblems(1709000016000)가 기존 행 전부에 category DEFAULT 'ALGORITHM'을
 * 적용했으나, category 입력 UI(Sprint 178)·검색 결과 자동 전파(Sprint 180) 이전에 등록된
 * 레거시 Programmers SQL 문제는 모두 ALGORITHM으로 저장됨.
 *
 * 문제 상세 페이지는 저장된 category === 'SQL'일 때만 에디터 언어를 자동 'sql' 선택하므로,
 * 레거시 SQL 문제는 매번 python 기본값으로 떠 수동 전환이 필요한 UX 버그가 발생.
 * 이 마이그레이션이 레거시 SQL 문제의 저장 category를 SQL로 보정한다.
 *
 * SQL 판정 신호 = frontend dual-check 헬퍼(isProgrammersSqlProblem) 미러링:
 *   tags 배열 원소 중 toUpperCase() === 'SQL'인 것이 있으면 SQL.
 *   tags는 simple-json(JSON 텍스트 `["SQL",...]`)으로 저장되므로 ILIKE '%"sql"%'로
 *   배열 원소 `"SQL"`/`"sql"` 등을 case-insensitive 정확 매칭한다
 *   (`"NoSQL"`·`"SQL injection"` 같은 부분문자열은 매칭되지 않아 exact 의미를 보존).
 *   보수적 가드: SQL Kit 출처는 Programmers뿐이므로 Programmers 행으로 한정한다.
 *   단, source_platform은 optional이라 레거시 행에 누락될 수 있으므로
 *   source_platform = programmers **또는** source_url(programmers.co.kr) 중 하나로 식별
 *   (Critic R1 P2: platform 누락 + URL만 있는 레거시 SQL 문제 누락 방지).
 *
 * Expand-Contract: 데이터 보정만 수행, 스키마 변경 없음.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillSqlCategory1709000017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE problems
      SET category = 'SQL',
          updated_at = now()
      WHERE category = 'ALGORITHM'
        AND tags ILIKE '%"sql"%'
        AND (
          LOWER(source_platform) = 'programmers'
          OR source_url ILIKE '%programmers.co.kr%'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // best-effort 롤백: 동일 휴리스틱으로 매칭되는 SQL 행을 ALGORITHM으로 되돌림.
    // Sprint 178+ 폼으로 SQL 설정된 행도 동일 휴리스틱에 매칭되면 함께 되돌려지는
    // 한계가 있으나(stateless 마이그레이션), 선례 BackfillLevelFromDifficulty.down의
    // 동일한 불완전성을 계승한다. 롤백 시나리오 한정 best-effort.
    await queryRunner.query(`
      UPDATE problems
      SET category = 'ALGORITHM',
          updated_at = now()
      WHERE category = 'SQL'
        AND tags ILIKE '%"sql"%'
        AND (
          LOWER(source_platform) = 'programmers'
          OR source_url ILIKE '%programmers.co.kr%'
        )
    `);
  }
}
