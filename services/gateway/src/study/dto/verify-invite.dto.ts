/**
 * @file 초대코드 검증 DTO
 * @domain study
 * @layer dto
 * @related StudyService.verifyInviteCode, StudyController.verifyInvite
 */
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyInviteDto {
  @ApiProperty({ description: '검증할 초대 코드' })
  @IsNotEmpty({ message: '초대 코드는 필수입니다.' })
  @IsString()
  code!: string;
}
