/**
 * @file SaveQuizRecordDto — 퀴즈 기록 저장 요청 본문 검증
 * @domain quiz-record
 * @layer dto
 * @related QuizRecordController.save, QuizRecordService.save
 *
 * userId는 본문이 아닌 X-User-ID 헤더(JWT 미들웨어 주입)에서 취득 — 신뢰 경계.
 */
import { IsIn, IsInt, IsISO8601, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 허용 분야 — frontend QuizCategory 10종 + 'ALL'(전 분야 메타, Sprint 227) */
const ALLOWED_CATEGORIES = [
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
] as const;

/** 허용 난이도 4종 — 'ALL'(전체 난이도 플레이) 포함 */
const ALLOWED_DIFFICULTIES = ['ALL', 'EASY', 'MEDIUM', 'HARD'] as const;

export class SaveQuizRecordDto {
  @ApiProperty({ description: '퀴즈 분야', enum: ALLOWED_CATEGORIES })
  @IsIn(ALLOWED_CATEGORIES, { message: '허용되지 않은 category 값입니다.' })
  category!: (typeof ALLOWED_CATEGORIES)[number];

  @ApiProperty({ description: '난이도', enum: ALLOWED_DIFFICULTIES })
  @IsIn(ALLOWED_DIFFICULTIES, { message: '허용되지 않은 difficulty 값입니다.' })
  difficulty!: (typeof ALLOWED_DIFFICULTIES)[number];

  @ApiProperty({ description: '점수(%)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  scorePercent!: number;

  @ApiProperty({ description: 'best 달성 시각 (ISO 8601)' })
  @IsISO8601()
  playedAt!: string;
}
