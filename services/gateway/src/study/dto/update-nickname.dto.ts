/**
 * @file 닉네임 변경 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateNickname, StudyController.updateNickname
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
