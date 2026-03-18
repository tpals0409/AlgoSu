/**
 * @file 스터디 수정 DTO
 * @domain identity
 * @layer dto
 */
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { StudyStatus } from '../study.entity';

export class UpdateStudyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  github_repo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  groundRules?: string;

  @IsOptional()
  @IsEnum(StudyStatus)
  status?: StudyStatus;
}
