/**
 * @file Study 서비스 — CRUD, 멤버 관리, 초대 코드
 * @domain identity
 * @layer service
 * @related study.controller.ts, study.entity.ts
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Study,
  StudyMember,
  StudyMemberRole,
  StudyInvite,
  StudyStatus,
} from './study.entity';

@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    @InjectRepository(Study)
    private readonly studyRepo: Repository<Study>,
    @InjectRepository(StudyMember)
    private readonly memberRepo: Repository<StudyMember>,
    @InjectRepository(StudyInvite)
    private readonly inviteRepo: Repository<StudyInvite>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Study CRUD ──────────────────────────────

  /**
   * 스터디 생성 + 생성자 ADMIN 자동 등록 (트랜잭션)
   * @domain study
   */
  async createStudy(data: {
    name: string;
    description?: string;
    created_by: string;
    github_repo?: string;
    groundRules?: string;
    nickname: string;
  }): Promise<Study> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const study = queryRunner.manager.create(Study, {
        name: data.name,
        description: data.description ?? null,
        github_repo: data.github_repo ?? null,
        groundRules: data.groundRules ?? null,
        created_by: data.created_by,
        status: StudyStatus.ACTIVE,
      });
      const saved = await queryRunner.manager.save(study);

      const member = queryRunner.manager.create(StudyMember, {
        study_id: saved.id,
        user_id: data.created_by,
        role: StudyMemberRole.ADMIN,
        nickname: data.nickname,
      });
      await queryRunner.manager.save(member);

      await queryRunner.commitTransaction();
      this.logger.log(`스터디 생성: id=${saved.id}`);
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 스터디 상세 조회 (멤버 포함)
   * @domain study
   */
  async findById(id: string): Promise<Study> {
    const study = await this.studyRepo.findOne({
      where: { id },
    });
    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }
    return study;
  }

  /**
   * 사용자 참여 스터디 목록 (StudyMember JOIN)
   * @domain study
   */
  async findByUserId(userId: string): Promise<(Study & { role: StudyMemberRole })[]> {
    const memberships = await this.memberRepo.find({
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
   * 스터디 수정
   * @domain study
   */
  async updateStudy(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      github_repo: string;
      groundRules: string;
      status: StudyStatus;
    }>,
  ): Promise<Study> {
    const study = await this.findById(id);

    if (data.name !== undefined) study.name = data.name;
    if (data.description !== undefined) study.description = data.description;
    if (data.github_repo !== undefined) study.github_repo = data.github_repo;
    if (data.groundRules !== undefined) study.groundRules = data.groundRules;
    if (data.status !== undefined) study.status = data.status;

    return this.studyRepo.save(study);
  }

  /**
   * 스터디 삭제 (FK 순서: invite → member → study)
   * @domain study
   */
  async deleteStudy(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(StudyInvite, { study_id: id });
      await queryRunner.manager.delete(StudyMember, { study_id: id });
      const result = await queryRunner.manager.delete(Study, { id });

      if (result.affected === 0) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('스터디를 찾을 수 없습니다.');
      }

      await queryRunner.commitTransaction();
      this.logger.log(`스터디 삭제: id=${id}`);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── StudyMember 관리 ────────────────────────────

  /**
   * 멤버 추가
   * @domain study
   */
  async addMember(
    studyId: string,
    userId: string,
    nickname: string,
    role: StudyMemberRole = StudyMemberRole.MEMBER,
  ): Promise<StudyMember> {
    const member = this.memberRepo.create({
      study_id: studyId,
      user_id: userId,
      nickname,
      role,
    });
    return this.memberRepo.save(member);
  }

  /**
   * 멤버 탈퇴/제거
   * @domain study
   */
  async removeMember(studyId: string, userId: string): Promise<void> {
    const result = await this.memberRepo.delete({
      study_id: studyId,
      user_id: userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
    }
  }

  /**
   * 멤버 단건 조회
   * @domain study
   */
  async getMember(studyId: string, userId: string): Promise<StudyMember> {
    const member = await this.memberRepo.findOne({
      where: { study_id: studyId, user_id: userId },
    });
    if (!member) {
      throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
    }
    return member;
  }

  /**
   * 전체 멤버 목록
   * @domain study
   */
  async getMembers(studyId: string): Promise<StudyMember[]> {
    return this.memberRepo.find({ where: { study_id: studyId } });
  }

  /**
   * 멤버 역할 변경
   * @domain study
   */
  async changeRole(
    studyId: string,
    userId: string,
    role: StudyMemberRole,
  ): Promise<StudyMember> {
    const member = await this.getMember(studyId, userId);
    member.role = role;
    return this.memberRepo.save(member);
  }

  /**
   * 멤버 닉네임 수정
   * @domain study
   */
  async updateNickname(
    studyId: string,
    userId: string,
    nickname: string,
  ): Promise<StudyMember> {
    const member = await this.getMember(studyId, userId);
    member.nickname = nickname;
    return this.memberRepo.save(member);
  }

  // ─── StudyInvite 관리 ────────────────────────────

  /**
   * 초대 생성 (랜덤 8자리 영숫자 코드)
   * @domain study
   */
  async createInvite(data: {
    study_id: string;
    created_by: string;
    expires_at: Date;
    max_uses?: number;
  }): Promise<StudyInvite> {
    const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    const invite = this.inviteRepo.create({
      study_id: data.study_id,
      code,
      created_by: data.created_by,
      expires_at: data.expires_at,
      max_uses: data.max_uses ?? null,
    });
    return this.inviteRepo.save(invite);
  }

  /**
   * 코드로 초대 조회
   * @domain study
   */
  async findInviteByCode(code: string): Promise<StudyInvite> {
    const invite = await this.inviteRepo.findOne({
      where: { code },
      relations: ['study'],
    });
    if (!invite) {
      throw new NotFoundException('유효하지 않은 초대 코드입니다.');
    }
    return invite;
  }

  /**
   * 초대 사용 횟수 증가
   * @domain study
   */
  async consumeInvite(id: string): Promise<StudyInvite> {
    const invite = await this.inviteRepo.findOne({ where: { id } });
    if (!invite) {
      throw new NotFoundException('초대를 찾을 수 없습니다.');
    }
    invite.used_count += 1;
    return this.inviteRepo.save(invite);
  }
}
