import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { OAuthService } from '../auth/oauth/oauth.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMember, Study } from '../study/study.entity';

describe('InternalController', () => {
  let controller: InternalController;
  let oauthService: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let studyRepo: Record<string, jest.Mock>;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const STUDY_ID = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(async () => {
    oauthService = {
      getGitHubStatus: jest.fn(),
      getGitHubTokenInfo: jest.fn(),
    };

    memberRepo = { findOne: jest.fn() };
    studyRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: OAuthService, useValue: oauthService },
        { provide: getRepositoryToken(StudyMember), useValue: memberRepo },
        { provide: getRepositoryToken(Study), useValue: studyRepo },
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
      oauthService.getGitHubStatus.mockResolvedValue(expected);

      const result = await controller.getGitHubStatus(USER_ID);

      expect(oauthService.getGitHubStatus).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('getGitHubToken', () => {
    it('GitHub 토큰 정보 반환', async () => {
      const expected = { github_username: 'octocat', github_token: 'gho_xxx' };
      oauthService.getGitHubTokenInfo.mockResolvedValue(expected);

      const result = await controller.getGitHubToken(USER_ID);

      expect(oauthService.getGitHubTokenInfo).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('checkMembership', () => {
    it('멤버인 경우 role 반환', async () => {
      memberRepo.findOne.mockResolvedValue({ study_id: STUDY_ID, user_id: USER_ID, role: 'ADMIN' });

      const result = await controller.checkMembership(STUDY_ID, USER_ID);

      expect(memberRepo.findOne).toHaveBeenCalledWith({
        where: { study_id: STUDY_ID, user_id: USER_ID },
      });
      expect(result).toEqual({ role: 'ADMIN' });
    });

    it('비멤버인 경우 NotFoundException', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(controller.checkMembership(STUDY_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudyGithubRepo', () => {
    it('스터디 github_repo 반환', async () => {
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, github_repo: 'org/repo' });

      const result = await controller.getStudyGithubRepo(STUDY_ID);

      expect(studyRepo.findOne).toHaveBeenCalledWith({
        where: { id: STUDY_ID },
        select: ['id', 'github_repo'],
      });
      expect(result).toEqual({ data: { github_repo: 'org/repo' } });
    });

    it('스터디 없으면 NotFoundException', async () => {
      studyRepo.findOne.mockResolvedValue(null);

      await expect(controller.getStudyGithubRepo(STUDY_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
