/**
 * @file 공유 링크 비활성화 DTO
 * @domain share
 * @layer dto
 */
import { IsUUID } from 'class-validator';

export class DeactivateShareLinkDto {
  /** 요청자 UUID (소유자 검증용) */
  @IsUUID()
  userId!: string;
}
