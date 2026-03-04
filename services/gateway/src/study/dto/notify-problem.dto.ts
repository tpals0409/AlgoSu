/**
 * @file 문제 생성 알림 DTO
 * @domain study
 * @layer dto
 * @related StudyService.notifyProblemCreated, StudyController.notifyProblemCreated
 */
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotifyProblemDto {
  @ApiProperty({ description: '문제 ID (UUID)' })
  @IsNotEmpty()
  @IsString()
  problemId!: string;

  @ApiProperty({ description: '문제 제목' })
  @IsNotEmpty()
  @IsString()
  problemTitle!: string;

  @ApiProperty({ description: '주차 (예: 3월1주차)' })
  @IsNotEmpty()
  @IsString()
  weekNumber!: string;
}
