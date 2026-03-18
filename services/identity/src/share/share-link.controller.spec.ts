import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ShareLinkController } from './share-link.controller';
import { ShareLinkService } from './share-link.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const mockLink = {
  id: 'link-1',
  token: 'a'.repeat(64),
  study_id: 'study-1',
  created_by: 'user-1',
  is_active: true,
};

describe('ShareLinkController', () => {
  let controller: ShareLinkController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareLinkController],
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
          provide: ShareLinkService,
          useValue: {
            create: jest.fn(),
            findByUserAndStudy: jest.fn(),
            deactivate: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ShareLinkController);
    service = module.get(ShareLinkService) as unknown as Record<string, jest.Mock>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ─────────────────────────────────────
  describe('POST /api/share-links', () => {
    it('공유 링크를 생성하고 반환한다', async () => {
      service.create.mockResolvedValue(mockLink);
      const dto = { study_id: 'study-1', created_by: 'user-1', expires_at: '2030-01-01T00:00:00Z' };

      const result = await controller.create(dto as any);

      expect(result).toBe(mockLink);
      expect(service.create).toHaveBeenCalledWith({
        study_id: 'study-1',
        created_by: 'user-1',
        expires_at: '2030-01-01T00:00:00Z',
      });
    });
  });

  // ─── findByUserAndStudy ─────────────────────────
  describe('GET /api/share-links/by-user/:userId/study/:studyId', () => {
    it('사용자의 활성 공유 링크 목록을 반환한다', async () => {
      const links = [mockLink];
      service.findByUserAndStudy.mockResolvedValue(links);

      const result = await controller.findByUserAndStudy('user-1', 'study-1');

      expect(result).toBe(links);
      expect(service.findByUserAndStudy).toHaveBeenCalledWith('user-1', 'study-1');
    });
  });

  // ─── deactivate ─────────────────────────────────
  describe('PATCH /api/share-links/:id/deactivate', () => {
    it('공유 링크를 비활성화하고 메시지를 반환한다', async () => {
      const msg = { message: '공유 링크가 비활성화되었습니다.' };
      service.deactivate.mockResolvedValue(msg);
      const dto = { userId: 'user-1' };

      const result = await controller.deactivate('link-1', dto as any);

      expect(result).toEqual(msg);
      expect(service.deactivate).toHaveBeenCalledWith('link-1', 'user-1');
    });
  });

  // ─── verifyToken ────────────────────────────────
  describe('GET /api/share-links/by-token/:token', () => {
    it('유효한 토큰으로 공유 링크를 반환한다', async () => {
      service.verifyToken.mockResolvedValue(mockLink);

      const result = await controller.verifyToken('a'.repeat(64));

      expect(result).toBe(mockLink);
      expect(service.verifyToken).toHaveBeenCalledWith('a'.repeat(64));
    });

    it('유효하지 않은 토큰이면 null을 반환한다', async () => {
      service.verifyToken.mockResolvedValue(null);

      const result = await controller.verifyToken('invalid');

      expect(result).toBeNull();
    });
  });
});
