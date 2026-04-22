import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';

describe('InternalController', () => {
  let controller: InternalController;
  let identityClient: Record<string, jest.Mock>;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const STUDY_ID = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(async () => {
    identityClient = {
      getGitHubStatus: jest.fn(),
      getGitHubTokenInfo: jest.fn(),
      getEncryptedGitHubToken: jest.fn(),
      getMember: jest.fn(),
      findStudyById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: IdentityClientService, useValue: identityClient },
      ],
    })
      .overrideGuard(InternalKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InternalController>(InternalController);
  });

  describe('getGitHubStatus', () => {
    it('GitHub 연결 상태 반환', async () => {
      const expected = { github_connected: true, github_username: 'octocat' };
      identityClient.getGitHubStatus.mockResolvedValue(expected);

      const result = await controller.getGitHubStatus(USER_ID);

      expect(identityClient.getGitHubStatus).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('getEncryptedGitHubToken', () => {
    it('암호화된 GitHub 토큰 반환 (p0-010)', async () => {
      const expected = { github_username: 'octocat', encrypted_token: 'enc_xxx' };
      identityClient.getEncryptedGitHubToken.mockResolvedValue(expected);

      const result = await controller.getEncryptedGitHubToken(USER_ID);

      expect(identityClient.getEncryptedGitHubToken).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('checkMembership', () => {
    it('멤버인 경우 role 반환', async () => {
      identityClient.getMember.mockResolvedValue({ study_id: STUDY_ID, user_id: USER_ID, role: 'ADMIN' });

      const result = await controller.checkMembership(STUDY_ID, USER_ID);

      expect(identityClient.getMember).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual({ role: 'ADMIN' });
    });

    it('비멤버인 경우 NotFoundException', async () => {
      identityClient.getMember.mockRejectedValue(new NotFoundException());

      await expect(controller.checkMembership(STUDY_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('getMember가 null 반환 시 NotFoundException', async () => {
      identityClient.getMember.mockResolvedValue(null);

      await expect(controller.checkMembership(STUDY_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('role이 없는 멤버 → 기본값 MEMBER 반환', async () => {
      identityClient.getMember.mockResolvedValue({ study_id: STUDY_ID, user_id: USER_ID });

      const result = await controller.checkMembership(STUDY_ID, USER_ID);

      expect(result).toEqual({ role: 'MEMBER' });
    });

    it('role이 null인 멤버 → 기본값 MEMBER 반환', async () => {
      identityClient.getMember.mockResolvedValue({ study_id: STUDY_ID, user_id: USER_ID, role: null });

      const result = await controller.checkMembership(STUDY_ID, USER_ID);

      expect(result).toEqual({ role: 'MEMBER' });
    });
  });

  describe('getStudyGithubRepo', () => {
    it('스터디 github_repo 반환', async () => {
      identityClient.findStudyById.mockResolvedValue({ id: STUDY_ID, github_repo: 'org/repo' });

      const result = await controller.getStudyGithubRepo(STUDY_ID);

      expect(identityClient.findStudyById).toHaveBeenCalledWith(STUDY_ID);
      expect(result).toEqual({ data: { github_repo: 'org/repo' } });
    });

    it('스터디 없으면 NotFoundException', async () => {
      identityClient.findStudyById.mockRejectedValue(new NotFoundException());

      await expect(controller.getStudyGithubRepo(STUDY_ID)).rejects.toThrow(NotFoundException);
    });

    it('findStudyById가 null 반환 시 NotFoundException', async () => {
      identityClient.findStudyById.mockResolvedValue(null);

      await expect(controller.getStudyGithubRepo(STUDY_ID)).rejects.toThrow(NotFoundException);
    });

    it('github_repo가 null인 스터디 → null 반환', async () => {
      identityClient.findStudyById.mockResolvedValue({ id: STUDY_ID, github_repo: null });

      const result = await controller.getStudyGithubRepo(STUDY_ID);

      expect(result).toEqual({ data: { github_repo: null } });
    });

    it('github_repo 필드 없는 스터디 → null 반환', async () => {
      identityClient.findStudyById.mockResolvedValue({ id: STUDY_ID });

      const result = await controller.getStudyGithubRepo(STUDY_ID);

      expect(result).toEqual({ data: { github_repo: null } });
    });
  });
});
