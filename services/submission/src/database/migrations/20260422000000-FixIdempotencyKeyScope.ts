/**
 * @file 20260422000000-FixIdempotencyKeyScope.ts — 멱등성 키 유니크 인덱스를 사용자 스코프로 교체
 * @domain submission
 * @layer migration
 * @related submission.entity.ts, submission.service.ts
 *
 * P0 보안 수정 (audit-20260422-p0-016):
 * 기존 전역 unique index(idempotency_key)를 제거하고,
 * (study_id, user_id, idempotency_key) 복합 partial unique index로 교체한다.
 *
 * 변경 이유:
 *   - 기존 인덱스는 studyId·userId 구분 없이 idempotency_key만 체크
 *   - 동일 studyId 내 서로 다른 사용자가 같은 키를 사용하면 IDOR 발생 가능
 *   - 서비스 레이어 조회 조건도 (studyId, userId, idempotencyKey) 3-tuple로 수정
 *
 * Expand-Contract 패턴:
 *   - up(): 기존 단일 컬럼 인덱스 DROP → 복합 부분 인덱스 CREATE
 *   - down(): 복합 인덱스 DROP → 기존 단일 인덱스 재생성 (롤백 가능)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixIdempotencyKeyScope20260422000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 기존 전역 유니크 인덱스 제거
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_submissions_idempotency_key`,
    );

    // 2. (study_id, user_id, idempotency_key) 복합 partial unique 인덱스 생성
    //    — idempotency_key IS NOT NULL 조건으로 NULL 값은 충돌 대상에서 제외
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_submissions_study_user_idem
      ON submissions (study_id, user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 복합 인덱스 제거
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_submissions_study_user_idem`,
    );

    // 기존 단일 컬럼 유니크 인덱스 복구
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_submissions_idempotency_key
      ON submissions (idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
  }
}
