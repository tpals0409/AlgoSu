/**
 * @file Study 모듈 — 스터디/멤버/초대 관리
 * @domain identity
 * @layer module
 * @related study.service.ts, study.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Study, StudyMember, StudyInvite } from './study.entity';
import { StudyService } from './study.service';
import { StudyController } from './study.controller';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Study, StudyMember, StudyInvite])],
  controllers: [StudyController],
  providers: [StudyService, StructuredLoggerService],
  exports: [StudyService],
})
export class StudyModule {}
