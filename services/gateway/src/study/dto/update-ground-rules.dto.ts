/**
 * @file 그라운드 룰 수정 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateGroundRules, StudyController.updateGroundRules
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateGroundRulesDto {
  @IsNotEmpty({ message: '그라운드 룰 내용은 필수입니다.' })
  @IsString()
  @MaxLength(500, { message: '그라운드 룰은 500자 이내로 작성해주세요.' })
  groundRules!: string;
}
