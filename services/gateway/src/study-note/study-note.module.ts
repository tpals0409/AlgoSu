/**
 * @file 스터디 노트 프록시 모듈 — Gateway → Submission Service 프록시
 * @domain review
 * @layer config
 * @related StudyNoteProxyController, StructuredLoggerService
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StudyNoteProxyController } from './study-note.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StudyNoteProxyController],
})
export class StudyNoteProxyModule {}
