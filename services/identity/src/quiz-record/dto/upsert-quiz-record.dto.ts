/**
 * @file UpsertQuizRecordDto — 퀴즈 기록 upsert 요청 본문 검증
 * @domain identity
 * @layer dto
 * @related quiz-record.controller.ts, quiz-record.service.ts
 */
import { IsIn, IsInt, IsISO8601, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  QuizRecordCategory,
  QuizRecordDifficulty,
} from '../quiz-record.entity';

/** 허용 카테고리 5종 — 엔티티 enum과 동기화 */
const ALLOWED_CATEGORIES = Object.values(QuizRecordCategory);

/** 허용 난이도 4종 — 'ALL' 포함 */
const ALLOWED_DIFFICULTIES: QuizRecordDifficulty[] = [
  'ALL',
  'EASY',
  'MEDIUM',
  'HARD',
];

export class UpsertQuizRecordDto {
  @ApiProperty({ description: '사용자 ID (UUID)' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: '퀴즈 분야', enum: QuizRecordCategory })
  @IsIn(ALLOWED_CATEGORIES, { message: '허용되지 않은 category 값입니다.' })
  category!: QuizRecordCategory;

  @ApiProperty({ description: '난이도', enum: ['ALL', 'EASY', 'MEDIUM', 'HARD'] })
  @IsIn(ALLOWED_DIFFICULTIES, { message: '허용되지 않은 difficulty 값입니다.' })
  difficulty!: QuizRecordDifficulty;

  @ApiProperty({ description: '점수(%)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  scorePercent!: number;

  @ApiProperty({ description: 'best 달성 시각 (ISO 8601)' })
  @IsISO8601()
  playedAt!: string;
}
