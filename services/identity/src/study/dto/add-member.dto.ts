/**
 * @file 멤버 추가 DTO
 * @domain identity
 * @layer dto
 */
import { IsString, IsOptional, IsUUID, IsEnum, MaxLength } from 'class-validator';
import { StudyMemberRole } from '../study.entity';

export class AddMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(50)
  nickname!: string;

  @IsOptional()
  @IsEnum(StudyMemberRole)
  role?: StudyMemberRole;
}
