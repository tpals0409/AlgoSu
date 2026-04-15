/**
 * @file create-problem.dto.ts — 문제 생성·수정 DTO (class-validator 화이트리스트)
 * @domain problem
 * @layer dto
 * @related problem.service.ts, problem.controller.ts
 */
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Difficulty, ProblemStatus } from '../problem.entity';

/**
 * 문제 생성 DTO
 * 화이트리스트 검증: 등록되지 않은 필드 자동 제거
 */
export class CreateProblemDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MaxLength(20)
  weekNumber!: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  level?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourcePlatform?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedLanguages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateProblemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weekNumber?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  level?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourcePlatform?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedLanguages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;
}
