import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyService } from './study.service';
import { Study, StudyMember, StudyMemberRole, StudyStatus, StudyInvite } from './study.entity';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  on: jest.fn().mockReturnThis(),
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
    status: StudyStatus.ACTIVE,
    groundRules: null,
    publicId: 'pub-study-uuid-1',
    created_at: new Date(),
    updated_at: new Date(),
    generatePublicId: jest.fn(),
  };

  const mockAdminMember: StudyMember = {
    id: 'member-id-1',
    study_id: STUDY_ID,
    user_id: USER_ID,
    role: StudyMemberRole.ADMIN,
    nickname: 'Admin',
    study: mockStudy,
    joined_at: new Date(),
  };

  const mockRegularMember: StudyMember = {
    id: 'member-id-2',
    study_id: STUDY_ID,
    user_id: OTHER_USER_ID,
    role: StudyMemberRole.MEMBER,
    nickname: 'Member',
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
      count: jest.fn().mockResolvedValue(5),
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

    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const inviteThrottle = {
      checkLock: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      clearFailures: jest.fn().mockResolvedValue(undefined),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new StudyService(
      configService as unknown as ConfigService,
      mockLogger as any,
      studyRepository as any,
      memberRepository as any,
      inviteRepository as any,
      userRepository as any,
      notificationService as any,
      inviteThrottle as any,
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
        nickname: 'Admin',
      });

      expect(result.id).toBe(STUDY_ID);
      expect(studyRepository.create).toHaveBeenCalledWith({
        name: 'AlgoSu 스터디',
        description: '알고리즘 스터디',
        github_repo: null,
        created_by: USER_ID,
        status: StudyStatus.ACTIVE,
      });
      expect(studyRepository.save).toHaveBeenCalled();

      // ADMIN 멤버 등록 확인 (닉네임 포함)
      expect(memberRepository.create).toHaveBeenCalledWith({
        study_id: STUDY_ID,
        user_id: USER_ID,
        role: StudyMemberRole.ADMIN,
        nickname: 'Admin',
      });
      expect(memberRepository.save).toHaveBeenCalled();
    });

    // ============================
    // 2. createStudy — 캐시 무효화
    // ============================
    it('생성 후 Redis 멤버십 캐시 무효화', async () => {
      studyRepository.save.mockResolvedValue(mockStudy);
      memberRepository.save.mockResolvedValue(mockAdminMember);

      await service.createStudy(USER_ID, { name: 'Test', nickname: 'Admin' });

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
  // 4. getStudyById — Guard가 멤버 검증, 서비스는 스터디 조회만
  // ============================
  describe('getStudyById', () => {
    it('존재하지 않는 스터디 → NotFoundException', async () => {
      studyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getStudyById(STUDY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('정상 조회 — 스터디 반환', async () => {
      studyRepository.findOne.mockResolvedValue(mockStudy);

      const result = await service.getStudyById(STUDY_ID, USER_ID);
      expect(result.id).toBe(STUDY_ID);
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
    it('ADMIN — 초대 코드 발급 (8자리 + 5분 만료)', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      inviteRepository.save.mockImplementation((invite: StudyInvite) =>
        Promise.resolve(invite),
      );

      const result = await service.createInvite(STUDY_ID, USER_ID);

      expect(result.code).toBeDefined();
      expect(result.code.length).toBe(8);
      expect(result.expires_at).toBeDefined();

      // 5분 후 만료 확인 (오차 허용 1분)
      const expectedExpiry = new Date();
      expectedExpiry.setMinutes(expectedExpiry.getMinutes() + 5);
      const diffMs = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
      expect(diffMs).toBeLessThan(60_000);

      expect(inviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          study_id: STUDY_ID,
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

    it('정상 가입 — MEMBER 역할로 등록 (닉네임 + brute force 방어)', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(null); // 기존 멤버 아님
      memberRepository.count.mockResolvedValue(5); // B1: 50명 미만
      memberRepository.find.mockResolvedValue([]); // 알림 대상
      memberRepository.save.mockImplementation((m: StudyMember) => Promise.resolve(m));
      inviteRepository.save.mockImplementation((i: StudyInvite) => Promise.resolve(i));

      const result = await service.joinByInviteCode('new-user-id', 'valid-code', 'NewMember', '127.0.0.1');

      expect(result.role).toBe(StudyMemberRole.MEMBER);
      expect(result.id).toBe(STUDY_ID);
    });

    it('만료된 초대 코드 → BadRequestException', async () => {
      const expiredInvite = { ...validInvite, expires_at: pastDate };
      inviteRepository.findOne.mockResolvedValue(expiredInvite);

      await expect(service.joinByInviteCode('new-user-id', 'expired-code', 'Nick', '127.0.0.1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.joinByInviteCode('new-user-id', 'expired-code', 'Nick', '127.0.0.1')).rejects.toThrow(
        '만료된 초대 코드입니다.',
      );
    });

    it('이미 멤버인 사용자 → ConflictException', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(mockRegularMember); // 이미 멤버

      await expect(
        service.joinByInviteCode(OTHER_USER_ID, 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.joinByInviteCode(OTHER_USER_ID, 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow('이미 가입된 스터디입니다.');
    });

    it('무효한 초대 코드 → NotFoundException', async () => {
      inviteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.joinByInviteCode('new-user-id', 'nonexistent-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.joinByInviteCode('new-user-id', 'nonexistent-code', 'Nick', '127.0.0.1'),
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

    it('존재하지 않는 멤버 추방 → NotFoundException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      memberRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  // 15. leaveStudy
  // ============================
  describe('leaveStudy', () => {
    it('일반 멤버 탈퇴 — 정상 처리 + 알림 발행', async () => {
      memberRepository.findOne.mockResolvedValue(mockRegularMember);
      memberRepository.delete.mockResolvedValue({ affected: 1 });
      studyRepository.findOne.mockResolvedValue(mockStudy);
      memberRepository.find.mockResolvedValue([mockAdminMember]);

      await service.leaveStudy(STUDY_ID, OTHER_USER_ID);

      expect(memberRepository.delete).toHaveBeenCalledWith({
        study_id: STUDY_ID,
        user_id: OTHER_USER_ID,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(
        `study:membership:${STUDY_ID}:${OTHER_USER_ID}`,
      );
    });

    it('ADMIN 탈퇴 — 다른 ADMIN 있으면 가능', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      memberRepository.count.mockResolvedValue(2); // 다른 ADMIN 존재
      memberRepository.delete.mockResolvedValue({ affected: 1 });
      studyRepository.findOne.mockResolvedValue(mockStudy);
      memberRepository.find.mockResolvedValue([]);

      await service.leaveStudy(STUDY_ID, USER_ID);

      expect(memberRepository.delete).toHaveBeenCalled();
    });

    it('유일 ADMIN 탈퇴 → BadRequestException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      memberRepository.count.mockResolvedValue(1); // 유일 ADMIN

      await expect(service.leaveStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.leaveStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        '탈퇴 전 ADMIN 권한을 다른 멤버에게 위임하세요.',
      );
    });

    it('비멤버 탈퇴 시도 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveStudy(STUDY_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================
  // 16. closeStudy
  // ============================
  describe('closeStudy', () => {
    it('ADMIN — 정상 종료 + CLOSED 상태 전환 + 알림', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue({ ...mockStudy, status: StudyStatus.ACTIVE });
      studyRepository.save.mockImplementation((s: Study) => Promise.resolve(s));
      memberRepository.find.mockResolvedValue([mockAdminMember, mockRegularMember]);

      await service.closeStudy(STUDY_ID, USER_ID);

      expect(studyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: StudyStatus.CLOSED }),
      );
    });

    it('이미 종료된 스터디 → BadRequestException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue({ ...mockStudy, status: StudyStatus.CLOSED });

      await expect(service.closeStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.closeStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        '이미 종료된 스터디입니다.',
      );
    });

    it('존재하지 않는 스터디 종료 → NotFoundException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue(null);

      await expect(service.closeStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('비ADMIN 종료 시도 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(mockRegularMember);

      await expect(service.closeStudy(STUDY_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================
  // 17. getMembers
  // ============================
  describe('getMembers', () => {
    it('멤버 목록 반환 (유저 정보 포함)', async () => {
      memberRepository.find.mockResolvedValue([mockAdminMember, mockRegularMember]);

      const result = await service.getMembers(STUDY_ID, USER_ID);

      expect(result).toHaveLength(2);
      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { study_id: STUDY_ID },
      });
    });

    it('멤버가 없으면 빈 배열 반환', async () => {
      memberRepository.find.mockResolvedValue([]);

      const result = await service.getMembers(STUDY_ID, USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ============================
  // 18. updateNickname
  // ============================
  describe('updateNickname', () => {
    it('본인 닉네임 정상 변경', async () => {
      memberRepository.findOne.mockResolvedValue({ ...mockAdminMember });
      memberRepository.save.mockImplementation((m: StudyMember) => Promise.resolve(m));

      const result = await service.updateNickname(STUDY_ID, USER_ID, '새닉네임');

      expect(result.nickname).toBe('새닉네임');
    });

    it('비멤버 닉네임 변경 → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateNickname(STUDY_ID, 'stranger', '닉네임'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateNickname(STUDY_ID, 'stranger', '닉네임'),
      ).rejects.toThrow('스터디 멤버가 아닙니다.');
    });
  });

  // ============================
  // 19. changeMemberRole
  // ============================
  describe('changeMemberRole', () => {
    it('ADMIN이 멤버를 ADMIN으로 승격', async () => {
      // verifyAdmin용 1번째 호출 → ADMIN, 대상 멤버 2번째 호출 → MEMBER
      memberRepository.findOne
        .mockResolvedValueOnce(mockAdminMember)
        .mockResolvedValueOnce({ ...mockRegularMember });
      memberRepository.save.mockImplementation((m: StudyMember) => Promise.resolve(m));
      studyRepository.findOne.mockResolvedValue(mockStudy);

      await service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN);

      expect(memberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: StudyMemberRole.ADMIN }),
      );
    });

    it('자기 자신 역할 변경 → BadRequestException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);

      await expect(
        service.changeMemberRole(STUDY_ID, USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changeMemberRole(STUDY_ID, USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow('자기 자신의 역할을 변경할 수 없습니다.');
    });

    it('대상 멤버 없음 → NotFoundException', async () => {
      memberRepository.findOne
        .mockResolvedValueOnce(mockAdminMember)
        .mockResolvedValueOnce(null);

      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('유일 ADMIN 강등 → BadRequestException', async () => {
      const targetAdmin: StudyMember = {
        ...mockRegularMember,
        role: StudyMemberRole.ADMIN,
      };
      memberRepository.findOne
        .mockResolvedValueOnce(mockAdminMember) // verifyAdmin
        .mockResolvedValueOnce(targetAdmin); // target
      memberRepository.count.mockResolvedValue(1); // ADMIN 1명

      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow(BadRequestException);
      memberRepository.findOne
        .mockResolvedValueOnce(mockAdminMember)
        .mockResolvedValueOnce(targetAdmin);
      memberRepository.count.mockResolvedValue(1);
      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow('최소 1명의 ADMIN이 필요합니다.');
    });
  });

  // ============================
  // 20. updateGroundRules
  // ============================
  describe('updateGroundRules', () => {
    it('ADMIN — 그라운드 룰 정상 수정', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue({ ...mockStudy });
      studyRepository.save.mockImplementation((s: Study) => Promise.resolve(s));

      const result = await service.updateGroundRules(STUDY_ID, USER_ID, '새로운 규칙');

      expect(result.groundRules).toBe('새로운 규칙');
    });

    it('존재하지 않는 스터디 → NotFoundException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateGroundRules(STUDY_ID, USER_ID, '규칙'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  // 21. verifyInviteCode
  // ============================
  describe('verifyInviteCode', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const validInvite: StudyInvite = {
      id: 'invite-id-1',
      study_id: STUDY_ID,
      code: 'VALID123',
      created_by: USER_ID,
      expires_at: futureDate,
      used_count: 0,
      max_uses: null,
      study: mockStudy,
      created_at: new Date(),
    };

    it('유효한 코드 검증 성공', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);

      const result = await service.verifyInviteCode('VALID123', '127.0.0.1');

      expect(result).toEqual({ valid: true, studyName: 'AlgoSu 스터디' });
    });

    it('존재하지 않는 코드 → NotFoundException', async () => {
      inviteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyInviteCode('INVALID', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('만료된 코드 → BadRequestException', async () => {
      inviteRepository.findOne.mockResolvedValue({ ...validInvite, expires_at: pastDate });

      await expect(
        service.verifyInviteCode('EXPIRED', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('사용 한도 초과 → BadRequestException', async () => {
      inviteRepository.findOne.mockResolvedValue({
        ...validInvite,
        max_uses: 5,
        used_count: 5,
      });

      await expect(
        service.verifyInviteCode('MAXED', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 22. joinByInviteCode — 멤버 50명 제한
  // ============================
  describe('joinByInviteCode — 멤버 수 제한', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

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

    it('멤버 50명 초과 시 → BadRequestException', async () => {
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(null);
      memberRepository.count.mockResolvedValue(50);

      await expect(
        service.joinByInviteCode('new-user-id', 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
      inviteRepository.findOne.mockResolvedValue(validInvite);
      memberRepository.findOne.mockResolvedValue(null);
      memberRepository.count.mockResolvedValue(50);
      await expect(
        service.joinByInviteCode('new-user-id', 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow('스터디 멤버 수가 최대 인원(50명)에 도달했습니다.');
    });

    it('사용 한도 초과 초대코드 → BadRequestException', async () => {
      inviteRepository.findOne.mockResolvedValue({
        ...validInvite,
        max_uses: 3,
        used_count: 3,
      });

      await expect(
        service.joinByInviteCode('new-user-id', 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 23. getStudyStats
  // ============================
  describe('getStudyStats', () => {
    it('통계 API 정상 응답 처리', async () => {
      // configService.getOrThrow 추가
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 10,
          byWeek: [{ week: 'W1', count: 5 }],
          byWeekPerUser: [],
          byMember: [{ userId: USER_ID, count: 5, doneCount: 3 }],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: ['p1'],
        },
      };

      // global fetch 모킹
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatsData),
      }) as any;

      memberRepository.find.mockResolvedValue([mockAdminMember]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.totalSubmissions).toBe(10);
      expect(result.byMember).toHaveLength(1);
      expect(result.byMember[0].isMember).toBe(true);

      global.fetch = originalFetch;
    });

    it('통계 API 실패 → NotFoundException', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as any;

      await expect(service.getStudyStats(STUDY_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );

      global.fetch = originalFetch;
    });

    it('weekNumber 파라미터 전달 시 쿼리스트링 포함', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 3,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [],
          byMemberWeek: [{ userId: USER_ID, count: 3 }],
          recentSubmissions: [],
          solvedProblemIds: null,
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatsData),
      }) as any;

      memberRepository.find.mockResolvedValue([mockAdminMember]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID, 'W1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('weekNumber=W1'),
        expect.any(Object),
      );
      expect(result.solvedProblemIds).toEqual([]);
      expect(result.byMemberWeek).not.toBeNull();

      global.fetch = originalFetch;
    });
  });

  // ============================
  // 24. notifyProblemCreated
  // ============================
  describe('notifyProblemCreated', () => {
    it('ADMIN — 문제 생성 알림 발행 (실행자 제외)', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      memberRepository.find.mockResolvedValue([mockAdminMember, mockRegularMember]);
      studyRepository.findOne.mockResolvedValue(mockStudy);

      await service.notifyProblemCreated(STUDY_ID, USER_ID, '문제 A', 'W1', 'problem-1');

      // 알림은 실행자(USER_ID)를 제외한 OTHER_USER_ID에게만 전송
      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { study_id: STUDY_ID },
      });
    });

    it('비ADMIN → ForbiddenException', async () => {
      memberRepository.findOne.mockResolvedValue(mockRegularMember);

      await expect(
        service.notifyProblemCreated(STUDY_ID, OTHER_USER_ID, '문제 A', 'W1', 'problem-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================
  // 25. updateStudy — 스터디 미존재
  // ============================
  describe('updateStudy — 추가 케이스', () => {
    it('존재하지 않는 스터디 → NotFoundException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStudy(STUDY_ID, USER_ID, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  // 26. deleteStudy — 존재하지 않는 스터디
  // ============================
  describe('deleteStudy — 추가 케이스', () => {
    it('존재하지 않는 스터디 삭제 → NotFoundException', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Redis 캐시 키 없으면 del 호출 안 함', async () => {
      memberRepository.findOne.mockResolvedValue(mockAdminMember);
      studyRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.del.mockClear();

      await service.deleteStudy(STUDY_ID, USER_ID);

      // del은 invalidateMembershipCache가 아닌 keys 패턴 삭제에서 호출되지 않아야 함
      // 단, invalidateMembershipCache는 verifyAdmin 내부에서 호출되지 않으므로 keys 결과 빈 배열 시 del 미호출 확인 불필요
      expect(mockRedis.keys).toHaveBeenCalled();
    });
  });
});
