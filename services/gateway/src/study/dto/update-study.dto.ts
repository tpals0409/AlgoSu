/**
 * @file 스터디 수정 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateStudy, StudyController.update
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';
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
}
