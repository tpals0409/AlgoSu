/**
 * @file 초대 생성 DTO
 * @domain identity
 * @layer dto
 */
import { IsUUID, IsDateString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateInviteDto {
  @IsUUID()
  created_by!: string;

  @IsDateString()
  expires_at!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_uses?: number;
}
