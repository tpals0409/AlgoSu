/**
 * @file GitHub 연동/해제 DTO
 * @domain identity
 * @layer dto
 * @related user.service.ts
 */
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGitHubDto {
  @IsBoolean({ message: 'connected는 boolean이어야 합니다.' })
  connected!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  user_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string | null;

  @IsOptional()
  @IsString()
  token?: string | null;
}
