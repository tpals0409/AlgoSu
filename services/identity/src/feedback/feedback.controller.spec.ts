/**
 * @file 피드백 컨트롤러 단위 테스트
 * @domain identity
 * @layer test
 * @related feedback.controller.ts, feedback.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { FeedbackCategory, FeedbackStatus } from './feedback.entity';

describe('FeedbackController (Identity)', () => {
  let controller: FeedbackController;
  let service: jest.Mocked<FeedbackService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        {
          provide: FeedbackService,
          useValue: {
            create: jest.fn(),
            findByUserId: jest.fn(),
            findAll: jest.fn(),
            findByPublicId: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FeedbackController);
    service = module.get(FeedbackService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('FeedbackService.create를 호출한다', async () => {
      const dto = {
        userId: 'user-1',
        category: FeedbackCategory.BUG,
        content: '버그 발생',
      };
      service.create.mockResolvedValue({ publicId: 'pub-1' } as never);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ publicId: 'pub-1' });
    });
  });

  describe('findByUserId', () => {
    it('FeedbackService.findByUserId를 호출한다', async () => {
      service.findByUserId.mockResolvedValue([] as never);

      const result = await controller.findByUserId('user-1');

      expect(service.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('페이지네이션 파라미터를 파싱하여 서비스에 전달한다', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 } as never);

      const result = await controller.findAll('2', '10', 'BUG', '검색어');

      expect(service.findAll).toHaveBeenCalledWith(2, 10, 'BUG', '검색어');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('파라미터 없으면 undefined로 전달한다', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 } as never);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('findByPublicId', () => {
    it('FeedbackService.findByPublicId를 호출한다', async () => {
      const detail = { publicId: 'pub-1', screenshot: 'data:image/png;base64,abc' };
      service.findByPublicId.mockResolvedValue(detail as never);

      const result = await controller.findByPublicId('pub-1');

      expect(service.findByPublicId).toHaveBeenCalledWith('pub-1');
      expect(result).toEqual(detail);
    });
  });

  describe('updateStatus', () => {
    it('FeedbackService.updateStatus를 호출한다', async () => {
      service.updateStatus.mockResolvedValue({ publicId: 'pub-1', status: FeedbackStatus.RESOLVED } as never);

      const result = await controller.updateStatus('pub-1', { status: FeedbackStatus.RESOLVED });

      expect(service.updateStatus).toHaveBeenCalledWith('pub-1', FeedbackStatus.RESOLVED);
      expect(result).toEqual({ publicId: 'pub-1', status: FeedbackStatus.RESOLVED });
    });
  });
});
