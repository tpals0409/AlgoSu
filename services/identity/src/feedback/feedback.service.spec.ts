/**
 * @file 피드백 서비스 단위 테스트 — create / findByUserId / findAll / updateStatus / deleteOldScreenshots
 * @domain identity
 * @layer test
 * @related feedback.service.ts, feedback.entity.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { Feedback, FeedbackCategory, FeedbackStatus } from './feedback.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockFeedback = (overrides: Partial<Feedback> = {}): Feedback =>
  ({
    id: 1,
    publicId: 'pub-fb-1',
    userId: 'user-1',
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
  }) as Feedback;

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepo: jest.Mocked<Repository<Feedback>>;

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

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
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(FeedbackService);
    feedbackRepo = module.get(getRepositoryToken(Feedback));
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
        category: FeedbackCategory.BUG,
        content: '테스트 피드백입니다.',
        pageUrl: '/problems',
        browserInfo: 'Chrome 130',
        screenshot: 'data:image/png;base64,abc',
      });
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
      const items = [mockFeedback()];
      feedbackRepo.findAndCount.mockResolvedValue([items, 1]);

      const result = await service.findAll();

      expect(result).toEqual({ items, total: 1 });
      expect(feedbackRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('page=2, limit=10이면 skip=10으로 조회한다', async () => {
      feedbackRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(2, 10);

      expect(feedbackRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 10,
      });
    });

    it('limit이 100을 초과하면 100으로 제한한다', async () => {
      feedbackRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 200);

      expect(feedbackRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
    });

    it('page가 0 이하이면 1로 보정한다', async () => {
      feedbackRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(0, 20);

      expect(feedbackRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
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
