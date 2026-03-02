/**
 * @file 스터디 노트 모듈 — StudyNote UPSERT + 조회
 * @domain review
 * @layer config
 * @related StudyNoteController, StudyNoteService
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudyNote } from './study-note.entity';
import { StudyNoteController } from './study-note.controller';
import { StudyNoteService } from './study-note.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudyNote])],
  controllers: [StudyNoteController],
  providers: [StudyNoteService],
  exports: [StudyNoteService],
})
export class StudyNoteModule {}
