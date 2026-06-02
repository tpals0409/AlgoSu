/**
 * @file QuizRecord 모듈 — 퀴즈 최고 기록 영속화
 * @domain identity
 * @layer module
 * @related quiz-record.service.ts, quiz-record.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizRecord } from './quiz-record.entity';
import { QuizRecordService } from './quiz-record.service';
import { QuizRecordController } from './quiz-record.controller';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuizRecord])],
  controllers: [QuizRecordController],
  providers: [QuizRecordService, InternalKeyGuard, StructuredLoggerService],
  exports: [QuizRecordService],
})
export class QuizRecordModule {}
