/**
 * @file 스터디 서비스 — CRUD, 멤버 관리, 초대, 통계, 정책
 * @domain study
 * @layer service
 * @related StudyController, IdentityClientService, InviteThrottleService
 *
 * Gateway 오케스트레이션 레이어:
 * - DB 접근은 IdentityClientService를 통해 Identity 서비스에 위임
 * - 알림, Redis 캐시, brute-force 방어 등 Gateway 고유 로직만 유지
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { IdentityClientService } from '../identity-client/identity-client.service';
import type { IdentityStudy as Study, IdentityStudyMember as StudyMember } from '../common/types/identity.types';
import { StudyMemberRole, NotificationType } from '../common/types/identity.types';
import { NotificationService } from '../notification/notification.service';
import { InviteThrottleService } from './invite-throttle.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── CONSTANTS ────────────────────────────
const MAX_MEMBERS = 50;

// ─── 내부 인터페이스 (Identity API 응답 매핑) ─────────────────
interface StudyData {
  id: string;
  name: string;
  description: string | null;
  github_repo: string | null;
  groundRules: string | null;
  status: string;
  created_by: string;
  [key: string]: unknown;
}

interface MemberData {
  id: string;
  study_id: string;
  user_id: string;
  role: string;
  nickname: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
  [key: string]: unknown;
}

interface InviteData {
  id: string;
  study_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  used_count: number;
  study?: StudyData;
  [key: string]: unknown;
}

@Injectable()
export class StudyService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly identityClient: IdentityClientService,
    private readonly notificationService: NotificationService,
    private readonly inviteThrottle: InviteThrottleService,
  ) {
    this.logger.setContext(StudyService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
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
    data: { name: string; description?: string; nickname: string; githubRepo?: string },
  ): Promise<Study> {
    const savedStudy = await this.identityClient.createStudy({
      name: data.name,
      description: data.description,
      created_by: userId,
      nickname: data.nickname,
      github_repo: data.githubRepo,
    }) as StudyData;

    // 캐시 무효화는 커밋 후 실행
    await this.invalidateMembershipCache(savedStudy.id, userId);

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
    data: { name?: string; description?: string },
  ): Promise<Study> {
    await this.verifyAdmin(studyId, userId);

    const study = await this.identityClient.updateStudy(studyId, data) as StudyData;
    return study as unknown as Study;
  }

  /**
   * 스터디 삭제 (ADMIN 1명일 때만 허용)
   * @domain study
   * @guard study-admin
   * @policy 관리자가 2명 이상이면 삭제 불가 — 단독 관리자만 삭제 가능
   */
  async deleteStudy(studyId: string, userId: string): Promise<void> {
    await this.verifyAdmin(studyId, userId);

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
    const keys = await this.redis.keys(`membership:${studyId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

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
    await this.verifyAdmin(studyId, adminUserId);

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
    await this.verifyAdmin(studyId, userId);

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
    await this.verifyAdmin(studyId, userId);

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

    let invite: InviteData;
    try {
      invite = await this.identityClient.findInviteByCode(code) as InviteData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.inviteThrottle.recordFailure(ip, code);
      }
      throw error;
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new BadRequestException('초대코드 사용 한도 초과');
    }

    return { valid: true, studyName: invite.study?.name ?? '' };
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
    let invite: InviteData;
    try {
      invite = await this.identityClient.findInviteByCode(code) as InviteData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.inviteThrottle.recordFailure(ip, code);
      }
      throw error;
    }

    const studyId = invite.study_id;

    // 만료 체크
    if (new Date(invite.expires_at) < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    // S7: max_uses 검증
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new BadRequestException('초대코드 사용 한도 초과');
    }

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

    // 멤버 추가
    await this.identityClient.addMember(studyId, {
      userId,
      nickname,
      role: 'MEMBER',
    });

    // S7: 사용 횟수 증가
    await this.identityClient.consumeInvite(invite.id);

    // 캐시 무효화 + brute force 카운터 초기화
    await this.invalidateMembershipCache(studyId, userId);
    await this.inviteThrottle.clearFailures(ip, code);

    // 가입 알림 발행 — ADMIN에게 MEMBER_JOINED 알림
    const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
    const admins = allMembers.filter((a) => a.role === 'ADMIN');

    const study = invite.study ?? await this.identityClient.findStudyById(studyId) as StudyData;

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

    this.logger.log(`스터디 가입: studyId=${studyId}, userId=${userId}`);
    return {
      ...(study as StudyData),
      role: StudyMemberRole.MEMBER,
    } as unknown as Study & { role: StudyMemberRole };
  }

  // ─── 통계 ─────────────────────────────────

  /**
   * 스터디 통계 조회 (Submission Service 내부 API 호출)
   * @domain study
   * @api GET /studies/:id/stats
   * @guard study-member
   */
  async getStudyStats(studyId: string, userId: string, weekNumber?: string) {
    // ACTIVE 문제 ID 조회 — 삭제(CLOSED) 문제 제출을 집계에서 제외
    const activeProblemIds = await this.fetchActiveProblemIds(studyId);

    const submissionServiceUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const params = new URLSearchParams();
    if (weekNumber) params.set('weekNumber', weekNumber);
    params.set('userId', userId);
    if (activeProblemIds) {
      params.set('activeProblemIds', activeProblemIds.join(','));
    }
    const qs = `?${params.toString()}`;
    const response = await fetch(
      `${submissionServiceUrl}/internal/stats/${studyId}${qs}`,
      {
        method: 'GET',
        headers: {
          'x-internal-key': internalKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      this.logger.error(`통계 조회 실패: studyId=${studyId}, status=${response.status}`);
      throw new NotFoundException('통계 데이터를 조회할 수 없습니다.');
    }

    const result = (await response.json()) as { data: unknown };

    // 멤버 이름 매핑: byMember의 userId를 멤버 목록과 매칭
    const members = await this.identityClient.getMembers(studyId) as MemberData[];
    const memberMap = new Map(members.map((m) => [m.user_id, m]));

    const data = result.data as {
      totalSubmissions: number;
      uniqueSubmissions: number;
      uniqueAnalyzed: number;
      byWeek: { week: string; count: number }[];
      byWeekPerUser: { userId: string; week: string; count: number }[];
      byMember: { userId: string; count: number; doneCount: number; uniqueProblemCount: number; uniqueDoneCount: number }[];
      byMemberWeek: { userId: string; count: number }[] | null;
      recentSubmissions: unknown[];
      solvedProblemIds: string[] | null;
      submitterCountByProblem: { problemId: string; count: number; analyzedCount: number }[];
    };

    const mapMemberInfo = (m: { userId: string; count: number; doneCount: number; uniqueProblemCount: number; uniqueDoneCount: number }) => ({
      userId: m.userId,
      isMember: memberMap.has(m.userId),
      nickname: memberMap.get(m.userId)?.nickname ?? null,
      count: m.count,
      doneCount: m.doneCount,
      uniqueProblemCount: m.uniqueProblemCount,
      uniqueDoneCount: m.uniqueDoneCount,
    });

    return {
      totalSubmissions: data.totalSubmissions,
      uniqueSubmissions: data.uniqueSubmissions ?? 0,
      uniqueAnalyzed: data.uniqueAnalyzed ?? 0,
      byWeek: data.byWeek,
      byWeekPerUser: data.byWeekPerUser,
      byMember: data.byMember.map(mapMemberInfo),
      byMemberWeek: data.byMemberWeek?.map((m) => ({
        userId: m.userId,
        isMember: memberMap.has(m.userId),
        nickname: memberMap.get(m.userId)?.nickname ?? null,
        count: m.count,
      })) ?? null,
      recentSubmissions: (data.recentSubmissions as { userId: string; [key: string]: unknown }[]).map((s) => ({
        ...s,
        nickname: memberMap.get(s.userId)?.nickname ?? null,
      })),
      solvedProblemIds: data.solvedProblemIds ?? [],
      submitterCountByProblem: data.submitterCountByProblem ?? [],
    };
  }

  /**
   * Problem Service에서 ACTIVE 문제 ID 목록 조회
   * 실패 시 undefined 반환 (기존 동작 유지 — 전체 집계)
   */
  private async fetchActiveProblemIds(studyId: string): Promise<string[] | undefined> {
    try {
      const problemServiceUrl = this.configService.getOrThrow<string>('PROBLEM_SERVICE_URL');
      const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_PROBLEM');

      const response = await fetch(
        `${problemServiceUrl}/internal/active-ids/${studyId}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`ACTIVE 문제 ID 조회 실패: studyId=${studyId}, status=${response.status}`);
        return undefined;
      }

      const result = (await response.json()) as { data: string[] };
      return result.data;
    } catch (error: unknown) {
      this.logger.warn(`ACTIVE 문제 ID 조회 오류: studyId=${studyId}, ${(error as Error).message}`);
      return undefined;
    }
  }

  // ─── 멤버 관리 ────────────────────────────────

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
    return members as unknown as (StudyMember & { username?: string; email?: string; avatar_url?: string | null })[];
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
    await this.verifyAdmin(studyId, adminUserId);

    // 자기 자신 변경 불가
    if (targetUserId === adminUserId) {
      throw new BadRequestException('자기 자신의 역할을 변경할 수 없습니다.');
    }

    // 대상 멤버 조회
    let targetMember: MemberData;
    try {
      targetMember = await this.identityClient.getMember(studyId, targetUserId) as MemberData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
      }
      throw error;
    }

    // ADMIN -> MEMBER 강등 시 최소 1 ADMIN 보장
    if (targetMember.role === 'ADMIN' && newRole === 'MEMBER') {
      const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
      const adminCount = allMembers.filter((m) => m.role === 'ADMIN').length;
      if (adminCount <= 1) {
        throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
      }
    }

    await this.identityClient.changeRole(studyId, targetUserId, { role: newRole });

    // 캐시 무효화 + 알림
    await this.invalidateMembershipCache(studyId, targetUserId);

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
    await this.invalidateMembershipCache(studyId, userId);

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

    this.logger.log(`스터디 탈퇴: studyId=${studyId}, userId=${userId}`);
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

    await this.verifyAdmin(studyId, adminUserId);

    // 대상 멤버 조회
    let targetMember: MemberData;
    try {
      targetMember = await this.identityClient.getMember(studyId, targetUserId) as MemberData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
      }
      throw error;
    }

    // ADMIN 추방 시 최소 1 ADMIN 보장
    if (targetMember.role === 'ADMIN') {
      const allMembers = await this.identityClient.getMembers(studyId) as MemberData[];
      const adminCount = allMembers.filter((m) => m.role === 'ADMIN').length;
      if (adminCount <= 1) {
        throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
      }
    }

    await this.identityClient.removeMember(studyId, targetUserId);

    // 캐시 무효화
    await this.invalidateMembershipCache(studyId, targetUserId);

    this.logger.log(`멤버 추방: studyId=${studyId}, target=${targetUserId}, by=${adminUserId}`);
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
    await this.verifyAdmin(studyId, userId);

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

  // ─── 권한 검증 헬퍼 ───────────────────────────

  /**
   * 스터디 멤버 여부 검증
   * @guard study-member
   */
  private async verifyMembership(studyId: string, userId: string): Promise<MemberData> {
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
   * @guard study-admin
   */
  private async verifyAdmin(studyId: string, userId: string): Promise<MemberData> {
    const member = await this.verifyMembership(studyId, userId);
    if (member.role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN 권한이 필요합니다.');
    }
    return member;
  }

  /**
   * Redis 멤버십 캐시 무효화 — 통일 키 규격
   * @domain study
   */
  private async invalidateMembershipCache(studyId: string, userId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`membership:${studyId}:${userId}`),
      this.redis.del(`membership:${studyId}:${userId}:denied`),
    ]);
  }
}
