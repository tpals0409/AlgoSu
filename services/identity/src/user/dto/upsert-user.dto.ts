/**
 * @file OAuth 로그인 시 사용자 생성/조회 DTO
 * @domain identity
 * @layer dto
 * @related user.service.ts
 */
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OAuthProvider } from '../user.entity';

export class UpsertUserDto {
  @IsEmail({}, { message: '유효한 이메일 주소여야 합니다.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar_url?: string | null;

  @IsEnum(OAuthProvider, { message: '유효한 OAuth provider여야 합니다.' })
  oauth_provider!: OAuthProvider;
}
