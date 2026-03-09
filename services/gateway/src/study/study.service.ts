/**
 * @file 스터디 서비스 — CRUD, 멤버 관리, 초대, 통계, 정책
 * @domain study
 * @layer service
 * @related StudyController, Study, StudyMember, InviteThrottleService
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Study, StudyMember, StudyMemberRole, StudyInvite, StudyStatus } from './study.entity';
import { User } from '../auth/oauth/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { InviteThrottleService } from './invite-throttle.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── CONSTANTS ────────────────────────────
const MAX_MEMBERS = 50;

@Injectable()
export class StudyService {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,
    @InjectRepository(StudyMember)
    private readonly memberRepository: Repository<StudyMember>,
    @InjectRepository(StudyInvite)
    private readonly inviteRepository: Repository<StudyInvite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly inviteThrottle: InviteThrottleService,
    private readonly dataSource: DataSource,
  ) {
    this.logger.setContext(StudyService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const study = queryRunner.manager.create(Study, {
        name: data.name,
        description: data.description ?? null,
        github_repo: data.githubRepo ?? null,
        created_by: userId,
        status: StudyStatus.ACTIVE,
      });

      const savedStudy = await queryRunner.manager.save(study);

      // 생성자를 ADMIN으로 자동 등록 (닉네임 포함)
      const member = queryRunner.manager.create(StudyMember, {
        study_id: savedStudy.id,
        user_id: userId,
        role: StudyMemberRole.ADMIN,
        nickname: data.nickname,
      });
      await queryRunner.manager.save(member);

      await queryRunner.commitTransaction();

      // 캐시 무효화는 커밋 후 실행
      await this.invalidateMembershipCache(savedStudy.id, userId);

      this.logger.log(`스터디 생성: studyId=${savedStudy.id}, creator=${userId}`);
      return savedStudy;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 내 스터디 목록 조회
   * @domain study
   * @param userId - 사용자 ID
   */
  async getMyStudies(userId: string): Promise<(Study & { role: StudyMemberRole })[]> {
    const memberships = await this.memberRepository.find({
      where: { user_id: userId },
      relations: ['study'],
    });

    return memberships.map((m) => ({
      ...m.study,
      role: m.role,
      generatePublicId: m.study.generatePublicId.bind(m.study),
    }));
  }

  /**
   * 스터디 상세 조회 (멤버 권한 검증, groundRules 포함)
   * @domain study
   * @api GET /studies/:id
   * @guard study-member
   */
  async getStudyById(studyId: string, _userId: string): Promise<Study> {
    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }
    return study;
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

    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }

    if (data.name !== undefined) study.name = data.name;
    if (data.description !== undefined) study.description = data.description;

    return this.studyRepository.save(study);
  }

  /**
   * 스터디 삭제 (ADMIN 1명일 때만 허용)
   * @domain study
   * @guard study-admin
   * @policy 관리자가 2명 이상이면 삭제 불가 — 단독 관리자만 삭제 가능
   */
  async deleteStudy(studyId: string, userId: string): Promise<void> {
    await this.verifyAdmin(studyId, userId);

    const adminCount = await this.memberRepository.count({
      where: { study_id: studyId, role: StudyMemberRole.ADMIN },
    });
    if (adminCount > 1) {
      throw new BadRequestException(
        '관리자가 2명 이상인 스터디는 삭제할 수 없습니다. 다른 관리자의 권한을 해제한 후 다시 시도하세요.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // FK 제약 순서: invite → member → study
      await queryRunner.manager.delete(StudyInvite, { study_id: studyId });
      await queryRunner.manager.delete(StudyMember, { study_id: studyId });
      const result = await queryRunner.manager.delete(Study, { id: studyId });

      if (result.affected === 0) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('스터디를 찾을 수 없습니다.');
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

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

    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }

    if (study.status === StudyStatus.CLOSED) {
      throw new BadRequestException('이미 종료된 스터디입니다.');
    }

    // CLOSED 상태 전환
    study.status = StudyStatus.CLOSED;
    await this.studyRepository.save(study);

    // 전체 멤버에게 STUDY_CLOSED 알림 (실행자 제외)
    const members = await this.memberRepository.find({ where: { study_id: studyId } });
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

    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }

    study.groundRules = groundRules;
    const saved = await this.studyRepository.save(study);

    this.logger.log(`그라운드 룰 수정: studyId=${studyId}, by=${userId}`);
    return saved;
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

    // varchar(20) 제약 -> 8자리 영숫자 코드
    const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5분 유효

    const invite = this.inviteRepository.create({
      study_id: studyId,
      code,
      created_by: userId,
      expires_at: expiresAt,
    });

    await this.inviteRepository.save(invite);

    this.logger.log(`초대 코드 발급: studyId=${studyId}, by=${userId}`);
    return { code, expires_at: expiresAt };
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

    const invite = await this.inviteRepository.findOne({ where: { code }, relations: ['study'] });
    if (!invite) {
      await this.inviteThrottle.recordFailure(ip, code);
      throw new NotFoundException('유효하지 않은 초대 코드입니다.');
    }

    if (invite.expires_at < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new BadRequestException('초대코드 사용 한도 초과');
    }

    return { valid: true, studyName: invite.study.name };
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
    // Brute force 잠금 선제 검사 (트랜잭션 밖에서 수행)
    await this.inviteThrottle.checkLock(ip, code);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // FOR UPDATE 비관적 락으로 invite 조회 — race condition 방지
      // relations와 pessimistic_write를 함께 사용하면 LEFT JOIN + FOR UPDATE 충돌
      const invite = await queryRunner.manager.findOne(StudyInvite, {
        where: { code },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invite) {
        await queryRunner.rollbackTransaction();
        await this.inviteThrottle.recordFailure(ip, code);
        throw new NotFoundException('유효하지 않은 초대 코드입니다.');
      }

      // study를 별도 조회 (LEFT JOIN + FOR UPDATE 충돌 회피)
      const study = await queryRunner.manager.findOne(Study, {
        where: { id: invite.study_id },
      });
      if (!study) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('스터디를 찾을 수 없습니다.');
      }
      invite.study = study;

      // 만료 체크
      if (invite.expires_at < new Date()) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('만료된 초대 코드입니다.');
      }

      // S7: max_uses 검증 — 사용 한도 초과 시 차단
      if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('초대코드 사용 한도 초과');
      }

      // 이미 가입된 멤버 체크
      const existing = await queryRunner.manager.findOne(StudyMember, {
        where: { study_id: invite.study_id, user_id: userId },
      });
      if (existing) {
        await queryRunner.rollbackTransaction();
        throw new ConflictException('이미 가입된 스터디입니다.');
      }

      // B1: 멤버 50명 제한 (트랜잭션 내에서 정확한 count)
      const memberCount = await queryRunner.manager.count(StudyMember, {
        where: { study_id: invite.study_id },
      });
      if (memberCount >= MAX_MEMBERS) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('스터디 멤버 수가 최대 인원(50명)에 도달했습니다.');
      }

      const member = queryRunner.manager.create(StudyMember, {
        study_id: invite.study_id,
        user_id: userId,
        role: StudyMemberRole.MEMBER,
        nickname,
      });

      await queryRunner.manager.save(member);

      // S7: 사용 횟수 증가
      invite.used_count += 1;
      await queryRunner.manager.save(invite);

      await queryRunner.commitTransaction();

      // 커밋 후 캐시 무효화 + brute force 카운터 초기화
      await this.invalidateMembershipCache(invite.study_id, userId);
      await this.inviteThrottle.clearFailures(ip, code);

      // 가입 알림 발행 — ADMIN에게 MEMBER_JOINED 알림
      const admins = await this.memberRepository.find({
        where: { study_id: study.id, role: StudyMemberRole.ADMIN },
      });
      await Promise.all(
        admins
          .filter((a) => a.user_id !== userId)
          .map((a) =>
            this.notificationService.createNotification({
              userId: a.user_id,
              studyId: study.id,
              type: NotificationType.MEMBER_JOINED,
              title: '새 멤버 가입',
              message: `"${study.name}"에 새 멤버가 가입했습니다.`,
              link: `/studies/${study.id}`,
            }),
          ),
      );

      this.logger.log(`스터디 가입: studyId=${invite.study_id}, userId=${userId}`);
      return {
        ...study,
        role: StudyMemberRole.MEMBER,
        generatePublicId: study.generatePublicId.bind(study),
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── 통계 ─────────────────────────────────

  /**
   * 스터디 통계 조회 (Submission Service 내부 API 호출)
   * @domain study
   * @api GET /studies/:id/stats
   * @guard study-member
   */
  async getStudyStats(studyId: string, userId: string, weekNumber?: string) {
    const submissionServiceUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const params = new URLSearchParams();
    if (weekNumber) params.set('weekNumber', weekNumber);
    params.set('userId', userId);
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
    const members = await this.memberRepository.find({
      where: { study_id: studyId },
    });
    const memberMap = new Map(members.map((m) => [m.user_id, m]));

    const data = result.data as {
      totalSubmissions: number;
      byWeek: { week: string; count: number }[];
      byWeekPerUser: { userId: string; week: string; count: number }[];
      byMember: { userId: string; count: number; doneCount: number }[];
      byMemberWeek: { userId: string; count: number }[] | null;
      recentSubmissions: unknown[];
      solvedProblemIds: string[] | null;
    };

    const mapMemberInfo = (m: { userId: string; count: number; doneCount: number }) => ({
      userId: m.userId,
      isMember: memberMap.has(m.userId),
      nickname: memberMap.get(m.userId)?.nickname ?? null,
      count: m.count,
      doneCount: m.doneCount,
    });

    return {
      totalSubmissions: data.totalSubmissions,
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
    };
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
    const members = await this.memberRepository.find({ where: { study_id: studyId } });
    const userIds = members.map((m) => m.user_id);

    if (userIds.length === 0) return [];

    const users = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url'])
      .where('u.id IN (:...ids)', { ids: userIds })
      .getMany();

    const userMap = new Map(users.map((u) => [u.id, u]));

    return members.map((m) => {
      const u = userMap.get(m.user_id);
      return {
        ...m,
        nickname: m.nickname,
        username: u?.name ?? undefined,
        email: u?.email ?? undefined,
        avatar_url: u?.avatar_url ?? null,
      };
    });
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
    const member = await this.memberRepository.findOne({
      where: { study_id: studyId, user_id: userId },
    });
    if (!member) {
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }
    member.nickname = nickname;
    await this.memberRepository.save(member);
    return { nickname: member.nickname };
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // FOR UPDATE 락으로 대상 멤버 조회 — 동시 역할 변경 방지
      const targetMember = await queryRunner.manager.findOne(StudyMember, {
        where: { study_id: studyId, user_id: targetUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetMember) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
      }

      // ADMIN -> MEMBER 강등 시 최소 1 ADMIN 보장 (FOR UPDATE로 정확한 count)
      if (targetMember.role === StudyMemberRole.ADMIN && newRole === StudyMemberRole.MEMBER) {
        const adminCount = await queryRunner.manager.count(StudyMember, {
          where: { study_id: studyId, role: StudyMemberRole.ADMIN },
        });
        if (adminCount <= 1) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
        }
      }

      targetMember.role = newRole;
      await queryRunner.manager.save(targetMember);

      await queryRunner.commitTransaction();

      // 커밋 후 캐시 무효화 + 알림
      await this.invalidateMembershipCache(studyId, targetUserId);

      const study = await this.studyRepository.findOne({ where: { id: studyId } });
      const roleLabel = newRole === StudyMemberRole.ADMIN ? '관리자' : '멤버';
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
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // FOR UPDATE 락으로 본인 멤버 조회 — 동시 탈퇴 + 역할 변경 방지
      const member = await queryRunner.manager.findOne(StudyMember, {
        where: { study_id: studyId, user_id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!member) {
        await queryRunner.rollbackTransaction();
        throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
      }

      // A2: ADMIN 위임 필수 — ADMIN이면서 다른 ADMIN이 없으면 탈퇴 차단
      if (member.role === StudyMemberRole.ADMIN) {
        const adminCount = await queryRunner.manager.count(StudyMember, {
          where: { study_id: studyId, role: StudyMemberRole.ADMIN },
        });
        if (adminCount <= 1) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException('탈퇴 전 ADMIN 권한을 다른 멤버에게 위임하세요.');
        }
      }

      await queryRunner.manager.delete(StudyMember, { study_id: studyId, user_id: userId });

      await queryRunner.commitTransaction();

      // 커밋 후 캐시 무효화 + 알림
      await this.invalidateMembershipCache(studyId, userId);

      const [study, remainingAdmins] = await Promise.all([
        this.studyRepository.findOne({ where: { id: studyId } }),
        this.memberRepository.find({
          where: { study_id: studyId, role: StudyMemberRole.ADMIN },
        }),
      ]);

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
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ADMIN 권한 검증 — 트랜잭션 내 FOR UPDATE 락으로 race condition 방지
      const adminMember = await queryRunner.manager.findOne(StudyMember, {
        where: { study_id: studyId, user_id: adminUserId, role: StudyMemberRole.ADMIN },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adminMember) {
        await queryRunner.rollbackTransaction();
        throw new ForbiddenException('스터디 관리자만 멤버를 추방할 수 있습니다.');
      }

      // FOR UPDATE 락으로 대상 멤버 조회 — ADMIN 추방 시 0명 방지
      const targetMember = await queryRunner.manager.findOne(StudyMember, {
        where: { study_id: studyId, user_id: targetUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetMember) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
      }

      // ADMIN 추방 시 최소 1 ADMIN 보장
      if (targetMember.role === StudyMemberRole.ADMIN) {
        const adminCount = await queryRunner.manager.count(StudyMember, {
          where: { study_id: studyId, role: StudyMemberRole.ADMIN },
        });
        if (adminCount <= 1) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
        }
      }

      await queryRunner.manager.delete(StudyMember, {
        study_id: studyId,
        user_id: targetUserId,
      });

      await queryRunner.commitTransaction();

      // 커밋 후 캐시 무효화
      await this.invalidateMembershipCache(studyId, targetUserId);

      this.logger.log(`멤버 추방: studyId=${studyId}, target=${targetUserId}, by=${adminUserId}`);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      this.memberRepository.find({ where: { study_id: studyId } }),
      this.studyRepository.findOne({ where: { id: studyId } }),
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
  private async verifyMembership(studyId: string, userId: string): Promise<StudyMember> {
    const member = await this.memberRepository.findOne({
      where: { study_id: studyId, user_id: userId },
    });
    if (!member) {
      throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    }
    return member;
  }

  /**
   * ADMIN 권한 검증
   * @guard study-admin
   */
  private async verifyAdmin(studyId: string, userId: string): Promise<StudyMember> {
    const member = await this.verifyMembership(studyId, userId);
    if (member.role !== StudyMemberRole.ADMIN) {
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
