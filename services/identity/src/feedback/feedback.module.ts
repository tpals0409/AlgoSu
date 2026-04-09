/**
 * @file 피드백 모듈 — TypeORM + Service + Controller 등록
 * @domain identity
 * @layer module
 * @related feedback.entity.ts, feedback.service.ts, feedback.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback]), DiscordModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, StructuredLoggerService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
