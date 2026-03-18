/**
 * @file 공유 링크 생성 DTO
 * @domain share
 * @layer dto
 */
import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateShareLinkDto {
  /** 스터디 UUID */
  @IsUUID()
  study_id!: string;

  /** 생성자 UUID */
  @IsUUID()
  created_by!: string;

  /** 만료 일시 (ISO 8601, 선택) */
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
