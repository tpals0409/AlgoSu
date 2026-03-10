/**
 * @file 프로필 설정 업데이트 DTO — slug + 공개 토글
 * @domain share
 * @layer dto
 * @related share-link.controller.ts
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, Matches, IsString } from 'class-validator';

export class UpdateProfileSettingsDto {
  @ApiPropertyOptional({
    description: '프로필 URL slug (3~20자, 영문소문자+숫자+하이픈, 시작/끝 하이픈 불가)',
    example: 'john-doe-2026',
    pattern: '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/, {
    message: '프로필 URL은 영문소문자, 숫자, 하이픈만 허용되며 3~20자여야 합니다.',
  })
  profileSlug?: string;

  @ApiPropertyOptional({
    description: '프로필 공개 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: '공개 여부는 boolean이어야 합니다.' })
  isProfilePublic?: boolean;
}
