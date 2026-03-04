import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReviewService } from './review.service';
import { ReviewComment } from './review-comment.entity';
import { ReviewReply } from './review-reply.entity';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockCommentRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
});

const mockReplyRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
});

// ─── 테스트 헬퍼 ────────────────────────────────────────────────
const createMockComment = (overrides: Partial<ReviewComment> = {}): ReviewComment =>
  ({
    id: 1,
    publicId: 'comment-pub-1',
    submissionId: 'sub-uuid-1',
    authorId: 'user-1',
    studyId: 'study-uuid-1',
    lineNumber: 10,
    content: '좋은 풀이입니다',
    createdAt: new Date('2026-02-28T00:00:00Z'),
    updatedAt: new Date('2026-02-28T00:00:00Z'),
    deletedAt: null,
    replies: [],
    generatePublicId: jest.fn(),
    ...overrides,
  }) as unknown as ReviewComment;

const createMockReply = (overrides: Partial<ReviewReply> = {}): ReviewReply =>
  ({
    id: 1,
    publicId: 'reply-pub-1',
    commentId: 1,
    authorId: 'user-1',
    content: '감사합니다',
    createdAt: new Date('2026-02-28T00:00:00Z'),
    updatedAt: new Date('2026-02-28T00:00:00Z'),
    deletedAt: null,
    generatePublicId: jest.fn(),
    ...overrides,
  }) as unknown as ReviewReply;

describe('ReviewService', () => {
  let service: ReviewService;
  let commentRepo: jest.Mocked<Repository<ReviewComment>>;
  let replyRepo: jest.Mocked<Repository<ReviewReply>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(ReviewComment), useFactory: mockCommentRepo },
        { provide: getRepositoryToken(ReviewReply), useFactory: mockReplyRepo },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    commentRepo = module.get(getRepositoryToken(ReviewComment));
    replyRepo = module.get(getRepositoryToken(ReviewReply));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── COMMENT CRUD ──────────────────────────────────────────────

  describe('createComment() — 댓글 작성', () => {
    it('정상적으로 댓글을 생성한다', async () => {
      const saved = createMockComment();
      commentRepo.save.mockResolvedValue(saved);

      const result = await service.createComment(
        { submissionId: 'sub-uuid-1', content: '좋은 풀이입니다', lineNumber: 10 },
        'user-1',
        'study-uuid-1',
      );

      expect(commentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'sub-uuid-1',
          authorId: 'user-1',
          studyId: 'study-uuid-1',
          lineNumber: 10,
          content: '좋은 풀이입니다',
        }),
      );
      expect(result).toEqual(saved);
    });

    it('lineNumber가 없으면 null로 저장한다', async () => {
      const saved = createMockComment({ lineNumber: null });
      commentRepo.save.mockResolvedValue(saved);

      await service.createComment(
        { submissionId: 'sub-uuid-1', content: '전체 코멘트' },
        'user-1',
        'study-uuid-1',
      );

      expect(commentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lineNumber: null }),
      );
    });
  });

  describe('findCommentsBySubmission() — 제출별 댓글 목록', () => {
    it('제출 ID와 스터디 ID로 댓글 목록을 조회한다', async () => {
      const comments = [createMockComment(), createMockComment({ id: 2, publicId: 'comment-pub-2' })];
      commentRepo.find.mockResolvedValue(comments);

      const result = await service.findCommentsBySubmission('sub-uuid-1', 'study-uuid-1');

      expect(commentRepo.find).toHaveBeenCalledWith({
        where: { submissionId: 'sub-uuid-1', studyId: 'study-uuid-1' },
        relations: ['replies'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(comments);
    });
  });

  describe('updateComment() — 댓글 수정', () => {
    it('본인 댓글이면 정상 수정한다', async () => {
      const comment = createMockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      const updated = createMockComment({ content: '수정된 코멘트' });
      commentRepo.save.mockResolvedValue(updated);

      const result = await service.updateComment(
        'comment-pub-1',
        { content: '수정된 코멘트' },
        'user-1',
      );

      expect(commentRepo.save).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('댓글이 존재하지 않으면 NotFoundException', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateComment('non-existent', { content: '수정' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('본인이 아닌 사용자가 수정하면 ForbiddenException (IDOR 방어)', async () => {
      const comment = createMockComment({ authorId: 'user-1' });
      commentRepo.findOne.mockResolvedValue(comment);

      await expect(
        service.updateComment('comment-pub-1', { content: '수정' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteComment() — 댓글 soft-delete', () => {
    it('본인 댓글이면 soft-delete 한다', async () => {
      const comment = createMockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      commentRepo.softDelete.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.deleteComment('comment-pub-1', 'user-1');

      expect(commentRepo.softDelete).toHaveBeenCalledWith(1);
    });

    it('댓글이 존재하지 않으면 NotFoundException', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteComment('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('본인이 아닌 사용자가 삭제하면 ForbiddenException (IDOR 방어)', async () => {
      const comment = createMockComment({ authorId: 'user-1' });
      commentRepo.findOne.mockResolvedValue(comment);

      await expect(
        service.deleteComment('comment-pub-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── REPLY CRUD ────────────────────────────────────────────────

  describe('createReply() — 답글 작성', () => {
    it('원본 댓글이 존재하면 정상적으로 답글을 생성한다', async () => {
      const comment = createMockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      const saved = createMockReply();
      replyRepo.save.mockResolvedValue(saved);

      const result = await service.createReply(
        { commentPublicId: 'comment-pub-1', content: '감사합니다' },
        'user-1',
      );

      expect(commentRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'comment-pub-1' },
      });
      expect(replyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: 1,
          authorId: 'user-1',
          content: '감사합니다',
        }),
      );
      expect(result).toEqual(saved);
    });

    it('원본 댓글이 없으면 NotFoundException', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReply(
          { commentPublicId: 'non-existent', content: '답글' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRepliesByCommentPublicId() — 댓글별 답글 목록', () => {
    it('댓글이 존재하면 답글 목록을 반환한다', async () => {
      const comment = createMockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      const replies = [createMockReply(), createMockReply({ id: 2, publicId: 'reply-pub-2' })];
      replyRepo.find.mockResolvedValue(replies);

      const result = await service.findRepliesByCommentPublicId('comment-pub-1');

      expect(replyRepo.find).toHaveBeenCalledWith({
        where: { commentId: 1 },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(replies);
    });

    it('댓글이 없으면 NotFoundException', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findRepliesByCommentPublicId('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReply() — 답글 수정', () => {
    it('본인 답글이면 정상 수정한다', async () => {
      const reply = createMockReply();
      replyRepo.findOne.mockResolvedValue(reply);
      const updated = createMockReply({ content: '수정된 답글' });
      replyRepo.save.mockResolvedValue(updated);

      const result = await service.updateReply(
        'reply-pub-1',
        { content: '수정된 답글' },
        'user-1',
      );

      expect(replyRepo.save).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('답글이 존재하지 않으면 NotFoundException', async () => {
      replyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReply('non-existent', { content: '수정' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('본인이 아닌 사용자가 수정하면 ForbiddenException (IDOR 방어)', async () => {
      const reply = createMockReply({ authorId: 'user-1' });
      replyRepo.findOne.mockResolvedValue(reply);

      await expect(
        service.updateReply('reply-pub-1', { content: '수정' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReply() — 답글 soft-delete', () => {
    it('본인 답글이면 soft-delete 한다', async () => {
      const reply = createMockReply();
      replyRepo.findOne.mockResolvedValue(reply);
      replyRepo.softDelete.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.deleteReply('reply-pub-1', 'user-1');

      expect(replyRepo.softDelete).toHaveBeenCalledWith(1);
    });

    it('답글이 존재하지 않으면 NotFoundException', async () => {
      replyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteReply('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('본인이 아닌 사용자가 삭제하면 ForbiddenException (IDOR 방어)', async () => {
      const reply = createMockReply({ authorId: 'user-1' });
      replyRepo.findOne.mockResolvedValue(reply);

      await expect(
        service.deleteReply('reply-pub-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
