/**
 * @file 역할 변경 DTO
 * @domain identity
 * @layer dto
 */
import { IsEnum } from 'class-validator';
import { StudyMemberRole } from '../study.entity';

export class ChangeRoleDto {
  @IsEnum(StudyMemberRole)
  role!: StudyMemberRole;
}
