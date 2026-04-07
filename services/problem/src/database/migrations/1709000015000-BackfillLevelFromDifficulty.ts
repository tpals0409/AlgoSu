/**
 * @file 기존 문제 level 데이터 보정 마이그레이션
 * @domain problem
 * @layer database/migration
 * @description
 * AddProblemModal 버그로 level=2(하드코딩)로 저장된 기존 문제들의 level 값을 보정.
 * difficulty enum 기반으로 각 티어 중앙값으로 역산:
 *   BRONZE→3, SILVER→8, GOLD→13, PLATINUM→18, DIAMOND→23, RUBY→28
 *
 * 대상: difficulty IS NOT NULL AND (level IS NULL OR level = 2)
 * - level IS NULL: 초기 마이그레이션 이전 데이터
 * - level = 2: AddProblemModal 하드코딩 버그 데이터
 *   (BRONZE + level=2 는 정상일 수 있으나, 중앙값 3으로 보정이 더 정확)
 *
 * solved.ac 난이도 체계:
 *   0=Unrated, 1~5=Bronze5~1, 6~10=Silver5~1,
 *   11~15=Gold5~1, 16~20=Platinum5~1, 21~25=Diamond5~1, 26~30=Ruby5~1
 *
 * Expand-Contract: 데이터 보정만 수행, 스키마 변경 없음
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillLevelFromDifficulty1709000015000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // difficulty → level 중앙값 매핑 (각 티어의 3번째 값)
    // BRONZE 3 = Bronze III, SILVER 8 = Silver III, etc.
    await queryRunner.query(`
      UPDATE problems
      SET level = CASE difficulty
        WHEN 'BRONZE'   THEN 3
        WHEN 'SILVER'   THEN 8
        WHEN 'GOLD'     THEN 13
        WHEN 'PLATINUM' THEN 18
        WHEN 'DIAMOND'  THEN 23
        WHEN 'RUBY'     THEN 28
      END,
      updated_at = now()
      WHERE difficulty IS NOT NULL
        AND (level IS NULL OR level = 2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 보정 대상이었던 행의 level을 NULL로 리셋
    // 원본 값(NULL 또는 2)을 구분할 수 없으므로 NULL로 통일
    // (원본 2도 버그 데이터였으므로 NULL이 더 안전)
    await queryRunner.query(`
      UPDATE problems
      SET level = NULL,
      updated_at = now()
      WHERE difficulty IS NOT NULL
        AND level IN (3, 8, 13, 18, 23, 28)
    `);
  }
}
