/**
 * @file change-role.dto.ts — 스터디 멤버 역할 변경 요청 DTO
 * @domain gateway
 * @layer dto
 * @related study.controller.ts, identity.types.ts
 */
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StudyMemberRole } from '../../common/types/identity.types';

export class ChangeRoleDto {
  @ApiProperty({ description: '변경할 역할', enum: StudyMemberRole })
  @IsEnum(StudyMemberRole, { message: 'role은 ADMIN 또는 MEMBER만 가능합니다.' })
  role!: StudyMemberRole;
}
