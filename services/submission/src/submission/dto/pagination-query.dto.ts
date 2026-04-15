/**
 * @file pagination-query.dto.ts — 제출 목록 페이지네이션 + 필터 쿼리 DTO
 * @domain submission
 * @layer dto
 * @related submission.controller.ts, submission.service.ts
 */
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SagaStep } from '../submission.entity';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn([
    'createdAt_ASC', 'createdAt_DESC',
    'language_ASC', 'language_DESC',
    'sagaStep_ASC', 'sagaStep_DESC',
    'weekNumber_ASC', 'weekNumber_DESC',
    'updatedAt_ASC', 'updatedAt_DESC',
  ], {
    message: 'sort는 createdAt|language|sagaStep|weekNumber|updatedAt × ASC|DESC 조합만 허용됩니다.',
  })
  sort?: string = 'createdAt_DESC';

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(SagaStep))
  sagaStep?: string;

  @IsOptional()
  @IsString()
  weekNumber?: string;

  @IsOptional()
  @IsString()
  problemId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
