/**
 * @file 닉네임 변경 DTO
 * @domain study
 * @layer dto
 * @related StudyService.updateNickname, StudyController.updateNickname
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNicknameDto {
  @ApiProperty({ description: '변경할 닉네임', maxLength: 50 })
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
