/**
 * @file UpsertQuizRecordDto 검증 테스트 — 분야 allowlist (Sprint 227 신규 5분야 + ALL)
 * @domain identity
 * @layer dto
 * @related upsert-quiz-record.dto.ts, quiz-record.entity.ts
 *
 * Sprint 227 Critic(P2) 회귀 차단: gateway가 전달한 신규 분야·'ALL'을 identity
 * upsert DTO가 거부하면 merge-up·best 저장이 조용히 실패한다.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertQuizRecordDto } from './upsert-quiz-record.dto';
import { QuizRecordCategory } from '../quiz-record.entity';

/** 유효 기본 본문(분야만 교체해 검증) */
const BASE = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  difficulty: 'ALL',
  scorePercent: 80,
  playedAt: '2026-06-07T00:00:00.000Z',
} as const;

async function validateCategory(category: string): Promise<number> {
  const dto = plainToInstance(UpsertQuizRecordDto, { ...BASE, category });
  const errors = await validate(dto);
  return errors.length;
}

describe('UpsertQuizRecordDto category allowlist', () => {
  const ACCEPTED = [...Object.values(QuizRecordCategory), 'ALL'];

  it('실제 10분야를 모두 허용한다', () => {
    expect(Object.values(QuizRecordCategory)).toHaveLength(10);
  });

  it.each(ACCEPTED)('허용 분야 "%s"는 검증을 통과한다', async (category) => {
    expect(await validateCategory(category)).toBe(0);
  });

  it('미등록 분야는 거부한다', async () => {
    expect(await validateCategory('BOGUS')).toBeGreaterThan(0);
  });
});
