/**
 * @file 스터디 노트 서비스 — 문제별 메모 UPSERT + 조회
 * @domain review
 * @layer service
 * @related StudyNote
 */
import {
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudyNote } from './study-note.entity';
import { UpsertStudyNoteDto } from './dto/upsert-study-note.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class StudyNoteService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(StudyNote)
    private readonly noteRepo: Repository<StudyNote>,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(StudyNoteService.name);
  }

  /**
   * 메모 생성/수정 — problemId + studyId unique 기반 upsert
   * @domain review
   * @guard study-member
   */
  async upsert(
    dto: UpsertStudyNoteDto,
    _userId: string,
    studyId: string,
  ): Promise<StudyNote> {
    const existing = await this.noteRepo.findOne({
      where: { problemId: dto.problemId, studyId },
    });

    if (existing) {
      existing.content = dto.content;
      const updated = await this.noteRepo.save(existing);
      this.logger.log(
        `노트 수정: noteId=${updated.publicId}, problemId=${dto.problemId}`,
      );
      return updated;
    }

    const note = new StudyNote();
    note.problemId = dto.problemId;
    note.studyId = studyId;
    note.content = dto.content;

    const saved = await this.noteRepo.save(note);
    this.logger.log(
      `노트 생성: noteId=${saved.publicId}, problemId=${dto.problemId}`,
    );
    return saved;
  }

  /**
   * 메모 조회 — problemId + studyId 기준
   * @domain review
   * @guard study-member
   */
  async findByProblemAndStudy(
    problemId: string,
    studyId: string,
  ): Promise<StudyNote | null> {
    return this.noteRepo.findOne({
      where: { problemId, studyId },
    });
  }
}
