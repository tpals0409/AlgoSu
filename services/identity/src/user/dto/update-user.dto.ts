/**
 * @file 사용자 프로필 업데이트 DTO
 * @domain identity
 * @layer dto
 * @related user.service.ts
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar_url?: string;
}
