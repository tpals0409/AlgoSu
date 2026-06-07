/**
 * @file SaveQuizRecordDto 검증 테스트 — 분야 allowlist (Sprint 227 신규 5분야 + ALL)
 * @domain quiz-record
 * @layer dto
 * @related save-quiz-record.dto.ts
 *
 * Sprint 227 Critic(P2) 회귀 차단: 신규 분야·'ALL' 기본값이 DTO allowlist에서
 * 거부되면 로그인 사용자 best 기록이 saveResult(best-effort)에서 조용히 유실된다.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveQuizRecordDto } from './save-quiz-record.dto';

/** 유효 기본 본문(분야만 교체해 검증) */
const BASE = {
  difficulty: 'ALL',
  scorePercent: 80,
  playedAt: '2026-06-07T00:00:00.000Z',
} as const;

async function validateCategory(category: string): Promise<number> {
  const dto = plainToInstance(SaveQuizRecordDto, { ...BASE, category });
  const errors = await validate(dto);
  return errors.length;
}

describe('SaveQuizRecordDto category allowlist', () => {
  const ACCEPTED = [
    'DATA_STRUCTURE',
    'ALGORITHM',
    'NETWORK',
    'OS',
    'DATABASE',
    'COMPUTER_ARCHITECTURE',
    'DESIGN_PATTERN',
    'WEB',
    'SECURITY',
    'AI',
    'ALL',
  ];

  it.each(ACCEPTED)('허용 분야 "%s"는 검증을 통과한다', async (category) => {
    expect(await validateCategory(category)).toBe(0);
  });

  it('미등록 분야는 거부한다', async () => {
    expect(await validateCategory('BOGUS')).toBeGreaterThan(0);
  });
});
