/**
 * @file studies 테이블에 groundRules TEXT nullable 컬럼 추가
 * @domain study
 * @layer migration
 * @related Study
 *
 * 스터디 규칙(ground rules)을 자유 텍스트로 저장
 * nullable이므로 기존 데이터 호환 — 한 번에 배포 허용
 *
 * DB: identity_db
 */
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGroundRulesToStudies1709000007000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'studies',
      new TableColumn({
        name: 'groundRules',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('studies', 'groundRules');
  }
}
