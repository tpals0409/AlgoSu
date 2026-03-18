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
