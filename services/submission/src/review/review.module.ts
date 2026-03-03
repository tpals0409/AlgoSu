/**
 * @file 코드리뷰 모듈 — ReviewComment + ReviewReply CRUD
 * @domain review
 * @layer config
 * @related ReviewController, ReviewService
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewComment } from './review-comment.entity';
import { ReviewReply } from './review-reply.entity';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewComment, ReviewReply])],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
