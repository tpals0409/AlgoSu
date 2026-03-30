/**
 * @file 스터디 생성 DTO
 * @domain identity
 * @layer dto
 */
import { IsString, IsOptional, IsUUID, MaxLength, Matches } from 'class-validator';

export class CreateStudyDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  created_by!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  github_repo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  groundRules?: string;

  @IsString()
  @MaxLength(50)
  nickname!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^preset:.+$/, { message: 'avatar_url은 preset: 접두사가 필수입니다.' })
  avatar_url?: string;
}
