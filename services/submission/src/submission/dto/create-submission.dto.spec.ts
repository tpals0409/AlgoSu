/**
 * @file create-submission.dto.spec.ts — CreateSubmissionDto 언어 화이트리스트 단위 테스트
 * @domain submission
 * @layer dto
 * @related create-submission.dto.ts, submission.service.ts
 *
 * class-validator의 validate()를 사용해 ALLOWED_LANGUAGES 화이트리스트를 직접 검증한다.
 * Sprint 108: 'sql' 허용 케이스 + 허용되지 않은 언어 거부 케이스 추가.
 */
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSubmissionDto } from './create-submission.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_CODE = 'SELECT 1 FROM dual LIMIT 1;'; // 10자 이상

describe('CreateSubmissionDto — ALLOWED_LANGUAGES 화이트리스트', () => {
  /**
   * sql 허용 케이스 (Sprint 108)
   * ALLOWED_LANGUAGES에 'sql'이 추가되어 유효성 검증 통과해야 한다.
   */
  it('sql 언어 — 검증 통과', async () => {
    const dto = plainToInstance(CreateSubmissionDto, {
      problemId: VALID_UUID,
      language: 'sql',
      code: VALID_CODE,
    });
    const errors = await validate(dto);
    const langErrors = errors.filter((e) => e.property === 'language');
    expect(langErrors).toHaveLength(0);
  });

  /**
   * 허용되지 않은 언어 거부 케이스
   * 화이트리스트에 없는 언어는 IsIn 검증을 실패해야 한다.
   */
  it('허용되지 않은 언어(unknown_lang) — 검증 실패', async () => {
    const dto = plainToInstance(CreateSubmissionDto, {
      problemId: VALID_UUID,
      language: 'unknown_lang',
      code: VALID_CODE,
    });
    const errors = await validate(dto);
    const langErrors = errors.filter((e) => e.property === 'language');
    expect(langErrors.length).toBeGreaterThan(0);
    expect(
      langErrors.some((e) =>
        Object.values(e.constraints ?? {}).some((msg) =>
          msg.includes('허용되지 않은 언어'),
        ),
      ),
    ).toBe(true);
  });
});
