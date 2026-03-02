/**
 * @file 코드리뷰 프록시 모듈 — Gateway → Submission Service 프록시
 * @domain review
 * @layer config
 * @related ReviewProxyController
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewProxyController } from './review.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ReviewProxyController],
})
export class ReviewProxyModule {}
