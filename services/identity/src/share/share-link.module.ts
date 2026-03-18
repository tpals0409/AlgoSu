/**
 * @file ShareLink 모듈 — 공유 링크 CRUD + 토큰 검증
 * @domain share
 * @layer module
 * @related share-link.service.ts, share-link.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareLink } from './share-link.entity';
import { ShareLinkService } from './share-link.service';
import { ShareLinkController } from './share-link.controller';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShareLink])],
  controllers: [ShareLinkController],
  providers: [ShareLinkService, StructuredLoggerService],
  exports: [ShareLinkService],
})
export class ShareLinkModule {}
