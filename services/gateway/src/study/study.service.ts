/**
 * @file 스터디 서비스 — CRUD, 종료, 그라운드 룰, 초대, 문제 생성 알림
 * @domain study
 * @layer service
 * @related StudyController, StudyAccessService, MembershipCacheService, InviteThrottleService
 *
 * Gateway 오케스트레이션 레이어 (CRUD 코어):
 * - DB 접근은 IdentityClientService를 통해 Identity 서비스에 위임
 * - 권한 검증은 StudyAccessService, 멤버십 캐시는 MembershipCacheService에 위임
 * - 멤버 관리는 StudyMemberService, 통계는 StudyStatsService로 분리됨
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { IdentityClientService } from '../identity-client/identity-client.service';
import type { IdentityStudy as Study } from '../common/types/identity.types';
import { StudyMemberRole, NotificationType } from '../common/types/identity.types';
import { NotificationService } from '../notification/notification.service';
import { InviteThrottleService } from './invite-throttle.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { StudyAccessService } from './study-access.service';
import { MembershipCacheService } from './membership-cache.service';
import type { StudyData, MemberData, InviteData } from './study.types';

// ─── CONSTANTS ────────────────────────────
const MAX_MEMBERS = 50;

@Injectable()
export class StudyService {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly identityClient: IdentityClientService,
    private readonly notificationService: NotificationService,
    private readonly inviteThrottle: InviteThrottleService,
    private readonly access: StudyAccessService,
    private readonly cache: MembershipCacheService,
  ) {
    this.logger.setContext(StudyService.name);
  }

  // ─── CRUD ──────────────────────────────────

  /**
   * 스터디 생성 (생성자 ADMIN 자동 등록 + 닉네임 필수)
   * @domain study
   * @param userId - 생성자 ID
   * @param data - 스터디 이름, 설명, 닉네임
   */
  async createStudy(
    userId: string,
    data: { name: string; description?: string; nickname: string; githubRepo?: string; avatarUrl?: string },
  ): Promise<Study> {
    const savedStudy = await this.identityClient.createStudy({
      name: data.name,
      description: data.description,
      created_by: userId,
      nickname: data.nickname,
      github_repo: data.githubRepo,
      avatar_url: data.avatarUrl,
    }) as StudyData;

    // 캐시 무효화는 커밋 후 실행
    await this.cache.invalidate(savedStudy.id, userId);

    this.logger.log(`스터디 생성: studyId=${savedStudy.id}, creator=${userId}`);
    return savedStudy as unknown as Study;
  }

  /**
   * 내 스터디 목록 조회
   * @domain study
   * @param userId - 사용자 ID
   */
  async getMyStudies(userId: string): Promise<(Study & { role: StudyMemberRole })[]> {
    const studies = await this.identityClient.findStudiesByUserId(userId);
    return studies as unknown as (Study & { role: StudyMemberRole })[];
  }

  /**
   * 스터디 상세 조회 (멤버 권한 검증, groundRules 포함)
   * @domain study
   * @api GET /studies/:id
   * @guard study-member
   */
  async getStudyById(studyId: string, _userId: string): Promise<Study> {
    const study = await this.identityClient.findStudyById(studyId) as StudyData;
    return study as unknown as Study;
  }

  /**
   * 스터디 수정 (ADMIN만)
   * @domain study
   * @guard study-admin
   */
  async updateStudy(
    studyId: string,
    userId: string,
    data: { name?: string; description?: string; avatarUrl?: string },
  ): Promise<Study> {
    await this.access.verifyAdmin(studyId, userId);

    const updateData: { name?: string; description?: string; avatar_url?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;

    const study = await this.identityClient.updateStudy(studyId, updateData) as StudyData;
    return study as unknown as Study;
  }

  /**
   * 스터디 삭제 (ADMIN 1명일 때만 허용)
   * @domain study
   * @guard study-admin
   * @policy 관리자가 2명 이상이면 삭제 불가 — 단독 관리자만 삭제 가능
   */
  async deleteStudy(studyId: string, userId: string): Promise<void> {
    await this.access.verifyAdmin(studyId, userId);

    // ADMIN 수 검증
    const members = await this.identityClient.getMembers(studyId) as MemberData[];
    const adminCount = members.filter((m) => m.role === 'ADMIN').length;
    if (adminCount > 1) {
      throw new BadRequestException(
        '관리자가 2명 이상인 스터디는 삭제할 수 없습니다. 다른 관리자의 권한을 해제한 후 다시 시도하세요.',
      );
    }

    await this.identityClient.deleteStudy(studyId);

    // Redis 캐시 패턴 삭제 (통일 키 규격)
    await this.cache.invalidateAll(studyId);

    this.logger.log(`스터디 삭제: studyId=${studyId}, by=${userId}`);
  }

  /**
   * 스터디 종료 — ADMIN 전용, CLOSED 상태 전환 + 전체 멤버 알림
   * CLOSED 스터디는 읽기 전용 (새 제출/문제 등록 불가)
   * @domain study
   * @api POST /studies/:id/close
   * @guard study-admin, closed-study
   * @event STUDY_CLOSED (publish)
   */
  async closeStudy(studyId: string, adminUserId: string): Promise<void> {
    await this.access.verifyAdmin(studyId, adminUserId);

    const study = await this.identityClient.findStudyById(studyId) as StudyData;

    if (study.status === 'CLOSED') {
      throw new BadRequestException('이미 종료된 스터디입니다.');
    }

    // CLOSED 상태 전환
    await this.identityClient.updateStudy(studyId, { status: 'CLOSED' });

    // 전체 멤버에게 STUDY_CLOSED 알림 (실행자 제외)
    const members = await this.identityClient.getMembers(studyId) as MemberData[];
    const targets = members.filter((m) => m.user_id !== adminUserId);

    await Promise.all(
      targets.map((m) =>
        this.notificationService.createNotification({
          userId: m.user_id,
          studyId,
          type: NotificationType.STUDY_CLOSED,
          title: '스터디 종료',
          message: `"${study.name}"이(가) 종료되었습니다. 더 이상 새로운 제출이 불가합니다.`,
          link: `/studies/${studyId}`,
        }),
      ),
    );

    this.logger.log(`스터디 종료: studyId=${studyId}, by=${adminUserId}`);
  }

  // ─── 그라운드 룰 ─────────────────────────────

  /**
   * 그라운드 룰 수정 (ADMIN만, 500자 제한 — DTO에서 검증)
   * @domain study
   * @api PATCH /studies/:id/ground-rules
   * @guard study-admin
   */
  async updateGroundRules(studyId: string, userId: string, groundRules: string): Promise<Study> {
    await this.access.verifyAdmin(studyId, userId);

    const saved = await this.identityClient.updateStudy(studyId, { groundRules }) as StudyData;

    this.logger.log(`그라운드 룰 수정: studyId=${studyId}, by=${userId}`);
    return saved as unknown as Study;
  }

  // ─── 초대 코드 ────────────────────────────────

  /**
   * 초대 코드 발급 (ADMIN만, 5분 유효)
   * @domain study
   * @api POST /studies/:id/invite
   * @guard study-admin
   */
  async createInvite(studyId: string, userId: string): Promise<{ code: string; expires_at: Date }> {
    await this.access.verifyAdmin(studyId, userId);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5분 유효

    const invite = await this.identityClient.createInvite(studyId, {
      created_by: userId,
      expires_at: expiresAt.toISOString(),
    }) as InviteData;

    this.logger.log(`초대 코드 발급: studyId=${studyId}, by=${userId}`);
    return { code: invite.code, expires_at: new Date(invite.expires_at) };
  }

  /**
   * 초대 코드 검증 (가입 전 유효성 확인)
   * @domain study
   * @api POST /studies/verify-invite
   */
  async verifyInviteCode(
    code: string,
    ip: string,
  ): Promise<{ valid: boolean; studyName: string }> {
    await this.inviteThrottle.checkLock(ip, code);

    const invite = await this.findInviteOrRecordFailure(code, ip);

    if (new Date(invite.expires_at) < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new BadRequestException('초대코드 사용 한도 초과');
    }

    return { valid: true, studyName: invite.study?.name ?? '' };
  }

  /**
   * 초대 코드 조회 — NotFound 시 brute force 실패 카운트 기록
   * @param code - 초대 코드
   * @param ip - 요청 IP
   */
  private async findInviteOrRecordFailure(code: string, ip: string): Promise<InviteData> {
    try {
      return await this.identityClient.findInviteByCode(code) as InviteData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.inviteThrottle.recordFailure(ip, code);
      }
      throw error;
    }
  }

  /**
   * 초대 코드로 가입 (멤버 50명 제한 + brute force 방어 + 닉네임 필수)
   * @domain study
   * @api POST /studies/join
   * @guard invite-code-lock
   * @event STUDY_MEMBER_JOINED (publish)
   */
  async joinByInviteCode(
    userId: string,
    code: string,
    nickname: string,
    ip: string,
  ): Promise<Study & { role: StudyMemberRole }> {
    // Brute force 잠금 선제 검사
    await this.inviteThrottle.checkLock(ip, code);

    // 초대 코드 조회
    const invite = await this.findInviteOrRecordFailure(code, ip);
    const studyId = invite.study_id;

    this.assertInviteUsable(invite);
    await this.assertJoinable(studyId, userId);

    // 멤버 추가
    await this.identityClient.addMember(studyId, {
      userId,
      nickname,
      role: 'MEMBER',
    });

    // S7: 사용 횟수 증가
    await this.identityClient.consumeInvite(invite.id);

    // 캐시 무효화 + brute force 카운터 초기화
    await this.cache.invalidate(studyId, userId);
    await this.inviteThrottle.clearFailures(ip, code);

    const study = invite.study ?? await this.identityClient.findStudyById(studyId) as StudyData;
    await this.notifyAdminsOnJoin(studyId, userId, study);

    this.logger.log(`스터디 가입: studyId=${studyId}, userId=${userId}`);
    return {
      ...(study as StudyData),
      role: StudyMemberRole.MEMBER,
    } as unknown as Study & { role: StudyMemberRole };
  }

  /**
   * 초대 코드 사용 가능 여부 검증 (만료 + 사용 한도)
   * @param invite - 초대 코드 엔티티
   */
  private assertInviteUsable(invite: InviteData): void {
    // 만료 체크
    if (new Date(invite.expires_at) < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    // S7: max_uses 검증
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new BadRequestException('초대코드 사용 한도 초과');
    }
  }

  /**
   * 가입 가능 여부 검증 (기존 멤버 아님 + 50명 미만)
   * @param studyId - 스터디 ID
   * @param userId - 가입 사용자 ID
   */
  private async assertJoinable(studyId: string, userId: string): Promise<void> {
    // 이미 가입된 멤버 체크
    try {
      await this.identityClient.getMember(studyId, userId);
      // getMember가 성공하면 이미 가입된 멤버
      throw new ConflictException('이미 가입된 스터디입니다.');
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // NotFoundException이면 미가입 → 정상 진행
      if (!(error instanceof NotFoundException)) throw error;
    }

    // B1: 멤버 50명 제한
    const currentMembers = await this.identityClient.getMembers(studyId) as MemberData[];
    if (currentMembers.length >= MAX_MEMBERS) {
      throw new BadRequestException('스터디 멤버 수가 최대 인원(50명)에 도달했습니다.');
    }
  }

  /**
   * 가입 시 ADMIN에게 MEMBER_JOINED 알림 발행 (가입자 제외)
   * @param studyId - 스터디 ID
   * @param userId - 가입 사용자 ID
   * @param study - 스터디 엔티티
   */
  private async notifyAdminsOnJoin(studyId: string, userId: string, study: StudyData): Promise<void> {
    const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
    const admins = allMembers.filter((a) => a.role === 'ADMIN');

    await Promise.all(
      admins
        .filter((a) => a.user_id !== userId)
        .map((a) =>
          this.notificationService.createNotification({
            userId: a.user_id,
            studyId: studyId,
            type: NotificationType.MEMBER_JOINED,
            title: '새 멤버 가입',
            message: `"${study.name}"에 새 멤버가 가입했습니다.`,
            link: `/studies/${studyId}`,
          }),
        ),
    );
  }

  // ─── 문제 생성 알림 ───────────────────────────

  /**
   * 문제 생성 알림 (ADMIN만)
   * @domain study
   * @event PROBLEM_CREATED (publish)
   */
  async notifyProblemCreated(
    studyId: string,
    userId: string,
    problemTitle: string,
    weekNumber: string,
    problemId: string,
  ): Promise<void> {
    await this.access.verifyAdmin(studyId, userId);

    const [members, study] = await Promise.all([
      this.identityClient.getMembers(studyId) as Promise<MemberData[]>,
      this.identityClient.findStudyById(studyId) as Promise<StudyData>,
    ]);

    const studyName = study?.name ?? '스터디';
    const targets = members.filter((m) => m.user_id !== userId);

    await Promise.all(
      targets.map((m) =>
        this.notificationService.createNotification({
          userId: m.user_id,
          studyId,
          type: NotificationType.PROBLEM_CREATED,
          title: '새 문제 등록',
          message: `"${studyName}"에 새 문제 "${problemTitle}" (${weekNumber})이 추가되었습니다.`,
          link: `/problems/${problemId}`,
        }),
      ),
    );

    this.logger.log(
      `문제 생성 알림: studyId=${studyId}, problemId=${problemId}, 대상=${targets.length}명`,
    );
  }
}
