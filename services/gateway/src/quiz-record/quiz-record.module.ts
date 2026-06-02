/**
 * @file 퀴즈 기록 모듈 (BFF)
 * @domain quiz-record
 * @layer config
 * @related QuizRecordController, QuizRecordService, IdentityClientService
 *
 * IdentityClientService는 IdentityClientModule(@Global)에서 제공되므로 재import 불필요.
 */
import { Module } from '@nestjs/common';
import { QuizRecordController } from './quiz-record.controller';
import { QuizRecordService } from './quiz-record.service';

@Module({
  controllers: [QuizRecordController],
  providers: [QuizRecordService],
  exports: [QuizRecordService],
})
export class QuizRecordModule {}
