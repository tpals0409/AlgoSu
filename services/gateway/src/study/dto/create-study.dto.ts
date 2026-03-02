/**
 * @file 스터디 생성 DTO
 * @domain study
 * @layer dto
 * @related StudyService.createStudy, StudyController.create
 */
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStudyDto {
  @IsNotEmpty({ message: '스터디 이름은 필수입니다.' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** 생성자 닉네임 (study_members에 저장) */
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
