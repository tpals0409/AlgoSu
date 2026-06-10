/**
 * @file 스터디 멤버 관리 — 목록/닉네임/역할/탈퇴/추방
 * @domain study
 * @layer service
 * @related StudyController, StudyAccessService, MembershipCacheService, NotificationService
 *
 * 멤버 도메인 전용 서비스. 권한 검증은 StudyAccessService에,
 * 멤버십 캐시 무효화는 MembershipCacheService에 위임한다.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { IdentityClientService } from '../identity-client/identity-client.service';
import type { IdentityStudyMember as StudyMember } from '../common/types/identity.types';
import { StudyMemberRole, NotificationType } from '../common/types/identity.types';
import { NotificationService } from '../notification/notification.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { StudyAccessService } from './study-access.service';
import { MembershipCacheService } from './membership-cache.service';
import type { StudyData, MemberData } from './study.types';

@Injectable()
export class StudyMemberService {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly identityClient: IdentityClientService,
    private readonly notificationService: NotificationService,
    private readonly access: StudyAccessService,
    private readonly cache: MembershipCacheService,
  ) {
    this.logger.setContext(StudyMemberService.name);
  }

  /**
   * 멤버 목록 조회 (유저 정보 포함)
   * @domain study
   * @api GET /studies/:id/members
   * @guard study-member
   */
  async getMembers(
    studyId: string,
    _userId: string,
  ): Promise<(StudyMember & { username?: string; email?: string; avatar_url?: string | null })[]> {
    const members = await this.identityClient.getMembers(studyId) as MemberData[];

    // 각 멤버의 User 정보를 병렬 조회하여 email, avatar_url 등 보강
    const enriched = await Promise.all(members.map((m) => this.enrichMember(m)));

    return enriched as unknown as (StudyMember & { username?: string; email?: string; avatar_url?: string | null })[];
  }

  /**
   * 멤버에 User 정보(이름/이메일/아바타) 보강 — 조회 실패 시 null 채움
   * @param member - 기본 멤버 엔티티
   */
  private async enrichMember(member: MemberData): Promise<Record<string, unknown>> {
    try {
      const user = await this.identityClient.findUserById(member.user_id) as Record<string, unknown> | null;
      return {
        ...member,
        username: (user?.name as string) ?? null,
        email: (user?.email as string) ?? null,
        avatar_url: (user?.avatar_url as string | null) ?? null,
      };
    } catch {
      return { ...member, username: null, email: null, avatar_url: null };
    }
  }

  /**
   * 닉네임 변경 (본인만)
   * @domain study
   * @api PATCH /studies/:id/nickname
   * @guard study-member
   */
  async updateNickname(
    studyId: string,
    userId: string,
    nickname: string,
  ): Promise<{ nickname: string }> {
    // getMember가 404를 throw하면 ForbiddenException으로 변환
    try {
      await this.identityClient.getMember(studyId, userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }
      throw error;
    }

    await this.identityClient.updateNickname(studyId, userId, { nickname });
    return { nickname };
  }

  /**
   * 멤버 역할 변경 (ADMIN만, 자기 자신 변경 불가)
   * @domain study
   * @api PATCH /studies/:id/members/:userId/role
   * @guard study-admin
   * @event ROLE_CHANGED (publish)
   */
  async changeMemberRole(
    studyId: string,
    targetUserId: string,
    adminUserId: string,
    newRole: StudyMemberRole,
  ): Promise<void> {
    await this.access.verifyAdmin(studyId, adminUserId);

    // 자기 자신 변경 불가
    if (targetUserId === adminUserId) {
      throw new BadRequestException('자기 자신의 역할을 변경할 수 없습니다.');
    }

    const targetMember = await this.findTargetMember(studyId, targetUserId);

    // ADMIN -> MEMBER 강등 시 최소 1 ADMIN 보장
    if (targetMember.role === 'ADMIN' && newRole === 'MEMBER') {
      await this.ensureNotLastAdmin(studyId);
    }

    await this.identityClient.changeRole(studyId, targetUserId, { role: newRole });

    // 캐시 무효화 + 알림
    await this.cache.invalidate(studyId, targetUserId);

    const study = await this.identityClient.findStudyById(studyId) as StudyData;
    const roleLabel = newRole === 'ADMIN' ? '관리자' : '멤버';
    await this.notificationService.createNotification({
      userId: targetUserId,
      studyId,
      type: NotificationType.ROLE_CHANGED,
      title: '역할 변경',
      message: `"${study?.name ?? '스터디'}"에서 역할이 ${roleLabel}(으)로 변경되었습니다.`,
      link: `/studies/${studyId}`,
    });

    this.logger.log(
      `역할 변경: studyId=${studyId}, target=${targetUserId}, newRole=${newRole}, by=${adminUserId}`,
    );
  }

  /**
   * 대상 멤버 조회 — 없으면 NotFoundException
   * @param studyId - 스터디 ID
   * @param targetUserId - 대상 사용자 ID
   */
  private async findTargetMember(studyId: string, targetUserId: string): Promise<MemberData> {
    try {
      return await this.identityClient.getMember(studyId, targetUserId) as MemberData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
      }
      throw error;
    }
  }

  /**
   * 최소 1명의 ADMIN 보장 — 마지막 ADMIN이면 BadRequestException
   * @param studyId - 스터디 ID
   */
  private async ensureNotLastAdmin(studyId: string): Promise<void> {
    const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
    const adminCount = allMembers.filter((m) => m.role === 'ADMIN').length;
    if (adminCount <= 1) {
      throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
    }
  }

  /**
   * 스터디 탈퇴 (A2: ADMIN 위임 필수)
   * ADMIN이면서 다른 ADMIN이 없으면 탈퇴 차단
   * @domain study
   * @api POST /studies/:id/leave
   * @guard study-member
   * @event STUDY_MEMBER_LEFT (publish)
   */
  async leaveStudy(studyId: string, userId: string): Promise<void> {
    // 본인 멤버 조회
    let member: MemberData;
    try {
      member = await this.identityClient.getMember(studyId, userId) as MemberData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
      }
      throw error;
    }

    // A2: ADMIN 위임 필수 — ADMIN이면서 다른 ADMIN이 없으면 탈퇴 차단
    if (member.role === 'ADMIN') {
      const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
      const adminCount = allMembers.filter((m) => m.role === 'ADMIN').length;
      if (adminCount <= 1) {
        throw new BadRequestException('탈퇴 전 ADMIN 권한을 다른 멤버에게 위임하세요.');
      }
    }

    await this.identityClient.removeMember(studyId, userId);

    // 캐시 무효화 + 알림
    await this.cache.invalidate(studyId, userId);

    await this.notifyMemberLeft(studyId);

    this.logger.log(`스터디 탈퇴: studyId=${studyId}, userId=${userId}`);
  }

  /**
   * 탈퇴 후 잔여 ADMIN에게 MEMBER_LEFT 알림 발행
   * @param studyId - 스터디 ID
   */
  private async notifyMemberLeft(studyId: string): Promise<void> {
    const [study, allMembers] = await Promise.all([
      this.identityClient.findStudyById(studyId) as Promise<StudyData>,
      this.identityClient.getMembers(studyId) as Promise<MemberData[]>,
    ]);
    const remainingAdmins = allMembers.filter((m) => m.role === 'ADMIN');

    await Promise.all(
      remainingAdmins.map((a) =>
        this.notificationService.createNotification({
          userId: a.user_id,
          studyId,
          type: NotificationType.MEMBER_LEFT,
          title: '멤버 탈퇴',
          message: `"${study?.name ?? '스터디'}"에서 멤버가 탈퇴했습니다.`,
          link: `/studies/${studyId}`,
        }),
      ),
    );
  }

  /**
   * 멤버 추방 (ADMIN만, 자기 자신 추방 불가)
   * @domain study
   * @guard study-admin
   */
  async removeMember(studyId: string, targetUserId: string, adminUserId: string): Promise<void> {
    if (targetUserId === adminUserId) {
      throw new BadRequestException('자기 자신을 추방할 수 없습니다.');
    }

    await this.access.verifyAdmin(studyId, adminUserId);

    const targetMember = await this.findTargetMember(studyId, targetUserId);

    // ADMIN 추방 시 최소 1 ADMIN 보장
    if (targetMember.role === 'ADMIN') {
      await this.ensureNotLastAdmin(studyId);
    }

    await this.identityClient.removeMember(studyId, targetUserId);

    // 캐시 무효화
    await this.cache.invalidate(studyId, targetUserId);

    this.logger.log(`멤버 추방: studyId=${studyId}, target=${targetUserId}, by=${adminUserId}`);
  }
}
