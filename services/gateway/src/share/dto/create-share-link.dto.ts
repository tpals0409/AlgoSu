/**
 * @file 공유 링크 생성 DTO
 * @domain share
 * @layer dto
 * @related share-link.controller.ts
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601 } from 'class-validator';

export class CreateShareLinkDto {
  @ApiPropertyOptional({
    description: '링크 만료 일시 (ISO8601, 미지정 시 무기한)',
    example: '2026-04-10T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601({}, { message: '만료 일시는 ISO8601 형식이어야 합니다.' })
  expiresAt?: string;
}
