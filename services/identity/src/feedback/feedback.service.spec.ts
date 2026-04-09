/**
 * @file 피드백 서비스 단위 테스트 — create / findByUserId / findAll / updateStatus / deleteOldScreenshots
 * @domain identity
 * @layer test
 * @related feedback.service.ts, feedback.entity.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { Feedback, FeedbackCategory, FeedbackStatus } from './feedback.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { DiscordWebhookService } from '../discord/discord-webhook.service';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockFeedback = (overrides: Partial<Feedback> = {}): Feedback => {
  const fb = {
    id: 1,
    publicId: 'pub-fb-1',
    userId: 'user-1',
    studyId: null,
    category: FeedbackCategory.GENERAL,
    content: '테스트 피드백입니다.',
    pageUrl: null,
    browserInfo: null,
    screenshot: null,
    status: FeedbackStatus.OPEN,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    resolvedAt: null,
    generatePublicId: jest.fn(),
    ...overrides,
  };
  (fb as Record<string, unknown>).toJSON = function () {
    const { id, screenshot, ...rest } = this as Record<string, unknown>;
    return rest;
  };
  return fb as Feedback;
};

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepo: jest.Mocked<Repository<Feedback>>;
  let discordWebhook: jest.Mocked<DiscordWebhookService>;

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    execute: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const mockManagerQuery = jest.fn().mockResolvedValue([]);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(Feedback),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            manager: { query: mockManagerQuery },
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: DiscordWebhookService,
          useValue: { sendFeedbackNotification: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(FeedbackService);
    feedbackRepo = module.get(getRepositoryToken(Feedback));
    discordWebhook = module.get(DiscordWebhookService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────
  describe('create', () => {
    it('GENERAL 카테고리 피드백을 정상 생성한다', async () => {
      const fb = mockFeedback();
      feedbackRepo.create.mockReturnValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      const result = await service.create({
        userId: 'user-1',
        category: FeedbackCategory.GENERAL,
        content: '테스트 피드백입니다.',
      });

      expect(result).toBe(fb);
      expect(feedbackRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        studyId: null,
        category: FeedbackCategory.GENERAL,
        content: '테스트 피드백입니다.',
        pageUrl: null,
        browserInfo: null,
        screenshot: null,
      });
      expect(feedbackRepo.save).toHaveBeenCalledWith(fb);
    });

    it('BUG 카테고리 피드백을 정상 생성한다', async () => {
      const fb = mockFeedback({
        category: FeedbackCategory.BUG,
        pageUrl: '/problems',
        browserInfo: 'Chrome 130',
        screenshot: 'data:image/png;base64,abc',
      });
      feedbackRepo.create.mockReturnValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      const result = await service.create({
        userId: 'user-1',
        category: FeedbackCategory.BUG,
        content: '테스트 피드백입니다.',
        pageUrl: '/problems',
        browserInfo: 'Chrome 130',
        screenshot: 'data:image/png;base64,abc',
      });

      expect(result).toBe(fb);
      expect(feedbackRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        studyId: null,
        category: FeedbackCategory.BUG,
        content: '테스트 피드백입니다.',
        pageUrl: '/problems',
        browserInfo: 'Chrome 130',
        screenshot: 'data:image/png;base64,abc',
      });
    });

    it('생성 후 Discord 알림을 전송한다', async () => {
      const fb = mockFeedback();
      feedbackRepo.create.mockReturnValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      await service.create({
        userId: 'user-1',
        category: FeedbackCategory.GENERAL,
        content: '테스트 피드백입니다.',
      });

      expect(discordWebhook.sendFeedbackNotification).toHaveBeenCalledWith(fb);
    });

    it('Discord 알림 실패 시에도 피드백은 정상 반환된다', async () => {
      const fb = mockFeedback();
      feedbackRepo.create.mockReturnValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);
      discordWebhook.sendFeedbackNotification.mockRejectedValue(
        new Error('Discord down'),
      );

      const result = await service.create({
        userId: 'user-1',
        category: FeedbackCategory.GENERAL,
        content: '테스트 피드백입니다.',
      });

      expect(result).toBe(fb);
    });

    it('선택 필드 미전달 시 null로 저장한다', async () => {
      const fb = mockFeedback();
      feedbackRepo.create.mockReturnValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      await service.create({
        userId: 'user-1',
        category: FeedbackCategory.GENERAL,
        content: '내용만 전달',
      });

      expect(feedbackRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studyId: null,
          pageUrl: null,
          browserInfo: null,
          screenshot: null,
        }),
      );
    });
  });

  // ─── findByUserId ──────────────────────────────────
  describe('findByUserId', () => {
    it('사용자별 피드백 목록을 최신순 50개 제한으로 반환한다', async () => {
      const feedbacks = [mockFeedback(), mockFeedback({ id: 2, publicId: 'pub-fb-2' })];
      feedbackRepo.find.mockResolvedValue(feedbacks);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(feedbacks);
      expect(feedbackRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('피드백이 없으면 빈 배열을 반환한다', async () => {
      feedbackRepo.find.mockResolvedValue([]);

      const result = await service.findByUserId('user-none');

      expect(result).toEqual([]);
    });
  });

  // ─── findAll ───────────────────────────────────────
  describe('findAll', () => {
    it('기본값 page=1, limit=20으로 페이지네이션 조회한다', async () => {
      const fb = mockFeedback();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[fb], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockManagerQuery.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(feedbackRepo.createQueryBuilder).toHaveBeenCalledWith('f');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('f.created_at', 'DESC');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('page=2, limit=10이면 skip=10으로 조회한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(2, 10);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });

    it('limit이 100을 초과하면 100으로 제한한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 200);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('page가 0 이하이면 1로 보정한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(0, 20);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('category 필터를 적용한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 20, 'BUG');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'f.category = :category',
        { category: 'BUG' },
      );
    });

    it('search 키워드를 ILIKE으로 검색한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 20, undefined, '버그');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'f.content ILIKE :search',
        { search: '%버그%' },
      );
    });

    it('status 필터를 적용한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 20, undefined, undefined, 'OPEN');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'f.status = :status',
        { status: 'OPEN' },
      );
    });

    it('counts에 상태별/카테고리별 통계를 반환한다', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([{ status: 'OPEN', cnt: '3' }, { status: 'RESOLVED', cnt: '1' }])
        .mockResolvedValueOnce([{ category: 'BUG', cnt: '2' }, { category: 'GENERAL', cnt: '2' }]);

      const result = await service.findAll();

      expect(result.counts).toEqual({
        OPEN: 3,
        RESOLVED: 1,
        'cat:BUG': 2,
        'cat:GENERAL': 2,
      });
    });

    it('피드백이 있을 때 사용자/스터디 정보를 배치 조회한다', async () => {
      const fb = mockFeedback({ studyId: 'study-1' });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[fb], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockManagerQuery
        .mockResolvedValueOnce([{ id: 'user-1', name: 'Test User', email: 'test@test.com' }])
        .mockResolvedValueOnce([{ id: 'study-1', name: 'Test Study' }]);

      const result = await service.findAll();

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          userName: 'Test User',
          userEmail: 'test@test.com',
          studyName: 'Test Study',
        }),
      );
      expect(mockManagerQuery).toHaveBeenCalledTimes(2);
    });
  });

  // ─── updateStatus ──────────────────────────────────
  describe('updateStatus', () => {
    it('OPEN → IN_PROGRESS 상태 변경에 성공한다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.OPEN });
      const updated = { ...fb, status: FeedbackStatus.IN_PROGRESS } as Feedback;
      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue(updated);

      const result = await service.updateStatus('pub-fb-1', FeedbackStatus.IN_PROGRESS);

      expect(result).toBe(updated);
      expect(fb.status).toBe(FeedbackStatus.IN_PROGRESS);
      expect(feedbackRepo.save).toHaveBeenCalledWith(fb);
    });

    it('IN_PROGRESS → RESOLVED 상태 변경에 성공한다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.IN_PROGRESS });
      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      await service.updateStatus('pub-fb-1', FeedbackStatus.RESOLVED);

      expect(fb.status).toBe(FeedbackStatus.RESOLVED);
    });

    it('존재하지 않는 publicId이면 NotFoundException을 던진다', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', FeedbackStatus.IN_PROGRESS),
      ).rejects.toThrow(NotFoundException);
    });

    it('RESOLVED 상태로 변경 시 resolvedAt을 자동 설정한다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.IN_PROGRESS, resolvedAt: null });
      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      await service.updateStatus('pub-fb-1', FeedbackStatus.RESOLVED);

      expect(fb.resolvedAt).toBeInstanceOf(Date);
      expect(fb.status).toBe(FeedbackStatus.RESOLVED);
    });

    it('RESOLVED가 아닌 상태로 변경 시 resolvedAt을 설정하지 않는다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.OPEN, resolvedAt: null });
      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue(fb);

      await service.updateStatus('pub-fb-1', FeedbackStatus.IN_PROGRESS);

      expect(fb.resolvedAt).toBeNull();
    });

    it('RESOLVED → OPEN 재오픈이 가능하다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.RESOLVED });
      const updated = { ...fb, status: FeedbackStatus.OPEN } as Feedback;
      feedbackRepo.findOne.mockResolvedValue(fb);
      feedbackRepo.save.mockResolvedValue(updated);

      const result = await service.updateStatus('pub-fb-1', FeedbackStatus.OPEN);

      expect(result.status).toBe(FeedbackStatus.OPEN);
    });

    it('동일 상태 전이를 차단한다', async () => {
      const fb = mockFeedback({ status: FeedbackStatus.OPEN });
      feedbackRepo.findOne.mockResolvedValue(fb);

      await expect(
        service.updateStatus('pub-fb-1', FeedbackStatus.OPEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findByPublicId ────────────────────────────────
  describe('findByPublicId', () => {
    it('피드백 상세 정보를 screenshot 포함하여 반환한다', async () => {
      const fb = mockFeedback({ screenshot: 'data:image/png;base64,abc' });
      feedbackRepo.findOne.mockResolvedValue(fb);

      const result = await service.findByPublicId('pub-fb-1');

      expect(result).toHaveProperty('screenshot', 'data:image/png;base64,abc');
      expect(result).not.toHaveProperty('id');
    });

    it('존재하지 않는 publicId이면 NotFoundException을 던진다', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByPublicId('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteOldScreenshots ──────────────────────────
  describe('deleteOldScreenshots', () => {
    it('30일 경과 스크린샷을 null 처리하고 건수를 반환한다', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 5 });

      const result = await service.deleteOldScreenshots();

      expect(result).toBe(5);
      expect(feedbackRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Feedback);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ screenshot: null });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('screenshot IS NOT NULL');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'created_at < :cutoff',
        expect.objectContaining({ cutoff: expect.any(Date) }),
      );
    });

    it('대상이 없으면 0을 반환한다', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      const result = await service.deleteOldScreenshots();

      expect(result).toBe(0);
    });

    it('affected가 undefined이면 0을 반환한다', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: undefined });

      const result = await service.deleteOldScreenshots();

      expect(result).toBe(0);
    });
  });
});
