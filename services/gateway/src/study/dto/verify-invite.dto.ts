/**
 * @file 초대코드 검증 DTO
 * @domain study
 * @layer dto
 * @related StudyService.verifyInviteCode, StudyController.verifyInvite
 */
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyInviteDto {
  @IsNotEmpty({ message: '초대 코드는 필수입니다.' })
  @IsString()
  code!: string;
}
