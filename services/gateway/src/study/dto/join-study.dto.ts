/**
 * @file 초대코드 가입 DTO
 * @domain study
 * @layer dto
 * @related StudyService.joinByInviteCode, StudyController.joinStudy
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class JoinStudyDto {
  @IsNotEmpty({ message: '초대 코드는 필수입니다.' })
  @IsString()
  code!: string;

  /** 가입자 닉네임 (study_members에 저장) */
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
