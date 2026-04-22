import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User, OAuthProvider } from './user.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'test@example.com',
    name: '테스트',
    avatar_url: 'preset:default',
    oauth_provider: OAuthProvider.GOOGLE,
    github_connected: false,
    github_user_id: null,
    github_username: null,
    github_token: null,
    publicId: 'pub-1',
    profile_slug: null,
    is_profile_public: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    generatePublicId: jest.fn(),
    ...overrides,
  }) as User;

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
};

const mockQueryBuilder = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

/** TokenEncryptionService mock — 암호화 결과를 예측 가능하게 고정 */
const MOCK_ENCRYPTED_PREFIX = 'enc::';
const mockTokenEncryptionService = {
  encrypt: jest.fn((plain: string) => `${MOCK_ENCRYPTED_PREFIX}${plain}`),
  isEncryptedFormat: jest.fn((val: string) => val.startsWith(MOCK_ENCRYPTED_PREFIX)),
};

describe('UserService', () => {
  let service: UserService;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) },
        },
        {
          provide: TokenEncryptionService,
          useValue: mockTokenEncryptionService,
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UserService);
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findById ──────────────────────────────────────
  describe('findById', () => {
    it('존재하는 유저를 반환한다', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findById('user-1');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1', deleted_at: IsNull() },
      });
    });

    it('존재하지 않으면 null을 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ─── findByEmail ─────────────────────────────────────
  describe('findByEmail', () => {
    it('이메일로 사용자를 조회한다', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('존재하지 않으면 null을 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('none@example.com');

      expect(result).toBeNull();
    });
  });

  // ─── upsertUser ────────────────────────────────────
  describe('upsertUser', () => {
    const dto = {
      email: 'new@example.com',
      name: '신규',
      oauth_provider: OAuthProvider.GOOGLE,
    };

    it('새 유저를 생성한다 (atomicUpsert)', async () => {
      const created = mockUser({ email: dto.email });
      userRepo.findOne
        .mockResolvedValueOnce(null)            // existing 조회
        .mockResolvedValueOnce(created);         // atomicUpsert 후 조회

      const result = await service.upsertUser(dto);

      expect(result).toBe(created);
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('기존 유저가 있으면 기존 유저를 반환한다', async () => {
      const existing = mockUser({ email: dto.email });
      userRepo.findOne
        .mockResolvedValueOnce(existing)         // existing 조회
        .mockResolvedValueOnce(existing);        // atomicUpsert 후 조회

      const result = await service.upsertUser(dto);

      expect(result).toBe(existing);
    });

    it('다른 provider로 시도 시 BadRequestException', async () => {
      const existing = mockUser({ oauth_provider: OAuthProvider.NAVER });
      userRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.upsertUser({ ...dto, oauth_provider: OAuthProvider.GOOGLE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('알 수 없는 provider일 때 provider 이름 그대로 표시', async () => {
      const existing = mockUser({ oauth_provider: 'unknown' as OAuthProvider });
      userRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.upsertUser({ ...dto, oauth_provider: OAuthProvider.GOOGLE }),
      ).rejects.toThrow(/unknown/);
    });

    it('name 미전달 시 null로 생성한다', async () => {
      const created = mockUser({ email: 'noname@example.com' });
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);

      const result = await service.upsertUser({
        email: 'noname@example.com',
        oauth_provider: OAuthProvider.GOOGLE,
      } as any);

      expect(result).toBe(created);
    });

    it('탈퇴 유저를 복구한다', async () => {
      const deleted = mockUser({ deleted_at: new Date() });
      const restored = mockUser({ deleted_at: null });
      userRepo.findOne
        .mockResolvedValueOnce(deleted)          // existing 조회
        .mockResolvedValueOnce(restored);        // restoreDeletedUser 후 조회
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.upsertUser(dto);

      expect(result).toBe(restored);
      expect(userRepo.update).toHaveBeenCalledWith(
        deleted.id,
        expect.objectContaining({ deleted_at: null, github_connected: false }),
      );
    });

    it('탈퇴 유저 복구 시 name 없으면 null로 복구한다', async () => {
      const deleted = mockUser({ deleted_at: new Date() });
      const restored = mockUser({ deleted_at: null, name: null as any });
      userRepo.findOne
        .mockResolvedValueOnce(deleted)
        .mockResolvedValueOnce(restored);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await service.upsertUser({
        email: 'new@example.com',
        oauth_provider: OAuthProvider.GOOGLE,
      } as any);

      expect(result).toBe(restored);
      expect(userRepo.update).toHaveBeenCalledWith(
        deleted.id,
        expect.objectContaining({ name: null }),
      );
    });
  });

  // ─── updateUser ────────────────────────────────────
  describe('updateUser', () => {
    it('정상 업데이트한다', async () => {
      const user = mockUser();
      const updated = mockUser({ name: '변경' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(updated);

      const result = await service.updateUser('user-1', { name: '변경' });

      expect(result.name).toBe('변경');
    });

    it('없는 유저면 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.updateUser('x', { name: 'a' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── softDeleteUser ────────────────────────────────
  describe('softDeleteUser', () => {
    it('정상 삭제 — study_members, notifications 정리', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.softDeleteUser('user-1');

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
      // users UPDATE
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['user-1']),
      );
      // study_members DELETE
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM study_members'),
        ['user-1'],
      );
      // notifications DELETE
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        ['user-1'],
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('이미 삭제된 유저면 무시한다 (멱등성)', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ deleted_at: new Date() }));

      await service.softDeleteUser('user-1');

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('존재하지 않는 유저면 무시한다', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await service.softDeleteUser('non');

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('트랜잭션 실패 시 롤백하고 에러를 전파한다', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      mockQueryRunner.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.softDeleteUser('user-1')).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── updateGitHub ──────────────────────────────────
  describe('updateGitHub', () => {
    it('GitHub 연동 시 토큰을 암호화하여 저장한다', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateGitHub('user-1', {
        connected: true,
        user_id: 'gh-1',
        username: 'ghuser',
        token: 'tok',
      });

      // encrypt가 평문 토큰으로 호출됐는지 검증
      expect(mockTokenEncryptionService.encrypt).toHaveBeenCalledWith('tok');
      // DB에는 암호화된 값이 저장되어야 함 (평문 'tok' 금지)
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        github_connected: true,
        github_user_id: 'gh-1',
        github_username: 'ghuser',
        github_token: `${MOCK_ENCRYPTED_PREFIX}tok`,
      });
    });

    it('token이 null이면 암호화 없이 null 저장', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateGitHub('user-1', { connected: true });

      expect(mockTokenEncryptionService.encrypt).not.toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        github_connected: true,
        github_user_id: null,
        github_username: null,
        github_token: null,
      });
    });

    it('GitHub 연동 해제한다', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateGitHub('user-1', null);

      expect(mockTokenEncryptionService.encrypt).not.toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
      });
    });

    it('connected=false로 해제한다', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateGitHub('user-1', { connected: false });

      expect(mockTokenEncryptionService.encrypt).not.toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
      });
    });

    it('optional 필드 미전달 시 null로 저장한다', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateGitHub('user-1', { connected: true });

      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        github_connected: true,
        github_user_id: null,
        github_username: null,
        github_token: null,
      });
    });
  });

  // ─── getGitHubStatus ──────────────────────────────
  describe('getGitHubStatus', () => {
    it('정상 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(
        mockUser({ github_connected: true, github_username: 'ghuser' }),
      );

      const result = await service.getGitHubStatus('user-1');

      expect(result).toEqual({
        github_connected: true,
        github_username: 'ghuser',
      });
    });

    it('유저 미존재 시 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getGitHubStatus('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getGitHubTokenInfo ────────────────────────────
  describe('getGitHubTokenInfo', () => {
    it('암호화된 토큰을 그대로 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(
        mockUser({ github_username: 'ghuser', github_token: `${MOCK_ENCRYPTED_PREFIX}enc-tok` }),
      );

      const result = await service.getGitHubTokenInfo('user-1');

      expect(result).toEqual({
        github_username: 'ghuser',
        github_token: `${MOCK_ENCRYPTED_PREFIX}enc-tok`,
      });
    });

    it('유저 미존재 시 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getGitHubTokenInfo('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findBySlug ─────────────────────────────────────
  describe('findBySlug', () => {
    it('slug로 공개 프로필을 조회한다', async () => {
      const user = mockUser({ profile_slug: 'my-slug', is_profile_public: true });
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findBySlug('my-slug');

      expect(result).toBe(user);
    });

    it('비공개이거나 미존재 시 null을 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findBySlug('none');

      expect(result).toBeNull();
    });
  });

  // ─── updateProfileSettings ─────────────────────────
  describe('updateProfileSettings', () => {
    it('slug 중복 시 ConflictException', async () => {
      const user = mockUser();
      const other = mockUser({ id: 'user-2', profile_slug: 'taken' });
      userRepo.findOne
        .mockResolvedValueOnce(user)   // findByIdOrThrow
        .mockResolvedValueOnce(other); // validateAndSetSlug 중복 확인

      await expect(
        service.updateProfileSettings('user-1', { profileSlug: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('예약어 slug 시 BadRequestException', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser());

      await expect(
        service.updateProfileSettings('user-1', { profileSlug: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('slug 없이 공개 토글 시도 시 BadRequestException', async () => {
      const user = mockUser({ profile_slug: null, is_profile_public: false });
      userRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateProfileSettings('user-1', { isProfilePublic: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('유저 미존재 시 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfileSettings('x', { profileSlug: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('정상 업데이트 — slug + 공개 토글', async () => {
      const user = mockUser();
      userRepo.findOne
        .mockResolvedValueOnce(user)   // findByIdOrThrow
        .mockResolvedValueOnce(null);  // slug 중복 없음
      userRepo.save.mockResolvedValue({ ...user, profile_slug: 'my-slug', is_profile_public: true } as User);

      const result = await service.updateProfileSettings('user-1', {
        profileSlug: 'my-slug',
        isProfilePublic: true,
      });

      expect(result.profileSlug).toBe('my-slug');
      expect(result.isProfilePublic).toBe(true);
    });
  });
});
