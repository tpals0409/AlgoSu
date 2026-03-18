/**
 * @file 닉네임 수정 DTO
 * @domain identity
 * @layer dto
 */
import { IsString, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsString()
  @MaxLength(50)
  nickname!: string;
}
