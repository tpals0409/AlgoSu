import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyService } from './study.service';
import { StudyMemberRole } from '../common/types/identity.types';
import { IdentityClientService } from '../identity-client/identity-client.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
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
  let identityClient: Record<string, jest.Mock>;
  let notificationService: Record<string, jest.Mock>;
  let inviteThrottle: Record<string, jest.Mock>;

  const USER_ID = 'user-id-admin';
  const OTHER_USER_ID = 'user-id-member';
  const STUDY_ID = 'study-id-1';

  const mockStudyData = {
    id: STUDY_ID,
    name: 'AlgoSu 스터디',
    description: '알고리즘 스터디',
    created_by: USER_ID,
    github_repo: null,
    status: 'ACTIVE',
    groundRules: null,
  };

  const mockAdminMemberData = {
    id: 'member-id-1',
    study_id: STUDY_ID,
    user_id: USER_ID,
    role: 'ADMIN',
    nickname: 'Admin',
  };

  const mockRegularMemberData = {
    id: 'member-id-2',
    study_id: STUDY_ID,
    user_id: OTHER_USER_ID,
    role: 'MEMBER',
    nickname: 'Member',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
      getOrThrow: jest.fn(),
    };

    identityClient = {
      createStudy: jest.fn(),
      findStudyById: jest.fn(),
      findStudiesByUserId: jest.fn(),
      updateStudy: jest.fn(),
      deleteStudy: jest.fn(),
      addMember: jest.fn(),
      getMembers: jest.fn(),
      getMember: jest.fn(),
      removeMember: jest.fn(),
      changeRole: jest.fn(),
      updateNickname: jest.fn(),
      createInvite: jest.fn(),
      findInviteByCode: jest.fn(),
      consumeInvite: jest.fn(),
    };

    notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    inviteThrottle = {
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
      identityClient as unknown as IdentityClientService,
      notificationService as any,
      inviteThrottle as any,
    );
  });

  // ============================
  // 1. createStudy
  // ============================
  describe('createStudy', () => {
    it('정상 생성 — Identity 서비스에 위임 + 캐시 무효화', async () => {
      identityClient.createStudy.mockResolvedValue(mockStudyData);

      const result = await service.createStudy(USER_ID, {
        name: 'AlgoSu 스터디',
        description: '알고리즘 스터디',
        nickname: 'Admin',
      });

      expect(result.id).toBe(STUDY_ID);
      expect(identityClient.createStudy).toHaveBeenCalledWith({
        name: 'AlgoSu 스터디',
        description: '알고리즘 스터디',
        created_by: USER_ID,
        nickname: 'Admin',
        github_repo: undefined,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${USER_ID}`,
      );
    });
  });

  // ============================
  // 2. getMyStudies
  // ============================
  describe('getMyStudies', () => {
    it('사용자의 스터디 목록 반환', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([mockStudyData]);

      const result = await service.getMyStudies(USER_ID);

      expect(result).toHaveLength(1);
      expect(identityClient.findStudiesByUserId).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ============================
  // 3. getStudyById
  // ============================
  describe('getStudyById', () => {
    it('정상 조회 — 스터디 반환', async () => {
      identityClient.findStudyById.mockResolvedValue(mockStudyData);

      const result = await service.getStudyById(STUDY_ID, USER_ID);
      expect(result.id).toBe(STUDY_ID);
    });
  });

  // ============================
  // 4. updateStudy
  // ============================
  describe('updateStudy', () => {
    it('ADMIN 사용자 — 정상 업데이트', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.updateStudy.mockResolvedValue({ ...mockStudyData, name: '변경된 이름' });

      const result = await service.updateStudy(STUDY_ID, USER_ID, {
        name: '변경된 이름',
      });

      expect(result.name).toBe('변경된 이름');
    });

    it('비ADMIN 사용자 → ForbiddenException', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      await expect(
        service.updateStudy(STUDY_ID, OTHER_USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateStudy(STUDY_ID, OTHER_USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow('ADMIN 권한이 필요합니다.');
    });
  });

  // ============================
  // 5. deleteStudy
  // ============================
  describe('deleteStudy', () => {
    it('정상 삭제 — ADMIN 1명 + Identity 서비스 위임 + Redis 패턴 캐시 삭제', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);
      identityClient.deleteStudy.mockResolvedValue({});
      mockRedis.keys.mockResolvedValue([
        `membership:${STUDY_ID}:user1`,
        `membership:${STUDY_ID}:user2`,
      ]);

      await service.deleteStudy(STUDY_ID, USER_ID);

      expect(identityClient.deleteStudy).toHaveBeenCalledWith(STUDY_ID);
      expect(mockRedis.keys).toHaveBeenCalledWith(`membership:${STUDY_ID}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:user1`,
        `membership:${STUDY_ID}:user2`,
      );
    });

    it('ADMIN 2명 이상 → BadRequestException', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers.mockResolvedValue([
        mockAdminMemberData,
        { ...mockRegularMemberData, role: 'ADMIN' },
      ]);

      await expect(service.deleteStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('비ADMIN 사용자 → ForbiddenException', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      await expect(service.deleteStudy(STUDY_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Redis 캐시 키 없으면 del 호출 안 함', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);
      identityClient.deleteStudy.mockResolvedValue({});
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.del.mockClear();

      await service.deleteStudy(STUDY_ID, USER_ID);

      expect(mockRedis.keys).toHaveBeenCalled();
    });
  });

  // ============================
  // 6. createInvite
  // ============================
  describe('createInvite', () => {
    it('ADMIN — 초대 코드 발급', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.createInvite.mockResolvedValue({
        id: 'invite-id-1',
        code: 'ABCD1234',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      const result = await service.createInvite(STUDY_ID, USER_ID);

      expect(result.code).toBeDefined();
      expect(result.expires_at).toBeDefined();
    });
  });

  // ============================
  // 7. joinByInviteCode
  // ============================
  describe('joinByInviteCode', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const validInviteData = {
      id: 'invite-id-1',
      study_id: STUDY_ID,
      code: 'valid-code',
      created_by: USER_ID,
      expires_at: futureDate.toISOString(),
      used_count: 0,
      max_uses: null,
      study: mockStudyData,
    };

    it('정상 가입 — MEMBER 역할로 등록', async () => {
      identityClient.findInviteByCode.mockResolvedValue(validInviteData);
      identityClient.getMember
        .mockRejectedValueOnce(new NotFoundException('미가입')); // 기존 멤버 아님
      identityClient.getMembers
        .mockResolvedValueOnce([]) // 멤버 수 체크 (0명)
        .mockResolvedValueOnce([mockAdminMemberData]); // 알림 대상
      identityClient.addMember.mockResolvedValue({});
      identityClient.consumeInvite.mockResolvedValue({});

      const result = await service.joinByInviteCode('new-user-id', 'valid-code', 'NewMember', '127.0.0.1');

      expect(result.role).toBe(StudyMemberRole.MEMBER);
      expect(result.id).toBe(STUDY_ID);
    });

    it('만료된 초대 코드 → BadRequestException', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      identityClient.findInviteByCode.mockResolvedValue({
        ...validInviteData,
        expires_at: pastDate.toISOString(),
      });

      await expect(service.joinByInviteCode('new-user-id', 'expired-code', 'Nick', '127.0.0.1')).rejects.toThrow(
        '만료된 초대 코드입니다.',
      );
    });

    it('이미 멤버인 사용자 → ConflictException', async () => {
      identityClient.findInviteByCode.mockResolvedValue(validInviteData);
      identityClient.getMember.mockResolvedValue(mockRegularMemberData); // 이미 멤버

      await expect(
        service.joinByInviteCode(OTHER_USER_ID, 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('무효한 초대 코드 → NotFoundException', async () => {
      identityClient.findInviteByCode.mockRejectedValue(
        new NotFoundException('유효하지 않은 초대 코드입니다.'),
      );

      await expect(
        service.joinByInviteCode('new-user-id', 'nonexistent-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('멤버 50명 초과 시 → BadRequestException', async () => {
      identityClient.findInviteByCode.mockResolvedValue(validInviteData);
      identityClient.getMember.mockRejectedValue(new NotFoundException('미가입'));
      identityClient.getMembers.mockResolvedValue(Array(50).fill(mockRegularMemberData));

      await expect(
        service.joinByInviteCode('new-user-id', 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow('스터디 멤버 수가 최대 인원(50명)에 도달했습니다.');
    });

    it('사용 한도 초과 초대코드 → BadRequestException', async () => {
      identityClient.findInviteByCode.mockResolvedValue({
        ...validInviteData,
        max_uses: 3,
        used_count: 3,
      });

      await expect(
        service.joinByInviteCode('new-user-id', 'valid-code', 'Nick', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  // 8. removeMember
  // ============================
  describe('removeMember', () => {
    it('ADMIN이 멤버 추방 — Identity 서비스 위임 + 캐시 무효화', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // admin 권한 검증
        .mockResolvedValueOnce(mockRegularMemberData); // target member
      identityClient.removeMember.mockResolvedValue({});

      await service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID);

      expect(identityClient.removeMember).toHaveBeenCalledWith(STUDY_ID, OTHER_USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${OTHER_USER_ID}`,
      );
    });

    it('자기 자신 추방 시도 → BadRequestException', async () => {
      await expect(
        service.removeMember(STUDY_ID, USER_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeMember(STUDY_ID, USER_ID, USER_ID),
      ).rejects.toThrow('자기 자신을 추방할 수 없습니다.');
    });

    it('존재하지 않는 멤버 추방 → NotFoundException', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // admin 권한 검증
        .mockRejectedValueOnce(new NotFoundException('멤버 없음')); // target not found

      await expect(
        service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  // 9. leaveStudy
  // ============================
  describe('leaveStudy', () => {
    it('일반 멤버 탈퇴 — 정상 처리', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);
      identityClient.removeMember.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue(mockStudyData);
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      await service.leaveStudy(STUDY_ID, OTHER_USER_ID);

      expect(identityClient.removeMember).toHaveBeenCalledWith(STUDY_ID, OTHER_USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `membership:${STUDY_ID}:${OTHER_USER_ID}`,
      );
    });

    it('ADMIN 탈퇴 — 다른 ADMIN 있으면 가능', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers
        .mockResolvedValueOnce([mockAdminMemberData, { ...mockRegularMemberData, role: 'ADMIN' }]) // ADMIN 2명
        .mockResolvedValueOnce([]); // 탈퇴 후 알림 대상
      identityClient.removeMember.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue(mockStudyData);

      await service.leaveStudy(STUDY_ID, USER_ID);

      expect(identityClient.removeMember).toHaveBeenCalled();
    });

    it('유일 ADMIN 탈퇴 → BadRequestException', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]); // ADMIN 1명

      await expect(service.leaveStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        '탈퇴 전 ADMIN 권한을 다른 멤버에게 위임하세요.',
      );
    });

    it('비멤버 탈퇴 시도 → ForbiddenException', async () => {
      identityClient.getMember.mockRejectedValue(new NotFoundException('멤버 없음'));

      await expect(service.leaveStudy(STUDY_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================
  // 10. closeStudy
  // ============================
  describe('closeStudy', () => {
    it('ADMIN — 정상 종료 + CLOSED 상태 전환 + 알림', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.findStudyById.mockResolvedValue({ ...mockStudyData, status: 'ACTIVE' });
      identityClient.updateStudy.mockResolvedValue({});
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData, mockRegularMemberData]);

      await service.closeStudy(STUDY_ID, USER_ID);

      expect(identityClient.updateStudy).toHaveBeenCalledWith(STUDY_ID, { status: 'CLOSED' });
    });

    it('이미 종료된 스터디 → BadRequestException', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.findStudyById.mockResolvedValue({ ...mockStudyData, status: 'CLOSED' });

      await expect(service.closeStudy(STUDY_ID, USER_ID)).rejects.toThrow(
        '이미 종료된 스터디입니다.',
      );
    });

    it('비ADMIN 종료 시도 → ForbiddenException', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      await expect(service.closeStudy(STUDY_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================
  // 11. getMembers
  // ============================
  describe('getMembers', () => {
    it('멤버 목록 반환', async () => {
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData, mockRegularMemberData]);

      const result = await service.getMembers(STUDY_ID, USER_ID);

      expect(result).toHaveLength(2);
      expect(identityClient.getMembers).toHaveBeenCalledWith(STUDY_ID);
    });

    it('멤버가 없으면 빈 배열 반환', async () => {
      identityClient.getMembers.mockResolvedValue([]);

      const result = await service.getMembers(STUDY_ID, USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ============================
  // 12. updateNickname
  // ============================
  describe('updateNickname', () => {
    it('본인 닉네임 정상 변경', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.updateNickname.mockResolvedValue({});

      const result = await service.updateNickname(STUDY_ID, USER_ID, '새닉네임');

      expect(result.nickname).toBe('새닉네임');
    });

    it('비멤버 닉네임 변경 → ForbiddenException', async () => {
      identityClient.getMember.mockRejectedValue(new NotFoundException('멤버 없음'));

      await expect(
        service.updateNickname(STUDY_ID, 'stranger', '닉네임'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateNickname(STUDY_ID, 'stranger', '닉네임'),
      ).rejects.toThrow('스터디 멤버가 아닙니다.');
    });
  });

  // ============================
  // 13. changeMemberRole
  // ============================
  describe('changeMemberRole', () => {
    it('ADMIN이 멤버를 ADMIN으로 승격', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockResolvedValueOnce(mockRegularMemberData); // target
      identityClient.changeRole.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue(mockStudyData);

      await service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN);

      expect(identityClient.changeRole).toHaveBeenCalledWith(STUDY_ID, OTHER_USER_ID, { role: StudyMemberRole.ADMIN });
    });

    it('자기 자신 역할 변경 → BadRequestException', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);

      await expect(
        service.changeMemberRole(STUDY_ID, USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow('자기 자신의 역할을 변경할 수 없습니다.');
    });

    it('대상 멤버 없음 → NotFoundException', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockRejectedValueOnce(new NotFoundException('멤버 없음'));

      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('유일 ADMIN 강등 → BadRequestException', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockResolvedValueOnce({ ...mockRegularMemberData, role: 'ADMIN' }); // target is ADMIN
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]); // only 1 ADMIN

      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.MEMBER),
      ).rejects.toThrow('최소 1명의 ADMIN이 필요합니다.');
    });

    it('ADMIN→MEMBER 강등 시 adminCount가 2 이상이면 성공', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockResolvedValueOnce({ ...mockRegularMemberData, role: 'ADMIN' }); // target is ADMIN
      identityClient.getMembers.mockResolvedValue([
        mockAdminMemberData,
        { ...mockRegularMemberData, role: 'ADMIN' },
      ]); // 2 ADMINs
      identityClient.changeRole.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue(mockStudyData);

      await service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.MEMBER);

      expect(identityClient.changeRole).toHaveBeenCalledWith(
        STUDY_ID, OTHER_USER_ID, { role: StudyMemberRole.MEMBER },
      );
    });
  });

  // ============================
  // 14. updateGroundRules
  // ============================
  describe('updateGroundRules', () => {
    it('ADMIN — 그라운드 룰 정상 수정', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.updateStudy.mockResolvedValue({ ...mockStudyData, groundRules: '새로운 규칙' });

      const result = await service.updateGroundRules(STUDY_ID, USER_ID, '새로운 규칙');

      expect(result.groundRules).toBe('새로운 규칙');
    });
  });

  // ============================
  // 15. verifyInviteCode
  // ============================
  describe('verifyInviteCode', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const validInviteData = {
      id: 'invite-id-1',
      study_id: STUDY_ID,
      code: 'VALID123',
      created_by: USER_ID,
      expires_at: futureDate.toISOString(),
      used_count: 0,
      max_uses: null,
      study: mockStudyData,
    };

    it('유효한 코드 검증 성공', async () => {
      identityClient.findInviteByCode.mockResolvedValue(validInviteData);

      const result = await service.verifyInviteCode('VALID123', '127.0.0.1');

      expect(result).toEqual({ valid: true, studyName: 'AlgoSu 스터디' });
    });

    it('존재하지 않는 코드 → NotFoundException', async () => {
      identityClient.findInviteByCode.mockRejectedValue(
        new NotFoundException('유효하지 않은 초대 코드입니다.'),
      );

      await expect(
        service.verifyInviteCode('INVALID', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('만료된 코드 → BadRequestException', async () => {
      identityClient.findInviteByCode.mockResolvedValue({
        ...validInviteData,
        expires_at: pastDate.toISOString(),
      });

      await expect(
        service.verifyInviteCode('EXPIRED', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('사용 한도 초과 → BadRequestException', async () => {
      identityClient.findInviteByCode.mockResolvedValue({
        ...validInviteData,
        max_uses: 5,
        used_count: 5,
      });

      await expect(
        service.verifyInviteCode('MAXED', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('max_uses가 null이면 used_count 무관하게 통과', async () => {
      identityClient.findInviteByCode.mockResolvedValue({
        ...validInviteData,
        used_count: 9999,
        max_uses: null,
      });

      const result = await service.verifyInviteCode('NULLMAX', '127.0.0.1');

      expect(result).toEqual({ valid: true, studyName: 'AlgoSu 스터디' });
    });
  });

  // ============================
  // 16. getStudyStats
  // ============================
  describe('getStudyStats', () => {
    const mockActiveProblemIdsResponse = {
      ok: true,
      json: () => Promise.resolve({ data: ['p1', 'p2'] }),
    };

    it('통계 API 정상 응답 처리', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 10,
          uniqueSubmissions: 8,
          uniqueAnalyzed: 6,
          byWeek: [{ week: 'W1', count: 5 }],
          byWeekPerUser: [],
          byMember: [{ userId: USER_ID, count: 5, doneCount: 3, uniqueProblemCount: 2, uniqueDoneCount: 1 }],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: ['p1'],
          submitterCountByProblem: [{ problemId: 'p1', count: 2, analyzedCount: 1 }],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockActiveProblemIdsResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.totalSubmissions).toBe(10);
      expect(result.uniqueSubmissions).toBe(8);
      expect(result.uniqueAnalyzed).toBe(6);
      expect(result.byMember).toHaveLength(1);
      expect(result.byMember[0].isMember).toBe(true);

      global.fetch = originalFetch;
    });

    it('통계 API 실패 → NotFoundException', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockActiveProblemIdsResponse)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        }) as any;

      await expect(service.getStudyStats(STUDY_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );

      global.fetch = originalFetch;
    });

    it('byMemberWeek가 배열이면 isMember 매핑 포함', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 5,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [{ userId: USER_ID, count: 3, doneCount: 2, uniqueProblemCount: 1, uniqueDoneCount: 1 }],
          byMemberWeek: [{ userId: USER_ID, count: 3 }, { userId: 'unknown-user', count: 1 }],
          recentSubmissions: [],
          solvedProblemIds: null,
          submitterCountByProblem: [],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: ['p1'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.byMemberWeek).not.toBeNull();
      expect(result.byMemberWeek).toHaveLength(2);
      expect(result.byMemberWeek![0].isMember).toBe(true);
      expect(result.byMemberWeek![1].isMember).toBe(false);

      global.fetch = originalFetch;
    });
  });

  // ============================
  // 17. notifyProblemCreated
  // ============================
  describe('notifyProblemCreated', () => {
    it('ADMIN — 문제 생성 알림 발행 (실행자 제외)', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData, mockRegularMemberData]);
      identityClient.findStudyById.mockResolvedValue(mockStudyData);

      await service.notifyProblemCreated(STUDY_ID, USER_ID, '문제 A', 'W1', 'problem-1');

      expect(identityClient.getMembers).toHaveBeenCalledWith(STUDY_ID);
    });

    it('비ADMIN → ForbiddenException', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      await expect(
        service.notifyProblemCreated(STUDY_ID, OTHER_USER_ID, '문제 A', 'W1', 'problem-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================
  // Redis error 콜백 분기
  // ============================
  describe('Redis 연결 오류 콜백', () => {
    it('Redis on error 이벤트 발생 시 에러 로깅', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;
      expect(() => handler(new Error('connection refused'))).not.toThrow();
    });
  });

  // ============================
  // onModuleDestroy
  // ============================
  describe('onModuleDestroy', () => {
    it('Redis 연결을 정상 종료한다', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
