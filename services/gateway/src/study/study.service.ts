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
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
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

  async getMyStudies(userId: string): Promise<Study[]> {
    const memberships = await this.memberRepository.find({
      where: { user_id: userId },
      relations: ['study'],
    });

    return memberships.map((m) => m.study);
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

    const code = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 유효

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

  async joinByInviteCode(userId: string, code: string): Promise<StudyMember> {
    const invite = await this.inviteRepository.findOne({ where: { code } });
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
      throw new ConflictException('이미 해당 스터디의 멤버입니다.');
    }

    const member = this.memberRepository.create({
      study_id: invite.study_id,
      user_id: userId,
      role: StudyMemberRole.MEMBER,
    });

    const savedMember = await this.memberRepository.save(member);
    await this.invalidateMembershipCache(invite.study_id, userId);

    this.logger.log(`스터디 가입: studyId=${invite.study_id}, userId=${userId}`);
    return savedMember;
  }

  // --- 멤버 관리 ---

  async getMembers(studyId: string, userId: string): Promise<StudyMember[]> {
    await this.verifyMembership(studyId, userId);
    return this.memberRepository.find({ where: { study_id: studyId } });
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
