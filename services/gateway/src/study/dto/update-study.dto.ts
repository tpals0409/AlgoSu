/**
 * @file 스터디 수정 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateStudy, StudyController.update
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
