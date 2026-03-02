import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Study, StudyMember, StudyMemberRole, StudyInvite } from './study.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';

@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,
    @InjectRepository(StudyMember)
    private readonly memberRepository: Repository<StudyMember>,
    @InjectRepository(StudyInvite)
    private readonly inviteRepository: Repository<StudyInvite>,
    private readonly notificationService: NotificationService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  // --- 스터디 CRUD ---

  async createStudy(
    userId: string,
    data: { name: string; description?: string },
  ): Promise<Study> {
    const study = this.studyRepository.create({
      name: data.name,
      description: data.description ?? null,
      created_by: userId,
    });

    const savedStudy = await this.studyRepository.save(study);

    // 생성자를 ADMIN으로 자동 등록
    const member = this.memberRepository.create({
      study_id: savedStudy.id,
      user_id: userId,
      role: StudyMemberRole.ADMIN,
    });
    await this.memberRepository.save(member);

    await this.invalidateMembershipCache(savedStudy.id, userId);

    this.logger.log(`스터디 생성: studyId=${savedStudy.id}, creator=${userId}`);
    return savedStudy;
  }

  async getMyStudies(userId: string): Promise<(Study & { role: StudyMemberRole })[]> {
    const memberships = await this.memberRepository.find({
      where: { user_id: userId },
      relations: ['study'],
    });

    return memberships.map((m) => ({
      ...m.study,
      role: m.role,
    }));
  }

  async getStudyById(studyId: string, userId: string): Promise<Study> {
    await this.verifyMembership(studyId, userId);

    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }
    return study;
  }

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

  async deleteStudy(studyId: string, userId: string): Promise<void> {
    await this.verifyAdmin(studyId, userId);

    const result = await this.studyRepository.delete(studyId);
    if (result.affected === 0) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }

    // Redis 캐시 패턴 삭제
    const keys = await this.redis.keys(`study:membership:${studyId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.logger.log(`스터디 삭제: studyId=${studyId}, by=${userId}`);
  }

  // --- 초대 코드 ---

  async createInvite(studyId: string, userId: string): Promise<{ code: string; expires_at: Date }> {
    await this.verifyAdmin(studyId, userId);

    // varchar(20) 제약 → 8자리 영숫자 코드 (UUID 대신)
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

  async joinByInviteCode(userId: string, code: string): Promise<Study & { role: StudyMemberRole }> {
    const invite = await this.inviteRepository.findOne({ where: { code }, relations: ['study'] });
    if (!invite) {
      throw new NotFoundException('유효하지 않은 초대 코드입니다.');
    }

    if (invite.expires_at < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    const existing = await this.memberRepository.findOne({
      where: { study_id: invite.study_id, user_id: userId },
    });
    if (existing) {
      throw new ConflictException('이미 가입된 스터디입니다.');
    }

    const member = this.memberRepository.create({
      study_id: invite.study_id,
      user_id: userId,
      role: StudyMemberRole.MEMBER,
    });

    await this.memberRepository.save(member);
    await this.invalidateMembershipCache(invite.study_id, userId);

    this.logger.log(`스터디 가입: studyId=${invite.study_id}, userId=${userId}`);
    return { ...invite.study, role: StudyMemberRole.MEMBER };
  }

  // --- 통계 ---

  async getStudyStats(studyId: string, userId: string) {
    await this.verifyMembership(studyId, userId);

    const submissionServiceUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const response = await fetch(
      `${submissionServiceUrl}/internal/stats/${studyId}`,
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
      byWeek: { week: number; count: number }[];
      byMember: { userId: string; count: number; doneCount: number }[];
      recentSubmissions: unknown[];
    };

    const byMemberWithInfo = data.byMember.map((m) => ({
      userId: m.userId,
      isMember: memberMap.has(m.userId),
      count: m.count,
      doneCount: m.doneCount,
    }));

    return {
      totalSubmissions: data.totalSubmissions,
      byWeek: data.byWeek,
      byMember: byMemberWithInfo,
      recentSubmissions: data.recentSubmissions,
    };
  }

  // --- 멤버 관리 ---

  async getMembers(studyId: string, userId: string): Promise<StudyMember[]> {
    await this.verifyMembership(studyId, userId);
    return this.memberRepository.find({ where: { study_id: studyId } });
  }

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
    const targetMember = await this.memberRepository.findOne({
      where: { study_id: studyId, user_id: targetUserId },
    });
    if (!targetMember) {
      throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
    }

    // ADMIN → MEMBER 강등 시 최소 1 ADMIN 보장
    if (targetMember.role === StudyMemberRole.ADMIN && newRole === StudyMemberRole.MEMBER) {
      const adminCount = await this.memberRepository.count({
        where: { study_id: studyId, role: StudyMemberRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('최소 1명의 ADMIN이 필요합니다.');
      }
    }

    targetMember.role = newRole;
    await this.memberRepository.save(targetMember);

    // Redis 캐시 즉시 무효화
    await this.invalidateMembershipCache(studyId, targetUserId);

    // 대상 멤버에게 역할 변경 알림
    const study = await this.studyRepository.findOne({ where: { id: studyId } });
    const roleLabel = newRole === StudyMemberRole.ADMIN ? '관리자' : '멤버';
    await this.notificationService.createNotification(
      targetUserId,
      NotificationType.ROLE_CHANGED,
      '역할 변경',
      `"${study?.name ?? '스터디'}"에서 역할이 ${roleLabel}(으)로 변경되었습니다.`,
      `/studies/${studyId}`,
    );

    this.logger.log(
      `역할 변경: studyId=${studyId}, target=${targetUserId}, newRole=${newRole}, by=${adminUserId}`,
    );
  }

  async removeMember(studyId: string, targetUserId: string, adminUserId: string): Promise<void> {
    await this.verifyAdmin(studyId, adminUserId);

    if (targetUserId === adminUserId) {
      throw new BadRequestException('자기 자신을 추방할 수 없습니다.');
    }

    const result = await this.memberRepository.delete({
      study_id: studyId,
      user_id: targetUserId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
    }

    // Redis 멤버십 캐시 즉시 무효화
    await this.invalidateMembershipCache(studyId, targetUserId);

    this.logger.log(`멤버 추방: studyId=${studyId}, target=${targetUserId}, by=${adminUserId}`);
  }

  // --- 문제 생성 알림 ---

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
        this.notificationService.createNotification(
          m.user_id,
          NotificationType.PROBLEM_CREATED,
          '새 문제 등록',
          `"${studyName}"에 새 문제 "${problemTitle}" (${weekNumber})이 추가되었습니다.`,
          `/problems/${problemId}`,
        ),
      ),
    );

    this.logger.log(
      `문제 생성 알림: studyId=${studyId}, problemId=${problemId}, 대상=${targets.length}명`,
    );
  }

  // --- 권한 검증 헬퍼 ---

  private async verifyMembership(studyId: string, userId: string): Promise<StudyMember> {
    const member = await this.memberRepository.findOne({
      where: { study_id: studyId, user_id: userId },
    });
    if (!member) {
      throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    }
    return member;
  }

  private async verifyAdmin(studyId: string, userId: string): Promise<StudyMember> {
    const member = await this.verifyMembership(studyId, userId);
    if (member.role !== StudyMemberRole.ADMIN) {
      throw new ForbiddenException('ADMIN 권한이 필요합니다.');
    }
    return member;
  }

  private async invalidateMembershipCache(studyId: string, userId: string): Promise<void> {
    await this.redis.del(`study:membership:${studyId}:${userId}`);
  }
}
