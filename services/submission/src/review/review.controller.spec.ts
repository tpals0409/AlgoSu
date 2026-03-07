import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

describe('ReviewController', () => {
  let controller: ReviewController;
  let reviewService: jest.Mocked<ReviewService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        {
          provide: ReviewService,
          useValue: {
            createComment: jest.fn(),
            findCommentsBySubmission: jest.fn(),
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            createReply: jest.fn(),
            findRepliesByCommentPublicId: jest.fn(),
            updateReply: jest.fn(),
            deleteReply: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(StudyMemberGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReviewController>(ReviewController);
    reviewService = module.get(ReviewService);
  });

  // ── COMMENTS ──

  describe('createComment()', () => {
    it('댓글을 생성하고 반환한다', async () => {
      const dto = { submissionId: 'sub-1', content: 'test comment', lineNumber: 5 } as any;
      const mockComment = { id: 'c-1', ...dto };
      reviewService.createComment.mockResolvedValue(mockComment as any);

      const result = await controller.createComment(dto, 'user-1', 'study-1');

      expect(result).toEqual({ data: mockComment });
      expect(reviewService.createComment).toHaveBeenCalledWith(dto, 'user-1', 'study-1');
    });
  });

  describe('findComments()', () => {
    it('제출별 댓글 목록을 반환한다', async () => {
      const mockComments = [{ id: 'c-1' }];
      reviewService.findCommentsBySubmission.mockResolvedValue(mockComments as any);

      const result = await controller.findComments('sub-1', 'study-1');

      expect(result).toEqual({ data: mockComments });
    });
  });

  describe('updateComment()', () => {
    it('댓글을 수정하고 반환한다', async () => {
      const dto = { content: 'updated' } as any;
      const mockComment = { id: 'c-1', content: 'updated' };
      reviewService.updateComment.mockResolvedValue(mockComment as any);

      const result = await controller.updateComment('pub-1', dto, 'user-1');

      expect(result).toEqual({ data: mockComment });
      expect(reviewService.updateComment).toHaveBeenCalledWith('pub-1', dto, 'user-1');
    });
  });

  describe('deleteComment()', () => {
    it('댓글을 soft-delete한다', async () => {
      reviewService.deleteComment.mockResolvedValue(undefined);

      await controller.deleteComment('pub-1', 'user-1');

      expect(reviewService.deleteComment).toHaveBeenCalledWith('pub-1', 'user-1');
    });
  });

  // ── REPLIES ──

  describe('createReply()', () => {
    it('대댓글을 생성하고 반환한다', async () => {
      const dto = { commentPublicId: 'c-pub-1', content: 'reply' } as any;
      const mockReply = { id: 'r-1', ...dto };
      reviewService.createReply.mockResolvedValue(mockReply as any);

      const result = await controller.createReply(dto, 'user-1', 'study-1');

      expect(result).toEqual({ data: mockReply });
      expect(reviewService.createReply).toHaveBeenCalledWith(dto, 'user-1', 'study-1');
    });
  });

  describe('findReplies()', () => {
    it('댓글별 대댓글 목록을 반환한다', async () => {
      const mockReplies = [{ id: 'r-1' }];
      reviewService.findRepliesByCommentPublicId.mockResolvedValue(mockReplies as any);

      const result = await controller.findReplies('c-pub-1');

      expect(result).toEqual({ data: mockReplies });
    });
  });

  describe('updateReply()', () => {
    it('답글을 수정하고 반환한다', async () => {
      const dto = { content: 'updated reply' } as any;
      const mockReply = { id: 'r-1', content: 'updated reply' };
      reviewService.updateReply.mockResolvedValue(mockReply as any);

      const result = await controller.updateReply('r-pub-1', dto, 'user-1');

      expect(result).toEqual({ data: mockReply });
    });
  });

  describe('deleteReply()', () => {
    it('답글을 soft-delete한다', async () => {
      reviewService.deleteReply.mockResolvedValue(undefined);

      await controller.deleteReply('r-pub-1', 'user-1');

      expect(reviewService.deleteReply).toHaveBeenCalledWith('r-pub-1', 'user-1');
    });
  });
});
