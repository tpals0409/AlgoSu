/**
 * @file 프로필 설정 업데이트 DTO — slug + 공개 토글
 * @domain identity
 * @layer dto
 * @related user.service.ts
 */
import { IsOptional, IsBoolean, Matches, IsString } from 'class-validator';

export class UpdateProfileSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/, {
    message: '프로필 URL은 영문소문자, 숫자, 하이픈만 허용되며 3~20자여야 합니다.',
  })
  profileSlug?: string;

  @IsOptional()
  @IsBoolean({ message: '공개 여부는 boolean이어야 합니다.' })
  isProfilePublic?: boolean;
}
