/**
 * @file 1709000020000-InvalidatePlainTextGithubTokens.ts
 *       — 평문 GitHub 토큰 무효화 마이그레이션
 * @domain identity
 * @layer migration
 * @related user.entity.ts, token-encryption.service.ts
 *
 * P0 보안 수정 (audit-20260422-p0-009):
 * github_token 컬럼이 평문으로 저장되어 DB 유출 시 외부 저장소 권한이
 * 즉시 노출되는 취약점을 차단.
 *
 * 처리 방식:
 * - 암호화 형식(hex:hex:hex)이 아닌 토큰을 NULL로 초기화
 * - 해당 사용자는 GitHub 재연동 필요 (github-worker App Token fallback 동작)
 * - 이미 NULL이거나 암호화된 토큰은 변경하지 않음 (멱등성 보장)
 *
 * 롤백:
 * - 평문 복원 불가 (보안상 의도적) — down()은 no-op
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvalidatePlainTextGithubTokens1709000020000 implements MigrationInterface {
  name = 'InvalidatePlainTextGithubTokens1709000020000';

  /**
   * 암호화되지 않은 github_token을 NULL로 무효화
   *
   * 암호화 형식 정규식: ^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$
   * (iv:ciphertext:authTag, 모두 hex 인코딩)
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET github_token = NULL
      WHERE github_token IS NOT NULL
        AND github_token !~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$'
    `);
  }

  /**
   * 평문 복원 불가 — 보안상 의도적 no-op
   * (되돌리려면 사용자가 GitHub 재연동 필요)
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op: 평문 토큰 복원은 보안 위반이므로 의도적으로 비워둠
  }
}
