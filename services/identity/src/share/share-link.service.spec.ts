import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { ShareLink } from './share-link.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockShareLink = (overrides: Partial<ShareLink> = {}): ShareLink =>
  ({
    id: 'link-1',
    token: 'a'.repeat(64),
    study_id: 'study-1',
    created_by: 'user-1',
    expires_at: new Date(Date.now() + 86400_000),
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as ShareLink;

describe('ShareLinkService', () => {
  let service: ShareLinkService;
  let linkRepo: jest.Mocked<Repository<ShareLink>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareLinkService,
        {
          provide: getRepositoryToken(ShareLink),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ShareLinkService);
    linkRepo = module.get(getRepositoryToken(ShareLink));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────
  describe('create', () => {
    it('64자 hex 토큰을 생성한다', async () => {
      const saved = mockShareLink();
      linkRepo.create.mockReturnValue(saved);
      linkRepo.save.mockResolvedValue(saved);

      const result = await service.create({
        study_id: 'study-1',
        created_by: 'user-1',
      });

      expect(result).toBe(saved);
      expect(linkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.stringMatching(/^[a-f0-9]{64}$/),
          study_id: 'study-1',
          created_by: 'user-1',
          is_active: true,
        }),
      );
    });

    it('만료 일시가 현재보다 이전이면 BadRequestException', async () => {
      await expect(
        service.create({
          study_id: 'study-1',
          created_by: 'user-1',
          expires_at: '2020-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('만료 일시 없이 생성하면 expires_at이 null', async () => {
      const saved = mockShareLink({ expires_at: null });
      linkRepo.create.mockReturnValue(saved);
      linkRepo.save.mockResolvedValue(saved);

      await service.create({ study_id: 'study-1', created_by: 'user-1' });

      expect(linkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: null }),
      );
    });
  });

  // ─── deactivate ────────────────────────────────────
  describe('deactivate', () => {
    it('소유자가 비활성화한다', async () => {
      const link = mockShareLink();
      linkRepo.findOne.mockResolvedValue(link);
      linkRepo.save.mockResolvedValue({ ...link, is_active: false } as ShareLink);

      const result = await service.deactivate('link-1', 'user-1');

      expect(result.message).toContain('비활성화');
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('다른 userId면 ForbiddenException', async () => {
      const link = mockShareLink({ created_by: 'user-1' });
      linkRepo.findOne.mockResolvedValue(link);

      await expect(service.deactivate('link-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('링크 미존재 시 NotFoundException', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate('x', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── verifyToken ───────────────────────────────────
  describe('verifyToken', () => {
    it('활성 + 미만료 링크를 반환한다', async () => {
      const link = mockShareLink();
      linkRepo.findOne.mockResolvedValue(link);

      const result = await service.verifyToken('a'.repeat(64));

      expect(result).toBe(link);
    });

    it('비활성 링크면 null을 반환한다', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      const result = await service.verifyToken('b'.repeat(64));

      expect(result).toBeNull();
    });

    it('만료된 링크면 null을 반환한다', async () => {
      const expired = mockShareLink({
        expires_at: new Date(Date.now() - 86400_000),
      });
      linkRepo.findOne.mockResolvedValue(expired);

      const result = await service.verifyToken('a'.repeat(64));

      expect(result).toBeNull();
    });

    it('유효하지 않은 토큰 형식이면 null을 반환한다', async () => {
      const result = await service.verifyToken('invalid-token');

      expect(result).toBeNull();
      expect(linkRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
