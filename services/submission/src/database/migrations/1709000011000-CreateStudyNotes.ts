/**
 * @file study_notes 테이블 생성
 * @domain review
 * @layer migration
 * @related StudyNote
 *
 * 문제별 스터디 노트 (1문제 1스터디 1노트)
 *   - problemId + studyId UNIQUE 제약
 *   - content: TEXT (자유 텍스트)
 *
 * DB: submission_db
 */
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateStudyNotes1709000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'study_notes',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'publicId',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'problemId',
            type: 'uuid',
            isNullable: false,
            comment: 'Logical FK -> problem_db.problems(id) -- cross-DB, no physical FK',
          },
          {
            name: 'studyId',
            type: 'uuid',
            isNullable: false,
            comment: 'Logical FK -> identity_db.studies(id) -- cross-DB, no physical FK',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        uniques: [
          {
            name: 'UQ_study_notes_problem_study',
            columnNames: ['problemId', 'studyId'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('study_notes', true);
  }
}
