import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { OAuthProvider } from './user.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: '테스트',
  avatar_url: 'preset:default',
  oauth_provider: OAuthProvider.GOOGLE,
  github_connected: false,
};

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<Pick<UserService, keyof UserService>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-key') },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: UserService,
          useValue: {
            upsertUser: jest.fn(),
            findById: jest.fn(),
            updateUser: jest.fn(),
            softDeleteUser: jest.fn(),
            updateGitHub: jest.fn(),
            getGitHubStatus: jest.fn(),
            getGitHubTokenInfo: jest.fn(),
            getEncryptedGitHubToken: jest.fn(),
            findBySlug: jest.fn(),
            updateProfileSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService) as unknown as jest.Mocked<Pick<UserService, keyof UserService>>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── upsertUser ───────────────────────────────────
  describe('POST /api/users/upsert', () => {
    it('사용자 생성/조회 결과를 data로 감싸 반환한다', async () => {
      (service.upsertUser as jest.Mock).mockResolvedValue(mockUser);
      const dto = { email: 'test@example.com', name: '테스트', oauth_provider: OAuthProvider.GOOGLE };

      const result = await controller.upsertUser(dto);

      expect(result).toEqual({ data: mockUser });
      expect(service.upsertUser).toHaveBeenCalledWith(dto);
    });
  });

  // ─── findById ─────────────────────────────────────
  describe('GET /api/users/:id', () => {
    it('존재하는 사용자를 반환한다', async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.findById('user-1');

      expect(result).toEqual({ data: mockUser });
      expect(service.findById).toHaveBeenCalledWith('user-1');
    });

    it('사용자 미존재 시 NotFoundException', async () => {
      (service.findById as jest.Mock).mockResolvedValue(null);

      await expect(controller.findById('non')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateUser ───────────────────────────────────
  describe('PATCH /api/users/:id', () => {
    it('프로필을 업데이트하고 결과를 반환한다', async () => {
      const updated = { ...mockUser, name: '변경' };
      (service.updateUser as jest.Mock).mockResolvedValue(updated);
      const dto = { name: '변경' };

      const result = await controller.updateUser('user-1', dto);

      expect(result).toEqual({ data: updated });
      expect(service.updateUser).toHaveBeenCalledWith('user-1', dto);
    });
  });

  // ─── softDeleteUser ───────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('소프트 삭제 후 메시지를 반환한다', async () => {
      (service.softDeleteUser as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.softDeleteUser('user-1');

      expect(result).toEqual({ data: { message: '계정이 삭제되었습니다.' } });
      expect(service.softDeleteUser).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── updateGitHub ─────────────────────────────────
  describe('PATCH /api/users/:id/github', () => {
    it('GitHub 연동 정보를 업데이트한다', async () => {
      (service.updateGitHub as jest.Mock).mockResolvedValue(undefined);
      const dto = { connected: true, user_id: 'gh-1', username: 'ghuser', token: 'tok' };

      const result = await controller.updateGitHub('user-1', dto);

      expect(result).toEqual({ data: { message: 'GitHub 연동 정보가 업데이트되었습니다.' } });
      expect(service.updateGitHub).toHaveBeenCalledWith('user-1', dto);
    });
  });

  // ─── getGitHubStatus ──────────────────────────────
  describe('GET /api/users/:id/github-status', () => {
    it('GitHub 연동 상태를 반환한다', async () => {
      const status = { github_connected: true, github_username: 'ghuser' };
      (service.getGitHubStatus as jest.Mock).mockResolvedValue(status);

      const result = await controller.getGitHubStatus('user-1');

      expect(result).toEqual({ data: status });
      expect(service.getGitHubStatus).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── getGitHubTokenInfo ───────────────────────────
  describe('GET /api/users/:id/github-token', () => {
    it('GitHub 토큰 존재 여부를 반환한다 (p0-010)', async () => {
      const info = { github_username: 'ghuser', has_token: true };
      (service.getGitHubTokenInfo as jest.Mock).mockResolvedValue(info);

      const result = await controller.getGitHubTokenInfo('user-1');

      expect(result).toEqual({ data: info });
      expect(service.getGitHubTokenInfo).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── getEncryptedGitHubToken ─────────────────────
  describe('GET /api/users/:id/github-encrypted-token', () => {
    it('암호화된 GitHub 토큰을 반환한다 (p0-010)', async () => {
      const info = { github_username: 'ghuser', encrypted_token: 'enc-tok' };
      (service.getEncryptedGitHubToken as jest.Mock).mockResolvedValue(info);

      const result = await controller.getEncryptedGitHubToken('user-1');

      expect(result).toEqual({ data: info });
      expect(service.getEncryptedGitHubToken).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── findBySlug ───────────────────────────────────
  describe('GET /api/users/by-slug/:slug', () => {
    it('slug로 공개 프로필을 whitelist 프로젝션으로 반환한다 (p0-011)', async () => {
      const fullUser = {
        ...mockUser,
        publicId: 'pub-1',
        profile_slug: 'my-slug',
        github_connected: false,
        github_username: null,
        created_at: new Date('2025-01-01'),
        // 비공개 필드 — 응답에 포함되면 안 됨
        email: 'secret@example.com',
        github_token: 'enc-secret',
        oauth_provider: 'google',
        is_profile_public: true,
      };
      (service.findBySlug as jest.Mock).mockResolvedValue(fullUser);

      const result = await controller.findBySlug('my-slug');

      expect(result).toEqual({
        data: {
          publicId: 'pub-1',
          name: '테스트',
          avatar_url: 'preset:default',
          profile_slug: 'my-slug',
          github_connected: false,
          github_username: null,
          created_at: new Date('2025-01-01'),
        },
      });
      // 비공개 필드가 노출되지 않아야 함
      expect(result.data).not.toHaveProperty('email');
      expect(result.data).not.toHaveProperty('github_token');
      expect(result.data).not.toHaveProperty('oauth_provider');
      expect(service.findBySlug).toHaveBeenCalledWith('my-slug');
    });

    it('프로필 미존재 시 NotFoundException', async () => {
      (service.findBySlug as jest.Mock).mockResolvedValue(null);

      await expect(controller.findBySlug('none')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateProfileSettings ────────────────────────
  describe('PATCH /api/users/:id/profile-settings', () => {
    it('프로필 설정을 업데이트하고 결과를 반환한다', async () => {
      const result = { profileSlug: 'my-slug', isProfilePublic: true };
      (service.updateProfileSettings as jest.Mock).mockResolvedValue(result);
      const dto = { profileSlug: 'my-slug', isProfilePublic: true };

      const res = await controller.updateProfileSettings('user-1', dto);

      expect(res).toEqual({ data: result });
      expect(service.updateProfileSettings).toHaveBeenCalledWith('user-1', dto);
    });
  });
});
