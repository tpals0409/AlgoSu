/**
 * @file AI 만족도 생성 DTO
 * @domain submission
 * @layer dto
 * @related AiSatisfaction
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAiSatisfactionDto {
  @ApiProperty({ description: '평가 (1: 좋음, -1: 나쁨)', enum: [1, -1] })
  @IsIn([1, -1], { message: 'rating은 1 또는 -1이어야 합니다.' })
  rating!: number;

  @ApiPropertyOptional({ description: '추가 코멘트', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
