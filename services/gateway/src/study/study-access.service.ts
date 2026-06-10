/**
 * @file 스터디 권한 검증 — 멤버/ADMIN 여부 확인 공유 헬퍼
 * @domain study
 * @layer service
 * @related StudyService, StudyMemberService, IdentityClientService
 *
 * 스터디 멤버십/ADMIN 권한 검증을 담당하는 공유 헬퍼.
 * CRUD/멤버 도메인 서비스 양쪽에서 호출되므로 별도 서비스로 승격.
 */
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IdentityClientService } from '../identity-client/identity-client.service';
import type { MemberData } from './study.types';

@Injectable()
export class StudyAccessService {
  constructor(private readonly identityClient: IdentityClientService) {}

  /**
   * 스터디 멤버 여부 검증
   * @domain study
   * @guard study-member
   * @param studyId - 스터디 ID
   * @param userId - 사용자 ID
   * @returns 멤버 엔티티 (비멤버면 ForbiddenException)
   */
  async verifyMembership(studyId: string, userId: string): Promise<MemberData> {
    try {
      const member = await this.identityClient.getMember(studyId, userId) as MemberData;
      return member;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
      }
      throw error;
    }
  }

  /**
   * ADMIN 권한 검증
   * @domain study
   * @guard study-admin
   * @param studyId - 스터디 ID
   * @param userId - 사용자 ID
   * @returns ADMIN 멤버 엔티티 (비ADMIN이면 ForbiddenException)
   */
  async verifyAdmin(studyId: string, userId: string): Promise<MemberData> {
    const member = await this.verifyMembership(studyId, userId);
    if (member.role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN 권한이 필요합니다.');
    }
    return member;
  }
}
