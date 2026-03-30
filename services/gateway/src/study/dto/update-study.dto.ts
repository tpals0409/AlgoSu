/**
 * @file 스터디 수정 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateStudy, StudyController.update
 */
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudyDto {
  @ApiPropertyOptional({ description: '스터디 이름', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '스터디 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '스터디 아바타 프리셋', maxLength: 50, example: 'preset:study-code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^preset:.+$/, { message: 'avatarUrl은 preset: 접두사가 필수입니다.' })
  avatarUrl?: string;
}
