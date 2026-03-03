/**
 * @file study_members 테이블에 nickname VARCHAR(50) 컬럼 추가
 * @domain study
 * @layer migration
 * @related StudyMember
 *
 * Expand-Contract 패턴:
 * 1. nullable로 추가 (기존 데이터 호환)
 * 2. 기존 데이터에 기본값 'Member' 채움
 * 3. NOT NULL 제약 추가
 *
 * DB: identity_db
 */
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNicknameToStudyMembers1709000009000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. nullable로 추가 (기존 데이터 호환)
    await queryRunner.addColumn(
      'study_members',
      new TableColumn({
        name: 'nickname',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    // 2. 기존 데이터에 기본값 채움
    await queryRunner.query(
      `UPDATE "study_members" SET "nickname" = 'Member' WHERE "nickname" IS NULL`,
    );

    // 3. NOT NULL 제약 추가
    await queryRunner.query(
      `ALTER TABLE "study_members" ALTER COLUMN "nickname" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('study_members', 'nickname');
  }
}
