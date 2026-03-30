/**
 * @file 스터디 수정 DTO
 * @domain identity
 * @layer dto
 */
import { IsString, IsOptional, IsEnum, MaxLength, Matches } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^preset:.+$/, { message: 'avatar_url은 preset: 접두사가 필수입니다.' })
  avatar_url?: string;
}
