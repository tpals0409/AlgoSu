/**
 * @file 문제 생성 알림 DTO
 * @domain study
 * @layer dto
 * @related StudyService.notifyProblemCreated, StudyController.notifyProblemCreated
 */
import { IsNotEmpty, IsString } from 'class-validator';

export class NotifyProblemDto {
  @IsNotEmpty()
  @IsString()
  problemId!: string;

  @IsNotEmpty()
  @IsString()
  problemTitle!: string;

  @IsNotEmpty()
  @IsString()
  weekNumber!: string;
}
