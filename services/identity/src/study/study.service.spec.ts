import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { StudyService } from './study.service';
import {
  Study,
  StudyMember,
  StudyMemberRole,
  StudyInvite,
  StudyStatus,
} from './study.entity';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockStudy = (overrides: Partial<Study> = {}): Study =>
  ({
    id: 'study-1',
    name: '알고리즘 스터디',
    description: null,
    created_by: 'user-1',
    github_repo: null,
    status: StudyStatus.ACTIVE,
    groundRules: null,
    publicId: 'pub-1',
    created_at: new Date(),
    updated_at: new Date(),
    generatePublicId: jest.fn(),
    ...overrides,
  }) as Study;

const mockMember = (overrides: Partial<StudyMember> = {}): StudyMember =>
  ({
    id: 'member-1',
    study_id: 'study-1',
    user_id: 'user-1',
    role: StudyMemberRole.ADMIN,
    nickname: '닉네임',
    joined_at: new Date(),
    ...overrides,
  }) as StudyMember;

const mockInvite = (overrides: Partial<StudyInvite> = {}): StudyInvite =>
  ({
    id: 'invite-1',
    study_id: 'study-1',
    code: 'ABCD1234',
    created_by: 'user-1',
    expires_at: new Date(Date.now() + 86400_000),
    used_count: 0,
    max_uses: null,
    created_at: new Date(),
    ...overrides,
  }) as StudyInvite;

// ─── QueryRunner Mock ────────────────────────────────
const mockManager = {
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  isTransactionActive: false,
  manager: mockManager,
};

describe('StudyService', () => {
  let service: StudyService;
  let studyRepo: jest.Mocked<Repository<Study>>;
  let memberRepo: jest.Mocked<Repository<StudyMember>>;
  let inviteRepo: jest.Mocked<Repository<StudyInvite>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyService,
        {
          provide: getRepositoryToken(Study),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(StudyMember),
          useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn() },
        },
        {
          provide: getRepositoryToken(StudyInvite),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) },
        },
      ],
    }).compile();

    service = module.get(StudyService);
    studyRepo = module.get(getRepositoryToken(Study));
    memberRepo = module.get(getRepositoryToken(StudyMember));
    inviteRepo = module.get(getRepositoryToken(StudyInvite));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createStudy ───────────────────────────────────
  describe('createStudy', () => {
    it('트랜잭션으로 Study + ADMIN 멤버를 생성한다', async () => {
      const study = mockStudy();
      const member = mockMember();
      mockManager.create.mockReturnValueOnce(study).mockReturnValueOnce(member);
      mockManager.save.mockResolvedValueOnce(study).mockResolvedValueOnce(member);

      const result = await service.createStudy({
        name: '알고리즘 스터디',
        created_by: 'user-1',
        nickname: '닉네임',
      });

      expect(result).toBe(study);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      // Study 생성
      expect(mockManager.create).toHaveBeenCalledWith(
        Study,
        expect.objectContaining({ name: '알고리즘 스터디', created_by: 'user-1' }),
      );
      // ADMIN 멤버 생성
      expect(mockManager.create).toHaveBeenCalledWith(
        StudyMember,
        expect.objectContaining({
          study_id: study.id,
          user_id: 'user-1',
          role: StudyMemberRole.ADMIN,
        }),
      );
    });

    it('실패 시 롤백한다', async () => {
      mockManager.create.mockReturnValue(mockStudy());
      mockManager.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.createStudy({ name: 'fail', created_by: 'u', nickname: 'n' }),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── findById ──────────────────────────────────────
  describe('findById', () => {
    it('존재하는 스터디를 반환한다', async () => {
      const study = mockStudy();
      studyRepo.findOne.mockResolvedValue(study);

      const result = await service.findById('study-1');

      expect(result).toBe(study);
    });

    it('없으면 NotFoundException', async () => {
      studyRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteStudy ───────────────────────────────────
  describe('deleteStudy', () => {
    it('FK 순서대로 삭제한다 (invite → member → study)', async () => {
      mockManager.delete
        .mockResolvedValueOnce({ affected: 2 })   // invites
        .mockResolvedValueOnce({ affected: 3 })   // members
        .mockResolvedValueOnce({ affected: 1 });   // study

      await service.deleteStudy('study-1');

      const deleteCalls = mockManager.delete.mock.calls;
      expect(deleteCalls[0][0]).toBe(StudyInvite);
      expect(deleteCalls[1][0]).toBe(StudyMember);
      expect(deleteCalls[2][0]).toBe(Study);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('study 미존재 시 NotFoundException + 롤백', async () => {
      mockManager.delete
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 0 });

      await expect(service.deleteStudy('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByUserId ────────────────────────────────────
  describe('findByUserId', () => {
    it('사용자 참여 스터디 목록을 반환한다', async () => {
      const study = mockStudy();
      const membership = mockMember({ study: study } as any);
      memberRepo.find.mockResolvedValue([membership]);

      const result = await service.findByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe(StudyMemberRole.ADMIN);
      expect(memberRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        relations: ['study'],
      });
    });

    it('참여 스터디가 없으면 빈 배열을 반환한다', async () => {
      memberRepo.find.mockResolvedValue([]);

      const result = await service.findByUserId('user-2');

      expect(result).toEqual([]);
    });
  });

  // ─── updateStudy ────────────────────────────────────
  describe('updateStudy', () => {
    it('스터디를 수정하고 결과를 반환한다', async () => {
      const study = mockStudy();
      const updated = mockStudy({ name: '변경됨', description: '설명', github_repo: 'repo', groundRules: '규칙' });
      studyRepo.findOne.mockResolvedValue(study);
      studyRepo.save.mockResolvedValue(updated);

      const result = await service.updateStudy('study-1', {
        name: '변경됨',
        description: '설명',
        github_repo: 'repo',
        groundRules: '규칙',
        status: StudyStatus.ACTIVE,
      });

      expect(result).toBe(updated);
    });

    it('없는 스터디면 NotFoundException', async () => {
      studyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStudy('x', { name: '변경' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteStudy 트랜잭션 에러 ─────────────────────
  describe('deleteStudy — 트랜잭션 에러', () => {
    it('트랜잭션 활성 상태에서 에러 시 롤백한다', async () => {
      mockQueryRunner.isTransactionActive = true;
      mockManager.delete
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 0 })
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(service.deleteStudy('x')).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      mockQueryRunner.isTransactionActive = false;
    });
  });

  // ─── addMember ─────────────────────────────────────
  describe('addMember', () => {
    it('멤버를 정상 추가한다', async () => {
      const member = mockMember({ role: StudyMemberRole.MEMBER });
      memberRepo.create.mockReturnValue(member);
      memberRepo.save.mockResolvedValue(member);

      const result = await service.addMember('study-1', 'user-2', '새멤버');

      expect(result.role).toBe(StudyMemberRole.MEMBER);
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ study_id: 'study-1', user_id: 'user-2' }),
      );
    });

    it('중복 멤버 추가 시 DB 에러 발생', async () => {
      memberRepo.create.mockReturnValue(mockMember());
      const dbError = new Error('duplicate key');
      (dbError as unknown as Record<string, unknown>)['code'] = '23505';
      memberRepo.save.mockRejectedValue(dbError);

      await expect(
        service.addMember('study-1', 'user-1', '중복'),
      ).rejects.toThrow('duplicate key');
    });
  });

  // ─── removeMember ────────────────────────────────────
  describe('removeMember', () => {
    it('멤버를 정상 제거한다', async () => {
      memberRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeMember('study-1', 'user-1');

      expect(memberRepo.delete).toHaveBeenCalledWith({
        study_id: 'study-1',
        user_id: 'user-1',
      });
    });

    it('멤버 미존재 시 NotFoundException', async () => {
      memberRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(
        service.removeMember('study-1', 'non'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getMember ──────────────────────────────────────
  describe('getMember', () => {
    it('멤버를 반환한다', async () => {
      const member = mockMember();
      memberRepo.findOne.mockResolvedValue(member);

      const result = await service.getMember('study-1', 'user-1');

      expect(result).toBe(member);
      expect(memberRepo.findOne).toHaveBeenCalledWith({
        where: { study_id: 'study-1', user_id: 'user-1' },
      });
    });

    it('멤버 미존재 시 NotFoundException', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getMember('study-1', 'non'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getMembers ─────────────────────────────────────
  describe('getMembers', () => {
    it('전체 멤버 목록을 반환한다', async () => {
      const members = [mockMember(), mockMember({ id: 'member-2', user_id: 'user-2' })];
      memberRepo.find.mockResolvedValue(members);

      const result = await service.getMembers('study-1');

      expect(result).toEqual(members);
      expect(memberRepo.find).toHaveBeenCalledWith({ where: { study_id: 'study-1' } });
    });
  });

  // ─── changeRole ─────────────────────────────────────
  describe('changeRole', () => {
    it('멤버 역할을 변경한다', async () => {
      const member = mockMember();
      const updated = mockMember({ role: StudyMemberRole.MEMBER });
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.save.mockResolvedValue(updated);

      const result = await service.changeRole('study-1', 'user-1', StudyMemberRole.MEMBER);

      expect(result.role).toBe(StudyMemberRole.MEMBER);
    });

    it('멤버 미존재 시 NotFoundException', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changeRole('study-1', 'non', StudyMemberRole.MEMBER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateNickname ─────────────────────────────────
  describe('updateNickname', () => {
    it('멤버 닉네임을 변경한다', async () => {
      const member = mockMember();
      const updated = mockMember({ nickname: '새닉네임' });
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.save.mockResolvedValue(updated);

      const result = await service.updateNickname('study-1', 'user-1', '새닉네임');

      expect(result.nickname).toBe('새닉네임');
    });

    it('멤버 미존재 시 NotFoundException', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateNickname('study-1', 'non', '닉'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findInviteByCode ───────────────────────────────
  describe('findInviteByCode', () => {
    it('코드로 초대를 조회한다', async () => {
      const invite = mockInvite();
      inviteRepo.findOne.mockResolvedValue(invite);

      const result = await service.findInviteByCode('ABCD1234');

      expect(result).toBe(invite);
      expect(inviteRepo.findOne).toHaveBeenCalledWith({
        where: { code: 'ABCD1234' },
        relations: ['study'],
      });
    });

    it('초대 미존재 시 NotFoundException', async () => {
      inviteRepo.findOne.mockResolvedValue(null);

      await expect(service.findInviteByCode('XXXX')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createInvite ──────────────────────────────────
  describe('createInvite', () => {
    it('랜덤 8자리 대문자 코드를 생성한다', async () => {
      const invite = mockInvite();
      inviteRepo.create.mockReturnValue(invite);
      inviteRepo.save.mockResolvedValue(invite);

      const result = await service.createInvite({
        study_id: 'study-1',
        created_by: 'user-1',
        expires_at: new Date(Date.now() + 86400_000),
      });

      expect(result).toBe(invite);
      expect(inviteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          study_id: 'study-1',
          code: expect.stringMatching(/^[A-Z0-9]{8}$/),
        }),
      );
    });
  });

  // ─── consumeInvite ─────────────────────────────────
  describe('consumeInvite', () => {
    it('used_count를 1 증가시킨다', async () => {
      const invite = mockInvite({ used_count: 2 });
      inviteRepo.findOne.mockResolvedValue(invite);
      inviteRepo.save.mockResolvedValue({ ...invite, used_count: 3 } as StudyInvite);

      const result = await service.consumeInvite('invite-1');

      expect(result.used_count).toBe(3);
    });

    it('초대 미존재 시 NotFoundException', async () => {
      inviteRepo.findOne.mockResolvedValue(null);

      await expect(service.consumeInvite('x')).rejects.toThrow(NotFoundException);
    });
  });
});
