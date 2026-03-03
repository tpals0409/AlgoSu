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
  @IsIn(['createdAt_ASC', 'createdAt_DESC'], {
    message: 'sort는 createdAt_ASC 또는 createdAt_DESC만 허용됩니다.',
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
