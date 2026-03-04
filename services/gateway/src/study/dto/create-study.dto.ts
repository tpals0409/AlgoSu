/**
 * @file 스터디 생성 DTO
 * @domain study
 * @layer dto
 * @related StudyService.createStudy, StudyController.create
 */
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudyDto {
  @ApiProperty({ description: '스터디 이름', maxLength: 100, example: '알고리즘 스터디' })
  @IsNotEmpty({ message: '스터디 이름은 필수입니다.' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: '스터디 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'GitHub 저장소 URL', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  githubRepo?: string;

  @ApiProperty({ description: '생성자 닉네임', maxLength: 50, example: 'study-admin' })
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
