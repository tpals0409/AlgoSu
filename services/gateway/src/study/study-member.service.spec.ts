import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyMemberService } from './study-member.service';
import { StudyAccessService } from './study-access.service';
import { MembershipCacheService } from './membership-cache.service';
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

describe('StudyMemberService', () => {
  let service: StudyMemberService;
  let configService: Record<string, jest.Mock>;
  let identityClient: Record<string, jest.Mock>;
  let notificationService: Record<string, jest.Mock>;

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
    };

    identityClient = {
      findStudyById: jest.fn(),
      getMembers: jest.fn(),
      getMember: jest.fn(),
      findUserById: jest.fn(),
      removeMember: jest.fn(),
      changeRole: jest.fn(),
      updateNickname: jest.fn(),
    };

    notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const access = new StudyAccessService(identityClient as unknown as IdentityClientService);
    const cache = new MembershipCacheService(
      configService as unknown as ConfigService,
      mockLogger as any,
    );

    service = new StudyMemberService(
      mockLogger as any,
      identityClient as unknown as IdentityClientService,
      notificationService as any,
      access,
      cache,
    );
  });

  // ============================
  // getMembers
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

    it('User 정보 조회 성공 시 username/email/avatar_url 보강', async () => {
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);
      identityClient.findUserById.mockResolvedValue({
        name: '관리자',
        email: 'admin@algo-su.com',
        avatar_url: 'https://cdn/avatar.png',
      });

      const result = await service.getMembers(STUDY_ID, USER_ID) as any[];

      expect(result[0].username).toBe('관리자');
      expect(result[0].email).toBe('admin@algo-su.com');
      expect(result[0].avatar_url).toBe('https://cdn/avatar.png');
    });

    it('User 정보 조회 실패 시 null 채움', async () => {
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);
      identityClient.findUserById.mockRejectedValue(new Error('user lookup failed'));

      const result = await service.getMembers(STUDY_ID, USER_ID) as any[];

      expect(result[0].username).toBeNull();
      expect(result[0].email).toBeNull();
      expect(result[0].avatar_url).toBeNull();
    });
  });

  // ============================
  // updateNickname
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

    it('getMember에서 비-NotFoundException 에러 시 그대로 throw', async () => {
      identityClient.getMember.mockRejectedValue(new Error('timeout'));

      await expect(
        service.updateNickname(STUDY_ID, USER_ID, '닉네임'),
      ).rejects.toThrow('timeout');
    });
  });

  // ============================
  // changeMemberRole
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

    it('getMember (대상)에서 비-NotFoundException 에러 시 그대로 throw', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockRejectedValueOnce(new Error('unexpected'));

      await expect(
        service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN),
      ).rejects.toThrow('unexpected');
    });

    it('study.name이 null일 때 기본값 "스터디" 사용', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // verifyAdmin
        .mockResolvedValueOnce(mockRegularMemberData); // target
      identityClient.changeRole.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue({ ...mockStudyData, name: null });

      await service.changeMemberRole(STUDY_ID, OTHER_USER_ID, USER_ID, StudyMemberRole.ADMIN);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('스터디'),
        }),
      );
    });
  });

  // ============================
  // leaveStudy
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

    it('getMember에서 비-NotFoundException 에러 시 그대로 throw', async () => {
      identityClient.getMember.mockRejectedValue(new Error('connection error'));

      await expect(service.leaveStudy(STUDY_ID, USER_ID)).rejects.toThrow('connection error');
    });

    it('study.name이 null일 때 기본값 "스터디" 사용', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);
      identityClient.removeMember.mockResolvedValue({});
      identityClient.findStudyById.mockResolvedValue({ ...mockStudyData, name: null });
      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      await service.leaveStudy(STUDY_ID, OTHER_USER_ID);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('스터디'),
        }),
      );
    });
  });

  // ============================
  // removeMember
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

    it('ADMIN 대상 추방 시 다른 ADMIN 있으면 성공', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // admin 권한 검증
        .mockResolvedValueOnce({ ...mockRegularMemberData, user_id: OTHER_USER_ID, role: 'ADMIN' }); // target is ADMIN
      identityClient.getMembers.mockResolvedValue([
        mockAdminMemberData,
        { ...mockRegularMemberData, user_id: OTHER_USER_ID, role: 'ADMIN' },
      ]); // 2 ADMINs
      identityClient.removeMember.mockResolvedValue({});

      await service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID);

      expect(identityClient.removeMember).toHaveBeenCalledWith(STUDY_ID, OTHER_USER_ID);
    });

    it('유일 ADMIN 대상 추방 → BadRequestException', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // admin 권한 검증
        .mockResolvedValueOnce({ ...mockRegularMemberData, user_id: OTHER_USER_ID, role: 'ADMIN' }); // target is ADMIN
      identityClient.getMembers.mockResolvedValue([
        { ...mockRegularMemberData, user_id: OTHER_USER_ID, role: 'ADMIN' },
      ]); // 1 ADMIN only

      await expect(
        service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID),
      ).rejects.toThrow('최소 1명의 ADMIN이 필요합니다.');
    });

    it('getMember에서 비-NotFoundException 에러 시 그대로 throw', async () => {
      identityClient.getMember
        .mockResolvedValueOnce(mockAdminMemberData) // admin 권한 검증
        .mockRejectedValueOnce(new Error('DB error')); // unexpected error

      await expect(
        service.removeMember(STUDY_ID, OTHER_USER_ID, USER_ID),
      ).rejects.toThrow('DB error');
    });
  });
});
