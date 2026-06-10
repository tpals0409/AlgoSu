import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudyAccessService } from './study-access.service';
import { IdentityClientService } from '../identity-client/identity-client.service';

describe('StudyAccessService', () => {
  let service: StudyAccessService;
  let identityClient: Record<string, jest.Mock>;

  const STUDY_ID = 'study-id-1';
  const USER_ID = 'user-id-admin';

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
    user_id: 'user-id-member',
    role: 'MEMBER',
    nickname: 'Member',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    identityClient = {
      getMember: jest.fn(),
    };
    service = new StudyAccessService(identityClient as unknown as IdentityClientService);
  });

  describe('verifyMembership', () => {
    it('멤버이면 멤버 엔티티 반환', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      const result = await service.verifyMembership(STUDY_ID, 'user-id-member');

      expect(result).toEqual(mockRegularMemberData);
    });

    it('NotFoundException → ForbiddenException 변환', async () => {
      identityClient.getMember.mockRejectedValue(new NotFoundException('멤버 없음'));

      await expect(service.verifyMembership(STUDY_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.verifyMembership(STUDY_ID, 'stranger')).rejects.toThrow(
        '해당 스터디의 멤버가 아닙니다.',
      );
    });

    it('비-NotFoundException 에러는 그대로 throw', async () => {
      identityClient.getMember.mockRejectedValue(new Error('network failure'));

      await expect(service.verifyMembership(STUDY_ID, USER_ID)).rejects.toThrow(
        'network failure',
      );
    });
  });

  describe('verifyAdmin', () => {
    it('ADMIN이면 멤버 엔티티 반환', async () => {
      identityClient.getMember.mockResolvedValue(mockAdminMemberData);

      const result = await service.verifyAdmin(STUDY_ID, USER_ID);

      expect(result).toEqual(mockAdminMemberData);
    });

    it('비ADMIN → ForbiddenException', async () => {
      identityClient.getMember.mockResolvedValue(mockRegularMemberData);

      await expect(service.verifyAdmin(STUDY_ID, 'user-id-member')).rejects.toThrow(
        'ADMIN 권한이 필요합니다.',
      );
    });
  });
});
