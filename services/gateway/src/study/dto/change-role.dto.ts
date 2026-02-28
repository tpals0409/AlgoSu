import { IsEnum } from 'class-validator';
import { StudyMemberRole } from '../study.entity';

export class ChangeRoleDto {
  @IsEnum(StudyMemberRole, { message: 'role은 ADMIN 또는 MEMBER만 가능합니다.' })
  role!: StudyMemberRole;
}
