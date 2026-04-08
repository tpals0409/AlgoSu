/**
 * @file 피드백 모듈 — FeedbackController 등록
 * @domain feedback
 * @layer config
 * @related FeedbackController, IdentityClientModule
 */

import { Module } from '@nestjs/common';
import { IdentityClientModule } from '../identity-client/identity-client.module';
import { FeedbackController } from './feedback.controller';

@Module({
  imports: [IdentityClientModule],
  controllers: [FeedbackController],
})
export class FeedbackModule {}
