/**
 * @file update-ai-result.dto.ts — AI 분석 결과 업데이트 DTO (내부 콜백용)
 * @domain submission
 * @layer dto
 * @related submission-internal.controller.ts, saga-orchestrator.service.ts
 */
import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';

/**
 * AI 분석 결과 업데이트 DTO
 * AI Analysis Service → Submission Service 내부 콜백용
 */
export class UpdateAiResultDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  feedback!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(102400)
  optimizedCode?: string | null;

  @IsString()
  @IsIn(['completed', 'delayed', 'failed', 'skipped'])
  analysisStatus!: string;
}
