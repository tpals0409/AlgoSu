import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyService } from './study.service';
import { Study, StudyMember, StudyMemberRole, StudyInvite } from './study.entity';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// --- uuid 모킹 ---
jest.mock('uuid', () => ({
  v4: () => 'mock-invite-code-uuid',
}));

describe('StudyService', () => {
  let service: StudyService;
  let configService: Record<string, jest.Mock>;
  let studyRepository: Record<string, jest.Mock>;
  let memberRepository: Record<string, jest.Mock>;
  let inviteRepository: Record<string, jest.Mock>;

  const USER_ID = 'user-id-admin';
  const OTHER_USER_ID = 'user-id-member';
  const STUDY_ID = 'study-id-1';

  const mockStudy: Study = {
    id: STUDY_ID,
    name: 'AlgoSu 스터디',
    description: '알고리즘 스터디',
    created_by: USER_ID,
    github_repo: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAdminMember: StudyMember = {
    id: 'member-id-1',
    study_id: STUDY_ID,
    user_id: USER_ID,
    role: StudyMemberRole.ADMIN,
    study: mockStudy,
    joined_at: new Date(),
  };

  const mockRegularMember: StudyMember = {
    id: 'member-id-2',
    study_id: STUDY_ID,
    user_id: OTHER_USER_ID,
    role: StudyMemberRole.MEMBER,
    study: mockStudy,
    joined_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    studyRepository = {
      create: jest.fn((data: Partial<Study>) => ({ id: STUDY_ID, ...data }) as Study),
      save: jest.fn((study: Study) => Promise.resolve(study)),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    memberRepository = {
      create: jest.fn(
        (data: Partial<StudyMember>) => ({ id: 'new-member-id', ...data }) as StudyMember,
      ),
      save: jest.fn((member: StudyMember) => Promise.resolve(member)),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    inviteRepository = {
      create: jest.fn(
        (data: Partial<StudyInvite>) => ({ id: 'invite-id-1', ...data }) as StudyInvite,
      ),
      save: jest.fn((invite: StudyInvite) => Promise.resolve(invite)),
      findOne: jest.fn(),
    };

    const notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new StudyService(
      configService as unknown as ConfigService,
      studyRepository as any,
      memberRepository as any,
      inviteRepository as any,
      notificationService as any,
    );
  });

  // ============================
  // 1. createStudy — 정상 생성 + ADMIN 등록
  // ============================
  describe('createStudy', () => {
    it('정상 생성 — Study 저장 + 생성자 ADMIN 자동 등록', async () => {
      studyRepository.save.mockResolvedValue(mockStudy);
      memberRepository.save.mockResolvedValue(mockAdminMember);

      const result = await service.createStudy(USER_ID, {
        name: 'AlgoSu 스터디',
        description: '알고리즘 스터디',
      });

      expect(result.id).toBe(STUDY_ID);
      expect(studyRepository.create).toHaveBeenCalledWith({
        name: 'AlgoSu 스터디',
        description: '알고리즘 스터디',
        created_by: USER_ID,
      });
      expect(studyRepository.save).toHaveBeenCalled();

      // ADMIN 멤버 등록 확인
      expect(memberRepository.create).toHaveBeenCalledWith({
        study_id: STUDY_ID,
        user_id: USER_ID,
        role: StudyMemberRole.ADMIN,
      });
      expect(memberRepository.save).toHaveBeenCalled();
    });

    // ============================
    // 2. createStudy — 캐시 무효화
    // ============================
    it('생성 후 Redis 멤버십 캐시 무효화', async () => {
      studyRepository.save.mockResolvedValue(mockStudy);
      memberRepository.save.mockResolvedValue(mockAdminMember);

      await service.createStudy(USER_ID, { name: 'Test' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:${USER_ID}`,
      );
    });
  });

  // ============================
  // 3. getMyStudies
  // ============================
  describe('getMyStudies', () => {
    it('사용자의 스터디 목록 반환', async () => {
      memberRepository.find.mockResolvedValue([mockAdminMember]);

      const result = await service.getMyStudies(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(STUDY_ID);
      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        relations: ['study'],
      });
    });
  });

  // ============================
  // 4. getStudyById — 비멤버 접근 → ForbiddenException
  // ============================
  describe('getStudyById', () => {
    it('비멤버 접근 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getStudyById(STUDY_ID, 'non-member-user'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getStudyById(STUDY_ID, 'non-member-user'),
      ).rejects.toThrow('해당 스터디의 멤버가 아닙니다.');
    });
  });

  // ============================
  // 5. updateStudy — ADMIN 권한 확인
  // ============================
  describe('updateStudy', () => {
    it('ADMIN 사용자 — 정상 업데이트', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue({ ...mockStudy });
      studyRepository.save.mockImplementation((study: Study) => Promise.resolve(study));

      const result = await service.updateStudy(STUDY_ID, USER_ID, {
        name: '변경된 이름',
      });

      expect(result.name).toBe('변경된 이름');
    });

    it('비ADMIN 사용자 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(mockRegularMember);

      await expect(
        service.updateStudy(STUDY_ID, OTHER_USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateStudy(STUDY_ID, OTHER_USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow('ADMIN 권한이 필요합니다.');
    });
  });

  // ============================
  // 6-7. deleteStudy
  // ============================
  describe('deleteStudy', () => {
    it('정상 삭제 — DB 삭제 + Redis 패턴 캐시 삭제', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedis.keys.mockResolvedValue([
        `study:membership:${STUDY_ID}:user1`,
        `study:membership:${STUDY_ID}:user2`,
      ]);

      await service.deleteStudy(STUDY_ID, USER_ID);

      expect(studyRepository.delete).toHaveBeenCalledWith(STUDY_ID);
      expect(mockRedis.keys).toHaveBeenCalledWith(`study:membership:${STUDY_ID}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:user1`,
        `study:membership:${STUDY_ID}:user2`,
      );
    });

    it('비ADMIN 사용자 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(mockRegularMember);

      await expect(service.deleteStudy(STUDY_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================
  // 8. createInvite
  // ============================
  describe('createInvite', () => {
    it('ADMIN — 초대 코드 발급 (UUID + 7일 만료)', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      inviteRepository.save.mockImplementation((invite: StudyInvite) =>
        Promise.resolve(invite),
      );

      const result = await service.createInvite(STUDY_ID, USER_ID);

      expect(result.code).toBe('mock-invite-code-uuid');
      expect(result.expires_at).toBeDefined();

      // 7일 후 만료 확인 (오차 허용 1분)
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);
      const diffMs = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
      expect(diffMs).toBeLessThan(60_000);

      expect(inviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          study_id: STUDY_ID,
          code: 'mock-invite-code-uuid',
          created_by: USER_ID,
        }),
      );
    });
  });

  // ============================
  // 9-12. joinByInviteCode
  // ============================
  describe('joinByInviteCode', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const validInvite: StudyInvite = {
      id: 'invite-id-1',
      study_id: STUDY_ID,
      code: 'valid-code',
      created_by: USER_ID,
      expires_at: futureDate,
      used_count: 0,
      max_uses: null,
      study: mockStudy,
      created_at: new Date(),
    };

    it('정상 가입 — MEMBER 역할로 등록', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(null); // 기존 멤버 아님
      memberRepository.save.mockImplementation((m: StudyMember) => Promise.resolve(m));

      const result = await service.joinByInviteCode('new-user-id', 'valid-code');

      expect(result.role).toBe(StudyMemberRole.MEMBER);
      expect(result.id).toBe(STUDY_ID);
    });

    it('만료된 초대 코드 → BadRequestException', async () => {
      const expiredInvite = { ...validInvite, expires_at: pastDate };
      inviteRepository.findOne.mockResolvedValue(expiredInvite);

      await expect(service.joinByInviteCode('new-user-id', 'expired-code')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.joinByInviteCode('new-user-id', 'expired-code')).rejects.toThrow(
        '만료된 초대 코드입니다.',
      );
    });

    it('이미 멤버인 사용자 → ConflictException', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(mockRegularMember); // 이미 멤버

      await expect(
        service.joinByInviteCode(OTHER_USER_ID, 'valid-code'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.joinByInviteCode(OTHER_USER_ID, 'valid-code'),
      ).rejects.toThrow('이미 해당 스터디의 멤버입니다.');
    });

    it('무효한 초대 코드 → NotFoundException', async () => {
      inviteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.joinByInviteCode('new-user-id', 'nonexistent-code'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.joinByInviteCode('new-user-id', 'nonexistent-code'),
      ).rejects.toThrow('유효하지 않은 초대 코드입니다.');
    });
  });

  // ============================
  // 13. removeMember — 정상 추방 + 캐시 무효화
  // ============================
  describe('removeMember', () => {
    it('ADMIN이 멤버 추방 — DB 삭제 + 캐시 무효화', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      memberRepository.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID);

      expect(memberRepository.delete).toHaveBeenCalledWith({
        study_id: STUDY_ID,
        user_id: OTHER_USER_ID,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:${OTHER_USER_ID}`,
      );
    });

    // ============================
    // 14. removeMember — 자기 자신 추방 → BadRequestException
    // ============================
    it('자기 자신 추방 시도 → BadRequestException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);

      await expect(
        service.removeMember(STUDY_ID, USER_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeMember(STUDY_ID, USER_ID, USER_ID),
      ).rejects.toThrow('자기 자신을 추방할 수 없습니다.');
    });
  });
});
